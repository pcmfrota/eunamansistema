"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { localDb } from "@/lib/offline-db";

interface OfflineContextType {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  triggerSync: () => Promise<void>;
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

  // --- 1. Verificador de Conectividade Ativa (Ping Real) ---
  const checkConnectivity = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !navigator.onLine) {
      return false;
    }
    try {
      // Faz um HEAD fetch rápido no favicon para contornar Wi-Fis de fachada sem sinal real
      const response = await fetch("/favicon.ico", {
        method: "HEAD",
        cache: "no-store",
        mode: "no-cors"
      });
      return true;
    } catch (err) {
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

    // Eventos do navegador
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    // Intervalo de segurança (15 segundos)
    const interval = setInterval(updateNetworkStatus, 15000);

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
  const triggerSync = async () => {
    if (syncing || !isOnline) return;

    try {
      const queue = await localDb.getQueue();
      if (queue.length === 0) {
        // Fila vazia, apenas roda sync em background se estiver online
        const { syncAllTables } = await import("@/lib/offline-sync");
        await syncAllTables();
        return;
      }

      setSyncing(true);
      console.log(`[Sync Manager] Iniciando sincronização de ${queue.length} registros...`);

      // Carrega dinamicamente os replicadores de ação para evitar dependências circulares de Server Actions
      const { replaySyncItem } = await import("@/lib/offline-actions");

      for (const item of queue) {
        console.log(`[Sync Manager] Sincronizando item ID: ${item.id} (${item.entity}:${item.action})...`);
        
        try {
          const success = await replaySyncItem(item);
          if (success) {
            // Remove da fila do IndexedDB
            if (item.id !== undefined) {
              await localDb.removeFromQueue(item.id);
            }
            console.log(`[Sync Manager] Item ID ${item.id} sincronizado com sucesso!`);
          } else {
            console.warn(`[Sync Manager] Falha ao sincronizar item ID ${item.id}. Interrompendo lote.`);
            break; // Para o processamento em lote se der erro técnico
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
      setSyncing(false);
    }
  };

  // Dispara sincronização automática se houver conexão e itens na fila
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      triggerSync();
    }
  }, [isOnline, pendingCount]);

  // Boot Sync proativo ao iniciar online ou reatar conexão
  useEffect(() => {
    if (isOnline && !syncing) {
      const runBootSync = async () => {
        try {
          console.log("[OfflineProvider] Executando boot sync em background...");
          const { syncAllTables } = await import("@/lib/offline-sync");
          await syncAllTables();
          window.dispatchEvent(new CustomEvent("offline-sync-completed"));
        } catch (err) {
          console.error("[OfflineProvider] Erro ao rodar boot sync:", err);
        }
      };
      runBootSync();
    }
  }, [isOnline]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, syncing, triggerSync }}>
      {children}

      {/* ─── Premium Glassmorphic floating pill indicator ─── */}
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
        {!isOnline && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-amber-500/20 bg-zinc-950/90 text-amber-500 shadow-2xl backdrop-blur-md font-sans text-xs font-bold pointer-events-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <WifiOff size={14} className="text-amber-500" />
            <span>Modo Offline • Salvando localmente</span>
            {pendingCount > 0 && (
              <span className="bg-amber-500/10 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase">
                {pendingCount} pendente(s)
              </span>
            )}
          </div>
        )}

        {isOnline && syncing && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-blue-500/20 bg-zinc-950/90 text-blue-400 shadow-2xl backdrop-blur-md font-sans text-xs font-bold pointer-events-auto">
            <RefreshCw size={14} className="animate-spin text-blue-400" />
            <span>Sincronizando dados... ({pendingCount} restantes)</span>
          </div>
        )}

        {isOnline && !syncing && showSyncSuccess && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-emerald-500/20 bg-zinc-950/90 text-emerald-400 shadow-2xl backdrop-blur-md font-sans text-xs font-bold pointer-events-auto animate-out fade-out delay-3000 duration-500">
            <CheckCircle2 size={14} className="text-emerald-400 animate-bounce" />
            <span>Todos os dados foram sincronizados com sucesso!</span>
          </div>
        )}
      </div>
    </OfflineContext.Provider>
  );
}
