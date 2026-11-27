"use client";

import { useEffect, useState } from "react";
import ControleBateriasClient from "./ControleBateriasClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { PremiumLoader } from "@/components/premium-loader";
import type { Bateria } from "@/lib/baterias";

/** Offline-first: mostra o que está no aparelho (IndexedDB) e atualiza do Supabase quando online. */
export default function ControleBateriasPage() {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [baterias, setBaterias] = useState<Bateria[]>([]);
  // Fornecedores cadastrados no Controle de Custos (custos_fornecedores).
  const [fornecedores, setFornecedores] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const nomes = (lista: { nome_fantasia?: string | null }[]) =>
          Array.from(new Set((lista || []).map(f => String(f.nome_fantasia || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
        const [locais, fornLocais] = await Promise.all([
          localDb.getAll<Bateria>("controle_baterias"),
          localDb.getAll<{ nome_fantasia?: string | null }>("custos_fornecedores").catch(() => []),
        ]);
        if (active) {
          setBaterias(locais || []);
          setFornecedores(nomes(fornLocais));
          setLoading(false);
        }
        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          if (await syncTables(["controle_baterias", "custos_fornecedores"])) {
            const [frescos, fornFrescos] = await Promise.all([
              localDb.getAll<Bateria>("controle_baterias"),
              localDb.getAll<{ nome_fantasia?: string | null }>("custos_fornecedores").catch(() => []),
            ]);
            if (active) { setBaterias(frescos || []); setFornecedores(nomes(fornFrescos)); }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar o Controle de Baterias:", err);
        if (active) setLoading(false);
      }
    };

    loadData();
    window.addEventListener("offline-sync-completed", loadData);
    window.addEventListener("offline-db-updated-controle_baterias", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-controle_baterias", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Controle de Baterias" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <ControleBateriasClient baterias={baterias} fornecedoresCadastro={fornecedores} />
    </div>
  );
}
