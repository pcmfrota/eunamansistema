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
        const fichasComLancamentos = Array.isArray(localFichas) ? localFichas.map((ficha: any) => ({
          ...ficha,
          lancamentos: Array.isArray(localLancamentos) ? localLancamentos.filter((l: any) => l && l.ficha_id === ficha.id) : []
        })) : [];

        const eqFiltrados = Array.isArray(localEq) ? localEq.filter(
          eq => eq && (!eq.status || (eq.status !== "Inativo" && eq.status !== "INATIVO"))
        ) : [];

        if (active) {
          setFichas(fichasComLancamentos);
          setEquipamentos(eqFiltrados);
          setColaboradores(Array.isArray(localCol) ? localCol : []);
          setCalendario(Array.isArray(localCal) ? localCal : []);
          setLoading(false);
        }

        // 2. Se online, roda sync seletivo e atualiza do IndexedDB
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["fichas_captacao", "lancamentos_captacao", "equipamentos", "colaboradores", "calendario_suzano"]);
          if (syncSuccess) {
            const freshFichas = await localDb.getAll("fichas_captacao");
            const freshLancamentos = await localDb.getAll("lancamentos_captacao");
            const freshEq = await localDb.getAll("equipamentos");
            const freshCol = await localDb.getAll("colaboradores");
            const freshCal = await localDb.getAll("calendario_suzano");

            const freshFichasComLancamentos = Array.isArray(freshFichas) ? freshFichas.map((ficha: any) => ({
              ...ficha,
              lancamentos: Array.isArray(freshLancamentos) ? freshLancamentos.filter((l: any) => l && l.ficha_id === ficha.id) : []
            })) : [];

            const freshEqFiltrados = Array.isArray(freshEq) ? freshEq.filter(
              eq => eq && (!eq.status || (eq.status !== "Inativo" && eq.status !== "INATIVO"))
            ) : [];

            if (active) {
              setFichas(freshFichasComLancamentos);
              setEquipamentos(freshEqFiltrados);
              setColaboradores(Array.isArray(freshCol) ? freshCol : []);
              setCalendario(Array.isArray(freshCal) ? freshCal : []);
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
