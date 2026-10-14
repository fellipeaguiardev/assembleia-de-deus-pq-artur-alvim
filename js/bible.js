/* ============================================================
   BÍBLIA — leitor integrado (Bíblia Livre, CC BY 4.0 Brasil)
   ------------------------------------------------------------
   O texto fica em /data/bible/blivre/<LIVRO>.json (um arquivo por
   livro, gerado a partir do eBible.org, sem alterações no texto).
   Endereços:
     /biblia                      biblioteca de livros
     /biblia/joao                 capítulos de João
     /biblia/joao/3               leitura de João 3
     /biblia/joao/3/16-18         leitura com os versículos destacados
   ============================================================ */

const BIBLE_TRANSLATIONS = {
  blivre: { name: "Bíblia Livre", short: "BLIVRE", base: "/data/bible/blivre" },
};
const BIBLE = { id: "blivre", index: null, bySlug: new Map(), byCode: new Map(), aliases: new Map(), files: new Map() };

/* ---------- Outras versões ----------
   ARC, ARA, NVI, NTLH, BKJ… têm direitos autorais das editoras (SBB,
   Biblica, BV Books, Abba Press…). O site não copia esses textos: abre a
   mesma passagem no Bíblia Online, que publica essas versões com
   autorização. Aqui dentro a leitura continua na Bíblia Livre (CC BY). */
const BIBLE_OTHER_VERSIONS = [
  ["arc", "ARC", "Almeida Revista e Corrigida"],
  ["ara", "ARA", "Almeida Revista e Atualizada"],
  ["nvi", "NVI", "Nova Versão Internacional"],
  ["ntlh", "NTLH", "Nova Tradução na Linguagem de Hoje"],
  ["bkj", "BKJ", "Bíblia King James Fiel 1611"],
  ["naa", "NAA", "Nova Almeida Atualizada"],
  ["nvt", "NVT", "Nova Versão Transformadora"],
  ["acf", "ACF", "Almeida Corrigida Fiel"],
  ["kja", "KJA", "King James Atualizada"],
];
// Endereço de cada livro no Bíblia Online, na ordem dos 66 livros.
const BIBLIA_ONLINE_BOOKS = "gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jó sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc jo atos rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap".split(" ");

function otherVersionUrl(v, book, chapter, verses = "") {
  const first = String(verses).split(",")[0]; // "16-18,20" → "16-18"
  return `https://www.bibliaonline.com.br/${v}/${encodeURIComponent(BIBLIA_ONLINE_BOOKS[book.order])}/${chapter}${first ? "/" + first : ""}`;
}

function rememberBibleVersion(v) {
  saveBiblePrefs({ ...biblePrefs(), ver: v });
}

// fromSelection: usa os versículos marcados; senão, o capítulo (ou o trecho do endereço).
function openBibleVersions(fromSelection = false) {
  const root = document.getElementById("bibleRoot");
  const book = BIBLE.byCode.get(root?.dataset.book);
  if (!book) return;
  const chapter = Number(root.dataset.chapter);
  const spec = fromSelection ? compactVerseList(selectedVerses().map((s) => s.n)) : root.dataset.verses || "";
  const label = `${book.name} ${chapter}${spec ? ":" + spec : ""}`;
  const last = biblePrefs().ver;
  const list = [...BIBLE_OTHER_VERSIONS].sort((a, b) => (b[0] === last) - (a[0] === last));
  openModal(
    `<div class="modal-pad bible-versions">
      <span class="eyebrow">Ler em outra versão</span>
      <h2>${esc(label)}</h2>
      <p class="bible-versions-lead">Escolha a versão. A passagem abre no site <strong>Bíblia Online</strong>, que publica estas traduções com autorização das editoras.</p>
      <div class="bible-versions-list">
        ${list
          .map(
            ([id, abbr, name]) =>
              `<a class="bible-version" href="${esc(otherVersionUrl(id, book, chapter, spec))}" target="_blank" rel="noopener" onclick="rememberBibleVersion('${id}')"><b>${abbr}</b><span>${esc(name)}${id === last ? "<small>Última que você usou</small>" : ""}</span>${icon("external", 15)}</a>`,
          )
          .join("")}
      </div>
      <p class="bible-versions-note">Aqui no site o texto é o da Bíblia Livre, de licença livre. As outras versões têm direitos autorais das editoras e, por isso, não são copiadas para cá.</p>
    </div>`,
    { label: "Ler em outra versão" },
  );
}
const BIBLE_PREFS_KEY = "bible-prefs";
const BIBLE_LAST_KEY = "bible-last";
const BIBLE_SIZES = [16, 17.5, 19, 21, 23, 26];

const bibleBase = () => BIBLE_TRANSLATIONS[BIBLE.id].base;
const plainKey = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s.]/g, "");

let bibleIndexPromise = null;

function bibleIndex() {
  if (BIBLE.index) return Promise.resolve(BIBLE.index);
  bibleIndexPromise ||= fetch(`${bibleBase()}/index.json`)
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((idx) => {
      BIBLE.index = idx;
      idx.books.forEach((b, i) => {
        b.order = i;
        BIBLE.bySlug.set(b.slug, b);
        BIBLE.byCode.set(b.code, b);
        [b.slug, b.name, b.abbr, b.code].forEach((k) => BIBLE.aliases.set(plainKey(k), b));
      });
      // Apelidos comuns. "Jo" é João; Jó só com acento ("Jó") ou "job".
      const extra = { salmo: "PSA", sal: "PSA", cantares: "SOL", canticosdoscanticos: "SOL", cantico: "SOL", job: "JOB", atosdosapostolos: "ACT", apoc: "REV", fil: "PHI", filip: "PHI", fl: "PHI", jud: "JUD", rom: "ROM", mr: "MAR", "1pd": "1PE", "2pd": "2PE", ex: "EXO" };
      Object.entries(extra).forEach(([k, code]) => BIBLE.aliases.set(k, BIBLE.byCode.get(code)));
      BIBLE.aliases.set("jo", BIBLE.byCode.get("JOH"));
      return idx;
    })
    .catch((e) => {
      bibleIndexPromise = null;
      throw e;
    });
  return bibleIndexPromise;
}

function bibleBook(code) {
  if (!BIBLE.files.has(code)) {
    const p = fetch(`${bibleBase()}/${code}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch((e) => {
        BIBLE.files.delete(code);
        throw e;
      });
    BIBLE.files.set(code, p);
  }
  return BIBLE.files.get(code);
}

function findBook(name) {
  const raw = String(name ?? "").trim().toLowerCase().replace(/[\s.]/g, "");
  if (raw === "jó") return BIBLE.byCode.get("JOB");
  return BIBLE.aliases.get(plainKey(name)) || null;
}

/* ---------- Referências: "João 3:16-18", "1 Jo 4.8", "Sl 23" ---------- */
// Só funciona depois de bibleIndex() carregar. Retorna null se não reconhecer.
function parseBibleRef(text) {
  const m = String(text ?? "")
    .trim()
    .match(/^((?:[1-3]\s*)?[^\d:.,]+?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  if (!chapter || chapter > book.chapters) return null;
  const from = m[3] ? Number(m[3]) : null;
  const to = m[4] ? Number(m[4]) : null;
  if (from && to && to < from) return null;
  return { book, chapter, from, to: to || from };
}

function bibleRefLabel(ref) {
  if (!ref) return "";
  const v = ref.from ? `:${ref.from}${ref.to && ref.to !== ref.from ? "-" + ref.to : ""}` : "";
  return `${ref.book.name} ${ref.chapter}${v}`;
}

function bibleRefPath(ref) {
  if (!ref) return "/biblia";
  const v = ref.from ? `/${ref.from}${ref.to && ref.to !== ref.from ? "-" + ref.to : ""}` : "";
  return `/biblia/${ref.book.slug}/${ref.chapter}${v}`;
}

/* ---------- Preferências e "onde parei" (só neste navegador) ---------- */
function biblePrefs() {
  try {
    return { size: 2, theme: "claro", ...JSON.parse(localStorage.getItem(BIBLE_PREFS_KEY) || "{}") };
  } catch {
    return { size: 2, theme: "claro" };
  }
}

function saveBiblePrefs(p) {
  try {
    localStorage.setItem(BIBLE_PREFS_KEY, JSON.stringify(p));
  } catch {}
}

function bibleLastRead() {
  try {
    const l = JSON.parse(localStorage.getItem(BIBLE_LAST_KEY) || "null");
    return l && l.slug && l.chapter ? l : null;
  } catch {
    return null;
  }
}

/* ============================================================
   PÁGINAS
   ============================================================ */
// A página é montada em duas etapas: primeiro o "esqueleto" (sincrono, para o
// roteador), depois o conteúdo, quando o arquivo do livro chega.
function biblePageHTML(param) {
  return `<section class="bible-page" id="bibleRoot" aria-live="polite">
    <div class="container bible-loading">
      <div class="bible-skel bible-skel-title"></div>
      <div class="bible-skel"></div><div class="bible-skel"></div><div class="bible-skel short"></div>
    </div>
  </section>`;
}

let bibleViewToken = 0;

async function initBibleView(param) {
  const token = ++bibleViewToken;
  const root = document.getElementById("bibleRoot");
  if (!root) return;
  const [slug, chapterStr, verses] = String(param || "").split("/");
  try {
    await bibleIndex();
    if (token !== bibleViewToken) return; // usuário já navegou para outra página
    if (!slug) return renderBibleLibrary(root);
    const book = BIBLE.bySlug.get(slug) || findBook(slug);
    if (!book) return renderBibleNotFound(root);
    if (book.slug !== slug) return navigateTo(`/biblia/${book.slug}${chapterStr ? "/" + chapterStr : ""}${verses ? "/" + verses : ""}`, { replace: true });
    if (!chapterStr) return renderBibleBook(root, book);
    const chapter = Number(chapterStr);
    if (!chapter || chapter > book.chapters) return renderBibleNotFound(root, book);
    const data = await bibleBook(book.code);
    if (token !== bibleViewToken) return;
    renderBibleChapter(root, book, chapter, data.chapters[chapter - 1] || [], verses);
  } catch (e) {
    console.error("Bíblia:", e);
    if (token !== bibleViewToken) return;
    root.innerHTML = `<div class="container">${emptyState(
      "book",
      "Não foi possível abrir a Bíblia agora",
      navigator.onLine ? "Tente novamente em instantes." : "Você está sem internet. Os capítulos que você já leu continuam disponíveis.",
      `<button class="btn btn-primary btn-sm" type="button" onclick="initBibleView(routeParam(currentRoute()))">Tentar de novo</button>`,
    )}</div>`;
  }
}

function bibleCreditHTML() {
  const idx = BIBLE.index;
  return `<p class="bible-credit">Texto bíblico: <strong>${esc(idx?.name || "Bíblia Livre")}</strong> (${esc(idx?.short || "BLIVRE")}),
    © 2018 Diego Santos, Mario Sérgio e Marco Teles, atualizada a partir da tradução de 1819 de João Ferreira de Almeida.
    Uso livre pela <a href="https://creativecommons.org/licenses/by/4.0/deed.pt-br" target="_blank" rel="noopener">licença CC BY 4.0</a> ·
    <a href="${esc(idx?.source || "https://ebible.org/porbr2018/")}" target="_blank" rel="noopener">fonte</a>.</p>`;
}

function bibleSearchHTML() {
  return `<form class="bible-search" role="search" onsubmit="bibleSearch(event)">
    ${icon("search", 18)}
    <label class="sr-only" for="bibleSearchInput">Buscar livro ou referência</label>
    <input id="bibleSearchInput" type="search" autocomplete="off" placeholder="Livro ou referência — ex.: João 3:16, Sl 23" oninput="filterBibleBooks(this.value)">
    <button class="btn btn-primary btn-sm" type="submit">Abrir</button>
  </form>
  <p class="bible-search-error" id="bibleSearchError" role="alert" hidden></p>`;
}

function renderBibleLibrary(root) {
  setMeta("Bíblia", ROUTE_META.biblia[1], "/biblia");
  const last = bibleLastRead();
  const books = BIBLE.index.books;
  const group = (t, title) => `
    <section class="bible-testament" data-testament="${t}">
      <h2>${title}</h2>
      <div class="bible-books" data-stagger>
        ${books
          .filter((b) => b.testament === t)
          .map((b) => `<a class="bible-book" href="/biblia/${b.slug}" data-key="${esc(plainKey(b.name) + " " + plainKey(b.abbr))}"><strong>${esc(b.name)}</strong><span>${b.chapters} ${b.chapters === 1 ? "capítulo" : "capítulos"}</span></a>`)
          .join("")}
      </div>
    </section>`;
  root.innerHTML = `
    <div class="bible-hero">
      <div class="container">
        <span class="eyebrow">Palavra de Deus</span>
        <h1>Bíblia Sagrada</h1>
        <p class="lead">Leia a Bíblia completa, de graça, com leitura confortável no celular. Em cada capítulo, toque em “Outras versões” para abrir a mesma passagem na ARC, ARA, NVI, NTLH, BKJ e outras.</p>
        ${bibleSearchHTML()}
        ${
          last
            ? `<a class="bible-continue" href="/biblia/${esc(last.slug)}/${Number(last.chapter)}">${icon("book", 18)}<span>Continuar de onde parei<strong>${esc(last.name)} ${Number(last.chapter)}</strong></span>${icon("arrow", 16)}</a>`
            : ""
        }
      </div>
    </div>
    <div class="container bible-library">
      ${group("AT", "Antigo Testamento")}
      ${group("NT", "Novo Testamento")}
      <p class="bible-empty-filter" id="bibleNoBooks" hidden>Nenhum livro com esse nome. Para abrir uma passagem, digite a referência e toque em “Abrir”.</p>
      ${bibleCreditHTML()}
    </div>`;
  initReveal(root);
  settleTop();
}

function filterBibleBooks(value) {
  const q = plainKey(value).replace(/\d+[:.,]?\d*.*$/, "");
  let shown = 0;
  document.querySelectorAll(".bible-book").forEach((a) => {
    const on = !q || a.dataset.key.includes(q);
    a.hidden = !on;
    if (on) shown++;
  });
  document.querySelectorAll(".bible-testament").forEach((sec) => {
    sec.hidden = ![...sec.querySelectorAll(".bible-book")].some((a) => !a.hidden);
  });
  const none = document.getElementById("bibleNoBooks");
  if (none) none.hidden = shown > 0;
}

function bibleSearch(e) {
  e.preventDefault();
  const input = document.getElementById("bibleSearchInput");
  const err = document.getElementById("bibleSearchError");
  const value = input.value.trim();
  if (!value) return input.focus();
  const ref = parseBibleRef(value);
  if (ref) return navigateTo(bibleRefPath(ref));
  const book = findBook(value);
  if (book) return navigateTo(`/biblia/${book.slug}`);
  err.textContent = `Não encontrei “${value}”. Tente, por exemplo: João 3:16, Salmos 23 ou Rm 8.`;
  err.hidden = false;
}

function renderBibleBook(root, book) {
  setMeta(book.name, `Leia o livro de ${book.name} na Bíblia (${book.chapters} capítulos).`, `/biblia/${book.slug}`);
  root.innerHTML = `
    <div class="container bible-book-page">
      <a class="back-link" href="/biblia">${icon("arrowBack", 16)} Todos os livros</a>
      <header class="bible-book-head" data-reveal>
        <span class="eyebrow">${book.testament === "AT" ? "Antigo Testamento" : "Novo Testamento"}</span>
        <h1>${esc(book.name)}</h1>
        <p>${book.chapters} ${book.chapters === 1 ? "capítulo" : "capítulos"}. Escolha um para começar a leitura.</p>
      </header>
      <nav class="bible-chapters" aria-label="Capítulos de ${esc(book.name)}" data-stagger>
        ${Array.from({ length: book.chapters }, (_, i) => `<a href="/biblia/${book.slug}/${i + 1}">${i + 1}</a>`).join("")}
      </nav>
      ${bibleCreditHTML()}
    </div>`;
  initReveal(root);
  settleTop();
}

function renderBibleNotFound(root, book) {
  setMeta("Passagem não encontrada", ROUTE_META.biblia[1], location.pathname, { noindex: true });
  root.innerHTML = `<div class="container">${emptyState(
    "book",
    "Passagem não encontrada",
    book ? `${book.name} tem ${book.chapters} capítulos.` : "Confira o nome do livro e tente de novo.",
    `<a class="btn btn-primary btn-sm" href="${book ? `/biblia/${book.slug}` : "/biblia"}">${book ? `Ver capítulos de ${esc(book.name)}` : "Ver todos os livros"}</a>`,
  )}</div>`;
}

// Converte "16-18" ou "16" em um conjunto de números de versículo.
function parseVerseSpec(spec, max) {
  const out = new Set();
  String(spec || "")
    .split(",")
    .forEach((part) => {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      if (!a) return;
      for (let v = a; v <= Math.min(b || a, max); v++) out.add(v);
    });
  return out;
}

function neighborChapter(book, chapter, dir) {
  const books = BIBLE.index.books;
  if (dir < 0) {
    if (chapter > 1) return { book, chapter: chapter - 1 };
    const prev = books[book.order - 1];
    return prev ? { book: prev, chapter: prev.chapters } : null;
  }
  if (chapter < book.chapters) return { book, chapter: chapter + 1 };
  const next = books[book.order + 1];
  return next ? { book: next, chapter: 1 } : null;
}

function renderBibleChapter(root, book, chapter, verses, verseSpec) {
  const prefs = biblePrefs();
  const highlight = parseVerseSpec(verseSpec, verses.length);
  const prev = neighborChapter(book, chapter, -1);
  const next = neighborChapter(book, chapter, 1);
  const first = [...highlight][0];
  setMeta(
    `${book.name} ${chapter}${first ? ":" + verseSpec : ""}`,
    truncate(verses[(first || 1) - 1] || "", 155),
    `/biblia/${book.slug}/${chapter}${verseSpec ? "/" + verseSpec : ""}`,
  );
  try {
    localStorage.setItem(BIBLE_LAST_KEY, JSON.stringify({ slug: book.slug, name: book.name, chapter, at: new Date().toISOString() }));
  } catch {}

  const navLink = (n, dir) =>
    n
      ? `<a class="bible-nav-link ${dir}" href="/biblia/${n.book.slug}/${n.chapter}">${dir === "prev" ? icon("left", 18) : ""}<span><small>${dir === "prev" ? "Anterior" : "Próximo"}</small>${esc(n.book.name)} ${n.chapter}</span>${dir === "next" ? icon("right", 18) : ""}</a>`
      : "<span></span>";

  root.innerHTML = `
    <div class="bible-reader" data-theme="${prefs.theme === "escuro" ? "escuro" : "claro"}" style="--bible-size:${BIBLE_SIZES[prefs.size] || 19}px">
      <div class="bible-bar">
        <div class="container bible-bar-inner">
          <a class="bible-title-btn" href="/biblia/${book.slug}" aria-label="Escolher outro capítulo de ${esc(book.name)}">${esc(book.name)} ${chapter} ${icon("grid", 15)}</a>
          <div class="bible-bar-actions">
            ${prev ? `<a class="icon-btn" href="/biblia/${prev.book.slug}/${prev.chapter}" aria-label="Capítulo anterior">${icon("left", 18)}</a>` : ""}
            ${next ? `<a class="icon-btn" href="/biblia/${next.book.slug}/${next.chapter}" aria-label="Próximo capítulo">${icon("right", 18)}</a>` : ""}
            ${listenButtonHTML("icon")}
            <button class="icon-btn bible-size-btn" type="button" onclick="bibleFont(-1)" aria-label="Diminuir a letra">A<small>−</small></button>
            <button class="icon-btn bible-size-btn" type="button" onclick="bibleFont(1)" aria-label="Aumentar a letra">A<small>+</small></button>
            <button class="icon-btn" type="button" onclick="bibleTheme()" aria-label="Alternar tema escuro" aria-pressed="${prefs.theme === "escuro"}">${icon(prefs.theme === "escuro" ? "sun" : "moon", 17)}</button>
          </div>
        </div>
      </div>
      <article class="container bible-text" data-listen-root data-listen-title="${esc(book.name)} ${chapter}"${next ? ` data-listen-next="/biblia/${next.book.slug}/${next.chapter}"` : ""}>
        <h1 class="bible-chapter-title" data-listen data-listen-text="${esc(book.name)}, capítulo ${chapter}."><span>${esc(book.name)}</span> ${chapter}</h1>
        <div class="bible-ver-row">
          <span class="bible-ver-current">Bíblia Livre</span>
          <button class="bible-ver-btn" type="button" onclick="openBibleVersions()">${icon("book", 15)} Outras versões <small>ARC · ARA · NVI · NTLH · BKJ</small></button>
        </div>
        <p class="bible-verses" onclick="toggleVerse(event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleVerse(event)}">
          ${verses
            .map((t, i) => {
              if (t == null) return "";
              const { heading, text } = splitVerseHeading(t);
              return `${heading ? `<span class="bible-ps-letter" role="heading" aria-level="2">${esc(heading)}</span>` : ""}<span class="v${highlight.has(i + 1) ? " hl" : ""}" id="v${i + 1}" data-v="${i + 1}" data-listen role="button" tabindex="0" aria-pressed="false"><sup>${i + 1}</sup>${esc(text)}</span> `;
            })
            .join("")}
        </p>
        <nav class="bible-nav" aria-label="Capítulos">${navLink(prev, "prev")}${navLink(next, "next")}</nav>
        ${bibleCreditHTML()}
      </article>
      <div class="bible-selection" id="bibleSelection" role="region" aria-label="Versículos selecionados">
        <span class="bible-sel-label" id="bibleSelLabel"></span>
        <div class="bible-sel-actions">
          <button type="button" onclick="bibleSelectionAction('copy')">${icon("copy", 16)}<span>Copiar</span></button>
          <button type="button" onclick="bibleSelectionAction('share')">${icon("share", 16)}<span>Compartilhar</span></button>
          <button type="button" onclick="bibleSelectionAction('link')">${icon("link", 16)}<span>Link</span></button>
          <button type="button" onclick="openBibleVersions(true)" aria-label="Ler em outra versão">${icon("book", 16)}<span>Versões</span></button>
          <button type="button" onclick="clearVerseSelection()" aria-label="Limpar seleção">${icon("x", 16)}</button>
        </div>
      </div>
    </div>`;

  root.dataset.book = book.code;
  root.dataset.chapter = String(chapter);
  root.dataset.verses = verseSpec || "";
  if (first) {
    requestAnimationFrame(() => document.getElementById("v" + first)?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }));
  } else {
    settleTop();
  }
  listenContentReady(); // "Modo ouvir": continua no próximo capítulo, se estava tocando
}

/* ---------- Seleção de versículos ---------- */
function toggleVerse(e) {
  const v = e.target.closest(".v");
  if (!v) return;
  const on = !v.classList.contains("sel");
  v.classList.toggle("sel", on);
  v.setAttribute("aria-pressed", String(on));
  updateVerseSelection();
}

function selectedVerses() {
  return [...document.querySelectorAll(".bible-verses .v.sel")].map((el) => ({ n: Number(el.dataset.v), text: el.textContent.replace(/^\d+/, "").trim() }));
}

// [16,17,18,20] → "16-18,20"
function compactVerseList(nums) {
  const out = [];
  nums.sort((a, b) => a - b).forEach((n) => {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  });
  return out.map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(",");
}

function updateVerseSelection() {
  const sel = selectedVerses();
  const bar = document.getElementById("bibleSelection");
  if (!bar) return;
  bar.classList.toggle("open", sel.length > 0);
  if (sel.length) {
    const root = document.getElementById("bibleRoot");
    const book = BIBLE.byCode.get(root.dataset.book);
    document.getElementById("bibleSelLabel").textContent = `${book.name} ${root.dataset.chapter}:${compactVerseList(sel.map((s) => s.n))}`;
  }
}

function clearVerseSelection() {
  document.querySelectorAll(".bible-verses .v.sel").forEach((v) => {
    v.classList.remove("sel");
    v.setAttribute("aria-pressed", "false");
  });
  updateVerseSelection();
}

async function bibleSelectionAction(kind) {
  const sel = selectedVerses();
  if (!sel.length) return;
  const root = document.getElementById("bibleRoot");
  const book = BIBLE.byCode.get(root.dataset.book);
  const spec = compactVerseList(sel.map((s) => s.n));
  const label = `${book.name} ${root.dataset.chapter}:${spec}`;
  const url = `${location.origin}/biblia/${book.slug}/${root.dataset.chapter}/${spec}`;
  const text = `${sel.map((s) => (sel.length > 1 ? `${s.n} ${s.text}` : s.text)).join(" ")}\n— ${label} (BLIVRE)`;
  try {
    if (kind === "copy") {
      await copyText(text);
      showToast("Versículos copiados!", "success");
    } else if (kind === "link") {
      await copyText(url);
      showToast("Link copiado!", "success");
    } else if (navigator.share) {
      await navigator.share({ title: label, text, url });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank", "noopener");
    }
  } catch (e) {
    if (e?.name !== "AbortError") showToast("Não foi possível concluir.", "error");
  }
}

/* ---------- Letra e tema ---------- */
function bibleFont(delta) {
  const p = biblePrefs();
  p.size = Math.max(0, Math.min(BIBLE_SIZES.length - 1, (p.size ?? 2) + delta));
  saveBiblePrefs(p);
  document.querySelector(".bible-reader")?.style.setProperty("--bible-size", BIBLE_SIZES[p.size] + "px");
}

function bibleTheme() {
  const p = biblePrefs();
  p.theme = p.theme === "escuro" ? "claro" : "escuro";
  saveBiblePrefs(p);
  const reader = document.querySelector(".bible-reader");
  if (!reader) return;
  reader.dataset.theme = p.theme;
  const btn = reader.querySelector('[onclick="bibleTheme()"]');
  btn.setAttribute("aria-pressed", String(p.theme === "escuro"));
  btn.innerHTML = icon(p.theme === "escuro" ? "sun" : "moon", 17);
}

/* ---------- Seção da página inicial ---------- */
function bibleHomeHTML() {
  const last = bibleLastRead();
  const picks = [
    ["Salmos 23", "/biblia/salmos/23"],
    ["João 1", "/biblia/joao/1"],
    ["Romanos 8", "/biblia/romanos/8"],
    ["Provérbios 3", "/biblia/proverbios/3"],
  ];
  return `
  <section class="block tight bible-home">
    <div class="container bible-home-card" data-reveal>
      <div class="bible-home-copy">
        <span class="eyebrow">Palavra de Deus</span>
        <h2>Leia a Bíblia</h2>
        <p>A Bíblia completa no site, gratuita e com leitura confortável no celular.</p>
      </div>
      <div class="bible-home-actions">
        ${
          last
            ? `<a class="btn btn-primary" href="/biblia/${esc(last.slug)}/${Number(last.chapter)}">${icon("book", 16)} Continuar: ${esc(last.name)} ${Number(last.chapter)}</a>`
            : `<a class="btn btn-primary" href="/biblia">${icon("book", 16)} Abrir a Bíblia</a>`
        }
        <div class="bible-picks">${picks.map(([l, h]) => `<a class="bible-pick" href="${h}">${l}</a>`).join("")}</div>
      </div>
    </div>
  </section>`;
}

/* ============================================================
   REFERÊNCIAS EM LISTA — usadas pela EBD e pela Palavra Diária
   Aceita "Jo 3.16", "João 3:16-18", "Rm 8.28,29", "1 Co 13", "Fp 1.27a",
   "Mt 5.1-12; 6.1-4" (o livro se repete quando é omitido).
   Só funciona depois de bibleIndex() carregar.
   ============================================================ */
function parseRefList(text) {
  const out = [];
  let lastBook = null;
  String(text ?? "")
    .split(/\s*;\s*/)
    .filter(Boolean)
    .forEach((part) => {
      const m = part
        .trim()
        .replace(/[.,;:\s]+$/, "")
        .replace(/(\d)[a-c](?=$|[\s,–-])/gi, "$1") // "Fp 1.27a" (meio versículo) → versículo inteiro
        .match(/^((?:[1-3]\s*)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.\s]*?)?\s*(\d+)(?:\s*[:.]\s*([\d\s,–-]+))?$/);
      if (!m) return;
      const book = m[1] ? findBook(m[1]) : lastBook;
      if (!book) return;
      lastBook = book;
      const chapter = Number(m[2]);
      if (!chapter || chapter > book.chapters) return;
      const verses = (m[3] || "").replace(/\s+/g, "").replace(/–/g, "-").replace(/^,+|,+$/g, "");
      if (verses && !/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(verses)) return;
      out.push({ book, chapter, verses });
    });
  return out;
}

const refLabel = (r) => `${r.book.name} ${r.chapter}${r.verses ? ":" + r.verses : ""}`;
const refPath = (r) => `/biblia/${r.book.slug}/${r.chapter}${r.verses ? "/" + r.verses : ""}`;
const refListLabel = (refs) => refs.map(refLabel).join("; ");

// Como a referência deve ser falada no "Modo ouvir" (evita "3:16" virar horário).
function refSpoken(r) {
  if (!r.verses) return `${r.book.name}, capítulo ${r.chapter}`;
  const v = r.verses.replace(/-/g, " a ").replace(/,/g, " e ");
  const plural = /[-,]/.test(r.verses);
  return `${r.book.name}, capítulo ${r.chapter}, ${plural ? "versículos" : "versículo"} ${v}`;
}

// Versículos de uma referência: [{ n, text }]. Sem versículos, o capítulo inteiro.
async function refVerses(r) {
  const data = await bibleBook(r.book.code);
  const chapter = data.chapters[r.chapter - 1] || [];
  const wanted = r.verses ? parseVerseSpec(r.verses, chapter.length) : null;
  return chapter
    .map((text, i) => ({ n: i + 1, text: text == null ? null : splitVerseHeading(text).text }))
    .filter((v) => v.text != null && (!wanted || wanted.has(v.n)));
}

// Salmo 119: cada bloco de 8 versículos começa com uma letra hebraica, que a
// Bíblia Livre traz no próprio versículo ("[Nun] :Tua palavra…"). É um título,
// não parte do texto. Só estas 22 letras ([Ela]:, [Dizendo]: etc. são texto).
const HEBREW_HEADING = /^\s*\[(Álefe|Bete|Guímel|Dálete|Hê|Vau|Záin|Hete|Tete|Iode|Cafe|Lâmede|Mem|Nun|Sâmeque|Áin|Pê|Tsadê|Cofe|Rexe|Xin|Tau)\]\s*:\s*/;
function splitVerseHeading(text) {
  const m = HEBREW_HEADING.exec(text || "");
  return m ? { heading: m[1], text: text.slice(m[0].length) } : { heading: "", text };
}

/* ============================================================
   PALAVRA DIÁRIA — um versículo por dia
   ------------------------------------------------------------
   Lista fixa de referências bíblicas, a mesma para todos, que
   muda à meia-noite (horário de Brasília). O texto vem da Bíblia
   Livre; nada é gerado automaticamente. Quando a igreja publicar
   devocionais revisados, eles entram aqui.
   ============================================================ */
const PALAVRA_REFS = [
  "Salmos 23:1", "João 3:16", "Romanos 8:28", "Filipenses 4:13", "Jeremias 29:11", "Isaías 41:10", "Provérbios 3:5-6",
  "Josué 1:9", "Mateus 11:28", "Salmos 46:1", "2 Timóteo 1:7", "Hebreus 11:1", "1 Coríntios 13:4-7", "Gálatas 5:22-23",
  "Efésios 2:8-9", "Romanos 12:2", "Salmos 119:105", "Mateus 6:33", "Isaías 40:31", "Lamentações 3:22-23", "Salmos 37:5",
  "Filipenses 4:6-7", "1 Pedro 5:7", "João 14:6", "João 14:27", "Romanos 5:8", "Romanos 10:9", "2 Coríntios 5:17",
  "Salmos 91:1-2", "Salmos 121:1-2", "Mateus 5:16", "Miqueias 6:8", "Deuteronômio 31:6", "Salmos 27:1", "Salmos 34:8",
  "Provérbios 18:10", "Isaías 26:3", "Isaías 53:5", "João 1:1", "João 8:32", "João 10:10", "João 11:25", "João 15:5",
  "João 16:33", "Atos 1:8", "Romanos 6:23", "Romanos 8:1", "Romanos 8:38-39", "Romanos 15:13", "1 Coríntios 10:13",
  "1 Coríntios 15:58", "2 Coríntios 12:9", "Gálatas 2:20", "Efésios 3:20", "Efésios 6:10", "Filipenses 1:6",
  "Filipenses 4:19", "Colossenses 3:23", "1 Tessalonicenses 5:16-18", "2 Timóteo 3:16", "Hebreus 4:12", "Hebreus 12:1-2",
  "Hebreus 13:8", "Tiago 1:5", "Tiago 4:8", "1 Pedro 2:9", "1 João 1:9", "1 João 4:8", "1 João 4:19", "Apocalipse 3:20",
  "Apocalipse 21:4", "Gênesis 1:1", "Êxodo 14:14", "Números 6:24-26", "Salmos 1:1-2", "Salmos 16:11", "Salmos 19:14",
  "Salmos 30:5", "Salmos 32:8", "Salmos 51:10", "Salmos 55:22", "Salmos 62:1-2", "Salmos 103:1-2", "Salmos 118:24",
  "Salmos 139:14", "Salmos 145:18", "Provérbios 4:23", "Provérbios 16:3", "Eclesiastes 3:1", "Isaías 9:6", "Isaías 43:2",
  "Isaías 55:8-9", "Jeremias 33:3", "Sofonias 3:17", "Mateus 5:14", "Mateus 7:7", "Mateus 28:19-20", "Marcos 10:27",
  "Lucas 1:37", "João 13:34-35", "Atos 2:42", "Romanos 1:16", "Romanos 12:12", "Efésios 4:32", "Colossenses 3:2",
  "Hebreus 10:23", "1 Pedro 3:15", "2 Crônicas 7:14", "Habacuque 3:17-18", "Joel 2:28", "Salmos 40:1", "Salmos 73:26",
  "Salmos 84:11", "Salmos 100:4-5", "Salmos 127:1", "Provérbios 15:1", "Provérbios 22:6", "Isaías 12:2", "Isaías 54:10",
  "Mateus 22:37-39", "Lucas 6:31", "João 6:35", "João 20:29", "Romanos 3:23-24", "1 Coríntios 16:14", "2 Coríntios 4:16-18",
  "Efésios 5:1-2", "Filipenses 2:3-4", "Colossenses 3:12-13", "1 Timóteo 4:12", "Tiago 1:22", "1 João 3:1",
];

// Data de hoje em Brasília (AAAA-MM-DD), para todo mundo ver o mesmo versículo.
const spToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const isoAddDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

function palavraRefFor(iso) {
  const day = Math.floor(Date.parse(iso + "T12:00:00Z") / 864e5);
  return PALAVRA_REFS[((day % PALAVRA_REFS.length) + PALAVRA_REFS.length) % PALAVRA_REFS.length];
}

async function palavraFor(iso) {
  await bibleIndex();
  const [ref] = parseRefList(palavraRefFor(iso));
  const verses = await refVerses(ref);
  return { iso, ref, verses, text: verses.map((v) => v.text).join(" ").replace(/[[\]]/g, "") };
}

function palavraPageHTML() {
  return `<section class="palavra-page" id="palavraRoot" aria-live="polite">
    <div class="container narrow bible-loading"><div class="bible-skel bible-skel-title"></div><div class="bible-skel"></div><div class="bible-skel short"></div></div>
  </section>`;
}

async function initPalavraView(param) {
  const root = document.getElementById("palavraRoot");
  if (!root) return;
  const today = spToday();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(param || "") && param <= today ? param : today;
  try {
    const p = await palavraFor(iso);
    if (!document.body.contains(root)) return;
    const isToday = iso === today;
    setMeta(isToday ? "Palavra Diária" : `Palavra de ${fmtDateLong(iso)}`, `${refLabel(p.ref)} — ${truncate(p.text, 140)}`, isToday ? "/palavra" : `/palavra/${iso}`);
    const prevDays = Array.from({ length: 6 }, (_, i) => isoAddDays(today, -(i + 1)));
    root.innerHTML = `
      <div class="palavra-hero">
        <div class="container narrow" data-listen-root data-listen-title="Palavra Diária">
          <span class="eyebrow">${icon("sunrise", 15)} Palavra Diária · ${esc(fmtDateFull(iso))}</span>
          <blockquote class="palavra-verse" data-listen data-listen-text="${esc(`${refSpoken(p.ref)}. ${p.text}`)}">
            <p>${esc(p.text)}</p>
            <footer><a href="${refPath(p.ref)}">${esc(refLabel(p.ref))}</a> <span>· Bíblia Livre</span></footer>
          </blockquote>
          <div class="palavra-actions">
            ${listenButtonHTML()}
            <button class="btn btn-ghost btn-sm" type="button" onclick="sharePalavra()">${icon("share", 15)} Compartilhar</button>
            <a class="btn btn-ghost btn-sm" href="/biblia/${p.ref.book.slug}/${p.ref.chapter}">${icon("book", 15)} Ler o capítulo</a>
          </div>
        </div>
      </div>
      <div class="container narrow palavra-more">
        <h2>Dias anteriores</h2>
        <ul class="palavra-days">
          ${prevDays
            .map((d) => {
              const [r] = parseRefList(palavraRefFor(d));
              return `<li><a href="/palavra/${d}"${d === iso ? ' aria-current="page"' : ""}><span>${esc(fmtDate(d))}</span><strong>${esc(r ? refLabel(r) : palavraRefFor(d))}</strong>${icon("right", 15)}</a></li>`;
            })
            .join("")}
        </ul>
        ${installHintHTML()}
        ${bibleCreditHTML()}
      </div>`;
    root.dataset.share = `${p.text}\n— ${refLabel(p.ref)} (Bíblia Livre)`;
    settleTop();
    listenContentReady();
  } catch (e) {
    console.error("Palavra Diária:", e);
    root.innerHTML = `<div class="container">${emptyState("book", "Não foi possível abrir a Palavra agora", navigator.onLine ? "Tente novamente em instantes." : "Você está sem internet.", `<button class="btn btn-primary btn-sm" type="button" onclick="initPalavraView(routeParam(currentRoute()))">Tentar de novo</button>`)}</div>`;
  }
}

async function sharePalavra() {
  const root = document.getElementById("palavraRoot");
  const text = root?.dataset.share || "";
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) await navigator.share({ title: "Palavra Diária", text, url });
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank", "noopener");
  } catch (e) {
    if (e?.name !== "AbortError") showToast("Não foi possível compartilhar.", "error");
  }
}

// Seção da página inicial: o espaço já nasce reservado e o versículo entra em seguida.
function palavraHomeHTML() {
  return `
  <section class="block tight palavra-home">
    <a class="container palavra-home-card" href="/palavra" id="palavraHome" data-reveal>
      <span class="eyebrow">${icon("sunrise", 15)} Palavra Diária</span>
      <p class="palavra-home-text"><span class="bible-skel"></span><span class="bible-skel short"></span></p>
      <span class="palavra-home-ref">&nbsp;</span>
    </a>
  </section>`;
}

async function initPalavraHome() {
  const el = document.getElementById("palavraHome");
  if (!el) return;
  try {
    const p = await palavraFor(spToday());
    if (!document.body.contains(el)) return;
    el.querySelector(".palavra-home-text").textContent = `“${p.text}”`;
    el.querySelector(".palavra-home-ref").innerHTML = `${esc(refLabel(p.ref))} ${icon("arrow", 14)}`;
    // Deixa o livro de amanhã guardado no aparelho, para abrir sem internet.
    const [tomorrow] = parseRefList(palavraRefFor(isoAddDays(spToday(), 1)));
    if (tomorrow) (window.requestIdleCallback || setTimeout)(() => bibleBook(tomorrow.book.code).catch(() => {}));
  } catch {
    el.closest("section")?.remove();
  }
}
