const BASE = "/MoneyStream";
const CACHE = "moneystream-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch(`${BASE}/`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not cache the application shell.");
    const html = await response.clone().text();
    const paths = [...new Set(html.match(/\/MoneyStream\/_next\/static\/[^"'\s<>?]+\.(?:js|css)/g) || [])];
    if (!paths.length) throw new Error("Application shell assets were not found.");
    const cache = await caches.open(CACHE);
    await cache.addAll(paths);
    await cache.put(`${BASE}/`, response);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const navigation = event.request.mode === "navigate" && url.pathname === "/";
  const asset = url.pathname.startsWith("/_next/static/");
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(navigation ? `${BASE}/` : event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(navigation ? `${BASE}/` : event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
