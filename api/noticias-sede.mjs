// ============================================================
// Notícias da AD Belém – Sede → sugestões no painel
// ------------------------------------------------------------
// Quem aciona:
//   GET  com "Authorization: Bearer CRON_SECRET"  → Vercel Cron, todo dia
//   POST com o login de um admin liberado         → botão "Buscar agora" do painel
//
// O que faz: lê as notícias dos últimos 30 dias do site da sede
// (api/_lib/noticias-sede.mjs: só título, data, resumo curto e link), filtra
// as que importam e grava as novas como SUGESTÃO, sem publicar, pela função
// news_sede_apply, com a chave NEWS_SYNC_TOKEN (que nunca sai daqui). A equipe
// decide no painel (Notícias → Sugestões da sede); a descartada não volta.
//
// Variáveis na Vercel: NEWS_SYNC_TOKEN e CRON_SECRET.
// No banco: supabase/migrations/20261019_noticias_sede.sql.
// ============================================================
import { timingSafeEqual } from "node:crypto";
import { rpc } from "./_lib/fonte.mjs";
import { lerNoticiasSede } from "./_lib/noticias-sede.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export async function runNewsSync() {
  const key = process.env.NEWS_SYNC_TOKEN;
  if (!key) return { ok: false, status: 500, error: "Falta NEWS_SYNC_TOKEN na Vercel." };
  let itens;
  try {
    itens = await lerNoticiasSede();
  } catch (e) {
    console.error("Notícias da sede:", e);
    return { ok: false, status: 502, error: "Não deu para ler o site da sede agora. Tente de novo mais tarde." };
  }
  const escolhidas = itens.filter((i) => i.entra).map(({ entra, motivo, ...r }) => r);
  let r;
  try {
    r = await rpc("news_sede_apply", { p_key: key, p_rows: escolhidas });
  } catch (e) {
    if (e.missing) return { ok: false, status: 503, error: "Falta rodar supabase/migrations/20261019_noticias_sede.sql no Supabase." };
    console.error("news_sede_apply:", e);
    return { ok: false, status: 500, error: "Não deu para guardar as sugestões." };
  }
  return {
    ok: true,
    lidas: itens.length,
    novas: Array.isArray(r?.novas) ? r.novas : [],
    deFora: itens.filter((i) => !i.entra).map((i) => ({ title: i.title, motivo: i.motivo })),
  };
}

export async function GET(request) {
  const cron = process.env.CRON_SECRET;
  if (!cron || !sameSecret(request.headers.get("authorization"), `Bearer ${cron}`)) return json(401, { error: "Não autorizado." });
  const r = await runNewsSync();
  return json(r.ok ? 200 : r.status || 500, r);
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { error: "Origem não permitida." });
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return json(401, { error: "Faça login no painel." });
  const isAdmin = await rpc("is_site_admin", {}, jwt).catch((e) => (e.status === 401 ? "expirou" : null));
  if (isAdmin === "expirou") return json(401, { error: "Sessão expirada. Entre de novo no painel." });
  if (isAdmin !== true) return json(403, { error: "Sem permissão. Confirme o acesso ao painel pelo e-mail." });
  const r = await runNewsSync();
  return json(r.ok ? 200 : r.status || 500, r);
}
