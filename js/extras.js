/* ============================================================
   EXTRAS — pedido de oração, agenda (.ics), SEO e app (PWA)
   ============================================================ */

/* ============================================================
   PEDIDO DE ORAÇÃO / CONTATO
   ------------------------------------------------------------
   Enviado para /api/contato (api/contato.mjs), que valida e manda
   um e-mail para a equipe da igreja. Nada fica guardado no site.
   ============================================================ */
const PRAYER_TYPES = ["Pedido de oração", "Quero visitar a igreja", "Quero conversar com um pastor", "Outro assunto"];
const PRAYER_COOLDOWN_MS = 30000;

function prayerFormHTML(selectedType = "") {
  return `
  <div class="prayer-card" data-reveal>
    <form class="prayer-form" name="contato" data-shown="${Date.now()}" onsubmit="submitPrayer(event)" novalidate>
      <p class="hp" aria-hidden="true"><label>Não preencha: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <div class="pf-row">
        <label class="pf-field"><span>Seu nome <em>(opcional)</em></span><input name="nome" type="text" maxlength="80" autocomplete="name"></label>
        <label class="pf-field"><span>WhatsApp ou e-mail <em>(opcional)</em></span><input name="contato" type="text" maxlength="120" autocomplete="email" placeholder="Para darmos um retorno"></label>
      </div>
      <label class="pf-field"><span>Assunto</span>
        <select name="tipo">${PRAYER_TYPES.map((t) => `<option${t === selectedType ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
      </label>
      <label class="pf-field"><span>Mensagem</span><textarea name="mensagem" rows="4" maxlength="2000" required placeholder="Escreva aqui o seu pedido ou mensagem"></textarea></label>
      <label class="pf-check"><input type="checkbox" name="consentimento" value="sim" required>
        <span>Autorizo a igreja a usar estes dados, inclusive informações sobre a minha fé, apenas para orar e responder ao meu pedido.
        <a href="/privacidade">Política de privacidade</a>.</span></label>
      <p class="pf-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${icon("heart", 16)} Enviar</button>
    </form>
    <div class="prayer-done" aria-live="polite">
      <span class="prayer-done-icon">${icon("check", 26)}</span>
      <h3>Recebemos sua mensagem</h3>
      <p>Nossa equipe vai orar por você. Se você deixou um contato, retornaremos em breve.</p>
      <button class="btn btn-ghost btn-sm" type="button" onclick="resetPrayer(this)">Enviar outra mensagem</button>
    </div>
  </div>`;
}

function prayerSectionHTML() {
  return `
  <section class="block prayer-section">
    <div class="container prayer-grid">
      <div class="prayer-copy" data-reveal>
        <span class="eyebrow">Estamos com você</span>
        <h2>Pedido de oração</h2>
        <p>Compartilhe o seu pedido. Nosso círculo de oração vai orar por você. Se quiser, deixe um contato para
        conversarmos; se preferir, envie sem se identificar.</p>
        <ul class="prayer-points">
          <li>${icon("check", 16)} Tratado com sigilo pela equipe pastoral</li>
          <li>${icon("check", 16)} Você escolhe se quer se identificar</li>
        </ul>
      </div>
      ${prayerFormHTML()}
    </div>
  </section>`;
}

function prayerPageHTML() {
  return (
    pageHeroHTML("Estamos com você", "Pedido de oração e contato", "Envie o seu pedido, marque uma visita ou fale com um pastor.") +
    `
  <section class="block">
    <div class="container narrow">${prayerFormHTML()}</div>
  </section>`
  );
}

async function submitPrayer(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const err = form.querySelector(".pf-error");
  const fail = (msg) => {
    err.textContent = msg;
    err.hidden = false;
  };
  err.hidden = true;
  if (form.dataset.sending) return;

  const fd = new FormData(form);
  if (fd.get("bot-field")) return; // robô preencheu o campo escondido
  if (String(fd.get("mensagem") || "").trim().length < 3) return fail("Escreva a sua mensagem.");
  if (!fd.get("consentimento")) return fail("Para enviar, marque a autorização de uso dos dados.");

  let last = 0;
  try {
    last = Number(sessionStorage.getItem("prayer-last-sent")) || 0;
  } catch {}
  if (Date.now() - last < PRAYER_COOLDOWN_MS) return fail("Você acabou de enviar uma mensagem. Aguarde alguns segundos.");

  form.dataset.sending = "1";
  btn.disabled = true;
  btn.classList.add("loading");
  try {
    const res = await fetch("/api/contato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(fd), t: Date.now() - (Number(form.dataset.shown) || 0) }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    try {
      sessionStorage.setItem("prayer-last-sent", String(Date.now()));
    } catch {}
    form.reset();
    form.closest(".prayer-card").classList.add("sent");
  } catch (error) {
    console.error("Erro ao enviar formulário:", error);
    fail("Não foi possível enviar agora. Tente novamente em instantes ou fale conosco pelo WhatsApp.");
  } finally {
    delete form.dataset.sending;
    btn.disabled = false;
    btn.classList.remove("loading");
  }
}

function resetPrayer(btn) {
  btn.closest(".prayer-card").classList.remove("sent");
}

/* ============================================================
   ADICIONAR À AGENDA (.ics / Google Agenda)
   O Brasil não tem horário de verão desde 2019: São Paulo = UTC−3.
   ============================================================ */
function spToUTC(dateISO, time) {
  const [y, m, d] = String(dateISO).split("-").map(Number);
  const [hh, mm] = String(time || "00:00").split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, (hh || 0) + 3, mm || 0));
}

const icsStamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);

// Quebra linhas longas (limite de 75 caracteres do padrão iCalendar).
const icsFold = (line) => line.replace(/(.{73})/gu, "$1\r\n ").replace(/\r\n $/, "");

function buildICS({ uid, title, start, end, allDayDate, location, description, url, rrule }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AD Belem Pq Artur Alvim//Site//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@adbelem-pq-artur-alvim`,
    `DTSTAMP:${icsStamp(new Date())}`,
    allDayDate ? `DTSTART;VALUE=DATE:${allDayDate.replace(/-/g, "")}` : `DTSTART:${icsStamp(start)}`,
    allDayDate ? "" : `DTEND:${icsStamp(end)}`,
    rrule ? `RRULE:${rrule}` : "",
    `SUMMARY:${icsText(title)}`,
    location ? `LOCATION:${icsText(location)}` : "",
    description ? `DESCRIPTION:${icsText(description)}` : "",
    url ? `URL:${url}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(icsFold).join("\r\n");
}

function downloadICS(info) {
  const blob = new Blob([buildICS(info)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (slugify(info.title) || "evento") + ".ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast("Abrindo na sua agenda…", "success");
}

function googleCalendarUrl({ title, start, end, allDayDate, location, description, rrule }) {
  const dates = allDayDate
    ? `${allDayDate.replace(/-/g, "")}/${localISO(new Date(new Date(allDayDate + "T12:00:00").getTime() + 86400000)).replace(/-/g, "")}`
    : `${icsStamp(start)}/${icsStamp(end)}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates, location: location || "", details: description || "" });
  if (rrule) p.set("recur", "RRULE:" + rrule);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

const HOUR = 3600000;

function eventCalendarInfo(ev) {
  const start = ev.time ? spToUTC(ev.date, ev.time) : null;
  return {
    uid: "evento-" + ev.id,
    title: ev.name,
    start,
    end: start ? new Date(start.getTime() + 2 * HOUR) : null,
    allDayDate: ev.time ? null : ev.date,
    location: [ev.location, ev.address].filter(Boolean).join(" — ") || data.church.address,
    description: ev.description,
    url: location.origin + "/eventos",
  };
}

const RRULE_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Culto da programação: próxima ocorrência + repetição.
// monthly=true → só a troca do mês (ex.: Ceia do Senhor no 3º domingo).
// Com troca mensal, o horário normal repete nas OUTRAS semanas do mês.
function serviceCalendarInfo(day, item, monthly = false) {
  const wd = weekdayIndex(day);
  const m = monthlyRule(item);
  const wanted = (date) => !m || (monthly ? weekOfMonth(date) === m.week : weekOfMonth(date) !== m.week);
  const next = new Date();
  next.setDate(next.getDate() + ((wd - next.getDay() + 7) % 7));
  for (let i = 0; i < 6 && !wanted(next); i++) next.setDate(next.getDate() + 7);
  const start = spToUTC(localISO(next), item.time);
  const title = monthly && m ? m.name : item.name;
  const weeks = m ? [1, 2, 3, 4, 5].filter((w) => (monthly ? w === m.week : w !== m.week)) : [];
  return {
    uid: `culto-${slugify(day)}-${String(item.time).replace(":", "")}${monthly ? "-mensal" : ""}`,
    title,
    start,
    end: new Date(start.getTime() + 2 * HOUR),
    location: `${data.church.name} — ${data.church.address}`,
    description: monthly && m ? `${title} — ${nthWeekdayLabel(m.week, day)} do mês, às ${item.time}.` : m ? `${title} — ${day} às ${item.time} (exceto no ${nthWeekdayLabel(m.week, day)} do mês: ${m.name}).` : `${title} — toda ${day} às ${item.time}.`,
    url: location.origin + "/cultos",
    rrule: m ? `FREQ=MONTHLY;BYDAY=${weeks.map((w) => w + RRULE_DAY[wd]).join(",")}` : `FREQ=WEEKLY;BYDAY=${RRULE_DAY[wd]}`,
  };
}

function addEventToCalendar(id) {
  const ev = data.events.find((x) => String(x.id) === String(id));
  if (ev) downloadICS(eventCalendarInfo(ev));
}

function addServiceToCalendar(dayIndex, itemIndex, monthly = false) {
  const d = data.services[dayIndex];
  const it = d?.items?.[itemIndex];
  if (d && it && weekdayIndex(d.day) >= 0) downloadICS(serviceCalendarInfo(d.day, it, monthly));
}

function addHighlightToCalendar() {
  const n = nextHighlight();
  if (!n) return;
  if (n.kind === "event") return addEventToCalendar(n.ev.id);
  const match = (i) => i.time === n.time && i.name === (n.baseName || n.title);
  const di = data.services.findIndex((d) => d.day === n.day && (d.items || []).some(match));
  if (di >= 0) addServiceToCalendar(di, data.services[di].items.findIndex(match), !!n.monthly);
}

/* ============================================================
   SEO — dados estruturados (schema.org) para o Google
   ============================================================ */
function injectStructuredData() {
  const c = data.church;
  const origin = location.origin;
  const s = data.socials || {};
  const sameAs = [
    s.instagram?.enabled && c.instagramUrl,
    s.youtube?.enabled && c.youtubeUrl,
    s.facebook?.enabled && c.facebookUrl,
  ].filter((u) => u && safeUrl(u));
  const json = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: c.name,
    url: origin + "/",
    logo: origin + "/assets/img/logo-adbelem.png",
    image: origin + "/assets/img/og-image.jpg",
    telephone: c.phone || undefined,
    address: { "@type": "PostalAddress", streetAddress: c.address, addressLocality: "São Paulo", addressRegion: "SP", addressCountry: "BR" },
    sameAs,
    event: upcomingEvents()
      .slice(0, 10)
      .map((ev) => ({
        "@type": "Event",
        name: ev.name,
        startDate: ev.date + (ev.time ? `T${ev.time}:00-03:00` : ""),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        description: ev.description || undefined,
        image: safeUrl(ev.image) || undefined,
        location: { "@type": "Place", name: ev.location || c.name, address: ev.address || c.address },
      })),
  };
  let el = document.getElementById("ldjson");
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "ldjson";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(json).replace(/</g, "\\u003c");
}

/* ============================================================
   APP (PWA) — instalar na tela inicial
   ============================================================ */
let deferredInstall = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
// Samsung Internet: o "app" que ele gera é bloqueado pelo Google Play Protect
// ("criado para uma versão mais antiga do Android"). É defeito do navegador
// (sem correção até agora); pelo Chrome a instalação funciona. Por isso, nele,
// o index.html não oferece o manifesto e "Instalar o app" leva para o Chrome.
const isSamsungBrowser = /SamsungBrowser/i.test(navigator.userAgent);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// Veio do endereço antigo (…netlify.app → ?mudou): avisa uma vez que o site
// mudou de endereço e que o app instalado antes precisa ser instalado de novo.
let movedNotice = false;
try {
  const u = new URL(location.href);
  if (u.searchParams.has("mudou")) {
    movedNotice = true;
    u.searchParams.delete("mudou");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  }
} catch {}
if (movedNotice)
  document.addEventListener("DOMContentLoaded", () =>
    whenSplashGone(() =>
      openModal(
        `<div class="modal-pad">
          <span class="eyebrow">Endereço novo</span>
          <h3>O site da igreja mudou de endereço</h3>
          <p class="install-lead">Agora é <strong>${esc(location.host)}</strong>. Os links antigos continuam trazendo você para cá.</p>
          <p class="install-lead">Se você tinha o app da igreja instalado no celular, apague o ícone antigo e instale de novo por aqui, para receber as atualizações.</p>
          <div class="lib-form-actions"><button class="btn btn-primary" type="button" onclick="closeModal({ instant: true });installApp()">Instalar o app</button><button class="btn btn-ghost" type="button" onclick="closeModal()">Entendi</button></div>
        </div>`,
        { label: "Endereço novo" },
      ),
    ),
  );

// Veio do Samsung Internet pelo botão "Abrir no Chrome" (?instalar): assim que
// o Chrome permitir, oferece a instalação.
let installInvite = false;
try {
  const u = new URL(location.href);
  if (u.searchParams.has("instalar")) {
    installInvite = true;
    u.searchParams.delete("instalar");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  }
} catch {}

function whenSplashGone(fn, tries = 60) {
  const s = document.getElementById("splash");
  if (!s || s.classList.contains("done") || tries <= 0) return setTimeout(fn, 400);
  setTimeout(() => whenSplashGone(fn, tries - 1), 300);
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  document.body.classList.add("can-install");
  if (installInvite) {
    installInvite = false;
    whenSplashGone(() =>
      openModal(
        `<div class="modal-pad">
          <span class="eyebrow">App da igreja</span>
          <h3>Instalar o app</h3>
          <p class="install-lead">Pronto, agora pelo Chrome. Toque em “Instalar” e confirme.</p>
          <button class="btn btn-primary" type="button" onclick="closeModal({ instant: true });installApp()">Instalar</button>
        </div>`,
        { label: "Instalar o app" },
      ),
    );
  }
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  document.body.classList.remove("can-install");
  showToast("App instalado! Procure o ícone da igreja na sua tela inicial.", "success");
});
if ((isIOS || isSamsungBrowser) && !isStandalone()) document.addEventListener("DOMContentLoaded", () => document.body.classList.add("can-install"));

// Abre esta mesma página no Chrome (Android). Sem Chrome, cai na Play Store.
function chromeIntentUrl() {
  const store = "https://play.google.com/store/apps/details?id=com.android.chrome";
  const sep = location.search ? "&" : "?";
  return `intent://${location.host}${location.pathname}${location.search}${sep}instalar#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(store)};end`;
}

// Convite discreto para instalar o app; só aparece quando o navegador permite
// (body.can-install) e some depois de instalado.
function installHintHTML() {
  return `<div class="install-hint">
    <span class="install-hint-icon" aria-hidden="true"><img src="/assets/img/icon-192.png" alt="" width="40" height="40"></span>
    <div><strong>Tenha a Palavra Diária na tela inicial</strong><span>Instale o app da igreja: abre rápido e mostra o que você já leu mesmo sem internet.</span></div>
    <button class="btn btn-primary btn-sm" type="button" onclick="installApp()">Instalar</button>
  </div>`;
}

async function installApp() {
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    // O Chrome dispara beforeinstallprompt de novo mais tarde, se fizer sentido.
    document.body.classList.remove("can-install");
    return;
  }
  if (isSamsungBrowser) {
    openModal(
      `
    <div class="modal-pad">
      <span class="eyebrow">App da igreja</span>
      <h3>Instale pelo Chrome</h3>
      <p class="install-lead">No navegador Samsung Internet, a instalação de apps de sites está com um defeito e o Android mostra o aviso “App de risco bloqueado”. O app da igreja não tem nada de errado: pelo Chrome ele instala normalmente.</p>
      <a class="btn btn-primary" href="${esc(chromeIntentUrl())}">Abrir no Chrome</a>
      <p class="install-lead install-alt">Prefere continuar no Samsung Internet? Toque no menu <strong>⋮</strong> e escolha <strong>Adicionar página a</strong> → <strong>Tela inicial</strong>. Isso cria um atalho para o site na tela do celular.</p>
    </div>`,
      { label: "Instalar o app" },
    );
    return;
  }
  if (!isIOS) return;
  openModal(
    `
    <div class="modal-pad">
      <span class="eyebrow">App da igreja</span>
      <h3>Instalar no iPhone</h3>
      <ol class="install-steps">
        <li>Toque no botão <strong>Compartilhar</strong> ${icon("share", 16)} na barra do Safari.</li>
        <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
        <li>Toque em <strong>Adicionar</strong>. Pronto: o ícone da igreja fica junto dos seus apps.</li>
      </ol>
    </div>`,
    { label: "Instalar o app" },
  );
}

/* ---------- Atualização do app ----------
   O app instalado (Android) e o atalho na tela de início (iPhone) usam o
   mesmo site: páginas e scripts vêm sempre da rede quando há internet.
   O que pode ficar velho é um app aberto há muito tempo em segundo plano.
   Por isso, ao voltar para o app (e a cada 30 min) o site confere
   /version.json: se houver versão nova, aparece "Atualizar"; e, se a pessoa
   só trocar de página, a nova versão entra sozinha nessa troca. */
const APP_UPDATE = { ready: false, checking: false };

async function checkAppUpdate(reg) {
  const current = window.APP_CONFIG.VERSION;
  if (APP_UPDATE.ready || APP_UPDATE.checking || !current || current === "dev" || !navigator.onLine) return;
  APP_UPDATE.checking = true;
  try {
    reg?.update().catch(() => {});
    const res = await fetch("/version.json", { cache: "no-store" });
    const v = res.ok ? (await res.json()).v : "";
    if (v && v !== current) {
      APP_UPDATE.ready = true;
      showAppUpdate();
    }
  } catch {
  } finally {
    APP_UPDATE.checking = false;
  }
}

function showAppUpdate() {
  if (document.getElementById("appUpdate")) return;
  const bar = document.createElement("div");
  bar.id = "appUpdate";
  bar.className = "app-update";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span>${icon("check", 16)} ${isStandalone() ? "Nova versão do app disponível." : "Nova versão do site disponível."}</span>
    <button class="btn btn-sm" type="button" onclick="applyAppUpdate()">Atualizar</button>
    <button class="app-update-x" type="button" onclick="this.parentNode.remove()" aria-label="Depois">${icon("x", 16)}</button>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add("show"));
}

// Recarga feita pelo próprio site: a abertura dessa vez é a curta (não interrompe).
function reloadForUpdate() {
  try {
    sessionStorage.setItem("intro-curta", "1");
  } catch {}
  location.reload();
}

function applyAppUpdate() {
  reloadForUpdate();
}

// Chamado na troca de página: com versão nova pronta, a troca vira um
// carregamento normal (já com a versão nova), sem interromper ninguém —
// exceto no painel ou com o modo ouvir tocando.
function appUpdateOnNavigate() {
  if (!APP_UPDATE.ready || isAdminOpen() || document.querySelector(".listen-bar.is-playing")) return false;
  reloadForUpdate();
  return true;
}

function registerServiceWorker() {
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (!("serviceWorker" in navigator) || (location.protocol !== "https:" && !local)) return;
  window.addEventListener("load", async () => {
    let reg = null;
    try {
      reg = await navigator.serviceWorker.register("/sw.js");
    } catch (e) {
      console.warn("SW:", e);
    }
    const check = () => checkAppUpdate(reg);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    window.addEventListener("online", check);
    setInterval(check, 30 * 60000);
    navigator.serviceWorker.addEventListener("controllerchange", check);
    setTimeout(check, 4000);
  });
}
