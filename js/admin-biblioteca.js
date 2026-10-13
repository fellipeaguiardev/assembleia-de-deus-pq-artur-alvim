/* ============================================================
   PAINEL — BIBLIOTECA DOS JOVENS
   ------------------------------------------------------------
   Resumo (atrasos, vencimentos, pedidos), empréstimos, pedidos e
   fila de espera, acervo, leitores e regras. As regras da planilha
   da biblioteca viram checagens: limite de livros por pessoa,
   suspensão por atraso, renovação (só sem atraso e sem fila, até o
   limite) e a ordem da fila.
   Nomes e telefones só existem aqui: a RLS do banco libera essas
   tabelas apenas para os e-mails de admin.
   ============================================================ */
const libAdmin = {
  loaded: false,
  loading: false,
  missing: false,
  error: "",
  books: [],
  readers: [],
  loans: [],
  requests: [],
  view: "resumo",
  q: "",
  cat: "",
  readerQ: "",
  editing: null, // livro sendo editado (cópia)
  editingReader: null,
  lend: null, // formulário de novo empréstimo
  returning: null, // id do empréstimo sendo devolvido
  addQueue: null,
  covers: null, // resultados da busca de capa
  importing: false,
  importMsg: "",
  saving: false,
};

// Abas da planilha usada até aqui (aba → categoria). O link da planilha não
// fica no código (ela tem nomes de quem pegou livros): na importação, quem
// administra cola o link. A leitura é feita pelo endereço de exportação do
// Google, direto do navegador de quem administra.
const LIB_SHEET_TABS = [
  ["954202693", "Teologia Sistemática"],
  ["1591574927", "Teologia Bíblica"],
  ["33228892", "Teologia Exegética"],
  ["1063897307", "Teologia Prática"],
  ["1710770784", "Teologia Histórica"],
  ["298780643", "História Geral"],
  ["1307237096", "Literatura e Ficção"],
  ["638676174", "Filosofia"],
  ["1020164895", "Literatura de Autoajuda"],
];
const LIB_OPEN = ["novo", "fila", "avisado"];
const LIB_REQ_STATUS = {
  novo: { label: "Novo pedido", cls: "st-review" },
  fila: { label: "Na fila", cls: "st-draft" },
  avisado: { label: "Avisado", cls: "st-scheduled" },
  atendido: { label: "Atendido", cls: "st-live" },
  cancelado: { label: "Cancelado", cls: "st-draft" },
};

/* ---------- Dados ---------- */
async function loadLibAdmin() {
  libAdmin.loading = true;
  const [b, r, l, q] = await Promise.all([
    db("library_books").select("*").order("title"),
    db("library_readers").select("*").order("name"),
    db("library_loans").select("*").order("loaned_on", { ascending: false }),
    db("library_requests").select("*").order("created_at"),
  ]);
  const err = b.error || r.error || l.error || q.error;
  libAdmin.loading = false;
  libAdmin.loaded = true;
  if (err) {
    libAdmin.missing = libIsMissing(err);
    libAdmin.error = err.message;
    if (adminTab === "biblioteca") renderAdmin();
    return;
  }
  libAdmin.missing = false;
  libAdmin.error = "";
  libAdmin.books = b.data || [];
  libAdmin.readers = r.data || [];
  libAdmin.loans = l.data || [];
  libAdmin.requests = q.data || [];
  LIB.loadedAt = 0; // a página pública relê a situação
  libCleanupOldRequests();
  if (adminTab === "biblioteca") renderAdmin();
}

// LGPD: pedidos concluídos ou cancelados há mais de 6 meses são apagados.
function libCleanupOldRequests() {
  const limit = new Date(Date.now() - 183 * 864e5).toISOString();
  const old = libAdmin.requests.filter((x) => ["atendido", "cancelado"].includes(x.status) && x.updated_at < limit);
  if (!old.length) return;
  db("library_requests")
    .delete()
    .in("id", old.map((x) => x.id))
    .then(({ error }) => {
      if (!error) libAdmin.requests = libAdmin.requests.filter((x) => !old.includes(x));
    });
}

const libBook = (id) => libAdmin.books.find((b) => b.id === id);
const libReader = (id) => libAdmin.readers.find((r) => r.id === id);
const libOpenLoan = (bookId) => libAdmin.loans.find((l) => l.book_id === bookId && !l.returned_on);
const libReaderOpen = (readerId) => libAdmin.loans.filter((l) => l.reader_id === readerId && !l.returned_on);
const libQueue = (bookId) => libAdmin.requests.filter((x) => x.book_id === bookId && LIB_OPEN.includes(x.status)).sort((a, b) => a.created_at.localeCompare(b.created_at));
const libDigits = (p) => String(p || "").replace(/\D/g, "");
const libDays = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const libLate = (loan, on = spToday()) => Math.max(0, libDays(loan.due_on, loan.returned_on || on));
const libNum = (k, def) => Math.max(0, Number(data.library?.[k]) || def);

// Suspensão: atraso devolvido conta como dias de suspensão a partir da devolução.
function libSuspension(readerId) {
  let until = "";
  libAdmin.loans.forEach((l) => {
    if (l.reader_id !== readerId || !l.returned_on) return;
    const late = libLate(l);
    if (late > 0) {
      const end = isoAddDays(l.returned_on, late);
      if (end > until) until = end;
    }
  });
  return until > spToday() ? until : "";
}

function libCanRenew(loan) {
  if (loan.due_on < spToday()) return { ok: false, why: "Em atraso: não pode renovar" };
  if (loan.renewals >= libNum("maxRenewals", 2)) return { ok: false, why: `Já renovado ${loan.renewals}× (limite)` };
  const q = libQueue(loan.book_id).length;
  if (q) return { ok: false, why: `${q} na fila de espera` };
  return { ok: true, why: `Renovar por mais ${libNum("renewDays", 7)} dias` };
}

function libFindReader(name, phone) {
  const d = libDigits(phone);
  const n = normalizeText(name);
  return libAdmin.readers.find((r) => (d.length >= 10 && libDigits(r.phone) === d) || (n && normalizeText(r.name) === n)) || null;
}

const libSameAsReq = (req, readerId, name, phone) =>
  !!req && ((readerId && req.reader_id === readerId) || (libDigits(phone).length >= 10 && libDigits(req.phone) === libDigits(phone)) || (!!name && normalizeText(req.name) === normalizeText(name)));

/* ---------- WhatsApp ---------- */
function libWa(phone, text) {
  let d = libDigits(phone);
  if (d.length < 10) return "";
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
const libFirstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
function libMsg(kind, name, book, date) {
  const t = `“${book?.title || "livro"}”`;
  const hi = `Olá, ${libFirstName(name)}! Aqui é da ${data.library.title || "Biblioteca dos Jovens"} da ${data.church.name}.`;
  if (kind === "lembrete") return `${hi} Passando para lembrar que o livro ${t} vence em ${libDayMonth(date)}. Você pode devolver no culto ou pedir renovação, se não houver fila. Deus abençoe!`;
  if (kind === "atraso") return `${hi} O prazo do livro ${t} venceu em ${libDayMonth(date)}. Consegue devolver no próximo culto? Obrigado!`;
  if (kind === "disponivel") return `${hi} O livro ${t} que você pediu está disponível. Podemos combinar a retirada no próximo culto?`;
  if (kind === "pedido") return `${hi} Recebemos o seu pedido do livro ${t}. Vamos combinar a retirada no próximo culto?`;
  if (kind === "emprestado") return `${hi} Registramos o empréstimo do livro ${t}. A devolução fica para ${libDayMonth(date)}. Boa leitura!`;
  return hi;
}
const libWaBtn = (phone, text, label = "WhatsApp") => {
  const href = libWa(phone, text);
  return href ? `<a class="btn btn-ghost btn-sm lib-wa" href="${esc(href)}" target="_blank" rel="noopener">${icon("whatsapp", 14)} ${label}</a>` : "";
};

/* ---------- Aba ---------- */
function tabBiblioteca() {
  const head = topbar("Biblioteca dos Jovens", `<a class="btn btn-ghost btn-sm" href="/biblioteca" target="_blank" rel="noopener">${icon("external", 14)} Ver no site</a>`);
  if (!libAdmin.loaded) {
    if (!libAdmin.loading) loadLibAdmin();
    return head + `<div class="admin-card"><div class="admin-empty">Carregando a biblioteca…</div></div>`;
  }
  if (libAdmin.missing) {
    return (
      head +
      `<div class="admin-card">
        <h3>Falta um passo no banco de dados</h3>
        <p class="admin-note">Para ativar a biblioteca, abra o Supabase → <strong>SQL Editor</strong> → <strong>New query</strong>, cole o arquivo
        <code>supabase/migrations/20261011_biblioteca.sql</code> inteiro e toque em <strong>Run</strong>. Depois volte aqui e toque em “Tentar de novo”.</p>
        <button class="btn btn-primary btn-sm" type="button" onclick="libAdmin.loaded=false;renderAdmin()">Tentar de novo</button>
      </div>`
    );
  }
  if (libAdmin.error) {
    return head + `<div class="admin-card"><p class="admin-note">Não foi possível carregar: ${esc(libAdmin.error)}</p><button class="btn btn-primary btn-sm" type="button" onclick="libAdmin.loaded=false;renderAdmin()">Tentar de novo</button></div>`;
  }
  const today = spToday();
  const open = libAdmin.loans.filter((l) => !l.returned_on);
  const late = open.filter((l) => l.due_on < today).length;
  const reqNew = libAdmin.requests.filter((x) => x.status === "novo").length;
  const views = [
    ["resumo", "Resumo", late + reqNew],
    ["emprestimos", "Empréstimos", open.length],
    ["pedidos", "Pedidos e fila", libAdmin.requests.filter((x) => LIB_OPEN.includes(x.status)).length],
    ["livros", "Livros", libAdmin.books.length],
    ["leitores", "Leitores", libAdmin.readers.length],
    ["regras", "Regras", 0],
  ];
  const body = { resumo: libViewResumo, emprestimos: libViewLoans, pedidos: libViewRequests, livros: libViewBooks, leitores: libViewReaders, regras: libViewRules }[libAdmin.view] || libViewResumo;
  return (
    head +
    `<div class="segmented lib-seg" role="tablist">${views
      .map(([id, label, n]) => `<button type="button" role="tab" class="${libAdmin.view === id ? "active" : ""}" aria-selected="${libAdmin.view === id}" onclick="libSetView('${id}')">${label}${n ? `<span class="lib-count-badge${id === "resumo" ? " hot" : ""}">${n}</span>` : ""}</button>`)
      .join("")}</div>` +
    body()
  );
}

function libSetView(v) {
  libAdmin.view = v;
  libAdmin.editing = null;
  libAdmin.editingReader = null;
  libAdmin.returning = null;
  libAdmin.covers = null;
  renderAdmin();
  document.querySelector(".admin-main")?.scrollTo({ top: 0 });
}

const libBookLine = (b) => (b ? `<strong>${esc(b.title)}</strong>${b.author ? `<small>${esc(b.author)}</small>` : ""}` : "<strong>(livro removido)</strong>");

function libDueChip(loan) {
  const today = spToday();
  if (loan.returned_on) {
    const late = libLate(loan);
    return `<span class="ebd-badge ${late ? "st-review" : "st-live"}">Devolvido ${libDayMonth(loan.returned_on)}${late ? ` · ${late} dia${late > 1 ? "s" : ""} de atraso` : ""}</span>`;
  }
  const d = libDays(today, loan.due_on);
  if (d < 0) return `<span class="ebd-badge lib-st-late">Atrasado ${-d} dia${d < -1 ? "s" : ""}</span>`;
  if (d === 0) return `<span class="ebd-badge st-review">Vence hoje</span>`;
  if (d <= 7) return `<span class="ebd-badge st-scheduled">Vence em ${d} dia${d > 1 ? "s" : ""} (${libDayMonth(loan.due_on)})</span>`;
  return `<span class="ebd-badge st-live">Até ${libDayMonth(loan.due_on)}</span>`;
}

/* ---------- Resumo ---------- */
function libViewResumo() {
  const today = spToday();
  const open = libAdmin.loans.filter((l) => !l.returned_on).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const late = open.filter((l) => l.due_on < today);
  const soon = open.filter((l) => l.due_on >= today && libDays(today, l.due_on) <= 7);
  const fresh = libAdmin.requests.filter((x) => x.status === "novo");
  const notify = libAdmin.books
    .filter((b) => !libOpenLoan(b.id))
    .map((b) => ({ b, first: libQueue(b.id)[0] }))
    .filter((x) => x.first && x.first.status === "fila");
  const free = libAdmin.books.filter((b) => b.visible && !libOpenLoan(b.id)).length;
  const kpi = (n, label, cls = "") => `<div class="lib-kpi ${cls}"><b>${n}</b><span>${label}</span></div>`;
  return `
    <div class="lib-kpis">
      ${kpi(libAdmin.books.length, "livros no acervo")}
      ${kpi(free, "disponíveis")}
      ${kpi(open.length, "emprestados")}
      ${kpi(late.length, "em atraso", late.length ? "bad" : "")}
      ${kpi(fresh.length, "pedidos novos", fresh.length ? "warn" : "")}
    </div>
    ${!libAdmin.books.length ? libImportCardHTML() : ""}
    <div class="admin-card">
      <div class="lib-card-head"><h3>Novo empréstimo</h3><button class="btn btn-primary btn-sm" type="button" onclick="libStartLend()">${icon("book", 14)} Emprestar um livro</button></div>
      <p class="admin-note">Prazo de ${libNum("loanDays", 14)} dias · até ${libNum("maxBooks", 2)} livros por pessoa · renovação de ${libNum("renewDays", 7)} dias (até ${libNum("maxRenewals", 2)}×). Os números ficam em “Regras”.</p>
    </div>
    ${libLoanListCard("Em atraso", late, "Nenhum livro em atraso. 🙌", "atraso")}
    ${libLoanListCard("Vencem nos próximos 7 dias", soon, "Nenhum vencimento nos próximos 7 dias.", "lembrete")}
    <div class="admin-card">
      <h3>Pedidos novos pelo site</h3>
      ${fresh.length ? fresh.map((x) => libRequestRowHTML(x)).join("") : `<p class="admin-note">Nenhum pedido novo. Os pedidos feitos no site aparecem aqui.</p>`}
    </div>
    ${
      notify.length
        ? `<div class="admin-card"><h3>Livros que voltaram e têm fila</h3><p class="admin-note">Avise a próxima pessoa da fila.</p>${notify
            .map(({ b, first }) => `<div class="admin-list-item lib-row"><div class="meta">${libBookLine(b)}<span class="lib-sub">Próximo: ${esc(first.name)}${first.phone ? ` · ${esc(first.phone)}` : ""}</span></div><div class="item-actions">${libWaBtn(first.phone, libMsg("disponivel", first.name, b), "Avisar")}<button class="btn btn-ghost btn-sm" type="button" onclick="libSetRequest('${first.id}','avisado')">Marcar avisado</button><button class="btn btn-primary btn-sm" type="button" onclick="libStartLend('${b.id}','${first.id}')">Emprestar</button></div></div>`)
            .join("")}</div>`
        : ""
    }`;
}

function libLoanListCard(title, loans, emptyText, msgKind) {
  return `<div class="admin-card"><h3>${title}${loans.length ? ` <span class="lib-count-badge${msgKind === "atraso" ? " hot" : ""}">${loans.length}</span>` : ""}</h3>
    ${loans.length ? loans.map((l) => libLoanRowHTML(l, msgKind)).join("") : `<p class="admin-note">${emptyText}</p>`}</div>`;
}

function libLoanRowHTML(l, msgKind = "") {
  const b = libBook(l.book_id);
  const r = libReader(l.reader_id);
  const kind = msgKind || (l.due_on < spToday() ? "atraso" : "lembrete");
  const renew = libCanRenew(l);
  const returning = libAdmin.returning === l.id;
  return `<div class="admin-list-item lib-row${l.due_on < spToday() ? " is-late" : ""}">
    <div class="meta">
      ${libBookLine(b)}
      <span class="lib-sub">${icon("user", 13)} ${esc(r?.name || "?")}${r?.phone ? ` · <a href="tel:${esc(libDigits(r.phone))}">${esc(r.phone)}</a>` : ""} · pegou ${libDayMonth(l.loaned_on)}${l.renewals ? ` · ${l.renewals} renovação${l.renewals > 1 ? "ões" : ""}` : ""}</span>
      ${libDueChip(l)}
    </div>
    <div class="item-actions">
      ${
        returning
          ? `<label class="lib-inline-date">Devolvido em <input type="date" id="libReturnDate" value="${spToday()}" max="${spToday()}"></label>
             <button class="btn btn-primary btn-sm" type="button" onclick="libConfirmReturn('${l.id}')">Confirmar</button>
             <button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.returning=null;renderAdmin()">Cancelar</button>`
          : `${r ? libWaBtn(r.phone, libMsg(kind, r.name, b, l.due_on), kind === "atraso" ? "Cobrar" : "Lembrar") : ""}
             <button class="btn btn-ghost btn-sm" type="button" ${renew.ok ? "" : "disabled"} title="${esc(renew.why)}" onclick="libRenew('${l.id}')">Renovar</button>
             <button class="btn btn-primary btn-sm" type="button" onclick="libAdmin.returning='${l.id}';renderAdmin()">Devolver</button>`
      }
    </div>
    ${!renew.ok && !returning ? `<span class="lib-why">${esc(renew.why)}</span>` : ""}
  </div>`;
}

function libRequestRowHTML(x, pos = 0) {
  const b = libBook(x.book_id);
  const st = LIB_REQ_STATUS[x.status] || LIB_REQ_STATUS.novo;
  const first = libQueue(x.book_id)[0]?.id === x.id;
  const free = b && !libOpenLoan(b.id);
  const open = LIB_OPEN.includes(x.status);
  return `<div class="admin-list-item lib-row">
    <div class="meta">
      ${pos ? `<span class="lib-pos">${pos}º</span>` : libBookLine(b)}
      <span class="lib-sub">${icon("user", 13)} ${esc(x.name)}${x.phone ? ` · <a href="tel:${esc(libDigits(x.phone))}">${esc(x.phone)}</a>` : ""} · ${libDayMonth(x.created_at.slice(0, 10))}${x.source !== "site" ? ` · ${x.source === "planilha" ? "da planilha" : "pela equipe"}` : ""}</span>
      ${x.message ? `<span class="lib-msg">“${esc(x.message)}”</span>` : ""}
      <span class="ebd-badge ${st.cls}">${st.label}${x.kind === "emprestimo" && x.status === "novo" ? " · quer pegar" : x.kind === "fila" && x.status === "novo" ? " · quer entrar na fila" : ""}</span>
    </div>
    ${
      open
        ? `<div class="item-actions">
      ${libWaBtn(x.phone, libMsg(free && first ? (x.status === "novo" ? "pedido" : "disponivel") : "pedido", x.name, b))}
      ${x.status === "novo" ? `<button class="btn btn-ghost btn-sm" type="button" onclick="libSetRequest('${x.id}','fila')">${free && first ? "Reservar" : "Confirmar na fila"}</button>` : ""}
      ${free && first && x.status === "fila" ? `<button class="btn btn-ghost btn-sm" type="button" onclick="libSetRequest('${x.id}','avisado')">Marcar avisado</button>` : ""}
      ${free && first ? `<button class="btn btn-primary btn-sm" type="button" onclick="libStartLend('${x.book_id}','${x.id}')">Emprestar</button>` : ""}
      <button class="btn btn-ghost btn-sm" type="button" onclick="libSetRequest('${x.id}','cancelado')">Cancelar</button>
    </div>`
        : ""
    }
  </div>`;
}

async function libSetRequest(id, status) {
  if (status === "cancelado" && !confirm("Cancelar este pedido?")) return;
  const ok = await dbWrite(db("library_requests").update({ status }).eq("id", id), { fila: "Confirmado na fila", avisado: "Marcado como avisado", cancelado: "Pedido cancelado" }[status] || "Atualizado");
  if (ok) {
    const x = libAdmin.requests.find((r) => r.id === id);
    if (x) x.status = status;
    renderAdmin();
  }
}

/* ---------- Empréstimos ---------- */
function libStartLend(bookId = "", requestId = "") {
  const req = libAdmin.requests.find((x) => x.id === requestId);
  const reader = req ? (req.reader_id && libReader(req.reader_id)) || libFindReader(req.name, req.phone) : null;
  const today = spToday();
  libAdmin.lend = {
    bookId: bookId || req?.book_id || "",
    requestId: req?.id || "",
    readerId: reader?.id || "",
    name: reader?.name || req?.name || "",
    phone: reader?.phone || req?.phone || "",
    loaned_on: today,
    due_on: isoAddDays(today, libNum("loanDays", 14)),
    force: false,
  };
  libAdmin.view = "emprestimos";
  renderAdmin();
  setTimeout(() => document.getElementById("libLendForm")?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
}

const libBookLabel = (b) => `${b.title}${b.author ? " — " + b.author : ""}`;

function libLendFormHTML() {
  const d = libAdmin.lend;
  const book = libBook(d.bookId);
  const free = libAdmin.books.filter((b) => !libOpenLoan(b.id));
  return `<div class="admin-card lib-lend" id="libLendForm">
    <h3>Novo empréstimo</h3>
    <datalist id="libFreeBooks">${free.map((b) => `<option value="${esc(libBookLabel(b))}"></option>`).join("")}</datalist>
    <datalist id="libReaderNames">${libAdmin.readers.map((r) => `<option value="${esc(r.name)}">${esc(r.phone)}</option>`).join("")}</datalist>
    <div class="field-row">
      ${field("Livro", `<input type="text" list="libFreeBooks" value="${esc(book ? libBookLabel(book) : "")}" placeholder="Digite o título" oninput="libLendSet('book', this.value)">`, true)}
      ${field("Quem vai levar", `<input type="text" list="libReaderNames" value="${esc(d.name)}" placeholder="Nome" oninput="libLendSet('name', this.value)">`)}
      ${field("WhatsApp", `<input type="text" inputmode="tel" id="libLendPhone" value="${esc(d.phone)}" placeholder="(11) 9 9999-9999" oninput="libLendSet('phone', this.value)">`)}
      ${field("Retirada", `<input type="date" value="${esc(d.loaned_on)}" onchange="libLendSet('loaned_on', this.value)">`)}
      ${field("Devolução prevista", `<input type="date" id="libLendDue" value="${esc(d.due_on)}" onchange="libLendSet('due_on', this.value)">`)}
    </div>
    <div id="libLendChecks">${libLendChecksHTML()}</div>
    <div class="lib-form-actions">
      <button class="btn btn-primary" type="button" id="libLendSave" onclick="libSaveLend()">Registrar empréstimo</button>
      <button class="btn btn-ghost" type="button" onclick="libAdmin.lend=null;renderAdmin()">Cancelar</button>
    </div>
  </div>`;
}

function libLendSet(key, value) {
  const d = libAdmin.lend;
  if (!d) return;
  if (key === "book") {
    const b = libAdmin.books.find((x) => libBookLabel(x) === value) || libAdmin.books.find((x) => normalizeText(x.title) === normalizeText(value));
    d.bookId = b?.id || "";
  } else if (key === "name") {
    d.name = value;
    const r = libAdmin.readers.find((x) => normalizeText(x.name) === normalizeText(value));
    d.readerId = r?.id || "";
    if (r) {
      d.phone = r.phone;
      const ph = document.getElementById("libLendPhone");
      if (ph) ph.value = r.phone;
    }
  } else if (key === "phone") {
    d.phone = value;
  } else if (key === "loaned_on") {
    d.loaned_on = value;
    d.due_on = isoAddDays(value, libNum("loanDays", 14));
    const due = document.getElementById("libLendDue");
    if (due) due.value = d.due_on;
  } else d[key] = value;
  d.force = false;
  const box = document.getElementById("libLendChecks");
  if (box) box.innerHTML = libLendChecksHTML();
}

// Regras da biblioteca aplicadas no empréstimo.
function libLendChecks() {
  const d = libAdmin.lend;
  const out = [];
  const book = libBook(d.bookId);
  const reader = d.readerId ? libReader(d.readerId) : null;
  if (!book) out.push(["block", "Escolha um livro da lista (só aparecem os disponíveis)."]);
  else {
    const busy = libOpenLoan(book.id);
    if (busy) out.push(["block", `Este livro está com ${libReader(busy.reader_id)?.name || "outra pessoa"} até ${libDayMonth(busy.due_on)}.`]);
    const q = libQueue(book.id);
    if (q.length && !libSameAsReq(q[0], d.readerId, d.name, d.phone)) out.push(["warn", `Há ${q.length} pessoa${q.length > 1 ? "s" : ""} na fila deste livro. A primeira é ${q[0].name}.`]);
  }
  if (d.name.trim().length < 2) out.push(["block", "Escreva o nome de quem vai levar o livro."]);
  if (reader) {
    const mine = libReaderOpen(reader.id);
    const max = libNum("maxBooks", 2);
    if (mine.length >= max) out.push(["warn", `${reader.name} já está com ${mine.length} livro${mine.length > 1 ? "s" : ""} (o limite é ${max}).`]);
    const late = mine.filter((l) => l.due_on < spToday());
    if (late.length) out.push(["warn", `${reader.name} tem livro em atraso (${late.map((l) => libBook(l.book_id)?.title || "?").join(", ")}).`]);
    const susp = libSuspension(reader.id);
    if (susp) out.push(["warn", `${reader.name} está suspenso(a) de novos empréstimos até ${libDayMonth(susp)}, por atraso na devolução.`]);
  } else if (d.name.trim().length >= 2) out.push(["info", "Leitor novo: será cadastrado com este nome e WhatsApp."]);
  if (d.due_on < d.loaned_on) out.push(["block", "A devolução não pode ser antes da retirada."]);
  return out;
}

function libLendChecksHTML() {
  const checks = libLendChecks();
  const warn = checks.some((c) => c[0] === "warn");
  return `${checks.map(([lv, t]) => `<p class="lib-check lib-check-${lv}">${icon(lv === "info" ? "user" : lv === "block" ? "x" : "clock", 14)} ${esc(t)}</p>`).join("")}
    ${warn ? `<label class="lib-force"><input type="checkbox" ${libAdmin.lend.force ? "checked" : ""} onchange="libAdmin.lend.force=this.checked"> Emprestar mesmo assim</label>` : ""}`;
}

async function libSaveLend() {
  const d = libAdmin.lend;
  if (!d || libAdmin.saving) return;
  const checks = libLendChecks();
  if (checks.some((c) => c[0] === "block")) return showToast(checks.find((c) => c[0] === "block")[1], "error");
  if (checks.some((c) => c[0] === "warn") && !d.force) return showToast("Confira os avisos e marque “Emprestar mesmo assim”.", "error");
  libAdmin.saving = true;
  try {
    let reader = d.readerId ? libReader(d.readerId) : libFindReader(d.name, d.phone);
    if (!reader) {
      const { data: r, error } = await db("library_readers").insert({ name: d.name.trim(), phone: d.phone.trim() }).select().single();
      if (error) throw error;
      reader = r;
      libAdmin.readers.push(r);
    } else if (d.phone.trim() && d.phone.trim() !== reader.phone) {
      await db("library_readers").update({ phone: d.phone.trim() }).eq("id", reader.id);
      reader.phone = d.phone.trim();
    }
    const { data: loan, error } = await db("library_loans").insert({ book_id: d.bookId, reader_id: reader.id, loaned_on: d.loaned_on, due_on: d.due_on }).select().single();
    if (error) throw error;
    libAdmin.loans.unshift(loan);
    const req = (d.requestId && libAdmin.requests.find((x) => x.id === d.requestId)) || libQueue(d.bookId).find((x) => libSameAsReq(x, reader.id, reader.name, reader.phone));
    if (req) {
      await db("library_requests").update({ status: "atendido", reader_id: reader.id }).eq("id", req.id);
      req.status = "atendido";
      req.reader_id = reader.id;
    }
    libAdmin.lend = null;
    showToast(`Empréstimo registrado: devolução em ${libDayMonth(loan.due_on)}.`, "success");
    renderAdmin();
    const wa = libWa(reader.phone, libMsg("emprestado", reader.name, libBook(loan.book_id), loan.due_on));
    if (wa) libOfferWa(wa, `Enviar a confirmação para ${libFirstName(reader.name)} pelo WhatsApp?`);
  } catch (e) {
    console.error("Biblioteca:", e);
    showToast(/library_loans_one_open/.test(e.message || "") ? "Este livro já está emprestado." : "Não foi possível salvar o empréstimo.", "error");
  } finally {
    libAdmin.saving = false;
  }
}

// Atalho para mandar a mensagem logo depois de salvar (abre só com o toque da pessoa).
function libOfferWa(href, text) {
  openModal(
    `<div class="modal-pad"><span class="eyebrow">Biblioteca</span><h3>${esc(text)}</h3>
      <div class="lib-form-actions"><a class="btn btn-primary" href="${esc(href)}" target="_blank" rel="noopener" onclick="closeModal()">${icon("whatsapp", 16)} Abrir o WhatsApp</a>
      <button class="btn btn-ghost" type="button" onclick="closeModal()">Agora não</button></div></div>`,
    { label: "WhatsApp" },
  );
}

async function libRenew(id) {
  const l = libAdmin.loans.find((x) => x.id === id);
  if (!l) return;
  const can = libCanRenew(l);
  if (!can.ok) return showToast(can.why, "error");
  const due = isoAddDays(l.due_on, libNum("renewDays", 7));
  const ok = await dbWrite(db("library_loans").update({ due_on: due, renewals: l.renewals + 1 }).eq("id", id), `Renovado até ${libDayMonth(due)}`);
  if (ok) {
    l.due_on = due;
    l.renewals += 1;
    renderAdmin();
  }
}

async function libConfirmReturn(id) {
  const l = libAdmin.loans.find((x) => x.id === id);
  if (!l) return;
  const on = document.getElementById("libReturnDate")?.value || spToday();
  if (on < l.loaned_on) return showToast("A devolução não pode ser antes da retirada.", "error");
  const ok = await dbWrite(db("library_loans").update({ returned_on: on }).eq("id", id), "");
  if (!ok) return;
  l.returned_on = on;
  libAdmin.returning = null;
  const late = libLate(l);
  const r = libReader(l.reader_id);
  showToast(late ? `Devolvido com ${late} dia${late > 1 ? "s" : ""} de atraso: ${libFirstName(r?.name)} fica suspenso(a) até ${libDayMonth(isoAddDays(on, late))}.` : "Devolução registrada. Obrigado!", late ? "error" : "success");
  renderAdmin();
  const next = libQueue(l.book_id)[0];
  const wa = next && libWa(next.phone, libMsg("disponivel", next.name, libBook(l.book_id)));
  if (wa) libOfferWa(wa, `${next.name} é o próximo da fila. Avisar pelo WhatsApp?`);
}

function libViewLoans() {
  const open = libAdmin.loans.filter((l) => !l.returned_on).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const done = libAdmin.loans.filter((l) => l.returned_on).sort((a, b) => b.returned_on.localeCompare(a.returned_on)).slice(0, 40);
  return `
    ${libAdmin.lend ? libLendFormHTML() : `<div class="admin-card lib-card-head"><h3>Emprestados agora</h3><button class="btn btn-primary btn-sm" type="button" onclick="libStartLend()">${icon("book", 14)} Novo empréstimo</button></div>`}
    <div class="admin-card">
      ${libAdmin.lend ? "<h3>Emprestados agora</h3>" : ""}
      ${open.length ? open.map((l) => libLoanRowHTML(l)).join("") : `<p class="admin-note">Nenhum livro emprestado agora.</p>`}
    </div>
    <div class="admin-card">
      <h3>Devolvidos recentemente</h3>
      ${
        done.length
          ? done
              .map((l) => {
                const r = libReader(l.reader_id);
                return `<div class="admin-list-item lib-row"><div class="meta">${libBookLine(libBook(l.book_id))}<span class="lib-sub">${icon("user", 13)} ${esc(r?.name || "?")} · ${libDayMonth(l.loaned_on)} → ${libDayMonth(l.returned_on)}</span>${libDueChip(l)}</div></div>`;
              })
              .join("")
          : `<p class="admin-note">Ainda não há devoluções registradas.</p>`
      }
    </div>`;
}

/* ---------- Pedidos e fila ---------- */
function libViewRequests() {
  const books = [...new Set(libAdmin.requests.filter((x) => LIB_OPEN.includes(x.status)).map((x) => x.book_id))].map(libBook).filter(Boolean);
  const closed = libAdmin.requests.filter((x) => !LIB_OPEN.includes(x.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30);
  const a = libAdmin.addQueue;
  return `
    <div class="admin-card">
      <div class="lib-card-head"><h3>Adicionar alguém à fila</h3>${a ? "" : `<button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.addQueue={bookId:'',name:'',phone:''};renderAdmin()">+ Adicionar</button>`}</div>
      ${
        a
          ? `<datalist id="libAllBooks">${libAdmin.books.map((b) => `<option value="${esc(libBookLabel(b))}"></option>`).join("")}</datalist>
        <div class="field-row">
          ${field("Livro", `<input type="text" list="libAllBooks" placeholder="Digite o título" oninput="libAdmin.addQueue.bookId=(libAdmin.books.find(b=>libBookLabel(b)===this.value)||{}).id||''">`, true)}
          ${field("Nome", `<input type="text" oninput="libAdmin.addQueue.name=this.value">`)}
          ${field("WhatsApp", `<input type="text" inputmode="tel" oninput="libAdmin.addQueue.phone=this.value">`)}
        </div>
        <div class="lib-form-actions"><button class="btn btn-primary btn-sm" type="button" onclick="libSaveQueue()">Adicionar à fila</button><button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.addQueue=null;renderAdmin()">Cancelar</button></div>`
          : `<p class="admin-note">Para quem pediu pessoalmente. Pedidos feitos no site entram aqui sozinhos.</p>`
      }
    </div>
    ${
      books.length
        ? books
            .map((b) => {
              const busy = libOpenLoan(b.id);
              return `<div class="admin-card"><div class="lib-card-head"><div>${libBookLine(b)}</div>${busy ? libDueChip(busy) : `<span class="ebd-badge st-live">Disponível</span>`}</div>
                ${libQueue(b.id).map((x, i) => libRequestRowHTML(x, i + 1)).join("")}</div>`;
            })
            .join("")
        : `<div class="admin-card"><p class="admin-note">Ninguém na fila de espera.</p></div>`
    }
    ${
      closed.length
        ? `<details class="admin-card lib-closed"><summary>Pedidos concluídos ou cancelados (${closed.length})</summary>${closed.map((x) => libRequestRowHTML(x)).join("")}
           <p class="admin-note">Pedidos concluídos ou cancelados são apagados sozinhos depois de 6 meses (LGPD).</p></details>`
        : ""
    }`;
}

async function libSaveQueue() {
  const a = libAdmin.addQueue;
  if (!a?.bookId) return showToast("Escolha o livro da lista.", "error");
  if ((a.name || "").trim().length < 2) return showToast("Escreva o nome.", "error");
  const kind = libOpenLoan(a.bookId) || libQueue(a.bookId).length ? "fila" : "emprestimo";
  const { data: x, error } = await db("library_requests").insert({ book_id: a.bookId, name: a.name.trim(), phone: (a.phone || "").trim(), kind, status: "fila", source: "equipe" }).select().single();
  if (error) return showToast("Não foi possível adicionar.", "error");
  libAdmin.requests.push(x);
  libAdmin.addQueue = null;
  showToast(`Adicionado à fila (${libQueue(a.bookId).length}º).`, "success");
  renderAdmin();
}

/* ---------- Livros ---------- */
function libStateAdmin(b) {
  const loan = libOpenLoan(b.id);
  if (loan) return libDueChip(loan);
  const q = libQueue(b.id).length;
  return q ? `<span class="ebd-badge st-review">Reservado · ${q} na fila</span>` : `<span class="ebd-badge st-live">Disponível</span>`;
}

function libViewBooks() {
  if (libAdmin.editing) return libBookFormHTML();
  const cats = libSortCats(new Set(libAdmin.books.map((b) => b.category).filter(Boolean)));
  const words = normalizeText(libAdmin.q).split(/\s+/).filter(Boolean);
  const list = libAdmin.books.filter((b) => (!libAdmin.cat || b.category === libAdmin.cat) && words.every((w) => normalizeText(`${b.title} ${b.author} ${b.owner}`).includes(w)));
  return `
    <div class="admin-card">
      <div class="lib-toolbar">
        <input type="search" class="lib-search" placeholder="Buscar título, autor ou dono" value="${esc(libAdmin.q)}" oninput="libAdmin.q=this.value;libRefreshBookList()">
        <select onchange="libAdmin.cat=this.value;libRefreshBookList()"><option value="">Todas as categorias</option>${cats.map((c) => `<option ${libAdmin.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <button class="btn btn-primary btn-sm" type="button" onclick="libEditBook()">+ Novo livro</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="libExportCSV('acervo')">Exportar planilha</button>
      </div>
      <div id="libBookList">${libBookListHTML(list)}</div>
    </div>`;
}

function libBookListHTML(list) {
  if (!list.length) return `<p class="admin-note">Nenhum livro encontrado.</p>`;
  return `<p class="admin-note">${list.length} livro${list.length > 1 ? "s" : ""}</p>` + list
    .map((b) => `<div class="admin-list-item lib-row lib-book-row">
      ${libCoverHTML(b, "xs")}
      <div class="meta">${libBookLine(b)}<span class="lib-sub">${esc(b.category || "Sem categoria")}${b.owner ? ` · de ${esc(b.owner)}` : ""}${b.visible ? "" : " · <strong>oculto no site</strong>"}</span>${libStateAdmin(b)}</div>
      <div class="item-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="libEditBook('${b.id}')">Editar</button></div>
    </div>`)
    .join("");
}

function libRefreshBookList() {
  const words = normalizeText(libAdmin.q).split(/\s+/).filter(Boolean);
  const list = libAdmin.books.filter((b) => (!libAdmin.cat || b.category === libAdmin.cat) && words.every((w) => normalizeText(`${b.title} ${b.author} ${b.owner}`).includes(w)));
  const box = document.getElementById("libBookList");
  if (box) box.innerHTML = libBookListHTML(list);
}

function libEditBook(id) {
  const b = id ? libBook(id) : null;
  libAdmin.editing = b ? { ...b } : { id: "", title: "", author: "", category: libAdmin.cat || "", synopsis: "", cover_url: "", owner: "", notes: "", visible: true };
  libAdmin.covers = null;
  libAdmin.view = "livros";
  renderAdmin();
  document.querySelector(".admin-main")?.scrollTo({ top: 0 });
}

function libBookFormHTML() {
  const b = libAdmin.editing;
  const cats = libSortCats(new Set([...LIB_CATEGORIES, ...libAdmin.books.map((x) => x.category).filter(Boolean)]));
  const history = b.id ? libAdmin.loans.filter((l) => l.book_id === b.id) : [];
  const set = (k) => `oninput="libAdmin.editing.${k}=this.value"`;
  return `<div class="admin-card">
    <button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.editing=null;libAdmin.covers=null;renderAdmin()">${icon("arrowBack", 14)} Voltar para os livros</button>
    <h3 class="mt-12">${b.id ? "Editar livro" : "Novo livro"}</h3>
    <datalist id="libCats">${cats.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
    <div class="lib-edit">
      <div class="lib-edit-cover">
        <div id="libCoverPreview">${libCoverHTML(b, "lg")}</div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="libSearchCovers()">${icon("search", 14)} Buscar capa</button>
        <label class="btn btn-ghost btn-sm upload-label">${icon("camera", 14)} Foto da capa<input type="file" accept="image/*" hidden onchange="libUploadCover(this)"></label>
        ${b.cover_url ? `<button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.editing.cover_url='';renderAdmin()">Tirar capa</button>` : ""}
      </div>
      <div class="lib-edit-fields">
        <div class="field-row">
          ${field("Título", `<input type="text" value="${esc(b.title)}" maxlength="300" ${set("title")}>`, true)}
          ${field("Autor", `<input type="text" value="${esc(b.author)}" maxlength="200" ${set("author")}>`)}
          ${field("Categoria", `<input type="text" list="libCats" value="${esc(b.category)}" maxlength="80" ${set("category")}>`)}
        </div>
        ${field("Sinopse", `<textarea rows="6" maxlength="8000" ${set("synopsis")}>${esc(b.synopsis)}</textarea>`, true)}
        ${field("Endereço da imagem da capa (opcional)", `<input type="url" value="${esc(b.cover_url)}" placeholder="https://…" onchange="libAdmin.editing.cover_url=this.value.trim();libRefreshCover()">`, true)}
        <div class="field-row">
          ${field("Dono do exemplar (não aparece no site)", `<input type="text" value="${esc(b.owner)}" maxlength="120" ${set("owner")}>`)}
          ${field("Observações da equipe (não aparecem no site)", `<input type="text" value="${esc(b.notes)}" maxlength="1000" ${set("notes")}>`)}
        </div>
        <label class="lib-check-line"><input type="checkbox" ${b.visible ? "checked" : ""} onchange="libAdmin.editing.visible=this.checked"> Mostrar no site</label>
      </div>
    </div>
    ${libAdmin.covers ? libCoverResultsHTML() : ""}
    <div class="lib-form-actions">
      <button class="btn btn-primary" type="button" onclick="libSaveBook()">Salvar livro</button>
      ${b.id ? `<button class="btn btn-ghost lib-danger" type="button" onclick="libDeleteBook('${b.id}')">Excluir</button>` : ""}
    </div>
    ${
      history.length
        ? `<h3 class="mt-12">Histórico deste livro</h3>${history
            .map((l) => `<div class="admin-list-item lib-row"><div class="meta"><span class="lib-sub">${icon("user", 13)} ${esc(libReader(l.reader_id)?.name || "?")} · ${libDayMonth(l.loaned_on)}${l.returned_on ? ` → ${libDayMonth(l.returned_on)}` : ""}</span>${libDueChip(l)}</div></div>`)
            .join("")}`
        : ""
    }
  </div>`;
}

function libRefreshCover() {
  const box = document.getElementById("libCoverPreview");
  if (box) box.innerHTML = libCoverHTML(libAdmin.editing, "lg");
}

async function libSaveBook() {
  const b = libAdmin.editing;
  if (!b || libAdmin.saving) return;
  if (!b.title.trim()) return showToast("Escreva o título.", "error");
  const cover = b.cover_url.trim();
  if (cover && !safeUrl(cover).startsWith("https://")) return showToast("O endereço da capa precisa começar com https://", "error");
  const row = { title: b.title.trim(), author: b.author.trim(), category: b.category.trim(), synopsis: b.synopsis.trim(), cover_url: cover, owner: b.owner.trim(), notes: b.notes.trim(), visible: !!b.visible };
  libAdmin.saving = true;
  const q = b.id ? db("library_books").update(row).eq("id", b.id).select().single() : db("library_books").insert(row).select().single();
  const saved = await dbWrite(q, b.id ? "Livro salvo" : "Livro adicionado ao acervo");
  libAdmin.saving = false;
  if (!saved || saved === true) return;
  const i = libAdmin.books.findIndex((x) => x.id === saved.id);
  if (i >= 0) libAdmin.books[i] = saved;
  else libAdmin.books.push(saved);
  libAdmin.books.sort((x, y) => x.title.localeCompare(y.title, "pt-BR"));
  libAdmin.editing = null;
  libAdmin.covers = null;
  LIB.loadedAt = 0;
  renderAdmin();
}

async function libDeleteBook(id) {
  const b = libBook(id);
  if (!b) return;
  if (libOpenLoan(id)) return showToast("Este livro está emprestado. Registre a devolução antes de excluir.", "error");
  if (!confirm(`Excluir “${b.title}” do acervo? O histórico de empréstimos deste livro também será apagado.\n\nSe for só para tirar do site, desmarque “Mostrar no site”.`)) return;
  const ok = await dbWrite(db("library_books").delete().eq("id", id), "Livro excluído");
  if (!ok) return;
  libAdmin.books = libAdmin.books.filter((x) => x.id !== id);
  libAdmin.loans = libAdmin.loans.filter((l) => l.book_id !== id);
  libAdmin.requests = libAdmin.requests.filter((x) => x.book_id !== id);
  libAdmin.editing = null;
  LIB.loadedAt = 0;
  renderAdmin();
}

// Capas do Open Library (acervo aberto). A equipe escolhe a certa.
async function libSearchCovers() {
  const b = libAdmin.editing;
  if (!b?.title.trim()) return showToast("Escreva o título primeiro.", "error");
  libAdmin.covers = { loading: true, items: [] };
  renderAdmin();
  const ask = async (params) => {
    const r = await fetch(`https://openlibrary.org/search.json?${params}&limit=16&fields=cover_i,title,author_name`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return ((await r.json()).docs || []).filter((d) => d.cover_i);
  };
  try {
    let docs = await ask(`title=${encodeURIComponent(b.title)}${b.author ? `&author=${encodeURIComponent(b.author)}` : ""}`);
    if (!docs.length) docs = await ask(`q=${encodeURIComponent(`${b.title} ${b.author}`.trim())}`);
    libAdmin.covers = { loading: false, items: docs.slice(0, 12).map((d) => ({ url: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`, title: d.title, author: (d.author_name || []).join(", ") })) };
  } catch (e) {
    console.error("Capas:", e);
    libAdmin.covers = { loading: false, items: [], error: true };
  }
  if (libAdmin.editing) renderAdmin();
}

function libCoverResultsHTML() {
  const c = libAdmin.covers;
  if (c.loading) return `<p class="admin-note">Procurando capas…</p>`;
  if (!c.items.length) return `<p class="admin-note">${c.error ? "Não foi possível buscar agora." : "Nenhuma capa encontrada."} Você pode tirar uma foto do livro com “Foto da capa”.</p>`;
  return `<div class="lib-cover-results"><p class="admin-note">Toque na capa certa (confira a edição):</p><div class="lib-cover-grid">${c.items
    .map((it) => `<button type="button" class="lib-cover-pick" data-url="${esc(it.url)}" onclick="libAdmin.editing.cover_url=this.dataset.url;libAdmin.covers=null;renderAdmin()" title="${esc(it.title)}${it.author ? " — " + esc(it.author) : ""}"><img src="${esc(it.url)}" alt="" loading="lazy"><span>${esc(truncate(it.title, 40))}</span></button>`)
    .join("")}</div></div>`;
}

// Foto tirada no celular: diminui antes de enviar (capa não precisa de 12 MP).
function libShrinkImage(file, max = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => (blob ? resolve(new File([blob], "capa.jpg", { type: "image/jpeg" })) : reject(new Error("imagem"))), "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem"));
    };
    img.src = url;
  });
}

async function libUploadCover(input) {
  const file = input.files?.[0];
  if (!file || !libAdmin.editing) return;
  showToast("Enviando a foto da capa…");
  try {
    const small = await libShrinkImage(file).catch(() => file);
    libAdmin.editing.cover_url = await uploadFile(small, "biblioteca");
    showToast("Capa enviada. Toque em “Salvar livro”.", "success");
    renderAdmin();
  } catch (e) {
    console.error("Capa:", e);
    showToast(e.userMessage || "Não foi possível enviar a foto.", "error");
  }
}

/* ---------- Leitores ---------- */
function libViewReaders() {
  const e = libAdmin.editingReader;
  if (e) {
    const hist = libAdmin.loans.filter((l) => l.reader_id === e.id);
    return `<div class="admin-card">
      <button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.editingReader=null;renderAdmin()">${icon("arrowBack", 14)} Voltar para os leitores</button>
      <h3 class="mt-12">${e.id ? "Editar leitor" : "Novo leitor"}</h3>
      <div class="field-row">
        ${field("Nome", `<input type="text" value="${esc(e.name)}" maxlength="120" oninput="libAdmin.editingReader.name=this.value">`)}
        ${field("WhatsApp", `<input type="text" inputmode="tel" value="${esc(e.phone)}" maxlength="40" oninput="libAdmin.editingReader.phone=this.value">`)}
      </div>
      ${field("Observações", `<input type="text" value="${esc(e.notes)}" maxlength="1000" oninput="libAdmin.editingReader.notes=this.value">`, true)}
      <div class="lib-form-actions"><button class="btn btn-primary" type="button" onclick="libSaveReader()">Salvar</button>
      ${e.id && !hist.length ? `<button class="btn btn-ghost lib-danger" type="button" onclick="libDeleteReader('${e.id}')">Excluir</button>` : ""}</div>
      ${hist.length ? `<h3 class="mt-12">Histórico</h3>${hist.map((l) => `<div class="admin-list-item lib-row"><div class="meta">${libBookLine(libBook(l.book_id))}<span class="lib-sub">${libDayMonth(l.loaned_on)}${l.returned_on ? ` → ${libDayMonth(l.returned_on)}` : ""}</span>${libDueChip(l)}</div></div>`).join("")}` : ""}
    </div>`;
  }
  const words = normalizeText(libAdmin.readerQ).split(/\s+/).filter(Boolean);
  const list = libAdmin.readers.filter((r) => words.every((w) => normalizeText(`${r.name} ${r.phone}`).includes(w)));
  return `<div class="admin-card">
    <div class="lib-toolbar">
      <input type="search" class="lib-search" placeholder="Buscar leitor" value="${esc(libAdmin.readerQ)}" oninput="libAdmin.readerQ=this.value;renderAdmin();setTimeout(()=>{const i=document.querySelector('.lib-search');i&&(i.focus(),i.setSelectionRange(i.value.length,i.value.length))})">
      <button class="btn btn-primary btn-sm" type="button" onclick="libAdmin.editingReader={id:'',name:'',phone:'',notes:''};renderAdmin()">+ Novo leitor</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick="libExportCSV('emprestimos')">Exportar empréstimos</button>
    </div>
    ${
      list.length
        ? list
            .map((r) => {
              const open = libReaderOpen(r.id);
              const late = open.filter((l) => l.due_on < spToday()).length;
              const susp = libSuspension(r.id);
              const total = libAdmin.loans.filter((l) => l.reader_id === r.id).length;
              const tag = late ? `<span class="ebd-badge lib-st-late">${late} em atraso</span>` : susp ? `<span class="ebd-badge st-review">Suspenso até ${libDayMonth(susp)}</span>` : "";
              return `<div class="admin-list-item lib-row"><div class="meta"><strong>${esc(r.name)}</strong><span class="lib-sub">${r.phone ? `<a href="tel:${esc(libDigits(r.phone))}">${esc(r.phone)}</a> · ` : ""}${open.length} com ele(a) agora · ${total} no total</span>${tag}</div>
                <div class="item-actions">${libWaBtn(r.phone, libMsg("", r.name))}<button class="btn btn-ghost btn-sm" type="button" onclick="libAdmin.editingReader={...libReader('${r.id}')};renderAdmin()">Abrir</button></div></div>`;
            })
            .join("")
        : `<p class="admin-note">Nenhum leitor${libAdmin.readerQ ? " encontrado" : " ainda. Eles são cadastrados ao registrar um empréstimo"}.</p>`
    }
  </div>`;
}

async function libSaveReader() {
  const e = libAdmin.editingReader;
  if (!e || (e.name || "").trim().length < 2) return showToast("Escreva o nome.", "error");
  const row = { name: e.name.trim(), phone: (e.phone || "").trim(), notes: (e.notes || "").trim() };
  const q = e.id ? db("library_readers").update(row).eq("id", e.id).select().single() : db("library_readers").insert(row).select().single();
  const saved = await dbWrite(q, "Leitor salvo");
  if (!saved || saved === true) return;
  const i = libAdmin.readers.findIndex((x) => x.id === saved.id);
  if (i >= 0) libAdmin.readers[i] = saved;
  else libAdmin.readers.push(saved);
  libAdmin.readers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  libAdmin.editingReader = null;
  renderAdmin();
}

async function libDeleteReader(id) {
  if (!confirm("Excluir este leitor?")) return;
  const ok = await dbWrite(db("library_readers").delete().eq("id", id), "Leitor excluído");
  if (!ok) return;
  libAdmin.readers = libAdmin.readers.filter((r) => r.id !== id);
  libAdmin.editingReader = null;
  renderAdmin();
}

/* ---------- Regras ---------- */
function libViewRules() {
  const L = data.library;
  const num = (k, label, min, max) => field(label, `<input type="number" min="${min}" max="${max}" value="${Number(L[k]) || 0}" onchange="libSetRuleNum('${k}', this.value, ${min}, ${max})">`);
  return `<div class="admin-card">
      <h3>Números usados pelo painel</h3>
      <div class="field-row lib-nums">
        ${num("loanDays", "Prazo do empréstimo (dias)", 1, 90)}
        ${num("maxBooks", "Livros por pessoa", 1, 10)}
        ${num("renewDays", "Renovação (dias)", 1, 60)}
        ${num("maxRenewals", "Renovações permitidas", 0, 10)}
      </div>
      <p class="admin-note">Se mudar algum número, ajuste também o texto da regra abaixo.</p>
    </div>
    <div class="admin-card">
      <h3>Página da biblioteca</h3>
      ${field("Título", `<input type="text" value="${esc(L.title)}" maxlength="80" onchange="data.library.title=this.value.trim()||'Biblioteca dos Jovens';persist()">`, true)}
      ${field("Apresentação", `<textarea rows="2" maxlength="400" onchange="data.library.intro=this.value.trim();persist()">${esc(L.intro)}</textarea>`, true)}
    </div>
    <div class="admin-card">
      <div class="lib-card-head"><h3>Regras de empréstimo (aparecem no site)</h3><button class="btn btn-ghost btn-sm" type="button" onclick="libRuleAdd()">+ Regra</button></div>
      ${(L.rules || [])
        .map(
          (r, i) => `<div class="admin-subcard lib-rule-edit">
        <div class="lib-rule-head"><b>${i + 1}.</b><input type="text" value="${esc(r.t)}" maxlength="80" placeholder="Título" onchange="libRuleSet(${i},'t',this.value)">
          <button class="icon-btn" type="button" onclick="libRuleMove(${i},-1)" aria-label="Subir" ${i ? "" : "disabled"}>↑</button>
          <button class="icon-btn" type="button" onclick="libRuleMove(${i},1)" aria-label="Descer" ${i < L.rules.length - 1 ? "" : "disabled"}>↓</button>
          <button class="icon-btn" type="button" onclick="libRuleDel(${i})" aria-label="Excluir regra">🗑️</button></div>
        <textarea rows="2" maxlength="600" onchange="libRuleSet(${i},'d',this.value)">${esc(r.d)}</textarea>
      </div>`,
        )
        .join("")}
    </div>
    <div class="admin-card">
      <h3>Planilha</h3>
      <p class="admin-note">Exporte o acervo e os empréstimos para abrir no Excel ou no Google Planilhas.</p>
      <div class="lib-form-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="libExportCSV('acervo')">Exportar acervo</button><button class="btn btn-ghost btn-sm" type="button" onclick="libExportCSV('emprestimos')">Exportar empréstimos</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick="libImportSheet()" ${libAdmin.importing ? "disabled" : ""}>Importar da planilha antiga (só livros que faltam)</button></div>
      ${libAdmin.importMsg ? `<p class="admin-note">${esc(libAdmin.importMsg)}</p>` : ""}
    </div>`;
}

function libSetRuleNum(k, v, min, max) {
  data.library[k] = Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  persist();
}
function libRuleSet(i, k, v) {
  data.library.rules[i][k] = v.trim();
  persist();
}
function libRuleAdd() {
  data.library.rules = [...(data.library.rules || []), { t: "", d: "" }];
  persist({ rerenderAdmin: true });
}
function libRuleDel(i) {
  if (!confirm("Excluir esta regra?")) return;
  data.library.rules.splice(i, 1);
  persist({ rerenderAdmin: true });
}
function libRuleMove(i, dir) {
  const r = data.library.rules;
  const j = i + dir;
  if (j < 0 || j >= r.length) return;
  [r[i], r[j]] = [r[j], r[i]];
  persist({ rerenderAdmin: true });
}

/* ---------- Planilha: exportar e importar ---------- */
function libExportCSV(kind) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let rows;
  if (kind === "acervo") {
    rows = [["Título", "Autor", "Categoria", "Situação", "Com", "Devolução prevista", "Na fila", "Dono do exemplar", "No site", "Sinopse"]];
    libAdmin.books.forEach((b) => {
      const l = libOpenLoan(b.id);
      rows.push([b.title, b.author, b.category, l ? "Emprestado" : "Disponível", l ? libReader(l.reader_id)?.name : "", l ? libDayMonth(l.due_on) : "", libQueue(b.id).length, b.owner, b.visible ? "sim" : "não", b.synopsis]);
    });
  } else {
    rows = [["Livro", "Leitor", "WhatsApp", "Retirada", "Devolução prevista", "Devolvido em", "Dias de atraso", "Renovações"]];
    libAdmin.loans.forEach((l) => {
      const r = libReader(l.reader_id);
      rows.push([libBook(l.book_id)?.title, r?.name, r?.phone, l.loaned_on, l.due_on, l.returned_on || "", libLate(l), l.renewals]);
    });
  }
  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `biblioteca-${kind}-${spToday()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

function libParseCSV(text) {
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

// "27/09/26" ou "27/09/2026" → "2026-09-27"
function libBRDate(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(v || "").trim());
  if (!m) return "";
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return parseISODate(iso) ? iso : "";
}

function libImportCardHTML() {
  return `<div class="admin-card lib-import">
    <h3>Trazer os livros da planilha</h3>
    <p class="admin-note">Importa as ${LIB_SHEET_TABS.length} abas da planilha da biblioteca (título, autor, categoria, sinopse e dono), os empréstimos em andamento e a fila de espera. Pode tocar de novo sem medo: livros que já existem são pulados.</p>
    <div class="field"><label for="libSheetUrl">Link da planilha (Google Planilhas)</label><input type="url" id="libSheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…"></div>
    <button class="btn btn-primary" type="button" onclick="libImportSheet()" ${libAdmin.importing ? "disabled" : ""}>${libAdmin.importing ? "Importando…" : "Importar da planilha"}</button>
    ${libAdmin.importMsg ? `<p class="admin-note">${esc(libAdmin.importMsg)}</p>` : ""}
  </div>`;
}

// "https://docs.google.com/spreadsheets/d/<ID>/edit…" → "<ID>"
const libSheetId = (link) => (/\/spreadsheets\/d\/([\w-]{20,})/.exec(String(link || "")) || [])[1] || "";

async function libImportSheet() {
  if (libAdmin.importing) return;
  const link = document.getElementById("libSheetUrl")?.value || prompt("Cole o link da planilha da biblioteca (Google Planilhas):") || "";
  const sheetId = libSheetId(link);
  if (!sheetId) return showToast("Cole o link da planilha do Google (docs.google.com/spreadsheets/…).", "error");
  libAdmin.importing = true;
  libAdmin.importMsg = "Lendo a planilha…";
  renderAdmin();
  // Mesmo livro pode ter mais de um exemplar (ex.: dois donos). Conta os
  // exemplares que já existem por título + autor + dono e só traz os que faltam.
  const key = (t, a, o) => normalizeText(`${t}|${a}|${o}`);
  const have = new Map();
  libAdmin.books.forEach((b) => have.set(key(b.title, b.author, b.owner), (have.get(key(b.title, b.author, b.owner)) || 0) + 1));
  const seen = new Map();
  const pending = [];
  try {
    for (const [gid, category] of LIB_SHEET_TABS) {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
      if (!res.ok) throw new Error(`aba ${category}: HTTP ${res.status}`);
      const [head, ...rows] = libParseCSV(await res.text());
      const col = (name) => head.findIndex((h) => normalizeText(h) === normalizeText(name));
      const c = { t: col("Título"), a: col("Autor"), cover: col("Capa"), s: col("Sinopse"), o: col("Proprietário do Livro"), lo: col("Data do Empréstimo"), du: col("Data de Devolução"), who: col("Emprestado para"), rn: col("Nº de Renovações"), q: col("Nomes Fila de Espera"), st: col("Situação") };
      if (c.t < 0) throw new Error(`aba ${category}: coluna “Título” não encontrada`);
      for (const r of rows) {
        const get = (i) => (i >= 0 ? String(r[i] ?? "").trim() : "");
        const title = get(c.t);
        if (!title) continue;
        const author = get(c.a);
        const k = key(title, author, get(c.o));
        seen.set(k, (seen.get(k) || 0) + 1);
        if (seen.get(k) <= (have.get(k) || 0)) continue;
        const who = get(c.who);
        const cover = safeUrl(get(c.cover));
        pending.push({
          row: { title: title.slice(0, 300), author: author.slice(0, 200), category, synopsis: get(c.s).slice(0, 8000), cover_url: cover.startsWith("https://") ? cover : "", owner: get(c.o).slice(0, 120), visible: true },
          loan: who && /emprest/i.test(get(c.st)) ? { who, loaned: libBRDate(get(c.lo)), due: libBRDate(get(c.du)), renewals: Math.min(20, Math.max(0, parseInt(get(c.rn), 10) || 0)) } : null,
          queue: get(c.q).split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length >= 2),
        });
      }
    }
    if (!pending.length) {
      libAdmin.importMsg = "Nada novo: todos os livros da planilha já estão no acervo.";
      return;
    }
    libAdmin.importMsg = `Gravando ${pending.length} livros…`;
    renderAdmin();
    const inserted = [];
    for (let i = 0; i < pending.length; i += 100) {
      const { data: rows, error } = await db("library_books").insert(pending.slice(i, i + 100).map((p) => p.row)).select();
      if (error) throw error;
      inserted.push(...rows);
    }
    let loans = 0;
    let queued = 0;
    for (const [i, p] of pending.entries()) {
      const book = inserted[i]; // o insert devolve na mesma ordem
      if (!book) continue;
      if (p.loan) {
        let reader = libFindReader(p.loan.who, "");
        if (!reader) {
          const { data: r, error } = await db("library_readers").insert({ name: p.loan.who.slice(0, 120) }).select().single();
          if (error) throw error;
          reader = r;
          libAdmin.readers.push(r);
        }
        const loaned = p.loan.loaned || spToday();
        const due = p.loan.due && p.loan.due >= loaned ? p.loan.due : isoAddDays(loaned, libNum("loanDays", 14));
        const { error } = await db("library_loans").insert({ book_id: book.id, reader_id: reader.id, loaned_on: loaned, due_on: due, renewals: p.loan.renewals });
        if (error) throw error;
        loans++;
      }
      if (p.queue.length) {
        const { error } = await db("library_requests").insert(p.queue.map((name) => ({ book_id: book.id, kind: "fila", name: name.slice(0, 120), status: "fila", source: "planilha" })));
        if (error) throw error;
        queued += p.queue.length;
      }
    }
    libAdmin.importMsg = `Pronto: ${inserted.length} livros, ${loans} empréstimos em andamento e ${queued} ${queued === 1 ? "pessoa" : "pessoas"} na fila importados.`;
    showToast("Planilha importada!", "success");
    await loadLibAdmin();
  } catch (e) {
    console.error("Importação:", e);
    libAdmin.importMsg = `A importação parou: ${e.message || e}. Toque de novo para continuar (o que já entrou é pulado).`;
    showToast("A importação não terminou.", "error");
  } finally {
    libAdmin.importing = false;
    if (adminTab === "biblioteca") renderAdmin();
  }
}
