"use client";

import { useEffect, useState } from "react";
import DocumentosClient from "./DocumentosClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function DocumentosPage() {
  const { isOnline } = useOffline();
  const { isVisitante } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tacografos, setTacografos] = useState<any[]>([]);
  const [civCipps, setCivCipps] = useState<any[]>([]);
  const [laudosEletro, setLaudosEletro] = useState<any[]>([]);
  const [laudosImplemento, setLaudosImplemento] = useState<any[]>([]);
  const [crlvePesados, setCrlvePesados] = useState<any[]>([]);
  const [crlveLeves, setCrlveLeves] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        // 1. Carrega local (Offline-First)
        const localTac = await localDb.open().then(() => localDb.getAll("docs_tacografo"));
        const localCiv = await localDb.getAll("docs_civ_cipp");
        const localEletro = await localDb.getAll("docs_laudo_eletromecanico");
        const localImpl = await localDb.getAll("docs_laudo_implemento");
        const localCrlveP = await localDb.getAll("docs_crlve_pesados");
        const localCrlveL = await localDb.getAll("docs_crlve_leve");

        if (active) {
          setTacografos(localTac);
          setCivCipps(localCiv);
          setLaudosEletro(localEletro);
          setLaudosImplemento(localImpl);
          setCrlvePesados(localCrlveP);
          setCrlveLeves(localCrlveL);
          setLoading(false);
        }

        // 2. Se online, roda sync e atualiza do IndexedDB
        if (isOnline) {
          const { syncAllTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncAllTables();
          if (syncSuccess) {
            const freshTac = await localDb.getAll("docs_tacografo");
            const freshCiv = await localDb.getAll("docs_civ_cipp");
            const freshEletro = await localDb.getAll("docs_laudo_eletromecanico");
            const freshImpl = await localDb.getAll("docs_laudo_implemento");
            const freshCrlveP = await localDb.getAll("docs_crlve_pesados");
            const freshCrlveL = await localDb.getAll("docs_crlve_leve");
            if (active) {
              setTacografos(freshTac);
              setCivCipps(freshCiv);
              setLaudosEletro(freshEletro);
              setLaudosImplemento(freshImpl);
              setCrlvePesados(freshCrlveP);
              setCrlveLeves(freshCrlveL);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar documentos:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    // Também ouve atualizações locais de documentos
    window.addEventListener("offline-db-updated-docs_tacografo", loadData);
    window.addEventListener("offline-db-updated-docs_civ_cipp", loadData);
    window.addEventListener("offline-db-updated-docs_laudo_eletromecanico", loadData);
    window.addEventListener("offline-db-updated-docs_laudo_implemento", loadData);
    window.addEventListener("offline-db-updated-docs_crlve_pesados", loadData);
    window.addEventListener("offline-db-updated-docs_crlve_leve", loadData);

    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
      window.removeEventListener("offline-db-updated-docs_tacografo", loadData);
      window.removeEventListener("offline-db-updated-docs_civ_cipp", loadData);
      window.removeEventListener("offline-db-updated-docs_laudo_eletromecanico", loadData);
      window.removeEventListener("offline-db-updated-docs_laudo_implemento", loadData);
      window.removeEventListener("offline-db-updated-docs_crlve_pesados", loadData);
      window.removeEventListener("offline-db-updated-docs_crlve_leve", loadData);
    };
  }, [isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Documentos da Frota" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <DocumentosClient 
        isVisitante={isVisitante} 
        initialTacografos={tacografos}
        initialCivCipps={civCipps}
        initialLaudosEletro={laudosEletro}
        initialLaudosImplemento={laudosImplemento}
        initialCrlvePesados={crlvePesados}
        initialCrlveLeves={crlveLeves}
      />
    </div>
  );
}
