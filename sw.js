/* ============================================================
   Service worker — deixa o site abrir sem internet (PWA)
   ------------------------------------------------------------
   - Páginas, CSS e JS: tenta a rede primeiro (sempre a versão
     mais nova) e usa a cópia guardada só quando estiver offline.
   - Imagens, fontes e texto da Bíblia (/data/): usa a cópia
     guardada e atualiza por trás. Cada capítulo lido fica
     disponível offline.
   - Supabase, formulário e outros sites: nunca passa por aqui.
   Ao mudar a lista abaixo, aumente CACHE_VERSION.
   ============================================================ */
const CACHE_VERSION = "adbelem-v13-2026-10-11";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/css/fonts.css",
  "/assets/fonts/inter-latin.woff2",
  "/assets/fonts/fraunces-latin.woff2",
  "/css/base.css",
  "/css/intro.css",
  "/css/site.css",
  "/css/podcast.css",
  "/css/extras.css",
  "/css/bible.css",
  "/css/ebd.css",
  "/css/harpa.css",
  "/css/biblioteca.css",
  "/css/admin.css",
  "/vendor/supabase.js",
  "/vendor/qrcode.js",
  "/js/intro.js",
  "/js/config.js",
  "/js/core.js",
  "/js/site.js",
  "/js/podcast.js",
  "/js/privacy.js",
  "/js/extras.js",
  "/js/bible.js",
  "/js/listen.js",
  "/js/ebd.js",
  "/js/harpa.js",
  "/js/biblioteca.js",
  "/js/admin.js",
  "/js/admin-ebd.js",
  "/js/admin-biblioteca.js",
  "/js/main.js",
  "/data/bible/blivre/index.json",
  "/data/harpa/indice.json",
  "/assets/img/brasao.svg",
  "/assets/img/logo-adbelem.png",
  "/assets/img/favicon-64.png",
  "/assets/img/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Funções do servidor e pedidos com login nunca passam pelo cache.
  if (url.pathname.startsWith("/api/") || url.pathname === "/version.json" || req.headers.has("authorization")) return;

  if (sameOrigin && (req.destination === "image" || req.destination === "font" || url.pathname.startsWith("/data/"))) {
    event.respondWith(cacheFirst(req));
  } else if (sameOrigin) {
    event.respondWith(networkFirst(req));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // Demais origens (Supabase, YouTube, Spotify, Maps…): o navegador cuida normalmente.
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (cached) return cached;
    if (req.mode === "navigate") return (await cache.match("/index.html")) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await update) || Response.error();
}
