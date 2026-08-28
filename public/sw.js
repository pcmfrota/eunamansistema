const CACHE_NAME = "eunaman-cache-v16";
const OFFLINE_URL = "/offline.html";

// Páginas/arquivos pré-cacheados na instalação. Cada um é buscado individualmente
// (ver função precache) em vez de usar cache.addAll(), que é tudo-ou-nada: antes,
// se UM único recurso desta lista falhasse (ex: um CDN externo fora do ar por um
// instante), a instalação inteira do Service Worker era rejeitada e ele nunca
// chegava a ativar — ou seja, NENHUMA página ficava disponível offline, mesmo as
// que teriam funcionado perfeitamente. Agora a falha de um item não afeta os demais.
const PRECACHE_URLS = [
  "/",
  "/login",
  OFFLINE_URL,
  "/manifest.json",
  "/logo-eunaman-full.png",
  "/bg-eunaman.png",
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
  "/mao-de-obra",
  "/lubrificacao",
  "/admin/usuarios",
  "/historico-exclusoes",
  "/horimetro",
  "/pcm",
  "/perfil",
  "/login/cadastro",
  "/custos",
  "/semanal",
];

async function precache(cache) {
  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        // Ignora respostas redirecionadas (ex: página exige login e caiu em /login):
        // cachear isso na chave original guardaria o conteúdo errado para essa URL.
        if (response && response.ok && !response.redirected) {
          await cache.put(url, response);
        }
      } catch (err) {
        // Best-effort: um recurso indisponível na instalação não pode impedir os
        // demais de serem cacheados, nem impedir a ativação do Service Worker.
        console.warn("[Service Worker] Falha ao pré-cachear (ignorado):", url, err);
      }
    })
  );
}

// --- INSTALL EVENT: Cache core assets ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("[Service Worker] Pré-cacheando recursos essenciais...");
      await precache(cache);
      return self.skipWaiting();
    })
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

  // 1b. Fetch interno do Next.js App Router (troca de tela client-side, marca com o header
  // "RSC" ou "Next-Router-State-Tree") — não é uma navegação de página nem um asset estático,
  // é um payload especial (RSC/Flight) que este Service Worker não sabe cachear nem responder
  // com um HTML qualquer sem quebrar o parser do Next no cliente. Deixa passar direto: se
  // estiver offline, o fetch falha "puro" e o Next.js detecta e faz o fallback dele mesmo
  // pra navegação completa — que aí sim cai na estratégia de página HTML abaixo.
  if (
    event.request.headers.get("RSC") === "1" ||
    event.request.headers.get("Next-Router-State-Tree") ||
    event.request.headers.get("Next-Router-Prefetch") === "1"
  ) {
    return;
  }

  // 2. Páginas HTML (Documentos e Navegações) -> NETWORK-FIRST, falling back to Cache
  if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Grava a página no cache se vier com sucesso (e sem redirecionamento,
          // para não cachear na URL errada o conteúdo de outra página, ex: /login)
          if (response.ok && !response.redirected) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Se a rede falhar (offline), busca a página cacheada, depois a casca
          // inicial "/", e só em último caso a página estática de "Você está offline"
          // — nunca deixando o respondWith sem nenhuma resposta (o que o Android
          // WebView mostra como uma tela de erro genérica tipo "página não encontrada").
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;

          // Casamento exato (com querystring) pode não existir mesmo a página estando
          // cacheada — ex: cartão do portal manda pra "/os?status=andamento" mas só
          // "/os" (sem parâmetros) foi pré-cacheado. Sem isso, cai direto pro fallback
          // de "/" (a Home) em vez de abrir a página certa — a tela/aba pedida pelo
          // clique simplesmente não abre offline. Cada página lê os parâmetros da URL
          // no próprio cliente (window.location.search) depois de montar, então servir
          // a versão sem querystring do mesmo caminho é suficiente pra aba certa abrir.
          const cachedByPath = await caches.match(event.request, { ignoreSearch: true });
          if (cachedByPath) return cachedByPath;

          const cachedHome = await caches.match("/");
          if (cachedHome) return cachedHome;

          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;

          return new Response(
            "<h1>Você está offline</h1><p>Conecte-se à internet e tente novamente.</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
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
