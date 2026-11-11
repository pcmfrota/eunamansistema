"use client";

import { useEffect, useState } from "react";
import OSClient from "./OSClient";
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
    categoria: e.categoria,
    co: e.co,
    area: e.area,
    local: e.local,
    modulo: e.modulo,
  }));
}

// Mesma derivação do site (app/os/page.tsx): a lista de Motivos não é fixa, é a união dos
// valores já usados em OS existentes com o catálogo administrável (aux_config, tipo
// "Motivo") — sem isso, o campo "Motivo" aqui só mostrava um fallback de 3 itens pra
// sempre, escondendo motivos reais já cadastrados (BASE TEMPO, MOBILIZAÇÃO, etc.).
function buildMotivos(ordens: any[], auxConfigs: any[]): string[] {
  const motivosSet = new Set<string>();
  ordens.forEach((o: any) => {
    if (o.motivo) motivosSet.add(o.motivo);
  });
  auxConfigs.forEach((a: any) => {
    if (a.tipo === "Motivo" && a.valor) motivosSet.add(a.valor);
  });
  return Array.from(motivosSet).sort();
}

export default function OSPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{ equipamentos: any[]; colaboradores: any[]; ordens_servico: any[]; aux_config: any[] }>([
          "equipamentos",
          "colaboradores",
          "ordens_servico",
          "aux_config",
        ]);

        if (active) {
          setEquipamentos(buildEquipamentos(stores.equipamentos || []));
          setColaboradores(stores.colaboradores || []);
          setOrdens(stores.ordens_servico || []);
          setMotivos(buildMotivos(stores.ordens_servico || [], stores.aux_config || []));
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["equipamentos", "colaboradores", "ordens_servico", "aux_config"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{ equipamentos: any[]; colaboradores: any[]; ordens_servico: any[]; aux_config: any[] }>([
              "equipamentos",
              "colaboradores",
              "ordens_servico",
              "aux_config",
            ]);
            if (active) {
              setEquipamentos(buildEquipamentos(fresh.equipamentos || []));
              setColaboradores(fresh.colaboradores || []);
              setOrdens(fresh.ordens_servico || []);
              setMotivos(buildMotivos(fresh.ordens_servico || [], fresh.aux_config || []));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar OS:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-ordens_servico", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-ordens_servico", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Ordens de Serviço" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return <OSClient equipamentos={equipamentos} colaboradores={colaboradores} ordensIniciais={ordens} motivos={motivos} />;
}
