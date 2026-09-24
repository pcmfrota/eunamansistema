"use client";

import { useEffect, useState } from "react";
import CustosClient from "./CustosClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

const STORES = ["custos_manutencao", "custos_fornecedores", "custos_parcelas", "equipamentos"];

export default function CustosPage() {
  const { isOnline } = useOffline();
  const { isVisitante } = useAuth();
  const [loading, setLoading] = useState(true);
  const [custos, setCustos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<Record<string, any[]>>(STORES);
        const localCustos = stores.custos_manutencao || [];
        const localFornecedores = stores.custos_fornecedores || [];
        const localParcelas = stores.custos_parcelas || [];
        const localEquip = stores.equipamentos || [];

        if (active) {
          setCustos(localCustos);
          setFornecedores(localFornecedores);
          setParcelas(localParcelas);
          setEquipamentos(localEquip);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(STORES);
          if (syncSuccess) {
            const freshStores = await localDb.getManyStores<Record<string, any[]>>(STORES);
            if (active) {
              setCustos(freshStores.custos_manutencao || []);
              setFornecedores(freshStores.custos_fornecedores || []);
              setParcelas(freshStores.custos_parcelas || []);
              setEquipamentos(freshStores.equipamentos || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar custos de manutenção:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-custos_manutencao", loadData);
    window.addEventListener("offline-db-updated-custos_fornecedores", loadData);
    window.addEventListener("offline-db-updated-custos_parcelas", loadData);
    window.addEventListener("offline-db-updated-equipamentos", loadData);

    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-custos_manutencao", loadData);
      window.removeEventListener("offline-db-updated-custos_fornecedores", loadData);
      window.removeEventListener("offline-db-updated-custos_parcelas", loadData);
      window.removeEventListener("offline-db-updated-equipamentos", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Controle de Custos" subtext="Buscando lançamentos locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <CustosClient
        isVisitante={isVisitante}
        initialCustos={custos}
        fornecedores={fornecedores}
        parcelas={parcelas}
        equipamentos={equipamentos}
      />
    </div>
  );
}
