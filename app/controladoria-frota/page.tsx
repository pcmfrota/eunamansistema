"use client";

import { useEffect, useState } from "react";
import ControladoriaFrotaClient from "./ControladoriaFrotaClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function ControladoriaFrotaPage() {
  const { isOnline } = useOffline();
  const { isVisitante } = useAuth();
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const local = await localDb.getAll("controladoria_frota");
        if (active) {
          setRegistros(local);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["controladoria_frota"]);
          if (syncSuccess) {
            const fresh = await localDb.getAll("controladoria_frota");
            if (active) setRegistros(fresh);
          }

          // Checagem de CNH vencida "sob demanda" (sem cron no projeto) — dispara
          // no máximo uma notificação por registro a cada poucos dias, ver o
          // throttle em verificarAlertasCnhVencida (actions.ts).
          import("./actions").then(({ verificarAlertasCnhVencida }) => {
            verificarAlertasCnhVencida().catch(() => {});
          });
        }
      } catch (err) {
        console.error("Erro ao carregar controladoria de frota:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-controladoria_frota", loadData);

    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-controladoria_frota", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Controladoria de Gestão de Frota" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <ControladoriaFrotaClient isVisitante={isVisitante} initialRegistros={registros} />
    </div>
  );
}
