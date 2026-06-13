"use client";

import { useEffect, useState } from "react";
import { getCalendario } from "./actions";
import CalendarioClient from "./CalendarioClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

export default function CalendarioPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const localData = await localDb.getAll("calendario_suzano");
        if (active) {
          localData.sort((a: any, b: any) => b.ano - a.ano || a.mes - b.mes);
          setData(localData);
          setLoading(false);
        }

        if (isOnline) {
          const freshData = await getCalendario();
          if (freshData && freshData.length > 0) {
            await localDb.saveMany("calendario_suzano", freshData);
          }
          if (active) {
            setData(freshData);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar calendário:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-db-updated-calendario_suzano", loadData);
    window.addEventListener("offline-sync-completed", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-calendario_suzano", loadData);
      window.removeEventListener("offline-sync-completed", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Calendário" subtext="Buscando escalas e fechamentos locais..." />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Calendário Suzano</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Definição dos períodos de fechamento mensal</p>
      </div>

      <CalendarioClient initialData={data} />
    </div>
  );
}
