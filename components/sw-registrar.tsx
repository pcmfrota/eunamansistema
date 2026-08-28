"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function ServiceWorkerRegistrar() {
  const [updateDisponivel, setUpdateDisponivel] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const isDev = 
        process.env.NODE_ENV === "development" || 
        window.location.hostname === "localhost" || 
        window.location.hostname === "127.0.0.1";

      if (isDev) {
        // No ambiente de desenvolvimento, desregistramos o Service Worker e limpamos o cache
        // para evitar que assets estáticos do Next.js fiquem presos no cache e gerem tela branca (white screen).
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          let hasUnregistered = false;
          const unregisterPromises = registrations.map((registration) => {
            return registration.unregister().then((unregistered) => {
              if (unregistered) {
                console.log("[Service Worker] Desregistrado no ambiente de desenvolvimento:", registration.scope);
                hasUnregistered = true;
              }
            });
          });

          Promise.all(unregisterPromises).then(() => {
            if (hasUnregistered) {
              // Limpa todos os caches
              if ("caches" in window) {
                caches.keys().then((names) => {
                  Promise.all(names.map(name => caches.delete(name))).then(() => {
                    console.log("[Service Worker] Caches limpos com sucesso.");
                    window.location.reload();
                  });
                });
              } else {
                window.location.reload();
              }
            }
          });
        });
        return;
      }

      // Sem isso, um app já aberto (inclusive o APK/TWA, que só abre o site ao vivo e fica
      // com a aba em memória por muito tempo) pode ficar rodando o JS de uma versão antiga
      // mesmo depois de uma correção já estar publicada — só um novo Service Worker assumir
      // o controle não atualiza o código já carregado na página. Em vez de recarregar sozinho
      // (podendo derrubar um formulário em preenchimento), avisa e deixa o usuário escolher a hora.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[Service Worker] Nova versão assumiu o controle.");
        setUpdateDisponivel(true);
      });

      // Registrar o sw.js localizado na raiz pública em produção
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[Service Worker] Registrado com sucesso! Escopo:", registration.scope);

            // O navegador só checa sozinho por um Service Worker novo ao navegar
            // entre páginas — e é justamente o TWA/APK, que fica com a mesma aba
            // aberta em memória por horas, quem nunca dispara isso. Sem checar
            // por conta própria (ao voltar o foco e a cada poucos minutos), o
            // usuário podia ficar dias rodando uma versão antiga sem nunca ver
            // o banner de atualização, mesmo com a correção já publicada.
            const checarAtualizacao = () => registration.update().catch(() => {});

            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") checarAtualizacao();
            });

            setInterval(checarAtualizacao, 5 * 60 * 1000);
          })
          .catch((error) => {
            console.error("[Service Worker] Falha ao registrar:", error);
          });
      });
    }
  }, []);

  if (!updateDisponivel) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto sm:w-80 z-[9999] flex items-center gap-3 p-3.5 rounded-2xl border border-emerald-500/30 bg-white dark:bg-zinc-900 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <RefreshCw size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">Nova versão disponível</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Atualize para pegar as últimas correções.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors"
      >
        Atualizar
      </button>
    </div>
  );
}
