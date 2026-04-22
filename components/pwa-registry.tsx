"use client";

import { useEffect } from "react";

export function PWARegistry() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        // No desenvolvimento, desativamos o SW para evitar problemas de cache e tela quebrada
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
        return;
      }

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) =>
          console.log("Service Worker registered with scope:", registration.scope)
        )
        .catch((err) => console.log("Service Worker registration failed:", err));
    }
  }, []);

  return null;
}
