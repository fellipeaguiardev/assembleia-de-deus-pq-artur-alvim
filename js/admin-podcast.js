/* ============================================================
   PAINEL → PODCAST: importar episódios do Spotify (feed RSS)
   ------------------------------------------------------------
   O Spotify for Creators publica um feed RSS público (com CORS
   liberado) com título, descrição, data, capa e o arquivo de áudio
   de cada episódio. O painel lê o feed no navegador e grava pelas
   regras normais do banco (só admin com a entrada liberada grava).
   Episódios já cadastrados (mesmo áudio, ou mesmo título no mesmo
   dia) são pulados. Nada é apagado sem estar marcado.
   ============================================================ */
const podImport = { busy: false, feed: null, err: "", msg: "", remove: new Set() };
const ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";

// Texto da descrição: sem HTML e sem o bloco padrão de redes sociais.
function podcastCleanDescription(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  doc.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  doc.querySelectorAll("p, li, div").forEach((el) => el.append("\n"));
  const lines = (doc.body.textContent || "")
    .replace(/ /g, " ")
    .replace(/\s*Acompanhe também a Palavra de Deus[\s\S]*$/i, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => !/^(facebook|instagram|youtube)\s*-\s*https?:/i.test(l));
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

function podcastParseFeed(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const channel = doc.querySelector("channel");
  if (!channel || doc.querySelector("parsererror")) throw new Error("O endereço não é um feed de podcast (RSS).");
  const it = (el, name) => el.getElementsByTagNameNS(ITUNES_NS, name)[0];
  const showCover = it(channel, "image")?.getAttribute("href") || "";
  const episodes = [...channel.querySelectorAll(":scope > item")]
    .map((item) => {
      const text = (sel) => item.querySelector(sel)?.textContent.trim() || "";
      const date = new Date(text("pubDate"));
      return {
        guid: text("guid"),
        title: text("title").replace(/\s+/g, " ").slice(0, 300),
        description: podcastCleanDescription(text("description") || it(item, "summary")?.textContent),
        published_at: isNaN(date) ? null : date.toISOString(),
        audio_url: item.querySelector("enclosure")?.getAttribute("url") || "",
        cover_url: it(item, "image")?.getAttribute("href") || showCover,
        spotify_url: text("link"),
        trailer: it(item, "episodeType")?.textContent === "trailer",
      };
    })
    .filter((e) => e.title && /^https:\/\//.test(e.audio_url) && !e.trailer)
    .sort((a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0));
  episodes.forEach((e, i) => (e.episode_number = i + 1)); // numeração na ordem em que saíram
  return { title: channel.querySelector(":scope > title")?.textContent.trim() || "Podcast", episodes };
}

const podcastDayKey = (p) => `${normalizeText(p.title)}|${String(p.published_at || "").slice(0, 10)}`;

// O que o feed traz de novo e o que já existe no painel.
function podcastImportPlan() {
  const feed = podImport.feed;
  if (!feed) return null;
  const current = data.podcasts || [];
  const audios = new Set(current.map((p) => p.audio_url).filter(Boolean));
  const days = new Set(current.map(podcastDayKey));
  const fresh = feed.episodes.filter((e) => !audios.has(e.audio_url) && !days.has(podcastDayKey(e)));
  // Candidatos a apagar: episódios sem áudio próprio que não vieram do feed (ex.: o de teste).
  const extras = current.filter((p) => !safeUrl(p.audio_url));
  return { fresh, extras, already: feed.episodes.length - fresh.length };
}

function podcastImportCardHTML() {
  const f = data.podcastFeed || {};
  const plan = podcastImportPlan();
  return `
    <div class="admin-card" id="podImportCard">
      <h3>${icon("spotify", 16)} Importar do Spotify</h3>
      <p class="admin-note">Lê o feed público do podcast e cadastra os episódios que ainda não estão aqui, com título, descrição,
        data, capa e o áudio (que toca direto no site). Use de novo sempre que sair episódio novo.</p>
      <div class="field-row">
        ${field("Feed RSS do podcast", `<input id="podFeedUrl" type="url" value="${esc(f.rssUrl || "")}" placeholder="https://anchor.fm/s/…/podcast/rss">`, true)}
        ${field("Página do podcast no Spotify (botão “Seguir no Spotify”)", `<input id="podSpotifyUrl" type="url" value="${esc(f.spotifyUrl || "")}" placeholder="https://open.spotify.com/show/…">`, true)}
      </div>
      <p class="admin-muted">No Spotify for Creators: Configurações → Distribuição → Feed RSS.</p>
      ${podImport.err ? `<p class="admin-note admin-warn" role="alert">${esc(podImport.err)}</p>` : ""}
      ${plan ? podcastPlanHTML(plan) : ""}
      ${podImport.msg ? `<p class="admin-note admin-ok" role="status">${esc(podImport.msg)}</p>` : ""}
      <div class="podcast-form-actions">
        ${
          plan && (plan.fresh.length || [...podImport.remove].length)
            ? `<button class="btn btn-ghost" type="button" onclick="podcastCheckFeed()" ${podImport.busy ? "disabled" : ""}>Ler de novo</button>
               <button class="btn btn-primary ${podImport.busy ? "loading" : ""}" type="button" onclick="podcastRunImport()" ${podImport.busy ? "disabled" : ""}>
                 ${plan.fresh.length ? `Importar ${plan.fresh.length} ${plan.fresh.length === 1 ? "episódio" : "episódios"}` : "Aplicar"}</button>`
            : `<button class="btn btn-primary ${podImport.busy ? "loading" : ""}" type="button" onclick="podcastCheckFeed()" ${podImport.busy ? "disabled" : ""}>Buscar episódios</button>`
        }
      </div>
    </div>`;
}

function podcastPlanHTML(plan) {
  const feed = podImport.feed;
  const sample = plan.fresh.slice(-3).reverse();
  return `
    <div class="pod-plan">
      <p><strong>${esc(feed.title)}</strong>: ${feed.episodes.length} episódios no feed ·
        <strong>${plan.fresh.length} novos</strong>${plan.already ? ` · ${plan.already} já cadastrados` : ""}.</p>
      ${sample.length ? `<ul class="pod-plan-list">${sample.map((e) => `<li>${esc(e.title)} <small>${esc(e.published_at ? new Date(e.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "")}</small></li>`).join("")}${plan.fresh.length > 3 ? `<li class="admin-muted">… e mais ${plan.fresh.length - 3}</li>` : ""}</ul>` : ""}
      ${
        plan.extras.length
          ? `<div class="pod-plan-extras">
              <p>Episódios cadastrados aqui sem áudio, que não estão no feed. Marque os que devem ser <strong>apagados</strong>:</p>
              ${plan.extras
                .map(
                  (p) => `<label class="check-row"><input type="checkbox" data-id="${esc(p.id)}" ${podImport.remove.has(String(p.id)) ? "checked" : ""}
                    onchange="podcastToggleRemove(this.dataset.id, this.checked)"> ${esc(p.title)} <small class="admin-muted">EP. ${esc(p.episode_number || "—")}</small></label>`,
                )
                .join("")}
            </div>`
          : ""
      }
    </div>`;
}

function podcastToggleRemove(id, on) {
  if (on) podImport.remove.add(String(id));
  else podImport.remove.delete(String(id));
}

function podcastRefreshImportCard() {
  const card = document.getElementById("podImportCard");
  if (card) card.outerHTML = podcastImportCardHTML();
}

// Guarda os dois links nas configurações do site (se mudaram).
function podcastSaveFeedLinks() {
  const rssUrl = document.getElementById("podFeedUrl")?.value.trim() || "";
  const spotifyUrl = document.getElementById("podSpotifyUrl")?.value.trim() || "";
  const cur = data.podcastFeed || {};
  if (rssUrl !== cur.rssUrl || spotifyUrl !== cur.spotifyUrl) {
    data.podcastFeed = { ...cur, rssUrl, spotifyUrl };
    persist();
  }
  return rssUrl;
}

async function podcastCheckFeed() {
  const url = podcastSaveFeedLinks();
  podImport.err = podImport.msg = "";
  if (!/^https:\/\/[^/]+\/.+/.test(url)) {
    podImport.err = "Cole o endereço do feed RSS (começa com https://).";
    return podcastRefreshImportCard();
  }
  podImport.busy = true;
  podcastRefreshImportCard();
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`O feed respondeu com erro ${res.status}.`);
    podImport.feed = podcastParseFeed(await res.text());
    if (!podImport.feed.episodes.length) throw new Error("O feed não tem episódios com áudio.");
    // O pedido foi trocar o episódio de teste pelo podcast de verdade: "teste" já vem marcado.
    podImport.remove = new Set(podcastImportPlan().extras.filter((p) => /\bteste\b/i.test(p.title)).map((p) => String(p.id)));
  } catch (e) {
    console.error("Feed do podcast:", e);
    podImport.feed = null;
    podImport.err = e instanceof TypeError ? "Não foi possível ler o feed (endereço errado ou sem internet)." : e.message;
  }
  podImport.busy = false;
  podcastRefreshImportCard();
}

async function podcastRunImport() {
  const plan = podcastImportPlan();
  if (!plan || podImport.busy) return;
  const removeIds = plan.extras.map((p) => String(p.id)).filter((id) => podImport.remove.has(id));
  if (removeIds.length && !confirm(`Apagar ${removeIds.length === 1 ? "o episódio marcado" : `os ${removeIds.length} episódios marcados`} e importar ${plan.fresh.length} do Spotify?`)) return;
  podImport.busy = true;
  podImport.err = "";
  podImport.msg = "Gravando…";
  podcastRefreshImportCard();
  let added = 0;
  let removed = 0;
  try {
    // Primeiro apaga os marcados (o de teste costuma ser o EP. 1, número que o feed também usa).
    if (removeIds.length) {
      const ok = await dbWrite(db("podcasts").delete().in("id", removeIds), null, "Não foi possível apagar os episódios marcados.");
      if (!ok) throw new Error("stop");
      removed = removeIds.length;
      if (removeIds.includes(String(player.id))) closePlayer();
    }
    const rows = plan.fresh.map(({ guid, trailer, ...e }) => ({ ...e, youtube_url: "", status: "Publicado" }));
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      podImport.msg = `Gravando ${Math.min(i + batch.length, rows.length)} de ${rows.length}…`;
      podcastRefreshImportCard();
      const ok = await dbWrite(db("podcasts").insert(batch), null, "Não foi possível gravar os episódios.");
      if (!ok) throw new Error("stop");
      added += batch.length;
    }
  } catch (e) {
    if (e.message !== "stop") console.error("Importação do podcast:", e);
  }
  await loadAdminOnlyData();
  podImport.busy = false;
  podImport.remove = new Set();
  const done = [added && `${added} ${added === 1 ? "episódio importado" : "episódios importados"}`, removed && `${removed} apagado${removed === 1 ? "" : "s"}`].filter(Boolean).join(" e ");
  podImport.msg = done ? `Pronto: ${done}.` : "";
  if (added < plan.fresh.length) podImport.err = `Parou em ${added} de ${plan.fresh.length}. Toque em “Importar” de novo para continuar de onde parou.`;
  if (done) showToast(podImport.msg, "success");
  renderAdmin();
  renderSite();
}
