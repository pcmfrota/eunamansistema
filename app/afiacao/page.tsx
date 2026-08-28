"use client";

import { useEffect, useState } from "react";
import AfiacaoClient from "./AfiacaoClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

function sortAfiacoes(raw: any[]) {
  return [...raw].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

function sortAuxiliares(raw: any[]) {
  return [...raw].sort((a, b) => (a.value || "").localeCompare(b.value || ""));
}

export default function AfiacaoPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [afiacoes, setAfiacoes] = useState<any[]>([]);
  const [auxiliares, setAuxiliares] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ afiacao: any[]; aux_afiacao: any[] }>([
          "afiacao",
          "aux_afiacao",
        ]);

        if (active) {
          setAfiacoes(sortAfiacoes(stores.afiacao || []));
          setAuxiliares(sortAuxiliares(stores.aux_afiacao || []));
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["afiacao", "aux_afiacao"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ afiacao: any[]; aux_afiacao: any[] }>([
              "afiacao",
              "aux_afiacao",
            ]);
            if (active) {
              setAfiacoes(sortAfiacoes(fresh.afiacao || []));
              setAuxiliares(sortAuxiliares(fresh.aux_afiacao || []));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Afiação:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando Afiação" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Afiação</h2>
      </div>
      <AfiacaoClient initialAfiacoes={afiacoes} initialAuxiliares={auxiliares} />
    </div>
  );
}
