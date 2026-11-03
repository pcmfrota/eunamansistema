"use client";

import { useEffect, useState } from "react";
import PreventivasClient from "./PreventivasClient";
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
    modelo: e.modelo,
    tipo: e.tipo,
    categoria: e.categoria,
    modulo: e.modulo,
  }));
}

export default function PreventivasPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [preventivas, setPreventivas] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ equipamentos: any[]; preventivas: any[] }>([
          "equipamentos",
          "preventivas",
        ]);

        if (active) {
          setEquipamentos(buildEquipamentos(stores.equipamentos || []));
          setPreventivas(stores.preventivas || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "preventivas"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ equipamentos: any[]; preventivas: any[] }>([
              "equipamentos",
              "preventivas",
            ]);
            if (active) {
              setEquipamentos(buildEquipamentos(fresh.equipamentos || []));
              setPreventivas(fresh.preventivas || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Preventivas:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-preventivas", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-preventivas", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Preventivas" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <PreventivasClient equipamentos={equipamentos} preventivasIniciais={preventivas} />;
}
