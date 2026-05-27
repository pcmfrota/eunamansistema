"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Registrar o sw.js localizado na raiz pública
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
