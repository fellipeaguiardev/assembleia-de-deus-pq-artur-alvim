// ============================================================
// Biblioteca — leitura da planilha do Google (link público, só leitura)
// ------------------------------------------------------------
// Abas:  a versão de visualização (htmlview) lista o nome e o número
//        (gid) de cada aba; aba nova vira categoria nova sozinha.
// Dados: exportação CSV de cada aba (inclui a coluna do dono, que a
//        versão de visualização esconde).
// Capas: a versão de visualização de cada aba traz a imagem colada na
//        coluna "Capa". As duas versões seguem a ordem das linhas e são
//        pareadas conferindo o título.
// O Google entrega a imagem já reduzida (JPEG ~300x470, ~25 KB).
// ============================================================
const GDOCS = "https://docs.google.com/spreadsheets/d/";
const UA = "AD-Belem-Biblioteca/1.0 (+https://assembleia-de-deus-pq-artur-alvim.vercel.app)";

// Abas que já existiam (gid → nome da categoria no site).
const KNOWN_TABS = {
  954202693: "Teologia Sistemática",
  1591574927: "Teologia Bíblica",
  33228892: "Teologia Exegética",
  1063897307: "Teologia Prática",
  1710770784: "Teologia Histórica",
  298780643: "História Geral",
  1307237096: "Literatura e Ficção",
  638676174: "Filosofia",
  1020164895: "Literatura de Autoajuda",
};

async function get(url, as = "text") {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    // O endereço tem o id da planilha (que dá acesso aos nomes): vai só para o
    // registro interno, nunca para a mensagem mostrada a quem usa o site.
    const err = new Error(`HTTP ${res.status}`);
    err.url = url.split("?")[0];
    err.status = res.status;
    throw err;
  }
  return as === "bytes" ? { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "" } : res.text();
}

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const same = (a, b) => String(a).replace(/\s+/g, " ").trim() === String(b).replace(/\s+/g, " ").trim();

// CSV (com aspas e quebras de linha dentro das células).
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Tabela da versão de visualização: [[{ text, img }]] (colspan expandido).
export function parseHtmlTable(html) {
  const rows = [];
  for (const tr of html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) || []) {
    const row = [];
    for (const m of tr.matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      const span = Number(/colspan="?(\d+)/i.exec(m[2])?.[1] || 1);
      const img = /<img[^>]+src="([^"]+)"/i.exec(m[3])?.[1] || "";
      const text = decodeEntities(m[3].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();
      row.push({ text, img: decodeEntities(img) });
      for (let k = 1; k < span; k++) row.push({ text: "", img: "" });
    }
    rows.push(row);
  }
  return rows;
}

// Abas da planilha: [{ gid, name }].
export async function listTabs(sheetId) {
  const html = await get(`${GDOCS}${sheetId}/htmlview`);
  const tabs = [];
  for (const m of html.matchAll(/\{name: "((?:[^"\\]|\\.)*)", ?pageUrl: "[^"]*?gid=(\d+)/g)) {
    const name = m[1].replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, "$1");
    if (!tabs.some((t) => t.gid === m[2])) tabs.push({ gid: m[2], name });
  }
  if (!tabs.length) throw new Error("não achei as abas da planilha (ela está compartilhada como “qualquer pessoa com o link”?)");
  return tabs;
}

const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase())
    .replace(/\s(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
const expandTab = (name) => name.replace(/^Teo\.\s*/i, "Teologia ").replace(/^Lit\.\s*/i, "Literatura ").trim();

async function readTab(sheetId, tab, warnings) {
  const [csvText, html] = await Promise.all([get(`${GDOCS}${sheetId}/gviz/tq?tqx=out:csv&gid=${tab.gid}`), get(`${GDOCS}${sheetId}/htmlview/sheet?headers=true&gid=${tab.gid}`).catch(() => "")]);
  const [head = [], ...data] = parseCSV(csvText);
  const col = (name) => head.findIndex((h) => same(h.toLowerCase(), name.toLowerCase()));
  const c = { t: col("Título"), a: col("Autor"), s: col("Sinopse"), o: col("Proprietário do Livro"), cat: col("Categoria") };
  if (c.t < 0) return []; // aba sem livros (ex.: Regras de Empréstimo)
  const get_ = (r, i) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  const rows = data
    .filter((r) => get_(r, c.t))
    .map((r) => ({
      title: get_(r, c.t),
      author: get_(r, c.a),
      synopsis: get_(r, c.s),
      owner: get_(r, c.o),
      category: KNOWN_TABS[tab.gid] || titleCase(get_(r, c.cat)) || expandTab(tab.name),
      img: "",
      tab: tab.name,
    }));
  // Capas: pareia as linhas da versão de visualização com as do CSV.
  const table = parseHtmlTable(html);
  const hi = table.findIndex((r) => r.some((x) => x.text === "Título"));
  if (hi < 0) {
    if (rows.length) warnings.push(`${tab.name}: não consegui ler as capas`);
    return rows;
  }
  const vt = table[hi].findIndex((x) => x.text === "Título");
  const vc = table[hi].findIndex((x) => x.text === "Capa");
  const visual = table.slice(hi + 1).filter((r) => (r[vt]?.text || "").trim());
  if (vc < 0) return rows;
  if (visual.length === rows.length && visual.every((r, i) => same(r[vt].text, rows[i].title))) {
    rows.forEach((row, i) => (row.img = visual[i][vc]?.img || ""));
  } else {
    // Ordem diferente (raro): casa pelo título.
    warnings.push(`${tab.name}: linhas fora de ordem, capas casadas pelo título`);
    const byTitle = new Map();
    visual.forEach((r) => {
      const k = r[vt].text.replace(/\s+/g, " ").trim().toLowerCase();
      byTitle.set(k, [...(byTitle.get(k) || []), r[vc]?.img || ""]);
    });
    rows.forEach((row) => (row.img = byTitle.get(row.title.replace(/\s+/g, " ").trim().toLowerCase())?.shift() || ""));
  }
  return rows;
}

// Lê a planilha inteira: { tabs, rows: [{ title, author, synopsis, owner, category, img, tab }], warnings }.
export async function readSheet(sheetId) {
  const tabs = await listTabs(sheetId);
  const warnings = [];
  const rows = [];
  // Três abas por vez, para ser educado com o Google e caber no tempo da função.
  for (let i = 0; i < tabs.length; i += 3) {
    const parts = await Promise.all(tabs.slice(i, i + 3).map((t) => readTab(sheetId, t, warnings)));
    parts.forEach((p) => rows.push(...p));
  }
  return { tabs: tabs.map((t) => t.name), rows, warnings };
}

// Baixa a capa colada na planilha, já reduzida pelo Google (JPEG ~300x470).
export async function downloadCover(imgUrl) {
  if (!/^https:\/\/docs\.google\.com\/sheets-images-rt\/[\w-]+/.test(imgUrl)) throw new Error("endereço de capa inesperado");
  const url = imgUrl.replace(/=[^=/]*$/, "") + "=w300-h500";
  const { bytes, type } = await get(url, "bytes");
  const mime = type.split(";")[0].trim();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error(`tipo ${mime}`);
  if (bytes.length < 100 || bytes.length > 600000) throw new Error(`tamanho ${bytes.length}`);
  return { mime, base64: bytes.toString("base64") };
}

/* ---------- Capa na internet (quando a planilha não tem) ---------- */
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const shortTitle = (t) => t.split(/[:–—]| - /)[0].trim();
const lastName = (a) => norm(String(a || "").split(/,| e | & |\//)[0]).split(" ").filter((w) => w.length > 2).pop() || "";

// Só aceita quando título E autor batem: capa errada é pior que a capa desenhada do site.
function matches(title, author, candTitle, candAuthors) {
  const want = norm(shortTitle(title));
  const got = norm(candTitle);
  const last = lastName(author);
  const titleOk = want.length >= 3 && (got.startsWith(want) || want.startsWith(got)) && Math.min(got.length, want.length) >= Math.min(8, want.length);
  const authorOk = !last || (candAuthors || []).some((a) => norm(a).includes(last));
  return titleOk && authorOk;
}

export async function findCoverOnline(title, author, googleKey = "") {
  const t = shortTitle(title);
  if (googleKey) {
    try {
      const q = `intitle:${t}${lastName(author) ? ` inauthor:${lastName(author)}` : ""}`;
      const data = JSON.parse(await get(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, maxResults: "5", printType: "books", key: googleKey })}`));
      for (const it of data.items || []) {
        const v = it.volumeInfo || {};
        if (v.imageLinks?.thumbnail && /^[A-Za-z0-9_-]+$/.test(it.id) && matches(title, author, v.title, v.authors)) {
          return `https://books.google.com/books/content?id=${it.id}&printsec=frontcover&img=1&zoom=1`;
        }
      }
    } catch (e) {
      console.warn("Google Books:", e.message);
    }
  }
  try {
    const params = new URLSearchParams({ title: t, limit: "5", fields: "cover_i,title,author_name" });
    if (lastName(author)) params.set("author", String(author).split(/,| e | & /)[0].trim());
    const data = JSON.parse(await get(`https://openlibrary.org/search.json?${params}`));
    const hit = (data.docs || []).find((d) => d.cover_i && matches(title, author, d.title, d.author_name));
    if (hit) return `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`;
  } catch (e) {
    console.warn("Open Library:", e.message);
  }
  return "";
}
