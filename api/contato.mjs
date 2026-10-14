// ============================================================
// POST /api/contato — formulário de pedido de oração / contato
// ------------------------------------------------------------
// Valida a mensagem, barra robôs (campo-isca, envio rápido demais,
// limite por endereço) e manda o e-mail para a equipe pelo Resend.
// Nada fica guardado no servidor: a mensagem existe só no e-mail.
// O modelo do e-mail está em api/_lib/pedido-oracao.mjs.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY  chave do Resend (obrigatória)
//   NOTIFY_TO       e-mail(s) que recebem, separados por vírgula
//   NOTIFY_FROM     remetente (opcional). Padrão: "AD Belém - Site <onboarding@resend.dev>"
// ============================================================
import { buildPrayerEmail, FORM_TYPES as TYPES, LOGO_CID, LOGO_URL } from "./_lib/pedido-oracao.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Freio simples por endereço (vale por instância da função; o Resend e o
// campo-isca seguram o resto).
const recent = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 10 * 60000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 500) recent.clear();
  return list.length > 5;
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
  if (Number(request.headers.get("content-length") || 0) > 12000) return json(413, { error: "Mensagem grande demais." });

  let d;
  try {
    d = await request.json();
  } catch {
    return json(400, { error: "Pedido inválido." });
  }
  const str = (v, n) => String(v ?? "").trim().slice(0, n);
  // Robô: preencheu o campo escondido ou enviou rápido demais. Responde "ok" sem enviar nada.
  if (str(d["bot-field"], 200) || Number(d.t) < 2500) return json(200, { ok: true });

  const data = { nome: str(d.nome, 80), contato: str(d.contato, 120), tipo: TYPES.includes(d.tipo) ? d.tipo : TYPES[0], mensagem: str(d.mensagem, 2000) };
  if (data.mensagem.length < 3) return json(400, { error: "Escreva a sua mensagem." });
  if (d.consentimento !== "sim") return json(400, { error: "Falta a autorização de uso dos dados." });
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  if (tooMany(ip)) return json(429, { error: "Muitas mensagens seguidas. Tente de novo daqui a alguns minutos." });

  const apiKey = process.env.RESEND_API_KEY;
  const to = String(process.env.NOTIFY_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!apiKey || !to.length) {
    console.error("RESEND_API_KEY ou NOTIFY_TO não configurados; e-mail não enviado.");
    return json(500, { error: "Envio indisponível agora." });
  }

  const createdAt = new Date().toISOString();
  const email = buildPrayerEmail(data, createdAt);
  const message = {
    from: process.env.NOTIFY_FROM || "AD Belém - Site <onboarding@resend.dev>",
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments,
    ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    // Identificador único: impede o Gmail de agrupar pedidos diferentes na mesma conversa.
    headers: { "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
  };
  let r = await sendEmail(apiKey, message).catch((e) => ({ ok: false, status: 0, body: String(e?.message || e) }));
  if (!r.ok) {
    // Se o anexo do brasão der problema, manda sem ele (com a imagem pelo link).
    console.warn("Resend recusou com o brasão anexado:", r.status, r.body.slice(0, 200), "— tentando sem anexo.");
    const { attachments, ...plain } = message;
    r = await sendEmail(apiKey, { ...plain, html: message.html.replaceAll(`cid:${LOGO_CID}`, LOGO_URL) }).catch((e) => ({ ok: false, status: 0, body: String(e?.message || e) }));
  }
  if (!r.ok) {
    console.error("Resend recusou o envio:", r.status, r.body.slice(0, 300));
    return json(502, { error: "Não foi possível enviar agora." });
  }
  console.log("E-mail enviado para", to.length, "destinatário(s)");
  return json(200, { ok: true });
}
