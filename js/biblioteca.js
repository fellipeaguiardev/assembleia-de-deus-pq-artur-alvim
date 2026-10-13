/* ============================================================
   BIBLIOTECA DOS JOVENS (páginas públicas)
   ------------------------------------------------------------
   Endereços:
     /biblioteca          acervo: busca, categorias, situação de cada livro
     /biblioteca/<id>     livro: sinopse, situação e pedido
   Dados: tabelas library_* (supabase/migrations/20261011_biblioteca.sql).
   O visitante recebe só o acervo e a SITUAÇÃO de cada livro (função
   library_status) — nomes e telefones de quem pegou ou pediu ficam no
   banco, visíveis só para a equipe no painel. Pedidos passam pela função
   library_request, que valida e limita abusos.
   ============================================================ */
const LIB = { books: null, status: new Map(), loadedAt: 0, missing: false, ui: { q: "", cat: "", free: false } };
const LIB_BOOK_COLS = "id,title,author,category,cover_url";
const LIB_MINE_KEY = "biblioteca-pedidos";
const LIB_CONTACT_KEY = "biblioteca-contato";
// Ordem das categorias (a mesma das abas da planilha da biblioteca).
const LIB_CATEGORIES = ["Teologia Sistemática", "Teologia Bíblica", "Teologia Exegética", "Teologia Prática", "Teologia Histórica", "História Geral", "Literatura e Ficção", "Filosofia", "Literatura de Autoajuda"];
const LIB_COLORS = ["#1f3b73", "#7a2433", "#1d5a46", "#155e75", "#6b4423", "#3b4656", "#5b2a86", "#2b2b30", "#a4520b"];

function libIsMissing(err) {
  return !!err && (["42P01", "PGRST205", "PGRST202", "42883"].includes(err.code) || /does not exist|could not find the (table|function)/i.test(err.message || ""));
}

function libColor(cat) {
  const i = LIB_CATEGORIES.indexOf(cat);
  if (i >= 0) return LIB_COLORS[i];
  let h = 0;
  for (const ch of String(cat || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LIB_COLORS[h % LIB_COLORS.length];
}

const libSortCats = (cats) => [...cats].sort((a, b) => {
  const ia = LIB_CATEGORIES.indexOf(a);
  const ib = LIB_CATEGORIES.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "pt-BR");
});

const libDayMonth = (iso) => (iso ? parseISODate(iso)?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) || "" : "");

// Carrega acervo + situação (cache de 1 minuto na memória).
async function libLoad(force = false) {
  if (!force && LIB.books && Date.now() - LIB.loadedAt < 60000) return LIB.books;
  const [books, status] = await Promise.all([
    db("library_books").select(LIB_BOOK_COLS).eq("visible", true).order("title"),
    supabaseClient.rpc("library_status"),
  ]);
  const err = books.error || status.error;
  if (err) {
    LIB.missing = libIsMissing(err);
    if (LIB.missing) return (LIB.books = []);
    throw err;
  }
  LIB.missing = false;
  LIB.books = (books.data || []).map((b) => ({ ...b, key: normalizeText(`${b.title} ${b.author}`) }));
  LIB.status = new Map((status.data || []).map((s) => [s.book_id, s]));
  LIB.loadedAt = Date.now();
  return LIB.books;
}

// Situação pública de um livro (sem nomes).
function libState(id) {
  const s = LIB.status.get(id);
  if (s?.on_loan) {
    const late = s.due_on && s.due_on < spToday();
    return { key: "emprestado", label: late || !s.due_on ? "Emprestado" : `Emprestado · volta ${libDayMonth(s.due_on)}`, waiting: s.waiting || 0, due: s.due_on };
  }
  if (s?.waiting > 0) return { key: "reservado", label: "Reservado", waiting: s.waiting };
  return { key: "livre", label: "Disponível", waiting: 0 };
}

function libCoverHTML(b, size = "") {
  const url = safeUrl(b.cover_url);
  return `<span class="lib-cover ${size}" style="--lib-c:${libColor(b.category)}" aria-hidden="true">
    <span class="lib-cover-art"><small>${esc(b.category || "Livro")}</small><b>${esc(truncate(b.title, 70))}</b><i>${esc(truncate(b.author || "", 40))}</i></span>
    ${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
  </span>`;
}

function libMine() {
  try {
    const m = JSON.parse(localStorage.getItem(LIB_MINE_KEY) || "{}");
    return m && typeof m === "object" ? m : {};
  } catch {
    return {};
  }
}

/* ---------- Páginas ---------- */
function bibliotecaPageHTML() {
  return `<section class="lib-page" id="libRoot" aria-live="polite">
    <div class="container bible-loading">
      <div class="bible-skel bible-skel-title"></div>
      <div class="bible-skel"></div><div class="bible-skel"></div><div class="bible-skel short"></div>
    </div>
  </section>`;
}

let libViewToken = 0;

async function initBibliotecaView(param) {
  const token = ++libViewToken;
  const root = document.getElementById("libRoot");
  if (!root) return;
  const alive = () => token === libViewToken && document.body.contains(root);
  try {
    await libLoad(!!param);
    if (!alive()) return;
    if (LIB.missing || (!param && !LIB.books.length)) return renderLibSoon(root);
    if (!param) return renderLibCatalog(root);
    await renderLibBook(root, param, alive);
  } catch (e) {
    console.error("Biblioteca:", e);
    if (!alive()) return;
    root.innerHTML = `<div class="container lib-body">${emptyState(
      "book",
      "Não foi possível abrir a biblioteca agora",
      navigator.onLine ? "Tente novamente em instantes." : "Você está sem internet.",
      `<button class="btn btn-primary btn-sm" type="button" onclick="initBibliotecaView(routeParam(currentRoute()))">Tentar de novo</button>`,
    )}</div>`;
    initReveal(root);
  }
}

function libHeroHTML(extra = "") {
  const L = data.library;
  return `<div class="bible-hero lib-hero">
    <div class="container">
      <span class="eyebrow">${icon("book", 15)} Jovens · aberta a todos</span>
      <h1>${esc(L.title || "Biblioteca dos Jovens")}</h1>
      ${L.intro ? `<p class="lead">${esc(L.intro)}</p>` : ""}
      ${extra}
    </div>
  </div>`;
}

function renderLibSoon(root) {
  setMeta(ROUTE_META.biblioteca[0], ROUTE_META.biblioteca[1], "/biblioteca");
  root.innerHTML = libHeroHTML() + `<div class="container lib-body">${emptyState("book", "Em preparação", "O acervo da biblioteca vai aparecer aqui em breve.", `<a class="btn btn-primary btn-sm" href="/cultos">Ver os horários dos cultos</a>`)}${libRulesHTML()}</div>`;
  initReveal(root);
  settleTop();
}

// Três números que resumem as regras + a lista completa (editável no painel).
function libRulesHTML() {
  const L = data.library;
  const rules = (L.rules || []).filter((r) => r && (r.t || r.d));
  return `<section class="lib-rules" id="regras" aria-labelledby="libRulesTitle">
    <h2 id="libRulesTitle">Como funciona</h2>
    <div class="lib-facts">
      <div><b>${Number(L.loanDays) || 14} dias</b><span>de prazo para ler</span></div>
      <div><b>Até ${Number(L.maxBooks) || 2} livros</b><span>por pessoa, por vez</span></div>
      <div><b>Nos cultos</b><span>retirada e devolução</span></div>
    </div>
    ${
      rules.length
        ? `<details class="lib-rules-all">
      <summary>Ver todas as regras de empréstimo, reserva e renovação</summary>
      <ol>${rules.map((r) => `<li>${r.t ? `<strong>${esc(r.t)}</strong>` : ""}${r.d ? `<p>${esc(r.d)}</p>` : ""}</li>`).join("")}</ol>
    </details>`
        : ""
    }
  </section>`;
}

function renderLibCatalog(root) {
  setMeta(ROUTE_META.biblioteca[0], ROUTE_META.biblioteca[1], "/biblioteca");
  const books = LIB.books;
  const free = books.filter((b) => libState(b.id).key === "livre").length;
  const cats = libSortCats(new Set(books.map((b) => b.category).filter(Boolean)));
  const count = (c) => books.filter((b) => b.category === c).length;
  const u = LIB.ui;
  root.innerHTML =
    libHeroHTML(`
      <div class="lib-stats"><span><b>${books.length}</b> livros</span><span><b>${free}</b> disponíveis agora</span></div>
      <form class="bible-search" role="search" onsubmit="event.preventDefault();this.querySelector('input').blur()">
        ${icon("search", 18)}
        <label class="sr-only" for="libQuery">Buscar por título ou autor</label>
        <input id="libQuery" type="search" autocomplete="off" enterkeyhint="search" placeholder="Título ou autor" value="${esc(u.q)}" oninput="libSetFilter('q', this.value)">
      </form>`) +
    `<div class="container lib-body">
      <div class="lib-filters" role="group" aria-label="Filtrar por categoria">
        <button type="button" class="lib-chip${!u.cat ? " active" : ""}" data-cat="" onclick="libSetFilter('cat', '')">Todas <small>${books.length}</small></button>
        ${cats.map((c) => `<button type="button" class="lib-chip${u.cat === c ? " active" : ""}" data-cat="${esc(c)}" onclick="libSetFilter('cat', this.dataset.cat)" style="--lib-c:${libColor(c)}">${esc(c)} <small>${count(c)}</small></button>`).join("")}
      </div>
      <label class="lib-only-free"><input type="checkbox" ${u.free ? "checked" : ""} onchange="libSetFilter('free', this.checked)"> Só os disponíveis agora</label>
      <p class="lib-count" id="libCount" aria-live="polite"></p>
      <div class="lib-grid" id="libGrid"></div>
      ${libRulesHTML()}
    </div>`;
  libRenderGrid();
  settleTop();
}

function libSetFilter(key, value) {
  LIB.ui[key] = value;
  if (key === "cat") document.querySelectorAll(".lib-chip").forEach((b) => b.classList.toggle("active", b.dataset.cat === value));
  libRenderGrid();
}

function libFiltered() {
  const u = LIB.ui;
  const words = normalizeText(u.q).split(/\s+/).filter(Boolean);
  return LIB.books.filter((b) => (!u.cat || b.category === u.cat) && (!u.free || libState(b.id).key === "livre") && words.every((w) => b.key.includes(w)));
}

function libRenderGrid() {
  const grid = document.getElementById("libGrid");
  if (!grid) return;
  const list = libFiltered();
  const u = LIB.ui;
  const filtering = u.q.trim() || u.cat || u.free;
  document.getElementById("libCount").textContent = filtering ? (list.length ? `${list.length} ${list.length === 1 ? "livro" : "livros"}` : "") : "";
  if (!list.length) {
    grid.innerHTML = `<p class="lib-empty">Nenhum livro${u.q.trim() ? ` com “${esc(u.q.trim())}”` : ""}${u.cat ? ` em ${esc(u.cat)}` : ""}${u.free ? " disponível agora" : ""}. ${filtering ? `<button type="button" class="link-btn" onclick="libClearFilters()">Limpar a busca</button>` : ""}</p>`;
    return;
  }
  const mine = libMine();
  grid.innerHTML = list
    .map((b) => {
      const s = libState(b.id);
      return `<a class="lib-card" href="/biblioteca/${esc(b.id)}">
        ${libCoverHTML(b)}
        <span class="lib-card-body">
          <strong>${esc(b.title)}</strong>
          ${b.author ? `<span class="lib-card-author">${esc(b.author)}</span>` : ""}
          <span class="lib-status lib-st-${s.key}">${esc(s.label)}</span>
          ${mine[b.id] ? `<span class="lib-mine">${icon("check", 13)} Você pediu</span>` : ""}
        </span>
      </a>`;
    })
    .join("");
}

function libClearFilters() {
  LIB.ui = { q: "", cat: "", free: false };
  const root = document.getElementById("libRoot");
  if (root) renderLibCatalog(root);
}

async function renderLibBook(root, id, alive) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return libNotFound(root);
  const { data: b, error } = await db("library_books").select("id,title,author,category,synopsis,cover_url").eq("id", id).eq("visible", true).maybeSingle();
  if (!alive()) return;
  if (error && !libIsMissing(error)) throw error;
  if (!b) return libNotFound(root);
  const s = libState(b.id);
  const mine = libMine()[b.id];
  const wantsQueue = s.key !== "livre";
  setMeta(`${b.title} — Biblioteca dos Jovens`, truncate(`${b.title}${b.author ? ", de " + b.author : ""}. ${b.synopsis || ""}`, 155), `/biblioteca/${b.id}`);
  const related = LIB.books.filter((x) => x.category === b.category && x.id !== b.id).slice(0, 4);
  const waitingText = s.waiting ? `${s.waiting} ${s.waiting === 1 ? "pessoa" : "pessoas"} na fila de espera` : "";
  root.innerHTML = `
    <div class="container lib-book-page">
      <a class="back-link" href="/biblioteca">${icon("arrowBack", 16)} ${esc(data.library.title || "Biblioteca dos Jovens")}</a>
      <article class="lib-book">
        <div class="lib-book-cover">${libCoverHTML(b, "lg")}</div>
        <div class="lib-book-info">
          ${b.category ? `<span class="eyebrow">${esc(b.category)}</span>` : ""}
          <h1>${esc(b.title)}</h1>
          ${b.author ? `<p class="lib-book-author">${esc(b.author)}</p>` : ""}
          <div class="lib-book-state">
            <span class="lib-status lib-st-${s.key}">${esc(s.label)}</span>
            ${waitingText ? `<span class="lib-waiting">${icon("user", 14)} ${waitingText}</span>` : ""}
          </div>
          ${
            mine
              ? `<p class="lib-mine-note">${icon("check", 15)} Você pediu este livro em ${esc(libDayMonth(mine.at))}${mine.kind === "fila" && mine.position ? ` (${mine.position}º na fila)` : ""}. A equipe vai falar com você pelo WhatsApp.</p>`
              : ""
          }
          <div class="lib-actions">
            <button class="btn btn-primary" type="button" id="libWantBtn" onclick="libOpenRequest()">${icon("book", 16)} ${wantsQueue ? "Entrar na fila de espera" : "Quero este livro"}</button>
            <button class="btn btn-ghost" type="button" onclick="libShare()">${icon("share", 16)} Compartilhar</button>
          </div>
          <div class="lib-request" id="libRequest" hidden>${libRequestFormHTML(b, wantsQueue)}</div>
          ${b.synopsis ? `<section class="lib-synopsis"><h2>Sinopse</h2><p class="pre-line">${esc(b.synopsis)}</p></section>` : ""}
        </div>
      </article>
      ${
        related.length
          ? `<section class="lib-related"><h2>Mais livros de ${esc(b.category)}</h2><div class="lib-grid">${related
              .map((x) => `<a class="lib-card" href="/biblioteca/${esc(x.id)}">${libCoverHTML(x)}<span class="lib-card-body"><strong>${esc(x.title)}</strong>${x.author ? `<span class="lib-card-author">${esc(x.author)}</span>` : ""}<span class="lib-status lib-st-${libState(x.id).key}">${esc(libState(x.id).label)}</span></span></a>`)
              .join("")}</div></section>`
          : ""
      }
      ${libRulesHTML()}
    </div>`;
  settleTop();
}

function libNotFound(root) {
  setMeta("Livro não encontrado", ROUTE_META.biblioteca[1], location.pathname, { noindex: true });
  root.innerHTML = `<div class="container lib-body">${emptyState("book", "Livro não encontrado", "Ele pode ter saído do acervo. Veja os outros livros da biblioteca.", `<a class="btn btn-primary btn-sm" href="/biblioteca">Ver o acervo</a>`)}</div>`;
  initReveal(root);
  settleTop();
}

function libRequestFormHTML(b, wantsQueue) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(LIB_CONTACT_KEY) || "{}") || {};
  } catch {}
  return `<form class="lib-form" onsubmit="libSubmitRequest(event, '${esc(b.id)}')" novalidate>
    <h2>${wantsQueue ? "Entrar na fila de espera" : "Pedir este livro"}</h2>
    <p class="lib-form-lead">${
      wantsQueue
        ? "Quando o livro voltar, a equipe da biblioteca avisa você pelo WhatsApp, na ordem da fila."
        : `A equipe da biblioteca fala com você pelo WhatsApp para combinar a retirada no próximo culto. O prazo é de ${Number(data.library.loanDays) || 14} dias.`
    }</p>
    <div class="lib-form-row">
      <label>Seu nome<input name="nome" type="text" autocomplete="name" maxlength="120" required value="${esc(saved.name || "")}"></label>
      <label>WhatsApp com DDD<input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="(11) 9 9999-9999" required value="${esc(saved.phone || "")}"></label>
    </div>
    <label>Recado (opcional)<textarea name="mensagem" rows="2" maxlength="500" placeholder="Ex.: posso buscar no culto de domingo"></textarea></label>
    <label class="lib-hp" aria-hidden="true">Não preencha<input name="site" type="text" tabindex="-1" autocomplete="off"></label>
    <label class="lib-consent"><input name="consent" type="checkbox" required> Concordo que a equipe da biblioteca use meu nome e WhatsApp só para combinar este empréstimo. <a href="/privacidade">Privacidade</a></label>
    <p class="lib-form-error" id="libFormError" role="alert" hidden></p>
    <button class="btn btn-primary" type="submit" id="libSendBtn">${wantsQueue ? "Entrar na fila" : "Enviar pedido"}</button>
  </form>`;
}

function libOpenRequest() {
  const box = document.getElementById("libRequest");
  if (!box) return;
  box.hidden = false;
  document.getElementById("libWantBtn")?.setAttribute("aria-expanded", "true");
  box.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  setTimeout(() => box.querySelector("input[name=nome]")?.focus({ preventScroll: true }), 250);
}

const LIB_ERRORS = {
  LIB_NOME: "Digite o seu nome.",
  LIB_TELEFONE: "Confira o número de WhatsApp, com DDD.",
  LIB_LIVRO: "Este livro não está mais no acervo.",
  LIB_MUITOS: "Você já tem 4 pedidos em aberto. Aguarde a equipe falar com você.",
  LIB_LIMITE: "Muitos pedidos agora. Tente de novo daqui a pouco.",
};

async function libSubmitRequest(e, bookId) {
  e.preventDefault();
  const f = e.target;
  const err = document.getElementById("libFormError");
  const btn = document.getElementById("libSendBtn");
  const fail = (msg, input) => {
    err.textContent = msg;
    err.hidden = false;
    input?.focus();
  };
  const name = f.nome.value.trim();
  const phone = f.whatsapp.value.trim();
  if (name.length < 2) return fail(LIB_ERRORS.LIB_NOME, f.nome);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return fail(LIB_ERRORS.LIB_TELEFONE, f.whatsapp);
  if (!f.consent.checked) return fail("Para enviar, marque que concorda com o uso do seu nome e WhatsApp.", f.consent);
  err.hidden = true;
  btn.disabled = true;
  btn.classList.add("loading");
  const { data: r, error } = await supabaseClient.rpc("library_request", {
    p_book: bookId,
    p_name: name,
    p_phone: phone,
    p_message: f.mensagem.value.trim(),
    p_trap: f.site.value,
  });
  btn.disabled = false;
  btn.classList.remove("loading");
  if (error || !r?.ok) {
    const code = Object.keys(LIB_ERRORS).find((k) => (error?.message || "").includes(k));
    return fail(code ? LIB_ERRORS[code] : navigator.onLine ? "Não foi possível enviar agora. Tente de novo." : "Você está sem internet.");
  }
  try {
    localStorage.setItem(LIB_CONTACT_KEY, JSON.stringify({ name, phone }));
    const mine = libMine();
    mine[bookId] = { at: spToday(), kind: r.kind, position: r.position };
    localStorage.setItem(LIB_MINE_KEY, JSON.stringify(mine));
  } catch {}
  const box = document.getElementById("libRequest");
  box.innerHTML = `<div class="lib-sent" role="status">
    <span class="lib-sent-icon">${icon("check", 22)}</span>
    <div><strong>${r.repeated ? "Você já tinha pedido este livro" : "Pedido enviado!"}</strong>
    <p>${
      r.kind === "fila"
        ? `Você é o ${r.position}º na fila de espera. Quando o livro voltar, a equipe da biblioteca avisa você pelo WhatsApp.`
        : "A equipe da biblioteca vai falar com você pelo WhatsApp para combinar a retirada no próximo culto."
    }</p></div>
  </div>`;
  document.getElementById("libWantBtn")?.remove();
  LIB.loadedAt = 0; // situação mudou
}

async function libShare() {
  const title = document.querySelector(".lib-book-info h1")?.textContent || "Biblioteca dos Jovens";
  try {
    if (navigator.share) await navigator.share({ title, url: location.href });
    else {
      await copyText(location.href);
      showToast("Link copiado!", "success");
    }
  } catch (e) {
    if (e?.name !== "AbortError") showToast("Não foi possível compartilhar.", "error");
  }
}
