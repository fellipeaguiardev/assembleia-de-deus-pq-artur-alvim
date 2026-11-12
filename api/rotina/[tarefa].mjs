// ============================================================
// Rotinas automáticas do site (Vercel Cron, ver "crons" no vercel.json)
// ------------------------------------------------------------
//   /api/rotina/ebd      todo dia 06:00 (Brasília): importa as lições da EBD
//   /api/rotina/alertas  todo dia 09:00: confere se algo parou e avisa por e-mail
//   /api/rotina/resumo   segunda 07:00: resumo da semana por e-mail para a equipe
// Uma função só (o plano grátis da Vercel aceita no máximo 12).
//
// Quem aciona:
//   GET  com "Authorization: Bearer CRON_SECRET" → Vercel Cron
//   POST com o login de um admin liberado        → botões "Enviar resumo agora" e
//        "Testar alerta" do painel (Igreja & redes); o de alerta manda o e-mail
//        mesmo sem novidade, marcado como [Teste].
//
// EBD: confere o sumário das Lições Bíblicas do trimestre atual (e do próximo,
// perto da virada) das revistas marcadas no painel (EBD → Importação
// automática) e completa as lições. Educado com o site de origem: no máximo 1
// página de sumário por revista e só as lições que faltam (até 10 por dia).
//
// Alertas: só manda quando a lista de problemas muda, ou depois de 3 dias
// igual, e avisa quando tudo volta ao normal (decidirAlerta em _lib/rotina.mjs).
//
// Variáveis na Vercel: CRON_SECRET, EBD_SYNC_TOKEN, ROTINA_TOKEN, RESEND_API_KEY
// e, opcional, RESUMO_PARA (quem recebe; sem ela, ADMIN_APROVADORES ou NOTIFY_TO).
// No banco: supabase/migrations/20261111120000_rotina_resumo_alertas.sql.
// ============================================================
import { timingSafeEqual } from "node:crypto";
import { syncQuarter, readSyncConfig, quartersToSync, rpc } from "../_lib/fonte.mjs";
import { origemDeFora } from "../_lib/site.mjs";
import { lerPainel, registrarRotina, problemas, decidirAlerta, emailResumo, emailAlerta, enviarEmail, destinatarios } from "../_lib/rotina.mjs";

const TIME_BUDGET_MS = 45000; // a função pode rodar até 60 s (vercel.json)

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const sameSecret = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};
const tarefaDe = (request) => (new URL(request.url).pathname.match(/\/api\/rotina\/([a-z]+)\/?$/) || [])[1] || "";

/* ---------- EBD ---------- */
async function rotinaEbd() {
  const token = process.env.EBD_SYNC_TOKEN;
  if (!token) {
    console.error("EBD_SYNC_TOKEN não configurado; importação não executada.");
    await registrarRotina("ebd", false, "Falta EBD_SYNC_TOKEN na Vercel.");
    return { status: 500, body: { error: "EBD_SYNC_TOKEN não configurado." } };
  }
  const started = Date.now();
  const cfg = await readSyncConfig();
  if (!cfg.enabled) {
    console.log("Importação automática desligada no painel.");
    await registrarRotina("ebd", true, "Importação automática desligada no painel.");
    return { status: 200, body: { ok: true, enabled: false } };
  }
  const results = [];
  let budget = 10;
  let partial = false;
  // Cada dia começa de uma lição diferente (syncQuarter dá a volta): uma lição
  // sem as três referências no escola-ebd não trava as outras para sempre.
  const GIRO = (Math.floor(Date.now() / 864e5) * 5) % 14;
  fora: for (const slug of cfg.magazines) {
    for (const { year, quarter } of quartersToSync()) {
      if (budget <= 0 || Date.now() - started > TIME_BUDGET_MS) {
        console.log("Limite desta execução atingido; continua amanhã.");
        partial = true;
        break fora;
      }
      try {
        const r = await syncQuarter({ year, quarter, slug, token, autoPublish: cfg.autoPublish, maxLessons: Math.min(budget, 5), after: GIRO, log: console.log });
        budget -= r.fetched || 0;
        console.log(JSON.stringify(r));
        results.push({ slug, year, quarter, ...r });
      } catch (e) {
        console.error(`${quarter}º/${year} ${slug}:`, e.message);
        results.push({ slug, year, quarter, error: e.message });
      }
    }
  }
  const erros = results.filter((r) => r.error);
  // Falha = nada deu certo. Um trimestre seguinte ainda sem sumário, sozinho, não é falha geral.
  const falhou = results.length > 0 && erros.length === results.length;
  await registrarRotina("ebd", !falhou, erros.map((r) => `${r.slug} ${r.quarter}º/${r.year}: ${r.error}`).join(" · "));
  return { status: 200, body: { ok: true, results, ...(partial && { partial: true }) } };
}

/* ---------- Resumo da semana ---------- */
async function rotinaResumo() {
  const p = await lerPainel();
  const email = emailResumo(p);
  const to = destinatarios();
  await enviarEmail({ to, ...email });
  console.log("resumo: enviado para", to.length, "destinatário(s):", email.subject);
  return { status: 200, body: { ok: true, assunto: email.subject, para: to.length } };
}

/* ---------- Alertas ---------- */
async function rotinaAlertas({ teste = false } = {}) {
  const p = await lerPainel();
  const lista = problemas(p);
  const d = decidirAlerta(lista, p.rotinas?.alerta);
  const to = destinatarios();
  if (teste) {
    // botão do painel: manda o estado de agora, marcado como teste (não mexe no controle de repetição)
    const email = lista.length ? emailAlerta(lista) : emailAlerta([], { resolvido: true });
    await enviarEmail({ to, ...email, subject: `[Teste] ${email.subject}` });
    return { status: 200, body: { ok: true, teste: true, para: to.length, problemas: lista.map((x) => x.titulo) } };
  }
  if (!d.enviar) {
    console.log("alertas:", lista.length ? `${lista.length} problema(s), já avisados` : "nada a avisar");
    return { status: 200, body: { ok: true, enviado: false, problemas: lista.map((x) => x.titulo) } };
  }
  const email = emailAlerta(lista, { resolvido: d.resolvido });
  await enviarEmail({ to, ...email });
  await registrarRotina("alerta", !lista.length, d.sig);
  console.log("alertas: e-mail enviado:", email.subject);
  return { status: 200, body: { ok: true, enviado: true, problemas: lista.map((x) => x.titulo) } };
}

async function rodar(tarefa, opcoes) {
  try {
    if (tarefa === "ebd") return await rotinaEbd();
    if (tarefa === "resumo") return await rotinaResumo();
    if (tarefa === "alertas") return await rotinaAlertas(opcoes);
    return { status: 404, body: { error: "Rotina desconhecida." } };
  } catch (e) {
    console.error(`rotina ${tarefa}:`, e.message);
    return { status: e.status || 500, body: { error: e.message || "Falhou." } };
  }
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("authorization"), `Bearer ${secret}`)) return json(401, { error: "Sem permissão." });
  const r = await rodar(tarefaDe(request));
  return json(r.status, r.body);
}

export async function POST(request) {
  if (origemDeFora(request)) return json(403, { error: "Origem não permitida." });
  const tarefa = tarefaDe(request);
  if (!["resumo", "alertas"].includes(tarefa)) return json(404, { error: "Rotina desconhecida." });
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return json(401, { error: "Faça login no painel." });
  const isAdmin = await rpc("is_site_admin", {}, jwt).catch((e) => (e.status === 401 ? "expirou" : null));
  if (isAdmin === "expirou") return json(401, { error: "Sessão expirada. Entre de novo no painel." });
  if (isAdmin !== true) return json(403, { error: "Sem permissão. Confirme o acesso ao painel pelo e-mail." });
  const r = await rodar(tarefa, { teste: true });
  return json(r.status, r.body);
}
