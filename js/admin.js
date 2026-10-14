/* ============================================================
   PAINEL ADMINISTRATIVO  (acesse /admin — o antigo /#admin também funciona)
   ============================================================ */
let adminAuthed = false;
let adminTab = "appearance";
let editingPodcastId = null;

const ADMIN_TABS = [
  { id: "appearance", label: "Aparência", icon: "image" },
  { id: "home", label: "Página inicial", icon: "arrow" },
  { id: "services", label: "Cultos", icon: "clock" },
  { id: "events", label: "Eventos", icon: "calendar" },
  { id: "videos", label: "Vídeos", icon: "youtube" },
  { id: "news", label: "Notícias", icon: "megaphone" },
  { id: "podcast", label: "Podcast", icon: "mic" },
  { id: "ebd", label: "EBD", icon: "school" },
  { id: "biblioteca", label: "Biblioteca", icon: "book" },
  { id: "announcements", label: "Avisos", icon: "megaphone" },
  { id: "ministries", label: "Ministérios", icon: "user" },
  { id: "about", label: "Sobre a igreja", icon: "heart" },
  { id: "firstVisit", label: "Primeira visita", icon: "user" },
  { id: "church", label: "Igreja & redes", icon: "pin" },
  { id: "donations", label: "Doações / Ofertas", icon: "heart" },
];

const adminRoot = () => document.getElementById("adminRoot");
const isAdminOpen = () => adminRoot()?.classList.contains("open");

async function openAdmin() {
  const root = adminRoot();
  closeModal({ instant: true });
  toggleMobileMenu(false);
  document.body.classList.add("admin-open");
  root.classList.add("open");
  root.removeAttribute("aria-hidden");

  if (!adminAuthed || Date.now() - adminCheckedAt > ADMIN_RECHECK_MS) {
    const { data: s } = await supabaseClient.auth.getSession();
    if (s?.session) await adminCheckAccess();
    else adminResetAccess();
  }
  renderAdmin();
}

function closeAdminPanel({ keepHash = false } = {}) {
  const root = adminRoot();
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("admin-open");
  if (!keepHash && currentRoute() === "admin") {
    history.replaceState(null, "", "/");
    renderSite();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

/* ---------- Acesso: senha + liberação por e-mail ----------
   A senha certa não basta: cada login precisa ser liberado no e-mail
   "Liberar acesso / Não fui eu" (api/admin-acesso.mjs). Quem garante é
   o banco: toda regra de escrita usa is_site_admin(), que só vale para
   a sessão liberada (supabase/migrations/20261014_admin_acesso.sql).
   Esta tela só acompanha o andamento. */
const ADMIN_RECHECK_MS = 5 * 60 * 1000; // a liberação vence em 12 h; confere de vez em quando
let adminCheckedAt = 0;
let adminGate = null; // { state: "pendente" | "expirado" | "vencido" | "negado" | "erro", para, sentAt, msg }
let adminLoginMsg = "";
let adminPollTimer = null;
let adminPollBusy = false;

function adminResetAccess() {
  adminAuthed = false;
  adminGate = null;
  adminCheckedAt = 0;
  stopAdminPoll();
}

async function adminSessionStatus() {
  const { data: st, error } = await supabaseClient.rpc("admin_session_status");
  if (!error) return st;
  // Banco ainda sem a migração 20261014: vale a regra antiga (só a senha).
  if (error.code === "PGRST202") {
    const { data: ok, error: e2 } = await supabaseClient.rpc("is_site_admin");
    if (e2) throw e2;
    return ok === true ? "permitido" : "nao_admin";
  }
  throw error;
}

// Confere a sessão atual. request: manda o e-mail de liberação quando preciso.
async function adminCheckAccess({ request = true } = {}) {
  let st;
  try {
    st = await adminSessionStatus();
  } catch (e) {
    console.error("Erro ao conferir o acesso:", e);
    if (adminAuthed) return; // falha de rede: o banco continua protegendo as gravações
    adminGate = { state: "erro", msg: "Não foi possível conferir o acesso. Verifique a internet e tente de novo." };
    return;
  }
  adminCheckedAt = Date.now();
  if (st === "permitido") {
    const first = !adminAuthed;
    adminAuthed = true;
    adminGate = null;
    stopAdminPoll();
    if (first) await loadAdminOnlyData();
    return;
  }
  adminAuthed = false;
  if (st === "nao_admin") {
    adminResetAccess();
    adminLoginMsg = "Esta conta não tem acesso ao painel.";
    await supabaseClient.auth.signOut({ scope: "local" });
    return;
  }
  if (st === "pendente") {
    adminGate = { ...adminGate, state: "pendente" };
    startAdminPoll();
    return;
  }
  stopAdminPoll();
  if (st === "negado") {
    adminGate = { state: "negado" };
    return;
  }
  // nenhum, vencido (passou de 12 h) ou expirado (o link de 20 min venceu)
  if (request && st !== "expirado") await adminRequestAccess(st);
  else adminGate = { state: st === "vencido" ? "vencido" : "expirado" };
}

async function adminRequestAccess(prev = "") {
  const { data: s } = await supabaseClient.auth.getSession();
  const jwt = s?.session?.access_token;
  if (!jwt) return adminResetAccess();
  let res = null;
  let body = {};
  try {
    res = await fetch("/api/admin-acesso", { method: "POST", headers: { Authorization: `Bearer ${jwt}` } });
    body = await res.json().catch(() => ({}));
  } catch {}
  if (res?.ok && body.status === "permitido") return adminCheckAccess({ request: false });
  if (res?.ok) {
    adminGate = { state: "pendente", para: body.para || [], sentAt: Date.now(), renovacao: prev === "vencido" };
    startAdminPoll();
    return;
  }
  if (res?.status === 403) {
    adminResetAccess();
    adminLoginMsg = body.error || "Esta conta não tem acesso ao painel.";
    await supabaseClient.auth.signOut({ scope: "local" });
    return;
  }
  adminGate = { state: "erro", msg: body.error || "Não foi possível enviar o e-mail de liberação agora. Tente de novo." };
}

function startAdminPoll() {
  if (adminPollTimer) return;
  adminPollTimer = setInterval(adminPollTick, 4000);
}

function stopAdminPoll() {
  clearInterval(adminPollTimer);
  adminPollTimer = null;
}

// Enquanto espera o "Liberar acesso", pergunta ao banco a cada 4 s.
async function adminPollTick() {
  if (adminPollBusy || document.hidden || !isAdminOpen() || adminGate?.state !== "pendente") return;
  adminPollBusy = true;
  try {
    await adminCheckAccess({ request: false });
  } finally {
    adminPollBusy = false;
  }
  if (adminAuthed) {
    renderAdmin();
    showToast("Acesso liberado. Bem-vindo ao painel!", "success");
  } else if (adminGate?.state !== "pendente") {
    renderAdmin();
  }
}

// Voltou do aplicativo de e-mail: confere na hora.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && adminGate?.state === "pendente") adminPollTick();
});

// Antes de gravar: se faz tempo que não confere, confere (a liberação vence em 12 h).
async function adminEnsureAccess() {
  if (!adminAuthed) return false;
  if (Date.now() - adminCheckedAt < ADMIN_RECHECK_MS) return true;
  await adminCheckAccess();
  if (!adminAuthed) {
    if (isAdminOpen()) renderAdmin();
    showToast("A liberação do painel venceu. Confirme de novo pelo e-mail.", "error");
  }
  return adminAuthed;
}

async function adminResendAccess(btn) {
  if (btn) {
    btn.disabled = true;
    btn.classList.add("loading");
  }
  await adminRequestAccess();
  renderAdmin();
  if (adminGate?.state === "pendente") showToast("E-mail de liberação enviado.", "success");
}

async function adminRetryAccess(btn) {
  if (btn) {
    btn.disabled = true;
    btn.classList.add("loading");
  }
  await adminCheckAccess();
  renderAdmin();
}

// Freio contra tentativas repetidas de senha (o Supabase também limita no servidor).
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 60000;
let loginFails = 0;
let loginLockedUntil = 0;

// Lembra o último e-mail usado neste aparelho (só para preencher o campo).
function lastAdminEmail(value) {
  try {
    if (value === undefined) return localStorage.getItem("admin-email") || "";
    localStorage.setItem("admin-email", value);
  } catch {}
  return "";
}

async function adminLogin(e) {
  e?.preventDefault();
  const emailInput = document.getElementById("adminEmail");
  const input = document.getElementById("adminPassword");
  const btn = document.getElementById("adminLoginBtn");
  const err = document.getElementById("loginError");
  const email = (emailInput?.value || "").trim().toLowerCase();
  const wait = Math.ceil((loginLockedUntil - Date.now()) / 1000);
  adminLoginMsg = "";
  if (wait > 0) {
    err.textContent = `Muitas tentativas. Aguarde ${wait} segundos.`;
    err.hidden = false;
    return;
  }
  if (!email || !input?.value) {
    err.textContent = "Digite o e-mail e a senha.";
    err.hidden = false;
    (email ? input : emailInput)?.focus();
    return;
  }
  btn.disabled = true;
  btn.classList.add("loading");
  err.hidden = true;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: input.value });
  if (error) {
    btn.disabled = false;
    btn.classList.remove("loading");
    console.error("Erro no login:", error.message);
    loginFails++;
    if (loginFails >= LOGIN_MAX_FAILS) {
      loginFails = 0;
      loginLockedUntil = Date.now() + LOGIN_LOCK_MS;
    }
    err.textContent = loginLockedUntil > Date.now() ? "Muitas tentativas. Aguarde 1 minuto." : "E-mail ou senha incorretos.";
    err.hidden = false;
    input.select();
    input.closest(".login-box")?.classList.add("shake");
    setTimeout(() => input.closest(".login-box")?.classList.remove("shake"), 400);
    return;
  }
  loginFails = 0;
  lastAdminEmail(email);
  adminGate = null;
  await adminCheckAccess();
  renderAdmin();
  if (adminAuthed) showToast("Bem-vindo ao painel!", "success");
}

async function adminLogout() {
  adminResetAccess();
  await supabaseClient.auth.signOut();
  await loadData();
  renderAdmin();
}

function adminLoginHTML() {
  return `
    <div class="login-screen">
      <form class="login-box" onsubmit="adminLogin(event)">
        <span class="login-badge">${icon("lock", 22)}</span>
        <h2>Painel administrativo</h2>
        <p>Entre com o e-mail e a senha de administrador. Depois, confirme o acesso pelo e-mail.</p>
        <label class="sr-only" for="adminEmail">E-mail</label>
        <input type="email" id="adminEmail" placeholder="E-mail" autocomplete="username" inputmode="email" value="${esc(lastAdminEmail())}" required>
        <label class="sr-only" for="adminPassword">Senha</label>
        <input type="password" id="adminPassword" placeholder="Senha" autocomplete="current-password" required>
        <p id="loginError" class="login-error" role="alert" ${adminLoginMsg ? "" : "hidden"}>${esc(adminLoginMsg)}</p>
        <button id="adminLoginBtn" class="btn btn-primary btn-block" type="submit">Entrar</button>
        <button class="btn btn-ghost btn-sm btn-block" type="button" onclick="closeAdminPanel()">Voltar ao site</button>
      </form>
    </div>`;
}

function adminGateHTML() {
  const g = adminGate;
  const sair = `<button class="btn btn-ghost btn-sm btn-block" type="button" onclick="adminLogout()">Sair</button>`;
  const box = (ic, title, body) => `
    <div class="login-screen">
      <div class="login-box gate-box">
        <span class="login-badge">${icon(ic, 22)}</span>
        <h2>${title}</h2>
        ${body}
      </div>
    </div>`;
  if (g.state === "pendente") {
    const para = g.para?.length ? `para <strong>${g.para.map(esc).join(", ")}</strong>` : "para os administradores";
    const cooldown = g.sentAt && Date.now() - g.sentAt < 30000;
    return box(
      "mail",
      "Confirme pelo e-mail",
      `<p>${g.renovacao ? "A liberação anterior venceu (ela dura 12 horas). " : ""}Enviamos um e-mail ${para}. Abra e toque em <strong>Liberar acesso</strong>: esta tela continua sozinha.</p>
      <p class="gate-wait" role="status"><span class="gate-spin" aria-hidden="true"></span>Aguardando liberação…</p>
      <p class="gate-note">O link vale por 20 minutos. Não chegou? Veja a caixa de spam.</p>
      <button id="adminResendBtn" class="btn btn-primary btn-block" type="button" onclick="adminResendAccess(this)" ${cooldown ? "disabled" : ""}>Reenviar e-mail</button>
      ${sair}`,
    );
  }
  if (g.state === "expirado" || g.state === "vencido") {
    return box(
      "mail",
      g.state === "vencido" ? "A liberação venceu" : "O link venceu",
      `<p>${g.state === "vencido" ? "O acesso liberado dura 12 horas." : "O link do e-mail vale por 20 minutos."} Peça um novo e-mail para continuar.</p>
      <button class="btn btn-primary btn-block" type="button" onclick="adminResendAccess(this)">Enviar novo e-mail</button>
      ${sair}`,
    );
  }
  if (g.state === "negado") {
    return box(
      "lock",
      "Acesso bloqueado",
      `<p>Este acesso foi recusado no e-mail (<strong>Não fui eu</strong>). Se foi engano, saia e entre de novo para receber outro e-mail.</p>${sair}`,
    );
  }
  return box(
    "lock",
    "Não foi possível continuar",
    `<p role="alert">${esc(g.msg || "Tente de novo em instantes.")}</p>
    <button class="btn btn-primary btn-block" type="button" onclick="adminRetryAccess(this)">Tentar de novo</button>
    ${sair}`,
  );
}

function renderAdmin() {
  const el = document.getElementById("adminContent");
  if (!adminAuthed) {
    el.innerHTML = adminGate ? adminGateHTML() : adminLoginHTML();
    if (adminGate?.state === "pendente" && adminGate.sentAt) {
      const left = 30000 - (Date.now() - adminGate.sentAt);
      if (left > 0) setTimeout(() => document.getElementById("adminResendBtn")?.removeAttribute("disabled"), left);
    }
    if (!adminGate) setTimeout(() => document.getElementById(lastAdminEmail() ? "adminPassword" : "adminEmail")?.focus(), 50);
    return;
  }

  // Preserva a rolagem quando o painel é redesenhado na mesma aba.
  const main = el.querySelector(".admin-main");
  const keepScroll = main && main.dataset.tab === adminTab ? main.scrollTop : 0;

  el.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">${esc(data.church.name)}<small>Painel</small></div>
        <nav class="admin-nav">
          ${ADMIN_TABS.map((t) => `<button type="button" class="admin-nav-item ${adminTab === t.id ? "active" : ""}" onclick="setAdminTab('${t.id}')">${icon(t.icon, 16)}<span>${t.label}</span></button>`).join("")}
        </nav>
        <div class="admin-sidebar-foot">
          <button class="btn btn-sm btn-sidebar" type="button" onclick="closeAdminPanel()">${icon("arrowBack", 15)} Ver site</button>
          <button class="btn btn-sm btn-sidebar" type="button" onclick="adminLogout()">Sair</button>
        </div>
      </aside>
      <div class="admin-main" data-tab="${adminTab}">
        <div class="admin-content">${adminTabContent()}</div>
      </div>
    </div>`;

  const newMain = el.querySelector(".admin-main");
  newMain.scrollTop = keepScroll;
  if (adminTab === "ministries") refreshMinistryAdminPhotos();
}

function setAdminTab(id) {
  adminTab = id;
  editingPodcastId = null;
  renderAdmin();
}

function adminTabContent() {
  const tabs = {
    appearance: tabAppearance,
    home: tabHome,
    services: tabServices,
    events: tabEvents,
    videos: tabVideos,
    news: tabNews,
    podcast: tabPodcast,
    ebd: tabEbd,
    biblioteca: tabBiblioteca,
    announcements: tabAnnouncements,
    ministries: tabMinistries,
    about: tabAbout,
    firstVisit: tabFirstVisit,
    church: tabChurch,
    donations: tabDonationTypes,
  };
  return (tabs[adminTab] || (() => ""))();
}

/* Helpers de formulário */
const topbar = (title, action = "") => `<div class="admin-topbar"><h2>${title}</h2>${action}</div>`;
const field = (label, input, full = false) => `<div class="field ${full ? "full" : ""}"><label>${label}</label>${input}</div>`;
const adminEmpty = (text) => `<div class="admin-card"><div class="admin-empty">${esc(text)}</div></div>`;

function uploadRow(previewUrl, onchange, accept = "image/*", label = "Enviar do computador") {
  return `<div class="upload-row">
    ${safeUrl(previewUrl) ? `<span class="upload-preview" style="${bgImage(previewUrl)}"></span>` : `<span class="upload-preview empty">${icon("image", 18)}</span>`}
    <label class="btn btn-ghost btn-sm upload-label">${icon("image", 14)} ${label}<input type="file" accept="${accept}" hidden onchange="${onchange}"></label>
  </div>`;
}

/* Executa uma escrita no Supabase com feedback padronizado. */
// O pedido ao Supabase só sai no "await": dá para conferir a liberação antes.
async function dbWrite(promise, okMsg, errMsg = "Erro ao salvar.") {
  if (!(await adminEnsureAccess())) return null;
  const { data: result, error } = await promise;
  if (error) {
    console.error(errMsg, error);
    showToast(errMsg, "error");
    return null;
  }
  if (okMsg) showToast(okMsg, "success");
  return result ?? true;
}

/* ---- APARÊNCIA ---- */
function tabAppearance() {
  const t = data.theme;
  return `
    ${topbar("Aparência")}
    <div class="admin-card">
      <h3>Cores</h3>
      <div class="field-row">
        ${colorField("Primária", "primary", t.primary)}
        ${colorField("Secundária", "secondary", t.secondary)}
        ${colorField("Destaque (accent)", "accent", t.accent)}
        ${colorField("Fundo", "background", t.background)}
      </div>
    </div>
    <div class="admin-card">
      <h3>Tipografia (Google Fonts)</h3>
      <div class="field-row">
        ${field("Fonte dos títulos", `<input type="text" value="${esc(t.fontHeading)}" onchange="updateTheme('fontHeading', this.value)">`)}
        ${field("Fonte dos textos", `<input type="text" value="${esc(t.fontBody)}" onchange="updateTheme('fontBody', this.value)">`)}
      </div>
      <p class="admin-note">Digite o nome exato da fonte no Google Fonts (ex.: Fraunces, Inter, Playfair Display, Poppins).</p>
    </div>
    <div class="admin-card">
      <h3>Abertura do site</h3>
      <div class="field-row">
        ${field("Frase da vinheta (surge letra por letra)", `<input type="text" maxlength="60" value="${esc(t.introTagline)}" onchange="updateTheme('introTagline', this.value.trim() || defaultData.theme.introTagline)">`, true)}
      </div>
      <p class="admin-note">A vinheta completa (6 s) aparece sempre que alguém abre o site (o botão “Pular abertura” leva direto ao conteúdo). A frase nova vale a partir da próxima abertura.</p>
    </div>
    <div class="admin-card">
      <h3>Estilo</h3>
      <div class="field-row">
        ${field("Bordas arredondadas (px)", `<input type="number" min="0" max="40" value="${esc(t.radius)}" onchange="updateTheme('radius', parseInt(this.value)||0)">`)}
      </div>
    </div>`;
}

function colorField(label, key, value) {
  return field(
    label,
    `<div class="swatch-row"><input type="color" value="${esc(value)}" oninput="updateTheme('${key}', this.value); this.nextElementSibling.textContent=this.value"><code>${esc(value)}</code></div>`,
  );
}

function updateTheme(key, value) {
  data.theme[key] = value;
  persist();
}

/* ---- PÁGINA INICIAL ---- */
function tabHome() {
  const h = data.hero;
  return `
    ${topbar("Página inicial")}
    <div class="admin-card">
      <h3>Banner principal</h3>
      <div class="field-row">
        ${field("Frase de destaque", `<input type="text" value="${esc(h.eyebrow)}" onchange="updateHero('eyebrow', this.value)">`, true)}
        ${field("Título", `<input type="text" value="${esc(h.title)}" onchange="updateHero('title', this.value)">`, true)}
        ${field("Subtítulo", `<textarea onchange="updateHero('subtitle', this.value)">${esc(h.subtitle)}</textarea>`, true)}
        ${field("Foto de fundo (opcional)", `<input type="url" value="${esc(h.image)}" onchange="updateHero('image', this.value.trim())" placeholder="Sem foto, o banner fica azul">${uploadRow(h.image, "uploadHeroImage(this)")}${safeUrl(h.image) ? `<button class="btn btn-ghost btn-sm" type="button" onclick="updateHero('image',''); renderAdmin()">Remover foto</button>` : ""}`, true)}
      </div>
      <p class="admin-note">Use uma foto real do templo ou de um culto, com autorização de quem aparece. Um véu azul é aplicado por cima para o texto continuar legível. Os botões do banner levam para “Horários dos cultos” e “Conheça a igreja”.</p>
    </div>
    <div class="admin-card">
      <h3>Seções da página inicial</h3>
      <p class="admin-note">Ative, desative ou reordene os blocos exibidos na Home.</p>
      ${data.homeSections
        .map(
          (s, i) => `
        <div class="admin-list-item ${s.enabled ? "" : "is-off"}">
          <div class="meta"><strong>${esc(s.name)}</strong></div>
          <div class="item-actions">
            <button class="icon-btn" type="button" onclick="moveSection(${i},-1)" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
            <button class="icon-btn" type="button" onclick="moveSection(${i},1)" ${i === data.homeSections.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
            <label class="switch"><input type="checkbox" ${s.enabled ? "checked" : ""} onchange="toggleSection(${i})"><span></span></label>
          </div>
        </div>`,
        )
        .join("")}
    </div>`;
}

function updateHero(key, value) {
  data.hero[key] = value;
  persist();
}

async function uploadHeroImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando foto…");
  try {
    updateHero("image", await uploadFile(file, "hero"));
    renderAdmin();
  } catch (e) {
    console.error(e);
    showToast(e.userMessage || "Erro ao enviar a foto.", "error");
  }
}

function moveSection(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= data.homeSections.length) return;
  [data.homeSections[i], data.homeSections[j]] = [data.homeSections[j], data.homeSections[i]];
  persist({ rerenderAdmin: true });
}

function toggleSection(i) {
  data.homeSections[i].enabled = !data.homeSections[i].enabled;
  persist({ rerenderAdmin: true });
}

/* ---- CULTOS ---- */
function tabServices() {
  return `
    ${topbar("Horários dos cultos", `<button class="btn btn-primary btn-sm" type="button" onclick="addServiceDay()">+ Adicionar dia</button>`)}
    <p class="admin-note">Use o nome do dia da semana (Domingo, Segunda, Terça…). O site usa esses horários para mostrar o próximo culto na página inicial.</p>
    ${
      data.services.length
        ? data.services
            .map(
              (d, di) => `
      <div class="admin-card">
        <div class="admin-card-head">
          <input type="text" class="inline-title" value="${esc(d.day)}" aria-label="Dia" onchange="updateServiceDay(${di},'day',this.value)">
          <button class="icon-btn" type="button" onclick="removeServiceDay(${di})" aria-label="Excluir dia">🗑️</button>
        </div>
        ${(d.items || [])
          .map(
            (it, ii) => `
          <div class="admin-list-item">
            <div class="field-row compact">
              ${field("Horário", `<input type="time" value="${esc(it.time)}" onchange="updateServiceItem(${di},${ii},'time',this.value)">`)}
              ${field("Nome do culto", `<input type="text" value="${esc(it.name)}" onchange="updateServiceItem(${di},${ii},'name',this.value)">`)}
              ${field("Muda numa semana do mês?", `<select onchange="updateServiceMonthly(${di},${ii},'week',this.value)">
                <option value="">Não muda</option>
                ${[1, 2, 3, 4, 5].map((w) => `<option value="${w}" ${Number(it.monthly?.week) === w ? "selected" : ""}>No ${nthWeekdayLabel(w, d.day)} do mês</option>`).join("")}
              </select>`)}
              ${it.monthly?.week ? field("Nessa semana vira", `<input type="text" value="${esc(it.monthly?.name || "")}" placeholder="Ex.: Ceia do Senhor" onchange="updateServiceMonthly(${di},${ii},'name',this.value)">`) : ""}
              ${it.monthly?.week ? field(isEbdService(it.name) ? "A lição vai para" : "O conteúdo normal vai para", `<select onchange="updateServiceMonthly(${di},${ii},'moveTo',this.value)">
                <option value="">Não vai para outro culto</option>
                ${data.services
                  .flatMap((d2) => (d2.items || []).filter((x) => x !== it).map((x) => ({ day: d2.day, time: x.time, name: x.name })))
                  .map((o) => `<option value="${esc(o.day + "|" + o.time)}" ${it.monthly?.moveTo?.day === o.day && it.monthly?.moveTo?.time === o.time ? "selected" : ""}>${esc(o.day)} seguinte · ${esc(o.time)} · ${esc(o.name)}</option>`)
                  .join("")}
              </select>`) : ""}
            </div>
            <button class="icon-btn" type="button" onclick="removeServiceItem(${di},${ii})" aria-label="Excluir horário">🗑️</button>
          </div>`,
          )
          .join("")}
        <button class="btn btn-ghost btn-sm" type="button" onclick="addServiceItem(${di})">+ Adicionar horário</button>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhum dia cadastrado.")
    }`;
}

async function syncService(service) {
  const payload = { day: service.day, items: service.items };
  if (service.id) payload.id = service.id;
  const saved = await dbWrite(db("services").upsert(payload).select().single(), "Alteração salva!", "Erro ao salvar culto.");
  if (saved?.id) service.id = saved.id;
  renderSite();
  return saved;
}

async function addServiceDay() {
  const created = await dbWrite(db("services").insert({ day: "Novo dia", items: [] }).select().single(), "Dia adicionado!", "Erro ao adicionar dia.");
  if (!created) return;
  data.services.push(mapService(created));
  renderAdmin();
  renderSite();
}

async function removeServiceDay(i) {
  const serv = data.services[i];
  if (!serv || !confirm(`Deseja realmente excluir "${serv.day}"?`)) return;
  if (!(await dbWrite(db("services").delete().eq("id", serv.id), "Dia excluído!", "Erro ao excluir."))) return;
  data.services.splice(i, 1);
  renderAdmin();
  renderSite();
}

function updateServiceDay(i, key, val) {
  data.services[i][key] = val;
  syncService(data.services[i]);
}

async function addServiceItem(di) {
  data.services[di].items.push({ time: "19:00", name: "Novo culto" });
  await syncService(data.services[di]);
  renderAdmin();
}

async function removeServiceItem(di, ii) {
  data.services[di].items.splice(ii, 1);
  await syncService(data.services[di]);
  renderAdmin();
}

function updateServiceItem(di, ii, key, val) {
  data.services[di].items[ii][key] = val;
  syncService(data.services[di]);
}

// Troca mensal de um horário (ex.: 3º domingo → Ceia do Senhor).
function updateServiceMonthly(di, ii, key, val) {
  const it = data.services[di].items[ii];
  const m = { week: "", name: "", ...(it.monthly || {}) };
  if (key === "moveTo") {
    const [day, time] = val ? val.split("|") : [];
    if (day) m.moveTo = { day, time };
    else delete m.moveTo;
  } else m[key] = key === "week" ? (val ? Number(val) : "") : val.trim();
  if (!m.week) delete it.monthly;
  else it.monthly = m;
  syncService(data.services[di]);
  if (key === "week") renderAdmin();
}

/* ---- EVENTOS ---- */
function tabEvents() {
  return `
    ${topbar("Eventos", `<button class="btn btn-primary btn-sm" type="button" onclick="addEvent()">+ Novo evento</button>`)}
    ${
      data.events.length
        ? data.events
            .map(
              (ev, i) => `
      <div class="admin-card">
        <div class="field-row">
          ${field("Nome", `<input type="text" value="${esc(ev.name)}" onchange="updateEvent(${i},'name',this.value)">`, true)}
          ${field("Data", `<input type="date" value="${esc(ev.date)}" onchange="updateEvent(${i},'date',this.value)">`)}
          ${field("Horário", `<input type="time" value="${esc(ev.time)}" onchange="updateEvent(${i},'time',this.value)">`)}
          ${field("Categoria", `<input type="text" value="${esc(ev.category)}" onchange="updateEvent(${i},'category',this.value)">`)}
          ${field("Local", `<input type="text" value="${esc(ev.location)}" onchange="updateEvent(${i},'location',this.value)">`)}
          ${field("Endereço", `<input type="text" value="${esc(ev.address)}" onchange="updateEvent(${i},'address',this.value)">`, true)}
          ${field("Descrição", `<textarea onchange="updateEvent(${i},'description',this.value)">${esc(ev.description)}</textarea>`, true)}
          ${field("Imagem", `<input type="url" value="${esc(ev.image)}" onchange="updateEvent(${i},'image',this.value)" placeholder="Cole o link ou envie abaixo">${uploadRow(ev.image, `handleImageUpload(this, ${i})`)}`, true)}
          ${field("Link de inscrição", `<input type="url" value="${esc(ev.link)}" onchange="updateEvent(${i},'link',this.value)">`)}
          ${field("Link do Google Maps", `<input type="url" value="${esc(ev.mapsUrl)}" onchange="updateEvent(${i},'mapsUrl',this.value)">`)}
        </div>
        <div class="admin-card-foot">
          <label class="check"><input type="checkbox" ${ev.active !== false ? "checked" : ""} onchange="updateEvent(${i},'active',this.checked)"> Ativo</label>
          <button class="btn btn-danger btn-sm" type="button" onclick="removeEvent(${i})">Excluir evento</button>
        </div>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhum evento cadastrado.")
    }`;
}

async function addEvent() {
  const created = await dbWrite(
    db("events")
      .insert({ name: "Novo evento", date: localISO(), time: "19:00", location: "", address: "", description: "", image: "", category: "Culto", link: "", maps_url: "", active: true })
      .select()
      .single(),
    "Evento criado!",
    "Erro ao criar evento.",
  );
  if (!created) return;
  data.events.unshift(mapEvent(created));
  renderAdmin();
  renderSite();
}

async function removeEvent(i) {
  const ev = data.events[i];
  if (!ev || !confirm(`Deseja realmente excluir "${ev.name}"?`)) return;
  if (!(await dbWrite(db("events").delete().eq("id", ev.id), "Evento excluído!", "Erro ao excluir evento."))) return;
  data.events.splice(i, 1);
  renderAdmin();
  renderSite();
}

async function updateEvent(i, key, val) {
  const ev = data.events[i];
  if (!ev) return;
  ev[key] = val;
  const column = key === "mapsUrl" ? "maps_url" : key;
  if (await dbWrite(db("events").update({ [column]: val === "" && key === "date" ? null : val }).eq("id", ev.id), "Alteração salva!", "Erro ao salvar alteração.")) {
    renderSite();
  }
}

async function handleImageUpload(input, eventIndex) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando imagem…");
  try {
    const url = await uploadFile(file, "eventos");
    await updateEvent(eventIndex, "image", url);
    renderAdmin();
  } catch (e) {
    console.error("Erro ao enviar imagem:", e);
    showToast(e.userMessage || "Erro ao enviar imagem.", "error");
  }
}

/* ---- VÍDEOS ---- */
function tabVideos() {
  return `
    ${topbar(
      "Vídeos e lives",
      `<div class="item-actions">
        <button class="btn btn-ghost btn-sm" type="button" id="syncYoutubeBtn" onclick="syncYoutubeNow()">${icon("fwd15", 15)} Sincronizar agora</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="addVideo()">+ Colar link do YouTube</button>
      </div>`,
    )}
    <div class="admin-card admin-sync-note">
      ${icon("youtube", 20)}
      <p><strong>Sincronização automática ligada.</strong> A cada 10 minutos o site busca as lives e vídeos novos do canal do YouTube
      (ID configurado em “Igreja &amp; redes”) e adiciona aqui. Você pode editar título e categoria normalmente.
      Para tirar um vídeo do site, use “Ocultar”: ele não volta na próxima sincronização.</p>
    </div>
    ${
      data.videos.length
        ? data.videos
            .map(
              (v, i) => `
      <div class="admin-card admin-card-media">
        ${ytThumb(v.youtubeUrl) ? `<span class="admin-thumb" style="${bgImage(ytThumb(v.youtubeUrl))}"></span>` : `<span class="admin-thumb empty">${icon("youtube", 22)}</span>`}
        <div class="field-row">
          ${v.source === "auto" ? `<span class="badge-inline is-auto field full">Importado automaticamente do YouTube</span>` : ""}
          ${field("Link do YouTube", `<input type="url" value="${esc(v.youtubeUrl)}" onchange="updateVideo(${i},'youtubeUrl',this.value)">`, true)}
          ${field("Título", `<input type="text" value="${esc(v.title)}" onchange="updateVideo(${i},'title',this.value)">`, true)}
          ${field("Categoria", `<input type="text" value="${esc(v.category)}" onchange="updateVideo(${i},'category',this.value)">`)}
          ${field("Data", `<input type="date" value="${esc(v.date)}" onchange="updateVideo(${i},'date',this.value)">`)}
          ${field("Descrição", `<textarea onchange="updateVideo(${i},'description',this.value)">${esc(v.description)}</textarea>`, true)}
        </div>
        <div class="admin-card-foot end"><button class="btn btn-danger btn-sm" type="button" onclick="removeVideo(${i})">${v.youtube_id ? "Ocultar do site" : "Excluir vídeo"}</button></div>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhum vídeo cadastrado.")
    }`;
}

async function addVideo() {
  const created = await dbWrite(
    db("videos").insert({ title: "Novo vídeo", youtube_url: "", category: "Cultos", date: localISO(), description: "" }).select().single(),
    "Vídeo adicionado!",
    "Erro ao adicionar vídeo.",
  );
  if (!created) return;
  data.videos.unshift(mapVideo(created));
  renderAdmin();
  renderSite();
}

// Vídeos com ID do YouTube são apenas ocultados: se fossem apagados,
// a sincronização automática os traria de volta.
async function removeVideo(i) {
  const v = data.videos[i];
  if (!v) return;
  const hide = !!v.youtube_id;
  if (!confirm(hide ? `Ocultar "${v.title}" do site?` : `Deseja realmente excluir "${v.title}"?`)) return;
  const query = hide ? db("videos").update({ hidden: true }).eq("id", v.id) : db("videos").delete().eq("id", v.id);
  if (!(await dbWrite(query, hide ? "Vídeo ocultado!" : "Vídeo excluído!", "Erro ao remover vídeo."))) return;
  data.videos.splice(i, 1);
  renderAdmin();
  renderSite();
}

async function updateVideo(i, key, val) {
  const v = data.videos[i];
  if (!v?.id) return;
  const payload = key === "youtubeUrl" ? { youtube_url: val, youtube_id: ytId(val) || null } : { [key]: val };
  const { error } = await db("videos").update(payload).eq("id", v.id);
  if (error) {
    console.error("Erro ao atualizar vídeo:", error);
    showToast(error.code === "23505" ? "Esse vídeo já está na biblioteca." : "Erro ao atualizar vídeo.", "error");
    return;
  }
  v[key] = val;
  if (key === "youtubeUrl") v.youtube_id = payload.youtube_id;
  showToast("Vídeo atualizado!", "success");
  renderSite();
  if (key === "youtubeUrl") renderAdmin();
}

async function syncYoutubeNow() {
  const btn = document.getElementById("syncYoutubeBtn");
  btn?.classList.add("loading");
  btn && (btn.disabled = true);
  try {
    const { data: result, error } = await supabaseClient.functions.invoke("sync-youtube", { body: {} });
    if (error || !result?.ok) throw error || new Error(result?.error);
    const { data: rows } = await db("videos").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    if (rows) data.videos = rows.filter((v) => !v.hidden).map(mapVideo);
    showToast(result.inserted ? `${result.inserted} vídeo(s) novo(s) importado(s)!` : "Tudo em dia: nenhum vídeo novo.", "success");
    renderAdmin();
    renderSite();
  } catch (e) {
    console.error("Erro na sincronização:", e);
    showToast("Não foi possível sincronizar agora.", "error");
  } finally {
    btn?.classList.remove("loading");
    btn && (btn.disabled = false);
  }
}

/* ---- PODCAST ---- */
const isPublished = (p) => normalizeText(p.status) === "publicado";

function tabPodcast() {
  const items = (data.podcasts || []).slice().sort((a, b) => (Number(b.episode_number) || 0) - (Number(a.episode_number) || 0));
  if (editingPodcastId) {
    const nextNumber = (Number(items[0]?.episode_number) || 0) + 1;
    const p = items.find((x) => String(x.id) === String(editingPodcastId)) || {
      id: "",
      title: "",
      description: "",
      episode_number: nextNumber,
      cover_url: "",
      audio_url: "",
      spotify_url: "",
      youtube_url: "",
      published_at: localISO(),
      status: "Rascunho",
    };
    return podcastFormHTML(p);
  }
  return `
    ${topbar("Podcast", `<button class="btn btn-primary btn-sm" type="button" onclick="startNewPodcast()">+ Novo episódio</button>`)}
    <div class="admin-card podcast-admin-table-wrap">
      ${
        items.length
          ? `<div class="podcast-admin-table">
          <div class="podcast-admin-row podcast-admin-head"><span>Capa</span><span>Episódio</span><span>Título</span><span>Data</span><span>Status</span><span>Ações</span></div>
          ${items
            .map(
              (p) => `
            <div class="podcast-admin-row">
              <div class="podcast-admin-thumb" style="${bgImage(p.cover_url)}"></div>
              <strong>EP. ${esc(p.episode_number || "—")}</strong>
              <div class="podcast-admin-title">${esc(p.title)}</div>
              <span>${fmtDate(p.published_at ? String(p.published_at).slice(0, 10) : "") || "—"}</span>
              <span class="badge-inline ${isPublished(p) ? "is-published" : ""}">${isPublished(p) ? "Publicado" : "Rascunho"}</span>
              <div class="item-actions">
                <button class="icon-btn" type="button" title="Editar" data-id="${esc(p.id)}" onclick="editPodcast(this.dataset.id)">✎</button>
                <button class="icon-btn" type="button" title="Excluir" data-id="${esc(p.id)}" onclick="removePodcast(this.dataset.id)">🗑️</button>
              </div>
            </div>`,
            )
            .join("")}
        </div>`
          : `<div class="admin-empty">Nenhum episódio cadastrado. Clique em “Novo episódio” para começar.</div>`
      }
    </div>`;
}

function podcastFormHTML(p) {
  const isNew = !p.id;
  return `
    <div class="admin-topbar">
      <div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="cancelPodcastEdit()">${icon("arrowBack", 14)} Voltar</button>
        <h2 class="mt-12">${isNew ? "Novo episódio" : "Editar episódio"}</h2>
      </div>
    </div>
    <div class="admin-card">
      <div class="field-row">
        ${field("Título", `<input id="podcastTitle" type="text" value="${esc(p.title)}" placeholder="Título do episódio">`, true)}
        ${field("Número do episódio", `<input id="podcastEpisodeNumber" type="number" min="1" value="${esc(p.episode_number ?? "")}" placeholder="Ex.: 12">`)}
        ${field("Data de publicação", `<input id="podcastPublishedAt" type="date" value="${esc(p.published_at ? String(p.published_at).slice(0, 10) : localISO())}">`)}
        ${field("Descrição", `<textarea id="podcastDescription" rows="4" placeholder="Resumo do episódio">${esc(p.description)}</textarea>`, true)}
        ${field(
          "Capa",
          `<input id="podcastCoverUrl" type="url" value="${esc(p.cover_url)}" placeholder="URL da capa ou envie uma imagem" oninput="refreshPodcastCoverPreview(this.value)">
           <div id="podcastCoverUpload">${uploadRow(p.cover_url, "uploadPodcastCover(this)", "image/png,image/jpeg,image/webp", "Escolher imagem")}</div>`,
          true,
        )}
        ${field(
          "Áudio (MP3) — toca direto no site",
          `<input id="podcastAudioUrl" type="url" value="${esc(p.audio_url)}" placeholder="https://… (ou envie o arquivo abaixo)">
           <div class="upload-row">
             <label class="btn btn-ghost btn-sm upload-label">${icon("mic", 14)} Enviar arquivo de áudio<input type="file" accept="audio/*" hidden onchange="uploadPodcastAudio(this)"></label>
             <span class="admin-muted" id="podcastAudioStatus">${p.audio_url ? "Áudio cadastrado" : "MP3 ou M4A, até 50 MB"}</span>
           </div>`,
          true,
        )}
        ${field("Link do Spotify", `<input id="podcastSpotifyUrl" type="url" value="${esc(p.spotify_url)}" placeholder="https://open.spotify.com/episode/…">`)}
        ${field("Link do YouTube", `<input id="podcastYoutubeUrl" type="url" value="${esc(p.youtube_url)}" placeholder="https://youtube.com/…">`)}
        ${field(
          "Status",
          `<select id="podcastStatus">
             <option value="Rascunho" ${!isPublished(p) ? "selected" : ""}>Rascunho</option>
             <option value="Publicado" ${isPublished(p) ? "selected" : ""}>Publicado</option>
           </select>`,
        )}
      </div>
      <p class="admin-note">O episódio aparece no site quando estiver “Publicado” e tiver ao menos um áudio, link do Spotify ou do YouTube. <strong>Para agendar</strong>, publique com uma data futura: ele aparece sozinho no dia.</p>
      <div class="podcast-form-actions">
        <button class="btn btn-ghost" type="button" onclick="cancelPodcastEdit()">Cancelar</button>
        <button class="btn btn-ghost" type="button" onclick="savePodcastForm(false)">${isNew ? "Salvar" : "Salvar alterações"}</button>
        <button class="btn btn-primary" type="button" onclick="savePodcastForm(true)">Publicar</button>
      </div>
    </div>`;
}

function refreshPodcastCoverPreview(url) {
  const box = document.getElementById("podcastCoverUpload");
  if (box) box.innerHTML = uploadRow(url, "uploadPodcastCover(this)", "image/png,image/jpeg,image/webp", "Escolher imagem");
}

function startNewPodcast() {
  editingPodcastId = "new";
  renderAdmin();
}

function editPodcast(id) {
  editingPodcastId = id;
  renderAdmin();
}

function cancelPodcastEdit() {
  editingPodcastId = null;
  renderAdmin();
}

function podcastFormPayload(forcePublish) {
  const val = (id) => document.getElementById(id)?.value.trim() || "";
  return {
    title: val("podcastTitle"),
    description: val("podcastDescription"),
    episode_number: Number(val("podcastEpisodeNumber")) || 0,
    cover_url: val("podcastCoverUrl"),
    audio_url: val("podcastAudioUrl"),
    spotify_url: val("podcastSpotifyUrl"),
    youtube_url: val("podcastYoutubeUrl"),
    published_at: val("podcastPublishedAt") || null,
    status: forcePublish ? "Publicado" : val("podcastStatus") || "Rascunho",
  };
}

async function savePodcastForm(forcePublish) {
  const payload = podcastFormPayload(forcePublish);
  if (!payload.title) return showToast("Informe o título do episódio.", "error");
  if (!payload.episode_number) return showToast("Informe o número do episódio.", "error");
  if (payload.status === "Publicado" && !payload.audio_url && !payload.spotify_url && !payload.youtube_url) {
    return showToast("Adicione um áudio, link do Spotify ou do YouTube.", "error");
  }
  if (payload.status === "Publicado" && !payload.published_at) payload.published_at = localISO();

  const isNew = editingPodcastId === "new";
  const query = isNew ? db("podcasts").insert(payload) : db("podcasts").update(payload).eq("id", editingPodcastId);
  const saved = await dbWrite(
    query.select().single(),
    payload.status === "Publicado" ? "Episódio publicado!" : isNew ? "Episódio salvo como rascunho!" : "Episódio atualizado!",
    "Não foi possível salvar o episódio.",
  );
  if (!saved) return;
  const mapped = mapPodcast(saved);
  if (isNew) data.podcasts.unshift(mapped);
  else data.podcasts = data.podcasts.map((x) => (String(x.id) === String(editingPodcastId) ? mapped : x));
  editingPodcastId = null;
  renderAdmin();
  renderSite();
}

async function uploadPodcastCover(input) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando capa…");
  try {
    const url = await uploadFile(file, "podcasts");
    document.getElementById("podcastCoverUrl").value = url;
    refreshPodcastCoverPreview(url);
    showToast("Capa enviada. Salve o episódio para confirmar.", "success");
  } catch (e) {
    console.error("Erro no upload da capa:", e);
    showToast(e.userMessage || "Erro ao enviar a capa.", "error");
  }
}

async function uploadPodcastAudio(input) {
  const file = input.files?.[0];
  if (!file) return;
  const status = document.getElementById("podcastAudioStatus");
  if (file.size > 50 * 1024 * 1024) return showToast("Arquivo maior que 50 MB.", "error");
  status.textContent = `Enviando ${file.name}…`;
  try {
    const url = await uploadFile(file, "podcasts/audio");
    document.getElementById("podcastAudioUrl").value = url;
    status.textContent = "Áudio enviado. Salve o episódio para confirmar.";
    showToast("Áudio enviado!", "success");
  } catch (e) {
    console.error("Erro no upload do áudio:", e);
    status.textContent = e.userMessage || "Erro ao enviar o áudio.";
    showToast(e.userMessage || "Erro ao enviar o áudio.", "error");
  }
}

async function removePodcast(id) {
  const p = (data.podcasts || []).find((x) => String(x.id) === String(id));
  if (!p || !confirm(`Deseja realmente excluir "${p.title}"?`)) return;
  if (!(await dbWrite(db("podcasts").delete().eq("id", id), "Episódio excluído!", "Erro ao excluir o episódio."))) return;
  data.podcasts = data.podcasts.filter((x) => String(x.id) !== String(id));
  if (player.id === String(id)) closePlayer();
  renderAdmin();
  renderSite();
}

/* ---- NOTÍCIAS ---- */
function tabNews() {
  const items = data.news || [];
  return `
    ${topbar("Notícias", `<button class="btn btn-primary btn-sm" type="button" onclick="addNews()">+ Nova notícia</button>`)}
    <p class="admin-note"><strong>Publicação agendada:</strong> marque “Publicada” e escolha uma data futura. A notícia aparece no site automaticamente nesse dia.</p>
    ${
      items.length
        ? items
            .map(
              (n, i) => `
      <div class="admin-card">
        <div class="field-row">
          ${field("Título", `<input type="text" value="${esc(n.title)}" onchange="updateNews(${i},'title',this.value)">`, true)}
          ${field("Slug (endereço)", `<input type="text" value="${esc(n.slug)}" onchange="this.value=slugify(this.value); updateNews(${i},'slug',this.value)">`)}
          ${field("Autor", `<input type="text" value="${esc(n.author)}" onchange="updateNews(${i},'author',this.value)">`)}
          ${field("Resumo", `<textarea onchange="updateNews(${i},'summary',this.value)">${esc(n.summary)}</textarea>`, true)}
          ${field("Conteúdo", `<textarea rows="8" onchange="updateNews(${i},'content',this.value)">${esc(n.content)}</textarea>`, true)}
          ${field("Imagem de capa", `<input type="url" value="${esc(n.cover_image)}" onchange="updateNews(${i},'cover_image',this.value)" placeholder="Cole o link ou envie abaixo">${uploadRow(n.cover_image, `handleNewsImageUpload(this, ${i})`)}`, true)}
          ${field("Data", `<input type="date" value="${esc(n.published_at ? String(n.published_at).slice(0, 10) : "")}" onchange="updateNews(${i},'published_at',this.value)">`)}
          ${field(
            "Publicação",
            `<label class="check"><input type="checkbox" ${n.published !== false ? "checked" : ""} onchange="updateNews(${i},'published',this.checked)"> Publicada</label>
             <label class="check"><input type="checkbox" ${n.featured ? "checked" : ""} onchange="updateNews(${i},'featured',this.checked)"> Destaque</label>`,
          )}
        </div>
        <div class="admin-card-foot end"><button class="btn btn-danger btn-sm" type="button" onclick="removeNews(${i})">Excluir</button></div>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhuma notícia cadastrada.")
    }`;
}

async function handleNewsImageUpload(input, i) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando imagem…");
  try {
    await updateNews(i, "cover_image", await uploadFile(file, "noticias"));
    renderAdmin();
  } catch (e) {
    console.error("Erro ao enviar imagem:", e);
    showToast(e.userMessage || "Erro ao enviar imagem.", "error");
  }
}

async function addNews() {
  const created = await dbWrite(
    db("news")
      .insert({ title: "Nova notícia", slug: `nova-noticia-${Date.now()}`, summary: "", content: "", cover_image: "", published_at: localISO(), author: "", featured: false, published: false })
      .select()
      .single(),
    "Notícia criada como rascunho!",
    "Erro ao criar notícia.",
  );
  if (!created) return;
  data.news.unshift(mapNews(created));
  renderAdmin();
}

async function updateNews(i, key, val) {
  const n = data.news[i];
  if (!n) return;
  n[key] = val;
  if (await dbWrite(db("news").update({ [key]: val === "" && key === "published_at" ? null : val }).eq("id", n.id), "Notícia atualizada!", "Erro ao atualizar notícia.")) {
    renderSite();
  }
}

async function removeNews(i) {
  const n = data.news[i];
  if (!n || !confirm(`Deseja excluir "${n.title}"?`)) return;
  if (!(await dbWrite(db("news").delete().eq("id", n.id), "Notícia excluída!", "Erro ao excluir notícia."))) return;
  data.news.splice(i, 1);
  renderAdmin();
  renderSite();
}

/* ---- AVISOS ---- */
function tabAnnouncements() {
  return `
    ${topbar("Avisos", `<button class="btn btn-primary btn-sm" type="button" onclick="addAnnouncement()">+ Novo aviso</button>`)}
    ${
      data.announcements.length
        ? data.announcements
            .map(
              (a, i) => `
      <div class="admin-card">
        <div class="field-row">
          ${field("Texto", `<textarea onchange="updateAnnouncement(${i},'text',this.value)">${esc(a.text)}</textarea>`, true)}
          ${field(
            "Prioridade",
            `<select onchange="updateAnnouncement(${i},'priority',this.value)">${["baixa", "média", "alta"].map((o) => `<option value="${o}" ${a.priority === o ? "selected" : ""}>${o}</option>`).join("")}</select>`,
          )}
          ${field("Cor", `<input type="color" value="${esc(a.color)}" onchange="updateAnnouncement(${i},'color',this.value)">`)}
          ${field("Início", `<input type="date" value="${esc(a.startDate)}" onchange="updateAnnouncement(${i},'startDate',this.value)">`)}
          ${field("Expira em", `<input type="date" value="${esc(a.endDate)}" onchange="updateAnnouncement(${i},'endDate',this.value)">`)}
          ${field("Link (opcional)", `<input type="url" value="${esc(a.link)}" onchange="updateAnnouncement(${i},'link',this.value)">`, true)}
        </div>
        <div class="admin-card-foot end"><button class="btn btn-danger btn-sm" type="button" onclick="removeAnnouncement(${i})">Excluir aviso</button></div>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhum aviso cadastrado.")
    }`;
}

async function addAnnouncement() {
  const created = await dbWrite(
    db("announcements").insert({ text: "Novo aviso", priority: "média", color: "#E3A857", link: "", start_date: localISO(), end_date: null }).select().single(),
    "Aviso criado!",
    "Erro ao criar aviso.",
  );
  if (!created) return;
  data.announcements.unshift(mapAnnouncement(created));
  renderAdmin();
  renderSite();
}

async function removeAnnouncement(i) {
  const ann = data.announcements[i];
  if (!ann || !confirm("Deseja realmente excluir este aviso?")) return;
  if (!(await dbWrite(db("announcements").delete().eq("id", ann.id), "Aviso excluído!", "Erro ao excluir aviso."))) return;
  data.announcements.splice(i, 1);
  renderAdmin();
  renderSite();
}

async function updateAnnouncement(i, key, val) {
  const ann = data.announcements[i];
  ann[key] = val;
  const column = { startDate: "start_date", endDate: "end_date" }[key] || key;
  if (await dbWrite(db("announcements").update({ [column]: val === "" ? null : val }).eq("id", ann.id), "Aviso atualizado!", "Erro ao atualizar aviso.")) {
    renderSite();
  }
}

/* ---- MINISTÉRIOS ---- */
function tabMinistries() {
  return `
    ${topbar("Ministérios", `<button class="btn btn-primary btn-sm" type="button" onclick="addMinistry()">+ Novo ministério</button>`)}
    ${
      (data.ministries || []).length
        ? data.ministries
            .map(
              (m, i) => `
      <div class="admin-card">
        <div class="field-row">
          ${field("Nome", `<input type="text" value="${esc(m.name)}" onchange="updateMinistry(${i},'name',this.value)">`, true)}
          ${field("Descrição", `<textarea onchange="updateMinistry(${i},'description',this.value)">${esc(m.description)}</textarea>`, true)}
          ${field("Responsável", `<input type="text" value="${esc(m.responsible)}" onchange="updateMinistry(${i},'responsible',this.value)">`)}
          ${field("Imagem / logo", `<input type="url" value="${esc(m.image)}" onchange="updateMinistry(${i},'image',this.value)">${uploadRow(m.image, `uploadMinistryCover(this, ${i})`)}`)}
          ${field("Instagram", `<input type="url" value="${esc(m.instagram)}" onchange="updateMinistry(${i},'instagram',this.value)">`)}
          ${field("WhatsApp", `<input type="url" value="${esc(m.whatsapp)}" onchange="updateMinistry(${i},'whatsapp',this.value)">`)}
        </div>
        <div class="ministry-admin-gallery">
          <div class="gallery-admin-head">
            <strong>Fotos do ministério</strong>
            <label class="btn btn-ghost btn-sm upload-label">+ Adicionar fotos<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onchange="uploadMinistryPhotos(${i},this)"></label>
          </div>
          <div id="ministry-admin-photos-${esc(m.id)}" class="admin-photo-grid"><span class="admin-muted">Carregando fotos…</span></div>
        </div>
        <div class="admin-card-foot end"><button class="btn btn-danger btn-sm" type="button" onclick="removeMinistry(${i})">Excluir ministério</button></div>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhum ministério cadastrado.")
    }`;
}

async function refreshMinistryAdminPhotos(onlyId) {
  for (const m of data.ministries || []) {
    if (onlyId && m.id !== onlyId) continue;
    const target = document.getElementById(`ministry-admin-photos-${m.id}`);
    if (!target) continue;
    const { data: photos, error } = await db("ministry_images")
      .select("id,ministry_id,image_url,caption,sort_order,created_at")
      .eq("ministry_id", m.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      target.innerHTML = `<span class="admin-muted admin-photo-error">Erro ao carregar fotos: ${esc(error.message)}</span>`;
      continue;
    }
    target.innerHTML = (photos || []).length
      ? photos
          .map(
            (p) => `<div class="admin-photo-item">
              <img src="${esc(safeUrl(p.image_url))}" alt="${esc(p.caption || "Foto do ministério")}" loading="lazy">
              <button type="button" title="Excluir foto" data-id="${esc(p.id)}" data-ministry="${esc(m.id)}" onclick="deleteMinistryPhoto(this.dataset.id, this.dataset.ministry)">×</button>
            </div>`,
          )
          .join("")
      : '<span class="admin-muted">Nenhuma foto adicionada ainda.</span>';
  }
}

async function uploadMinistryPhotos(index, input) {
  const m = data.ministries[index];
  const files = [...(input.files || [])];
  if (!m || !files.length) return;
  showToast(`Enviando ${files.length} foto(s)…`);
  try {
    const { data: existing } = await db("ministry_images").select("sort_order").eq("ministry_id", m.id).order("sort_order", { ascending: false }).limit(1);
    let sort = (existing?.[0]?.sort_order || 0) + 1;
    for (const file of files) {
      const url = await uploadFile(file, `ministries/${m.id}`);
      const { error } = await db("ministry_images").insert({ ministry_id: m.id, image_url: url, caption: "", sort_order: sort++ });
      if (error) throw error;
    }
    input.value = "";
    await refreshMinistryAdminPhotos(m.id);
    showToast("Fotos adicionadas!", "success");
  } catch (e) {
    console.error(e);
    showToast(e.userMessage || "Erro ao enviar fotos.", "error");
  }
}

async function deleteMinistryPhoto(id, ministryId) {
  if (!confirm("Excluir esta foto do ministério?")) return;
  if (await dbWrite(db("ministry_images").delete().eq("id", id), "Foto excluída!", "Erro ao excluir foto.")) {
    refreshMinistryAdminPhotos(ministryId);
  }
}

async function uploadMinistryCover(input, i) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando imagem…");
  try {
    await updateMinistry(i, "image", await uploadFile(file, "ministries"));
    renderAdmin();
  } catch (e) {
    console.error(e);
    showToast(e.userMessage || "Erro ao enviar imagem.", "error");
  }
}

async function addMinistry() {
  const created = await dbWrite(
    db("ministries").insert({ name: "Novo ministério", description: "", image: "", responsible: "", instagram: "", whatsapp: "" }).select().single(),
    "Ministério criado!",
    "Erro ao criar ministério.",
  );
  if (!created) return;
  data.ministries.unshift(mapMinistry(created));
  renderAdmin();
  renderSite();
}

async function removeMinistry(i) {
  const m = data.ministries[i];
  if (!m || !confirm(`Deseja excluir o ministério "${m.name}"?`)) return;
  if (!(await dbWrite(db("ministries").delete().eq("id", m.id), "Ministério excluído!", "Erro ao excluir."))) return;
  data.ministries.splice(i, 1);
  renderAdmin();
  renderSite();
}

async function updateMinistry(i, key, val) {
  const m = data.ministries[i];
  m[key] = val;
  if (await dbWrite(db("ministries").update({ [key]: val }).eq("id", m.id), "Atualizado!", "Erro ao atualizar.")) {
    renderSite();
  }
}

/* ---- DOAÇÕES ---- */
function tabDonationTypes() {
  const items = data.donationTypes || [];
  return `
    ${topbar("Ofertas e dízimos", `<button class="btn btn-primary btn-sm" type="button" onclick="addDonationType()">+ Nova finalidade</button>`)}
    ${
      items.length
        ? items
            .map(
              (t, i) => `
      <div class="admin-card">
        <h3>Informações gerais</h3>
        <div class="field-row">
          ${field("Nome", `<input type="text" value="${esc(t.name)}" onchange="updateDonationType(${i},'name',this.value)">`)}
          ${field("Slug (endereço)", `<input type="text" value="${esc(t.slug)}" onchange="this.value=slugify(this.value); updateDonationType(${i},'slug',this.value)">`)}
          ${field("Descrição", `<textarea rows="2" onchange="updateDonationType(${i},'description',this.value)">${esc(t.description)}</textarea>`, true)}
        </div>
        <h3>Dados do PIX e QR Code</h3>
        ${
          parsePixKey(t.pix_key)
            ? `<p class="admin-note admin-ok">${icon("check", 14)} Chave PIX válida (${esc(parsePixKey(t.pix_key).type)}).</p>`
            : `<p class="admin-note admin-warn">${icon("x", 14)} ${t.pix_key ? "Chave PIX inválida" : "Sem chave PIX"}: esta finalidade não aparece no site até ser corrigida. Use CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória.</p>`
        }
        ${t.cnpj && !validCNPJ(t.cnpj) ? `<p class="admin-note admin-warn">${icon("x", 14)} CNPJ inválido: não aparece no site.</p>` : ""}
        <div class="pix-admin">
          <div class="field-row">
            ${field("Chave PIX", `<input type="text" value="${esc(t.pix_key)}" onchange="updateDonationType(${i},'pix_key',this.value.trim()); renderAdmin()">`)}
            ${field("CNPJ", `<input type="text" value="${esc(t.cnpj)}" onchange="updateDonationType(${i},'cnpj',this.value.trim()); renderAdmin()">`)}
            ${field("Nome do recebedor", `<input type="text" value="${esc(t.pix_name)}" onchange="updateDonationType(${i},'pix_name',this.value)">`)}
            ${field("Cidade", `<input type="text" value="${esc(t.pix_city)}" onchange="updateDonationType(${i},'pix_city',this.value)">`)}
            ${field("URL do QR Code (opcional)", `<input type="url" value="${esc(t.qr_code_url)}" onchange="updateDonationType(${i},'qr_code_url',this.value)" placeholder="Sem imagem, o QR é gerado a partir da chave">`, true)}
          </div>
          <div class="qr-admin">
            ${safeUrl(t.qr_code_url) ? `<img src="${esc(safeUrl(t.qr_code_url))}" alt="QR Code">` : `<span class="admin-muted">QR gerado automaticamente</span>`}
            <label class="btn btn-ghost btn-sm upload-label">${t.qr_code_url ? "Trocar imagem" : "+ Enviar QR Code"}<input type="file" accept="image/*" hidden onchange="handleQRCodeUpload(this, ${i})"></label>
            ${t.qr_code_url ? `<button class="btn btn-danger btn-sm" type="button" onclick="updateDonationType(${i},'qr_code_url',''); renderAdmin()">Remover</button>` : ""}
          </div>
        </div>
        <div class="admin-card-foot">
          <div class="inline-fields">
            <label class="field-inline">Ordem <input type="number" value="${esc(t.sort_order || i + 1)}" onchange="updateDonationType(${i},'sort_order',Number(this.value))"></label>
            <label class="check"><input type="checkbox" ${t.active !== false ? "checked" : ""} onchange="updateDonationType(${i},'active',this.checked)"> Exibir no site</label>
          </div>
          <button class="btn btn-danger btn-sm" type="button" onclick="removeDonationType(${i})">Excluir finalidade</button>
        </div>
      </div>`,
            )
            .join("")
        : adminEmpty("Nenhuma finalidade cadastrada.")
    }`;
}

async function handleQRCodeUpload(input, index) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando QR Code…");
  try {
    await updateDonationType(index, "qr_code_url", await uploadFile(file, "donations"));
    renderAdmin();
  } catch (e) {
    console.error("Erro no upload:", e);
    showToast(e.userMessage || "Erro ao enviar a imagem.", "error");
  }
}

async function updateDonationType(i, key, val) {
  const t = data.donationTypes[i];
  if (!t) return;
  t[key] = val;
  if (await dbWrite(db("donation_types").update({ [key]: val }).eq("id", t.id), "Doação atualizada!", "Erro ao salvar tipo de doação.")) {
    renderSite();
  }
}

async function addDonationType() {
  const created = await dbWrite(
    db("donation_types")
      .insert({ name: "Nova doação", slug: `nova-doacao-${Date.now()}`, description: "", pix_key: "", pix_name: "", pix_city: "SAO PAULO", cnpj: "", qr_code_url: "", active: true, sort_order: (data.donationTypes || []).length + 1 })
      .select()
      .single(),
    "Finalidade criada!",
    "Erro ao criar tipo de doação.",
  );
  if (!created) return;
  data.donationTypes.push(mapDonationType(created));
  renderAdmin();
  renderSite();
}

async function removeDonationType(i) {
  const t = data.donationTypes[i];
  if (!t || !confirm(`Excluir "${t.name}"?`)) return;
  if (!(await dbWrite(db("donation_types").delete().eq("id", t.id), "Finalidade excluída!", "Erro ao excluir."))) return;
  data.donationTypes.splice(i, 1);
  renderAdmin();
  renderSite();
}

/* ---- SOBRE ---- */
function tabAbout() {
  const a = data.about;
  const leaders = a.leaders || [];
  const milestones = a.milestones || [];
  return `
    ${topbar("Sobre a igreja")}
    <div class="admin-card">
      <div class="field-row">
        ${field("Nossa história", `<textarea rows="5" onchange="updateAbout('history',this.value)">${esc(a.history)}</textarea>`, true)}
        ${field("Missão", `<textarea onchange="updateAbout('mission',this.value)">${esc(a.mission)}</textarea>`, true)}
        ${field("Visão", `<textarea onchange="updateAbout('vision',this.value)">${esc(a.vision)}</textarea>`, true)}
        ${field("Valores (separados por vírgula)", `<input type="text" value="${esc((a.values || []).join(", "))}" onchange="updateAbout('values', this.value.split(',').map(s=>s.trim()).filter(Boolean))">`, true)}
        ${field("Pastor presidente / dirigente", `<input type="text" value="${esc(a.pastor)}" onchange="updateAbout('pastor',this.value)">`)}
      </div>
    </div>
    <div class="admin-card">
      <h3>Declaração de fé</h3>
      <p class="admin-note">Cole o texto oficial aprovado pela igreja. Se ficar vazio, a seção não aparece no site.</p>
      ${field("Texto", `<textarea rows="8" onchange="updateAbout('faith',this.value)">${esc(a.faith)}</textarea>`, true)}
    </div>
    <div class="admin-card">
      <h3>Liderança</h3>
      <p class="admin-note">Pastores, presbíteros e líderes que podem aparecer no site (com autorização de cada um).</p>
      ${
        leaders.length
          ? leaders
              .map(
                (l, i) => `
        <div class="admin-list-item">
          ${field("Nome", `<input type="text" value="${esc(l.name)}" onchange="updateAboutItem('leaders',${i},'name',this.value)">`)}
          ${field("Função", `<input type="text" value="${esc(l.role)}" onchange="updateAboutItem('leaders',${i},'role',this.value)" placeholder="Ex.: Pastor auxiliar">`)}
          <div class="item-actions"><button class="icon-btn" type="button" onclick="removeAboutItem('leaders',${i})" aria-label="Remover">${icon("x", 16)}</button></div>
        </div>`,
              )
              .join("")
          : `<div class="admin-empty">Nenhum líder cadastrado.</div>`
      }
      <button class="btn btn-ghost btn-sm" type="button" onclick="addAboutItem('leaders', { name: '', role: '' })">+ Adicionar líder</button>
    </div>
    <div class="admin-card">
      <h3>Linha do tempo</h3>
      <p class="admin-note">Fatos marcantes da história da igreja (fundação, inauguração do templo…). Só datas e fatos confirmados. No site, a ordem segue o ano.</p>
      ${
        milestones.length
          ? milestones
              .map(
                (m, i) => `
        <div class="admin-subcard">
          <div class="field-row">
            ${field("Ano ou data", `<input type="text" value="${esc(m.year)}" onchange="updateAboutItem('milestones',${i},'year',this.value)" placeholder="Ex.: 1985">`)}
            ${field("Título", `<input type="text" value="${esc(m.title)}" onchange="updateAboutItem('milestones',${i},'title',this.value)">`)}
            ${field("Texto", `<textarea onchange="updateAboutItem('milestones',${i},'text',this.value)">${esc(m.text)}</textarea>`, true)}
            ${field("Foto (opcional)", `<input type="url" value="${esc(m.image)}" onchange="updateAboutItem('milestones',${i},'image',this.value.trim())">${uploadRow(m.image, `uploadMilestoneImage(this, ${i})`)}`)}
            ${field("Descrição da foto", `<input type="text" value="${esc(m.imageAlt)}" onchange="updateAboutItem('milestones',${i},'imageAlt',this.value)" placeholder="Para leitores de tela">`)}
          </div>
          <div class="admin-card-foot end"><button class="btn btn-danger btn-sm" type="button" onclick="removeAboutItem('milestones',${i})">Remover</button></div>
        </div>`,
              )
              .join("")
          : `<div class="admin-empty">Nenhum fato cadastrado. A linha do tempo fica escondida no site.</div>`
      }
      <button class="btn btn-ghost btn-sm" type="button" onclick="addAboutItem('milestones', { year: '', title: '', text: '', image: '', imageAlt: '' })">+ Adicionar fato</button>
    </div>`;
}

function updateAbout(key, val) {
  data.about[key] = val;
  persist();
}

function addAboutItem(list, item) {
  data.about[list] = [...(data.about[list] || []), item];
  persist({ rerenderAdmin: true });
}

function updateAboutItem(list, i, key, val) {
  if (!data.about[list]?.[i]) return;
  data.about[list][i][key] = val;
  persist();
}

function removeAboutItem(list, i) {
  if (!confirm("Remover este item?")) return;
  data.about[list].splice(i, 1);
  persist({ rerenderAdmin: true });
}

async function uploadMilestoneImage(input, i) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando foto…");
  try {
    updateAboutItem("milestones", i, "image", await uploadFile(file, "historia"));
    renderAdmin();
  } catch (e) {
    console.error(e);
    showToast(e.userMessage || "Erro ao enviar a foto.", "error");
  }
}

/* ---- PRIMEIRA VISITA ---- */
function tabFirstVisit() {
  const fv = data.firstVisit || {};
  const box = (key, label, hint, rows = 4) =>
    field(label, `<textarea rows="${rows}" onchange="updateFirstVisit('${key}',this.value)" placeholder="${esc(hint)}">${esc(fv[key])}</textarea>`, true);
  return `
    ${topbar("Primeira visita")}
    <div class="admin-card">
      <p class="admin-note">Página para quem nunca veio à igreja (/primeira-visita). Horários, endereço e WhatsApp vêm das abas “Cultos” e “Igreja & redes”. Cada bloco abaixo só aparece no site se for preenchido.</p>
      <div class="field-row">
        ${box("intro", "Mensagem de boas-vindas", "Ex.: Que bom que você quer nos conhecer!", 3)}
        ${box("expect", "O que esperar de um culto", "Duração média, como é o louvor, se há recepção na entrada…")}
        ${box("kids", "Para as crianças", "Existe culto infantil ou espaço para as crianças? Em quais horários?")}
        ${box("accessibility", "Acessibilidade", "Rampa, banheiro adaptado, lugares reservados…")}
        ${box("directions", "Como chegar", "Estação de metrô ou ônibus mais próximos, estacionamento…")}
      </div>
    </div>`;
}

function updateFirstVisit(key, val) {
  data.firstVisit = { ...(data.firstVisit || {}), [key]: val };
  persist();
}

/* ---- IGREJA & REDES ---- */
function tabChurch() {
  const c = data.church;
  const s = data.socials;
  return `
    ${topbar("Dados da igreja")}
    <div class="admin-card">
      <div class="field-row">
        ${field("Nome da igreja", `<input type="text" value="${esc(c.name)}" onchange="updateChurch('name',this.value)">`, true)}
        ${field("Endereço", `<input type="text" value="${esc(c.address)}" onchange="updateChurch('address',this.value)">`, true)}
        ${field("Telefone", `<input type="text" value="${esc(c.phone)}" onchange="updateChurch('phone',this.value)">`)}
        ${field("Link do Google Maps", `<input type="url" value="${esc(c.mapsUrl)}" onchange="updateChurch('mapsUrl',this.value)">`)}
        ${field("Logo (URL)", `<input type="url" value="${esc(c.logoUrl)}" onchange="updateChurch('logoUrl',this.value)" placeholder="Deixe vazio para usar a logo padrão">${uploadRow(c.logoUrl, "uploadChurchLogo(this)")}`, true)}
        ${field("ID do canal do YouTube (para o botão “Ao vivo”)", `<input type="text" value="${esc(c.liveChannelId)}" onchange="updateChurch('liveChannelId',this.value.trim())" placeholder="UC…">`, true)}
        ${field("E-mail para assuntos de privacidade (LGPD)", `<input type="email" value="${esc(c.privacyEmail)}" onchange="updateChurch('privacyEmail',this.value.trim())" placeholder="Aparece na Política de Privacidade">`, true)}
      </div>
      <p class="admin-note">Com o ID do canal preenchido, o botão “Ao vivo” abre a transmissão dentro do site. Sem ele, o botão leva para a biblioteca de vídeos.</p>
    </div>
    <div class="admin-card">
      <h3>Redes sociais</h3>
      ${socialRow("Instagram", "instagram", c.instagramUrl, s.instagram?.enabled)}
      ${socialRow("YouTube", "youtube", c.youtubeUrl, s.youtube?.enabled)}
      ${socialRow("Facebook", "facebook", c.facebookUrl, s.facebook?.enabled)}
      ${socialRow("WhatsApp", "whatsapp", c.whatsapp, s.whatsapp?.enabled)}
    </div>`;
}

function socialRow(label, key, url, enabled) {
  const urlKey = key === "whatsapp" ? "whatsapp" : key + "Url";
  return `
    <div class="admin-list-item">
      ${field(label, `<input type="url" value="${esc(url)}" onchange="updateChurch('${urlKey}', this.value)">`)}
      <label class="check"><input type="checkbox" ${enabled ? "checked" : ""} onchange="toggleSocial('${key}', this.checked)"> Ativo</label>
    </div>`;
}

async function uploadChurchLogo(input) {
  const file = input.files?.[0];
  if (!file) return;
  showToast("Enviando logo…");
  try {
    updateChurch("logoUrl", await uploadFile(file, "logo"));
    renderAdmin();
  } catch (e) {
    console.error(e);
    showToast(e.userMessage || "Erro ao enviar a logo.", "error");
  }
}

function updateChurch(key, val) {
  data.church[key] = val;
  persist();
}

function toggleSocial(key, val) {
  data.socials[key] = { ...(data.socials[key] || {}), enabled: val };
  persist();
}
