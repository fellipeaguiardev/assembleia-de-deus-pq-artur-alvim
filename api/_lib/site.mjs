// ============================================================
// Endereço público do site — o único lugar das funções de api/.
// Vem da variável SITE_URL (Vercel → Settings → Environment Variables,
// ou passada pelo scripts/publicar.sh). Sem ela, usa o endereço da Vercel.
// Veja "Trocar o domínio" no README.
// ============================================================
const PADRAO = "https://assembleia-de-deus-pq-artur-alvim.vercel.app";

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
