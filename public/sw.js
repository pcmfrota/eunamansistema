self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("eunaman-cache-v1").then((cache) => {
      return cache.addAll([
        "/",
        "/horimetro",
        "/pneus",
        "/backlog",
        "/pcm",
        "/manifest.json",
      ]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

// ─── CODIGO DO PUSH (NOVO) ──────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "Atualização no sistema EUNAMAN",
      icon: "/logo-eunaman.svg",
      badge: "/logo-eunaman.svg",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/"
      },
      actions: [
        { action: "open", title: "Ver Detalhes" }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "EUNAMAN Alerta", options)
    );
  } catch (err) {
    console.error("Erro ao processar notificação push", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
