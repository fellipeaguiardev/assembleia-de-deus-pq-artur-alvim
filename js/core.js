/* ============================================================
   CORE — dados padrão, estado, helpers, tema e persistência
   ============================================================ */

function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const defaultData = {
  theme: {
    primary: "#003399",
    secondary: "#032154",
    accent: "#86abca",
    background: "#F7F8FC",
    text: "#171B24",
    radius: 18,
    fontHeading: "Fraunces",
    fontBody: "Inter",
    mode: "claro",
    introTagline: "Você é bem-vindo aqui", // frase que surge letra por letra na abertura
  },
  church: {
    name: "ADBelém - Pq. Artur Alvim",
    address: "Rua Maria Eugenia Célso, 65 — Parque Artur Alvim, São Paulo/SP",
    phone: "", // preenchido no painel (Igreja & redes)
    whatsapp: "",
    instagramUrl: "https://instagram.com/adparquealvim",
    youtubeUrl: "https://youtube.com/@ADParqueArturAlvim",
    facebookUrl: "https://facebook.com/Adparquealvim",
    mapsUrl: "https://maps.app.goo.gl/DFs4ZSPeF1dMwKzz6",
    liveChannelId: "",
    privacyEmail: "",
  },
  hero: {
    eyebrow: "Você é bem-vindo aqui",
    title: "Uma igreja para você",
    subtitle:
      "Venha fazer parte da nossa família. Um lugar de fé, acolhimento e comunidade — para todas as fases da vida.",
    image: "", // foto de fundo opcional (enviada no painel)
  },
  // A ordem aqui é a ordem padrão da Home. Seções que ainda não existirem
  // na configuração salva são encaixadas logo depois da seção anterior.
  homeSections: [
    // Só o essencial fica ligado; o resto continua nas páginas próprias e pode
    // ser religado no painel (Página inicial → Seções).
    { id: "nextService", name: "Próximo culto", enabled: true },
    { id: "announcements", name: "Avisos", enabled: true },
    { id: "palavra", name: "Palavra Diária", enabled: true },
    { id: "ebd", name: "EBD — lição da semana", enabled: true },
    { id: "latestVideo", name: "Última transmissão", enabled: true },
    { id: "shortcuts", name: "Acesso rápido (Bíblia, oração, visita, eventos)", enabled: true },
    { id: "bible", name: "Leia a Bíblia", enabled: false },
    { id: "events", name: "Eventos", enabled: false },
    { id: "firstVisit", name: "Primeira visita", enabled: false },
    { id: "news", name: "Notícias", enabled: false },
    { id: "about", name: "Sobre a igreja", enabled: false },
    { id: "ministries", name: "Departamentos", enabled: false },
    { id: "podcast", name: "Podcast", enabled: false },
    { id: "social", name: "Redes sociais", enabled: false },
    { id: "prayer", name: "Pedido de oração", enabled: false },
    { id: "location", name: "Localização", enabled: false },
    { id: "donations", name: "Doações", enabled: false },
  ],
  services: [
    {
      id: uid(),
      day: "Domingo",
      items: [
        { time: "09:00", name: "Escola Bíblica Dominical", monthly: { week: 3, name: "Ceia do Senhor", moveTo: { day: "Terça-Feira", time: "19:30" } } },
        { time: "18:00", name: "Culto da Família" },
      ],
    },
    { id: uid(), day: "Terça-Feira", items: [{ time: "19:30", name: "Culto de Ensino" }] },
    { id: uid(), day: "Quinta-Feira", items: [{ time: "19:30", name: "Culto Público" }] },
  ],
  events: [],
  videos: [],
  announcements: [],
  ministries: [],
  about: {
    // Textos institucionais vêm do painel (Sobre a igreja); aqui ficam vazios
    // para nunca exibir conteúdo inventado se o banco não responder.
    history: "",
    mission: "",
    vision: "",
    values: [],
    pastor: "",
    faith: "", // declaração de fé aprovada pela igreja
    leaders: [], // [{ name, role }]
    milestones: [], // linha do tempo: [{ year, title, text, image, imageAlt }]
  },
  // Página "Sua primeira visita" (cada bloco só aparece se preenchido no painel).
  firstVisit: { intro: "", expect: "", kids: "", accessibility: "", directions: "" },
  // EBD: importação automática do sumário (Painel → EBD). Lida também pela
  // função diária da Vercel (api/ebd-sync-diario.mjs).
  ebdSync: { enabled: true, magazines: ["adultos"], autoPublish: false },
  // Biblioteca dos Jovens (Painel → Biblioteca). Regras vindas da planilha da
  // biblioteca; os números são usados pelo painel ao emprestar e renovar.
  library: {
    title: "Biblioteca dos Jovens",
    intro: "Livros de teologia, história, filosofia e literatura para emprestar. A biblioteca é cuidada pelos Jovens, mas está aberta a todos.",
    loanDays: 14,
    renewDays: 7,
    maxRenewals: 2,
    maxBooks: 2,
    rules: [
      { t: "Pedidos", d: "Os pedidos podem ser feitos aqui no site, no botão “Quero este livro”, ou diretamente com os jovens: Carol (secretária dos Jovens), Danilo (mídia) e Thiago (mídia)." },
      { t: "Quantidade de livros", d: "Cada pessoa pode retirar até 2 livros por vez." },
      { t: "Prazo de empréstimo", d: "O prazo de empréstimo é de 14 dias a partir da data da retirada." },
      { t: "Renovação", d: "Se o livro não estiver em atraso e não houver pessoas na fila de espera, o empréstimo pode ser renovado por mais 7 dias, com limite de até 2 renovações. A renovação deve ser pedida diretamente ao responsável pela biblioteca." },
      { t: "Atraso na devolução", d: "Em caso de atraso, a pessoa fica suspensa de novos empréstimos por um período igual ao número de dias de atraso." },
      { t: "Dias de retirada e devolução", d: "As retiradas e devoluções são feitas nos dias de culto oficial." },
      { t: "Conservação do livro", d: "Quem pega o livro é responsável pela conservação dele durante o empréstimo." },
      { t: "Danos ou perda", d: "Em caso de perda ou dano significativo, a pessoa deve repor o mesmo livro ou outro equivalente, conforme orientação do responsável pela biblioteca." },
      { t: "Reserva de livros", d: "Se um livro estiver emprestado, é possível entrar na fila de espera para o próximo empréstimo." },
    ],
  },
  // Podcast "Parque Cast" (Spotify for Creators). O feed RSS é público e é de onde
  // o painel importa os episódios (Painel → Podcast → Importar do Spotify).
  podcastFeed: {
    rssUrl: "https://anchor.fm/s/2fee8714/podcast/rss",
    spotifyUrl: "https://open.spotify.com/show/4rorZwpZxBQuAg2jRd4w5v",
  },
  socials: {
    instagram: { enabled: true },
    youtube: { enabled: true },
    facebook: { enabled: true },
    whatsapp: { enabled: true },
  },
  donations: {
    enabled: true,
    title: "Ofertas e Doações",
    intro:
      "Sua contribuição ajuda nossa igreja a cuidar de pessoas, realizar projetos e anunciar o Evangelho.",
  },
  donationTypes: [],
  news: [],
  podcasts: [],
};

/* ---------- PIX e CNPJ ----------
   Chave de teste ("44444", "aaaa"…) não aparece no site: o visitante tentaria
   contribuir para uma chave que não existe. Formatos aceitos pelo Banco Central:
   CPF, CNPJ, e-mail, celular e chave aleatória. */
const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");

function validCPF(v) {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

function validCNPJ(v) {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const digit = (len) => {
    let sum = 0;
    let w = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * w--;
      if (w < 2) w = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}

const formatCNPJ = (v) => onlyDigits(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

// Retorna { type, key } com a chave no formato do PIX, ou null se não for válida.
function parsePixKey(raw) {
  const k = String(raw ?? "").trim();
  if (!k) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return { type: "aleatória", key: k.toLowerCase() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(k)) return { type: "e-mail", key: k.toLowerCase() };
  const digits = onlyDigits(k);
  const phoneLike = /^[\d\s()+.-]+$/.test(k);
  if (phoneLike && k.startsWith("+55") && /^55[1-9]{2}9?\d{8}$/.test(digits)) return { type: "celular", key: "+" + digits };
  if (validCNPJ(k)) return { type: "CNPJ", key: digits };
  if (validCPF(k)) return { type: "CPF", key: digits };
  if (phoneLike && /^[1-9]{2}9\d{8}$/.test(digits)) return { type: "celular", key: "+55" + digits };
  return null;
}

// Chaves que só existem no JSON de "settings". As demais (eventos, vídeos,
// notícias...) têm tabela própria e não devem ser duplicadas no JSON.
const SETTINGS_KEYS = [
  "theme",
  "church",
  "hero",
  "homeSections",
  "about",
  "socials",
  "donations",
  "donationTypes",
  "firstVisit",
  "ebdSync",
  "library",
  "podcastFeed",
];

let data = structuredClone(defaultData);
let storageReady = false;

/* ============================================================
   HELPERS — escape e URLs seguras
   ============================================================ */
const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Escapa texto para HTML e atributos. Use sempre que o valor vier do banco.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

// Aceita apenas links http(s), mailto, tel e âncoras internas.
function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:)/i.test(u) || u.startsWith("#")) return u;
  if (u.startsWith("/") && !u.startsWith("//") && !u.startsWith("/\\")) return u; // "//site.com" é externo
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return "https://" + u;
  return "";
}

// URL pronta para usar dentro de href="...".
function href(url, fallback = "#") {
  return esc(safeUrl(url) || fallback);
}

// background-image seguro dentro de style="...".
function bgImage(url) {
  const u = safeUrl(url);
  if (!u) return "";
  const clean = u.replace(/["'()\\\s<>]/g, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"));
  return `background-image:url(&quot;${esc(clean)}&quot;)`;
}

// Capas grandes (as do podcast têm 1–2 MB) passam pelo redimensionador da
// Vercel (vercel.json → "images"; grátis até 5 mil por mês, cada capa é
// redimensionada uma vez e fica em cache). Fora da Vercel usa o original.
const THUMB_HOSTS = { "d3t3ozftmdmh3i.cloudfront.net": "/7941613/", "rtludbkopxbhiwlwycid.supabase.co": "/storage/v1/object/public/images/" };
const THUMB_WIDTHS = [160, 320, 640];
function imgThumb(url, width = 320) {
  const u = safeUrl(url);
  if (!u || !location.hostname.endsWith(".vercel.app")) return u;
  try {
    const x = new URL(u);
    const path = THUMB_HOSTS[x.hostname];
    if (x.protocol !== "https:" || !path || !x.pathname.includes(path) || /\.(svg|gif)$/i.test(x.pathname)) return u;
  } catch {
    return u;
  }
  const w = THUMB_WIDTHS.find((n) => n >= width) || 640;
  return `/_vercel/image?url=${encodeURIComponent(u)}&w=${w}&q=70`;
}

function slugify(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeText(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function truncate(s, n) {
  const t = String(s ?? "").trim();
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

/* ============================================================
   HELPERS — datas (sempre no fuso local, não em UTC)
   ============================================================ */
function localISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).length <= 10 ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(iso) {
  const d = parseISODate(iso);
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "";
}

function fmtDateFull(iso) {
  const d = parseISODate(iso);
  return d
    ? d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";
}

function fmtDateLong(v) {
  const d = parseISODate(v);
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
}

function fmtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/* ============================================================
   HELPERS — YouTube / Spotify
   ============================================================ */
function ytId(url) {
  if (!url) return "";
  url = String(url).trim();
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/live\/|\/shorts\/)([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{10,12}$/.test(url)) return url;
  return "";
}

function ytThumb(url) {
  const id = ytId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

function spotifyEmbed(url) {
  const m = String(url || "").match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|track|show|playlist|album)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : "";
}

/* ============================================================
   CONTEÚDO DERIVADO
   ============================================================ */
function activeAnnouncements() {
  const today = localISO();
  return (data.announcements || []).filter(
    (a) => (!a.startDate || a.startDate <= today) && (!a.endDate || a.endDate >= today),
  );
}

function upcomingEvents() {
  const today = localISO();
  return (data.events || [])
    .filter((e) => e.active !== false && e.date && e.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function weekdayIndex(day) {
  const n = normalizeText(day);
  return WEEKDAYS.findIndex((w) => n.startsWith(w));
}

/* ---------- Troca mensal num horário fixo ----------
   Um horário pode mudar de nome numa semana do mês. Ex.: Domingo 09:00
   "Escola Bíblica Dominical", mas no 3º domingo "Ceia do Senhor".
   Nessa semana, o conteúdo normal pode ir para outro horário: a lição da EBD
   é dada no Culto de Ensino da terça seguinte (moveTo aponta para esse horário).
   Fica no próprio item da programação:
     { time, name, monthly: { week: 3, name, moveTo: { day, time } } }
   (editável no painel, aba Cultos). */
const weekOfMonth = (date) => Math.ceil(date.getDate() / 7); // dias 1–7 = 1º, 8–14 = 2º…
const isEbdService = (name) => /escola b[ií]blica|\bebd\b/i.test(name || "");

function monthlyRule(item) {
  const m = item?.monthly;
  const week = Number(m?.week);
  if (!m || !String(m.name || "").trim() || !(week >= 1 && week <= 5)) return null;
  const moveTo = m.moveTo?.day ? { day: String(m.moveTo.day), time: String(m.moveTo.time || "") } : null;
  return { week, name: String(m.name).trim(), moveTo };
}

// Horário (da programação) que recebe o conteúdo normal na semana da troca.
function monthlyMoveTarget(m) {
  if (!m?.moveTo) return null;
  const d = (data.services || []).find((x) => x.day === m.moveTo.day);
  const it = d?.items?.find((i) => i.time === m.moveTo.time);
  return it && weekdayIndex(d.day) >= 0 ? { day: d.day, time: it.time, name: it.name } : null;
}

// Dias entre o horário trocado e o que recebe o conteúdo (terça após o domingo = 2).
const moveOffset = (fromDay, toDay) => (weekdayIndex(toDay) - weekdayIndex(fromDay) + 7) % 7 || 7;

// Quais horários mandam o conteúdo para este (ex.: Terça 19:30 ← EBD do 3º domingo).
function movedSources(day, item) {
  const out = [];
  (data.services || []).forEach((s) => {
    if (weekdayIndex(s.day) < 0) return;
    (s.items || []).forEach((src) => {
      const m = monthlyRule(src);
      const to = monthlyMoveTarget(m);
      if (src !== item && to && to.day === day && to.time === item.time) out.push({ src, rule: m, day: s.day });
    });
  });
  return out;
}

// Naquela data este horário recebe o conteúdo de outro? Devolve o nome do original.
function movedInto(day, item, date) {
  for (const s of movedSources(day, item)) {
    const from = new Date(date);
    from.setDate(from.getDate() - moveOffset(s.day, day));
    if (weekOfMonth(from) === s.rule.week) return s.src.name;
  }
  return "";
}

const movedLabel = (name) => (isEbdService(name) ? "a lição da EBD" : name);

// Nome do culto naquela data, já com a troca mensal.
function serviceNameOn(item, date) {
  const m = monthlyRule(item);
  return m && weekOfMonth(date) === m.week ? m.name : item.name;
}

// "3º domingo", "1ª terça-feira"… (domingo e sábado são masculinos).
const isMaleDay = (day) => /^(domingo|s[áa]bado)/.test(normalizeText(day));
function nthWeekdayLabel(week, day) {
  return `${week}${isMaleDay(day) ? "º" : "ª"} ${String(day || "").toLowerCase()}`;
}
// "na terça", "no domingo"
const onWeekday = (day) => `${isMaleDay(day) ? "no" : "na"} ${String(day || "").split("-")[0].toLowerCase()}`;

// Linhas para mostrar a programação de um dia: o horário normal e, se houver,
// a troca do mês como uma linha à parte.
function serviceLines(d) {
  const lines = [];
  (d.items || []).forEach((it) => {
    const m = monthlyRule(it);
    const extra = movedSources(d.day, it)
      .map((s) => `${onWeekday(d.day)} após o ${nthWeekdayLabel(s.rule.week, s.day)} do mês, com ${movedLabel(s.src.name)}`)
      .join("; ");
    lines.push({ item: it, time: it.time, name: it.name, note: m ? `exceto no ${nthWeekdayLabel(m.week, d.day)} do mês` : "", extra });
    if (m) lines.push({ item: it, time: it.time, name: m.name, note: `${nthWeekdayLabel(m.week, d.day)} do mês`, monthly: true });
  });
  return lines;
}

// Próximo horário de culto, calculado a partir da programação semanal.
function nextScheduledService(now = new Date()) {
  let best = null;
  for (const d of data.services || []) {
    const wd = weekdayIndex(d.day);
    if (wd < 0) continue;
    for (const it of d.items || []) {
      const [hh, mm] = String(it.time || "").split(":").map(Number);
      if (!Number.isFinite(hh)) continue;
      const date = new Date(now);
      date.setHours(hh, mm || 0, 0, 0);
      let add = (wd - now.getDay() + 7) % 7;
      // Considera o culto "atual" até 90 min depois do início.
      if (add === 0 && date.getTime() + 90 * 60000 < now.getTime()) add = 7;
      date.setDate(date.getDate() + add);
      const name = serviceNameOn(it, date);
      if (!best || date < best.date) best = { date, name, baseName: it.name, monthly: name !== it.name, time: it.time, day: d.day, with: movedInto(d.day, it, date) };
    }
  }
  return best;
}

// O que mostrar no card "Próximo culto": o que acontecer primeiro,
// um evento cadastrado ou o próximo culto da programação.
function nextHighlight() {
  const ev = upcomingEvents()[0];
  const svc = nextScheduledService();
  const evDate = ev ? parseISODate(ev.date + "T" + (ev.time || "23:59") + ":00") : null;
  if (ev && (!svc || evDate <= svc.date)) {
    return { kind: "event", date: evDate, title: ev.name, time: ev.time, location: ev.location, ev };
  }
  if (svc) {
    return {
      kind: "service",
      date: svc.date,
      title: svc.name,
      baseName: svc.baseName,
      monthly: svc.monthly,
      with: svc.with,
      time: svc.time,
      day: svc.day,
      location: data.church.name,
    };
  }
  return null;
}

function relativeDayLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

/* ============================================================
   ÍCONES (SVG inline, traço herdando a cor do texto)
   ============================================================ */
const ICONS = {
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 6L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="6" y="4" width="4" height="16" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1.2" fill="currentColor" stroke="none"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowBack: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  external: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  back15: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  fwd15: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  live: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  school: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sunrise: '<path d="M12 2v6"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  skipPrev: '<path d="M19 20 9 12l10-8v16Z"/><path d="M5 19V5"/>',
  skipNext: '<path d="m5 4 10 8-10 8V4Z"/><path d="M19 5v14"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  image:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  camera:
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  instagram:
    '<rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/>',
  youtube:
    '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  whatsapp:
    '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 9.5c.5 2.2 2.3 4 4.5 4.5l1-1.2 2 .9-.4 1.6c-3.6.3-7.6-3.7-7.3-7.3l1.6-.4.9 2z"/>',
  spotify:
    '<circle cx="12" cy="12" r="10"/><path d="M7.5 9c3.2-1 6.8-.7 9.5.9"/><path d="M8 12.2c2.6-.8 5.4-.5 7.6.8"/><path d="M8.6 15.2c2-.5 4-.3 5.7.6"/>',
};

function icon(name, size = 18, extraClass = "") {
  const body = ICONS[name];
  if (!body) return "";
  return `<svg class="ic ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ============================================================
   TEMA
   ============================================================ */
const loadedFonts = new Set(["Fraunces", "Inter"]);

// Fraunces e Inter vêm de /assets/fonts (sem contato com o Google). Outra fonte
// escolhida no painel só é buscada no Google Fonts se o visitante permitiu
// conteúdo de terceiros; senão, o site usa a fonte reserva do sistema.
function loadGoogleFont(name) {
  if (!name || loadedFonts.has(name)) return;
  if (typeof hasEmbedConsent !== "function" || !hasEmbedConsent()) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function applyTheme() {
  const r = document.documentElement.style;
  const t = data.theme;
  r.setProperty("--c-primary", t.primary);
  r.setProperty("--c-secondary", t.secondary);
  r.setProperty("--c-accent", t.accent);
  r.setProperty("--c-bg", t.background);
  r.setProperty("--c-text", t.text);
  r.setProperty("--radius", (Number(t.radius) || 0) + "px");
  r.setProperty("--font-heading", `'${t.fontHeading}', Georgia, serif`);
  r.setProperty("--font-body", `'${t.fontBody}', system-ui, sans-serif`);
  loadGoogleFont(t.fontHeading);
  loadGoogleFont(t.fontBody);
  // Guarda as cores para a tela de abertura já nascer com elas na próxima visita.
  try {
    localStorage.setItem(
      "site-theme",
      JSON.stringify({ primary: t.primary, secondary: t.secondary, accent: t.accent, background: t.background, tagline: t.introTagline }),
    );
  } catch {}
}

/* ============================================================
   TOAST (global — funciona no site e no painel)
   ============================================================ */
let toastTimer = null;

function showToast(msg, type = "info") {
  let t = document.getElementById("appToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "appToast";
    t.className = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.dataset.type = type;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================
   CARREGAMENTO
   ============================================================ */
// Insere seções novas (ex.: "news", "podcast") que não existiam quando a
// configuração foi salva, logo depois da seção que vem antes delas no padrão.
function mergeHomeSections(saved) {
  if (!Array.isArray(saved) || !saved.length) return structuredClone(defaultData.homeSections);
  const result = saved.filter((s) => s && s.id);
  defaultData.homeSections.forEach((def, i) => {
    if (result.some((s) => s.id === def.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = result.findIndex((s) => s.id === defaultData.homeSections[j].id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    result.splice(at, 0, { ...def });
  });
  return result;
}

const mapEvent = (ev) => ({ ...ev, mapsUrl: ev.maps_url || ev.mapsUrl || "", active: ev.active !== false });
const mapVideo = (v) => ({
  ...v,
  youtubeUrl: v.youtube_url || v.youtubeUrl || "",
  youtube_id: v.youtube_id || ytId(v.youtube_url || v.youtubeUrl) || null,
  source: v.source || "manual",
});
const mapService = (s) => ({ id: s.id, day: s.day || "", items: s.items || [] });
const mapAnnouncement = (a) => ({
  id: a.id,
  text: a.text || "",
  priority: a.priority || "média",
  color: a.color || "#E3A857",
  link: a.link || "",
  startDate: a.start_date || "",
  endDate: a.end_date || "",
});
const mapMinistry = (m) => ({
  id: m.id,
  name: m.name || m.title || "",
  description: m.description || "",
  image: m.image || "",
  responsible: m.responsible || "",
  instagram: m.instagram || "",
  whatsapp: m.whatsapp || "",
});
const mapNews = (n) => ({
  id: n.id,
  title: n.title || "",
  slug: n.slug || "",
  summary: n.summary || "",
  content: n.content || "",
  cover_image: n.cover_image || "",
  // Datas gravadas pelo painel como dia (AAAA-MM-DD); evita o deslocamento de fuso do UTC.
  published_at: String(n.published_at || n.created_at || "").slice(0, 10),
  author: n.author || "",
  featured: n.featured === true,
  published: n.published !== false,
  created_at: n.created_at || "",
});
const mapPodcast = (p) => ({
  id: p.id,
  title: p.title || "",
  description: p.description || "",
  episode_number: p.episode_number ?? "",
  cover_url: p.cover_url || "",
  audio_url: p.audio_url || "",
  spotify_url: p.spotify_url || "",
  youtube_url: p.youtube_url || "",
  published_at: p.published_at || "",
  status: p.status || "Rascunho",
  created_at: p.created_at || "",
});
const mapDonationType = (d) => ({
  id: d.id,
  name: d.name || "",
  slug: d.slug || "",
  description: d.description || "",
  pix_key: d.pix_key || "",
  pix_name: d.pix_name || "",
  pix_city: d.pix_city || "SAO PAULO",
  cnpj: d.cnpj || "",
  qr_code_url: d.qr_code_url || "",
  active: d.active !== false,
  sort_order: d.sort_order || 0,
});

const db = (table) => supabaseClient.from(table);

async function loadData() {
  // Sem conexão: abre na hora com a última cópia salva. (A biblioteca do
  // Supabase tentaria de novo por vários segundos antes de desistir.)
  if (navigator.onLine === false && hasSnapshot()) {
    restoreSnapshot();
    storageReady = true;
    applyTheme();
    renderSite();
    // Quando a internet voltar, atualiza — exceto no meio de uma leitura da Bíblia.
    window.addEventListener("online", () => routeBase(currentRoute()) !== "biblia" && loadData(), { once: true });
    return;
  }
  try {
    const [settings, events, videos, services, announcements, ministries, news, donationTypes, podcasts] =
      await Promise.all([
        db("settings").select("data").eq("id", "main").maybeSingle(),
        db("events").select("*").order("date", { ascending: true }),
        db("videos").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
        db("services").select("*"),
        db("announcements").select("*"),
        db("ministries").select("*"),
        db("news").select("*").order("published_at", { ascending: false }),
        db("donation_types").select("*").order("sort_order", { ascending: true }),
        db("podcasts").select("*").order("published_at", { ascending: false }),
      ]);

    const log = (label, res) => res.error && console.warn(`[Supabase] ${label}:`, res.error.message);
    log("settings", settings);
    log("events", events);
    log("videos", videos);
    log("services", services);
    log("announcements", announcements);
    log("ministries", ministries);
    log("news", news);
    log("donation_types", donationTypes);
    log("podcasts", podcasts);

    const saved = settings.data?.data;
    if (saved) {
      data = {
        ...structuredClone(defaultData),
        theme: { ...defaultData.theme, ...(saved.theme || {}) },
        church: { ...defaultData.church, ...(saved.church || {}) },
        hero: { ...defaultData.hero, ...(saved.hero || {}) },
        about: { ...defaultData.about, ...(saved.about || {}) },
        firstVisit: { ...defaultData.firstVisit, ...(saved.firstVisit || {}) },
        ebdSync: { ...defaultData.ebdSync, ...(saved.ebdSync || {}) },
        library: { ...defaultData.library, ...(saved.library || {}) },
        socials: { ...defaultData.socials, ...(saved.socials || {}) },
        donations: { ...defaultData.donations, ...(saved.donations || {}) },
        donationTypes: saved.donationTypes || [],
        homeSections: mergeHomeSections(saved.homeSections),
        // Usados só se a tabela correspondente falhar ao carregar.
        services: saved.services || defaultData.services,
        events: saved.events || [],
        videos: saved.videos || [],
        announcements: saved.announcements || [],
        ministries: saved.ministries || [],
        news: saved.news || [],
      };
    }

    if (events.data) data.events = events.data.map(mapEvent);
    else data.events = (data.events || []).map(mapEvent);
    // Vídeos ocultados no painel não aparecem (e não voltam na sincronização).
    if (videos.data) data.videos = videos.data.filter((v) => !v.hidden).map(mapVideo);
    else data.videos = (data.videos || []).map(mapVideo);
    if (services.data) data.services = services.data.map(mapService);
    if (announcements.data) data.announcements = announcements.data.map(mapAnnouncement);
    if (ministries.data) data.ministries = ministries.data.map(mapMinistry);
    if (news.data) data.news = news.data.map(mapNews);
    if (podcasts.data) data.podcasts = podcasts.data.map(mapPodcast);
    if (donationTypes.data?.length) data.donationTypes = donationTypes.data.map(mapDonationType);

    const results = [settings, events, videos, services, announcements, ministries, news, donationTypes, podcasts];
    if (results.every((r) => r.error)) restoreSnapshot();
    else saveSnapshot();
  } catch (error) {
    console.error("Erro ao conectar com o Supabase:", error);
    restoreSnapshot();
  }

  storageReady = true;
  applyTheme();
  renderSite();
}

/* ---------- Cópia local para abrir sem internet ----------
   Guarda só o conteúdo público (o que qualquer visitante já vê).
   Quando todas as consultas falham (sem conexão), o site usa a
   última cópia em vez dos dados de exemplo. */
const SNAPSHOT_KEY = "site-data-cache";
const SNAPSHOT_KEYS = [...SETTINGS_KEYS, "services", "events", "videos", "announcements", "ministries", "news", "podcasts"];

function saveSnapshot() {
  try {
    const snap = {};
    SNAPSHOT_KEYS.forEach((k) => (snap[k] = data[k]));
    snap.news = (data.news || []).filter((n) => n.published !== false);
    snap.podcasts = (data.podcasts || []).filter((p) => normalizeText(p.status) === "publicado");
    const json = JSON.stringify({ at: new Date().toISOString(), data: snap });
    if (json.length < 1_500_000) localStorage.setItem(SNAPSHOT_KEY, json);
  } catch {}
}

function hasSnapshot() {
  try {
    return Boolean(localStorage.getItem(SNAPSHOT_KEY));
  } catch {
    return false;
  }
}

function restoreSnapshot() {
  try {
    const snap = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
    if (!snap?.data) return;
    data = { ...structuredClone(defaultData), ...snap.data, homeSections: mergeHomeSections(snap.data.homeSections) };
    setTimeout(() => showToast("Você está sem internet. Mostrando as últimas informações salvas."), 1200);
  } catch {}
}

// Depois do login, recarrega o que o visitante comum não enxerga
// (rascunhos de notícias e podcasts, ofertas inativas).
async function loadAdminOnlyData() {
  const [news, podcasts, donationTypes] = await Promise.all([
    db("news").select("*").order("published_at", { ascending: false }),
    db("podcasts").select("*").order("published_at", { ascending: false }),
    db("donation_types").select("*").order("sort_order", { ascending: true }),
  ]);
  if (news.data) data.news = news.data.map(mapNews);
  if (podcasts.data) data.podcasts = podcasts.data.map(mapPodcast);
  if (donationTypes.data?.length) data.donationTypes = donationTypes.data.map(mapDonationType);
}

/* ============================================================
   SALVAR CONFIGURAÇÕES (tabela settings)
   ============================================================ */
function settingsPayload() {
  const out = {};
  SETTINGS_KEYS.forEach((k) => (out[k] = data[k]));
  return out;
}

let saveTimer = null;

// Aplica a mudança na tela e salva as configurações com debounce.
// rerenderAdmin: true só quando a estrutura do painel muda (ex.: reordenar).
function persist({ rerenderAdmin = false } = {}) {
  applyTheme();
  renderSite();
  if (rerenderAdmin && isAdminOpen()) renderAdmin();

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!(await adminEnsureAccess())) return;
    const { error } = await db("settings").upsert({ id: "main", data: settingsPayload() }, { onConflict: "id" });
    if (error) {
      console.error("Erro ao salvar configurações:", error);
      showToast("Erro ao salvar. Verifique sua conexão.", "error");
    } else {
      showToast("Alterações salvas", "success");
    }
  }, 500);
}

/* ============================================================
   UPLOAD PARA O STORAGE
   ============================================================ */
// Tipos e tamanhos aceitos — evita subir arquivos errados ou enormes por engano.
const UPLOAD_RULES = {
  image: { types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxMB: 8, label: "imagem (JPG, PNG, WEBP ou GIF)" },
  audio: { types: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav"], maxMB: 50, label: "áudio (MP3, M4A, AAC, OGG ou WAV)" },
};

function uploadError(message) {
  const err = new Error(message);
  err.userMessage = message;
  return err;
}

async function uploadFile(file, folder) {
  const rule = UPLOAD_RULES[folder.includes("audio") ? "audio" : "image"];
  if (!rule.types.includes(file.type)) throw uploadError(`Arquivo inválido: envie uma ${rule.label}.`);
  if (file.size > rule.maxMB * 1024 * 1024) throw uploadError(`Arquivo grande demais: o limite é ${rule.maxMB} MB.`);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bucket = window.APP_CONFIG.STORAGE_BUCKET;
  if (!(await adminEnsureAccess())) throw uploadError("Confirme o acesso ao painel pelo e-mail e envie de novo.");
  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return supabaseClient.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
