"use client";

import { useEffect, useState } from "react";
import HorimetroClient from "./HorimetroClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

function buildEquipamentos(raw: any[]) {
  return raw
    .filter((e) => !e.deleted_at)
    .map((e) => ({ id: e.id, placa: e.placa, modelo: e.modelo }))
    .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""));
}

function buildHistorico(raw: any[]) {
  return [...raw].sort((a, b) => {
    const dataCompare = (b.data_referencia || "").localeCompare(a.data_referencia || "");
    if (dataCompare !== 0) return dataCompare;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

export default function HorimetroPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ equipamentos: any[]; horimetros: any[] }>([
          "equipamentos",
          "horimetros",
        ]);

        if (active) {
          setEquipamentos(buildEquipamentos(stores.equipamentos || []));
          setHistorico(buildHistorico(stores.horimetros || []));
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "horimetros"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ equipamentos: any[]; horimetros: any[] }>([
              "equipamentos",
              "horimetros",
            ]);
            if (active) {
              setEquipamentos(buildEquipamentos(fresh.equipamentos || []));
              setHistorico(buildHistorico(fresh.horimetros || []));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Horímetro:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando Horímetros" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full">
      <HorimetroClient equipamentos={equipamentos} historico={historico} />
    </div>
  );
}
