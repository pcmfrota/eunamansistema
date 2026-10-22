"use client";

import { useEffect, useState } from "react";
import ChecklistFrotaClient from "./ChecklistFrotaClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function ChecklistFrotaPage() {
  const { isOnline } = useOffline();
  const { isVisitante } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [localChecklists, localEquip] = await Promise.all([
          localDb.getAll("checklist_frota"),
          localDb.getAll("equipamentos"),
        ]);
        if (active) {
          setChecklists(localChecklists);
          setEquipamentos(localEquip || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["checklist_frota", "equipamentos"]);
          if (syncSuccess) {
            const [freshChecklists, freshEquip] = await Promise.all([
              localDb.getAll("checklist_frota"),
              localDb.getAll("equipamentos"),
            ]);
            if (active) {
              setChecklists(freshChecklists);
              setEquipamentos(freshEquip || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar checklist de frota:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-checklist_frota", loadData);

    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-checklist_frota", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Checklist de Frota" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <ChecklistFrotaClient isVisitante={isVisitante} initialChecklists={checklists} equipamentos={equipamentos} />
    </div>
  );
}
