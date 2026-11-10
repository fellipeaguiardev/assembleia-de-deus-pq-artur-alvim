/* ============================================================
   ACESSIBILIDADE — painel aberto pelo botão do topo (bonequinho)
   e pelo link "Acessibilidade" do rodapé.
   ------------------------------------------------------------
   Opções (ficam só neste aparelho, em localStorage "acessibilidade"):
     texto      tamanho da letra: 0 normal, 1 grande, 2 maior, 3 muito grande
                (vira a variável --fs do <html>; ver css/base.css)
     contraste  alto contraste (classe a11y-contraste no <html>)
     movimento  parar animações (classe a11y-sem-animacao)
     libras     tradutor de Libras do Governo Federal (VLibras)
     legendas   liga as legendas nos vídeos do YouTube
   O <head> do index.html aplica texto/contraste/movimento antes da primeira
   pintura (a página não "pula"). Se mudar A11Y_TEXTO, mude lá também.

   VLibras (vlibras.gov.br): só é baixado quando a pessoa liga a opção. A
   partir daí o botão azul da mãozinha fica no canto direito em todas as
   páginas; tocando num texto, o boneco traduz para Libras. Enquanto a janela
   dele está aberta, ELE segura os toques (tocar num link traduz em vez de
   abrir) — é assim em todo site que usa o VLibras; fecha-se no X. Por isso o
   painel se fecha antes de abrir o intérprete, e desligar a opção fecha a
   janela (data-active="false") antes de esconder. Os endereços dele estão
   liberados no Content-Security-Policy do vercel.json.
   ============================================================ */
const A11Y_KEY = "acessibilidade";
const A11Y_TEXTO = [1, 1.15, 1.3, 1.5];
const A11Y_TEXTO_NOMES = ["Normal", "Grande", "Maior", "Muito grande"];
const A11Y_PADRAO = { texto: 0, contraste: false, movimento: false, libras: false, legendas: false };
const VLIBRAS_URL = "https://vlibras.gov.br/app";

function a11yPrefs() {
  try {
    return { ...A11Y_PADRAO, ...JSON.parse(localStorage.getItem(A11Y_KEY) || "{}") };
  } catch {
    return { ...A11Y_PADRAO };
  }
}

function a11ySalvar(p) {
  try {
    const mudou = Object.keys(A11Y_PADRAO).some((k) => p[k] !== A11Y_PADRAO[k]);
    if (mudou) localStorage.setItem(A11Y_KEY, JSON.stringify(p));
    else localStorage.removeItem(A11Y_KEY);
  } catch {}
}

function a11yAplicar(p = a11yPrefs()) {
  const h = document.documentElement;
  const fs = A11Y_TEXTO[p.texto] || 1;
  if (fs === 1) h.style.removeProperty("--fs");
  else h.style.setProperty("--fs", String(fs));
  h.classList.toggle("a11y-contraste", !!p.contraste);
  h.classList.toggle("a11y-sem-animacao", !!p.movimento);
}

// Parâmetros extras para os vídeos do YouTube (legendas em português).
function ytLegendas() {
  return a11yPrefs().legendas ? "&cc_load_policy=1&cc_lang_pref=pt&hl=pt-BR" : "";
}

function a11yMudar(campo, valor) {
  const p = { ...a11yPrefs(), [campo]: valor };
  a11ySalvar(p);
  a11yAplicar(p);
  if (campo === "libras") (valor ? vlibrasLigar({ abrir: true }) : vlibrasDesligar());
  const avisos = {
    texto: `Tamanho da letra: ${A11Y_TEXTO_NOMES[valor] || "Normal"}.`,
    contraste: valor ? "Alto contraste ligado." : "Alto contraste desligado.",
    movimento: valor ? "Animações paradas." : "Animações ligadas.",
    libras: valor ? "Tradutor de Libras ligado. Toque num texto para ver a tradução." : "Tradutor de Libras desligado.",
    legendas: valor ? "Legendas ligadas nos vídeos." : "Legendas desligadas nos vídeos.",
  };
  announce(avisos[campo] || "Preferência salva.");
}

function a11yRestaurar() {
  const tinhaLibras = a11yPrefs().libras;
  a11ySalvar({ ...A11Y_PADRAO });
  a11yAplicar({ ...A11Y_PADRAO });
  if (tinhaLibras) vlibrasDesligar();
  openA11yPanel(); // redesenha o painel com tudo desligado
  announce("Acessibilidade voltou ao padrão.");
}

function a11ySwitch(campo, titulo, texto, ligado) {
  const id = `a11y-${campo}`;
  return `
      <div class="pref-row">
        <div><strong id="${id}-t">${titulo}</strong><span id="${id}-d">${texto}</span></div>
        <label class="pref-switch"><input type="checkbox" id="${id}" ${ligado ? "checked" : ""} aria-labelledby="${id}-t" aria-describedby="${id}-d"
          onchange="a11yMudar('${campo}', this.checked)"><span></span></label>
      </div>`;
}

function openA11yPanel() {
  const p = a11yPrefs();
  const temOuvir = typeof LISTEN_OK !== "undefined" && LISTEN_OK;
  openModal(
    `
    <div class="modal-pad a11y-panel">
      <span class="eyebrow">Acessibilidade</span>
      <h2 class="a11y-title">Deixe o site do seu jeito</h2>
      <p>As escolhas ficam guardadas neste aparelho e valem para todas as páginas.</p>

      <fieldset class="a11y-sizes">
        <legend>Tamanho da letra</legend>
        <div class="a11y-size-row">
          ${A11Y_TEXTO.map(
            (f, i) => `
          <label class="a11y-size">
            <input type="radio" name="a11yTexto" value="${i}" ${p.texto === i ? "checked" : ""} onchange="a11yMudar('texto', ${i})">
            <span class="a11y-size-a" aria-hidden="true" style="font-size:${Math.round(20 * f)}px">A</span>
            <span class="a11y-size-nome">${A11Y_TEXTO_NOMES[i]}</span>
          </label>`,
          ).join("")}
        </div>
      </fieldset>

      ${a11ySwitch("contraste", "Alto contraste", "Letras mais escuras, bordas mais fortes e links sublinhados.", p.contraste)}
      ${a11ySwitch("movimento", "Parar animações", "Tira os movimentos e efeitos da tela.", p.movimento)}
      ${a11ySwitch("libras", "Tradutor de Libras", "Mostra o botão azul do VLibras (Governo Federal) no canto da tela. Com a janela dele aberta, toque num texto e o intérprete traduz; para voltar a navegar, feche a janela no X.", p.libras)}
      ${a11ySwitch("legendas", "Legendas nos vídeos", "Os vídeos do YouTube já abrem com legenda em português (quando o vídeo tiver).", p.legendas)}

      <ul class="a11y-dicas">
        ${temOuvir ? `<li>${icon("headphones", 16)}<span><strong>Ouvir em voz alta:</strong> na Bíblia, na Palavra Diária, nas lições da EBD e nas notícias, toque em “Ouvir” e o próprio celular lê o texto.</span></li>` : ""}
        <li>${icon("check", 16)}<span><strong>Leitor de tela:</strong> o site funciona com o TalkBack (Android) e o VoiceOver (iPhone).</span></li>
      </ul>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick="a11yRestaurar()">Voltar ao padrão</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="closeModal()">Pronto</button>
      </div>
    </div>`,
    { label: "Acessibilidade", className: "a11y-modal" },
  );
}

/* ---------- VLibras ---------- */
let vlibrasPedido = false;

function vlibrasLigar({ abrir = false } = {}) {
  const abrirQuandoPronto = (tentativas = 40) => {
    const w = window.VLibrasWidget;
    if (w?.open) {
      vlibrasMostrar(true);
      if (!abrir) return;
      closeModal({ instant: true }); // com o VLibras aberto, o painel não receberia mais os toques
      w.open();
      showToast("Toque num texto para ver em Libras. Para voltar a navegar, feche a janela do VLibras no X.");
    } else if (tentativas > 0) setTimeout(() => abrirQuandoPronto(tentativas - 1), 100);
  };
  if (vlibrasPedido) return abrirQuandoPronto();
  vlibrasPedido = true;
  const s = document.createElement("script");
  s.src = `${VLIBRAS_URL}/vlibras-plugin.js`;
  s.async = true;
  s.onload = () => {
    try {
      new window.VLibras.Widget({ rootPath: VLIBRAS_URL });
    } catch {}
    abrirQuandoPronto();
  };
  s.onerror = () => {
    vlibrasPedido = false;
    s.remove();
    showToast("Não foi possível carregar o tradutor de Libras agora. Tente de novo mais tarde.", "error");
  };
  document.body.appendChild(s);
}

// Esconde/mostra o botão e a janela do VLibras sem recarregar a página.
function vlibrasMostrar(sim) {
  ["vlibras-access-wrapper", "vlibras-app-root"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = sim ? "" : "none";
  });
}

function vlibrasDesligar() {
  const janela = document.getElementById("vlibras-app-root");
  if (janela) janela.dataset.active = "false"; // fecha a janela e devolve os toques ao site
  vlibrasMostrar(false);
  try {
    localStorage.removeItem("@vlibras-widget"); // senão ele reabre sozinho na próxima visita
  } catch {}
}

// Com a janela do VLibras aberta, ele segura os toques do site (num ouvinte de
// captura no <body>). O botão de acessibilidade do topo continua sendo a saída:
// este ouvinte, no window, roda antes do dele, fecha a janela e abre o painel.
// (No Safari os ícones da janela do VLibras às vezes não aparecem, nem o X.)
window.addEventListener(
  "click",
  (e) => {
    const janela = document.getElementById("vlibras-app-root");
    if (janela?.dataset.active !== "true" || !e.target.closest?.(".a11y-btn")) return;
    e.stopPropagation();
    e.preventDefault();
    janela.dataset.active = "false";
    openA11yPanel();
  },
  true,
);

// Quem já ligou o VLibras: carrega de novo a cada visita, sem abrir a janela.
if (a11yPrefs().libras) {
  const carregar = () => vlibrasLigar();
  if ("requestIdleCallback" in window) requestIdleCallback(carregar, { timeout: 4000 });
  else setTimeout(carregar, 1500);
}
