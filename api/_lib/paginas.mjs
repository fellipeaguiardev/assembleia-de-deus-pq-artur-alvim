// ============================================================
// Títulos e descrições das páginas no HTML servido (preview do WhatsApp,
// Facebook e Google, que não rodam o JavaScript do site).
// ------------------------------------------------------------
// metaDaRota(caminho) devolve { title, description, path, canonical,
// noindex, status } e aplicarMeta(html, meta) troca só estas tags do
// index.html: <title>, description, og:title, og:description, og:url e
// canonical (com escape de HTML). O resto da página é o mesmo de sempre.
//
// - /biblia/<livro>/<capítulo>[/<versículos>] e /palavra: texto da Bíblia
//   Livre (data/bible/blivre), sem banco. Com versículo (e na Palavra
//   Diária), a og:image é a imagem do próprio versículo (api/imagem.mjs).
// - /noticias/<slug>, /eventos e /ebd/…: Supabase com a chave publicável,
//   só leitura (o RLS mostra só o que é público).
// - Demais rotas: ROUTE_META de js/compartilhado.js (o mesmo do navegador).
// - Rota que o site não conhece: status 404, mesma página "não encontrada".
// ============================================================
import { readFile } from "node:fs/promises";
import "../../js/compartilhado.js";
import { SITE_URL } from "./site.mjs";
import { SUPABASE_URL, SUPABASE_KEY } from "./fonte.mjs";

const S = globalThis.SITE_SHARED;
const RAIZ = new URL("../../", import.meta.url);
const TEMPO_BANCO_MS = 1500;

export const escAttr = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const limpa = (s) =>
  String(s ?? "")
    .replace(/[[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1") // "interesses , não" (espaço que sobra no arquivo) → "interesses, não"
    .trim();
export const truncate = (s, n) => {
  const t = limpa(s);
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
};
const semAcento = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// ---------- Bíblia (arquivos do próprio site) ----------
let indice = null;
async function bibliaIndice() {
  indice ||= JSON.parse(await readFile(new URL("data/bible/blivre/index.json", RAIZ), "utf8"));
  return indice;
}
const livros = new Map();
async function bibliaLivro(code) {
  if (!/^[0-9A-Z]{3}$/.test(code)) throw new Error("livro inválido");
  if (!livros.has(code)) livros.set(code, JSON.parse(await readFile(new URL(`data/bible/blivre/${code}.json`, RAIZ), "utf8")));
  return livros.get(code);
}
// "16", "16-18", "16,18" → [16, 17, 18] (igual ao parseVerseSpec de js/bible.js)
function versiculos(spec, max) {
  const out = new Set();
  String(spec || "")
    .split(",")
    .forEach((part) => {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      if (!a) return;
      for (let v = a; v <= Math.min(b || a, max); v++) out.add(v);
    });
  return [...out];
}

// Imagem do versículo (api/imagem.mjs). A versão do desenho (js/compartilhado.js)
// vai no endereço: mudou o desenho, o WhatsApp e a Vercel não reaproveitam a antiga.
const imagemUrl = (q) => `${SITE_URL}/api/imagem?${q}&v=${S.IMAGEM_VERSAO}`;

// { texto, referencia } de /biblia/<slug>/<cap>/<versículos>, ou null.
export async function versiculoDaBiblia(slug, capStr, spec) {
  const idx = await bibliaIndice();
  const book = idx.books.find((b) => b.slug === slug);
  const cap = Number(capStr);
  if (!book || !cap || cap > book.chapters || !spec) return null;
  const texto = (await bibliaLivro(book.code)).chapters[cap - 1] || [];
  const vs = versiculos(spec, texto.length);
  if (!vs.length) return null;
  return { texto: limpa(vs.map((v) => texto[v - 1]).join(" ")), referencia: `${book.name} ${cap}:${spec}` };
}

// { texto, referencia, iso } da Palavra Diária do dia (nunca de um dia futuro).
export async function versiculoDaPalavra(param) {
  const hoje = S.spToday();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(param || "") && param <= hoje ? param : hoje;
  const r = await refPorNome(S.palavraRefFor(iso));
  if (!r) return null;
  const texto = (await bibliaLivro(r.book.code)).chapters[r.cap - 1] || [];
  return { texto: limpa(versiculos(r.spec, texto.length).map((v) => texto[v - 1]).join(" ")), referencia: `${r.book.name} ${r.cap}:${r.spec}`, iso };
}

async function metaBiblia(param) {
  const [slug, capStr, spec] = String(param || "").split("/");
  if (!slug) return { title: S.ROUTE_META.biblia[0], description: S.ROUTE_META.biblia[1] };
  const idx = await bibliaIndice();
  const book = idx.books.find((b) => b.slug === slug);
  // Abreviação ou nome diferente: o navegador corrige o endereço; aqui fica o padrão.
  if (!book) return { title: S.ROUTE_META.biblia[0], description: S.ROUTE_META.biblia[1] };
  if (!capStr) return { title: book.name, description: `Leia o livro de ${book.name} na Bíblia (${book.chapters} capítulos).` };
  const cap = Number(capStr);
  if (!cap || cap > book.chapters) return { title: "Passagem não encontrada", description: S.ROUTE_META.biblia[1], noindex: true };
  const texto = (await bibliaLivro(book.code)).chapters[cap - 1] || [];
  const vs = versiculos(spec, texto.length);
  const corpo = vs.length ? vs.map((v) => texto[v - 1]).join(" ") : texto[0] || "";
  const ref = `${book.name} ${cap}${vs.length ? ":" + spec : ""}`;
  const imagem = vs.length ? { imagem: imagemUrl(`biblia=${encodeURIComponent(`${book.slug}/${cap}/${spec}`)}`), imagemAlt: `${ref}: ${truncate(corpo, 180)}` } : {};
  return { title: ref, description: `${truncate(corpo, 220)} (${ref}, Bíblia Livre)`, ...imagem };
}

// "Salmos 23:1" → { book, cap, spec } usando os nomes do index.json
async function refPorNome(ref) {
  const m = String(ref).match(/^(.+?)\s+(\d+):(\d+(?:-\d+)?)$/);
  if (!m) return null;
  const idx = await bibliaIndice();
  const book = idx.books.find((b) => semAcento(b.name) === semAcento(m[1]));
  return book ? { book, cap: Number(m[2]), spec: m[3] } : null;
}

async function metaPalavra(param) {
  const hoje = S.spToday();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(param || "") && param <= hoje ? param : hoje;
  const r = await refPorNome(S.palavraRefFor(iso));
  if (!r) return { title: S.ROUTE_META.palavra[0], description: S.ROUTE_META.palavra[1] };
  const texto = (await bibliaLivro(r.book.code)).chapters[r.cap - 1] || [];
  const corpo = versiculos(r.spec, texto.length).map((v) => texto[v - 1]).join(" ");
  const ref = `${r.book.name} ${r.cap}:${r.spec}`;
  const dataLonga = new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  return {
    title: iso === hoje ? "Palavra Diária" : `Palavra de ${dataLonga}`,
    description: `${ref} — ${truncate(corpo, 180)} (Bíblia Livre)`,
    path: iso === hoje ? "/palavra" : `/palavra/${iso}`,
    imagem: imagemUrl(`palavra=${iso}`),
    imagemAlt: `Palavra Diária, ${ref}: ${truncate(corpo, 180)}`,
  };
}

// ---------- Supabase (só leitura, chave publicável, RLS) ----------
async function ler(tabela, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(TEMPO_BANCO_MS),
  });
  if (!res.ok) throw new Error(`${tabela}: HTTP ${res.status}`);
  return res.json();
}
const enc = encodeURIComponent;

async function metaNoticia(slug) {
  const [n] = await ler("news", `select=title,summary,content,slug,published_at,source_url&slug=eq.${enc(slug)}&limit=1`);
  if (!n || (n.published_at && new Date(n.published_at) > new Date())) {
    return { title: "Notícia não encontrada", description: S.ROUTE_META.noticias[1], noindex: true, status: 404 };
  }
  const desc = truncate(n.summary || n.content, 160) || S.ROUTE_META.noticias[1];
  const sede = /^https:\/\/ad\.org\.br\//.test(n.source_url || "") ? n.source_url : "";
  return { title: n.title, description: desc, ...(sede ? { canonical: sede } : {}) };
}

async function metaEventos() {
  const hoje = S.spToday();
  const evs = await ler("events", `select=name,date&active=eq.true&date=gte.${hoje}&order=date.asc&limit=3`).catch(() => []);
  if (!evs.length) return { title: S.ROUTE_META.eventos[0], description: S.ROUTE_META.eventos[1] };
  const dia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return { title: S.ROUTE_META.eventos[0], description: truncate(`Próximos eventos: ${evs.map((e) => `${e.name} (${dia(e.date)})`).join(", ")}. AD Belém - Parque Artur Alvim.`, 200) };
}

async function metaEbd(param) {
  const [ano, tri, revista, num] = String(param || "").split("/");
  const padrao = { title: S.ROUTE_META.ebd[0], description: S.ROUTE_META.ebd[1] };
  if (!/^\d{4}$/.test(ano || "") || !/^[1-4]$/.test(tri || "") || !/^[a-z0-9-]{1,40}$/.test(revista || "")) return padrao;
  const [q] = await ler("ebd_quarters", `select=id,year,quarter,magazine,theme&year=eq.${ano}&quarter=eq.${tri}&magazine_slug=eq.${enc(revista)}&limit=1`);
  if (!q) return padrao;
  const rotulo = `${q.quarter}º Trimestre de ${q.year}`;
  if (!/^\d{1,2}$/.test(num || "")) {
    return { title: `EBD — ${rotulo}`, description: q.theme ? `${q.theme} — lições da Escola Bíblica Dominical (${q.magazine}).` : S.ROUTE_META.ebd[1] };
  }
  const [l] = await ler("ebd_lessons", `select=title,number,golden_ref&quarter_id=eq.${enc(q.id)}&number=eq.${Number(num)}&limit=1`);
  if (!l) return padrao;
  const titulo = l.title || `Lição ${l.number}`;
  return {
    title: `${titulo} — EBD`,
    description: `Lição ${l.number} (${rotulo}, ${q.magazine}): ${l.golden_ref ? "texto áureo " + l.golden_ref + ". " : ""}Referências e perguntas para estudo.`,
  };
}

// ---------- Escolha por rota ----------
export function separarRota(caminho) {
  let path = String(caminho || "/").split(/[?#]/)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    path = "/";
  }
  path = "/" + path.replace(/^\/+|\/+$/g, "");
  const partes = path.slice(1).split("/");
  const base = partes[0] || "home";
  return { path, base, param: partes.slice(1).join("/") };
}

export async function metaDaRota(caminho) {
  const { path, base, param } = separarRota(caminho);
  if (!S.ROUTE_BASES.includes(base)) {
    return { title: "Página não encontrada", description: S.ROUTE_META.home[1], path, noindex: true, status: 404 };
  }
  let m;
  if (base === "biblia") m = await metaBiblia(param);
  else if (base === "palavra") m = await metaPalavra(param);
  else if (base === "noticias" && param) m = await metaNoticia(param);
  else if (base === "eventos") m = await metaEventos();
  else if (base === "ebd") m = await metaEbd(param);
  else if (base === "admin") m = { title: "Painel", description: S.ROUTE_META.home[1], noindex: true };
  else m = { title: S.ROUTE_META[base][0], description: S.ROUTE_META[base][1] };
  return { path, status: 200, noindex: false, ...m };
}

// ---------- Troca das tags no index.html ----------
export function aplicarMeta(html, meta) {
  const title = meta.title ? `${meta.title} | ${S.SITE_NAME}` : S.HOME_TITLE;
  const url = SITE_URL + (meta.path === "/" ? "/" : String(meta.path || "/").replace(/\/+$/, ""));
  const canonical = meta.canonical || url;
  const d = escAttr(meta.description);
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escAttr(canonical)}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escAttr(title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${escAttr(url)}" />`);
  if (meta.noindex) out = out.replace(/<\/title>/, `</title>\n    <meta name="robots" content="noindex" />`);
  // Imagem própria da página (versículo): troca a og:image padrão (o banner com o brasão)
  if (meta.imagem)
    out = out.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${escAttr(meta.imagem)}" />\n    <meta property="og:image:type" content="image/jpeg" />\n    <meta property="og:image:alt" content="${escAttr(meta.imagemAlt || title)}" />`,
    );
  return out;
}

let shell = null;
export async function lerShell() {
  shell ||= await readFile(new URL("index.html", RAIZ), "utf8");
  return shell;
}
