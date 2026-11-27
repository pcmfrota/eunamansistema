"use client";

import { useEffect, useState } from "react";
import ControleBateriasClient from "./ControleBateriasClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";
import type { Bateria } from "@/lib/baterias";

/** Offline-first: mostra o que está no aparelho (IndexedDB) e atualiza do Supabase quando online. */
export default function ControleBateriasPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [baterias, setBaterias] = useState<Bateria[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const locais = await localDb.getAll<Bateria>("controle_baterias");
        if (active) {
          setBaterias(locais || []);
          setLoading(false);
        }
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          if (await syncTables(["controle_baterias"])) {
            const frescos = await localDb.getAll<Bateria>("controle_baterias");
            if (active) setBaterias(frescos || []);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar o Controle de Baterias:", err);
        if (active) setLoading(false);
      }
    };

    loadData();
    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-controle_baterias", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-controle_baterias", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Controle de Baterias" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <ControleBateriasClient baterias={baterias} />
    </div>
  );
}
