"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  Database, 
  ClipboardList, 
  Calendar, 
  CircleDot, 
  FileText, 
  Clock,
  Droplets,
  AlertTriangle,
  Send
} from "lucide-react";
import { localDb, SyncItem } from "@/lib/offline-db";
import { cn } from "@/lib/utils";

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
  const [queueItems, setQueueItems] = useState<SyncItem[]>([]);
  const [recentlySynced, setRecentlySynced] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // --- 1. Verificador de Conectividade Ativa (Ping Real) ---
  const checkConnectivity = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    // Fast check: if browser says we're offline, we're offline.
    if (!navigator.onLine) return false;

    try {
      // Faz uma requisição GET simples e rápida no endpoint de ping
      // Reduzimos o timeout para 5 segundos para ser mais ágil
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("/api/ping", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (err) {
      console.warn("[Connectivity Check] Falha ao conectar ao servidor:", err);
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
  const triggerSync = async (forceOnline = false) => {
    if (syncing || (!isOnline && !forceOnline)) return;

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
      const { replaySyncItem } = await import("@/lib/offline-actions");

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

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case "captacao": return "Captação de Água";
      case "os": return "Ordem de Serviço";
      case "preventiva": return "Preventiva";
      case "horimetro": return "Horímetro";
      case "pneu": return "Boletim de Pneus";
      case "backlog": return "Backlog";
      case "lavagem": return "Controle de Lavagens";
      case "calendario": return "Calendário Suzano";
      case "colaborador": return "Colaborador";
      case "prev_prog_semanal": return "Prog. Preventiva";
      default: return entity;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create": return "Novo Registro";
      case "update": return "Alteração";
      case "delete": return "Exclusão";
      case "bulk_delete": return "Exclusão em Lote";
      case "import": return "Importação";
      case "update_status": return "Alterar Status";
      case "register": return "Cadastro";
      case "close": return "Fechamento";
      case "add_lancamento": return "Novo Lançamento";
      case "delete_lancamento": return "Excluir Lançamento";
      case "validate": return "Validação";
      case "save_calendario": return "Salvar Escala";
      case "update_status_prog_semanal": return "Atualizar Prog. Preventiva";
      default: return action;
    }
  };

  const getEntityColor = (entity: string) => {
    switch (entity) {
      case "captacao": return "text-blue-500 bg-blue-500/10 border-blue-500/20 dark:text-blue-400";
      case "os": return "text-amber-500 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
      case "preventiva":
      case "horimetro": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400";
      case "pneu": return "text-rose-500 bg-rose-500/10 border-rose-500/20 dark:text-rose-400";
      case "backlog": return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-400";
      case "lavagem": return "text-cyan-500 bg-cyan-500/10 border-cyan-500/20 dark:text-cyan-400";
      default: return "text-zinc-500 bg-zinc-500/10 border-zinc-500/20 dark:text-zinc-400";
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case "captacao": return <Droplets size={14} />;
      case "os": return <ClipboardList size={14} />;
      case "preventiva":
      case "horimetro": return <Calendar size={14} />;
      case "pneu": return <CircleDot size={14} />;
      case "backlog": return <FileText size={14} />;
      case "lavagem": return <Droplets size={14} />;
      default: return <Database size={14} />;
    }
  };

  const getItemDescription = (item: SyncItem) => {
    const p = item.payload || {};
    if (item.entity === "captacao") {
      if (p.caminhao) return `Caminhão: ${p.caminhao}`;
      if (p.motorista) return `Motorista: ${p.motorista}`;
      if (p.id_ficha) return `Ficha ID: ${p.id_ficha}`;
    }
    if (item.entity === "os") {
      if (p.numero) return `O.S. Nº ${p.numero}`;
      if (p.equipamento) return `Equipamento: ${p.equipamento}`;
    }
    if (item.entity === "preventiva" || item.entity === "horimetro") {
      if (p.prefixo) return `Prefixo: ${p.prefixo}`;
      if (p.caminhao) return `Caminhão: ${p.caminhao}`;
    }
    if (item.entity === "pneu") {
      if (p.prefixo) return `Prefixo: ${p.prefixo}`;
      if (p.fogo) return `Pneu Fogo: ${p.fogo}`;
    }
    if (item.entity === "backlog") {
      if (p.prefixo) return `Prefixo: ${p.prefixo}`;
      if (p.os_vinculada) return `O.S.: ${p.os_vinculada}`;
    }
    if (p.id) return `ID: ${p.id}`;
    return "";
  };

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, syncing, triggerSync }}>
      {children}

      {/* ─── Premium Glassmorphic floating symbol (fixed at the top center on mobile, top right on desktop) ─── */}
      <div className="fixed top-[12px] left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 lg:top-4 z-[999] pointer-events-auto">
        {/* State 1: Offline status symbol */}
        {!isOnline && (
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-white dark:bg-zinc-900 text-amber-500 shadow-lg hover:shadow-amber-500/10 active:scale-95 transition-all hover:border-amber-500/50 animate-pulse"
            title="Modo Offline - Clique para ver rascunhos"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <WifiOff size={16} />
            {pendingCount > 0 && (
              <span className="bg-amber-500/10 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded-md font-black">
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {/* State 2: Syncing status symbol */}
        {isOnline && syncing && (
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-500/30 bg-white dark:bg-zinc-900 text-blue-500 dark:text-blue-400 shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all"
            title="Sincronizando dados..."
          >
            <RefreshCw size={14} className="animate-spin text-blue-500 dark:text-blue-400" />
            <span className="text-[10px] font-bold">Sync...</span>
          </button>
        )}

        {/* State 3: Synced Success symbol */}
        {isOnline && !syncing && showSyncSuccess && (
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-lg active:scale-95 transition-all animate-bounce"
            title="Sincronizado com sucesso!"
          >
            <CheckCircle2 size={14} />
          </button>
        )}
      </div>

      {/* ─── Backdrop Drawer Overlay ─── */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* ─── Premium Sync Drawer / Sheet ─── */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-l border-zinc-200 dark:border-zinc-800 z-[10001] shadow-2xl flex flex-col backdrop-blur-md transition-transform duration-300 ease-out",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center border",
              isOnline ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500" : "bg-amber-500/10 border-amber-500/25 text-amber-500"
            )}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            </div>
            <div>
              <h3 className="font-extrabold uppercase tracking-wider text-sm">Status de Conectividade</h3>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                {isOnline ? "Conectado à Internet" : "Modo Offline / Sem Conexão"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Status Message */}
          <div className={cn(
            "p-4 rounded-2xl border text-xs leading-relaxed font-bold uppercase tracking-wide",
            isOnline 
              ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-400"
          )}>
            {isOnline ? (
              pendingCount > 0 
                ? "Conexão ativa! Existem rascunhos salvos no aparelho que estão aguardando para serem sincronizados."
                : "Sistema totalmente conectado e sincronizado com o banco de dados online."
            ) : (
              "Você está trabalhando de forma local (offline). Todas as fichas, assinaturas e lançamentos estão salvos no aparelho e serão sincronizados automaticamente assim que você tiver internet."
            )}
          </div>

          {/* Pending Sync Section */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center justify-between">
              <span>Rascunhos Pendentes ({pendingCount})</span>
              <span className="font-mono text-zinc-400"> IndexedDB queue </span>
            </h4>

            {queueItems.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-xs font-bold uppercase tracking-wide">
                Nenhum rascunho pendente
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {queueItems.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className="p-3 border border-zinc-200 dark:border-zinc-850 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", getEntityColor(item.entity))}>
                        {getEntityIcon(item.entity)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold truncate text-zinc-850 dark:text-zinc-150">
                          {getEntityLabel(item.entity)}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate font-semibold uppercase">
                          {getActionLabel(item.action)} • {getItemDescription(item)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recently Synced Section */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Sincronizados nesta sessão ({recentlySynced.length})
            </h4>

            {recentlySynced.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-xs font-bold uppercase tracking-wide">
                Nenhum item sincronizado recentemente
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {recentlySynced.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3 border border-emerald-500/10 dark:border-emerald-500/5 rounded-xl bg-emerald-500/5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold truncate text-emerald-600 dark:text-emerald-400">
                          {getEntityLabel(item.entity)}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-semibold uppercase">
                          {getActionLabel(item.action)} • {getItemDescription(item)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500/80 font-mono">
                      ok
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-950/80 flex flex-col gap-3">
          {isOnline && pendingCount > 0 ? (
            <button
              onClick={async () => {
                try {
                  await triggerSync(true);
                  alert("Sincronização forçada iniciada!");
                } catch(e) {
                  alert("Erro ao tentar sincronizar.");
                }
              }}
              disabled={syncing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Sincronizar Agora
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="w-full py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-extrabold uppercase tracking-wider text-xs rounded-xl active:scale-[0.98] transition-all text-center"
            >
              Fechar Painel
            </button>
          )}
        </div>
      </div>
    </OfflineContext.Provider>
  );
}
