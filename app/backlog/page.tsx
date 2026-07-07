"use client";

import { useEffect, useState } from "react";
import BacklogClient from "./BacklogClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

export default function BacklogPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [placas, setPlacas] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [calendario, setCalendario] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First)
        const localEq = await localDb.getAll("equipamentos");
        const localCol = await localDb.getAll("colaboradores");
        const localCal = await localDb.getAll("calendario_suzano");

        const pl = localEq.map(e => ({
          id: e.id,
          placa: e.placa,
          modulo: e.modulo,
          area: e.area,
        }));

        const col = localCol
          .filter(c => c.tipo?.toUpperCase() === "MECÂNICO")
          .map(c => ({
            id: c.id,
            nome: c.nome,
          }));

        if (active) {
          setPlacas(pl);
          setColaboradores(col);
          setCalendario(localCal || []);
          setLoading(false);
        }

        // 2. Se online, roda sync e atualiza do IndexedDB
        if (isOnline) {
          try {
            const { syncRolePermissions } = await import("./actions");
            await syncRolePermissions();
          } catch (e) {
            console.error("Erro ao rodar syncRolePermissions:", e);
          }
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "colaboradores", "calendario_suzano", "backlog"]);
          if (syncSuccess) {
            const freshEq = await localDb.getAll("equipamentos");
            const freshCol = await localDb.getAll("colaboradores");
            const freshCal = await localDb.getAll("calendario_suzano");

            const freshPl = freshEq.map(e => ({
              id: e.id,
              placa: e.placa,
              modulo: e.modulo,
              area: e.area,
            }));

            const freshColData = freshCol
              .filter(c => c.tipo?.toUpperCase() === "MECÂNICO")
              .map(c => ({
                id: c.id,
                nome: c.nome,
              }));

            if (active) {
              setPlacas(freshPl);
              setColaboradores(freshColData);
              setCalendario(freshCal || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar backlog:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando Backlog de Peças/Serviços" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <BacklogClient placas={placas} colaboradores={colaboradores} calendario={calendario} />;
}
