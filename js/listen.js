/* ============================================================
   MODO OUVIR — leitura em voz alta com a voz do próprio aparelho
   ------------------------------------------------------------
   Usa a síntese de voz do navegador (Web Speech API): é gratuita,
   funciona sem internet e não envia o texto para nenhum serviço.
   Cada página marca, na ordem, o que pode ser lido com data-listen
   (data-listen-text substitui o texto falado, ex.: "João, capítulo
   3"). O container [data-listen-root] pode informar:
     data-listen-title  nome mostrado na barra
     data-listen-next   endereço para continuar quando terminar
                        (ex.: o próximo capítulo da Bíblia)
   A posição fica guardada por página: dá para parar e continuar.
   ============================================================ */
const LISTEN_OK = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const LISTEN_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const LISTEN_PREFS_KEY = "listen-prefs";
const LISTEN_POS_KEY = "listen-pos";

const listen = {
  segs: [], // [{ text, el }] — el = índice do elemento [data-listen] na página
  i: 0,
  playing: false,
  path: "",
  title: "",
  next: "",
  autoNext: false, // continuar sozinho quando a próxima página terminar de carregar
  token: 0, // invalida os avisos de falas que já foram canceladas
  bar: null,
  voices: [],
};

function listenPrefs() {
  try {
    return { rate: 1, voice: "", follow: true, ...JSON.parse(localStorage.getItem(LISTEN_PREFS_KEY) || "{}") };
  } catch {
    return { rate: 1, voice: "", follow: true };
  }
}

function saveListenPrefs(patch) {
  try {
    localStorage.setItem(LISTEN_PREFS_KEY, JSON.stringify({ ...listenPrefs(), ...patch }));
  } catch {}
}

function listenButtonHTML(kind = "btn") {
  if (!LISTEN_OK) return "";
  return kind === "icon"
    ? `<button class="icon-btn listen-trigger" type="button" onclick="listenToggle()" aria-label="Ouvir em voz alta">${icon("headphones", 17)}</button>`
    : `<button class="btn btn-ghost btn-sm listen-trigger" type="button" onclick="listenToggle()">${icon("headphones", 15)} Ouvir</button>`;
}

/* ---------- Texto ---------- */
const listenElements = () => [...document.querySelectorAll("#main [data-listen]")];

function listenTextOf(el) {
  if (el.dataset.listenText) return el.dataset.listenText;
  const copy = el.cloneNode(true);
  copy.querySelectorAll("sup, button, .no-listen, [aria-hidden='true']").forEach((n) => n.remove());
  return copy.textContent;
}

// Ajustes para a voz: colchetes da tradução, "SENHOR" em maiúsculas etc.
const speakable = (t) =>
  String(t ?? "")
    .replace(/[[\]]/g, "")
    .replace(/\bSENHOR\b/g, "Senhor")
    .replace(/\bDEUS\b/g, "Deus")
    .replace(/\s+/g, " ")
    .trim();

// Trechos curtos: o Chrome corta falas longas, e assim dá para destacar o trecho certo.
function chunkText(text, max = 220) {
  const sentences = text.match(/[^.!?;:]+[.!?;:]*["”’»)]*\s*/g) || [text];
  const out = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && (buf + s).length > max) {
      out.push(buf.trim());
      buf = "";
    }
    buf += s;
    if (buf.length >= 90) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  // Frase enorme sem pontuação: quebra nas vírgulas ou espaços.
  return out.flatMap((s) => {
    if (s.length <= max + 40) return [s];
    const parts = [];
    let rest = s;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(", ", max);
      if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
      if (cut < 1) cut = max;
      parts.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) parts.push(rest.trim());
    return parts;
  });
}

function listenBuild() {
  const segs = [];
  listenElements().forEach((el, k) => {
    const text = speakable(listenTextOf(el));
    if (text) chunkText(text).forEach((t) => segs.push({ text: t, el: k }));
  });
  return segs;
}

/* ---------- Posição salva por página ---------- */
function listenPositions() {
  try {
    return JSON.parse(localStorage.getItem(LISTEN_POS_KEY) || "{}");
  } catch {
    return {};
  }
}

function listenSavePos() {
  if (!listen.path) return;
  const all = listenPositions();
  all[listen.path] = { i: listen.i, n: listen.segs.length, at: Date.now() };
  const keep = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, 40);
  try {
    localStorage.setItem(LISTEN_POS_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {}
}

function listenClearPos(path) {
  const all = listenPositions();
  delete all[path];
  try {
    localStorage.setItem(LISTEN_POS_KEY, JSON.stringify(all));
  } catch {}
}

/* ---------- Vozes ---------- */
function listenLoadVoices() {
  if (!LISTEN_OK) return;
  listen.voices = speechSynthesis.getVoices().filter((v) => /^pt/i.test(v.lang));
  if (listen.bar) listenPaintVoices();
}
if (LISTEN_OK) {
  listenLoadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", listenLoadVoices);
}

function listenVoice() {
  const all = listen.voices;
  if (!all.length) return null;
  const pref = listenPrefs().voice;
  const br = all.filter((v) => /^pt[-_]BR/i.test(v.lang));
  return (
    all.find((v) => v.voiceURI === pref) ||
    br.find((v) => /natural|online|google|luciana|francisca|antonio/i.test(v.name)) ||
    br[0] ||
    all[0]
  );
}

/* ---------- Controles ---------- */
function listenToggle() {
  if (listen.segs.length && listen.path === location.pathname) {
    if (listen.playing) listenPause();
    else listenPlay();
  } else listenStart();
}

function listenStart({ fromStart = false } = {}) {
  if (!LISTEN_OK) {
    showToast("Este navegador não tem leitura em voz alta.", "error");
    return;
  }
  const segs = listenBuild();
  if (!segs.length) {
    showToast("Não há texto para ouvir nesta página.");
    return;
  }
  // Um áudio de cada vez: pausa o podcast.
  if (typeof player !== "undefined" && player.audio && !player.audio.paused) player.audio.pause();
  const root = document.querySelector("#main [data-listen-root]");
  listen.segs = segs;
  listen.path = location.pathname;
  listen.title = root?.dataset.listenTitle || document.title.split(" | ")[0];
  listen.next = root?.dataset.listenNext || "";
  const saved = fromStart ? null : listenPositions()[listen.path];
  listen.i = saved && saved.n === segs.length && saved.i > 0 && saved.i < segs.length - 1 ? saved.i : 0;
  if (listen.i > 0) showToast("Continuando de onde você parou.");
  if (!listen.voices.length) listenLoadVoices();
  listenOpenBar();
  listenPlay();
}

function listenPlay() {
  listen.playing = true;
  listenSpeak();
}

function listenPause() {
  listen.playing = false;
  listen.token++;
  if (LISTEN_OK) speechSynthesis.cancel();
  listenSavePos();
  listenPaintBar();
}

function listenSpeak() {
  const token = ++listen.token;
  const seg = listen.segs[listen.i];
  if (!seg) return listenFinished();
  const u = new SpeechSynthesisUtterance(seg.text);
  u.lang = "pt-BR";
  u.rate = listenPrefs().rate;
  try {
    const voice = listenVoice();
    if (voice) u.voice = voice;
  } catch {} // voz indisponível: usa a padrão do aparelho
  u.onend = () => {
    if (token !== listen.token || !listen.playing) return;
    listen.i++;
    listenSavePos();
    if (listen.i < listen.segs.length) listenSpeak();
    else listenFinished();
  };
  u.onerror = (e) => {
    if (token !== listen.token || e.error === "interrupted" || e.error === "canceled") return;
    console.warn("Modo ouvir:", e.error);
    listenPause();
    showToast("A leitura foi interrompida. Toque em ouvir para continuar.", "error");
  };
  listenHighlight(seg);
  listenPaintBar();
  // Se algo ainda estiver falando, cancela e espera um instante (o Chrome às vezes
  // ignora uma fala logo depois do cancel). Senão fala na hora — no iPhone a 1ª
  // fala precisa acontecer dentro do toque no botão.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(() => token === listen.token && listen.playing && speechSynthesis.speak(u), 80);
  } else {
    speechSynthesis.speak(u);
  }
}

function listenStep(delta) {
  if (!listen.segs.length) return;
  listen.i = Math.max(0, Math.min(listen.segs.length - 1, listen.i + delta));
  listenSavePos();
  if (listen.playing) listenSpeak();
  else {
    listenHighlight(listen.segs[listen.i]);
    listenPaintBar();
  }
}

function listenRestart() {
  listen.i = 0;
  listenSavePos();
  listenPlay();
}

function listenFinished() {
  listen.playing = false;
  listenClearPos(listen.path);
  listenHighlight(null);
  if (listen.next) {
    // Continuidade: abre o próximo capítulo e segue lendo quando ele carregar.
    listen.autoNext = true;
    navigateTo(listen.next);
    return;
  }
  listen.i = 0;
  listenPaintBar();
  showToast("Leitura concluída.", "success");
}

// Chamado pelas páginas que carregam o texto depois (Bíblia, EBD, Palavra).
function listenContentReady() {
  if (!listen.autoNext) return;
  listen.autoNext = false;
  listenStart({ fromStart: true });
}

// Ao trocar de página por conta própria, a leitura para (a posição fica salva).
function listenRouteChanged() {
  if (listen.autoNext) {
    listen.token++;
    if (LISTEN_OK) speechSynthesis.cancel();
    return;
  }
  if (listen.segs.length) listenStop();
}

function listenStop() {
  if (listen.playing) listenPause();
  listenHighlight(null);
  listen.segs = [];
  listen.path = "";
  listen.bar?.classList.remove("open");
  document.body.classList.remove("has-listen");
}

function listenCycleRate() {
  const p = listenPrefs();
  const idx = LISTEN_RATES.indexOf(p.rate);
  const rate = LISTEN_RATES[(idx + 1) % LISTEN_RATES.length];
  saveListenPrefs({ rate });
  if (listen.playing) listenSpeak(); // recomeça o trecho atual na nova velocidade
  listenPaintBar();
}

function listenSetVoice(uri) {
  saveListenPrefs({ voice: uri });
  if (listen.playing) listenSpeak();
}

function listenSetFollow(on) {
  saveListenPrefs({ follow: on });
}

function listenToggleSettings(force) {
  const panel = listen.bar?.querySelector(".listen-settings");
  if (!panel) return;
  const open = typeof force === "boolean" ? force : panel.hidden;
  panel.hidden = !open;
  listen.bar.querySelector(".listen-gear").setAttribute("aria-expanded", String(open));
}

/* ---------- Destaque do trecho lido ---------- */
function listenHighlight(seg) {
  document.querySelectorAll(".is-reading").forEach((e) => e.classList.remove("is-reading"));
  if (!seg) return;
  const el = listenElements()[seg.el];
  if (!el) return;
  el.classList.add("is-reading");
  if (!listenPrefs().follow) return;
  const r = el.getBoundingClientRect();
  if (r.top < 120 || r.bottom > innerHeight - 150) el.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
}

/* ---------- Barra ---------- */
function listenEnsureBar() {
  if (listen.bar) return listen.bar;
  const el = document.createElement("div");
  el.className = "listen-bar";
  el.id = "listenBar";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Modo ouvir");
  el.innerHTML = `
    <div class="listen-progress"><span></span></div>
    <div class="listen-settings" hidden>
      <label class="listen-field">Voz <select onchange="listenSetVoice(this.value)" aria-label="Voz da leitura"></select></label>
      <label class="check"><input type="checkbox" onchange="listenSetFollow(this.checked)"> Acompanhar o texto na tela</label>
      <button class="link-btn" type="button" onclick="listenRestart()">Recomeçar do início</button>
      <p class="listen-note">A voz é a do seu aparelho e funciona sem internet. Em alguns celulares a leitura pausa quando a tela bloqueia.</p>
    </div>
    <div class="listen-inner">
      <span class="listen-icon" aria-hidden="true">${icon("headphones", 18)}</span>
      <div class="listen-meta">
        <span class="listen-kicker">Ouvindo</span>
        <strong class="listen-title"></strong>
      </div>
      <div class="listen-controls">
        <button class="player-btn" type="button" onclick="listenStep(-1)" aria-label="Trecho anterior">${icon("skipPrev", 18)}</button>
        <button class="player-btn player-main listen-main" type="button" onclick="listenToggle()" aria-label="Pausar">
          <span class="i-play">${icon("play", 20)}</span><span class="i-pause">${icon("pause", 18)}</span>
        </button>
        <button class="player-btn" type="button" onclick="listenStep(1)" aria-label="Próximo trecho">${icon("skipNext", 18)}</button>
      </div>
      <button class="listen-rate" type="button" onclick="listenCycleRate()" aria-label="Velocidade da leitura">1x</button>
      <button class="player-btn listen-gear" type="button" onclick="listenToggleSettings()" aria-label="Opções da leitura" aria-expanded="false">${icon("sliders", 18)}</button>
      <button class="player-btn" type="button" onclick="listenStop()" aria-label="Fechar o modo ouvir">${icon("x", 18)}</button>
    </div>`;
  document.body.appendChild(el);
  listen.bar = el;
  listenPaintVoices();
  return el;
}

function listenPaintVoices() {
  const sel = listen.bar?.querySelector(".listen-settings select");
  if (!sel) return;
  const current = listenVoice();
  sel.innerHTML = listen.voices.length
    ? listen.voices.map((v) => `<option value="${esc(v.voiceURI)}"${current && v.voiceURI === current.voiceURI ? " selected" : ""}>${esc(v.name)}</option>`).join("")
    : `<option value="">Padrão do aparelho</option>`;
}

function listenOpenBar() {
  const bar = listenEnsureBar();
  // O player do podcast e a barra de leitura não ficam abertos juntos.
  if (typeof closePlayer === "function" && player?.el?.classList.contains("open")) closePlayer();
  bar.querySelector(".listen-settings input[type=checkbox]").checked = listenPrefs().follow;
  listenPaintVoices();
  requestAnimationFrame(() => bar.classList.add("open"));
  document.body.classList.add("has-listen");
}

function listenPaintBar() {
  const bar = listen.bar;
  if (!bar) return;
  bar.classList.toggle("is-playing", listen.playing);
  bar.querySelector(".listen-main").setAttribute("aria-label", listen.playing ? "Pausar" : "Continuar");
  bar.querySelector(".listen-kicker").textContent = listen.playing ? "Ouvindo" : "Pausado";
  bar.querySelector(".listen-title").textContent = listen.title;
  bar.querySelector(".listen-rate").textContent = String(listenPrefs().rate).replace(".", ",") + "x";
  const pct = listen.segs.length ? (listen.i / listen.segs.length) * 100 : 0;
  bar.style.setProperty("--p", pct + "%");
  document.querySelectorAll(".listen-trigger").forEach((b) => b.classList.toggle("is-active", listen.playing && listen.path === location.pathname));
}

// O podcast começou a tocar: a leitura para.
if (typeof player !== "undefined") player.audio.addEventListener("play", () => listen.playing && listenStop());
// Sem isso, alguns navegadores continuam falando depois de recarregar a página.
window.addEventListener("pagehide", () => LISTEN_OK && speechSynthesis.cancel());
