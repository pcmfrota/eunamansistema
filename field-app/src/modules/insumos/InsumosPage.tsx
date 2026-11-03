"use client";

import { useEffect, useState } from "react";
import InsumosClient from "./InsumosClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

const STORES = [
  "equipamentos",
  "insumos_fichas_abastecimento",
  "insumos_ficha_insumos",
  "insumos_abastecimento_linhas",
  "insumos_materiais",
  "insumos_modulos",
  "colaboradores",
] as const;

type Stores = {
  equipamentos: any[];
  insumos_fichas_abastecimento: any[];
  insumos_ficha_insumos: any[];
  insumos_abastecimento_linhas: any[];
  insumos_materiais: any[];
  insumos_modulos: any[];
  colaboradores: any[];
};

function isEquipamentoAtivo(e: any) {
  const st = String(e.status || "Ativo").toUpperCase().trim();
  return !e.deleted_at && st !== "INATIVO" && st !== "BAIXADO" && st !== "DESATIVADO";
}

export default function InsumosPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<Stores | null>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<Stores>([...STORES]);
        if (active) {
          setDados(stores);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables([...STORES]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<Stores>([...STORES]);
            if (active) setDados(fresh);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Insumos:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-insumos_fichas_abastecimento", loadData);
    window.addEventListener("offline-db-updated-sync_queue", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-insumos_fichas_abastecimento", loadData);
      window.removeEventListener("offline-db-updated-sync_queue", loadData);
    };
  }, [isOnline]);

  if (loading || !dados) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Insumos" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <InsumosClient
      equipamentos={(dados.equipamentos || []).filter(isEquipamentoAtivo)}
      fichas={dados.insumos_fichas_abastecimento || []}
      fichaInsumos={dados.insumos_ficha_insumos || []}
      linhas={dados.insumos_abastecimento_linhas || []}
      materiais={dados.insumos_materiais || []}
      modulos={dados.insumos_modulos || []}
      colaboradores={dados.colaboradores || []}
    />
  );
}
