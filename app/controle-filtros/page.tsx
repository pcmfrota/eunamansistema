"use client";

import { useEffect, useState } from "react";
import ControleFiltrosClient from "./ControleFiltrosClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function ControleFiltrosPage() {
  const { isOnline } = useOffline();
  const { isVisitante } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [localLanc, localEquip] = await Promise.all([
          localDb.getAll("controle_filtros_implemento"),
          localDb.getAll("equipamentos"),
        ]);
        if (active) {
          setLancamentos(localLanc);
          setEquipamentos(localEquip || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["controle_filtros_implemento", "equipamentos"]);
          if (syncSuccess) {
            const [freshLanc, freshEquip] = await Promise.all([
              localDb.getAll("controle_filtros_implemento"),
              localDb.getAll("equipamentos"),
            ]);
            if (active) {
              setLancamentos(freshLanc);
              setEquipamentos(freshEquip || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar controle de filtros do implemento:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-controle_filtros_implemento", loadData);

    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-controle_filtros_implemento", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Controle de Filtros" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <ControleFiltrosClient isVisitante={isVisitante} initialLancamentos={lancamentos} equipamentos={equipamentos} />
    </div>
  );
}
