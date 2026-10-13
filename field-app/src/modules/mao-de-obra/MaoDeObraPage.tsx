"use client";

import { useEffect, useState } from "react";
import MaoDeObraClient from "./MaoDeObraClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

const STORES = [
  "fichas_mao_obra",
  "apontamentos_mao_obra",
  "equipamentos",
  "colaboradores",
  "calendario_suzano",
  "mao_obra_catalogos",
  "mao_obra_apontamentos_catalogo",
];

export default function MaoDeObraPage() {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<any[]>([]);
  const [apontamentos, setApontamentos] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [calendario, setCalendario] = useState<any[]>([]);
  const [catalogos, setCatalogos] = useState<any[]>([]);
  const [apontamentosCatalogo, setApontamentosCatalogo] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega do IndexedDB local imediatamente (Offline-First em lote)
        const stores = await localDb.getManyStores<{
          fichas_mao_obra: any[];
          apontamentos_mao_obra: any[];
          equipamentos: any[];
          colaboradores: any[];
          calendario_suzano: any[];
          mao_obra_catalogos: any[];
          mao_obra_apontamentos_catalogo: any[];
        }>(STORES);

        const isHeavyActive = (e: any) => {
          if (!e || e.deleted_at) return false;
          const cat = (e.categoria || 'PESADA').toString().toUpperCase();
          const isPesada = cat === 'PESADA' || cat === 'FROTA PESADA' || cat.includes('PESADA');
          const st = (e.status || 'ATIVO').toString().toUpperCase();
          const isAtivo = st !== 'INATIVO' && st !== 'BAIXADO' && st !== 'DESATIVADO';
          return isPesada && isAtivo;
        };

        const localFichas = stores.fichas_mao_obra || [];
        const localApontamentos = stores.apontamentos_mao_obra || [];
        const localEq = (stores.equipamentos || [])
          .filter(isHeavyActive)
          .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""));
        const localCol = stores.colaboradores || [];
        const localCal = stores.calendario_suzano || [];
        const localCatalogos = stores.mao_obra_catalogos || [];
        const localApontCatalogo = stores.mao_obra_apontamentos_catalogo || [];

        if (active) {
          setFichas(localFichas);
          setApontamentos(localApontamentos);
          setEquipamentos(localEq);
          setColaboradores(localCol);
          setCalendario(localCal);
          setCatalogos(localCatalogos);
          setApontamentosCatalogo(localApontCatalogo);
          setLoading(false);
        }

        // 2. Se online, roda sync seletivo e atualiza do IndexedDB
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(STORES);
          if (syncSuccess) {
            const freshStores = await localDb.getManyStores<{
              fichas_mao_obra: any[];
              apontamentos_mao_obra: any[];
              equipamentos: any[];
              colaboradores: any[];
              calendario_suzano: any[];
              mao_obra_catalogos: any[];
              mao_obra_apontamentos_catalogo: any[];
            }>(STORES);

            const freshEq = (freshStores.equipamentos || [])
              .filter(isHeavyActive)
              .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""));

            if (active) {
              setFichas(freshStores.fichas_mao_obra || []);
              setApontamentos(freshStores.apontamentos_mao_obra || []);
              setEquipamentos(freshEq);
              setColaboradores(freshStores.colaboradores || []);
              setCalendario(freshStores.calendario_suzano || []);
              setCatalogos(freshStores.mao_obra_catalogos || []);
              setApontamentosCatalogo(freshStores.mao_obra_apontamentos_catalogo || []);
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
    window.addEventListener("offline-db-updated-apontamentos_mao_obra", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-fichas_mao_obra", loadData);
      window.removeEventListener("offline-db-updated-apontamentos_mao_obra", loadData);
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
      initialApontamentos={apontamentos}
      equipamentos={equipamentos}
      colaboradores={colaboradores}
      calendario={calendario}
      catalogos={catalogos}
      apontamentosCatalogo={apontamentosCatalogo}
      userRole={profile?.role || "mecanico"}
    />
  );
}
