// ============================================================
// EBD — importação automática diária (Vercel Cron, ver vercel.json)
// ------------------------------------------------------------
// Todo dia às 06:00 (Brasília) confere o sumário das Lições Bíblicas
// do trimestre atual (e do próximo, perto da virada) para as revistas
// marcadas no painel (Painel → EBD → Importação automática) e
// completa as lições: títulos, datas e referências bíblicas.
// Por padrão as lições entram como rascunho; a equipe revisa e
// publica. Se "Publicar sozinho" estiver ligado no painel, cada lição
// com texto áureo entra no ar na segunda-feira da semana dela.
//
// Educado com o site de origem: no máximo 1 página de sumário por
// revista e só as lições que ainda faltam (até 10 por execução).
// Precisa das variáveis EBD_SYNC_TOKEN e CRON_SECRET na Vercel (a Vercel
// manda o CRON_SECRET no cabeçalho; sem ele, ninguém de fora aciona).
// ============================================================
import { syncQuarter, readSyncConfig, quartersToSync } from "./_lib/fonte.mjs";

const env = (key) => process.env[key];
const TIME_BUDGET_MS = 45000; // a função pode rodar até 60 s (vercel.json)

const done = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request) {
  const secret = env("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return done({ error: "Sem permissão." }, 401);
  const token = env("EBD_SYNC_TOKEN");
  if (!token) {
    console.error("EBD_SYNC_TOKEN não configurado; importação não executada.");
    return done({ error: "EBD_SYNC_TOKEN não configurado." }, 500);
  }
  const started = Date.now();
  const cfg = await readSyncConfig();
  if (!cfg.enabled) {
    console.log("Importação automática desligada no painel.");
    return done({ ok: true, enabled: false });
  }
  const results = [];
  let budget = 10;
  for (const slug of cfg.magazines) {
    for (const { year, quarter } of quartersToSync()) {
      if (budget <= 0 || Date.now() - started > TIME_BUDGET_MS) {
        console.log("Limite desta execução atingido; continua amanhã.");
        return done({ ok: true, results, partial: true });
      }
      try {
        const r = await syncQuarter({ year, quarter, slug, token, autoPublish: cfg.autoPublish, maxLessons: Math.min(budget, 5), log: console.log });
        budget -= r.fetched || 0;
        console.log(JSON.stringify(r));
        results.push({ slug, year, quarter, ...r });
      } catch (e) {
        console.error(`${quarter}º/${year} ${slug}:`, e.message);
        results.push({ slug, year, quarter, error: e.message });
      }
    }
  }
  return done({ ok: true, results });
}
