"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { localDb, SyncItem } from "@/lib/offline-db";

// Fase 3: este provider voltou a ser só estado/contexto — a UI fixa (pill +
// drawer) que vivia aqui foi extraída pra field-app/src/ui/primitives/OfflineSyncSheet.tsx
// (OfflineStatusBadge, âncorado na AppBar). queueItems/recentlySynced/showSyncSuccess
// são expostos no contexto pra essa UI renderizar sem duplicar a lógica de sync.
interface OfflineContextType {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  triggerSync: () => Promise<void>;
  queueItems: SyncItem[];
  recentlySynced: any[];
  showSyncSuccess: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline deve ser utilizado dentro de um OfflineProvider");
  }
  return context;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [queueItems, setQueueItems] = useState<SyncItem[]>([]);
  const [recentlySynced, setRecentlySynced] = useState<any[]>([]);

  // --- 1. Verificador de Conectividade Ativa (Ping Real) ---
  const checkConnectivity = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    // Fast check: if browser says we're offline, we're offline.
    if (!navigator.onLine) return false;

    try {
      // Sem /api/ping aqui (não existe servidor no app de campo) — faz um HEAD direto na
      // raiz REST do próprio Supabase. Qualquer resposta HTTP (mesmo um erro 401 por
      // faltar a API key no header, que não mandamos de propósito) já prova que a rede
      // está de pé; só uma falha de fetch (DNS/timeout/offline de verdade) indica que
      // não há conexão real — por isso não checamos response.ok aqui.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      return true;
    } catch (err) {
      console.warn("[Connectivity Check] Falha ao conectar:", err);
      return false;
    }
  };

  const updateNetworkStatus = async () => {
    const activeOnline = await checkConnectivity();
    setIsOnline(activeOnline);
  };

  useEffect(() => {
    // Inicial
    updateNetworkStatus();

    // Eventos do navegador para reação imediata
    const handleOnline = () => {
      console.log("[OfflineProvider] Navegador reportou ONLINE");
      updateNetworkStatus();
    };
    const handleOffline = () => {
      console.log("[OfflineProvider] Navegador reportou OFFLINE");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Intervalo de segurança estendido para 30 segundos
    const interval = setInterval(updateNetworkStatus, 30000);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
      clearInterval(interval);
    };
  }, []);

  // --- 2. Atualizar Contador de Itens Pendentes de Sincronização ---
  const updatePendingCount = async () => {
    try {
      const queue = await localDb.getQueue();
      setPendingCount(queue.length);
      setQueueItems(queue);
    } catch (err) {
      console.error("Erro ao ler fila de sync:", err);
    }
  };

  useEffect(() => {
    updatePendingCount();

    // Ouve alterações no IndexedDB feitas pelas telas
    const handleDbUpdate = () => {
      updatePendingCount();
    };

    window.addEventListener("offline-db-updated-sync_queue", handleDbUpdate);
    return () => {
      window.removeEventListener("offline-db-updated-sync_queue", handleDbUpdate);
    };
  }, []);

  // --- 3. Motor de Sincronização (Replay Queue) ---
  // syncingRef (não só o state "syncing") trava a reentrância de verdade: o app tem DOIS
  // gatilhos independentes de reconexão (o efeito isOnline+pendingCount abaixo E o callback
  // nativo onNetworkSync do Android), e os dois podem disparar quase ao mesmo tempo quando
  // o avião desliga. Checar só o state "syncing" tem uma corrida (setState é assíncrono —
  // as duas chamadas podem ler "syncing = false" antes de qualquer uma setar true), e isso
  // JÁ causou duplicata real num teste (mesma inspeção de pneu sincronizada 2x). O ref é
  // síncrono: a segunda chamada vê true imediatamente e desiste, sem corrida.
  const syncingRef = useRef(false);
  const triggerSync = async (forceOnline = false) => {
    if (syncingRef.current || (!isOnline && !forceOnline)) return;
    syncingRef.current = true;

    try {
      const queue = await localDb.getQueue();
      if (queue.length === 0) {
        // Fila vazia, apenas roda sync em background se estiver online
        const { syncAllTables } = await import("@/lib/offline-sync");
        await syncAllTables();
        return;
      }

      setSyncing(true);
      console.log(`[Sync Manager] Sincronizando mídias e ${queue.length} registros...`);

      // 1. Sincroniza fotos e assinaturas salvas localmente
      try {
        const { offlineMedia } = await import("@/lib/offline-media");
        await offlineMedia.syncPendingMedia();
      } catch (mediaErr) {
        console.warn("[Sync Manager] Erro na sincronização prévia de mídias:", mediaErr);
      }

      // 2. Carrega dinamicamente os replicadores de ação para evitar dependências circulares de Server Actions
      // Cópia local (field-app/src/compat/offline-actions.ts) — só os módulos já
      // portados, não o arquivo real (que importa Server Actions de todo o sistema).
      const { replaySyncItem } = await import("./offline-actions");

      for (const item of queue) {
        console.log(`[Sync Manager] Sincronizando item ID: ${item.id} (${item.entity}:${item.action})...`);
        
        try {
          const res = await replaySyncItem(item);
          const success = typeof res === "boolean" ? res : res.success;
          const retryable = typeof res === "boolean" ? true : (res.retryable !== false);
          const errorMsg = typeof res === "boolean" ? "Erro desconhecido" : (res.error || "Erro de sincronização");

          if (success) {
            // Remove da fila do IndexedDB
            if (item.id !== undefined) {
              await localDb.removeFromQueue(item.id);
            }
            console.log(`[Sync Manager] Item ID ${item.id} sincronizado com sucesso!`);
            setRecentlySynced(prev => [
              { ...item, syncedAt: Date.now() },
              ...prev.slice(0, 19)
            ]);
          } else {
            if (!retryable) {
              console.error(`[Sync Manager] Erro permanente no item ID ${item.id}: ${errorMsg}. Marcando como falho para não bloquear a fila.`);
              if (item.id !== undefined) {
                await localDb.put("sync_queue", {
                  ...item,
                  failed: true,
                  errorMessage: errorMsg
                });
              }
              continue; // Continua com o próximo item da fila
            } else {
              console.warn(`[Sync Manager] Falha temporária no item ID ${item.id}. Interrompendo lote.`);
              break; // Para o processamento em lote se for erro de rede/timeout
            }
          }
        } catch (err) {
          console.error(`[Sync Manager] Erro crítico no item ID ${item.id}:`, err);
          break; // Interrompe para evitar loops infinitos de erro na rede
        }
      }

      // Recarrega o contador e notifica as tabelas abertas
      await updatePendingCount();
      
      // Se limpou toda a fila, mostra sucesso e faz boot sync
      const finalQueue = await localDb.getQueue();
      if (finalQueue.length === 0) {
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 4000);
        
        // Atualiza banco local com dados frescos do Supabase
        const { syncAllTables } = await import("@/lib/offline-sync");
        await syncAllTables();
        
        // Dispara evento global para que todas as telas busquem a versão fresca do Supabase
        window.dispatchEvent(new CustomEvent("offline-sync-completed"));
      }

    } catch (err) {
      console.error("[Sync Manager] Erro geral na sincronização:", err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  // Dispara sincronização automática se houver conexão e itens na fila
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      triggerSync();
    }
  }, [isOnline, pendingCount]);

  // Boot Sync proativo diferido ao iniciar online ou reatar conexão (1.5s de delay para não concorrer com a página atual)
  useEffect(() => {
    if (isOnline && !syncing) {
      const timerId = setTimeout(async () => {
        try {
          console.log("[OfflineProvider] Executando boot sync diferido em background...");
          const { syncAllTables } = await import("@/lib/offline-sync");
          await syncAllTables();
          window.dispatchEvent(new CustomEvent("offline-sync-completed"));
        } catch (err) {
          console.error("[OfflineProvider] Erro ao rodar boot sync:", err);
        }

        // Além dos dados, também atualiza o cache de navegação/código offline (páginas +
        // JS/CSS de TODAS as abas do sistema, não só as já visitadas) — pra "conectar e
        // desconectar" deixar o aplicativo inteiro pronto pra uso sem internet depois,
        // sem depender do usuário ter clicado em cada tela manualmente antes.
        try {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.active?.postMessage({ type: "REFRESH_PRECACHE" });
          }
        } catch (err) {
          console.warn("[OfflineProvider] Falha ao pedir refresh do cache offline:", err);
        }
      }, 1500);

      return () => clearTimeout(timerId);
    }
  }, [isOnline]);

  // Salva referência estável do triggerSync para evitar re-registro do callback global
  const triggerSyncRef = useRef(triggerSync);
  useEffect(() => {
    triggerSyncRef.current = triggerSync;
  }, [triggerSync]);

  // --- 4. Registro do Callback Nativo de Rede (Android WebView) ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).onNetworkSync = async () => {
        console.log("[OfflineProvider] Sinal nativo de rede ativa (onNetworkSync) recebido.");
        setIsOnline(true);
        await triggerSyncRef.current(true);
      };
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).onNetworkSync;
      }
    };
  }, []);

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount, syncing, triggerSync, queueItems, recentlySynced, showSyncSuccess }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
