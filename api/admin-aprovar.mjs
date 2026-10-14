// ============================================================
// /api/admin-aprovar — a página que o link do e-mail abre
// ------------------------------------------------------------
// GET  ?t=...            mostra quem entrou e os botões (não decide nada:
//                        robôs de e-mail que "abrem" links não liberam acesso)
// POST t=...&acao=...    decide: liberar (12 h) ou "não fui eu"
// ============================================================
import { rpc, sha256, esc, page, when } from "./_lib/acesso.mjs";

const tokenOk = (t) => /^[A-Za-z0-9_-]{40,64}$/.test(String(t || ""));
const voltar = `<a class="link" href="/admin">Abrir o painel</a>`;

function details(r) {
  const local = [r.info?.cidade, r.info?.pais].filter(Boolean).join(", ") || "não identificado";
  return `<dl>
    <dt>Conta</dt><dd>${esc(r.email)}</dd>
    <dt>Quando</dt><dd>${esc(when(r.created_at))}</dd>
    <dt>Aparelho</dt><dd>${esc(r.info?.aparelho || "não identificado")}</dd>
    <dt>Local aproximado</dt><dd>${esc(local)}</dd>
  </dl>`;
}

const already = {
  permitido: ["Acesso já liberado", "Este acesso já foi liberado. Se não foi você, troque a senha do painel."],
  negado: ["Acesso bloqueado", "Este acesso já foi bloqueado."],
  expirado: ["Link vencido", "Este link passou de 20 minutos. Entre de novo no painel para receber outro e-mail."],
  nao_encontrado: ["Link inválido", "Este pedido não existe mais (os pedidos são apagados depois de 30 dias)."],
};

export async function GET(request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t");
  const key = process.env.ADMIN_ACCESS_TOKEN;
  if (!tokenOk(t) || !key) return page("Link inválido", `<h1>Link inválido</h1><p>Confira se o link do e-mail veio completo.</p>`, 400);
  let r;
  try {
    r = await rpc("admin_access_peek", { p_key: key, p_token_hash: sha256(t) });
  } catch {
    return page("Indisponível", `<h1>Não foi possível abrir agora</h1><p>Tente de novo em instantes.</p>`, 502);
  }
  if (!r?.ok) return page("Link inválido", `<h1>Link inválido</h1><p>Este pedido não existe mais.</p>`, 404);
  if (r.status !== "pendente") {
    const [h, p] = already[r.status] || already.expirado;
    return page(h, `<h1>${h}</h1><p>${p}</p>${details(r)}${voltar}`);
  }
  const negar = url.searchParams.get("acao") === "negar";
  return page(
    "Confirmar acesso",
    `<h1>Alguém entrou no painel</h1>
    <p>Confira os dados. Se foi você ou alguém da equipe, libere o acesso.</p>
    ${details(r)}
    <form class="acoes" method="post" action="/api/admin-aprovar">
      <input type="hidden" name="t" value="${esc(t)}">
      <button class="ok${negar ? "" : " destaque"}" name="acao" value="liberar" type="submit">✅ Sim, liberar acesso</button>
      <button class="bad${negar ? " destaque" : ""}" name="acao" value="negar" type="submit">⛔ Não fui eu — bloquear</button>
    </form>`,
  );
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null" && new URL(origin).host !== new URL(request.url).host) return page("Não permitido", `<h1>Não permitido</h1>`, 403);
  const form = new URLSearchParams(await request.text().catch(() => ""));
  const t = form.get("t");
  const acao = form.get("acao");
  const key = process.env.ADMIN_ACCESS_TOKEN;
  if (!tokenOk(t) || !["liberar", "negar"].includes(acao) || !key) return page("Pedido inválido", `<h1>Pedido inválido</h1>`, 400);
  let r;
  try {
    r = await rpc("admin_access_decide", { p_key: key, p_token_hash: sha256(t), p_allow: acao === "liberar" });
  } catch {
    return page("Indisponível", `<h1>Não foi possível registrar agora</h1><p>Tente de novo em instantes.</p>`, 502);
  }
  if (!r?.ok) {
    const [h, p] = already[r?.status] || already[r?.motivo] || already.expirado;
    return page(h, `<h1>${h}</h1><p>${p}</p>${voltar}`);
  }
  if (r.status === "permitido") {
    return page("Acesso liberado", `<h1>✅ Acesso liberado</h1><p>A tela do painel continua sozinha em alguns segundos. O acesso vale por 12 horas.</p>${voltar}`);
  }
  console.warn("admin-aprovar: acesso BLOQUEADO pelo dono da conta");
  return page(
    "Acesso bloqueado",
    `<h1>⛔ Acesso bloqueado</h1>
    <p>Essa entrada no painel não consegue gravar nada no site.</p>
    <p>Alguém tem a senha da conta <strong>${esc(r.email || "do painel")}</strong>. <strong>Troque a senha agora</strong>: no Supabase, em
    Authentication → Users → (a conta) → “Send password recovery”, ou peça ao responsável pelo site.</p>`,
  );
}
