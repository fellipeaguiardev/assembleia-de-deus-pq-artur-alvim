// ============================================================
// Acesso ao painel — peças comuns às funções admin-acesso e admin-aprovar:
// chamadas ao Supabase, e-mail de liberação e a página do link.
// ============================================================
import { createHash } from "node:crypto";
export { rpc } from "./fonte.mjs";
import { LOGO_CID, LOGO_URL, LOGO_ATTACHMENT } from "./pedido-oracao.mjs";
import { SITE_URL } from "./site.mjs";
export { SITE_URL };
export const sha256 = (t) => createHash("sha256").update(String(t), "utf8").digest("hex");
const C = { navy: "#032154", primary: "#003399", bg: "#f2f4f9", text: "#1c2333", soft: "#5b6478", line: "#e3e7ef", ok: "#1f7a46", bad: "#b42318" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function when(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

// "Chrome · Android", "Safari · iPhone"… (só para a pessoa reconhecer o aparelho)
export function deviceLabel(ua = "") {
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "aparelho desconhecido";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /node|undici/i.test(ua) ? "script" : "navegador";
  return `${br} · ${os}`;
}

export const maskEmail = (e) => String(e || "").replace(/^(.{2}).*(@.*)$/, "$1***$2");

// E-mail "alguém entrou no painel": Liberar acesso / Não fui eu.
export function buildAccessEmail({ email, info, token, createdAt }) {
  const page = `${SITE_URL}/api/admin-aprovar?t=${encodeURIComponent(token)}`;
  const btn = (href, label, bg) =>
    `<a href="${esc(href)}" target="_blank" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:999px;margin:0 8px 10px 0;">${label}</a>`;
  const line = (k, v) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.soft};font-size:13px;width:120px;vertical-align:top;">${k}</td><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.text};font-size:14px;">${esc(v)}</td></tr>`;
  const local = [info?.cidade, info?.pais].filter(Boolean).join(", ") || "não identificado";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
      <tr><td style="background:${C.navy};padding:26px 28px;text-align:center;">
        <img src="cid:${LOGO_CID}" width="56" height="69" alt="Brasão AD Belém" style="display:block;margin:0 auto 10px;border:0;">
        <div style="color:#ffffff;font-size:19px;font-weight:700;">Alguém entrou no painel do site</div>
        <div style="color:#c9d6ea;font-size:13px;margin-top:4px;">Confirme se foi você ou alguém da equipe</div>
      </td></tr>
      <tr><td style="padding:24px 28px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${line("Conta", email)}
          ${line("Quando", when(createdAt))}
          ${line("Aparelho", info?.aparelho || "não identificado")}
          ${line("Local aproximado", local)}
        </table>
      </td></tr>
      <tr><td style="padding:16px 28px 6px;">
        ${btn(page, "✅ Sim, liberar acesso", C.ok)}
        ${btn(page + "&acao=negar", "⛔ Não fui eu", C.bad)}
      </td></tr>
      <tr><td style="padding:6px 28px 24px;color:${C.soft};font-size:13px;line-height:1.6;">
        O botão abre uma página para você confirmar. O link vale por 20 minutos e o acesso liberado dura 12 horas.
        Se não foi você, toque em <strong>Não fui eu</strong> e troque a senha do painel.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = `Alguém entrou no painel do site da ${"AD Belém - Pq. Artur Alvim"}.\n\nConta: ${email}\nQuando: ${when(createdAt)}\nAparelho: ${info?.aparelho || "-"}\nLocal aproximado: ${local}\n\nLiberar acesso: ${page}\nNão fui eu: ${page}&acao=negar\n\nO link vale por 20 minutos. Se não foi você, troque a senha do painel.`;
  const stamp = new Date(createdAt || Date.now()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  return { subject: `🔐 Acesso ao painel — confirme · ${stamp}`, html, text, attachments: [LOGO_ATTACHMENT], logoUrl: LOGO_URL };
}

// Página simples (a que o link do e-mail abre).
export function page(title, bodyHTML, status = 200) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} — Painel AD Belém</title>
<style>
  body{margin:0;background:${C.bg};font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:${C.text}}
  main{max-width:520px;margin:32px auto;padding:0 16px}
  .card{background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 10px 30px -18px rgba(3,33,84,.45)}
  .logo{display:block;width:54px;height:auto;margin:0 auto 14px}
  h1{font-size:21px;margin:0 0 10px;text-align:center}
  p{line-height:1.55;color:${C.soft};margin:8px 0}
  dl{margin:16px 0;border-top:1px solid ${C.line}}
  dt{font-size:12px;color:${C.soft};margin-top:10px}
  dd{margin:2px 0 10px;font-weight:600}
  .acoes{display:grid;gap:10px;margin-top:18px}
  button,.link{font:inherit;font-size:16px;font-weight:700;border:0;border-radius:999px;padding:14px 18px;cursor:pointer;text-align:center;text-decoration:none}
  .ok{background:${C.ok};color:#fff}.bad{background:${C.bad};color:#fff}.link{background:${C.primary};color:#fff;display:block}
  .destaque{outline:3px solid #f5c542;outline-offset:2px}
</style></head><body><main><div class="card"><img class="logo" src="/assets/img/brasao.svg" alt="">${bodyHTML}</div></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
