"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
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

      // Registrar o sw.js localizado na raiz pública em produção
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[Service Worker] Registrado com sucesso! Escopo:", registration.scope);
          })
          .catch((error) => {
            console.error("[Service Worker] Falha ao registrar:", error);
          });
      });
    }
  }, []);

  return null;
}
