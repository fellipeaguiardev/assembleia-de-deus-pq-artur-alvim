/* ============================================================
   PODCAST — seção da home, página, modal do episódio e player
   ============================================================ */

function publishedPodcasts() {
  return (data.podcasts || [])
    .filter((p) => normalizeText(p.status) === "publicado" && isDue(p.published_at))
    .sort(
      (a, b) =>
        new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0) ||
        (Number(b.episode_number) || 0) - (Number(a.episode_number) || 0),
    );
}

const findEpisode = (id) => publishedPodcasts().find((p) => String(p.id) === String(id));
const epLabel = (p) => (p.episode_number ? `EP. ${p.episode_number}` : "Episódio");
const epDate = (p) => fmtDateLong(p.published_at ? String(p.published_at).slice(0, 10) : "");

// width: tamanho em que a capa aparece (a miniatura vem já reduzida, ver imgThumb).
function coverStyle(p, width = 320) {
  return bgImage(imgThumb(p?.cover_url, width));
}

/* Botão redondo de play que reflete o estado do player global */
function epPlayButton(p, size = "md") {
  if (!safeUrl(p.audio_url)) return "";
  const playing = player.id === String(p.id) && !player.audio.paused;
  return `<button class="ep-play ep-play-${size} ${playing ? "is-playing" : ""}" type="button" data-ep-play="${esc(p.id)}"
      onclick="event.stopPropagation(); togglePlayEpisode(this.dataset.epPlay)" aria-label="${playing ? "Pausar" : "Ouvir"} ${esc(p.title)}">
      <span class="i-play">${icon("play", size === "lg" ? 24 : 18)}</span><span class="i-pause">${icon("pause", size === "lg" ? 22 : 16)}</span>
    </button>`;
}

function epPlatformLinks(p) {
  return [
    safeUrl(p.spotify_url) && `<a class="ep-platform" href="${href(p.spotify_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" aria-label="Ouvir no Spotify">${icon("spotify", 18)}</a>`,
    safeUrl(p.youtube_url) && `<a class="ep-platform" href="${href(p.youtube_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" aria-label="Assistir no YouTube">${icon("youtube", 18)}</a>`,
  ]
    .filter(Boolean)
    .join("");
}

/* Linha de episódio (lista estilo app de podcast) */
function episodeRowHTML(p) {
  return `
  <article class="ep-row" ${pressable("openPodcastModal", p.id, "Abrir episódio " + p.title)}>
    <div class="ep-cover" style="${coverStyle(p, 160)}">${safeUrl(p.cover_url) ? "" : icon("mic", 22)}</div>
    <div class="ep-info">
      <span class="card-kicker">${esc(epLabel(p))}${p.published_at ? " · " + epDate(p) : ""}</span>
      <h3>${esc(p.title)}</h3>
      <p class="clamp-2">${esc(p.description)}</p>
    </div>
    <div class="ep-actions">
      ${epPlatformLinks(p)}
      ${epPlayButton(p) || `<span class="ep-open" aria-hidden="true">${icon("headphones", 18)}</span>`}
    </div>
  </article>`;
}

function featuredEpisodeHTML(p, eyebrow) {
  const hasAudio = !!safeUrl(p.audio_url);
  return `
  <article class="podcast-featured" data-reveal>
    <div class="podcast-featured-cover" style="${coverStyle(p, 640)}">
      ${safeUrl(p.cover_url) ? "" : `<span class="cover-fallback">${icon("mic", 56)}</span>`}
      <span class="podcast-episode-badge">${esc(epLabel(p))}</span>
    </div>
    <div class="podcast-featured-info">
      <span class="eyebrow">${esc(eyebrow)}${p.published_at ? " · " + epDate(p) : ""}</span>
      <h3>${esc(p.title)}</h3>
      <p class="clamp-4">${esc(p.description || "Confira o episódio mais recente do nosso podcast.")}</p>
      <div class="podcast-actions">
        ${
          hasAudio
            ? `<button class="btn btn-accent" type="button" data-ep-play="${esc(p.id)}" onclick="togglePlayEpisode(this.dataset.epPlay)">${icon("play", 16)} Ouvir agora</button>`
            : `<button class="btn btn-accent" type="button" data-id="${esc(p.id)}" onclick="openPodcastModal(this.dataset.id)">${icon("headphones", 16)} Ouvir episódio</button>`
        }
        ${hasAudio ? `<button class="btn btn-outline-light" type="button" data-id="${esc(p.id)}" onclick="openPodcastModal(this.dataset.id)">Detalhes</button>` : ""}
        <span class="podcast-platforms">${epPlatformLinks(p)}</span>
      </div>
    </div>
  </article>`;
}

function podcastHomeHTML() {
  const items = publishedPodcasts();
  if (!items.length) return "";
  const recent = items.slice(1, 4);
  return `
  <section class="block podcast-home">
    <div class="container">
      ${sectionHead("Ouça e acompanhe", "Podcast", `<a class="btn btn-ghost btn-sm" href="/podcast">Todos os episódios</a>`)}
      ${featuredEpisodeHTML(items[0], "Episódio mais recente")}
      ${recent.length ? `<div class="ep-list" data-stagger>${recent.map(episodeRowHTML).join("")}</div>` : ""}
    </div>
  </section>`;
}

/* ---------------- Página /podcast: busca e "Mostrar mais" ---------------- */
const PODCAST_PAGE_SIZE = 12;
const podcastUI = { q: "", shown: PODCAST_PAGE_SIZE };

// Sem busca: todos menos o destaque. Com busca: todos que combinam (título e descrição).
function podcastListItems() {
  const items = publishedPodcasts();
  const q = normalizeText(podcastUI.q);
  if (!q) return items.slice(1);
  const words = q.split(/\s+/);
  return items.filter((p) => {
    const text = normalizeText(`${p.title} ${p.description} ${p.episode_number ? "ep " + p.episode_number : ""}`);
    return words.every((w) => text.includes(w));
  });
}

function podcastListHTML() {
  const list = podcastListItems();
  const shown = list.slice(0, podcastUI.shown);
  const q = podcastUI.q.trim();
  const rows = shown.length
    ? shown.map(episodeRowHTML).join("")
    : q
      ? `<p class="podcast-empty">Nenhum episódio com “${esc(q)}”. Tente o nome do pregador ou outra palavra.</p>`
      : "";
  const more = list.length - shown.length;
  return {
    rows,
    count: q && list.length ? `${list.length} ${list.length === 1 ? "episódio encontrado" : "episódios encontrados"}` : "",
    more: more > 0 ? `<button class="btn btn-ghost podcast-more" type="button" onclick="podcastShowMore()">Mostrar mais episódios <small>(${more})</small></button>` : "",
  };
}

function renderPodcastList() {
  const list = document.getElementById("podcastList");
  if (!list) return;
  const r = podcastListHTML();
  list.innerHTML = r.rows;
  document.getElementById("podcastCount").textContent = r.count;
  document.getElementById("podcastMore").innerHTML = r.more;
}

function podcastSearch(value) {
  podcastUI.q = value;
  podcastUI.shown = PODCAST_PAGE_SIZE;
  renderPodcastList();
}

function podcastShowMore() {
  const from = podcastUI.shown;
  podcastUI.shown += PODCAST_PAGE_SIZE * 2;
  renderPodcastList();
  document.querySelectorAll("#podcastList .ep-row")[from]?.focus({ preventScroll: true });
}

function podcastPageHTML() {
  const items = publishedPodcasts();
  const featured = items[0];
  const feed = data.podcastFeed || {};
  const follow = safeUrl(feed.spotifyUrl)
    ? `<a class="btn btn-ghost btn-sm" href="${href(feed.spotifyUrl)}" target="_blank" rel="noopener">${icon("spotify", 16)} Seguir no Spotify</a>`
    : "";
  const r = podcastListHTML();
  return (
    pageHeroHTML("Ouça onde estiver", "Podcast", "Mensagens, conversas e conteúdos para fortalecer sua fé e caminhar com a nossa comunidade.") +
    `
  <section class="block">
    <div class="container">
      ${
        featured
          ? featuredEpisodeHTML(featured, "Episódio mais recente") +
            (items.length > 1
              ? `${sectionHead("Biblioteca", `Todos os episódios (${items.length})`, follow)}
              ${
                items.length > PODCAST_PAGE_SIZE
                  ? `<form class="bible-search podcast-search" role="search" onsubmit="event.preventDefault();this.querySelector('input').blur()">
                      ${icon("search", 18)}
                      <label class="sr-only" for="podcastQuery">Buscar episódio</label>
                      <input id="podcastQuery" type="search" autocomplete="off" enterkeyhint="search" placeholder="Título, pregador ou assunto" value="${esc(podcastUI.q)}" oninput="podcastSearch(this.value)">
                    </form>`
                  : ""
              }
              <p class="podcast-count" id="podcastCount" aria-live="polite">${esc(r.count)}</p>
              <div class="ep-list" id="podcastList">${r.rows}</div>
              <div class="podcast-more-wrap" id="podcastMore">${r.more}</div>`
              : "")
          : emptyState("mic", "O primeiro episódio está chegando", "Volte em breve para ouvir nossas mensagens e conversas.")
      }
    </div>
  </section>`
  );
}

/* ---------------- Modal do episódio ---------------- */
function episodeSources(p) {
  const sources = [];
  if (safeUrl(p.audio_url)) sources.push({ id: "audio", label: "Ouvir aqui", icon: "headphones" });
  if (spotifyEmbed(p.spotify_url)) sources.push({ id: "spotify", label: "Spotify", icon: "spotify" });
  if (ytId(p.youtube_url)) sources.push({ id: "youtube", label: "YouTube", icon: "youtube" });
  return sources;
}

function episodeSourceHTML(p, source) {
  if (source === "spotify") {
    return `<div class="embed-spotify">${embedGate("spotify", spotifyEmbed(p.spotify_url), "Spotify — " + p.title, { allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture", openUrl: p.spotify_url, compact: true })}</div>`;
  }
  if (source === "youtube") {
    return `<div class="embed-video">${embedGate("youtube", `https://www.youtube-nocookie.com/embed/${ytId(p.youtube_url)}?rel=0`, "YouTube — " + p.title, { allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", openUrl: p.youtube_url })}</div>`;
  }
  return `<div class="embed-audio">
      ${epPlayButton(p, "lg")}
      <div><strong>Ouça direto no site</strong><span>O player continua tocando enquanto você navega.</span></div>
    </div>`;
}

function openPodcastModal(id) {
  const p = findEpisode(id);
  if (!p) return;
  const sources = episodeSources(p);
  if (routeBase(currentRoute()) === "podcast") history.replaceState(null, "", "/podcast/" + encodeURIComponent(p.id));
  openModal(
    `
    <div class="episode-modal">
      <div class="episode-head">
        <div class="episode-cover" style="${coverStyle(p)}">${safeUrl(p.cover_url) ? "" : icon("mic", 40)}</div>
        <div class="episode-meta">
          <span class="eyebrow">${esc(epLabel(p))}${p.published_at ? " · " + epDate(p) : ""}</span>
          <h3>${esc(p.title)}</h3>
          <button class="link-btn" type="button" data-id="${esc(p.id)}" onclick="shareEpisode(this.dataset.id)">${icon("share", 14)} Compartilhar</button>
        </div>
      </div>
      ${
        sources.length
          ? `${
              sources.length > 1
                ? `<div class="segmented" role="tablist" aria-label="Onde ouvir">${sources
                    .map(
                      (s, i) =>
                        `<button type="button" role="tab" aria-selected="${i === 0}" class="${i === 0 ? "active" : ""}" data-source="${s.id}" data-id="${esc(p.id)}" onclick="switchEpisodeSource(this)">${icon(s.icon, 15)} ${s.label}</button>`,
                    )
                    .join("")}</div>`
                : ""
            }
            <div class="episode-source" id="episodeSource">${episodeSourceHTML(p, sources[0].id)}</div>`
          : `<p class="episode-soon">${icon("clock", 16)} Conteúdo disponível em breve.</p>`
      }
      ${p.description ? `<div class="episode-desc">${esc(p.description).replace(/\n/g, "<br>")}</div>` : ""}
    </div>`,
    { className: "modal-episode", label: p.title },
  );
}

function switchEpisodeSource(btn) {
  const p = findEpisode(btn.dataset.id);
  if (!p) return;
  btn.parentElement.querySelectorAll("button").forEach((b) => {
    const on = b === btn;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  const box = document.getElementById("episodeSource");
  box.classList.remove("swap");
  void box.offsetWidth;
  box.classList.add("swap");
  box.innerHTML = episodeSourceHTML(p, btn.dataset.source);
}

function shareEpisode(id) {
  const p = findEpisode(id);
  if (!p) return;
  const url = `${location.origin}/podcast/${encodeURIComponent(p.id)}`;
  if (navigator.share) {
    navigator.share({ title: p.title, url }).catch(() => {});
    return;
  }
  copyText(url)
    .then(() => showToast("Link do episódio copiado!", "success"))
    .catch(() => prompt("Copie o link:", url));
}

/* ============================================================
   PLAYER GLOBAL (fica fora do #siteRoot, então não para ao navegar)
   ============================================================ */
const player = {
  audio: new Audio(),
  id: null,
  el: null,
  speeds: [1, 1.25, 1.5, 2],
  speedIndex: 0,
  seeking: false,
  lastSave: 0,
};
player.audio.preload = "metadata";

const posKey = (id) => `podcast-pos-${id}`;

function savePosition(force = false) {
  if (!player.id || player.audio.readyState < 1) return; // sem áudio carregado, não sobrescreve com 0
  const now = Date.now();
  if (!force && now - player.lastSave < 4000) return;
  player.lastSave = now;
  try {
    localStorage.setItem(posKey(player.id), String(Math.floor(player.audio.currentTime)));
  } catch {}
}

function readPosition(id) {
  try {
    return Number(localStorage.getItem(posKey(id))) || 0;
  } catch {
    return 0;
  }
}

function ensurePlayer() {
  if (player.el) return player.el;
  const el = document.createElement("div");
  el.className = "player";
  el.id = "podcastPlayer";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Player do podcast");
  el.innerHTML = `
    <div class="player-progress-top"><span></span></div>
    <div class="player-inner">
      <button class="player-cover" type="button" onclick="openPodcastModal(player.id)" aria-label="Abrir episódio"></button>
      <div class="player-meta">
        <span class="player-ep"></span>
        <strong class="player-title"></strong>
      </div>
      <div class="player-controls">
        <button class="player-btn" type="button" onclick="seekBy(-15)" aria-label="Voltar 15 segundos">${icon("back15", 20)}<i>15</i></button>
        <button class="player-btn player-main" type="button" onclick="togglePlayEpisode(player.id)" aria-label="Tocar">
          <span class="i-play">${icon("play", 20)}</span><span class="i-pause">${icon("pause", 18)}</span>
        </button>
        <button class="player-btn" type="button" onclick="seekBy(15)" aria-label="Avançar 15 segundos">${icon("fwd15", 20)}<i>15</i></button>
      </div>
      <div class="player-timeline">
        <span class="player-time t-cur">0:00</span>
        <input class="player-range" type="range" min="0" max="1000" value="0" step="1" aria-label="Posição do episódio">
        <span class="player-time t-dur">0:00</span>
      </div>
      <button class="player-speed" type="button" onclick="cycleSpeed()" aria-label="Velocidade de reprodução">1x</button>
      <button class="player-btn player-close" type="button" onclick="closePlayer()" aria-label="Fechar player">${icon("x", 18)}</button>
    </div>`;
  document.body.appendChild(el);
  player.el = el;

  const range = el.querySelector(".player-range");
  range.addEventListener("input", () => {
    player.seeking = true;
    const d = player.audio.duration || 0;
    paintProgress(range.value / 1000);
    el.querySelector(".t-cur").textContent = fmtTime((range.value / 1000) * d);
  });
  range.addEventListener("change", () => {
    const d = player.audio.duration || 0;
    if (d) player.audio.currentTime = (range.value / 1000) * d;
    player.seeking = false;
  });
  return el;
}

function paintProgress(ratio) {
  if (!player.el) return;
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  player.el.style.setProperty("--p", pct + "%");
  if (!player.seeking) player.el.querySelector(".player-range").value = Math.round(pct * 10);
}

function updatePlayerUI() {
  const playing = !!player.id && !player.audio.paused;
  if (player.el) {
    player.el.classList.toggle("is-playing", playing);
    player.el.querySelector(".player-main").setAttribute("aria-label", playing ? "Pausar" : "Tocar");
  }
  // Sincroniza todos os botões de play visíveis na página.
  document.querySelectorAll("[data-ep-play]").forEach((b) => {
    const on = playing && b.dataset.epPlay === player.id;
    b.classList.toggle("is-playing", on);
    if (b.classList.contains("btn")) {
      b.innerHTML = on ? `${icon("pause", 16)} Pausar` : `${icon("play", 16)} Ouvir agora`;
    }
  });
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
}

function loadEpisodeIntoPlayer(p) {
  const el = ensurePlayer();
  savePosition(true);
  player.id = String(p.id);
  player.audio.src = safeUrl(p.audio_url);
  player.audio.playbackRate = player.speeds[player.speedIndex];
  el.querySelector(".player-cover").setAttribute("style", coverStyle(p, 160));
  el.querySelector(".player-ep").textContent = epLabel(p);
  el.querySelector(".player-title").textContent = p.title;
  el.querySelector(".t-cur").textContent = "0:00";
  el.querySelector(".t-dur").textContent = "–:––";
  paintProgress(0);

  const resumeAt = readPosition(p.id);
  const epId = String(p.id);
  if (player.resumeHandler) player.audio.removeEventListener("loadedmetadata", player.resumeHandler);
  player.resumeHandler = () => {
    player.resumeHandler = null;
    if (player.id !== epId) return; // trocou de episódio antes de carregar
    if (resumeAt > 10 && resumeAt < player.audio.duration - 15) {
      player.audio.currentTime = resumeAt;
      showToast(`Continuando de ${fmtTime(resumeAt)}`);
    }
  };
  player.audio.addEventListener("loadedmetadata", player.resumeHandler, { once: true });

  if ("mediaSession" in navigator) {
    const art = imgThumb(p.cover_url, 640);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: p.title,
      artist: data.church.name,
      album: "Podcast",
      artwork: art ? [{ src: new URL(art, location.href).href, sizes: "640x640" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => player.audio.play());
    navigator.mediaSession.setActionHandler("pause", () => player.audio.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => seekBy(15));
  }

  requestAnimationFrame(() => {
    el.classList.add("open");
    document.body.classList.add("has-player");
  });
}

function togglePlayEpisode(id) {
  const p = findEpisode(id);
  if (!p || !safeUrl(p.audio_url)) return;
  if (player.id !== String(p.id)) loadEpisodeIntoPlayer(p);
  if (player.audio.paused) {
    player.audio.play().catch((e) => {
      console.error("Erro ao tocar áudio:", e);
      showToast("Não foi possível tocar este áudio.", "error");
    });
  } else {
    player.audio.pause();
  }
}

function seekBy(seconds) {
  const a = player.audio;
  if (!a.duration) return;
  a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + seconds));
}

function cycleSpeed() {
  player.speedIndex = (player.speedIndex + 1) % player.speeds.length;
  const s = player.speeds[player.speedIndex];
  player.audio.playbackRate = s;
  player.el.querySelector(".player-speed").textContent = String(s).replace(".", ",") + "x";
}

function closePlayer() {
  savePosition(true);
  player.audio.pause();
  player.el?.classList.remove("open");
  document.body.classList.remove("has-player");
  setTimeout(() => {
    if (player.el?.classList.contains("open")) return;
    player.audio.removeAttribute("src");
    player.audio.load();
    player.id = null;
    updatePlayerUI();
  }, 260);
}

player.audio.addEventListener("play", updatePlayerUI);
player.audio.addEventListener("pause", () => {
  savePosition(true);
  updatePlayerUI();
});
player.audio.addEventListener("ended", () => {
  try {
    localStorage.removeItem(posKey(player.id));
  } catch {}
  updatePlayerUI();
});
player.audio.addEventListener("loadedmetadata", () => {
  if (player.el) player.el.querySelector(".t-dur").textContent = fmtTime(player.audio.duration);
});
player.audio.addEventListener("timeupdate", () => {
  const a = player.audio;
  if (!player.el || !a.duration) return;
  if (!player.seeking) player.el.querySelector(".t-cur").textContent = fmtTime(a.currentTime);
  paintProgress(a.currentTime / a.duration);
  savePosition();
});
player.audio.addEventListener("error", () => {
  if (player.id) showToast("O áudio deste episódio não pôde ser carregado.", "error");
});
window.addEventListener("pagehide", () => savePosition(true));
