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
        // Additional static resources would go here
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
