/* ============================================================
   HARPA CRISTÃ — hinário das Assembleias de Deus (CPAD)
   ------------------------------------------------------------
   Endereços:
     /harpa        índice dos 640 hinos, busca por número ou nome
     /harpa/15     hino 15
   Dados: /data/harpa/indice.json — só número e título (índice),
   conferido em duas fontes independentes.
   A letra e a música são da CPAD (direitos autorais): o site não
   as reproduz. Cada hino tem atalhos para ouvir e para ver a letra
   fora do site.
   ============================================================ */
const HARPA = { data: null, promise: null };
const HARPA_FAV_KEY = "harpa-favoritos";
const HARPA_LYRICS_SITE = "Harpa Cristã Digital";
const harpaLyricsUrl = (n) => `https://harpacrista.digital/hinos/${n}`;
const harpaListenUrl = (n, t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`Harpa Cristã hino ${n} ${t}`)}`;

function harpaIndex() {
  if (HARPA.data) return Promise.resolve(HARPA.data);
  HARPA.promise ||= fetch("/data/harpa/indice.json")
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((d) => {
      HARPA.data = d;
      // Busca sem acento e sem diferenciar maiúsculas.
      d.keys = d.hinos.map((t) => normalizeText(t));
      return d;
    })
    .catch((e) => {
      HARPA.promise = null;
      throw e;
    });
  return HARPA.promise;
}

/* ---------- Meus hinos (só neste aparelho) ---------- */
function harpaFavs() {
  try {
    const list = JSON.parse(localStorage.getItem(HARPA_FAV_KEY) || "[]");
    return Array.isArray(list) ? list.filter((n) => Number.isInteger(n) && n >= 1 && n <= 640) : [];
  } catch {
    return [];
  }
}

function harpaToggleFav(n) {
  const favs = harpaFavs();
  const on = !favs.includes(n);
  const next = on ? [...favs, n].sort((a, b) => a - b) : favs.filter((x) => x !== n);
  try {
    localStorage.setItem(HARPA_FAV_KEY, JSON.stringify(next));
  } catch {
    return showToast("Não foi possível guardar neste aparelho.", "error");
  }
  const btn = document.getElementById("harpaFavBtn");
  if (btn) {
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector("span").textContent = on ? "Nos meus hinos" : "Guardar nos meus hinos";
  }
  showToast(on ? `Hino ${n} guardado em “Meus hinos”.` : `Hino ${n} saiu de “Meus hinos”.`, "success");
}

async function harpaShare(n) {
  const t = HARPA.data?.hinos[n - 1] || "";
  const url = `${location.origin}/harpa/${n}`;
  const title = `Hino ${n} da Harpa Cristã — ${t}`;
  try {
    if (navigator.share) await navigator.share({ title, url });
    else {
      await copyText(url);
      showToast("Link copiado!", "success");
    }
  } catch (e) {
    if (e?.name !== "AbortError") showToast("Não foi possível compartilhar.", "error");
  }
}

/* ---------- Páginas ---------- */
function harpaPageHTML() {
  return `<section class="harpa-page" id="harpaRoot" aria-live="polite">
    <div class="container bible-loading">
      <div class="bible-skel bible-skel-title"></div>
      <div class="bible-skel"></div><div class="bible-skel"></div><div class="bible-skel short"></div>
    </div>
  </section>`;
}

let harpaViewToken = 0;

async function initHarpaView(param) {
  const token = ++harpaViewToken;
  const root = document.getElementById("harpaRoot");
  if (!root) return;
  try {
    const d = await harpaIndex();
    if (token !== harpaViewToken || !document.body.contains(root)) return;
    if (!param) return renderHarpaIndex(root, d);
    const n = Number(param);
    if (/^\d{1,3}$/.test(param) && n >= 1 && n <= d.hinos.length) return renderHarpaHymn(root, d, n);
    setMeta("Hino não encontrado", ROUTE_META.harpa[1], location.pathname, { noindex: true });
    root.innerHTML = `<div class="container harpa-body">${emptyState(
      "music",
      "Hino não encontrado",
      `A Harpa Cristã vai do hino 1 ao ${d.hinos.length}.`,
      `<a class="btn btn-primary btn-sm" href="/harpa">Ver todos os hinos</a>`,
    )}</div>`;
    initReveal(root);
    settleTop();
  } catch (e) {
    console.error("Harpa:", e);
    if (token !== harpaViewToken) return;
    root.innerHTML = `<div class="container harpa-body">${emptyState(
      "music",
      "Não foi possível abrir a Harpa agora",
      navigator.onLine ? "Tente novamente em instantes." : "Você está sem internet.",
      `<button class="btn btn-primary btn-sm" type="button" onclick="initHarpaView(routeParam(currentRoute()))">Tentar de novo</button>`,
    )}</div>`;
    initReveal(root);
  }
}

function harpaRightsHTML() {
  return `<p class="harpa-rights">A Harpa Cristã é o hinário oficial das Assembleias de Deus no Brasil, publicado pela
    <strong>CPAD</strong> (Casa Publicadora das Assembleias de Deus). As letras e as músicas têm direitos autorais;
    por isso o site mostra só o número e o título de cada hino e indica onde ouvir e ler.
    <a href="https://www.cpad.com.br/harpa" target="_blank" rel="noopener">Tenha a sua Harpa Cristã</a>.</p>`;
}

function renderHarpaIndex(root, d) {
  setMeta("Harpa Cristã", ROUTE_META.harpa[1], "/harpa");
  const favs = harpaFavs();
  root.innerHTML = `
    <div class="bible-hero harpa-hero">
      <div class="container">
        <span class="eyebrow">${icon("music", 15)} Hinário das Assembleias de Deus</span>
        <h1>Harpa Cristã</h1>
        <p class="lead">Os ${d.hinos.length} hinos da Harpa Cristã. Procure pelo número ou pelo nome e ouça.</p>
        <form class="bible-search" role="search" onsubmit="harpaSubmit(event)">
          ${icon("search", 18)}
          <label class="sr-only" for="harpaQuery">Número ou nome do hino</label>
          <input id="harpaQuery" type="search" autocomplete="off" enterkeyhint="go" placeholder="Número ou nome do hino" oninput="harpaFilter(this.value)">
          <button class="btn btn-primary btn-sm" type="submit">Abrir</button>
        </form>
      </div>
    </div>
    <div class="container harpa-body">
      ${
        favs.length
          ? `<section class="harpa-favs" aria-label="Meus hinos">
        <h2>${icon("heart", 17)} Meus hinos</h2>
        <div class="harpa-chips">${favs.map((n) => `<a class="harpa-chip" href="/harpa/${n}"><b>${n}</b>${esc(d.hinos[n - 1])}</a>`).join("")}</div>
      </section>`
          : ""
      }
      <p class="harpa-count" id="harpaCount" aria-live="polite"></p>
      <ol class="harpa-list" id="harpaList">
        ${d.hinos.map((t, i) => `<li data-n="${i + 1}"><a href="/harpa/${i + 1}"><span class="harpa-num">${i + 1}</span><span class="harpa-title">${esc(t)}</span></a></li>`).join("")}
      </ol>
      ${harpaRightsHTML()}
    </div>`;
  settleTop();
}

// Número: mostra o hino e os que começam com esses dígitos (15 → 15, 150–159).
// Palavras: todas precisam aparecer no título (sem acento).
function harpaMatches(query) {
  const d = HARPA.data;
  const q = normalizeText(query);
  if (!d || !q) return null;
  if (/^\d+$/.test(q)) return d.hinos.map((_, i) => i + 1).filter((n) => String(n).startsWith(String(Number(q))));
  const words = q.split(/\s+/).filter(Boolean);
  return d.keys.map((k, i) => (words.every((w) => k.includes(w)) ? i + 1 : 0)).filter(Boolean);
}

function harpaFilter(value) {
  const list = document.getElementById("harpaList");
  if (!list) return;
  const found = harpaMatches(value);
  const show = found ? new Set(found) : null;
  list.querySelectorAll("li").forEach((li) => (li.hidden = !!show && !show.has(Number(li.dataset.n))));
  const count = document.getElementById("harpaCount");
  count.textContent = !found ? "" : found.length ? `${found.length} ${found.length === 1 ? "hino encontrado" : "hinos encontrados"}` : `Nenhum hino com “${value.trim()}”. Tente outra palavra ou o número.`;
}

function harpaSubmit(e) {
  e.preventDefault();
  const value = document.getElementById("harpaQuery")?.value || "";
  const found = harpaMatches(value) || [];
  const n = /^\s*\d+\s*$/.test(value) ? Number(value) : found.length === 1 ? found[0] : 0;
  if (n >= 1 && n <= (HARPA.data?.hinos.length || 0)) return navigateTo(`/harpa/${n}`);
  document.querySelector("#harpaList li:not([hidden]) a")?.focus();
}

function renderHarpaHymn(root, d, n) {
  const t = d.hinos[n - 1];
  const total = d.hinos.length;
  const fav = harpaFavs().includes(n);
  setMeta(`Hino ${n} — ${t}`, `Hino ${n} da Harpa Cristã: ${t}. Ouça e encontre a letra.`, `/harpa/${n}`);
  const nav = (m, dir) =>
    m >= 1 && m <= total
      ? `<a class="harpa-nav-link ${dir}" href="/harpa/${m}">${dir === "prev" ? icon("left", 18) : ""}<span><small>${dir === "prev" ? "Anterior" : "Próximo"}</small>${m} · ${esc(d.hinos[m - 1])}</span>${dir === "next" ? icon("right", 18) : ""}</a>`
      : "<span></span>";
  root.innerHTML = `
    <div class="container harpa-hymn">
      <a class="back-link" href="/harpa">${icon("arrowBack", 16)} Harpa Cristã</a>
      <div class="harpa-hymn-head">
        <span class="harpa-hymn-num" aria-hidden="true">${n}</span>
        <div>
          <span class="eyebrow">Hino ${n} da Harpa Cristã</span>
          <h1>${esc(t)}</h1>
        </div>
      </div>
      <div class="harpa-actions">
        <a class="btn btn-primary" href="${esc(harpaListenUrl(n, t))}" target="_blank" rel="noopener">${icon("play", 16)} Ouvir no YouTube ${icon("external", 14)}</a>
        <a class="btn btn-ghost" href="${esc(harpaLyricsUrl(n))}" target="_blank" rel="noopener">${icon("book", 16)} Ver a letra ${icon("external", 14)}</a>
        <button class="btn btn-ghost" type="button" id="harpaFavBtn" aria-pressed="${fav}" onclick="harpaToggleFav(${n})">${icon("heart", 16)} <span>${fav ? "Nos meus hinos" : "Guardar nos meus hinos"}</span></button>
        <button class="btn btn-ghost" type="button" onclick="harpaShare(${n})">${icon("share", 16)} Compartilhar</button>
      </div>
      <p class="harpa-note">“Ouvir” abre uma busca no YouTube pelo hino. “Ver a letra” abre o site ${HARPA_LYRICS_SITE}, que não tem ligação com a igreja.</p>
      <nav class="harpa-nav" aria-label="Outros hinos">${nav(n - 1, "prev")}${nav(n + 1, "next")}</nav>
      ${harpaRightsHTML()}
    </div>`;
  settleTop();
}
