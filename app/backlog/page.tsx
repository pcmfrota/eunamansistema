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
        // 1. Carrega local (Offline-First em lote)
        const stores = await localDb.getManyStores<{
          equipamentos: any[];
          colaboradores: any[];
          calendario_suzano: any[];
        }>(["equipamentos", "colaboradores", "calendario_suzano"]);

        const localEq = stores.equipamentos || [];
        const localCol = stores.colaboradores || [];
        const localCal = stores.calendario_suzano || [];

        const isHeavyActive = (e: any) => {
          if (e.deleted_at) return false;
          const cat = (e.categoria || 'PESADA').toString().toUpperCase();
          const isPesada = cat === 'PESADA' || cat === 'FROTA PESADA' || cat.includes('PESADA');
          const st = (e.status || 'ATIVO').toString().toUpperCase();
          const isAtivo = st !== 'INATIVO' && st !== 'BAIXADO' && st !== 'DESATIVADO';
          return isPesada && isAtivo;
        };

        const pl = localEq.filter(isHeavyActive).map(e => ({
          id: e.id,
          placa: e.placa,
          modulo: e.modulo,
          area: e.area,
          categoria: e.categoria,
          status: e.status,
          created_at: e.created_at,
          deleted_at: e.deleted_at,
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
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "colaboradores", "calendario_suzano", "backlog"]);
          if (syncSuccess) {
            const freshStores = await localDb.getManyStores<{
              equipamentos: any[];
              colaboradores: any[];
              calendario_suzano: any[];
            }>(["equipamentos", "colaboradores", "calendario_suzano"]);

            const freshEq = freshStores.equipamentos || [];
            const freshCol = freshStores.colaboradores || [];
            const freshCal = freshStores.calendario_suzano || [];

            const freshPl = freshEq.filter(isHeavyActive).map(e => ({
              id: e.id,
              placa: e.placa,
              modulo: e.modulo,
              area: e.area,
              categoria: e.categoria,
              status: e.status,
              created_at: e.created_at,
              deleted_at: e.deleted_at,
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
