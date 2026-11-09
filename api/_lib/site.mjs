// ============================================================
// Endereço público do site — o único lugar das funções de api/.
// Vem da variável SITE_URL (Vercel → Settings → Environment Variables,
// ou passada pelo scripts/publicar.sh). Sem ela, usa o domínio da igreja (PADRAO).
// Veja "Trocar o domínio" no README.
// ============================================================
const PADRAO = "https://www.adbelemparquealvim.org.br";

// Aceita só "https://dominio" (sem caminho); qualquer outra coisa volta ao padrão.
function lerEndereco(valor) {
  if (!valor) return PADRAO;
  try {
    const u = new URL(String(valor).trim());
    if (u.protocol === "https:" && !u.pathname.replace(/\/+$/, "")) return u.origin;
  } catch {}
  console.warn("SITE_URL inválida (use https://dominio, sem caminho); usando", PADRAO);
  return PADRAO;
}

export const SITE_URL = lerEndereco(process.env.SITE_URL);
export const SITE_HOST = new URL(SITE_URL).host;

// Pedido vindo de outro site? O navegador manda o cabeçalho Origin em todo
// POST. "null" (alguns modos privados, iframe isolado) ou um valor que nem é
// endereço contam como de fora (403), em vez de derrubar a função com erro
// 500. aceitaNull: para o formulário da página do e-mail (admin-aprovar), que
// alguns navegadores enviam com Origin "null".
export function origemDeFora(request, { aceitaNull = false } = {}) {
  const origin = request.headers.get("origin");
  if (!origin || (aceitaNull && origin === "null")) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}
