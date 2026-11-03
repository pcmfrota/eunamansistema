"use client";

import { useEffect, useState } from "react";
import LavagensClient from "./LavagensClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

function isEquipamentoAtivo(e: any) {
  const st = String(e.status || "Ativo").toUpperCase().trim();
  return !e.deleted_at && st !== "INATIVO" && st !== "BAIXADO" && st !== "DESATIVADO";
}

function buildEquipamentos(raw: any[]) {
  return raw.filter(isEquipamentoAtivo).map((e) => ({
    placa: e.placa,
    modulo: e.modulo,
    categoria: e.categoria,
    area: e.area,
    status: e.status,
  }));
}

export default function LavagensPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [lavagens, setLavagens] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ equipamentos: any[]; lavagens: any[] }>([
          "equipamentos",
          "lavagens",
        ]);

        if (active) {
          setEquipamentos(buildEquipamentos(stores.equipamentos || []));
          setLavagens(stores.lavagens || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "lavagens"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ equipamentos: any[]; lavagens: any[] }>([
              "equipamentos",
              "lavagens",
            ]);
            if (active) {
              setEquipamentos(buildEquipamentos(fresh.equipamentos || []));
              setLavagens(fresh.lavagens || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Lavagens:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-lavagens", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-lavagens", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Lavagens" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <LavagensClient equipamentos={equipamentos} lavagensIniciais={lavagens} />;
}
