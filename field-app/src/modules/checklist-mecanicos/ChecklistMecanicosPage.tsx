"use client";

import { useEffect, useState } from "react";
import ChecklistMecanicosClient from "./ChecklistMecanicosClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

function isEquipamentoAtivo(e: any) {
  const st = String(e.status || "Ativo").toUpperCase().trim();
  return !e.deleted_at && st !== "INATIVO" && st !== "BAIXADO" && st !== "DESATIVADO";
}

function buildEquipamentos(raw: any[]) {
  return raw.filter(isEquipamentoAtivo).map((e) => ({
    id: e.id,
    placa: e.placa,
    categoria: e.categoria,
    co: e.co,
    area: e.area,
    local: e.local,
  }));
}

export default function ChecklistMecanicosPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ equipamentos: any[]; checklists_mecanicos: any[] }>([
          "equipamentos",
          "checklists_mecanicos",
        ]);

        if (active) {
          setEquipamentos(buildEquipamentos(stores.equipamentos || []));
          setChecklists(stores.checklists_mecanicos || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "checklists_mecanicos"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ equipamentos: any[]; checklists_mecanicos: any[] }>([
              "equipamentos",
              "checklists_mecanicos",
            ]);
            if (active) {
              setEquipamentos(buildEquipamentos(fresh.equipamentos || []));
              setChecklists(fresh.checklists_mecanicos || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Checklist Mecânico:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-checklists_mecanicos", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-checklists_mecanicos", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Checklist Mecânico" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <ChecklistMecanicosClient equipamentos={equipamentos} checklistsIniciais={checklists} />;
}
