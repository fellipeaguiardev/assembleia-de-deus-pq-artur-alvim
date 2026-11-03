/* ============================================================
   Service worker — deixa o site abrir sem internet (PWA)
   ------------------------------------------------------------
   - Páginas, CSS e JS: tenta a rede primeiro (sempre a versão
     mais nova). Sem internet, ou se a rede passar de 3 s (sinal
     fraco), usa a cópia guardada e deixa a resposta da rede
     atualizar o cache por trás; nos 15 s seguintes os outros
     arquivos já vêm da cópia, sem esperar de novo.
   - Todas as páginas usam UMA cópia só do index.html (o conteúdo
     de cada endereço é montado pelo JS).
   - Imagens, fontes e texto da Bíblia (/data/): usa a cópia
     guardada e atualiza por trás. Cada capítulo lido fica
     disponível offline.
   - Supabase, formulário e outros sites: nunca passa por aqui.
   CACHE_VERSION é carimbado pelo scripts/publicar.sh a cada versão.
   ============================================================ */
const CACHE_VERSION = "adbelem-v13-2026-10-11";
const SHELL = [
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
  "/vendor/supabase.js",
  "/vendor/qrcode.js",
  "/js/intro.js",
  "/js/config.js",
  "/js/compartilhado.js",
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
  // Configuração local (só no computador) nunca fica guardada.
  if (url.pathname.startsWith("/js/config.local")) return;

  if (sameOrigin && (req.destination === "image" || req.destination === "font" || url.pathname.startsWith("/data/"))) {
    event.respondWith(cacheFirst(req));
  } else if (sameOrigin) {
    event.respondWith(networkFirst(req, event));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // Demais origens (Supabase, YouTube, Spotify, Maps…): o navegador cuida normalmente.
});

const NETWORK_TIMEOUT_MS = 3000;
const SHELL_KEY = "/index.html"; // a cópia única que todas as navegações gravam e leem
// Depois que um pedido passa dos 3 s, os próximos (CSS, JS da mesma página…) não
// esperam de novo: por 15 s usam a cópia na hora, e a rede atualiza por trás.
const SLOW_WINDOW_MS = 15000;
let slowUntil = 0;

async function networkFirst(req, event) {
  const cache = await caches.open(CACHE_VERSION);
  const key = req.mode === "navigate" ? SHELL_KEY : req;
  const network = fetch(req).then((res) => {
    // Página de erro (404, 500) não substitui a cópia boa.
    if (res.ok && res.type === "basic") cache.put(key, res.clone());
    return res;
  });
  // Mesmo depois de responder com a cópia, a rede termina e atualiza o cache.
  event.waitUntil(network.catch(() => {}));
  const wait = Date.now() < slowUntil ? 0 : NETWORK_TIMEOUT_MS;
  const late = new Promise((resolve) => setTimeout(resolve, wait, "demorou"));
  try {
    const first = await Promise.race([network, late]);
    if (first !== "demorou") return first;
    // Sinal fraco: usa a cópia guardada; sem cópia, continua esperando a rede.
    if (wait) slowUntil = Date.now() + SLOW_WINDOW_MS;
    return (await cache.match(key, { ignoreSearch: true })) || (await network);
  } catch {
    return (await cache.match(key, { ignoreSearch: true })) || Response.error();
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
