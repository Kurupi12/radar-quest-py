const CACHE_NAME = "radar-quest-pwa-v3";
const STATIC_ASSETS = ["/", "/icon-192.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (
    req.method !== "GET" ||
    req.url.includes("/api/") ||
    req.url.includes("/audio/") ||
    req.headers.has("range")
  ) {
    return;
  }
  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((res) => res || caches.match("/"))
    )
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "🚨 ¡NUEVO DROP ACTIVADO! Hay un tesoro cerca de ti",
    body: "Abrí el radar térmico ahora para rastrear la señal antes que otros cazadores.",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: "radar-quest-drop",
    url: "/",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icon-192.svg",
      badge: payload.badge || "/icon-192.svg",
      tag: payload.tag || "radar-quest-drop",
      vibrate: [140, 70, 220, 70, 300],
      renotify: true,
      data: {
        url: payload.url || "/",
        missionId: payload.missionId || null,
        brandSlug: payload.brandSlug || null,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

