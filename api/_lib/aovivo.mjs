// ============================================================
// O canal está transmitindo AGORA? (usado por api/ao-vivo.mjs)
// ------------------------------------------------------------
// Sem chave de API: abre https://www.youtube.com/channel/<id>/live (em
// português), a mesma página que qualquer pessoa abre no navegador.
//  - sem transmissão nem agendamento, o YouTube devolve a página do canal;
//  - com transmissão (ou uma agendada), devolve a página do vídeo.
// A página do vídeo traz dois blocos de dados:
//  1. o do player (ytInitialPlayerResponse.videoDetails): isLive / isUpcoming.
//     Dos servidores na nuvem (Vercel) o YouTube costuma cortar esse bloco
//     ("confirme que você não é um robô"); quando vem, ele decide.
//  2. o da tela (ytInitialData): vem sempre. Ali, ao vivo e agendada têm
//     isLive: true; o que separa é o texto: "Transmissão iniciada…" e
//     "N assistindo agora" (ao vivo) × "Programado para…" e "N aguardando"
//     (agendada). Por isso a página é pedida em português e todos os sinais
//     precisam bater.
// Nos dois casos, o vídeo precisa ser do MESMO canal. Na dúvida, "não está
// ao vivo": o botão nunca acende por engano.
// ============================================================

export const CANAL_VALIDO = /^UC[\w-]{20,}$/;
const VIDEO_VALIDO = /^[\w-]{11}$/;

const CABECALHOS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Cookie: "SOCS=CAI; CONSENT=YES+", // pula a tela de consentimento de cookies do YouTube
};

// Lê o objeto JSON que começa logo depois de `marca` no HTML, contando
// chaves e respeitando textos entre aspas (a descrição pode ter { e }).
export function objetoDepois(html, marca) {
  const i = html.indexOf(marca);
  if (i < 0) return null;
  const inicio = html.indexOf("{", i + marca.length - 1);
  if (inicio < 0 || inicio > i + marca.length + 5) return null;
  let nivel = 0;
  let emTexto = false;
  for (let k = inicio; k < html.length; k++) {
    const ch = html[k];
    if (emTexto) {
      if (ch === "\\") k++;
      else if (ch === '"') emTexto = false;
      continue;
    }
    if (ch === '"') emTexto = true;
    else if (ch === "{") nivel++;
    else if (ch === "}" && --nivel === 0) {
      try {
        return JSON.parse(html.slice(inicio, k + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const texto = (t) => (t?.simpleText ?? (t?.runs || []).map((r) => r.text).join("")) || "";

// Bloco 1: dados do player, quando vêm completos.
function pelosDadosDoPlayer(html, canal) {
  const d = objetoDepois(html, "ytInitialPlayerResponse = ")?.videoDetails;
  if (!d || !VIDEO_VALIDO.test(String(d.videoId || ""))) return null; // não veio: tenta o bloco 2
  if (d.channelId !== canal) return { aoVivo: false };
  if (d.isUpcoming === true) return { aoVivo: false, agendada: true };
  if (d.isLive !== true) return { aoVivo: false };
  return { aoVivo: true, videoId: d.videoId, titulo: String(d.title || "") };
}

// Bloco 2: dados da tela.
function pelosDadosDaTela(html, canal) {
  const d = objetoDepois(html, "ytInitialData = ");
  const itens = d?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
  if (!Array.isArray(itens)) return { aoVivo: false };
  const principal = itens.find((c) => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
  const dono = itens.find((c) => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
  const videoId = String(d.currentVideoEndpoint?.watchEndpoint?.videoId || "");
  const contagem = principal?.viewCount?.videoViewCountRenderer;
  if (!principal || !contagem || !VIDEO_VALIDO.test(videoId)) return { aoVivo: false };
  if (dono?.navigationEndpoint?.browseEndpoint?.browseId !== canal) return { aoVivo: false };
  const quantos = texto(contagem.viewCount);
  const quando = texto(principal.dateText);
  if (/aguardando|waiting/i.test(quantos) || /programad|scheduled|estreia|premieres/i.test(quando)) return { aoVivo: false, agendada: true };
  const sinais = contagem.isLive === true && (/assistindo|watching/i.test(quantos) || /transmissão iniciada|started streaming/i.test(quando));
  if (!sinais) return { aoVivo: false };
  return { aoVivo: true, videoId, titulo: texto(principal.title) };
}

// { aoVivo, videoId?, titulo?, agendada? } a partir do HTML da página /live.
export function lerStatus(html, canal) {
  const r = pelosDadosDoPlayer(html, canal) || pelosDadosDaTela(html, canal);
  return r.aoVivo ? { ...r, titulo: r.titulo.slice(0, 200) } : r;
}

export async function statusDoCanal(canal, { timeoutMs = 5000 } = {}) {
  if (!CANAL_VALIDO.test(String(canal || ""))) return { aoVivo: false, semCanal: true };
  const res = await fetch(`https://www.youtube.com/channel/${canal}/live?hl=pt&gl=BR`, { headers: CABECALHOS, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`YouTube respondeu ${res.status}`);
  return lerStatus(await res.text(), canal);
}
