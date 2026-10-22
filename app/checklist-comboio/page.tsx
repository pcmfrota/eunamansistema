"use client";

import { useEffect, useState } from "react";
import ChecklistComboioClient from "./ChecklistComboioClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function ChecklistComboioPage() {
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
          localDb.getAll("checklist_comboio"),
          localDb.getAll("equipamentos"),
        ]);
        if (active) {
          setChecklists(localChecklists);
          setEquipamentos((localEquip || []).filter((e: any) => e.tipo === "COMBOIO"));
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["checklist_comboio", "equipamentos"]);
          if (syncSuccess) {
            const [freshChecklists, freshEquip] = await Promise.all([
              localDb.getAll("checklist_comboio"),
              localDb.getAll("equipamentos"),
            ]);
            if (active) {
              setChecklists(freshChecklists);
              setEquipamentos((freshEquip || []).filter((e: any) => e.tipo === "COMBOIO"));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar checklist de comboio:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-checklist_comboio", loadData);

    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-checklist_comboio", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Checklist Comboio" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <ChecklistComboioClient isVisitante={isVisitante} initialChecklists={checklists} equipamentos={equipamentos} />
    </div>
  );
}
