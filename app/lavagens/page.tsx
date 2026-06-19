"use client";

import { useEffect, useState, use } from "react";
import LavagensClient from "./LavagensClient";
import { getEquipamentos, getLavagens } from "./actions";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

export default function LavagensPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }> | any;
}) {
  const searchParams = searchParamsPromise && typeof searchParamsPromise.then === 'function'
    ? use(searchParamsPromise) as any
    : searchParamsPromise;

  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [lavagens, setLavagens] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  const now = new Date();
  const mes = searchParams?.mes ? parseInt(searchParams.mes) : now.getMonth() + 1;
  const ano = searchParams?.ano ? parseInt(searchParams.ano) : now.getFullYear();

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        // 1. Carrega do IndexedDB local imediatamente (Offline First)
        const localL = await localDb.getAll("lavagens");
        const localEq = await localDb.getAll("equipamentos");
        const localCol = await localDb.getAll("colaboradores");
        
        // Filtra lavagens locais por mês e ano
        const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const endDate = new Date(ano, mes, 0).toISOString().split('T')[0];
        const filteredLocalL = localL.filter((l: any) => l.data >= startDate && l.data <= endDate);

        if (active) {
          setLavagens(filteredLocalL);
          setEquipamentos(localEq);
          setColaboradores(localCol);
          setLoading(false);
        }

        // 2. Se estiver online, busca do Supabase e atualiza o localDB e o state em background
        if (isOnline) {
          const freshL = await getLavagens(mes, ano);
          const freshEq = await getEquipamentos();
          
          if (freshL && freshL.length > 0) {
            await localDb.saveMany("lavagens", freshL);
          }
          if (freshEq && freshEq.length > 0) {
            await localDb.saveMany("equipamentos", freshEq);
          }

          if (active) {
            setLavagens(freshL);
            setEquipamentos(freshEq);
            const freshCol = await localDb.getAll("colaboradores"); // Assume offline-sync brings it or we just use localDB
            setColaboradores(freshCol);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar lavagens:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-db-updated-lavagens", loadData);
    window.addEventListener("offline-sync-completed", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-lavagens", loadData);
      window.removeEventListener("offline-sync-completed", loadData);
    };
  }, [mes, ano, isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Lavagens" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-transparent">
      <LavagensClient 
        initialLavagens={lavagens} 
        equipamentos={equipamentos}
        colaboradores={colaboradores}
        currentMes={mes}
        currentAno={ano}
      />
    </div>
  );
}
