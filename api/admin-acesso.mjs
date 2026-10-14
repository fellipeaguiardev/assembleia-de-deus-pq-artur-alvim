// ============================================================
// POST /api/admin-acesso — pede a liberação da sessão do painel
// ------------------------------------------------------------
// Chamada pelo painel logo depois do login (e-mail e senha), com o
// token do login no cabeçalho Authorization. Confere o login no
// Supabase, cria o pedido (função admin_access_request, protegida pela
// chave ADMIN_ACCESS_TOKEN, que nunca sai daqui) e manda o e-mail
// "Liberar acesso / Não fui eu" pelo Resend.
//
// Quem recebe o e-mail: ADMIN_APROVADORES (e-mails separados por
// vírgula) ou, se não houver, os mesmos do pedido de oração (NOTIFY_TO).
// Sem domínio próprio no Resend, ele só entrega para o e-mail da conta
// Resend — por isso o padrão é esse endereço.
// ============================================================
import { randomBytes } from "node:crypto";
import { SUPABASE_URL, SUPABASE_KEY, rpc } from "./_lib/fonte.mjs";
import { sha256, buildAccessEmail, deviceLabel, maskEmail } from "./_lib/acesso.mjs";
import { LOGO_CID } from "./_lib/pedido-oracao.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function claims(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

async function sendEmail(apiKey, message) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? "" : await res.text() };
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { error: "Origem não permitida." });
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.length > 4096) return json(401, { error: "Faça login no painel." });

  // O login é de verdade? (o Supabase confere a assinatura do token)
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!who?.ok) return json(401, { error: "Sessão expirada. Entre de novo." });
  const user = await who.json();
  const session = claims(jwt).session_id;
  if (!user?.id || !/^[0-9a-f-]{36}$/i.test(String(session || ""))) return json(401, { error: "Sessão inválida." });

  const key = process.env.ADMIN_ACCESS_TOKEN;
  const apiKey = process.env.RESEND_API_KEY;
  const to = String(process.env.ADMIN_APROVADORES || process.env.NOTIFY_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || !apiKey || !to.length) return json(500, { error: "Liberação por e-mail não configurada." });

  const token = randomBytes(32).toString("base64url");
  const city = request.headers.get("x-vercel-ip-city");
  const info = {
    aparelho: deviceLabel(request.headers.get("user-agent") || ""),
    cidade: city ? decodeURIComponent(city) : "",
    pais: request.headers.get("x-vercel-ip-country") || "",
    ip: (request.headers.get("x-forwarded-for") || "").split(",")[0].trim(),
  };
  let r;
  try {
    r = await rpc("admin_access_request", { p_key: key, p_user: user.id, p_session: session, p_token_hash: sha256(token), p_info: info });
  } catch (e) {
    console.error("admin-acesso: banco recusou", e.message);
    if (e.missing) return json(503, { error: "Falta rodar a migração de segurança no Supabase." });
    return json(502, { error: "Não foi possível pedir a liberação agora." });
  }
  if (!r?.ok) {
    if (r?.motivo === "nao_admin") return json(403, { error: "Esta conta não é de administrador." });
    if (r?.motivo === "limite") return json(429, { error: "Muitos pedidos na última hora. Espere um pouco e tente de novo." });
    return json(400, { error: "Pedido recusado." });
  }
  if (r.status === "permitido") return json(200, { status: "permitido" });

  const email = buildAccessEmail({ email: r.email, info, token, createdAt: new Date().toISOString() });
  const message = {
    from: process.env.NOTIFY_FROM || "AD Belém - Site <onboarding@resend.dev>",
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments,
    headers: { "X-Entity-Ref-ID": `acesso-${Date.now()}` },
  };
  let sent = await sendEmail(apiKey, message).catch((e) => ({ ok: false, status: 0, body: String(e?.message || e) }));
  if (!sent.ok) {
    const { attachments, ...plain } = message;
    sent = await sendEmail(apiKey, { ...plain, html: message.html.replaceAll(`cid:${LOGO_CID}`, email.logoUrl) }).catch((e) => ({ ok: false, status: 0, body: String(e?.message || e) }));
  }
  if (!sent.ok) {
    console.error("admin-acesso: Resend recusou", sent.status, sent.body.slice(0, 200));
    return json(502, { error: "Não foi possível enviar o e-mail de liberação." });
  }
  console.log("admin-acesso: e-mail de liberação enviado");
  return json(200, { status: "pendente", para: to.map(maskEmail) });
}
