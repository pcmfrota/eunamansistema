"use client";

import { useEffect, useState } from "react";
import CaptacaoClient from "./CaptacaoClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

export default function CaptacaoPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [calendario, setCalendario] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First)
        const localFichas = await localDb.getAll("fichas_captacao");
        const localLancamentos = await localDb.getAll("lancamentos_captacao");
        const localEq = await localDb.getAll("equipamentos");
        const localCol = await localDb.getAll("colaboradores");
        const localCal = await localDb.getAll("calendario_suzano");

        // Associa os lançamentos correspondentes a cada ficha (ficha_id)
        const fichasComLancamentos = localFichas.map((ficha: any) => ({
          ...ficha,
          lancamentos: localLancamentos.filter((l: any) => l.ficha_id === ficha.id)
        }));

        const eqFiltrados = localEq.filter(
          eq => !eq.status || (eq.status !== "Inativo" && eq.status !== "INATIVO")
        );

        if (active) {
          setFichas(fichasComLancamentos);
          setEquipamentos(eqFiltrados);
          setColaboradores(localCol);
          setCalendario(localCal);
          setLoading(false);
        }

        // 2. Se online, roda sync e atualiza do IndexedDB
        if (isOnline) {
          const { syncAllTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncAllTables();
          if (syncSuccess) {
            const freshFichas = await localDb.getAll("fichas_captacao");
            const freshLancamentos = await localDb.getAll("lancamentos_captacao");
            const freshEq = await localDb.getAll("equipamentos");
            const freshCol = await localDb.getAll("colaboradores");
            const freshCal = await localDb.getAll("calendario_suzano");

            const freshFichasComLancamentos = freshFichas.map((ficha: any) => ({
              ...ficha,
              lancamentos: freshLancamentos.filter((l: any) => l.ficha_id === ficha.id)
            }));

            const freshEqFiltrados = freshEq.filter(
              eq => !eq.status || (eq.status !== "Inativo" && eq.status !== "INATIVO")
            );

            if (active) {
              setFichas(freshFichasComLancamentos);
              setEquipamentos(freshEqFiltrados);
              setColaboradores(freshCol);
              setCalendario(freshCal);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar captação:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando Captação de Água" subtext="Buscando fichas locais..." />
      </div>
    );
  }

  return (
    <CaptacaoClient
      initialFichas={fichas}
      equipamentos={equipamentos}
      colaboradores={colaboradores}
      calendario={calendario}
    />
  );
}
