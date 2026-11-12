// ============================================================
// Resumo semanal e alertas por e-mail — peças usadas por api/rotina/[tarefa].mjs
// (e pelas rotinas que anotam como foram: EBD, biblioteca, notícias da sede).
// ------------------------------------------------------------
// - lerPainel(): pede ao banco tudo o que entra no e-mail (rotina_painel,
//   protegida pela chave ROTINA_TOKEN, que nunca sai da Vercel).
// - registrarRotina(): anota se uma rotina deu certo (rotina_registrar).
//   Nunca derruba quem chama: se faltar a chave ou o banco recusar, só avisa no log.
// - problemas(): o que merece alerta (rotina falhando, YouTube parado, lição
//   de domingo sem conteúdo).
// - emailResumo() / emailAlerta(): os e-mails (HTML simples + texto puro).
//
// Para não cair no spam: remetente do domínio verificado no Resend (DKIM,
// SPF e DMARC), versão em texto puro, sem imagens nem anexos, sem links
// encurtados, assunto sem caixa alta e poucos emojis.
// ============================================================
import { rpc } from "./fonte.mjs";
import { SITE_URL, REMETENTE } from "./site.mjs";

const IGREJA = "AD Belém - Parque Artur Alvim";
const BIBLIOTECA = "Biblioteca dos Jovens";
const C = { navy: "#032154", primary: "#003399", bg: "#f2f4f9", text: "#1c2333", soft: "#5b6478", line: "#e3e7ef", ok: "#1f7a46", warn: "#b54708", bad: "#b42318", tint: "#eef2fb" };
const DIA_MS = 864e5;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const lista = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

// Quem recebe: RESUMO_PARA, ou quem libera o painel, ou a secretaria.
export const destinatarios = (env = process.env) => lista(env.RESUMO_PARA || env.ADMIN_APROVADORES || env.NOTIFY_TO);

/* ---------- Banco ---------- */
export async function lerPainel(chave = process.env.ROTINA_TOKEN) {
  if (!chave) throw Object.assign(new Error("Falta ROTINA_TOKEN na Vercel."), { status: 500 });
  try {
    return await rpc("rotina_painel", { p_key: chave });
  } catch (e) {
    if (e.missing) throw Object.assign(new Error("Falta rodar supabase/migrations/20261111120000_rotina_resumo_alertas.sql no Supabase."), { status: 503 });
    throw e;
  }
}

export async function registrarRotina(tarefa, ok, detalhe = "", chave = process.env.ROTINA_TOKEN) {
  if (!chave) return console.warn(`rotina: ROTINA_TOKEN ausente; "${tarefa}" não foi anotada.`);
  try {
    await rpc("rotina_registrar", { p_key: chave, p_tarefa: tarefa, p_ok: !!ok, p_detalhe: String(detalhe || "").slice(0, 500) });
  } catch (e) {
    console.warn(`rotina: não deu para anotar "${tarefa}":`, e.message);
  }
}

/* ---------- Datas ---------- */
const dia = (iso) => new Date(String(iso).slice(0, 10) + "T12:00:00Z");
export const dataCurta = (iso) => (iso ? dia(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).replace(".", "") : "");
const diaMes = (iso) => (iso ? dia(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }) : "");
const porExtenso = (iso) => dia(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const diaDaSemanaSP = (agora) => new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora) + "T12:00:00Z").getUTCDay();
const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* ---------- WhatsApp (as mesmas mensagens do painel da biblioteca) ---------- */
const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";
export function linkWhatsApp(telefone, texto) {
  let d = String(telefone || "").replace(/\D/g, "");
  if (d.length < 10) return "";
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
const oi = (nome) => `Olá, ${primeiroNome(nome)}! Aqui é da ${BIBLIOTECA} da ${IGREJA}.`;
const msgAtraso = (x) => `${oi(x.leitor)} O prazo do livro “${x.livro}” venceu em ${diaMes(x.vence)}. Consegue devolver no próximo culto? Obrigado!`;
const msgLembrete = (x) => `${oi(x.leitor)} Passando para lembrar que o livro “${x.livro}” vence em ${diaMes(x.vence)}. Você pode devolver no culto ou pedir renovação, se não houver fila. Deus abençoe!`;

/* ---------- O que merece alerta ---------- */
const ROTINAS = { ebd: "Importação das lições da EBD", biblioteca: "Atualização da biblioteca pela planilha", noticias: "Busca das notícias da sede" };
const VIDEO_PARADO_DIAS = 4; // a igreja transmite várias vezes por semana
const ROTINA_SUMIDA_H = 50; // rotinas diárias: mais de 2 dias sem rodar

export function problemas(p, agora = new Date()) {
  const out = [];
  for (const [tarefa, nome] of Object.entries(ROTINAS)) {
    const r = p?.rotinas?.[tarefa];
    if (!r) continue; // ainda não rodou desde que o alerta foi ligado
    if (!r.ok && r.falhas >= 2) out.push({ chave: `rotina-${tarefa}`, titulo: `${nome} está falhando`, texto: `Falhou ${r.falhas} vezes seguidas (a última em ${quando(r.em)}). ${r.detalhe || ""}`.trim() });
    else if (agora - new Date(r.em) > ROTINA_SUMIDA_H * 3600e3) out.push({ chave: `rotina-${tarefa}-parada`, titulo: `${nome} parou de rodar`, texto: `A última vez foi em ${quando(r.em)}.` });
  }
  if (p?.ultimo_video) {
    const dias = Math.floor((agora - new Date(p.ultimo_video)) / DIA_MS);
    if (dias >= VIDEO_PARADO_DIAS)
      out.push({ chave: "youtube", titulo: "Nenhum vídeo novo do YouTube", texto: `O último chegou há ${dias} dias (${quando(p.ultimo_video)}). Se houve transmissão nesse tempo, a busca automática do canal parou: no painel, Vídeos → Sincronizar agora.` });
  }
  // EBD: de quinta a sábado, cada revista precisa da lição de domingo publicada e com conteúdo.
  if ([4, 5, 6].includes(diaDaSemanaSP(agora))) {
    for (const revista of p?.ebd_revistas || []) {
      const l = (p.ebd || []).find((x) => x.revista === revista);
      const dom = diaMes(p.domingo);
      if (!l) out.push({ chave: `ebd-${revista}-falta`, titulo: `EBD ${revista}: lição de domingo (${dom}) não cadastrada`, texto: "No painel, EBD → Sincronizar agora, ou cadastre a lição à mão." });
      else if (!l.conteudo) out.push({ chave: `ebd-${revista}-vazia`, titulo: `EBD ${revista}: Lição ${l.numero} de domingo (${dom}) sem conteúdo`, texto: "Ainda não tem texto áureo nem resumo. No painel, EBD → Sincronizar agora." });
      else if (!l.publicada) out.push({ chave: `ebd-${revista}-rascunho`, titulo: `EBD ${revista}: Lição ${l.numero} de domingo (${dom}) não publicada`, texto: "Ela está pronta, mas ainda não aparece no site. No painel, EBD → revise e publique." });
    }
  }
  return out;
}
export const assinatura = (lista) => lista.map((x) => x.chave).sort().join("|");

/* ---------- HTML do e-mail (tabelas e estilos em linha: funciona no Gmail e no Outlook) ---------- */
const botao = (href, texto, cor = C.primary) =>
  `<a href="${esc(href)}" target="_blank" style="display:inline-block;background:${cor};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:11px 18px;border-radius:999px;">${texto}</a>`;
const linkPequeno = (href, texto) => (href ? ` <a href="${esc(href)}" target="_blank" style="color:${C.ok};font-weight:700;text-decoration:none;white-space:nowrap;">${texto}</a>` : "");
const secao = (titulo, corpo) =>
  `<tr><td style="padding:18px 28px 4px;"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.soft};margin-bottom:8px;">${titulo}</div>${corpo}</td></tr>`;
const itens = (linhas) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas.map((l) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};font-size:14px;line-height:1.5;color:${C.text};">${l}</td></tr>`).join("")}</table>`;
const caixa = (cor, html) => `<div style="background:${cor === "ok" ? "#ecf7f0" : "#fff6ed"};border-left:4px solid ${cor === "ok" ? C.ok : C.warn};border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.5;color:${C.text};">${html}</div>`;

function moldura({ titulo, subtitulo, corpo, rodape }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
    <tr><td style="background:${C.navy};padding:22px 28px;">
      <div style="color:#c9d6ea;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${esc(IGREJA)}</div>
      <div style="color:#ffffff;font-size:21px;font-weight:700;margin-top:4px;">${esc(titulo)}</div>
      <div style="color:#c9d6ea;font-size:14px;margin-top:4px;">${esc(subtitulo)}</div>
    </td></tr>
    ${corpo}
    <tr><td style="padding:22px 28px 8px;">${botao(`${SITE_URL}/admin`, "Abrir o painel do site")}</td></tr>
    <tr><td style="padding:12px 28px 24px;color:${C.soft};font-size:12px;line-height:1.6;">${rodape}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

const RODAPE_TEXTO = (oque) =>
  `${oque} Quem recebe: a variável RESUMO_PARA na Vercel (ou, sem ela, quem libera o painel). Para não cair no spam, adicione ${REMETENTE.replace(/^.*<|>$/g, "")} aos seus contatos.`;

/* ---------- Resumo da semana (segunda-feira) ---------- */
export function emailResumo(p, agora = new Date()) {
  const atencao = []; // [html, texto]
  const add = (html, texto) => atencao.push([html, texto]);
  const er = p.eventos_rascunho || [];
  if (er.length) add(`<strong>${er.length} evento(s) desativado(s)</strong> esperando conferência: ${er.map((e) => `${esc(e.nome)} (${diaMes(e.data)})`).join(", ")}. Confira e marque <em>Ativo</em> em Eventos.`, `${er.length} evento(s) desativado(s) esperando conferência: ${er.map((e) => `${e.nome} (${diaMes(e.data)})`).join(", ")}.`);
  const ss = p.sugestoes_sede || [];
  if (ss.length) add(`<strong>${ss.length} notícia(s) da sede</strong> esperando aprovação: ${ss.slice(0, 5).map((n) => esc(n.titulo)).join("; ")}${ss.length > 5 ? "…" : ""}. Em Notícias → Sugestões da sede.`, `${ss.length} notícia(s) da sede esperando aprovação: ${ss.slice(0, 5).map((n) => n.titulo).join("; ")}.`);
  const pb = p.pedidos_biblioteca || [];
  if (pb.length) add(`<strong>${pb.length} pedido(s) novo(s) na biblioteca</strong>: ${pb.map((x) => `${esc(primeiroNome(x.nome))} quer “${esc(x.livro)}”`).join("; ")}.`, `${pb.length} pedido(s) novo(s) na biblioteca: ${pb.map((x) => `${primeiroNome(x.nome)} quer "${x.livro}"`).join("; ")}.`);
  const la = p.livros_atrasados || [];
  if (la.length)
    add(
      `<strong>${la.length} livro(s) atrasado(s):</strong><br>${la.map((x) => `• “${esc(x.livro)}” com ${esc(x.leitor)}, venceu em ${diaMes(x.vence)}.${linkPequeno(linkWhatsApp(x.telefone, msgAtraso(x)), "Cobrar no WhatsApp")}`).join("<br>")}`,
      `${la.length} livro(s) atrasado(s):\n${la.map((x) => `  - "${x.livro}" com ${x.leitor}, venceu em ${diaMes(x.vence)}. ${linkWhatsApp(x.telefone, msgAtraso(x))}`).join("\n")}`,
    );
  const prob = problemas(p, agora);
  for (const x of prob) add(`<strong>${esc(x.titulo)}.</strong> ${esc(x.texto)}`, `${x.titulo}. ${x.texto}`);

  const ev = p.eventos || [];
  const av = p.avisos || [];
  const lv = p.livros_vencendo || [];
  const ebd = p.ebd || [];
  const revistas = p.ebd_revistas || [];

  let corpo = secao(
    "Precisa da sua atenção",
    atencao.length ? caixa("warn", atencao.map(([h]) => h).join("<br><br>")) : caixa("ok", "<strong>Tudo em dia.</strong> Nada esperando a equipe nesta semana."),
  );
  corpo += secao(
    "Esta semana na igreja",
    ev.length
      ? itens(ev.map((e) => `<strong>${esc(dataCurta(e.data))}${e.hora ? ` · ${esc(e.hora)}` : ""}</strong> — ${esc(e.nome)}${e.local ? `<span style="color:${C.soft};"> · ${esc(e.local)}</span>` : ""}`))
      : `<p style="margin:0;font-size:14px;color:${C.soft};">Nenhum evento cadastrado para os próximos 7 dias (os cultos de sempre não entram aqui).</p>`,
  );
  if (av.length) corpo += secao("Avisos no ar", itens(av.map((a) => `${esc(a.texto)}${a.ate ? `<span style="color:${C.soft};"> · até ${diaMes(a.ate)}</span>` : ""}`)));
  if (lv.length) corpo += secao("Biblioteca: vencem esta semana", itens(lv.map((x) => `“${esc(x.livro)}” com ${esc(x.leitor)} · vence ${esc(dataCurta(x.vence))}${linkPequeno(linkWhatsApp(x.telefone, msgLembrete(x)), "Lembrar no WhatsApp")}`)));
  if (revistas.length || ebd.length) {
    const linhas = revistas.map((r) => {
      const l = ebd.find((x) => x.revista === r);
      if (!l) return `<strong>${esc(r)}</strong> — <span style="color:${C.warn};">lição ainda não cadastrada</span>`;
      const st = !l.conteudo ? `<span style="color:${C.warn};">sem conteúdo</span>` : l.publicada ? `<span style="color:${C.ok};">publicada</span>` : `<span style="color:${C.warn};">não publicada</span>`;
      return `<strong>${esc(r)}</strong> — Lição ${l.numero}: ${esc(l.titulo)} · ${st}`;
    });
    corpo += secao(`EBD de domingo (${diaMes(p.domingo)})`, itens(linhas));
  }

  const subtitulo = `Semana de ${diaMes(p.hoje)} a ${diaMes(new Date(dia(p.hoje).getTime() + 6 * DIA_MS).toISOString())}`;
  const html = moldura({ titulo: "Resumo da semana do site", subtitulo, corpo, rodape: esc(RODAPE_TEXTO("E-mail automático do site, toda segunda de manhã.")) });

  const t = [];
  t.push(`Resumo da semana do site — ${IGREJA}`, subtitulo, "");
  t.push("PRECISA DA SUA ATENÇÃO");
  t.push(atencao.length ? atencao.map(([, x]) => `- ${x}`).join("\n") : "Tudo em dia. Nada esperando a equipe nesta semana.", "");
  t.push("ESTA SEMANA NA IGREJA");
  t.push(ev.length ? ev.map((e) => `- ${dataCurta(e.data)}${e.hora ? ` ${e.hora}` : ""}: ${e.nome}${e.local ? ` (${e.local})` : ""}`).join("\n") : "Nenhum evento cadastrado para os próximos 7 dias.", "");
  if (av.length) t.push("AVISOS NO AR", av.map((a) => `- ${a.texto}${a.ate ? ` (até ${diaMes(a.ate)})` : ""}`).join("\n"), "");
  if (lv.length) t.push("BIBLIOTECA: VENCEM ESTA SEMANA", lv.map((x) => `- "${x.livro}" com ${x.leitor}, vence ${dataCurta(x.vence)}. ${linkWhatsApp(x.telefone, msgLembrete(x))}`).join("\n"), "");
  if (revistas.length) t.push(`EBD DE DOMINGO (${diaMes(p.domingo)})`, revistas.map((r) => { const l = ebd.find((x) => x.revista === r); return `- ${r}: ${!l ? "lição ainda não cadastrada" : `Lição ${l.numero}: ${l.titulo} (${!l.conteudo ? "sem conteúdo" : l.publicada ? "publicada" : "não publicada"})`}`; }).join("\n"), "");
  t.push(`Abrir o painel: ${SITE_URL}/admin`, "", RODAPE_TEXTO("E-mail automático do site, toda segunda de manhã."));

  const pend = atencao.length;
  const subject = `Resumo da semana · ${diaMes(p.hoje)} · ${pend ? `${pend} ${pend === 1 ? "item pede" : "itens pedem"} atenção` : "tudo em dia"}`;
  return { subject, html, text: t.join("\n") };
}

/* ---------- Alerta (quando algo para de funcionar) ---------- */
export function emailAlerta(lista, { resolvido = false } = {}) {
  if (resolvido) {
    const corpo = secao("Tudo certo de novo", caixa("ok", "Os problemas avisados antes não aparecem mais. Nada a fazer."));
    return {
      subject: "Site da igreja: tudo voltou ao normal",
      html: moldura({ titulo: "Tudo voltou ao normal", subtitulo: "O site conferiu e está tudo funcionando", corpo, rodape: esc(RODAPE_TEXTO("Aviso automático do site.")) }),
      text: `Tudo voltou ao normal — ${IGREJA}\n\nOs problemas avisados antes não aparecem mais. Nada a fazer.\n\n${RODAPE_TEXTO("Aviso automático do site.")}`,
    };
  }
  const corpo = secao(
    lista.length === 1 ? "O que aconteceu" : `${lista.length} coisas precisam de atenção`,
    itens(lista.map((x) => `<strong style="color:${C.bad};">${esc(x.titulo)}</strong><br><span style="color:${C.soft};">${esc(x.texto)}</span>`)),
  );
  const rodape = RODAPE_TEXTO("Aviso automático do site. Ele confere tudo uma vez por dia e só manda de novo se algo mudar (ou depois de 3 dias, se continuar igual).");
  return {
    subject: `Site da igreja: ${lista.length === 1 ? lista[0].titulo : `${lista.length} itens precisam de atenção`}`,
    html: moldura({ titulo: "Aviso do site", subtitulo: "Alguma coisa automática parou de funcionar", corpo, rodape: esc(rodape) }),
    text: `Aviso do site — ${IGREJA}\n\n${lista.map((x) => `- ${x.titulo}\n  ${x.texto}`).join("\n\n")}\n\nAbrir o painel: ${SITE_URL}/admin\n\n${rodape}`,
  };
}

// Decide se manda alerta hoje: só quando a lista muda, ou depois de 3 dias igual.
export function decidirAlerta(lista, ultimo, agora = new Date()) {
  const sig = assinatura(lista);
  const antes = ultimo?.detalhe || "";
  if (!sig) return antes ? { enviar: true, resolvido: true, sig } : { enviar: false, sig };
  const velho = !ultimo || agora - new Date(ultimo.em) > 3 * DIA_MS;
  return sig !== antes || velho ? { enviar: true, resolvido: false, sig } : { enviar: false, sig };
}

/* ---------- Envio pelo Resend ---------- */
export async function enviarEmail({ to, subject, html, text }, { apiKey = process.env.RESEND_API_KEY, fetchImpl = fetch } = {}) {
  if (!apiKey) throw Object.assign(new Error("Falta RESEND_API_KEY na Vercel."), { status: 500 });
  if (!to?.length) throw Object.assign(new Error("Ninguém para receber: configure RESUMO_PARA (ou ADMIN_APROVADORES / NOTIFY_TO) na Vercel."), { status: 500 });
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ from: REMETENTE, to, subject, html, text, headers: { "X-Entity-Ref-ID": `rotina-${Date.now()}` } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw Object.assign(new Error(`O Resend recusou o e-mail (${res.status}): ${(await res.text()).slice(0, 200)}`), { status: 502 });
  return true;
}
