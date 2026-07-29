"use client";

import { useEffect, useState } from "react";
import ControleOSClient from "./OSClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

export default function ControleOSPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First em lote)
        const stores = await localDb.getManyStores<{
          ordens_servico: any[];
          equipamentos: any[];
          catalogo_manutencao: any[];
          aux_config: any[];
          calendario_suzano: any[];
          backlog: any[];
          colaboradores: any[];
        }>([
          "ordens_servico",
          "equipamentos",
          "catalogo_manutencao",
          "aux_config",
          "calendario_suzano",
          "backlog",
          "colaboradores"
        ]);

        const ordens = stores.ordens_servico || [];
        const equipamentosRaw = stores.equipamentos || [];
        const catalogo = stores.catalogo_manutencao || [];
        const auxConfigs = stores.aux_config || [];
        const calendario = stores.calendario_suzano || [];
        const backlogs = stores.backlog || [];
        const colaboradores = stores.colaboradores || [];

        // Processamentos
        const eqTransformados = equipamentosRaw.map(eq => {
          return {
            id: eq.id,
            placa: eq.placa,
            modulo: eq.modulo,
            area: eq.area,
            tipo: eq.tipo,
            categoria: eq.categoria,
            status: eq.status,
          };
        });

        const motivosSet = new Set<string>();
        const operacoesSet = new Set<string>();

        ordens.forEach((o: any) => {
          if (o.motivo) motivosSet.add(o.motivo);
          if (o.operacao_tipo) operacoesSet.add(o.operacao_tipo);
        });

        auxConfigs.forEach((a: any) => {
          if (a.tipo === "Motivo" && a.valor) motivosSet.add(a.valor);
        });

        const motivos = Array.from(motivosSet).sort();
        const operacoesTipo = Array.from(operacoesSet).sort();

        if (active) {
          setData({
            ordens,
            equipamentos: eqTransformados,
            operacoesTipo,
            motivos,
            catalogo,
            calendario,
            backlogs,
            colaboradores,
          });
          setLoading(false);
        }

        // 2. Se online, faz o sync seletivo em background (que preenche localDb)
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables([
            "ordens_servico",
            "equipamentos",
            "catalogo_manutencao",
            "aux_config",
            "calendario_suzano",
            "backlog",
            "colaboradores"
          ]);
          if (syncSuccess) {
            // Se mudou o banco remoto, relemos em lote
            const freshStores = await localDb.getManyStores<{
              ordens_servico: any[];
              equipamentos: any[];
              catalogo_manutencao: any[];
              aux_config: any[];
              calendario_suzano: any[];
              backlog: any[];
              colaboradores: any[];
            }>([
              "ordens_servico",
              "equipamentos",
              "catalogo_manutencao",
              "aux_config",
              "calendario_suzano",
              "backlog",
              "colaboradores"
            ]);

            const freshOrdens = freshStores.ordens_servico || [];
            const freshEqs = freshStores.equipamentos || [];
            const freshCatalogo = freshStores.catalogo_manutencao || [];
            const freshAux = freshStores.aux_config || [];
            const freshCal = freshStores.calendario_suzano || [];
            const freshBacklogs = freshStores.backlog || [];
            const freshColabs = freshStores.colaboradores || [];

            const freshEqTransformados = freshEqs.map(eq => ({
              id: eq.id,
              placa: eq.placa,
              modulo: eq.modulo,
              area: eq.area,
              tipo: eq.tipo,
              categoria: eq.categoria,
              status: eq.status,
            }));

            const freshMotivosSet = new Set<string>();
            const freshOperacoesSet = new Set<string>();

            freshOrdens.forEach((o: any) => {
              if (o.motivo) freshMotivosSet.add(o.motivo);
              if (o.operacao_tipo) freshOperacoesSet.add(o.operacao_tipo);
            });

            freshAux.forEach((a: any) => {
              if (a.tipo === "Motivo" && a.valor) freshMotivosSet.add(a.valor);
            });

            if (active) {
              setData({
                ordens: freshOrdens,
                equipamentos: freshEqTransformados,
                operacoesTipo: Array.from(freshOperacoesSet).sort(),
                motivos: Array.from(freshMotivosSet).sort(),
                catalogo: freshCatalogo,
                calendario: freshCal,
                backlogs: freshBacklogs,
                colaboradores: freshColabs,
              });
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados de OS:", err);
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

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Ordens de Serviço" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <ControleOSClient
      ordens={data.ordens}
      equipamentos={data.equipamentos}
      operacoesTipo={data.operacoesTipo}
      motivos={data.motivos}
      catalogo={data.catalogo}
      periodos={data.calendario}
      initialBacklogs={data.backlogs}
      initialColaboradores={data.colaboradores}
    />
  );
}
