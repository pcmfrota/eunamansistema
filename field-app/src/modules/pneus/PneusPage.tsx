"use client";

import { useEffect, useState } from "react";
import PneusClient from "./PneusClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

export default function PneusPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [inspecoes, setInspecoes] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First em lote)
        const stores = await localDb.getManyStores<{
          equipamentos: any[];
          pneus_inspecao: any[];
        }>(["equipamentos", "pneus_inspecao"]);

        const localEq = stores.equipamentos || [];
        const localInsp = stores.pneus_inspecao || [];

        if (active) {
          setEquipamentos(localEq);
          setInspecoes(localInsp);
          setLoading(false);
        }

        // 2. Se online, roda sync seletivo e atualiza do IndexedDB
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "inspecoes_pneus"]);
          if (syncSuccess) {
            const freshStores = await localDb.getManyStores<{
              equipamentos: any[];
              pneus_inspecao: any[];
            }>(["equipamentos", "pneus_inspecao"]);

            const freshEq = freshStores.equipamentos || [];
            const freshInsp = freshStores.pneus_inspecao || [];

            if (active) {
              setEquipamentos(freshEq);
              setInspecoes(freshInsp);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar pneus:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando Inspeções de Pneus" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <PneusClient
      equipamentos={equipamentos}
      inspecoes={inspecoes}
    />
  );
}
