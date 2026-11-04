// ============================================================
// GET /api/ao-vivo — a igreja está transmitindo agora?
// ------------------------------------------------------------
// Usada pelo botão "Ao vivo" do site (js/site.js, conferirAoVivo), que fica
// vermelho e pulsando enquanto a transmissão estiver no ar.
// O canal é o da aba "Igreja & redes" do painel (church.liveChannelId); a
// função não aceita outro canal, para não virar um consultor de qualquer canal.
// A resposta fica 60 s no cache da Vercel: o YouTube é consultado no máximo
// uma vez por minuto, não importa quantas pessoas estejam no site.
// Resposta: { aoVivo: true, videoId, titulo } ou { aoVivo: false }.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "./_lib/fonte.mjs";
import { statusDoCanal } from "./_lib/aovivo.mjs";

const responder = (corpo, segundos) =>
  new Response(JSON.stringify(corpo), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${segundos}, stale-while-revalidate=${segundos}`,
    },
  });

async function canalConfigurado() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.main&select=canal:data->church->>liveChannelId`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`settings: HTTP ${res.status}`);
  const [linha] = await res.json();
  return String(linha?.canal || "").trim();
}

export async function GET() {
  try {
    const status = await statusDoCanal(await canalConfigurado());
    return responder({ ...status, conferidoEm: new Date().toISOString() }, 60);
  } catch (e) {
    console.error("ao-vivo:", e.message);
    return responder({ aoVivo: false, erro: true }, 30); // na dúvida, não acende
  }
}
