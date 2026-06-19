"use client";

import { useEffect, useState } from "react";
import ProgPrevClient from "./ProgPrevClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";
import { Settings2 } from "lucide-react";

export default function ProgramacaoPreventiva() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [progSemanais, setProgSemanais] = useState<any[]>([]);
  const [calendario, setCalendario] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const anoAtivo = new Date().getFullYear();

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First)
        const localProg = await localDb.getAll("prev_prog_semanal");
        const localCal = await localDb.getAll("calendario_suzano");
        const localEq = await localDb.getAll("equipamentos");

        const filteredProg = localProg.filter(p => p.ano === anoAtivo);
        const filteredCal = localCal.filter(c => c.ano === anoAtivo);
        const mappedEq = localEq.map((e: any) => ({
          id: e.id,
          placa: e.placa,
          categoria: e.categoria,
        }));

        if (active) {
          setProgSemanais(filteredProg);
          setCalendario(filteredCal);
          setEquipamentos(mappedEq);
          setLoading(false);
        }

        // 2. Se online, roda sync e atualiza do IndexedDB
        if (isOnline) {
          const { syncAllTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncAllTables();
          if (syncSuccess) {
            const freshProg = await localDb.getAll("prev_prog_semanal");
            const freshCal = await localDb.getAll("calendario_suzano");
            const freshEq = await localDb.getAll("equipamentos");

            const freshFilteredProg = freshProg.filter(p => p.ano === anoAtivo);
            const freshFilteredCal = freshCal.filter(c => c.ano === anoAtivo);
            const freshMappedEq = freshEq.map((e: any) => ({
              id: e.id,
              placa: e.placa,
              categoria: e.categoria,
            }));

            if (active) {
              setProgSemanais(freshFilteredProg);
              setCalendario(freshFilteredCal);
              setEquipamentos(freshMappedEq);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar programação preventiva:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando Programação Preventiva" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-[96rem] mx-auto w-full min-h-screen bg-gray-50">
      <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-200 bg-white">
        <div className="p-3 bg-green-100 text-green-700 rounded-xl shadow-sm">
          <Settings2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black">Programação Preventiva</h1>
          <p className="text-sm text-black mt-0.5 font-medium">
            Lançamentos pela aba Programação Semanal · Dashboards calculados automaticamente
          </p>
        </div>
      </div>

      <ProgPrevClient
        progSemanais={progSemanais}
        calendario={calendario}
        equipamentos={equipamentos}
        anoAtivo={anoAtivo}
      />
    </div>
  );
}
