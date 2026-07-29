"use client";

import { useEffect, useState } from "react";
import MaoDeObraClient from "./MaoDeObraClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function MaoDeObraPage() {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega do IndexedDB local imediatamente (Offline-First em lote)
        const stores = await localDb.getManyStores<{
          fichas_mao_obra: any[];
          equipamentos: any[];
          colaboradores: any[];
        }>(["fichas_mao_obra", "equipamentos", "colaboradores"]);

        const localFichas = stores.fichas_mao_obra || [];
        const localEq = stores.equipamentos || [];
        const localCol = stores.colaboradores || [];

        if (active) {
          setFichas(localFichas);
          setEquipamentos(localEq);
          setColaboradores(localCol);
          setLoading(false);
        }

        // 2. Se online, roda sync seletivo e atualiza do IndexedDB
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["fichas_mao_obra", "equipamentos", "colaboradores"]);
          if (syncSuccess) {
            const freshStores = await localDb.getManyStores<{
              fichas_mao_obra: any[];
              equipamentos: any[];
              colaboradores: any[];
            }>(["fichas_mao_obra", "equipamentos", "colaboradores"]);

            if (active) {
              setFichas(freshStores.fichas_mao_obra || []);
              setEquipamentos(freshStores.equipamentos || []);
              setColaboradores(freshStores.colaboradores || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar fichas de mão de obra:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-fichas_mao_obra", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-fichas_mao_obra", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Ficha Diária de Mão de Obra" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <MaoDeObraClient
      initialFichas={fichas}
      equipamentos={equipamentos}
      colaboradores={colaboradores}
      userRole={profile?.role || "mecanico"}
    />
  );
}
