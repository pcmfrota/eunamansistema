"use client";

import { useEffect, useState } from "react";
import PCMClient from "./PCMClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";

function buildPreventivas(prevRaw: any[]) {
  const preventivas = (prevRaw || []).map((p: any) => {
    const restantes =
      Number(p.ultimo_horimetro) + Number(p.intervalo_horas) - Number(p.horimetro_atual);
    const percentual =
      p.intervalo_horas > 0
        ? Math.min(
            100,
            Math.round(
              ((Number(p.horimetro_atual) - Number(p.ultimo_horimetro)) /
                Number(p.intervalo_horas)) *
                100
            )
          )
        : 0;
    let status: "atrasado" | "atencao" | "no_prazo";
    if (restantes < 0) status = "atrasado";
    else if (restantes <= 50) status = "atencao";
    else status = "no_prazo";

    return {
      id: p.id,
      placa: p.equipamentos?.placa ?? "—",
      modelo: p.equipamentos?.modelo ?? "",
      tipo_servico: p.tipo_servico ?? "Preventiva",
      horas_restantes: Math.round(restantes),
      percentual,
      status,
    };
  });

  preventivas.sort((a, b) => a.horas_restantes - b.horas_restantes);
  return preventivas;
}

function buildOsPendentes(osRaw: any[]) {
  return (osRaw || [])
    .filter((os: any) => os.status === "Aberta")
    .sort((a: any, b: any) => (a.data_abertura < b.data_abertura ? 1 : -1))
    .slice(0, 10)
    .map((os: any) => ({
      id: os.id,
      placa: os.placa,
      status: os.status,
      descricao_problema: os.descricao_problema,
      data_abertura: os.data_abertura,
      motivo: os.motivo,
    }));
}

export default function PCMPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [preventivas, setPreventivas] = useState<any[]>([]);
  const [osPendentes, setOsPendentes] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{
          preventivas: any[];
          ordens_servico: any[];
        }>(["preventivas", "ordens_servico"]);

        if (active) {
          setPreventivas(buildPreventivas(stores.preventivas || []));
          setOsPendentes(buildOsPendentes(stores.ordens_servico || []));
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["preventivas", "ordens_servico"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{
              preventivas: any[];
              ordens_servico: any[];
            }>(["preventivas", "ordens_servico"]);
            if (active) {
              setPreventivas(buildPreventivas(fresh.preventivas || []));
              setOsPendentes(buildOsPendentes(fresh.ordens_servico || []));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar PCM:", err);
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
        <PremiumLoader type="squares-sequential" text="Carregando PCM" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <PCMClient preventivas={preventivas} osPendentes={osPendentes} />;
}
