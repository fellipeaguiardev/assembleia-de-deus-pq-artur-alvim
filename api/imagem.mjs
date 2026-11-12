// ============================================================
// GET /api/imagem — imagem do versículo (JPEG), gerada na hora
// ------------------------------------------------------------
//   ?palavra=AAAA-MM-DD          a Palavra Diária daquele dia
//   ?biblia=<livro>/<cap>/<vers> um ou mais versículos (ex.: joao/3/16-17)
//   &formato=story               1080×1920 (status e stories); sem ele,
//                                1200×630 (prévia do WhatsApp/Facebook)
// É a og:image das páginas /palavra e /biblia/…/<versículos> (veja
// api/_lib/paginas.mjs) e o arquivo do botão "Imagem" do site.
// O texto é da Bíblia Livre (data/bible/blivre), com o crédito na imagem.
// O fundo é um degradê de uma de 8 paletas, escolhida pelo próprio
// versículo: o mesmo versículo sai sempre igual, e cada dia muda.
// Fica em cache por muito tempo (o conteúdo de uma data ou referência não
// muda); se o desenho mudar, suba IMAGEM_VERSAO em api/_lib/paginas.mjs.
//
// POST /api/imagem — ARTE DO EVENTO (só admin liberado, botão "Gerar arte"
// do painel). Corpo: { nome, data (AAAA-MM-DD), hora (HH:MM), local,
// categoria }. Devolve um JPEG 1200×750 (16:10, o formato dos cartões de
// evento do site) com o brasão, o nome do evento e data, hora e local. O
// painel envia a imagem para o armazenamento e põe no evento. O texto é
// escrito pelo site (não por IA): sai sempre certo, com acentos.
// ============================================================
import { readFile } from "node:fs/promises";
import satori from "satori"; // monta a imagem (SVG) a partir dos elementos
import { Resvg } from "@resvg/resvg-js"; // SVG → pixels
import jpeg from "jpeg-js"; // pixels → JPEG (bem mais leve que PNG: o WhatsApp não mostra prévia pesada)
import { versiculoDaBiblia, versiculoDaPalavra } from "./_lib/paginas.mjs";
import { rpc } from "./_lib/fonte.mjs";
import { origemDeFora } from "./_lib/site.mjs";

const PALETAS = [
  { fundo: ["#0b2a74", "#123f9e", "#081633"], destaque: "#ffd27a" }, // azul da igreja
  { fundo: ["#f0924a", "#b8205e", "#3a0b52"], destaque: "#ffe3a3" }, // amanhecer
  { fundo: ["#0e4a3a", "#12735a", "#05231b"], destaque: "#c8f2d8" }, // esmeralda
  { fundo: ["#0f2730", "#1f4a5c", "#0a1a22"], destaque: "#9fe3f5" }, // mar
  { fundo: ["#2c0b4d", "#5b3a9e", "#1a0631"], destaque: "#e7d1ff" }, // púrpura
  { fundo: ["#e9775a", "#9c3a7d", "#2b1b3f"], destaque: "#ffe0c2" }, // pôr do sol
  { fundo: ["#3b2418", "#7d5236", "#1c110b"], destaque: "#ffd9a8" }, // terra
  { fundo: ["#121c33", "#26406b", "#0a1120"], destaque: "#ffd27a" }, // céu da noite
];

const FORMATOS = {
  og: { w: 1200, h: 630, pad: "54px 72px 46px", rotulo: 21, ref: 30, rodape: 21, brasao: 52, aspas: 300, letra: [[80, 64], [140, 54], [210, 46], [300, 40], [400, 34]], menor: 30, max: 520 },
  story: { w: 1080, h: 1920, pad: "120px 96px 110px", rotulo: 30, ref: 44, rodape: 30, brasao: 92, aspas: 640, letra: [[80, 96], [140, 82], [210, 72], [300, 62], [420, 54], [600, 46]], menor: 42, max: 900 },
};

const lerArquivo = (rel) => readFile(new URL(rel, import.meta.url));
let fontes = null;
const carregarFontes = () =>
  (fontes ||= Promise.all([lerArquivo("./_fontes/Fraunces-500.ttf"), lerArquivo("./_fontes/Inter-600.ttf"), lerArquivo("./_fontes/Inter-800.ttf")]).then(([f, i6, i8]) => [
    { name: "Fraunces", data: f, weight: 500, style: "normal" },
    { name: "Inter", data: i6, weight: 600, style: "normal" },
    { name: "Inter", data: i8, weight: 800, style: "normal" },
  ]));
let brasao = null;
const carregarBrasao = () => (brasao ||= lerArquivo("../assets/img/brasao.svg").then((b) => `data:image/svg+xml;base64,${b.toString("base64")}`));

// Elemento no formato que o gerador entende (sem React): { type, props }
const h = (type, style, ...filhos) => ({ type, props: { style, children: filhos.length === 1 ? filhos[0] : filhos } });

function paletaPara(chave) {
  let n = 0;
  for (const c of chave) n = (n * 31 + c.codePointAt(0)) >>> 0;
  return PALETAS[n % PALETAS.length];
}

function tamanhoDaLetra(f, texto) {
  for (const [ate, px] of f.letra) if (texto.length <= ate) return px;
  return f.menor;
}

function desenho({ texto, referencia, rotulo }, formato) {
  const f = FORMATOS[formato];
  const p = paletaPara(referencia);
  const corpo = texto.length > f.max ? texto.slice(0, f.max).replace(/\s+\S*$/, "") + "…" : texto;
  const story = formato === "story";
  return h(
    "div",
    { width: "100%", height: "100%", display: "flex", position: "relative", color: "#fff", fontFamily: "Inter", backgroundImage: `linear-gradient(140deg, ${p.fundo[0]} 0%, ${p.fundo[1]} 52%, ${p.fundo[2]} 100%)` },
    // luz no canto e sombra embaixo (garantem contraste do texto branco em qualquer paleta)
    h("div", { position: "absolute", top: -f.h * 0.35, right: -f.w * 0.15, width: f.w * 0.75, height: f.w * 0.75, borderRadius: "50%", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 66%)" }),
    h("div", { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.42) 100%)" }),
    h("div", { position: "absolute", top: story ? 330 : 92, left: story ? 44 : 30, fontFamily: "Fraunces", fontSize: f.aspas, lineHeight: 1, opacity: 0.1 }, "“"),
    h(
      "div",
      { position: "relative", display: "flex", flexDirection: "column", flexGrow: 1, padding: f.pad }, // ocupa a imagem toda (com o espaçamento por dentro)
      h("div", { display: "flex", fontSize: f.rotulo, fontWeight: 800, letterSpacing: story ? 6 : 4, opacity: 0.92 }, rotulo.toUpperCase()),
      h(
        "div",
        { display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 },
        h("div", { display: "flex", fontFamily: "Fraunces", fontSize: tamanhoDaLetra(f, corpo), lineHeight: 1.22, textShadow: "0 2px 18px rgba(0,0,0,0.25)" }, corpo),
        h("div", { display: "flex", marginTop: story ? 44 : 22, fontSize: f.ref, fontWeight: 800, color: p.destaque }, referencia),
      ),
      h(
        "div",
        { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: story ? 40 : 18 },
        h(
          "div",
          { display: "flex", alignItems: "center" },
          h("img", { width: f.brasao, height: f.brasao, marginRight: story ? 22 : 16 }),
          h("div", { display: "flex", fontSize: f.rodape, fontWeight: 600 }, "AD Belém · Parque Artur Alvim"),
        ),
        h("div", { display: "flex", fontSize: Math.round(f.rodape * 0.82), fontWeight: 600, opacity: 0.75 }, "Bíblia Livre"),
      ),
    ),
  );
}

// o <img> precisa de src e tamanho como atributos (não só no estilo)
function comLogo(el, logo) {
  if (el?.type === "img") return { ...el, props: { ...el.props, src: logo, width: el.props.style.width, height: el.props.style.height } };
  const filhos = el?.props?.children;
  if (!filhos || typeof filhos === "string") return el;
  return { ...el, props: { ...el.props, children: Array.isArray(filhos) ? filhos.map((c) => comLogo(c, logo)) : comLogo(filhos, logo) } };
}

const hojeEmSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const diaPorExtenso = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });
const naoAchei = () => new Response("Versículo não encontrado.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const formato = q.get("formato") === "story" ? "story" : "og";
  let v = null;
  let nome = "versiculo";
  if (q.has("palavra")) {
    const iso = q.get("palavra");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > hojeEmSP()) return naoAchei(); // dia futuro: ainda não tem Palavra
    v = await versiculoDaPalavra(iso);
    if (v) v.rotulo = `Palavra Diária · ${diaPorExtenso(iso)}`;
    nome = `palavra-${iso}`;
  } else if (q.has("biblia")) {
    const m = String(q.get("biblia")).match(/^([a-z0-9-]{2,30})\/(\d{1,3})\/([\d,-]{1,24})$/);
    if (!m) return naoAchei();
    v = await versiculoDaBiblia(m[1], m[2], m[3]).catch(() => null);
    if (v) v.rotulo = "Bíblia Sagrada";
    nome = `${m[1]}-${m[2]}-${m[3].replace(/,/g, "_")}`;
  }
  if (!v?.texto) return naoAchei();
  const [fonts, logo] = await Promise.all([carregarFontes(), carregarBrasao()]);
  const f = FORMATOS[formato];
  const svg = await satori(comLogo(desenho(v, formato), logo), { width: f.w, height: f.h, fonts });
  const img = new Resvg(svg, { fitTo: { mode: "width", value: f.w }, font: { loadSystemFonts: false } }).render();
  const jpg = jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, formato === "story" ? 90 : 86).data;
  return new Response(jpg, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      "Content-Disposition": `inline; filename="${nome}${formato === "story" ? "-status" : ""}.jpg"`,
    },
  });
}

/* ---------- Arte do evento (POST, só admin) ---------- */
const ARTE = { w: 1200, h: 750 };
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// Texto de uma linha só; se passar do tamanho, corta na última palavra inteira e põe "…".
const limpo = (v, max) => {
  const t = String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max).replace(/[\s,;:.—–-]+\S*$/, "") + "…";
};

export function textoDaData(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d) || d.getUTCDate() !== +m[3]) return "";
  const t = `${DIAS_SEMANA[d.getUTCDay()]}, ${+m[3]} de ${MESES[+m[2] - 1]}`;
  return t[0].toUpperCase() + t.slice(1);
}

export function textoDaHora(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m || +m[1] > 23 || +m[2] > 59) return "";
  return +m[2] ? `${+m[1]}h${m[2]}` : `${+m[1]}h`;
}

const letraDoNome = (n) => (n.length <= 16 ? 92 : n.length <= 26 ? 78 : n.length <= 40 ? 64 : n.length <= 60 ? 54 : 46);

function desenhoEvento({ nome, data, hora, local, categoria }) {
  const p = paletaPara(nome + data);
  const quando = [textoDaData(data), textoDaHora(hora)].filter(Boolean).join(" · ");
  const meio = [
    categoria
      ? h("div", { display: "flex", alignSelf: "flex-start", fontSize: 24, fontWeight: 800, letterSpacing: 3, color: p.fundo[2], backgroundColor: p.destaque, padding: "8px 18px", borderRadius: 999, marginBottom: 26 }, categoria.toUpperCase())
      : null,
    h("div", { display: "flex", fontFamily: "Fraunces", fontSize: letraDoNome(nome), lineHeight: 1.08, textShadow: "0 2px 18px rgba(0,0,0,0.25)" }, nome),
    quando ? h("div", { display: "flex", marginTop: 30, fontSize: 36, fontWeight: 800, color: p.destaque }, quando) : null,
    local ? h("div", { display: "flex", marginTop: 10, fontSize: 28, fontWeight: 600, opacity: 0.9 }, local) : null,
  ].filter(Boolean);
  return h(
    "div",
    { width: "100%", height: "100%", display: "flex", position: "relative", color: "#fff", fontFamily: "Inter", backgroundImage: `linear-gradient(140deg, ${p.fundo[0]} 0%, ${p.fundo[1]} 52%, ${p.fundo[2]} 100%)` },
    // luz no canto e sombra embaixo (contraste do texto branco em qualquer paleta)
    h("div", { position: "absolute", top: -ARTE.h * 0.45, right: -ARTE.w * 0.2, width: ARTE.w * 0.8, height: ARTE.w * 0.8, borderRadius: "50%", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 66%)" }),
    h("div", { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.40) 100%)" }),
    h(
      "div",
      { position: "relative", display: "flex", flexDirection: "column", flexGrow: 1, padding: "52px 72px 50px" },
      h(
        "div",
        { display: "flex", alignItems: "center" },
        h("img", { width: 64, height: 64, marginRight: 18 }),
        h(
          "div",
          { display: "flex", flexDirection: "column" },
          h("div", { display: "flex", fontSize: 25, fontWeight: 800 }, "Assembleia de Deus Belém"),
          h("div", { display: "flex", fontSize: 21, fontWeight: 600, opacity: 0.8 }, "Parque Artur Alvim"),
        ),
      ),
      h("div", { display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }, ...meio),
      h("div", { display: "flex", fontSize: 20, fontWeight: 600, opacity: 0.75 }, "adbelemparquealvim.org.br"),
    ),
  );
}

export async function gerarArteEvento(campos) {
  const v = { nome: limpo(campos?.nome, 90), data: limpo(campos?.data, 10), hora: limpo(campos?.hora, 5), local: limpo(campos?.local, 70), categoria: limpo(campos?.categoria, 28) };
  if (!v.nome) throw Object.assign(new Error("O evento precisa de um nome."), { status: 400 });
  const [fonts, logo] = await Promise.all([carregarFontes(), carregarBrasao()]);
  const svg = await satori(comLogo(desenhoEvento(v), logo), { width: ARTE.w, height: ARTE.h, fonts });
  const img = new Resvg(svg, { fitTo: { mode: "width", value: ARTE.w }, font: { loadSystemFonts: false } }).render();
  return jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, 88).data;
}

const respostaJson = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(request) {
  if (origemDeFora(request)) return respostaJson(403, { error: "Origem não permitida." });
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return respostaJson(401, { error: "Faça login no painel." });
  const isAdmin = await rpc("is_site_admin", {}, jwt).catch((e) => (e.status === 401 ? "expirou" : null));
  if (isAdmin === "expirou") return respostaJson(401, { error: "Sessão expirada. Entre de novo no painel." });
  if (isAdmin !== true) return respostaJson(403, { error: "Sem permissão. Confirme o acesso ao painel pelo e-mail." });
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return respostaJson(400, { error: "Pedido inválido." });
  }
  try {
    const jpg = await gerarArteEvento(corpo);
    return new Response(jpg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    if (e.status) return respostaJson(e.status, { error: e.message });
    console.error("arte do evento:", e);
    return respostaJson(500, { error: "Não deu para gerar a arte agora." });
  }
}
