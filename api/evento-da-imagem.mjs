// ============================================================
// POST /api/evento-da-imagem — lê o cartaz e devolve os campos do evento
// ------------------------------------------------------------
// Chamada pelo painel (aba Eventos: "Novo evento pela imagem" e "Preencher
// pelo cartaz"), com o login do painel no cabeçalho Authorization: só admin
// com a entrada liberada por e-mail (is_site_admin). Assim ninguém de fora
// gasta a cota do Gemini.
// Corpo: { imagem: "<base64>", tipo: "image/jpeg" } — o painel já reduz a
// imagem no navegador (lado maior até 1600 px).
// Resposta: { campos: { nome, data, horario, categoria, local, endereco,
// descricao, link, avisos[] }, modelo } ou { error }.
// Nada é gravado aqui: quem cria ou altera o evento é o painel.
// ============================================================
import { origemDeFora } from "./_lib/site.mjs";
import { rpc } from "./_lib/fonte.mjs";
import { lerCartaz, ErroCartaz } from "./_lib/cartaz.mjs";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64 = 4_000_000; // ~3 MB de imagem (a Vercel aceita até 4,5 MB por pedido)

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const hojeEmSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export async function POST(request) {
  if (origemDeFora(request)) return json(403, { error: "Origem não permitida." });
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return json(401, { error: "Faça login no painel." });
  const isAdmin = await rpc("is_site_admin", {}, jwt).catch((e) => (e.status === 401 ? "expirou" : null));
  if (isAdmin === "expirou") return json(401, { error: "Sessão expirada. Entre de novo no painel." });
  if (isAdmin !== true) return json(403, { error: "Sem permissão. Confirme o acesso ao painel pelo e-mail." });

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json(400, { error: "Pedido inválido." });
  }
  const imagem = String(corpo?.imagem || "");
  const tipo = String(corpo?.tipo || "");
  if (!TIPOS.includes(tipo)) return json(400, { error: "Envie uma imagem JPG, PNG ou WEBP." });
  if (!imagem || imagem.length > MAX_BASE64 || !/^[A-Za-z0-9+/]+=*$/.test(imagem)) return json(400, { error: "Imagem inválida ou grande demais." });

  try {
    const r = await lerCartaz({ imagem, tipo, hoje: hojeEmSP(), chave: process.env.GEMINI_API_KEY, modelos: [process.env.GEMINI_MODEL] });
    return json(200, r);
  } catch (e) {
    if (e instanceof ErroCartaz) {
      if (e.status >= 500) console.error("evento-da-imagem:", e.message);
      return json(e.status, { error: e.message });
    }
    console.error("evento-da-imagem:", e);
    return json(500, { error: "Não deu para ler o cartaz agora. Tente de novo." });
  }
}
