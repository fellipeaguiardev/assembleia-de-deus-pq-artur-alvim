/* ============================================================
   SITE PÚBLICO — rotas, layout, seções e páginas
   ============================================================ */

const SITE_URL = window.APP_CONFIG.SITE_URL; // definido em js/config.js
const SITE_NAME = "AD Belém - Parque Artur Alvim";

// Menu principal (computador) + menu "Mais".
const NAV_PRIMARY = [
  ["home", "Início"],
  ["cultos", "Cultos"],
  ["biblia", "Bíblia"],
  ["ebd", "EBD"],
  ["videos", "Vídeos"],
  ["eventos", "Eventos"],
  ["sobre", "Sobre"],
];
const NAV_MORE = [
  ["palavra", "Palavra Diária"],
  ["harpa", "Harpa Cristã"],
  ["biblioteca", "Biblioteca dos Jovens"],
  ["primeira-visita", "Primeira visita"],
  ["noticias", "Notícias"],
  ["departamentos", "Departamentos"],
  ["podcast", "Podcast"],
  ["doacoes", "Doações"],
  ["oracao", "Pedido de oração"],
];
// Menu do celular, em grupos.
const NAV_GROUPS = [
  ["A igreja", [["home", "Início"], ["sobre", "Sobre nós"], ["primeira-visita", "Primeira visita"], ["departamentos", "Departamentos"], ["doacoes", "Doações"]]],
  ["Palavra", [["palavra", "Palavra Diária"], ["biblia", "Bíblia"], ["harpa", "Harpa Cristã"], ["ebd", "Escola Bíblica (EBD)"], ["biblioteca", "Biblioteca dos Jovens"], ["videos", "Vídeos"], ["podcast", "Podcast"]]],
  ["Agenda", [["cultos", "Cultos"], ["eventos", "Eventos"], ["noticias", "Notícias"]]],
];
const NAV_LINKS = [...NAV_PRIMARY, ...NAV_MORE];

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

// Atributos para tornar um elemento não-botão clicável por mouse e teclado.
function pressable(fn, id, label) {
  return `role="button" tabindex="0" data-id="${esc(id)}" aria-label="${esc(label)}" onclick="${fn}(this.dataset.id)" onkeydown="pressKey(event, ${fn})"`;
}

function pressKey(e, fn) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn(e.currentTarget.dataset.id);
  }
}

/* ============================================================
   ROTEADOR — endereços normais (/cultos, /biblia/joao/3 …)
   Links antigos com "#" (ex.: /#eventos) são convertidos sozinhos.
   ============================================================ */
const routePath = (route) => (!route || route === "home" ? "/" : "/" + route);

function currentRoute() {
  let path = (location.pathname || "/").replace(/^\/+|\/+$/g, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    path = ""; // endereço malformado: cai na página inicial em vez de quebrar o site
  }
  return path || "home";
}

const routeBase = (route) => route.split("/")[0];

// Páginas que mudaram de nome: o endereço antigo continua abrindo a nova
// (a Vercel também redireciona; isto cobre o app aberto sem internet).
const ROUTE_RENAMES = { ministerios: "departamentos" };
function migrateRenamedRoute() {
  const [base, ...rest] = currentRoute().split("/");
  if (!ROUTE_RENAMES[base]) return false;
  history.replaceState(null, "", routePath([ROUTE_RENAMES[base], ...rest].join("/")) + location.search);
  return true;
}
const routeParam = (route) => route.split("/").slice(1).join("/");

// Converte links antigos (/#eventos, /#noticias/slug, /#admin) para o formato novo.
function migrateLegacyHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw || raw === "main") return false;
  let route;
  try {
    route = decodeURIComponent(raw);
  } catch {
    return false;
  }
  if (!/^[a-z][a-z0-9-]*(\/\S*)?$/i.test(route)) return false;
  history.replaceState(null, "", routePath(route));
  return true;
}

function navigateTo(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", path);
  else if (path !== location.pathname + location.search) history.pushState(null, "", path);
  onRouteChange();
}

// Links internos trocam de página sem recarregar o site.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-more")) toggleNavMore(false);
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]");
  if (!a || a.target || a.hasAttribute("download")) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return; // arquivos (.ics, .pdf, imagens…)
  if (url.hash && url.pathname === location.pathname) return; // âncora na mesma página
  e.preventDefault();
  navigateTo(url.pathname + url.search);
});
window.addEventListener("popstate", onRouteChange);
window.addEventListener("hashchange", () => migrateLegacyHash() && onRouteChange());

function onRouteChange() {
  if (appUpdateOnNavigate()) return; // versão nova: carrega a página já atualizada
  listenRouteChanged();
  migrateRenamedRoute(); // ex.: um link antigo para /ministerios gravado em algum aviso
  const route = currentRoute();
  if (route === "admin") {
    openAdmin();
    return;
  }
  if (isAdminOpen()) closeAdminPanel({ keepHash: true });
  closeModal({ instant: true });
  toggleMobileMenu(false);
  renderSite();
  afterRoute(route);
}

/* ---------- Toda página nova começa no topo ----------
   No iPhone, se a pessoa toca num link com a página ainda deslizando (inércia),
   o deslize continua depois do pulo para o topo. Por isso repete no próximo
   quadro e, nas páginas que carregam o conteúdo depois (Bíblia, EBD, Palavra),
   de novo quando o conteúdo chega — a não ser que a pessoa já tenha rolado. */
let navStartedAt = 0;
let userScrolledSinceNav = false;
["wheel", "touchmove", "keydown"].forEach((ev) =>
  window.addEventListener(ev, () => (userScrolledSinceNav = true), { passive: true }),
);

function scrollToTop() {
  navStartedAt = performance.now();
  userScrolledSinceNav = false;
  const root = document.documentElement;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    root.style.scrollBehavior = "";
  });
}

// Chamado quando o conteúdo de uma página carrega depois (Bíblia, EBD, Palavra).
function settleTop() {
  if (!userScrolledSinceNav && performance.now() - navStartedAt < 4000 && window.scrollY > 0) window.scrollTo(0, 0);
}

function afterRoute(route) {
  const base = routeBase(route);
  const param = routeParam(route);
  if (base === "doacoes" && param) {
    const el = document.getElementById("doacao-" + param);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
  }
  // Na Bíblia, a rolagem até o versículo é feita depois que o capítulo carrega.
  scrollToTop();
  if (base === "podcast" && param) openPodcastModal(param);
}

/* ============================================================
   TÍTULO, DESCRIÇÃO E ENDEREÇO OFICIAL DE CADA PÁGINA
   ============================================================ */
const ROUTE_META = {
  home: ["", "Assembleia de Deus Belém - Parque Artur Alvim, São Paulo: horários dos cultos, Bíblia online, eventos, vídeos, departamentos e localização."],
  cultos: ["Horários dos cultos", "Dias e horários dos cultos e da Escola Bíblica Dominical da AD Belém - Parque Artur Alvim."],
  biblia: ["Bíblia", "Leia a Bíblia Sagrada completa no site, gratuitamente, na tradução Bíblia Livre, e abra a mesma passagem na ARC, ARA, NVI, NTLH ou BKJ."],
  biblioteca: ["Biblioteca dos Jovens", "Livros de teologia, história, filosofia e literatura para emprestar: veja o acervo, a situação de cada livro e peça o seu. Aberta a todos."],
  harpa: ["Harpa Cristã", "Os 640 hinos da Harpa Cristã, o hinário das Assembleias de Deus: procure pelo número ou pelo nome e ouça."],
  ebd: ["Escola Bíblica Dominical", "Lição da semana da EBD, referências bíblicas e perguntas para aprofundar o estudo."],
  palavra: ["Palavra Diária", "Um versículo da Bíblia para meditar a cada dia."],
  videos: ["Vídeos e transmissões", "Cultos, estudos e mensagens transmitidos pela AD Belém - Parque Artur Alvim."],
  eventos: ["Eventos", "Congressos, encontros e programações especiais da AD Belém - Parque Artur Alvim."],
  noticias: ["Notícias", "Novidades, acontecimentos e informações da AD Belém - Parque Artur Alvim."],
  sobre: ["Quem somos", "História, missão, valores e liderança da Assembleia de Deus Belém - Parque Artur Alvim."],
  "primeira-visita": ["Sua primeira visita", "Horários, endereço e como chegar para visitar a AD Belém - Parque Artur Alvim pela primeira vez."],
  departamentos: ["Departamentos", "Conheça os departamentos da AD Belém - Parque Artur Alvim."],
  podcast: ["Podcast", "Mensagens e conversas para fortalecer a sua fé, do podcast da AD Belém - Parque Artur Alvim."],
  doacoes: ["Ofertas e doações", "Contribua com ofertas, dízimos e projetos da AD Belém - Parque Artur Alvim via PIX."],
  oracao: ["Pedido de oração", "Envie seu pedido de oração ou fale com a equipe pastoral da AD Belém - Parque Artur Alvim."],
  privacidade: ["Política de privacidade", "Como a AD Belém - Parque Artur Alvim trata seus dados, de acordo com a LGPD."],
};

// noindex: páginas de "não encontrado" não devem aparecer no Google.
function setMeta(title, description, path = location.pathname, { noindex = false } = {}) {
  document.title = title ? `${title} | ${SITE_NAME}` : "Assembleia de Deus Belém - Parque Artur Alvim | São Paulo";
  const url = SITE_URL + (path === "/" ? "/" : path.replace(/\/+$/, ""));
  const tag = (selector, create, attr, value) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(create.tag);
      Object.entries(create.attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };
  tag('meta[name="description"]', { tag: "meta", attrs: { name: "description" } }, "content", description);
  tag('link[rel="canonical"]', { tag: "link", attrs: { rel: "canonical" } }, "href", url);
  tag('meta[property="og:title"]', { tag: "meta", attrs: { property: "og:title" } }, "content", document.title);
  tag('meta[property="og:description"]', { tag: "meta", attrs: { property: "og:description" } }, "content", description);
  tag('meta[property="og:url"]', { tag: "meta", attrs: { property: "og:url" } }, "content", url);
  tag('meta[name="robots"]', { tag: "meta", attrs: { name: "robots" } }, "content", noindex ? "noindex" : "index, follow");
}

function updateMeta(route) {
  const base = routeBase(route);
  const param = routeParam(route);
  if (base === "noticias" && param) {
    const n = publishedNews().find((x) => x.slug === param);
    if (n) {
      setMeta(n.title, truncate(n.summary || n.content, 160) || ROUTE_META.noticias[1]);
      if (n.sourceUrl && safeUrl(n.sourceUrl)) document.head.querySelector('link[rel="canonical"]')?.setAttribute("href", safeUrl(n.sourceUrl));
      return;
    }
  }
  const meta = ROUTE_META[base];
  if (meta) return setMeta(meta[0], meta[1]);
  setMeta("Página não encontrada", ROUTE_META.home[1], location.pathname, { noindex: true });
}

/* ============================================================
   RENDER
   ============================================================ */
function renderSite() {
  if (!storageReady) return;
  const route = currentRoute();
  const root = document.getElementById("siteRoot");
  root.innerHTML = headerHTML(route) + `<main id="main" class="page-enter" tabindex="-1">${pageHTML(route)}</main>` + footerHTML();
  root.removeAttribute("aria-busy");
  updateHeaderScrolled();
  updateMeta(route);
  initReveal();
  initCarousels();
  updatePlayerUI();
  // Páginas que buscam o conteúdo depois de montadas.
  const base = routeBase(route);
  if (base === "biblia") initBibleView(routeParam(route));
  if (base === "ebd") initEbdView(routeParam(route));
  if (base === "palavra") initPalavraView(routeParam(route));
  if (base === "harpa") initHarpaView(routeParam(route));
  if (base === "biblioteca") initBibliotecaView(routeParam(route));
  if (base === "sobre") initCreedLinks();
  if (base === "home" || base === "admin") {
    initPalavraHome();
    initEbdHome();
  }
}

function pageHTML(route) {
  const base = routeBase(route);
  const param = routeParam(route);
  switch (base) {
    case "eventos":
      return eventsPageHTML();
    case "videos":
      return videosPageHTML();
    case "noticias":
      return param ? newsDetailPageHTML(param) : newsPageHTML();
    case "sobre":
      return aboutPageHTML();
    case "cultos":
      return schedulePageHTML();
    case "podcast":
      return podcastPageHTML();
    case "departamentos":
      return ministriesPageHTML();
    case "doacoes":
      return donationsPageHTML();
    case "oracao":
      return prayerPageHTML();
    case "privacidade":
      return privacyPageHTML();
    case "biblia":
      return biblePageHTML(param);
    case "ebd":
      return ebdPageHTML();
    case "palavra":
      return palavraPageHTML();
    case "harpa":
      return harpaPageHTML();
    case "biblioteca":
      return bibliotecaPageHTML();
    case "primeira-visita":
      return firstVisitPageHTML();
    case "home":
    case "admin":
      return homePageHTML();
    default:
      return notFoundPageHTML();
  }
}

function notFoundPageHTML() {
  return `<section class="block"><div class="container"><h1 class="sr-only">Erro 404</h1>${emptyState(
    "search",
    "Página não encontrada",
    "O endereço pode ter mudado ou sido digitado errado.",
    `<a class="btn btn-primary btn-sm" href="/">Ir para o início</a>`,
  )}</div></section>`;
}

// Brasão da igreja (logo enviada no painel tem prioridade sobre a padrão).
function churchLogoSrc() {
  return safeUrl(data.church.logoUrl) || window.APP_CONFIG.DEFAULT_LOGO;
}

// "AD Belém - Pq. Artur Alvim": no celular vira duas linhas (o nome inteiro não cabe em uma).
function brandHTML() {
  const [main, ...rest] = String(data.church.name || "").split(" - ");
  const sub = rest.join(" - ");
  return `<img class="brand-logo" src="${esc(churchLogoSrc())}" alt="" width="30" height="37" decoding="async"><span class="brand-name">${esc(main)}${sub ? `<span class="brand-sub">${esc(sub)}</span>` : ""}</span>`;
}

/* ---------------- HEADER / FOOTER ---------------- */
function navLink(route, label, cls, base) {
  const on = base === route;
  return `<a href="${routePath(route)}" class="${cls}${on ? " active" : ""}"${on ? ' aria-current="page"' : ""}>${label}</a>`;
}

function headerHTML(route) {
  const c = data.church;
  const base = routeBase(route);
  const moreActive = NAV_MORE.some(([r]) => r === base);
  return `
  <a class="skip-link" href="#main" onclick="event.preventDefault(); const m = document.getElementById('main'); m.focus(); m.scrollIntoView();">Pular para o conteúdo</a>
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="brand" aria-label="${esc(c.name)} — início">${brandHTML()}</a>
      <nav class="main-nav" aria-label="Principal">
        ${NAV_PRIMARY.map(([r, l]) => navLink(r, l, "nav-link", base)).join("")}
        <div class="nav-more">
          <button type="button" class="nav-link nav-more-btn${moreActive ? " active" : ""}" aria-expanded="false" aria-controls="navMoreMenu" onclick="toggleNavMore()">Mais ${icon("down", 14)}</button>
          <div class="nav-more-menu" id="navMoreMenu">
            ${NAV_MORE.map(([r, l]) => navLink(r, l, "nav-more-link", base)).join("")}
          </div>
        </div>
      </nav>
      <div class="header-cta">
        <a class="btn btn-ghost btn-sm hide-md" href="${href(c.mapsUrl)}" target="_blank" rel="noopener">Como chegar</a>
        <button class="btn btn-accent btn-sm" type="button" onclick="openLive()">${icon("live", 16)}<span>Ao vivo</span></button>
        <button class="hamburger" type="button" onclick="toggleMobileMenu(true)" aria-label="Abrir menu" aria-controls="mobileMenu" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>
  <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
    <div class="mobile-menu-top">
      <span class="brand">${brandHTML()}</span>
      <button class="icon-btn icon-btn-lg" type="button" onclick="toggleMobileMenu(false)" aria-label="Fechar menu">${icon("x", 20)}</button>
    </div>
    <nav aria-label="Menu" class="mobile-groups">
      ${NAV_GROUPS.map(
        ([title, items]) =>
          `<div class="mobile-group"><span class="mobile-group-title">${title}</span>${items.map(([r, l]) => navLink(r, l, "mobile-link", base)).join("")}</div>`,
      ).join("")}
    </nav>
    <div class="mobile-menu-foot">
      <a class="btn btn-ghost" href="/oracao">${icon("heart", 16)} Pedido de oração</a>
      <button class="btn btn-ghost install-btn" type="button" onclick="installApp()">${icon("arrow", 16)} Instalar o app</button>
      <a class="btn btn-primary" href="${href(c.mapsUrl)}" target="_blank" rel="noopener">${icon("pin", 16)} Como chegar</a>
    </div>
  </div>`;
}

// Menu "Mais" do cabeçalho (computador).
function toggleNavMore(force) {
  const btn = document.querySelector(".nav-more-btn");
  const menu = document.getElementById("navMoreMenu");
  if (!btn || !menu) return;
  const open = typeof force === "boolean" ? force : btn.getAttribute("aria-expanded") !== "true";
  btn.setAttribute("aria-expanded", String(open));
  menu.classList.toggle("open", open);
  if (open) menu.querySelector("a")?.focus({ preventScroll: true });
}

function toggleMobileMenu(open) {
  const menu = document.getElementById("mobileMenu");
  if (!menu) return;
  menu.classList.toggle("open", open);
  menu.setAttribute("aria-hidden", String(!open));
  document.querySelector(".hamburger")?.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("mobile-menu-open", open);
  if (open) menu.querySelector(".mobile-link.active, .mobile-link")?.focus({ preventScroll: true });
}

function footerHTML() {
  const c = data.church;
  const s = data.socials;
  const socials = [
    ["instagram", "Instagram", c.instagramUrl],
    ["youtube", "YouTube", c.youtubeUrl],
    ["facebook", "Facebook", c.facebookUrl],
    ["whatsapp", "WhatsApp", c.whatsapp],
  ].filter(([k, , url]) => s[k]?.enabled && url);
  const services = data.services || [];
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="/" class="brand brand-light">${brandHTML()}</a>
        <p>${esc(c.address)}</p>
        <div class="footer-social">
          ${socials.map(([k, label, url]) => `<a href="${href(url)}" target="_blank" rel="noopener" aria-label="${label}">${icon(k, 18)}</a>`).join("")}
        </div>
      </div>
      <div>
        <h4>Navegue</h4>
        <ul>${NAV_LINKS.slice(1).map(([r, l]) => `<li><a href="${routePath(r)}">${l}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h4>Cultos</h4>
        <ul class="footer-schedule">
          ${services
            .map((d) => `<li><strong>${esc(d.day)}</strong>${serviceLines(d).map((l) => `<span>${esc(l.time)} · ${esc(l.name)}${l.monthly ? ` <small>(${esc(l.note)})</small>` : ""}</span>`).join("")}</li>`)
            .join("")}
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(c.name)}</span>
      <nav class="footer-legal" aria-label="Privacidade">
        <a href="/privacidade">Política de privacidade</a>
        <button type="button" onclick="openCookiePreferences()">Preferências de cookies</button>
        <button type="button" class="install-btn" onclick="installApp()">Instalar o app</button>
      </nav>
    </div>
  </footer>`;
}

/* Cabeçalho padrão das páginas internas */
function pageHeroHTML(eyebrow, title, lead = "") {
  return `
  <section class="page-hero">
    <div class="page-hero-bg" aria-hidden="true"></div>
    <div class="container page-hero-inner">
      <span class="eyebrow">${esc(eyebrow)}</span>
      <h1>${esc(title)}</h1>
      ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
    </div>
  </section>`;
}

function sectionHead(eyebrow, title, actions = "") {
  return `
      <div class="block-head" data-reveal>
        <div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>
        ${actions ? `<div class="block-actions">${actions}</div>` : ""}
      </div>`;
}

function emptyState(iconName, title, text = "", action = "") {
  return `<div class="empty-state" data-reveal>
    <span class="empty-icon">${icon(iconName, 22)}</span>
    <strong>${esc(title)}</strong>
    ${text ? `<p>${esc(text)}</p>` : ""}
    ${action}
  </div>`;
}

/* ============================================================
   HOME
   ============================================================ */
const HOME_RENDERERS = {
  nextService: () => nextHighlightHTML(),
  announcements: () => announcementsHTML(),
  latestVideo: () => latestVideoHTML(),
  news: () => newsHomeHTML(),
  events: () => eventsHomeHTML(),
  about: () => aboutHomeHTML(),
  ministries: () => ministriesHomeHTML(),
  location: () => locationHTML(),
  social: () => socialHTML(),
  podcast: () => podcastHomeHTML(),
  donations: () => donationsHomeHTML(),
  prayer: () => prayerSectionHTML(),
  bible: () => bibleHomeHTML(),
  shortcuts: () => shortcutsHomeHTML(),
  palavra: () => palavraHomeHTML(),
  ebd: () => ebdHomeHTML(),
  firstVisit: () => firstVisitHomeHTML(),
};

function homePageHTML() {
  const sections = data.homeSections
    .filter((s) => s.enabled && HOME_RENDERERS[s.id])
    .map((s) => HOME_RENDERERS[s.id]())
    .join("");
  // Sem o card de próximo culto, o hero não precisa da sobra para a sobreposição.
  const overlap = data.homeSections.some((s) => s.id === "nextService" && s.enabled);
  return heroHTML(overlap) + sections;
}

// Foto real do templo/culto (enviada no painel) fica atrás do texto, com
// um véu azul para garantir a leitura. Sem foto, fica só o fundo azul.
function heroHTML(overlap) {
  const h = data.hero;
  const photo = safeUrl(h.image);
  return `
  <section class="hero ${overlap ? "has-overlap" : ""} ${photo ? "has-photo" : ""}">
    <div class="hero-bg" aria-hidden="true">${photo ? `<img class="hero-photo" src="${esc(photo)}" alt="" fetchpriority="high" decoding="async">` : ""}</div>
    <div class="hero-inner">
      <span class="eyebrow hero-in" style="--d:0">${esc(h.eyebrow)}</span>
      <h1 class="hero-in" style="--d:1">${esc(h.title)}</h1>
      <p class="lead hero-in" style="--d:2">${esc(h.subtitle)}</p>
      <div class="hero-actions hero-in" style="--d:3">
        <a class="btn btn-accent btn-lg" href="/cultos">${icon("clock", 18)} Horários dos cultos</a>
        <a class="btn btn-outline-light btn-lg" href="/sobre">Conheça a igreja</a>
      </div>
      <div class="hero-links hero-in" style="--d:4">
        <a class="hero-link" href="/biblia">${icon("book", 16)} Ler a Bíblia ${icon("arrow", 14)}</a>
        <a class="hero-link" href="/harpa">${icon("music", 16)} Harpa Cristã ${icon("arrow", 14)}</a>
      </div>
    </div>
  </section>`;
}

function nextHighlightHTML() {
  const n = nextHighlight();
  if (!n) {
    return `
  <div class="next-wrap container">
    <article class="next-card next-empty" data-reveal>
      <div class="next-body">
        <span class="eyebrow">Próximo culto</span>
        <h3>Nenhum culto ou evento agendado</h3>
        <p>Em breve novas datas serão anunciadas.</p>
      </div>
    </article>
  </div>`;
  }
  const now = new Date();
  const live = n.date <= now && now - n.date < 90 * 60000;
  const isEvent = n.kind === "event";
  const maps = isEvent ? n.ev.mapsUrl || data.church.mapsUrl : data.church.mapsUrl;
  const when = live ? "Acontecendo agora" : `${capitalize(relativeDayLabel(n.date))} · ${n.time || ""}`;
  return `
  <div class="next-wrap container">
    <article class="next-card" data-reveal>
      <div class="next-date" aria-hidden="true">
        <span class="weekday">${esc(n.date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""))}</span>
        <span class="day">${n.date.getDate()}</span>
        <span class="month">${esc(n.date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))}</span>
      </div>
      <div class="next-body">
        <span class="eyebrow">${isEvent ? "Próximo evento" : "Próximo culto"}</span>
        <h3>${esc(n.title)}</h3>
        <div class="next-meta">
          <span class="${live ? "is-live" : ""}">${live ? '<i class="live-dot"></i>' : icon("clock", 16)} ${esc(when)}</span>
          ${n.location ? `<span>${icon("pin", 16)} ${esc(n.location)}</span>` : ""}
          ${n.with ? `<span>${icon("school", 16)} Com ${esc(movedLabel(n.with))}</span>` : ""}
        </div>
        <div class="next-actions">
          <a class="btn btn-primary btn-sm" href="${href(maps)}" target="_blank" rel="noopener">${icon("pin", 15)} Como chegar</a>
          ${
            isEvent
              ? `<button class="btn btn-ghost btn-sm" type="button" data-id="${esc(n.ev.id)}" onclick="openEventModal(this.dataset.id)">Ver detalhes</button>`
              : `<a class="btn btn-ghost btn-sm" href="/cultos">Ver programação</a>`
          }
          <button class="btn btn-ghost btn-sm" type="button" onclick="addHighlightToCalendar()">${icon("calendar", 15)} ${isEvent ? "Adicionar à agenda" : n.monthly ? "Lembrar todo mês" : "Lembrar toda semana"}</button>
        </div>
      </div>
    </article>
  </div>`;
}

function announcementsHTML() {
  const list = activeAnnouncements();
  if (!list.length) return "";
  return `
  <section class="block tight announce-block">
    <div class="container narrow" data-stagger>
      ${list
        .map((a) => {
          const color = /^#[0-9a-f]{3,8}$/i.test(a.color) ? a.color : "#E3A857";
          return `
        <div class="announce" style="--announce:${color}">
          <span class="announce-icon">${icon("megaphone", 18)}</span>
          <p>${esc(a.text)}${a.link ? ` <a href="${href(a.link)}" target="_blank" rel="noopener">Saiba mais ${icon("external", 13)}</a>` : ""}</p>
        </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

function latestVideoHTML() {
  const v = data.videos.find((x) => !videoAgendado(x));
  const prox = proximaTransmissao();
  if (!v && !prox) return "";
  return `
  <section class="block">
    <div class="container">
      ${sectionHead("Fique por dentro", "Última transmissão", `<a class="btn btn-ghost btn-sm" href="/videos">Ver todos os vídeos</a>`)}
      ${prox ? proximaTransmissaoHTML(prox) : ""}
      ${v ? `<article class="latest-video" data-reveal>
        <button class="thumb" type="button" style="${bgImage(ytThumb(v.youtubeUrl))}" data-id="${esc(v.id)}" onclick="openVideoModal(this.dataset.id)" aria-label="Assistir ${esc(v.title)}">
          <span class="play-btn">${icon("play", 26)}</span>
        </button>
        <div class="info">
          <span class="eyebrow">${esc(v.category)}${v.date ? " · " + fmtDate(v.date) : ""}</span>
          <h3>${esc(v.title)}</h3>
          ${v.description ? `<p class="video-desc clamp-3">${esc(v.description)}</p>` : ""}
          <button class="btn btn-accent btn-sm" type="button" data-id="${esc(v.id)}" onclick="openVideoModal(this.dataset.id)">${icon("play", 14)} Assistir</button>
        </div>
      </article>` : ""}
    </div>
  </section>`;
}

/* ---------------- Carrossel genérico ---------------- */
function carouselHTML(id, slides) {
  return `
      <div class="carousel" id="${id}" data-reveal>
        <div class="carousel-track" data-stagger>${slides}</div>
      </div>`;
}

function carouselArrows(id, label) {
  return `
        <button class="carousel-arrow" type="button" onclick="moveCarousel('${id}',-1)" aria-label="${label} anterior" data-dir="-1" data-for="${id}">${icon("left", 20)}</button>
        <button class="carousel-arrow" type="button" onclick="moveCarousel('${id}',1)" aria-label="Próximo: ${label}" data-dir="1" data-for="${id}">${icon("right", 20)}</button>`;
}

function moveCarousel(id, dir) {
  const el = document.getElementById(id);
  const slide = el?.querySelector(".carousel-slide");
  if (!slide) return;
  const gap = parseFloat(getComputedStyle(el.firstElementChild).columnGap) || 22;
  el.scrollBy({ left: dir * (slide.getBoundingClientRect().width + gap), behavior: "smooth" });
}

function updateCarouselArrows(el) {
  const max = el.scrollWidth - el.clientWidth - 2;
  document.querySelectorAll(`.carousel-arrow[data-for="${el.id}"]`).forEach((btn) => {
    btn.disabled = btn.dataset.dir === "-1" ? el.scrollLeft <= 2 : el.scrollLeft >= max;
  });
}

function initCarousels() {
  document.querySelectorAll(".carousel").forEach((el) => {
    updateCarouselArrows(el);
    el.addEventListener("scroll", () => updateCarouselArrows(el), { passive: true });
  });
}

/* ---------------- Notícias (home) ---------------- */
// Publicada e com data de hoje ou anterior: datas futuras = publicação agendada.
const isDue = (dateValue) => !dateValue || String(dateValue).slice(0, 10) <= localISO();

function publishedNews() {
  return (data.news || [])
    .filter((n) => n.published !== false && isDue(n.published_at))
    .sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
}

function newsHomeHTML() {
  const items = publishedNews();
  if (!items.length) return "";
  return `
  <section class="block on-surface">
    <div class="container">
      ${sectionHead("Fique por dentro", "Últimas notícias", carouselArrows("newsCarousel", "notícia") + `<a class="btn btn-ghost btn-sm" href="/noticias">Ver todas</a>`)}
      ${carouselHTML("newsCarousel", items.map(newsSlideHTML).join(""))}
    </div>
  </section>`;
}

// Notícia da sede: sem foto (fica no site deles), com o brasão e o selo da fonte.
const newsMediaAttrs = (n) => (n.sourceUrl ? `class="card-media is-sede"` : `class="card-media" style="${bgImage(n.cover_image)}"`);
const newsSourceTag = (n) => (n.sourceUrl ? `<span class="news-source-tag">${esc(n.sourceName || "AD Belém – Sede")}</span>` : "");
const newsKicker = (n) => fmtDateLong(n.published_at || n.created_at) + (n.sourceUrl ? ` · ${esc(n.sourceName || "AD Belém – Sede")}` : "");

function newsSlideHTML(n) {
  return `
  <a class="card carousel-slide" href="/noticias/${esc(encodeURIComponent(n.slug))}">
    <div ${newsMediaAttrs(n)}>
      ${newsSourceTag(n)}
      <span class="card-hint">Ler notícia ${icon("external", 13)}</span>
    </div>
    <div class="card-body">
      <span class="card-kicker">${newsKicker(n)}</span>
      <h4>${esc(n.title)}</h4>
      <p class="clamp-3">${esc(n.summary)}</p>
    </div>
  </a>`;
}

/* ---------------- Eventos ---------------- */
function eventsHomeHTML() {
  const evs = upcomingEvents().slice(0, 3);
  return `
  <section class="block">
    <div class="container">
      ${sectionHead("Agenda", "Próximos eventos", `<a class="btn btn-ghost btn-sm" href="/eventos">Ver agenda</a>`)}
      ${
        evs.length
          ? `<div class="card-grid" data-stagger>${evs.map(eventCardHTML).join("")}</div>`
          : emptyState("calendar", "Nenhum evento agendado no momento", "Acompanhe nossas redes para saber das novidades.")
      }
    </div>
  </section>`;
}

function eventCardHTML(ev) {
  const d = parseISODate(ev.date);
  return `
  <article class="card event-card" ${pressable("openEventModal", ev.id, "Ver detalhes de " + ev.name)}>
    <div class="card-media" style="${bgImage(ev.image)}">
      <span class="badge">${esc(ev.category || "Evento")}</span>
      ${d ? `<span class="date-chip"><b>${d.getDate()}</b>${esc(d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))}</span>` : ""}
    </div>
    <div class="card-body">
      <span class="card-kicker">${esc(capitalize(fmtDateFull(ev.date).split(",")[0]))}${ev.time ? " · " + esc(ev.time) : ""}</span>
      <h4>${esc(ev.name)}</h4>
      ${ev.location ? `<div class="card-meta">${icon("pin", 15)} ${esc(ev.location)}</div>` : ""}
      <span class="card-link">Ver detalhes ${icon("arrow", 15)}</span>
    </div>
  </article>`;
}

/* ---------------- Sobre ---------------- */
function logoMediaHTML() {
  const logo = safeUrl(data.church.logoUrl) || window.APP_CONFIG.DEFAULT_LOGO;
  return `<div class="about-media" data-reveal>
        <img src="${esc(logo)}" alt="Logo ${esc(data.church.name)}" loading="lazy">
      </div>`;
}

function aboutHomeHTML() {
  const a = data.about;
  return `
  <section class="block on-surface">
    <div class="container about-grid">
      ${logoMediaHTML()}
      <div class="about-text" data-reveal>
        <span class="eyebrow">Nossa história</span>
        <h2>Sobre a ${esc(data.church.name)}</h2>
        <p>${esc(a.history)}</p>
        <div class="values-row">${(a.values || []).map((v) => `<span class="value-pill">${esc(v)}</span>`).join("")}</div>
        <a class="btn btn-ghost btn-sm" href="/sobre">Conheça nossa igreja ${icon("arrow", 15)}</a>
      </div>
    </div>
  </section>`;
}

/* ---------------- Departamentos (no banco: tabela "ministries") ---------------- */
function ministriesHomeHTML() {
  const items = data.ministries || [];
  return `
  <section class="block">
    <div class="container">
      ${sectionHead("Comunidade", "Nossos departamentos", items.length ? carouselArrows("ministryCarousel", "departamento") + `<a class="btn btn-ghost btn-sm" href="/departamentos">Ver todos</a>` : "")}
      ${items.length ? carouselHTML("ministryCarousel", items.map((m) => ministryCardHTML(m, true)).join("")) : emptyState("user", "Nenhum departamento cadastrado")}
    </div>
  </section>`;
}

function ministryCardHTML(m, slide = false) {
  return `
  <article class="card ministry-card ${slide ? "carousel-slide" : ""}" ${pressable("openMinistryModal", m.id, "Ver " + m.name)}>
    <div class="card-media" style="${bgImage(m.image)}">
      <span class="card-hint">Ver departamento ${icon("external", 13)}</span>
    </div>
    <div class="card-body">
      <span class="card-kicker">Departamento</span>
      <h4>${esc(m.name)}</h4>
      ${m.responsible ? `<div class="who">${esc(m.responsible)}</div>` : ""}
      <p class="clamp-3">${esc(m.description)}</p>
    </div>
  </article>`;
}

function ministriesPageHTML() {
  const items = data.ministries || [];
  return (
    pageHeroHTML("Comunidade", "Departamentos", "Há um lugar para você servir e crescer junto com a nossa família.") +
    `
  <section class="block">
    <div class="container">
      ${items.length ? `<div class="card-grid" data-stagger>${items.map((m) => ministryCardHTML(m)).join("")}</div>` : emptyState("user", "Nenhum departamento cadastrado")}
    </div>
  </section>`
  );
}

/* ---------------- Localização ---------------- */
function locationHTML() {
  const c = data.church;
  const phoneDigits = String(c.phone || "").replace(/\D/g, "");
  return `
  <section class="block on-surface">
    <div class="container">
      <div class="location-grid" data-reveal>
        <div class="location-info">
          <span class="eyebrow">Visite-nos</span>
          <h3>Onde estamos</h3>
          <a class="loc-row" href="${href(c.mapsUrl)}" target="_blank" rel="noopener">${icon("pin", 18)}<span>${esc(c.address)}</span></a>
          ${c.phone ? `<a class="loc-row" href="tel:${esc(phoneDigits)}">${icon("phone", 18)}<span>${esc(c.phone)}</span></a>` : ""}
          ${c.whatsapp ? `<a class="loc-row" href="${href(c.whatsapp)}" target="_blank" rel="noopener">${icon("message", 18)}<span>Fale conosco no WhatsApp</span></a>` : ""}
          <a class="btn btn-accent btn-sm" href="${href(c.mapsUrl)}" target="_blank" rel="noopener">Como chegar ${icon("arrow", 15)}</a>
        </div>
        <div class="location-map">
          ${embedGate("maps", `https://maps.google.com/maps?q=${encodeURIComponent(c.address || "")}&z=16&output=embed`, "Mapa: " + c.address, { openUrl: c.mapsUrl })}
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------------- Redes sociais ---------------- */
function socialHTML() {
  const c = data.church;
  const s = data.socials;
  const items = [
    ["instagram", "Instagram", c.instagramUrl],
    ["youtube", "YouTube", c.youtubeUrl],
    ["facebook", "Facebook", c.facebookUrl],
    ["whatsapp", "WhatsApp", c.whatsapp],
  ].filter(([k, , url]) => s[k]?.enabled && url);
  if (!items.length) return "";
  return `
  <section class="block tight">
    <div class="container center" data-reveal>
      <span class="eyebrow">Siga-nos</span>
      <h2 class="social-title">Nossas redes sociais</h2>
      <div class="social-row" data-stagger>
        ${items
          .map(
            ([k, label, url]) => `
        <a class="social-pill" href="${href(url)}" target="_blank" rel="noopener">
          <span class="social-ic">${icon(k, 18)}</span><span>${label}</span>
        </a>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

/* ============================================================
   PÁGINAS INTERNAS
   ============================================================ */
function schedulePageHTML() {
  const next = nextScheduledService();
  return (
    pageHeroHTML("Programação", "Horários dos cultos", "Venha nos visitar. As portas estão abertas para você e sua família.") +
    `
  <section class="block">
    <div class="container">
      <div class="schedule-grid" data-stagger>
        ${data.services
          .map(
            (d, di) => `
          <div class="schedule-day">
            <h4>${esc(d.day)}</h4>
            ${serviceLines(d)
              .map((l) => {
                const ii = d.items.indexOf(l.item);
                const isNext = next && next.day === d.day && next.time === l.time && next.name === l.name;
                const canCal = weekdayIndex(d.day) >= 0 && /^\d{1,2}:\d{2}$/.test(l.time || "");
                const when = l.monthly ? l.note : l.note ? `semanal, ${l.note}` : "toda semana";
                return `<div class="schedule-item ${isNext ? "is-next" : ""} ${l.monthly ? "is-monthly" : ""}">
                  <span>${esc(l.name)}${isNext ? ' <em class="next-tag">Próximo</em>' : ""}${[l.note, l.extra].filter(Boolean).map((t) => `<small class="schedule-note">${esc(capitalize(t))}</small>`).join("")}</span>
                  <span class="time">${esc(l.time)}${canCal ? `<button class="cal-btn" type="button" onclick="addServiceToCalendar(${di},${ii},${l.monthly ? "true" : "false"})" aria-label="Lembrar (${esc(when)}): ${esc(l.name)}" title="Adicionar à agenda (${esc(when)})">${icon("calendar", 15)}</button>` : ""}</span>
                </div>`;
              })
              .join("")}
          </div>`,
          )
          .join("")}
      </div>
    </div>
  </section>` +
    locationHTML()
  );
}

/* ---------------- Eventos ---------------- */
let activeEventFilter = "Todos";

function eventsPageHTML() {
  const cats = ["Todos", ...new Set(upcomingEvents().map((e) => e.category).filter(Boolean))];
  if (!cats.includes(activeEventFilter)) activeEventFilter = "Todos";
  return (
    pageHeroHTML("Agenda completa", "Eventos", "Congressos, encontros e programações especiais da nossa igreja.") +
    `
  <section class="block">
    <div class="container">
      ${cats.length > 2 ? filterChipsHTML(cats, activeEventFilter, "setEventFilter") : ""}
      <div id="eventsList">${eventsListHTML()}</div>
    </div>
  </section>`
  );
}

function filterChipsHTML(cats, active, fn) {
  return `<div class="filter-row" role="group" aria-label="Filtrar por categoria" data-reveal>
    ${cats.map((c) => `<button type="button" class="filter-chip ${c === active ? "active" : ""}" aria-pressed="${c === active}" data-filter="${esc(c)}" onclick="${fn}(this.dataset.filter)">${esc(c)}</button>`).join("")}
  </div>`;
}

function eventsListHTML() {
  const list = upcomingEvents().filter((e) => activeEventFilter === "Todos" || e.category === activeEventFilter);
  return list.length
    ? `<div class="card-grid" data-stagger>${list.map(eventCardHTML).join("")}</div>`
    : emptyState("calendar", "Nenhum evento agendado no momento", "Volte em breve para conferir a agenda.");
}

// Atualiza só a lista (sem redesenhar a página inteira).
function setEventFilter(c) {
  activeEventFilter = c;
  updateFilterChips(c);
  swapContent("eventsList", eventsListHTML());
}

function updateFilterChips(active) {
  document.querySelectorAll(".filter-chip").forEach((b) => {
    const on = b.dataset.filter === active;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function swapContent(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
  initReveal(el);
}

/* ---------------- Vídeos ---------------- */
let activeVideoFilter = "Todos";

// Busca da biblioteca de vídeos: palavras soltas, sem acento e sem diferenciar
// maiúsculas (todas precisam aparecer no título, descrição ou categoria).
let videoQuery = "";
let videoSearchTimer = null;

/* Transmissões agendadas: a igreja cria a live no YouTube antes do culto e ela
   chega pela sincronização com a data no título. Até o culto começar, o player
   só mostraria "Transmissão ao vivo off-line", então o site mostra um aviso
   ("Começa terça-feira, às 19:30") em vez do player:
   - data futura: agendada;
   - no dia: agendada até 10 min antes do horário do culto de mesmo nome
     (aba Cultos do painel); sem horário conhecido, vira vídeo normal no dia.
   "Última transmissão" é sempre a mais recente que já pode ser assistida. */

// Horário do culto (aba Cultos) com o nome do vídeo, no dia da semana da data dele.
function horaDaTransmissao(v) {
  const d = parseISODate(v.date);
  if (!d) return "";
  const titulo = normalizeText(v.title);
  const dia = (data.services || []).find((s) => weekdayIndex(s.day) === d.getDay());
  const culto = (dia?.items || []).find((i) => [i.name, i.monthly?.name].some((n) => n && titulo.includes(normalizeText(n))));
  const hm = String(culto?.time || "").match(/^(\d{1,2}):(\d{2})/);
  return hm ? `${hm[1].padStart(2, "0")}:${hm[2]}` : "";
}

function videoAgendado(v, agora = new Date()) {
  if (!v.date) return false;
  const hoje = localISO(agora);
  if (v.date !== hoje) return v.date > hoje;
  const [h, m] = horaDaTransmissao(v).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  return agora.getHours() * 60 + agora.getMinutes() < h * 60 + m - 10;
}

// "hoje, às 19:30" · "amanhã, às 19:30" · "terça-feira, 20 de outubro, às 19:30"
function quandoComeca(v, agora = new Date()) {
  const d = parseISODate(v.date);
  if (!d) return "";
  const amanha = localISO(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  const dia =
    v.date === localISO(agora) ? "hoje" : v.date === amanha ? "amanhã" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const hora = horaDaTransmissao(v);
  return hora ? `${dia}, às ${hora}` : dia;
}

// Nome do culto sem a data do título ("Culto de Ensino - 20 de outubro de 2026" → "Culto de Ensino").
const nomeTransmissao = (v) => String(v.title || "").replace(/\s*[-–—|]\s*\d{1,2} de [a-zç]+ de \d{4}\s*$/i, "") || v.title;

// A próxima transmissão agendada (a de data mais próxima).
function proximaTransmissao() {
  return data.videos.filter((v) => videoAgendado(v)).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function proximaTransmissaoHTML(v) {
  return `
      <button class="live-next" type="button" data-id="${esc(v.id)}" onclick="openVideoModal(this.dataset.id)" data-reveal>
        <span class="live-next-icon">${icon("live", 20)}</span>
        <span class="live-next-text">
          <strong>Próxima transmissão ao vivo</strong>
          <span>${esc(nomeTransmissao(v))} · ${esc(quandoComeca(v))}</span>
        </span>
        <span class="live-next-more">${icon("right", 18)}</span>
      </button>`;
}

function videoMatches(v, words) {
  if (!words.length) return true;
  const hay = normalizeText(`${v.title} ${v.description || ""} ${v.category || ""}`);
  return words.every((w) => hay.includes(w));
}

function videosPageHTML() {
  const cats = ["Todos", ...new Set(data.videos.map((v) => v.category).filter(Boolean))];
  if (!cats.includes(activeVideoFilter)) activeVideoFilter = "Todos";
  videoQuery = (new URLSearchParams(location.search).get("q") || "").slice(0, 80);
  return (
    pageHeroHTML("Assista", "Biblioteca de vídeos", "Cultos, estudos e mensagens para assistir quando e onde quiser.") +
    `
  <section class="block">
    <div class="container">
      ${
        data.videos.length
          ? `<form class="video-search" role="search" onsubmit="event.preventDefault(); this.querySelector('input').blur()" data-reveal>
        ${icon("search", 18)}
        <label class="sr-only" for="videoSearch">Buscar vídeos</label>
        <input id="videoSearch" type="search" maxlength="80" autocomplete="off" enterkeyhint="search" placeholder="Buscar por título, tema ou pregador…" value="${esc(videoQuery)}" oninput="onVideoSearch(this.value)">
      </form>`
          : ""
      }
      ${cats.length > 2 ? filterChipsHTML(cats, activeVideoFilter, "setVideoFilter") : ""}
      <p class="video-count" id="videosCount" aria-live="polite">${esc(videoCountText())}</p>
      <div id="videosList">${videosListHTML()}</div>
    </div>
  </section>`
  );
}

const videoWords = () => normalizeText(videoQuery).split(/\s+/).filter(Boolean);
const filteredVideos = () => {
  const words = videoWords();
  return data.videos.filter((v) => (activeVideoFilter === "Todos" || v.category === activeVideoFilter) && videoMatches(v, words));
};

function videoCountText() {
  if (!data.videos.length) return "";
  const n = filteredVideos().length;
  const q = videoQuery.trim();
  if (!q) return n === 1 ? "1 vídeo" : `${n} vídeos`;
  return n === 0 ? "" : `${n} ${n === 1 ? "resultado" : "resultados"} para “${q}”`;
}

function onVideoSearch(value) {
  videoQuery = value.slice(0, 80);
  clearTimeout(videoSearchTimer);
  videoSearchTimer = setTimeout(() => {
    // Guarda a busca no endereço (dá para compartilhar o link), sem criar histórico.
    const url = new URL(location.href);
    if (videoQuery.trim()) url.searchParams.set("q", videoQuery.trim());
    else url.searchParams.delete("q");
    history.replaceState(history.state, "", url.pathname + url.search);
    refreshVideoList();
  }, 140);
}

function clearVideoSearch() {
  const input = document.getElementById("videoSearch");
  if (input) input.value = "";
  onVideoSearch("");
  input?.focus();
}

function refreshVideoList() {
  const count = document.getElementById("videosCount");
  if (count) count.textContent = videoCountText();
  swapContent("videosList", videosListHTML());
}

function videosListHTML() {
  if (!data.videos.length) return emptyState("youtube", "Nenhum vídeo publicado ainda");
  const list = filteredVideos();
  if (!list.length) {
    return emptyState(
      "search",
      "Nenhum vídeo encontrado",
      videoQuery.trim() ? `Nada com “${videoQuery.trim()}”${activeVideoFilter !== "Todos" ? ` em ${activeVideoFilter}` : ""}. Tente outra palavra.` : "Não há vídeos nesta categoria.",
      videoQuery.trim() ? `<button class="btn btn-primary btn-sm" type="button" onclick="clearVideoSearch()">Limpar busca</button>` : "",
    );
  }
  return `<div class="video-grid" data-stagger>${list
    .map((v) => {
      const agendada = videoAgendado(v);
      return `
    <article class="video-card${agendada ? " is-scheduled" : ""}" ${pressable("openVideoModal", v.id, (agendada ? "Transmissão agendada: " : "Assistir ") + v.title)}>
      <div class="thumb" style="${bgImage(ytThumb(v.youtubeUrl))}">${agendada ? `<span class="scheduled-tag">${icon("clock", 14)} Agendada</span>` : `<span class="play-btn sm">${icon("play", 18)}</span>`}</div>
      <span class="card-kicker">${esc(v.category)}</span>
      <h4>${esc(v.title)}</h4>
      <span class="date">${agendada ? "Começa " + esc(quandoComeca(v)) : fmtDateLong(v.date)}</span>
    </article>`;
    })
    .join("")}</div>`;
}

function setVideoFilter(c) {
  activeVideoFilter = c;
  updateFilterChips(c);
  refreshVideoList();
}

/* ---------------- Notícias ---------------- */
function newsPageHTML() {
  const items = publishedNews();
  const featured = items.find((n) => n.featured) || items[0];
  const rest = items.filter((n) => n !== featured);
  return (
    pageHeroHTML("Informação", "Notícias", "Acompanhe as novidades, acontecimentos e informações da nossa igreja.") +
    `
  <section class="block">
    <div class="container">
      ${
        featured
          ? `<a class="news-featured${featured.sourceUrl ? " is-sede" : ""}" data-reveal href="/noticias/${esc(encodeURIComponent(featured.slug))}" ${featured.sourceUrl ? "" : `style="${bgImage(featured.cover_image)}"`}>
              <div class="news-featured-overlay">
                <span class="eyebrow">${featured.sourceUrl ? esc(featured.sourceName || "AD Belém – Sede") : "Destaque"}</span>
                <h2>${esc(featured.title)}</h2>
                <p>${esc(featured.summary || "Confira esta notícia da nossa igreja.")}</p>
                <small>${fmtDateLong(featured.published_at || featured.created_at)}</small>
              </div>
            </a>`
          : ""
      }
      ${rest.length ? `<div class="card-grid" data-stagger>${rest.map(newsCardHTML).join("")}</div>` : ""}
      ${!items.length ? emptyState("megaphone", "Nenhuma notícia publicada no momento") : ""}
    </div>
  </section>`
  );
}

function newsCardHTML(n) {
  return `
  <a class="card news-card" href="/noticias/${esc(encodeURIComponent(n.slug))}">
    <div ${newsMediaAttrs(n)}>${newsSourceTag(n)}</div>
    <div class="card-body">
      <span class="card-kicker">${newsKicker(n)}</span>
      <h4>${esc(n.title)}</h4>
      <p class="clamp-3">${esc(n.summary)}</p>
      <span class="card-link">Leia mais ${icon("arrow", 15)}</span>
    </div>
  </a>`;
}

function newsDetailPageHTML(slug) {
  const n = publishedNews().find((x) => x.slug === slug);
  if (!n) {
    return `<section class="block"><div class="container">${emptyState("megaphone", "Notícia não encontrada", "Ela pode ter sido removida.", `<a class="btn btn-primary btn-sm" href="/noticias">Ver todas as notícias</a>`)}</div></section>`;
  }
  const paragraphs = esc(n.content || (n.sourceUrl ? n.summary : ""))
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p data-listen>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `
  <article class="news-detail">
    <div class="container" data-listen-root data-listen-title="${esc(n.title)}">
      <a class="back-link" href="/noticias">${icon("arrowBack", 16)} Voltar para notícias</a>
      <header class="news-detail-head" data-reveal>
        <span class="eyebrow">${fmtDateLong(n.published_at || n.created_at)}</span>
        <h1 data-listen>${esc(n.title)}</h1>
        ${n.author ? `<p>Por ${esc(n.author)}</p>` : ""}
      </header>
      ${!n.sourceUrl && n.cover_image && safeUrl(n.cover_image) ? `<img class="news-detail-cover" data-reveal src="${esc(safeUrl(n.cover_image))}" alt="">` : ""}
      <div class="news-detail-content" data-reveal>${paragraphs}</div>
      ${
        n.sourceUrl && safeUrl(n.sourceUrl)
          ? `<aside class="news-source" data-reveal>
        <p>Esta notícia é da <strong>${esc(n.sourceName || "AD Belém – Sede")}</strong>, publicada no site deles em ${fmtDateLong(n.published_at)}. Aqui fica só o resumo: o texto completo e as fotos estão lá.</p>
        <a class="btn btn-primary btn-sm" href="${esc(safeUrl(n.sourceUrl))}" target="_blank" rel="noopener">${icon("external", 15)} Ler a notícia completa no site da sede</a>
      </aside>`
          : ""
      }
      <div class="news-detail-foot">
        ${listenButtonHTML()}
        <button class="btn btn-ghost btn-sm" type="button" onclick="shareLink(document.title)">${icon("share", 15)} Compartilhar</button>
      </div>
    </div>
  </article>`;
}

/* ---------------- Sobre ---------------- */
// Linha do tempo, declaração de fé e lideranças só aparecem quando a
// administração preenche no painel (nada é inventado aqui).
function aboutPageHTML() {
  const a = data.about;
  const milestones = (a.milestones || [])
    .filter((m) => m && (m.title || m.text))
    .sort((x, y) => String(x.year || "").localeCompare(String(y.year || ""), "pt-BR", { numeric: true }));
  const leaders = (a.leaders || []).filter((l) => l && l.name);
  return (
    pageHeroHTML("Quem somos", "Nossa história") +
    `
  <section class="block">
    <div class="container about-grid">
      ${logoMediaHTML()}
      <div class="about-text" data-reveal>
        <span class="eyebrow">Nossa história</span>
        <h2>${esc(data.church.name)}</h2>
        <p class="pre-line">${esc(a.history)}</p>
      </div>
    </div>
  </section>
  ${
    milestones.length
      ? `<section class="block on-surface">
    <div class="container narrow">
      ${sectionHead("Trajetória", "Linha do tempo")}
      <ol class="timeline" data-stagger>
        ${milestones
          .map(
            (m) => `<li class="tl-item">
          <span class="tl-year">${esc(m.year)}</span>
          <div class="tl-body">
            <h3>${esc(m.title)}</h3>
            ${m.text ? `<p class="pre-line">${esc(m.text)}</p>` : ""}
            ${safeUrl(m.image) ? `<img src="${esc(safeUrl(m.image))}" alt="${esc(m.imageAlt || m.title)}" loading="lazy">` : ""}
          </div>
        </li>`,
          )
          .join("")}
      </ol>
    </div>
  </section>`
      : ""
  }
  <section class="block tight ${milestones.length ? "" : "on-surface"}">
    <div class="container mv-grid" data-stagger>
      ${a.mission ? `<div class="mv-card"><span class="eyebrow">Missão</span><p>${esc(a.mission)}</p></div>` : ""}
      ${a.vision ? `<div class="mv-card"><span class="eyebrow">Visão</span><p>${esc(a.vision)}</p></div>` : ""}
    </div>
  </section>
  ${creedSectionHTML(a)}
  <section class="block tight">
    <div class="container" data-reveal>
      ${(a.values || []).length ? `<span class="eyebrow">Nossos valores</span><div class="values-row">${a.values.map((v) => `<span class="value-pill">${esc(v)}</span>`).join("")}</div>` : ""}
      ${
        a.pastor || leaders.length
          ? `<div class="leader"><span class="eyebrow">Liderança</span>
        <ul class="leader-list">
          ${a.pastor ? `<li>${icon("user", 18)} <span><strong>${esc(a.pastor)}</strong></span></li>` : ""}
          ${leaders.map((l) => `<li>${icon("user", 18)} <span><strong>${esc(l.name)}</strong>${l.role ? ` · ${esc(l.role)}` : ""}</span></li>`).join("")}
        </ul></div>`
          : ""
      }
      <div class="about-links">
        <a class="btn btn-ghost btn-sm" href="/departamentos">Conheça os departamentos ${icon("arrow", 15)}</a>
        <a class="btn btn-ghost btn-sm" href="/primeira-visita">Planeje sua visita ${icon("arrow", 15)}</a>
      </div>
    </div>
  </section>`
  );
}

/* ---------------- Nosso credo (página Sobre) ----------------
   Texto em Painel → Sobre a igreja → Declaração de fé, um artigo por linha.
   As referências entre parênteses no fim de cada linha viram links para a
   Bíblia do site (depois que o índice da Bíblia carrega: initCreedLinks). */
function creedArticles(text) {
  return String(text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /\s*\(([^()]*\d[^()]*)\)\s*[.;,]?\s*$/.exec(line);
      return m ? { text: line.slice(0, m.index).replace(/[;,]\s*$/, ""), refs: m[1] } : { text: line.replace(/;\s*$/, ""), refs: "" };
    });
}

// "II Cor.13:13; Rm.8:2 e Jo.16:13" → etiquetas; "2:7" logo depois de "Gn1:1" é Gênesis 2:7.
function creedRefsHTML(raw) {
  let book = "";
  return raw
    .split(/;|\s+e\s+/)
    .map((part) => {
      part = part.trim();
      if (!part) return "";
      let q = part
        .replace(/^(III|II|I)\s+(?=\p{L})/u, (_, r) => ({ I: "1", II: "2", III: "3" })[r] + " ")
        .replace(/(\p{L})\.\s*/gu, "$1 ")
        .replace(/(\p{L})(\d)/u, "$1 $2")
        .trim();
      if (/^\d+:/.test(q) && book) q = `${book} ${q}`;
      else book = (/^(\d\s)?\p{L}+/u.exec(q) || [""])[0];
      return `<span class="creed-ref" data-ref="${esc(q)}">${esc(part)}</span>`;
    })
    .join("");
}

function creedSectionHTML(a) {
  const items = creedArticles(a.faith);
  if (!items.length) return "";
  const source = a.faithSource
    ? `<p class="creed-source">Credo da ${safeUrl(a.faithSourceUrl) ? `<a href="${href(a.faithSourceUrl)}" target="_blank" rel="noopener">${esc(a.faithSource)}</a>` : esc(a.faithSource)}, ministério do qual fazemos parte.</p>`
    : "";
  return `<section class="block tight creed">
    <div class="container narrow">
      <div class="creed-head" data-reveal>
        <span class="eyebrow">No que cremos</span>
        <h2 class="section-title">Nosso credo</h2>
        <p class="creed-motto">Assim cremos, assim vivemos.</p>
      </div>
      ${
        items.length > 1
          ? `<ol class="creed-list" data-stagger>${items.map((it) => `<li><p>${esc(it.text)}</p>${it.refs ? `<p class="creed-refs">${creedRefsHTML(it.refs)}</p>` : ""}</li>`).join("")}</ol>`
          : `<div class="faith-text pre-line" data-reveal>${esc(a.faith)}</div>`
      }
      ${source}
    </div>
  </section>`;
}

async function initCreedLinks() {
  const refs = document.querySelectorAll(".creed-ref[data-ref]");
  if (!refs.length) return;
  try {
    await bibleIndex();
  } catch {
    return; // sem o índice, as referências ficam como texto
  }
  refs.forEach((el) => {
    let ref = null;
    try {
      ref = parseRefList(el.dataset.ref)[0];
    } catch {}
    if (!ref || !el.isConnected) return;
    const link = document.createElement("a");
    link.className = "creed-ref";
    link.href = refPath(ref);
    link.title = refLabel(ref);
    link.textContent = el.textContent;
    el.replaceWith(link);
  });
}

/* ---------------- Acesso rápido (página inicial) ----------------
   Em vez de várias seções longas na home, um bloco curto que leva às
   páginas completas. */
function shortcutsHomeHTML() {
  const items = [
    ["/biblia", "book", "Bíblia", "Leia e ouça a Palavra"],
    ["/oracao", "heart", "Pedido de oração", "Nosso círculo de oração ora por você"],
    ["/primeira-visita", "pin", "Primeira visita", "Horários, endereço e como chegar"],
    ["/eventos", "calendar", "Eventos", "Congressos e programações"],
  ];
  return `
  <section class="block tight shortcuts-home">
    <div class="container">
      <span class="eyebrow shortcuts-eyebrow">Acesso rápido</span>
      <nav class="shortcuts" aria-label="Acesso rápido" data-stagger>
        ${items
          .map(
            ([to, ic, title, text]) => `<a class="shortcut" href="${to}">
          <span class="shortcut-icon">${icon(ic, 20)}</span>
          <span class="shortcut-text"><strong>${title}</strong><small>${text}</small></span>
          ${icon("right", 16)}
        </a>`,
          )
          .join("")}
      </nav>
    </div>
  </section>`;
}

/* ---------------- Sua primeira visita ---------------- */
function firstVisitHomeHTML() {
  const wa = safeUrl(data.church.whatsapp);
  return `
  <section class="block tight fv-band">
    <div class="container fv-band-inner" data-reveal>
      <div>
        <span class="eyebrow">Primeira vez por aqui?</span>
        <h2>Venha nos visitar</h2>
        <p>Horários, endereço e como chegar, tudo em um só lugar.</p>
      </div>
      <div class="fv-band-actions">
        <a class="btn btn-primary" href="/primeira-visita">Planejar minha visita ${icon("arrow", 16)}</a>
        ${wa ? `<a class="btn btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">${icon("whatsapp", 16)} Falar no WhatsApp</a>` : ""}
      </div>
    </div>
  </section>`;
}

function firstVisitPageHTML() {
  const fv = data.firstVisit || {};
  const c = data.church;
  const wa = safeUrl(c.whatsapp);
  const phoneDigits = String(c.phone || "").replace(/\D/g, "");
  const topics = [
    ["O que esperar de um culto", fv.expect, "heart"],
    ["Para as crianças", fv.kids, "user"],
    ["Acessibilidade", fv.accessibility, "check"],
    ["Como chegar", fv.directions, "pin"],
  ].filter(([, text]) => text && String(text).trim());
  const schedule = (data.services || [])
    .map(
      (d) => `<li><strong>${esc(d.day)}</strong>${serviceLines(d).map((l) => `<span>${esc(l.time)} · ${esc(l.name)}${l.note || l.extra ? ` <small>(${esc([l.note, l.extra].filter(Boolean).join("; "))})</small>` : ""}</span>`).join("")}</li>`,
    )
    .join("");
  return (
    pageHeroHTML("Seja bem-vindo", "Sua primeira visita", fv.intro || "Que bom que você quer nos conhecer! Aqui estão as informações para planejar a sua visita.") +
    `
  <section class="block">
    <div class="container fv-grid" data-stagger>
      <div class="fv-card">
        <span class="fv-icon">${icon("clock", 20)}</span>
        <h3>Horários dos cultos</h3>
        ${schedule ? `<ul class="fv-schedule">${schedule}</ul>` : "<p>Os horários serão publicados em breve.</p>"}
        <a class="link-btn" href="/cultos">Ver programação completa ${icon("arrow", 14)}</a>
      </div>
      <div class="fv-card">
        <span class="fv-icon">${icon("pin", 20)}</span>
        <h3>Onde estamos</h3>
        <p>${esc(c.address)}</p>
        <div class="fv-actions">
          ${safeUrl(c.mapsUrl) ? `<a class="btn btn-primary btn-sm" href="${href(c.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ""}
          ${c.address ? `<a class="btn btn-ghost btn-sm" href="https://waze.com/ul?q=${encodeURIComponent(c.address)}&navigate=yes" target="_blank" rel="noopener">Waze</a>` : ""}
        </div>
      </div>
      <div class="fv-card">
        <span class="fv-icon">${icon("message", 20)}</span>
        <h3>Fale com a recepção</h3>
        <p>Tire dúvidas ou avise que você vem. Vamos ter alegria em receber você.</p>
        <div class="fv-actions">
          ${wa ? `<a class="btn btn-primary btn-sm" href="${esc(wa)}" target="_blank" rel="noopener">${icon("whatsapp", 15)} WhatsApp</a>` : ""}
          ${c.phone ? `<a class="btn btn-ghost btn-sm" href="tel:${esc(phoneDigits)}">${icon("phone", 15)} Ligar</a>` : ""}
        </div>
      </div>
    </div>
  </section>
  ${
    topics.length
      ? `<section class="block tight on-surface">
    <div class="container fv-topics" data-stagger>
      ${topics.map(([title, text, ic]) => `<article class="fv-topic"><span class="fv-icon">${icon(ic, 18)}</span><div><h3>${esc(title)}</h3><p class="pre-line">${esc(text)}</p></div></article>`).join("")}
    </div>
  </section>`
      : ""
  }
  ${locationHTML()}
  <section class="block">
    <div class="container narrow">
      ${sectionHead("Opcional", "Quer avisar que vem?")}
      <p class="fv-form-note">Se quiser, deixe um recado para a recepção. Não é preciso se cadastrar.</p>
      ${prayerFormHTML("Quero visitar a igreja")}
    </div>
  </section>`
  );
}

/* ============================================================
   DOAÇÕES
   ============================================================ */
function pixPayload(key, name, city) {
  const cleanKey = (key || "").replace(/[^0-9A-Za-z@.+\-]/g, "");
  const clean = (v, max, fallback) =>
    (v || fallback)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .slice(0, max)
      .toUpperCase();
  const field = (id, v) => id + String(v.length).padStart(2, "0") + v;
  const merchant = field("00", "BR.GOV.BCB.PIX") + field("01", cleanKey);
  const body =
    field("00", "01") +
    field("26", merchant) +
    field("52", "0000") +
    field("53", "986") +
    field("58", "BR") +
    field("59", clean(name, 25, "IGREJA")) +
    field("60", clean(city, 15, "SAO PAULO")) +
    field("62", field("05", "***"));
  const raw = body + "6304";
  let crc = 0xffff;
  for (let i = 0; i < raw.length; i++) {
    crc ^= raw.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return raw + crc.toString(16).toUpperCase().padStart(4, "0");
}

// Só aparecem no site as finalidades ativas com chave PIX válida.
function donationTypeData() {
  return (data.donationTypes || [])
    .filter((d) => d.active !== false && parsePixKey(d.pix_key))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function donationsHomeHTML() {
  const d = data.donations || {};
  const types = donationTypeData();
  return `
  <section class="donations-home">
    <div class="donations-glow" aria-hidden="true"></div>
    <div class="container donations-home-shell">
      <div class="donations-copy" data-reveal>
        <span class="eyebrow">Generosidade</span>
        <h2>${esc(d.title || "Ofertas e Doações")}</h2>
        <p>${esc(d.intro || defaultData.donations.intro)}</p>
        <div class="donation-purpose"><span>${icon("heart", 20)}</span><div><strong>Uma oferta com propósito</strong><small>Contribua conforme sentir no coração e conforme suas possibilidades.</small></div></div>
        <a class="btn btn-accent" href="/doacoes">Ver formas de contribuir ${icon("arrow", 16)}</a>
      </div>
      <div class="donation-card donation-card-home" data-reveal>
        <div class="donation-card-top"><span class="pix-tag">PIX</span><span class="donation-secure">Contribuição online</span></div>
        <p class="donation-hint">Escolha uma finalidade para ver os dados de contribuição.</p>
        <div class="donation-purpose-list" data-stagger>${
          types.length
            ? types
                .map((t) => `<a class="donation-purpose-mini" href="/doacoes/${esc(encodeURIComponent(t.slug))}"><strong>${esc(t.name)}</strong><span>Ver dados ${icon("arrow", 14)}</span></a>`)
                .join("")
            : `<a class="donation-purpose-mini" href="/doacoes"><strong>Ofertas e doações</strong><span>Ver dados ${icon("arrow", 14)}</span></a>`
        }</div>
      </div>
    </div>
  </section>`;
}

// QR Code gerado no próprio navegador (vendor/qrcode.js): os dados do PIX
// não são enviados para nenhum serviço externo.
function pixQrDataUrl(payload) {
  if (!payload || typeof qrcode !== "function") return "";
  try {
    const qr = qrcode(0, "M");
    qr.addData(payload);
    qr.make();
    return qr.createDataURL(8, 2);
  } catch (e) {
    console.warn("QR Code:", e);
    return "";
  }
}

function donationCardHTML(t) {
  const pix = parsePixKey(t.pix_key);
  const payload = pix ? pixPayload(pix.key, t.pix_name, t.pix_city) : "";
  const qr = safeUrl(t.qr_code_url) || pixQrDataUrl(payload);
  return `
  <div class="donation-card">
    <div class="donation-card-top"><span class="pix-tag">PIX</span><span class="donation-secure">${esc(t.pix_name || "Contribuição online")}</span></div>
    ${
      qr
        ? `<div class="pix-qr"><img src="${esc(qr)}" alt="QR Code PIX — ${esc(t.name)}" loading="lazy"></div>`
        : `<div class="pix-qr qr-placeholder"><div class="qr-placeholder-inner"><span>PIX</span><small>QR Code em breve</small></div></div>`
    }
    <div class="pix-data">
      <label>Chave PIX</label>
      <div class="copy-field">
        <span>${esc(pix ? String(t.pix_key).trim() : "Não cadastrada")}</span>
        <button type="button" class="copy-btn" data-value="${esc(pix?.key)}" onclick="copyDonationValue(this, this.dataset.value)" ${pix ? "" : "disabled"}>
          <span class="copy-label">${icon("copy", 14)} Copiar</span><span class="copy-done">${icon("check", 14)} Copiado</span>
        </button>
      </div>
      ${payload ? `<button type="button" class="link-btn" data-value="${esc(payload)}" onclick="copyDonationValue(null, this.dataset.value, 'Código PIX copia e cola copiado!')">${icon("copy", 13)} Copiar código “PIX copia e cola”</button>` : ""}
      ${t.pix_name ? `<div class="pix-meta"><strong>Recebedor</strong><span>${esc(t.pix_name)}</span></div>` : ""}
      ${validCNPJ(t.cnpj) ? `<div class="pix-meta"><strong>CNPJ</strong><span>${esc(formatCNPJ(t.cnpj))}</span></div>` : ""}
    </div>
  </div>`;
}

function donationsPageHTML() {
  const types = donationTypeData();
  const d = data.donations || {};
  return `
  <section class="donations-page">
    <div class="donations-glow" aria-hidden="true"></div>
    <div class="container donations-page-grid">
      <div class="donations-copy donations-sticky" data-reveal>
        <span class="eyebrow">Generosidade</span>
        <h1>${esc(d.title || "Ofertas e Doações")}</h1>
        <p>${esc(d.intro || defaultData.donations.intro)}</p>
        <div class="donation-purpose"><span>${icon("heart", 20)}</span><div><strong>Uma oferta com propósito</strong><small>Contribua conforme sentir no coração e conforme suas possibilidades.</small></div></div>
        ${
          types.length > 1
            ? `<nav class="donation-jump" aria-label="Finalidades">${types.map((t) => `<a href="/doacoes/${esc(encodeURIComponent(t.slug))}">${esc(t.name)}</a>`).join("")}</nav>`
            : ""
        }
      </div>
      <div class="donations-list" data-stagger>
        ${
          types.length
            ? types
                .map(
                  (t) => `
          <article class="donation-block" id="doacao-${esc(t.slug)}">
            <header>
              <h3>${esc(t.name)}</h3>
              <p>${esc(t.description || "Contribua com a obra da igreja.")}</p>
            </header>
            ${donationCardHTML(t)}
          </article>`,
                )
                .join("")
            : `<article class="donation-block"><header><h3>Em breve</h3><p>Os dados para contribuição via PIX serão publicados aqui assim que forem cadastrados pela igreja.</p></header></article>`
        }
      </div>
    </div>
  </section>`;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
}

async function copyDonationValue(button, value, message = "Chave PIX copiada!") {
  if (!value) {
    showToast("Nenhuma chave PIX cadastrada.");
    return;
  }
  try {
    await copyText(value);
    if (button) {
      button.classList.add("copied");
      clearTimeout(button._t);
      button._t = setTimeout(() => button.classList.remove("copied"), 1800);
    }
    showToast(message, "success");
  } catch {
    prompt("Copie o valor abaixo:", value);
  }
}

async function shareLink(title) {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await copyText(url);
    showToast("Link copiado!", "success");
  } catch (e) {
    if (e?.name !== "AbortError") showToast("Não foi possível compartilhar.");
  }
}

/* ============================================================
   MODAIS
   ============================================================ */
let lastFocus = null;

function openModal(inner, { className = "", label = "" } = {}) {
  lastFocus = document.activeElement;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-backdrop" data-modal onclick="if(event.target===this)closeModal()">
      <div class="modal ${className}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <button class="modal-close" type="button" onclick="closeModal()" aria-label="Fechar">${icon("x", 20)}</button>
        ${inner}
      </div>
    </div>`;
  document.body.classList.add("modal-open");
  root.querySelector(".modal-close")?.focus({ preventScroll: true });
}

function closeModal({ instant = false } = {}) {
  closePhotoLightbox();
  const root = document.getElementById("modalRoot");
  const backdrop = root.querySelector("[data-modal]");
  if (!backdrop) return;
  const finish = () => {
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    window.currentMinistryPhotos = [];
    lastFocus?.focus?.({ preventScroll: true });
    // Fecha o deep link do episódio sem criar entrada nova no histórico.
    if (/^\/podcast\/.+/.test(location.pathname)) history.replaceState(null, "", "/podcast");
  };
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
  backdrop.classList.add("closing");
  setTimeout(finish, 160);
}

// Mantém o foco do teclado dentro do modal aberto.
function trapFocus(e) {
  const modal = document.querySelector(".photo-lightbox") || document.querySelector("[data-modal] .modal");
  if (!modal) return;
  const f = [...modal.querySelectorAll('button,[href],iframe,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.disabled && el.offsetParent !== null,
  );
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.getElementById("photoLightbox")) closePhotoLightbox();
    else if (document.querySelector("[data-modal]")) closeModal();
    else if (document.body.classList.contains("mobile-menu-open")) toggleMobileMenu(false);
  } else if (e.key === "Tab") {
    trapFocus(e);
  } else if (document.getElementById("photoLightbox") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    changeLightboxPhoto(e.key === "ArrowLeft" ? -1 : 1);
  }
});

function openVideoModal(id) {
  const v = data.videos.find((x) => String(x.id) === String(id));
  if (!v) return;
  if (videoAgendado(v)) return openScheduledModal(v);
  const vid = ytId(v.youtubeUrl);
  openModal(
    `
    <div class="modal-video-frame">
      ${vid ? embedGate("youtube", `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0`, v.title, { allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", openUrl: v.youtubeUrl }) : ""}
    </div>
    <div class="modal-pad">
      <span class="eyebrow">${esc(v.category)}${v.date ? " · " + fmtDateLong(v.date) : ""}</span>
      <h3>${esc(v.title)}</h3>
      ${v.description ? `<p class="video-desc">${esc(v.description)}</p>` : ""}
    </div>`,
    { className: "modal-media", label: v.title },
  );
}

// Transmissão que ainda não começou: aviso de quando começa no lugar do player
// (que só mostraria "off-line") e o atalho para o lembrete do YouTube.
function openScheduledModal(v) {
  const yt = safeUrl(v.youtubeUrl);
  openModal(
    `
    <div class="modal-video-frame scheduled-frame" style="${bgImage(ytThumb(v.youtubeUrl))}">
      <div class="scheduled-msg">
        <span class="scheduled-tag">${icon("clock", 14)} Transmissão agendada</span>
        <strong>Começa ${esc(quandoComeca(v))}</strong>
        <span>Volte aqui nesse horário para assistir ao vivo.</span>
      </div>
    </div>
    <div class="modal-pad">
      <span class="eyebrow">${esc(v.category)}${v.date ? " · " + fmtDateLong(v.date) : ""}</span>
      <h3>${esc(v.title)}</h3>
      <p class="scheduled-help">A transmissão ainda não começou. No YouTube dá para ativar o lembrete (o sininho) e receber um aviso quando ela começar.</p>
      ${yt ? `<a class="btn btn-primary btn-sm" href="${esc(yt)}" target="_blank" rel="noopener">${icon("youtube", 16)} Ativar lembrete no YouTube</a>` : ""}
    </div>`,
    { className: "modal-media", label: "Transmissão agendada: " + v.title },
  );
}

function openLive() {
  const c = data.church;
  const channel = String(c.liveChannelId || "").trim();
  if (!/^UC[\w-]{20,}$/.test(channel)) {
    if (currentRoute() !== "videos") navigateTo("/videos");
    return;
  }
  openModal(
    `
    <div class="modal-video-frame">
      ${embedGate("youtube", `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(channel)}&autoplay=1`, "Transmissão ao vivo", { allow: "autoplay; encrypted-media; picture-in-picture", openUrl: c.youtubeUrl })}
    </div>
    <div class="modal-pad modal-pad-row">
      <div>
        <span class="eyebrow">${icon("live", 14)} Transmissão ao vivo</span>
        <p>Se não houver transmissão agora, confira os cultos anteriores na biblioteca de vídeos.</p>
      </div>
      <div class="modal-actions">
        <a class="btn btn-ghost btn-sm" href="/videos">Ver vídeos</a>
        ${c.youtubeUrl ? `<a class="btn btn-primary btn-sm" href="${href(c.youtubeUrl)}" target="_blank" rel="noopener">${icon("youtube", 15)} Abrir no YouTube</a>` : ""}
      </div>
    </div>`,
    { className: "modal-media", label: "Transmissão ao vivo" },
  );
}

function openEventModal(id) {
  const ev = data.events.find((x) => String(x.id) === String(id));
  if (!ev) return;
  openModal(
    `
    <div class="modal-cover" style="${bgImage(ev.image)}"><span class="badge">${esc(ev.category || "Evento")}</span></div>
    <div class="modal-pad">
      <span class="eyebrow">${esc(capitalize(fmtDateFull(ev.date)))}${ev.time ? " · " + esc(ev.time) : ""}</span>
      <h3>${esc(ev.name)}</h3>
      ${ev.description ? `<p>${esc(ev.description)}</p>` : ""}
      ${
        ev.location || ev.address
          ? `<div class="modal-place">${icon("pin", 18)}<div><strong>${esc(ev.location)}</strong>${ev.address ? `<span>${esc(ev.address)}</span>` : ""}</div></div>`
          : ""
      }
      <div class="modal-actions">
        ${ev.mapsUrl ? `<a class="btn btn-primary btn-sm" href="${href(ev.mapsUrl)}" target="_blank" rel="noopener">${icon("pin", 15)} Ver no mapa</a>` : ""}
        ${ev.link ? `<a class="btn btn-accent btn-sm" href="${href(ev.link)}" target="_blank" rel="noopener">Inscrever-se ${icon("external", 14)}</a>` : ""}
        <button class="btn btn-ghost btn-sm" type="button" data-id="${esc(ev.id)}" onclick="addEventToCalendar(this.dataset.id)">${icon("calendar", 15)} Adicionar à agenda</button>
        <a class="btn btn-ghost btn-sm" href="${esc(googleCalendarUrl(eventCalendarInfo(ev)))}" target="_blank" rel="noopener">Google Agenda ${icon("external", 13)}</a>
      </div>
    </div>`,
    { className: "modal-event", label: ev.name },
  );
}

async function openMinistryModal(ministryId) {
  const m = (data.ministries || []).find((x) => String(x.id) === String(ministryId));
  if (!m) return;
  openModal(
    `
    <div class="ministry-modal-hero">
      <div class="ministry-modal-logo" style="${bgImage(m.image)}">${safeUrl(m.image) ? "" : icon("user", 48)}</div>
      <div class="ministry-modal-info">
        <span class="eyebrow">Departamento</span>
        <h2>${esc(m.name)}</h2>
        ${m.responsible ? `<div class="modal-responsible">Responsável · ${esc(m.responsible)}</div>` : ""}
        <p>${esc(m.description)}</p>
        <div class="modal-actions">
          ${m.instagram ? `<a class="btn btn-outline-light btn-sm" href="${href(m.instagram)}" target="_blank" rel="noopener">${icon("instagram", 15)} Instagram</a>` : ""}
          ${m.whatsapp ? `<a class="btn btn-accent btn-sm" href="${href(m.whatsapp)}" target="_blank" rel="noopener">${icon("whatsapp", 15)} WhatsApp</a>` : ""}
        </div>
      </div>
    </div>
    <div class="ministry-gallery-section">
      <div class="gallery-head"><div><span class="eyebrow">Momentos</span><h3>Fotos do departamento</h3></div><span id="ministryGalleryCount" class="gallery-count"></span></div>
      <div id="ministryGalleryRoot"><div class="photo-skeleton"><span></span><span></span><span></span></div></div>
    </div>`,
    { className: "modal-wide", label: m.name },
  );
  await loadMinistryGallery(ministryId);
}

async function loadMinistryGallery(ministryId) {
  const target = document.getElementById("ministryGalleryRoot");
  const count = document.getElementById("ministryGalleryCount");
  if (!target) return;
  try {
    const { data: photos, error } = await db("ministry_images")
      .select("*")
      .eq("ministry_id", ministryId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    const list = (photos || []).filter((p) => safeUrl(p.image_url || p.url));
    if (count) count.textContent = list.length ? `${list.length} ${list.length === 1 ? "foto" : "fotos"}` : "";
    if (!list.length) {
      target.innerHTML = `<div class="gallery-empty">${icon("camera", 26)}<strong>Em breve</strong><p>As fotos deste departamento serão adicionadas aqui.</p></div>`;
      return;
    }
    window.currentMinistryPhotos = list;
    target.innerHTML = `
      <div class="photo-carousel">
        <div class="photo-track">
          ${list
            .map(
              (p, i) =>
                `<button class="ministry-photo" type="button" onclick="openPhotoLightbox(${i})" aria-label="Ampliar foto ${i + 1}"><img src="${esc(safeUrl(p.image_url || p.url))}" alt="${esc(p.caption || "Foto do departamento")}" loading="lazy" onload="this.classList.add('loaded')">${p.caption ? `<span>${esc(p.caption)}</span>` : ""}</button>`,
            )
            .join("")}
        </div>
      </div>`;
  } catch (err) {
    console.error("Erro ao carregar fotos do departamento:", err);
    target.innerHTML = `<div class="gallery-empty">${icon("camera", 26)}<strong>Não foi possível carregar as fotos</strong><p>Tente novamente em instantes.</p></div>`;
  }
}

function openPhotoLightbox(index) {
  const photos = window.currentMinistryPhotos || [];
  const p = photos[index];
  if (!p) return;
  closePhotoLightbox();
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="photo-lightbox" id="photoLightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" onclick="if(event.target===this)closePhotoLightbox()">
      <button class="lightbox-close" type="button" onclick="closePhotoLightbox()" aria-label="Fechar">${icon("x", 22)}</button>
      ${photos.length > 1 ? `<button class="lightbox-nav left" type="button" onclick="changeLightboxPhoto(-1)" aria-label="Foto anterior">${icon("left", 24)}</button>` : ""}
      <figure><img id="lightboxImage" src="${esc(safeUrl(p.image_url || p.url))}" alt="${esc(p.caption || "")}"><figcaption id="lightboxCaption">${esc(p.caption || "")}</figcaption></figure>
      ${photos.length > 1 ? `<button class="lightbox-nav right" type="button" onclick="changeLightboxPhoto(1)" aria-label="Próxima foto">${icon("right", 24)}</button>` : ""}
    </div>`,
  );
  window.currentLightboxIndex = index;
  document.querySelector("#photoLightbox .lightbox-close")?.focus({ preventScroll: true });
}

function changeLightboxPhoto(direction) {
  const photos = window.currentMinistryPhotos || [];
  if (photos.length < 2) return;
  window.currentLightboxIndex = (window.currentLightboxIndex + direction + photos.length) % photos.length;
  const p = photos[window.currentLightboxIndex];
  const img = document.getElementById("lightboxImage");
  img.classList.remove("swap");
  void img.offsetWidth; // reinicia a animação
  img.classList.add("swap");
  img.src = safeUrl(p.image_url || p.url);
  document.getElementById("lightboxCaption").textContent = p.caption || "";
}

function closePhotoLightbox() {
  document.getElementById("photoLightbox")?.remove();
}

/* ============================================================
   MOVIMENTO — revelar ao rolar + header que reage ao scroll
   ============================================================ */
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let revealObserver = null;

// Cada item aparece assim que a ponta dele entra na tela (threshold 0).
// Antes, a lista inteira esperava 8% dela estar visível: numa lista comprida
// (ex.: 27 vídeos, mais de 10 mil px no celular) isso nunca acontecia e os
// cartões ficavam invisíveis. Agora cada cartão de uma [data-stagger] é
// observado sozinho e a cascata acontece só entre os que entram juntos.
// Carrossel (rolagem lateral) continua aparecendo inteiro de uma vez.
function initReveal(scope = document) {
  const singles = [...scope.querySelectorAll("[data-reveal]")];
  const groups = [...scope.querySelectorAll("[data-stagger]")];
  if (reduceMotion() || !("IntersectionObserver" in window)) {
    [...singles, ...groups].forEach((el) => el.classList.add("in"));
    return;
  }
  document.documentElement.classList.add("motion");
  revealObserver ||= new IntersectionObserver(
    (entries) => {
      let n = 0; // posição na cascata, contada só entre os que apareceram agora
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.parentElement?.classList.contains("reveal-each")) el.style.setProperty("--i", Math.min(n++, 4));
        el.classList.add("in");
        revealObserver.unobserve(el);
      });
    },
    { rootMargin: "0px 0px 40px 0px", threshold: 0 }, // começa um pouco antes de entrar: chega já animando
  );
  singles.forEach((el) => revealObserver.observe(el));
  groups.forEach((g) => {
    const kids = [...g.children];
    if (g.closest(".carousel")) {
      kids.forEach((child, i) => child.style.setProperty("--i", Math.min(i, 4)));
      revealObserver.observe(g);
      return;
    }
    g.classList.add("reveal-each");
    kids.forEach((child) => revealObserver.observe(child));
  });
}

let scrollTicking = false;

function updateHeaderScrolled() {
  document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 24);
}

window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateHeaderScrolled();
      scrollTicking = false;
    });
  },
  { passive: true },
);
