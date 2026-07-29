const CACHE_NAME = "eunaman-cache-v12";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/os",
  "/preventivas",
  "/pneus",
  "/backlog",
  "/afiacao",
  "/calendario",
  "/dashboard",
  "/indicadores",
  "/lavagens",
  "/captacao",
  "/programacao-preventiva",
  "/base-frotas",
  "/base-dados",
  "/documentos",
  "/checklist-mecanicos",
  "/admin/usuarios",
  "/manifest.json",
  "/logo-eunaman-full.png",
  "/bg-eunaman.png",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
  "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
];

// --- INSTALL EVENT: Cache core assets ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pré-cacheando recursos essenciais...");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// --- ACTIVATE EVENT: Clean up old caches ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Limpando cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- FETCH EVENT: Intelligent caching strategy ---
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Ignorar requisições não-GET, conexões de HMR/WebSocket e chamadas do Supabase / API internas
  if (
    event.request.method !== "GET" || 
    url.pathname.startsWith("/api/") ||
    url.host.includes("supabase.co") ||
    event.request.url.includes("_next/image") ||
    event.request.url.includes("chrome-extension") ||
    event.request.url.includes("webpack-hmr") ||
    event.request.url.includes("hot-reloader") ||
    event.request.url.includes("socket.io")
  ) {
    return; // Pass-through para rede pura
  }

  // 2. Páginas HTML (Documentos e Navegações) -> NETWORK-FIRST, falling back to Cache
  if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Grava a página no cache se vier com sucesso
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Se a rede falhar (offline), busca a página cacheada ou a casca inicial "/"
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match("/");
          });
        })
    );
    return;
  }

  // 3. Recursos Estáticos (JS, CSS, Imagens, Fontes) -> CACHE-FIRST com fallback na rede
  const isStaticAsset = 
    url.pathname.includes("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".json");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Se não achar no cache, busca na rede e salva dinamicamente
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }

  // 4. Estratégia Padrão -> Rede com fallback no Cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// ─── CODIGO DO PUSH (NOVO / MANTIDO) ──────────────────────────────────────────
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
