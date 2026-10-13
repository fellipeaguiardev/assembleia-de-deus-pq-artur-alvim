// ============================================================
// EBD — "Sincronizar agora" (botão do painel)
// ------------------------------------------------------------
// POST /api/ebd-sincronizar  { year, quarter, magazine }
// Só para admin: confere o login no Supabase (e-mail confirmado e na
// lista). Busca o sumário e até 3 lições por chamada (o painel chama
// de novo enquanto houver lições faltando) e grava pela função
// ebd_sync_apply com a chave do servidor (EBD_SYNC_TOKEN), que nunca
// sai daqui.
// ============================================================
import { syncQuarter, readSyncConfig, MAGAZINES, SUPABASE_URL, SUPABASE_KEY } from "./_lib/fonte.mjs";

const ADMINS = ["adparque@gmail.com", "fellipe.aguiar1058@gmail.com"];
const env = (key) => process.env[key];
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(req) {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  // Só aceita chamadas do próprio site (o navegador sempre manda Origin no POST).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return json(403, { error: "Origem não permitida." });

  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return json(401, { error: "Faça login no painel." });
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!who?.ok) return json(401, { error: "Sessão expirada. Entre de novo no painel." });
  const user = await who.json();
  if (!user.email_confirmed_at || !ADMINS.includes(String(user.email || "").toLowerCase())) return json(403, { error: "Sem permissão." });

  const token = env("EBD_SYNC_TOKEN");
  if (!token) return json(500, { error: "EBD_SYNC_TOKEN não configurado na Vercel." });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Pedido inválido." });
  }
  const year = Number(body?.year);
  const quarter = Number(body?.quarter);
  const slug = String(body?.magazine || "");
  if (!Number.isInteger(year) || year < 2015 || year > 2100 || ![1, 2, 3, 4].includes(quarter) || !Object.hasOwn(MAGAZINES, slug)) {
    return json(400, { error: "Ano, trimestre ou revista inválidos." });
  }

  try {
    const cfg = await readSyncConfig();
    const result = await syncQuarter({ year, quarter, slug, token, autoPublish: cfg.autoPublish, maxLessons: 3, pauseMs: 500 });
    return json(200, result);
  } catch (e) {
    console.error("ebd-sincronizar:", e.message);
    if (e.missing) return json(503, { error: "Falta rodar o arquivo supabase/migrations/20261010_ebd_sync.sql no Supabase." });
    return json(502, { error: "Não foi possível ler o sumário agora. Tente mais tarde." });
  }
}
