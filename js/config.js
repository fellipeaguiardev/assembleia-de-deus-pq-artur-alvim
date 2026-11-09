/* ============================================================
   CONFIGURAÇÃO — Supabase
   ------------------------------------------------------------
   A chave abaixo é a chave PUBLICÁVEL (sb_publishable_...).
   Ela foi feita para ficar no navegador: qualquer visitante
   consegue vê-la, e isso é esperado. Quem protege os dados são
   as regras RLS do banco (veja supabase/seguranca.sql).

   NUNCA coloque aqui a chave "secret" / "service_role".

   Rodando no computador (localhost), o arquivo js/config.local.json
   (fora do git) pode apontar para OUTRO projeto do Supabase, para testar
   sem mexer na produção. Modelo: js/config.local.example.json.
   Sem esse arquivo (ou apontando para a produção), o computador fica em
   MODO SÓ LEITURA: toda gravação é barrada aqui, antes de sair do
   navegador. Para gravar na produção a partir do computador, o arquivo
   precisa ter "PERMITIR_GRAVAR_PRODUCAO": true.
   ============================================================ */
window.APP_CONFIG = {
  // Endereço público do site (links de compartilhar, canonical, SEO). É o único
  // lugar dele no front: o scripts/publicar.sh troca pelo valor de SITE_URL
  // quando a variável é passada (veja "Trocar o domínio" no README).
  SITE_URL: "https://www.adbelemparquealvim.org.br",

  SUPABASE_URL: "https://rtludbkopxbhiwlwycid.supabase.co",
  SUPABASE_KEY: "sb_publishable_eRsl3xo3p7Qe_DanIB4Z7A_5V6Q0p9m",

  // Bucket do Storage onde ficam imagens, QR codes e áudios do podcast.
  STORAGE_BUCKET: "images",

  // Brasão padrão (usado quando "logoUrl" não estiver nas configurações).
  DEFAULT_LOGO: "/assets/img/brasao.svg", // brasão em vetor (o mesmo da abertura)

  // Estatísticas de visitas (Vercel Web Analytics, sem cookies). Vazio = desligado.
  // Precisa do Analytics ligado na Vercel (aba Analytics → Enable). Só roda no
  // endereço de SITE_URL, nunca no computador nem no painel (loadAnalytics em
  // js/core.js). Veja "Privacidade (LGPD)" no README.
  ANALYTICS_SCRIPT: "/_vercel/insights/script.js",

  // Versão publicada. O script de publicação troca "dev" pela data/hora do
  // envio (a mesma de /version.json e do cache do sw.js); o site compara as
  // duas para avisar quando há versão nova.
  VERSION: "dev",
};

// Banco de produção: qualquer outro projeto é tratado como ambiente de teste.
const PROD_SUPABASE_URL = "https://rtludbkopxbhiwlwycid.supabase.co";
const IS_LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

// Só no computador: lê js/config.local.json antes de criar o cliente do
// Supabase (leitura síncrona de propósito: tudo abaixo depende dela). Aceita
// só SUPABASE_URL, SUPABASE_KEY e PERMITIR_GRAVAR_PRODUCAO; no site
// publicado este trecho nem roda.
let permitirGravarProducao = false;
if (IS_LOCALHOST) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/js/config.local.json", false);
    xhr.send();
    if (xhr.status === 200 && /json/.test(xhr.getResponseHeader("Content-Type") || "")) {
      const local = JSON.parse(xhr.responseText);
      ["SUPABASE_URL", "SUPABASE_KEY"].forEach((k) => {
        if (typeof local[k] === "string" && local[k].trim()) window.APP_CONFIG[k] = local[k].trim();
      });
      permitirGravarProducao = local.PERMITIR_GRAVAR_PRODUCAO === true;
    }
  } catch (e) {
    console.warn("js/config.local.json ignorado:", e.message);
  }
}

// Computador + banco de produção + sem a permissão explícita = só leitura.
const LOCAL_READONLY = IS_LOCALHOST && window.APP_CONFIG.SUPABASE_URL === PROD_SUPABASE_URL && !permitirGravarProducao;

// Faixa de aviso fora da produção: banco de teste (amarela) ou o computador
// ligado ao banco de produção (vermelha: só leitura, ou gravando de verdade
// quando o config.local.json permite). No site publicado, nada aparece.
(function avisoAmbiente() {
  const teste = window.APP_CONFIG.SUPABASE_URL !== PROD_SUPABASE_URL;
  if (!teste && !IS_LOCALHOST) return;
  let ref = "";
  try {
    ref = new URL(window.APP_CONFIG.SUPABASE_URL).hostname.split(".")[0];
  } catch {}
  const mostrar = () => {
    const faixa = document.createElement("div");
    faixa.className = "env-banner" + (teste ? "" : " is-prod");
    faixa.setAttribute("role", "status");
    faixa.textContent = teste
      ? `AMBIENTE DE TESTE · banco ${ref}`
      : LOCAL_READONLY
        ? "COMPUTADOR NO BANCO DE PRODUÇÃO · SÓ LEITURA"
        : "ATENÇÃO: COMPUTADOR GRAVANDO NO BANCO DE PRODUÇÃO";
    document.body.appendChild(faixa);
  };
  if (document.body) mostrar();
  else document.addEventListener("DOMContentLoaded", mostrar);
})();

/* ---------- Modo só leitura no computador ----------
   Barra toda gravação antes de sair do navegador: insert/update/delete no
   Supabase, envio de arquivos, funções do Supabase, RPCs que gravam e as
   funções de api/ que mexem em dados ou mandam e-mail. Continuam: o login
   (Supabase Auth), as consultas, as RPCs que só leem e a liberação do painel
   por e-mail (/api/admin-acesso e /api/admin-aprovar). */
const READ_ONLY_RPCS = ["admin_session_status", "is_site_admin", "library_status"];

function localWriteBlocked(url, method) {
  if (!LOCAL_READONLY || ["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase())) return false;
  let u;
  try {
    u = new URL(url, location.href);
  } catch {
    return false;
  }
  if (u.origin === new URL(PROD_SUPABASE_URL).origin) {
    if (u.pathname.startsWith("/auth/v1/")) return false;
    const rpc = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)/);
    return !(rpc && READ_ONLY_RPCS.includes(rpc[1]));
  }
  if (u.origin === location.origin && u.pathname.startsWith("/api/")) return !/^\/api\/admin-(acesso|aprovar)\b/.test(u.pathname);
  return false;
}

const nativeFetch = window.fetch.bind(window);
function guardedFetch(input, init = {}) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const method = init.method || (input instanceof Request ? input.method : "GET");
  if (localWriteBlocked(url, method)) {
    console.warn("[só leitura] gravação barrada antes de chegar na produção:", method, url);
    const msg = "Computador em modo só leitura: nada foi gravado na produção (veja “Rodar localmente” no README).";
    if (typeof showToast === "function") setTimeout(() => showToast(msg, "error"), 0);
    return Promise.resolve(new Response(JSON.stringify({ message: msg, code: "LOCAL_READONLY" }), { status: 403, headers: { "Content-Type": "application/json" } }));
  }
  return nativeFetch(input, init);
}
if (LOCAL_READONLY) window.fetch = guardedFetch;

const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_KEY,
  LOCAL_READONLY ? { global: { fetch: guardedFetch } } : undefined,
);
