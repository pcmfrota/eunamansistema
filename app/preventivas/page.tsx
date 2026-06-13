"use client";

import { useEffect, useState } from "react";
import { Gauge, ShieldAlert } from "lucide-react";
import NovaPreventivaModal from "./NovoModal";
import ControleHorimetrosTabs from "./ControleHorimetrosTabs";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function ControleHorimetrosPage() {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const isVisitante = profile?.role === "visitante";

  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [preventivas, setPreventivas] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First)
        const localEq = await localDb.getAll("equipamentos");
        const localPrev = await localDb.getAll("preventivas");

        const eqTransformados = localEq.map(eq => ({
          id: eq.id,
          placa: eq.placa,
          modelo: eq.modelo || "",
          tipo: eq.tipo,
          modulo: eq.modulo,
          categoria: eq.categoria,
          ultimoHist: eq.ultimoHist || eq.horimetro || 0
        }));

        if (active) {
          setEquipamentos(eqTransformados);
          setPreventivas(localPrev);
          setLoading(false);
        }

        // 2. Se online, roda sync e atualiza do IndexedDB
        if (isOnline) {
          const { syncAllTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncAllTables();
          if (syncSuccess) {
            const freshEq = await localDb.getAll("equipamentos");
            const freshPrev = await localDb.getAll("preventivas");

            const freshEqTransformados = freshEq.map(eq => ({
              id: eq.id,
              placa: eq.placa,
              modelo: eq.modelo || "",
              tipo: eq.tipo,
              modulo: eq.modulo,
              categoria: eq.categoria,
              ultimoHist: eq.ultimoHist || eq.horimetro || 0
            }));

            if (active) {
              setEquipamentos(freshEqTransformados);
              setPreventivas(freshPrev);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar preventivas:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Controle de Horímetros" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[90rem] mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg shadow-sm">
            <Gauge size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 uppercase">
              CONTROLE DE HORÍMETROS
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Pesados (500h) • Leves (10.000 km) • Implemento Zocar (100/500/1.000h)
            </p>
          </div>
        </div>

        {!isVisitante ? (
          <NovaPreventivaModal equipamentos={equipamentos} />
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm border border-amber-200 dark:border-amber-900/30 font-semibold shadow-sm">
            <ShieldAlert size={16} />
            <span>Acesso Restrito: Visualização</span>
          </div>
        )}
      </div>

      <ControleHorimetrosTabs data={preventivas} isVisitante={isVisitante} />
    </div>
  );
}
