"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UsuariosClient from "./UsuariosClient";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { PremiumLoader } from "@/components/premium-loader";

export default function UsuariosPage() {
  const router = useRouter();
  const { isOnline } = useOffline();
  const { profile, loading: authLoading, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [filiais, setFiliais] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && profile && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, profile, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;

    const loadData = async () => {
      try {
        const stores = await localDb.getManyStores<{
          profiles: any[];
          role_permissions: any[];
          filiais: any[];
        }>(["profiles", "role_permissions", "filiais"]);

        if (active) {
          setProfiles(sortByNome(stores.profiles || []));
          setPermissions(stores.role_permissions || []);
          setFiliais(stores.filiais || []);
          setLoading(false);
        }

        if (isOnline) {
          const { syncTables } = await import("@/lib/offline-sync");
          const syncSuccess = await syncTables(["profiles", "role_permissions", "filiais"]);
          if (syncSuccess) {
            const fresh = await localDb.getManyStores<{
              profiles: any[];
              role_permissions: any[];
              filiais: any[];
            }>(["profiles", "role_permissions", "filiais"]);
            if (active) {
              setProfiles(sortByNome(fresh.profiles || []));
              setPermissions(fresh.role_permissions || []);
              setFiliais(fresh.filiais || []);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar Admin de Usuários:", err);
        if (active) setLoading(false);
      }
    };

    loadData();

    window.addEventListener("offline-sync-completed", loadData);
    return () => {
      active = false;
      window.removeEventListener("offline-sync-completed", loadData);
    };
  }, [isOnline, isAdmin]);

  if (authLoading || (!isAdmin && profile)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Verificando acesso" subtext="Aguarde um instante..." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Usuários" subtext="Buscando registros locais..." />
      </div>
    );
  }

  return (
    <UsuariosClient
      initialProfiles={profiles}
      initialPermissions={permissions}
      initialFiliais={filiais}
    />
  );
}

function sortByNome(raw: any[]) {
  return [...raw].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
}
