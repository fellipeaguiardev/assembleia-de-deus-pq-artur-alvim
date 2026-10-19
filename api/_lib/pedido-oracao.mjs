// ============================================================
// Modelo do e-mail enviado a cada mensagem do formulário de contato
// (pedido de oração, visita, conversa com pastor ou outro assunto).
// HTML em tabelas com estilos inline: é o que funciona no Gmail,
// Outlook e celulares.
// ============================================================

import { SITE_URL, SITE_HOST } from "./site.mjs";

// Brasão anexado ao próprio e-mail (imagem "inline", cid:). Muitos apps — o
// Gmail no spam, por exemplo — bloqueiam imagens de fora; anexada, ela aparece.
export const LOGO_CID = "logo-adbelem";
export const LOGO_URL = `${SITE_URL}/assets/img/logo-email.png`;
export const LOGO_ATTACHMENT = { path: LOGO_URL, filename: "logo-adbelem.png", content_id: LOGO_CID, content_type: "image/png" };
const CHURCH = "AD Belém - Pq. Artur Alvim";

const C = {
  navy: "#032154",
  primary: "#003399",
  accent: "#86abca",
  bg: "#f2f4f9",
  text: "#1c2333",
  soft: "#5b6478",
  line: "#e3e7ef",
  tint: "#eef3fb",
};

// Texto e versículo de acordo com o assunto escolhido no formulário.
const TOPICS = {
  "Pedido de oração": {
    emoji: "🙏",
    title: "Novo pedido de oração",
    intro:
      "Alguém abriu o coração e compartilhou um pedido de oração pelo site. Separe um momento para interceder por essa pessoa e, se ela deixou contato, envie uma palavra de carinho.",
    verse: "“Orem uns pelos outros… A oração de um justo é poderosa e eficaz.”",
    ref: "Tiago 5:16",
  },
  "Quero visitar a igreja": {
    emoji: "🏠",
    title: "Alguém quer visitar a igreja!",
    intro:
      "Que alegria! Uma pessoa demonstrou interesse em nos visitar. Entre em contato para dar as boas-vindas, informar os horários dos cultos e combinar quem vai recebê-la na porta.",
    verse: "“Acolham-se uns aos outros, como também Cristo os acolheu.”",
    ref: "Romanos 15:7",
  },
  "Quero conversar com um pastor": {
    emoji: "💬",
    title: "Pedido de conversa com um pastor",
    intro:
      "Alguém pediu para conversar com um pastor. Procure responder em até 48 horas e, se possível, combine um horário com calma para ouvir essa pessoa.",
    verse: "“Levem os fardos pesados uns dos outros e, assim, cumpram a lei de Cristo.”",
    ref: "Gálatas 6:2",
  },
  default: {
    emoji: "✉️",
    title: "Nova mensagem pelo site",
    intro: "Chegou uma nova mensagem pelo formulário do site. Os detalhes estão logo abaixo.",
    verse: "“Que a palavra de vocês seja sempre agradável, temperada com sal.”",
    ref: "Colossenses 4:6",
  },
};

// Assuntos aceitos pelo formulário (os mesmos de js/extras.js → PRAYER_TYPES).
export const FORM_TYPES = [...Object.keys(TOPICS).filter((k) => k !== "default"), "Outro assunto"];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const clean = (s, max) => String(s ?? "").trim().slice(0, max);

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

// Telefone brasileiro com DDD (10 ou 11 dígitos) ou já com 55 na frente.
function whatsappNumber(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(d)) return d;
  if (/^\d{10,11}$/.test(d)) return "55" + d;
  return "";
}

function formatDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  const opts = { timeZone: "America/Sao_Paulo" };
  const date = d.toLocaleDateString("pt-BR", { ...opts, weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { ...opts, hour: "2-digit", minute: "2-digit" });
  return `${date.charAt(0).toUpperCase() + date.slice(1)}, às ${time}`;
}

function button(href, label, bg, color = "#ffffff") {
  return `<a href="${esc(href)}" target="_blank" style="display:inline-block;background:${bg};color:${color};text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:13px 20px;border-radius:999px;margin:0 8px 10px 0;">${label}</a>`;
}

function row(label, valueHTML, last = false) {
  return `<tr>
    <td style="padding:12px 0;${last ? "" : `border-bottom:1px solid ${C.line};`}width:120px;vertical-align:top;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.soft};">${label}</td>
    <td style="padding:12px 0;${last ? "" : `border-bottom:1px solid ${C.line};`}vertical-align:top;font-size:15px;color:${C.text};">${valueHTML}</td>
  </tr>`;
}

/**
 * Monta o e-mail a partir dos dados do formulário.
 * @param {{nome?:string, contato?:string, tipo?:string, mensagem?:string}} data
 * @param {string} [createdAt] data do envio (ISO)
 */
export function buildPrayerEmail(data, createdAt) {
  const nome = clean(data.nome, 80);
  const contato = clean(data.contato, 120);
  const tipo = clean(data.tipo, 60) || "Pedido de oração";
  const mensagem = clean(data.mensagem, 2000);
  const topic = TOPICS[tipo] || TOPICS.default;
  const firstName = nome.split(/\s+/)[0] || "";
  const quando = formatDate(createdAt);

  const wa = whatsappNumber(contato);
  const mail = isEmail(contato) ? contato : "";
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  const waText = `${greeting} Aqui é da ${CHURCH}. Recebemos sua mensagem pelo site e estamos com você em oração. 🙏`;

  const actions = [
    wa && button(`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`, "Responder no WhatsApp", "#1f9d55"),
    mail && button(`mailto:${mail}?subject=${encodeURIComponent(`Sua mensagem para a ${CHURCH}`)}&body=${encodeURIComponent(`${greeting}\n\nRecebemos sua mensagem pelo site e estamos com você em oração.\n\n`)}`, "Responder por e-mail", C.primary),
  ]
    .filter(Boolean)
    .join("");

  const contatoHTML = contato
    ? esc(contato) + (wa || mail ? "" : `<br><span style="font-size:13px;color:${C.soft};">Confira o número/e-mail antes de responder.</span>`)
    : `<span style="color:${C.soft};">Não informado (a pessoa não pediu retorno)</span>`;

  // Data e hora no assunto: cada pedido vira uma conversa própria no Gmail
  // (com assuntos iguais, ele juntava tudo numa só e o novo passava batido).
  const stamp = new Date(createdAt || Date.now()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const subject = `${topic.emoji} ${topic.title}${nome ? ` — ${nome}` : ""} · ${stamp}`;
  const preheader = mensagem.slice(0, 110) + (mensagem.length > 110 ? "…" : "");

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(3,33,84,.08);">

      <!-- Cabeçalho -->
      <tr><td style="background:${C.navy};background-image:linear-gradient(160deg,${C.primary},${C.navy});padding:28px 32px;text-align:center;">
        <img src="cid:${LOGO_CID}" width="64" height="79" alt="Brasão AD Belém" style="display:block;margin:0 auto 12px;border:0;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#ffffff;">Assembleia de Deus Belém</div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${C.accent};margin-top:4px;">Parque Artur Alvim</div>
      </td></tr>

      <!-- Título e introdução -->
      <tr><td style="padding:32px 32px 8px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.primary};">${esc(tipo)}</div>
        <h1 style="margin:8px 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${C.text};">${topic.emoji} ${esc(topic.title)}</h1>
        <p style="margin:0;font-size:15.5px;line-height:1.65;color:${C.soft};">${esc(topic.intro)}</p>
      </td></tr>

      <!-- Mensagem -->
      <tr><td style="padding:20px 32px 4px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.soft};margin-bottom:8px;">Mensagem${firstName ? ` de ${esc(firstName)}` : ""}</div>
        <div style="background:${C.tint};border-left:4px solid ${C.primary};border-radius:12px;padding:18px 20px;font-size:16.5px;line-height:1.7;color:${C.text};white-space:pre-line;">${esc(mensagem) || `<span style="color:${C.soft};">(sem texto)</span>`}</div>
      </td></tr>

      <!-- Dados -->
      <tr><td style="padding:16px 32px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row("Nome", nome ? esc(nome) : `<span style="color:${C.soft};">Preferiu não se identificar</span>`)}
          ${row("Contato", contatoHTML)}
          ${row("Assunto", esc(tipo))}
          ${row("Recebido", esc(quando), true)}
        </table>
      </td></tr>

      <!-- Ações -->
      <tr><td style="padding:22px 32px 6px;">${actions}</td></tr>

      <!-- Versículo -->
      <tr><td style="padding:14px 32px 6px;">
        <div style="border-top:1px solid ${C.line};padding-top:20px;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.6;color:${C.text};">${esc(topic.verse)}</div>
          <div style="margin-top:6px;font-size:13px;font-weight:700;color:${C.primary};">${esc(topic.ref)}</div>
        </div>
      </td></tr>

      <!-- Cuidado / LGPD -->
      <tr><td style="padding:20px 32px 28px;">
        <div style="background:#fff8e6;border:1px solid #f3e2b3;border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.6;color:#6b5418;">
          <strong>Trate com carinho e sigilo.</strong> Compartilhe esta mensagem apenas com a equipe pastoral ou com o círculo de oração.
          Ela não fica guardada no site: existe só neste e-mail. Pela LGPD, apague-o quando o atendimento terminar ou se a pessoa pedir.
        </div>
      </td></tr>
    </table>

    <!-- Rodapé -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="padding:18px 12px;text-align:center;font-size:12px;line-height:1.6;color:#8a93a6;">
        Enviado automaticamente pelo formulário do site<br>
        <a href="${SITE_URL}" style="color:#8a93a6;">${SITE_HOST}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `${topic.title}`,
    "",
    topic.intro,
    "",
    "MENSAGEM:",
    mensagem || "(sem texto)",
    "",
    `Nome: ${nome || "Preferiu não se identificar"}`,
    `Contato: ${contato || "Não informado"}`,
    `Assunto: ${tipo}`,
    `Recebido: ${quando}`,
    wa ? `\nResponder no WhatsApp: https://wa.me/${wa}` : "",
    "",
    `${topic.verse} (${topic.ref})`,
    "",
    "Trate com carinho e sigilo. Compartilhe só com a equipe pastoral ou com o círculo de oração. Pela LGPD, a mensagem é apagada automaticamente do site em até 12 meses.",
  ].join("\n");

  return { subject, html, text, replyTo: mail || undefined, attachments: [LOGO_ATTACHMENT] };
}
