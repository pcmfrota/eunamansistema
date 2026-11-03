"use client";

import { useEffect, useState } from "react";
import LubrificacaoClient from "./LubrificacaoClient";
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
    modulo: e.modulo,
    categoria: e.categoria,
    area: e.area,
    status: e.status,
  }));
}

export default function LubrificacaoPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [fichas, setFichas] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ equipamentos: any[]; colaboradores: any[]; fichas_lubrificacao: any[] }>([
          "equipamentos",
          "colaboradores",
          "fichas_lubrificacao",
        ]);

        if (active) {
          setEquipamentos(buildEquipamentos(stores.equipamentos || []));
          setColaboradores(stores.colaboradores || []);
          setFichas(stores.fichas_lubrificacao || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "colaboradores", "fichas_lubrificacao"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ equipamentos: any[]; colaboradores: any[]; fichas_lubrificacao: any[] }>([
              "equipamentos",
              "colaboradores",
              "fichas_lubrificacao",
            ]);
            if (active) {
              setEquipamentos(buildEquipamentos(fresh.equipamentos || []));
              setColaboradores(fresh.colaboradores || []);
              setFichas(fresh.fichas_lubrificacao || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Lubrificação:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-fichas_lubrificacao", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-fichas_lubrificacao", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Lubrificação" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <LubrificacaoClient equipamentos={equipamentos} colaboradores={colaboradores} fichasIniciais={fichas} />;
}
