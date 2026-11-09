// ============================================================
// EBD — leitura do sumário das Lições Bíblicas (CPAD) publicado em
// escola-ebd.com.br (robots.txt permite o acesso).
// ------------------------------------------------------------
// O que é aproveitado (só fatos, nunca o texto da lição):
//   trimestre: tema, comentarista, título de cada lição e o link dela
//   lição publicada lá: data, referência do texto áureo/principal, da
//   leitura bíblica em classe e da leitura diária (segunda a sábado)
// O texto da lição (introdução, tópicos, plano de aula, subsídios…) é da
// revista da CPAD e NÃO é copiado: o site mostra o botão "Ler a lição
// completa", que abre a página da lição no escola-ebd. O texto bíblico vem
// da Bíblia Livre no próprio site.
//
// Educado com o site de origem: identifica-se no User-Agent, faz uma
// requisição por vez, com pausa, só busca a página de uma lição quando
// ainda faltam dados dela no banco e nunca segue para outros domínios.
// ============================================================

import { SITE_URL } from "./site.mjs";

export const SOURCE_HOST = "https://escola-ebd.com.br";
const UA = `AD-Belem-Pq-Artur-Alvim-EBD/1.0 (+${SITE_URL})`;
const MAX_BYTES = 900_000;

export const MAGAZINES = {
  adultos: { name: "Adultos" },
  jovens: { name: "Jovens" },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const doSite = (url) => String(url).startsWith(SOURCE_HOST + "/");

async function baixar(url, accept) {
  if (!doSite(url)) throw new Error("endereço fora do site de origem");
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(10000) });
  if (!doSite(res.url)) throw new Error("redirecionou para fora do site de origem");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("página grande demais");
  return new TextDecoder("utf-8").decode(buf);
}

// Baixa uma página do site de origem (e só dele). 404 → null.
export const getPage = (url) => baixar(url, "text/html");

/* ---------- Texto ---------- */
const NAMED = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", hellip: "…",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»", ordm: "º", ordf: "ª", deg: "°",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  agrave: "à", Agrave: "À", acirc: "â", ecirc: "ê", ocirc: "ô", Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô",
  atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ", ccedil: "ç", Ccedil: "Ç", uuml: "ü", Uuml: "Ü",
};
const decodeEntities = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return NAMED[e] ?? m;
  });

const stripComments = (h) => h.replace(/<!--[\s\S]*?-->/g, "");
export const textOf = (h) =>
  decodeEntities(stripComments(String(h)).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
// Texto em linhas (uma por <br>, <p>, <div>, <li>, <h…>)
const linesOf = (h) =>
  decodeEntities(
    stripComments(String(h))
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/?(p|div|li|h\d|ul|tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const limit = (s, n) => (s.length > n ? s.slice(0, n).trim() : s);

// Só caracteres de referência bíblica ("Js 1.8; 2Tm 3.16", "Mt 4.4,7,10").
export function cleanRef(s) {
  const r = String(s || "")
    .replace(/[()]/g, " ")
    .replace(/[^0-9A-Za-zÀ-ÿ\s.,;:–-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*:\s*(\d)/g, "$1.$2") // "Dt 4:39" → "Dt 4.39" (o padrão das revistas)
    .replace(/\s*,\s*(?=\d)/g, ",") // "28.1-6, 15-19" → "28.1-6,15-19"
    .replace(/\s*;\s*/g, "; ")
    .trim()
    .replace(/[\s.;,:–-]+$/, "");
  return /\d/.test(r) && r.length <= 120 ? r : "";
}

/* ---------- Revista do trimestre ----------
   O endereço não segue um padrão fixo (ex.: ".../revista-de-jovens-4-trimestre-2026-cpad-2/"),
   então pergunta à busca do próprio site (WordPress) e confere o título. */
export async function quarterUrl(slug, year, quarter) {
  const mag = MAGAZINES[slug];
  if (!mag) return "";
  const busca = encodeURIComponent(`${mag.name} ${quarter} Trimestre ${year}`);
  const json = await baixar(`${SOURCE_HOST}/wp-json/wp/v2/posts?search=${busca}&per_page=20&_fields=link,title`, "application/json");
  if (!json) return "";
  let posts = [];
  try {
    posts = JSON.parse(json);
  } catch {
    return "";
  }
  const alvo = new RegExp(`\\bREVISTA\\b.*\\b${plain(mag.name)}\\b.*\\b${quarter}\\s*[°º]?\\s*TRIMESTRE\\b.*\\b${year}\\b`);
  const achado = (Array.isArray(posts) ? posts : []).find((p) => alvo.test(plain(decodeEntities(String(p?.title?.rendered || "")))) && doSite(p.link));
  return achado ? achado.link : "";
}

export function parseQuarter(html) {
  // Só o texto da página (o <head> repete tema e comentarista num resumo)
  const corpo = html.slice(Math.max(0, html.search(/<body/i)));
  // "<h2>Titulo: O DEUS DA ALIANÇA</h2>" ou "<h2><strong>Titulo:</strong> <strong>Regozijai-vos…</strong></h2>"
  const h2Titulo = [...corpo.matchAll(/<h2[^>]*>([\s\S]{0,400}?)<\/h2>/gi)].map((m) => textOf(m[1])).find((t) => /^T[íi]tulo\s*:/i.test(t));
  const theme = limit((h2Titulo || "").replace(/^T[íi]tulo\s*:\s*/i, ""), 300);
  const commentator = limit(textOf(corpo.match(/Comentarista\s*:?\s*(?:<\/strong>)?\s*([^<]{2,120})</i)?.[1] || ""), 120);
  // Só o trecho do sumário (do "SUMÁRIO" até o "VEJA TAMBÉM" ou o fim do texto)
  // (procura só no corpo: o <head> e o menu também podem dizer "sumário")
  const ini = corpo.search(/SUM(?:Á|&Aacute;|A)RIO/i);
  let trecho = ini >= 0 ? corpo.slice(ini) : "";
  const fim = trecho.search(/VEJA\s+TAMB|<\/article>|<footer/i);
  if (fim > 0) trecho = trecho.slice(0, fim);
  const lessons = [];
  const titulo = (t) => limit(textOf(t).replace(/^[–—\-\s]+/, ""), 200);
  // lição já publicada: <a href=".../ebd/licao-07-....html">07 – Título</a>
  // (o WordPress troca " - " por &#8211;: o traço pode vir como entidade)
  const TRACO = String.raw`(?:[–—-]|&#821[12];|&#x201[34];|&[nm]dash;)`;
  const LINK = new RegExp(String.raw`<a\s[^>]*href="([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*(\d{1,2})\s*${TRACO}\s*([\s\S]*?)<\/a>`, "gi");
  for (const m of trecho.matchAll(LINK)) {
    const number = Number(m[2]);
    const url = m[1].trim();
    if (number < 1 || number > 20 || !doSite(url) || !/\/ebd\//.test(url) || lessons.some((l) => l.number === number)) continue;
    const title = titulo(m[3]);
    if (title) lessons.push({ number, title, url });
  }
  // lição ainda sem página lá: só o texto "09 – Título"
  for (const linha of linesOf(trecho)) {
    const m = linha.match(/^(\d{1,2})\s*[–—-]\s*(.{2,200})$/);
    if (!m) continue;
    const number = Number(m[1]);
    if (number < 1 || number > 20 || lessons.some((l) => l.number === number)) continue;
    const title = titulo(m[2]);
    if (title) lessons.push({ number, title, url: "" });
  }
  lessons.sort((a, b) => a.number - b.number);
  return { theme, commentator, lessons };
}

/* ---------- Página de uma lição (só referências e data) ---------- */
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DAYS = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
// "Dt 28.1; Rm 10.17", "1 Co 1.10; 12.25-27", "Sl 133.1" — e para no tema que vem depois
const LIVRO = String.raw`(?:[1-3]\s?)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{0,5}\.?`; // "Êx", "1 Co", "2Tm"
const CAP = String.raw`\d{1,3}(?:[.:]\d{1,3}(?:\s?[-–]\s?\d{1,3})?(?:\s?,\s?\d{1,3}(?:\s?[-–]\s?\d{1,3})?)*)?`;
const REFS = new RegExp(String.raw`^(${LIVRO}\s?${CAP}(?:\s?;\s?(?:${LIVRO}\s?)?${CAP})*)`);

export function parseLesson(html) {
  const out = { lesson_date: "", golden_ref: "", reading_ref: "", daily_refs: ["", "", "", "", "", ""] };
  // A lição começa no título "Adultos 4° trimestre 2026" (o resto da página é menu e anúncio)
  const ini = html.search(/trimestre\s+\d{4}(?:\s|&nbsp;)*<\/h2>/i);
  const linhas = linesOf(ini >= 0 ? html.slice(ini) : html);
  for (const l of linhas.slice(0, 15)) {
    const dm = l.match(/(?:^|Data\s*:\s*)(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/i);
    if (!dm) continue;
    const mi = MONTHS.indexOf(plain(dm[2]).toLowerCase());
    if (mi >= 0) out.lesson_date = `${dm[3]}-${String(mi + 1).padStart(2, "0")}-${String(dm[1]).padStart(2, "0")}`;
    break;
  }
  // Seções pelo rótulo em linha própria (Adultos: TEXTO ÁUREO / LEITURA DIÁRIA /
  // LEITURA BÍBLICA EM CLASSE; Jovens: TEXTO PRINCIPAL / LEITURA SEMANAL / TEXTO BÍBLICO)
  const ROTULOS = ["TEXTO AUREO", "TEXTO PRINCIPAL", "VERDADE PRATICA", "RESUMO DA LICAO", "LEITURA DIARIA", "LEITURA SEMANAL", "LEITURA BIBLICA EM CLASSE", "TEXTO BIBLICO", "OBJETIVOS", "INTERACAO", "PLANO DE AULA", "INTRODUCAO"];
  const secoes = {};
  let atual = null;
  for (const l of linhas) {
    const p = plain(l).replace(/[:.]+$/, "").trim();
    if (ROTULOS.includes(p)) {
      atual = secoes[p] ? null : (secoes[p] = []); // só a primeira vez
      continue;
    }
    if (atual && atual.length < 12) atual.push(l);
  }
  const pick = (...nomes) => nomes.map((n) => secoes[n]).find((s) => s && s.length);
  const golden = pick("TEXTO AUREO", "TEXTO PRINCIPAL");
  if (golden) {
    const refs = [...golden.join(" ").matchAll(/\(([^()]{3,80})\)/g)].map((m) => cleanRef(m[1])).filter(Boolean);
    out.golden_ref = refs[refs.length - 1] || "";
  }
  const daily = pick("LEITURA DIARIA", "LEITURA SEMANAL");
  if (daily) {
    for (const l of daily) {
      const dm = l.match(/^([A-Za-zçáÇÁ]+)(?:-feira)?\s*[—–-]\s*(.+)$/);
      if (!dm) continue;
      const di = DAYS.indexOf(plain(dm[1]));
      if (di < 0 || out.daily_refs[di]) continue;
      out.daily_refs[di] = cleanRef(dm[2].match(REFS)?.[1] || "");
    }
  }
  const reading = pick("LEITURA BIBLICA EM CLASSE", "TEXTO BIBLICO");
  if (reading) {
    for (const l of reading) {
      const r = cleanRef(l);
      if (r && /^[1-3]?\s?[A-Za-zÀ-ÿ]/.test(r) && /\d/.test(r) && !/^\d+\s*[-–]/.test(l)) {
        out.reading_ref = r;
        break;
      }
    }
  }
  return out;
}

/* ---------- Datas ---------- */
export function firstSunday(year, quarter) {
  const d = new Date(Date.UTC(year, (quarter - 1) * 3, 1, 12));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}
export const spToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

// Trimestre atual e, perto da virada (até 21 dias antes), também o próximo.
export function quartersToSync(today = spToday()) {
  const year = Number(today.slice(0, 4));
  const quarter = Math.ceil(Number(today.slice(5, 7)) / 3);
  const list = [{ year, quarter }];
  const next = quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 };
  const days = (Date.parse(firstSunday(next.year, next.quarter)) - Date.parse(today)) / 864e5;
  if (days <= 21) list.push(next);
  return list;
}

/* ---------- Banco (Supabase) ---------- */
// Projeto do Supabase das funções de api/: variáveis SUPABASE_URL e SUPABASE_KEY
// (chave PUBLICÁVEL, a mesma do site), para testar com `npx vercel dev` num banco
// de teste. Sem elas, a produção.
export const SUPABASE_URL = (process.env.SUPABASE_URL || "https://rtludbkopxbhiwlwycid.supabase.co").replace(/\/+$/, "");
export const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_eRsl3xo3p7Qe_DanIB4Z7A_5V6Q0p9m"; // chave pública (a mesma do site)

export async function rpc(fn, args, bearer = SUPABASE_KEY) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`${fn}: HTTP ${res.status} ${body.slice(0, 200)}`);
    err.status = res.status;
    err.missing = res.status === 404 || /PGRST202/.test(body);
    throw err;
  }
  return body ? JSON.parse(body) : null;
}

// Configuração salva no painel (settings.data.ebdSync), lida como visitante.
export async function readSyncConfig() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=data&id=eq.main`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    signal: AbortSignal.timeout(8000),
  });
  const rows = res.ok ? await res.json() : [];
  const cfg = rows[0]?.data?.ebdSync || {};
  return {
    enabled: cfg.enabled !== false,
    magazines: (Array.isArray(cfg.magazines) && cfg.magazines.length ? cfg.magazines : ["adultos"]).filter((m) => MAGAZINES[m]),
    autoPublish: cfg.autoPublish === true,
  };
}

/* ---------- Sincronização de um trimestre ----------
   Busca o sumário, pergunta ao banco quais lições ainda estão sem
   referências, baixa só essas (até maxLessons por chamada) e grava
   pela função ebd_sync_apply — que só preenche campos vazios e nunca
   apaga nem sobrescreve o que a equipe escreveu.
   "after" é um cursor: começa pelas lições de número maior que ele (e dá a
   volta). Sem isso, uma lição cuja página nunca traz as três referências
   ficaria sempre entre as primeiras da lista e travaria as seguintes.
   Devolve "next" (a última baixada, para passar como "after" na próxima
   chamada) e "remaining" (quantas faltam nesta volta, depois do cursor). */
export async function syncQuarter({ year, quarter, slug, token, autoPublish = false, maxLessons = 3, pauseMs = 700, after = 0, log = () => {} }) {
  const mag = MAGAZINES[slug];
  if (!mag) throw new Error("revista desconhecida");
  const qUrl = await quarterUrl(slug, year, quarter);
  if (!qUrl) return { year, quarter, slug, skipped: "revista do trimestre ainda não publicada no escola-ebd" };
  const html = await getPage(qUrl);
  if (!html) return { year, quarter, slug, skipped: "sumário ainda não publicado" };
  const info = parseQuarter(html);
  if (!info.lessons.length) return { year, quarter, slug, skipped: "sumário sem lições" };

  const needs = (await rpc("ebd_sync_needs", { p_token: token, p_year: year, p_quarter: quarter, p_slug: slug })) || [];
  const wanted = info.lessons.filter((l) => l.url && needs.includes(l.number));
  const depois = wanted.filter((l) => l.number > after);
  const lote = [...depois, ...wanted.filter((l) => l.number <= after)].slice(0, maxLessons);
  const details = {};
  for (const l of lote) {
    await sleep(pauseMs);
    try {
      const lh = await getPage(l.url);
      if (lh) details[l.number] = parseLesson(lh);
      log(`lição ${l.number}: ${JSON.stringify(details[l.number])}`);
    } catch (e) {
      log(`lição ${l.number}: ${e.message}`);
    }
  }
  const lesson1 = details[1]?.lesson_date;
  const payload = {
    year,
    quarter,
    magazine: mag.name,
    magazine_slug: slug,
    theme: info.theme,
    commentator: info.commentator,
    publisher: "CPAD",
    source_url: qUrl,
    start_date: lesson1 || firstSunday(year, quarter),
    lesson_count: Math.max(13, ...info.lessons.map((l) => l.number)),
    auto_publish: !!autoPublish,
    lessons: info.lessons.map((l) => ({ number: l.number, title: l.title, source_url: l.url, ...(details[l.number] || {}) })),
  };
  const result = await rpc("ebd_sync_apply", { p_token: token, p_data: payload });
  const next = lote.length ? lote[lote.length - 1].number : after;
  const remaining = lote.length && lote[lote.length - 1].number > after ? depois.filter((l) => l.number > next).length : 0;
  return { year, quarter, slug, ...result, fetched: lote.length, next, remaining };
}
