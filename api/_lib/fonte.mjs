// ============================================================
// EBD — leitura do sumário das Lições Bíblicas (CPAD) publicado em
// estudantesdabiblia.com.br (robots.txt permite o acesso).
// ------------------------------------------------------------
// O que é aproveitado (só fatos, nunca o texto da lição):
//   trimestre: tema, comentarista, título de cada lição e o link dela
//   lição publicada lá: data, referência do texto áureo, da leitura
//   bíblica em classe e da leitura diária (segunda a sábado)
// O texto bíblico vem da Bíblia Livre no próprio site; comentários,
// "verdade prática", questionários etc. NÃO são copiados.
//
// Educado com o site de origem: identifica-se no User-Agent, faz uma
// requisição por vez, com pausa, só busca a página de uma lição quando
// ainda faltam dados dela no banco e nunca segue para outros domínios.
// ============================================================

export const SOURCE_HOST = "https://www.estudantesdabiblia.com.br";
const UA = "AD-Belem-Pq-Artur-Alvim-EBD/1.0 (+https://assembleia-de-deus-pq-artur-alvim.vercel.app; fellipe.aguiar1058@gmail.com)";
const MAX_BYTES = 600_000;

export const MAGAZINES = {
  adultos: { name: "Adultos", quarterUrl: (y, q) => `${SOURCE_HOST}/cpad_sumario_${y}_${q}t.htm` },
  jovens: { name: "Jovens", quarterUrl: (y, q) => `${SOURCE_HOST}/cpad-sumario-jovens-${y}-${q}t.htm` },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Baixa uma página do site de origem (e só dele). 404 → null.
export async function getPage(url) {
  if (!String(url).startsWith(SOURCE_HOST + "/")) throw new Error("endereço fora do site de origem");
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
  if (!res.url.startsWith(SOURCE_HOST + "/")) throw new Error("redirecionou para fora do site de origem");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("página grande demais");
  const head = new TextDecoder("latin1").decode(buf.slice(0, 2048));
  const utf8 = /charset=["']?utf-8/i.test(res.headers.get("content-type") || "") || /<meta[^>]+charset=["']?utf-8/i.test(head);
  return new TextDecoder(utf8 ? "utf-8" : "windows-1252").decode(buf);
}

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
const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const limit = (s, n) => (s.length > n ? s.slice(0, n).trim() : s);

// Só caracteres de referência bíblica ("Js 1.8; 2Tm 3.16", "Mt 4.4,7,10").
export function cleanRef(s) {
  const r = String(s || "")
    .replace(/[()]/g, " ")
    .replace(/[^0-9A-Za-zÀ-ÿ\s.,;:–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.;,:–-]+$/, "");
  return /\d/.test(r) && r.length <= 120 ? r : "";
}

/* ---------- Página do trimestre ---------- */
export function parseQuarter(html, pageUrl) {
  const c = html.slice(Math.max(0, html.indexOf('id="contents"')));
  const field = (label) => {
    const m = c.match(new RegExp(`<strong>\\s*${label}\\s*:?\\s*</strong>([\\s\\S]*?)</p>`, "i"));
    return m ? limit(textOf(m[1]).replace(/^:\s*/, ""), 300) : "";
  };
  const lessons = [];
  const re = /<strong>\s*Li(?:ç|&ccedil;|c)(?:ã|&atilde;|a)o\s+(\d{1,2})\s*:\s*<\/strong>([\s\S]*?)<\/p>/gi;
  for (const m of c.matchAll(re)) {
    const number = Number(m[1]);
    if (number < 1 || number > 20 || lessons.some((l) => l.number === number)) continue;
    const chunk = stripComments(m[2]); // lição ainda não publicada lá fica com o link comentado
    const link = chunk.match(/<a\s[^>]*href="([^"]+)"/i)?.[1];
    let url = "";
    if (link) {
      try {
        const abs = new URL(link, pageUrl).href;
        if (abs.startsWith(SOURCE_HOST + "/")) url = abs;
      } catch {}
    }
    const title = limit(textOf(chunk), 200);
    if (title) lessons.push({ number, title, url });
  }
  return { theme: field("T(?:í|&iacute;|i)tulo"), commentator: limit(field("Comentarista"), 120), lessons };
}

/* ---------- Página de uma lição (só referências e data) ---------- */
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DAYS = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];

export function parseLesson(html) {
  const out = { lesson_date: "", golden_ref: "", reading_ref: "", daily_refs: ["", "", "", "", "", ""] };
  const dm = textOf(html.match(/<strong>\s*Data\s*:?\s*<\/strong>([\s\S]{0,200}?)<\/p>/i)?.[1] || "").match(/(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/);
  if (dm) {
    const mi = MONTHS.indexOf(plain(dm[2]).toLowerCase());
    if (mi >= 0) out.lesson_date = `${dm[3]}-${String(mi + 1).padStart(2, "0")}-${String(dm[1]).padStart(2, "0")}`;
  }
  // Seções separadas pelos títulos <h6> (TEXTO ÁUREO, LEITURA DIÁRIA…)
  const sections = {};
  const parts = html.split(/<h6[^>]*>/i);
  for (const p of parts.slice(1)) {
    const end = p.search(/<\/h6>/i);
    if (end < 0) continue;
    sections[plain(textOf(p.slice(0, end)))] = p.slice(end + 5);
  }
  // Adultos usa TEXTO ÁUREO / LEITURA DIÁRIA / LEITURA BÍBLICA EM CLASSE;
  // Jovens usa TEXTO PRINCIPAL / LEITURA SEMANAL / TEXTO BÍBLICO.
  const pick = (...names) => names.map((n) => sections[n]).find(Boolean);
  const golden = pick("TEXTO AUREO", "TEXTO PRINCIPAL");
  if (golden) {
    const refs = [...textOf(golden).matchAll(/\(([^()]{3,80})\)/g)].map((m) => cleanRef(m[1])).filter(Boolean);
    out.golden_ref = refs[refs.length - 1] || "";
  }
  const daily = pick("LEITURA DIARIA", "LEITURA SEMANAL");
  if (daily) {
    for (const m of daily.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const t = textOf(m[1]);
      const dmm = t.match(/^([A-Za-zçáÇÁ]+)(?:-feira)?\s*[—–-]\s*(.+)$/);
      if (!dmm) continue;
      const di = DAYS.indexOf(plain(dmm[1]));
      if (di >= 0 && !out.daily_refs[di]) out.daily_refs[di] = cleanRef(dmm[2]);
    }
  }
  const reading = pick("LEITURA BIBLICA EM CLASSE", "TEXTO BIBLICO");
  if (reading) {
    for (const m of reading.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const r = cleanRef(textOf(m[1]));
      if (r && /[A-Za-zÀ-ÿ]/.test(r)) {
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
export const SUPABASE_URL = "https://rtludbkopxbhiwlwycid.supabase.co";
export const SUPABASE_KEY = "sb_publishable_eRsl3xo3p7Qe_DanIB4Z7A_5V6Q0p9m"; // chave pública (a mesma do site)

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
   apaga nem sobrescreve o que a equipe escreveu. */
export async function syncQuarter({ year, quarter, slug, token, autoPublish = false, maxLessons = 3, pauseMs = 700, log = () => {} }) {
  const mag = MAGAZINES[slug];
  if (!mag) throw new Error("revista desconhecida");
  const qUrl = mag.quarterUrl(year, quarter);
  const html = await getPage(qUrl);
  if (!html) return { year, quarter, slug, skipped: "sumário ainda não publicado" };
  const info = parseQuarter(html, qUrl);
  if (!info.lessons.length) return { year, quarter, slug, skipped: "sumário sem lições" };

  const needs = (await rpc("ebd_sync_needs", { p_token: token, p_year: year, p_quarter: quarter, p_slug: slug })) || [];
  const wanted = info.lessons.filter((l) => l.url && needs.includes(l.number));
  const details = {};
  for (const l of wanted.slice(0, maxLessons)) {
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
  const fetched = Math.min(wanted.length, maxLessons);
  return { year, quarter, slug, ...result, fetched, remaining: Math.max(0, wanted.length - fetched) };
}
