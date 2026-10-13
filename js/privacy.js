/* ============================================================
   PRIVACIDADE (LGPD) — consentimento de cookies, bloqueio de
   conteúdo de terceiros e página de Política de Privacidade
   ------------------------------------------------------------
   O site em si não usa cookies de rastreamento nem analytics.
   Quem pode usar cookies são os conteúdos incorporados de
   terceiros (YouTube, Spotify e Google Maps). Por isso eles só
   carregam depois que a pessoa permite.
   ============================================================ */
const CONSENT_KEY = "cookie-consent-v1";
const PRIVACY_UPDATED = "2026-10-11";

let consent = readConsent();

function readConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    return c && typeof c.embeds === "boolean" ? c : null;
  } catch {
    return null;
  }
}

const hasEmbedConsent = () => consent?.embeds === true;

function saveConsent(embeds) {
  consent = { v: 1, embeds: !!embeds, date: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {}
  hideCookieBanner();
  if (consent.embeds) document.querySelectorAll(".embed-gate").forEach(loadEmbedGate);
  else unloadThirdPartyIframes();
  showToast(embeds ? "Preferências salvas: conteúdos externos liberados." : "Preferências salvas: só o essencial.", "success");
}

/* ---------- Conteúdo de terceiros com bloqueio ---------- */
const EMBED_PROVIDERS = {
  youtube: { name: "YouTube", origins: ["https://www.youtube-nocookie.com/", "https://www.youtube.com/"] },
  spotify: { name: "Spotify", origins: ["https://open.spotify.com/"] },
  maps: { name: "Google Maps", origins: ["https://maps.google.com/", "https://www.google.com/maps"] },
};

function iframeHTML(src, title, allow = "") {
  return `<iframe src="${esc(src)}" title="${esc(title)}" ${allow ? `allow="${esc(allow)}"` : ""} allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

// Retorna o iframe se já houver consentimento; senão, um aviso com botão para carregar.
function embedGate(kind, src, title, { allow = "", openUrl = "", compact = false } = {}) {
  const p = EMBED_PROVIDERS[kind];
  if (!p || !p.origins.some((o) => String(src).startsWith(o))) return "";
  if (hasEmbedConsent()) return iframeHTML(src, title, allow);
  return `
    <div class="embed-gate ${compact ? "compact" : ""}" data-kind="${kind}" data-src="${esc(src)}" data-title="${esc(title)}" data-allow="${esc(allow)}">
      <div class="embed-gate-inner">
        <span class="embed-gate-icon">${icon(kind === "maps" ? "pin" : kind, 22)}</span>
        <p>Este conteúdo é do <strong>${p.name}</strong>, que pode usar cookies próprios.</p>
        <div class="embed-gate-actions">
          <button type="button" class="btn btn-primary btn-sm" onclick="loadEmbedGate(this.closest('.embed-gate'))">Carregar ${p.name}</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="saveConsent(true)">Sempre permitir</button>
        </div>
        ${openUrl ? `<a class="link-btn" href="${href(openUrl)}" target="_blank" rel="noopener">Abrir no ${p.name} ${icon("external", 13)}</a>` : ""}
      </div>
    </div>`;
}

// Ao revogar a permissão, troca os iframes já abertos pelo aviso de bloqueio.
function unloadThirdPartyIframes() {
  document.querySelectorAll("iframe").forEach((f) => {
    const kind = Object.keys(EMBED_PROVIDERS).find((k) => EMBED_PROVIDERS[k].origins.some((o) => f.src.startsWith(o)));
    if (kind) f.outerHTML = embedGate(kind, f.src, f.title, { allow: f.getAttribute("allow") || "" });
  });
}

function loadEmbedGate(el) {
  if (!el) return;
  const p = EMBED_PROVIDERS[el.dataset.kind];
  const src = el.dataset.src || "";
  if (!p || !p.origins.some((o) => src.startsWith(o))) return;
  el.outerHTML = iframeHTML(src, el.dataset.title, el.dataset.allow);
}

/* ---------- Aviso de cookies ---------- */
function renderCookieBanner() {
  if (consent || document.getElementById("cookieBanner")) return;
  const el = document.createElement("div");
  el.id = "cookieBanner";
  el.className = "cookie-banner";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Aviso de cookies");
  el.innerHTML = `
    <div class="cookie-text">
      <strong>Sua privacidade importa</strong>
      <p>Usamos apenas armazenamento essencial para o site funcionar. Vídeos do YouTube, o player do Spotify e o mapa do Google
      podem usar cookies próprios, e só carregam com a sua permissão. <a href="/privacidade">Saiba mais</a>.</p>
    </div>
    <div class="cookie-actions">
      <button type="button" class="btn btn-ghost btn-sm" onclick="openCookiePreferences()">Personalizar</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="saveConsent(false)">Só essenciais</button>
      <button type="button" class="btn btn-primary btn-sm" onclick="saveConsent(true)">Aceitar todos</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
}

function hideCookieBanner() {
  const el = document.getElementById("cookieBanner");
  if (!el) return;
  el.classList.remove("show");
  setTimeout(() => el.remove(), 260);
}

function openCookiePreferences() {
  openModal(
    `
    <div class="modal-pad cookie-prefs">
      <span class="eyebrow">Privacidade</span>
      <h3>Preferências de cookies</h3>
      <p>Escolha o que pode ser carregado neste navegador. Você pode mudar quando quiser pelo link no rodapé.</p>
      <div class="pref-row">
        <div><strong>Essenciais</strong><span>Lembram suas escolhas, as cores do site e onde você parou no podcast. Ficam só no seu aparelho.</span></div>
        <label class="pref-switch is-locked"><input type="checkbox" checked disabled><span></span><em class="sr-only">Sempre ativo</em></label>
      </div>
      <div class="pref-row">
        <div><strong>Conteúdo de terceiros</strong><span>Vídeos do YouTube, player do Spotify e mapa do Google Maps. Esses serviços podem usar cookies próprios.</span></div>
        <label class="pref-switch"><input type="checkbox" id="prefEmbeds" ${hasEmbedConsent() ? "checked" : ""}><span></span><em class="sr-only">Permitir conteúdo de terceiros</em></label>
      </div>
      <div class="modal-actions">
        <a class="btn btn-ghost btn-sm" href="/privacidade">Política de privacidade</a>
        <button type="button" class="btn btn-primary btn-sm" onclick="saveConsent(document.getElementById('prefEmbeds').checked); closeModal()">Salvar preferências</button>
      </div>
    </div>`,
    { label: "Preferências de cookies" },
  );
}

/* ---------- Página: Política de Privacidade ---------- */
function privacyContactHTML() {
  const c = data.church;
  const parts = [];
  if (c.privacyEmail) parts.push(`e-mail <a href="mailto:${esc(c.privacyEmail)}">${esc(c.privacyEmail)}</a>`);
  if (c.whatsapp) parts.push(`<a href="${href(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (c.phone) parts.push(`telefone ${esc(c.phone)}`);
  return parts.length ? parts.join(", ") : "os canais de contato informados no rodapé do site";
}

function privacyPageHTML() {
  const c = data.church;
  const updated = fmtDateLong(PRIVACY_UPDATED);
  return (
    pageHeroHTML("Transparência", "Política de Privacidade", "Como tratamos seus dados, em linguagem simples e de acordo com a LGPD (Lei 13.709/2018).") +
    `
  <section class="block">
    <div class="container legal" data-reveal>
      <p class="legal-updated">Atualizada em ${updated}</p>

      <h2>1. Quem somos</h2>
      <p>Este site pertence à <strong>${esc(c.name)}</strong>, com endereço em ${esc(c.address)}, que é a controladora dos dados
      tratados aqui. Para qualquer assunto sobre privacidade, fale conosco por ${privacyContactHTML()}.</p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><strong>Navegação:</strong> o site não usa cookies de rastreamento, publicidade ou estatísticas. A empresa de hospedagem
        (Vercel) registra dados técnicos de acesso, como endereço IP e navegador, por segurança e para manter o site no ar.</li>
        <li><strong>Formulário de pedido de oração e contato:</strong> nome, forma de contato e mensagem, apenas se você escolher enviar.
        Um pedido de oração pode revelar informações sobre a sua fé, que a LGPD considera <em>dado sensível</em>. Por isso só tratamos
        esses dados com o seu consentimento específico, marcado no próprio formulário.</li>
        <li><strong>Biblioteca dos Jovens:</strong> nome e WhatsApp, apenas se você pedir um livro pelo site, para a equipe combinar o
        empréstimo. Quem pega livros fica registrado (nome, WhatsApp, datas de retirada e devolução) para controlar devoluções,
        renovações e a fila de espera. Esses dados ficam visíveis só para a equipe; no site aparece apenas se o livro está disponível.</li>
        <li><strong>Painel administrativo:</strong> e-mail e sessão de login de quem administra o site.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Responder ao seu contato e orar pelo seu pedido;</li>
        <li>Controlar os empréstimos da Biblioteca dos Jovens (devoluções, renovações e fila de espera);</li>
        <li>Manter o site seguro e funcionando;</li>
        <li>Divulgar cultos, eventos, vídeos, notícias e o podcast da igreja.</li>
      </ul>
      <p>Não vendemos, não alugamos e não usamos seus dados para publicidade.</p>

      <h2>4. Cookies e armazenamento no seu aparelho</h2>
      <div class="legal-table" role="table" aria-label="Itens armazenados">
        <div role="row" class="lt-head"><span role="columnheader">Item</span><span role="columnheader">Para que serve</span><span role="columnheader">Tipo</span></div>
        <div role="row"><span role="cell">cookie-consent-v1</span><span role="cell">Guarda as suas escolhas sobre cookies</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">site-theme</span><span role="cell">Mostra as cores da igreja já na abertura do site</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">site-data-cache</span><span role="cell">Cópia das informações públicas (cultos, eventos) para o site abrir sem internet</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">podcast-pos-*</span><span role="cell">Lembra onde você parou em cada episódio</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">bible-prefs, bible-last</span><span role="cell">Tamanho da letra, tema escuro e o último capítulo lido na Bíblia</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">listen-prefs, listen-pos</span><span role="cell">Velocidade, voz e onde você parou no modo ouvir (o texto é lido pela voz do próprio aparelho, nada é enviado)</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">ebd-cache-v1, ebd-daily</span><span role="cell">Cópia das lições da EBD já abertas, para ler sem internet, e as leituras diárias que você marcou</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">biblioteca-pedidos, biblioteca-contato</span><span role="cell">Lembra quais livros você pediu neste aparelho e o nome e WhatsApp que você digitou, para não precisar digitar de novo</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">intro-curta</span><span role="cell">Quando o site recarrega sozinho para atualizar, mostra a abertura curta em vez da vinheta (apagado logo em seguida)</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">prayer-last-sent</span><span role="cell">Evita envios repetidos do formulário (guarda só o horário do último envio, até fechar a aba)</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">sb-*-auth-token</span><span role="cell">Sessão do painel, só para administradores</span><span role="cell">Essencial</span></div>
        <div role="row"><span role="cell">YouTube, Spotify, Google Maps</span><span role="cell">Exibir vídeos, o player do podcast e o mapa. Só carregam com a sua permissão</span><span role="cell">Terceiros</span></div>
      </div>
      <p>Os itens essenciais ficam apenas no seu navegador e não identificam você. Você pode mudar sua escolha sobre conteúdos de
      terceiros a qualquer momento: <button type="button" class="link-btn" onclick="openCookiePreferences()">abrir preferências de cookies</button>.</p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Usamos serviços de terceiros para o site funcionar: <strong>Supabase</strong> (banco de dados e arquivos, servidores em São Paulo),
      <strong>Vercel</strong> (hospedagem do site e envio do formulário), <strong>Resend</strong> (entrega do e-mail do formulário à equipe)
      e, quando você permite, <strong>YouTube/Google</strong> e <strong>Spotify</strong>.
      As miniaturas (imagens) dos vídeos vêm dos servidores do YouTube, que recebem o endereço IP e o navegador de quem abre a página, sem cookies.
      As fontes de texto ficam no próprio site.
      Alguns desses serviços podem processar dados fora do Brasil, com as garantias previstas no art. 33 da LGPD.</p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>Mensagens do formulário não ficam guardadas no site: são enviadas na hora por e-mail para a equipe da igreja, que as
      guarda só pelo tempo necessário para o atendimento (no máximo 12 meses).
      Pedidos de livros concluídos ou cancelados são apagados depois de 6 meses; o histórico de empréstimos da biblioteca fica guardado
      enquanto for útil para controlar o acervo e pode ser apagado a seu pedido.
      Dados de acesso técnicos seguem os prazos da hospedagem.</p>

      <h2>7. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização ou exclusão,
      portabilidade, informações sobre compartilhamento e a revogação do consentimento. Basta falar conosco por ${privacyContactHTML()}.
      Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>8. Segurança</h2>
      <p>O site usa conexão criptografada (HTTPS), regras de acesso no banco de dados que só permitem alterações pela equipe
      autorizada e políticas de segurança que bloqueiam scripts e conexões não autorizadas.</p>

      <h2>9. Crianças e adolescentes</h2>
      <p>O formulário não deve ser usado por menores de 12 anos sem o acompanhamento de um responsável.</p>

      <h2>10. Mudanças nesta política</h2>
      <p>Podemos atualizar esta política. A data da última atualização fica sempre no topo desta página.</p>
    </div>
  </section>`
  );
}
