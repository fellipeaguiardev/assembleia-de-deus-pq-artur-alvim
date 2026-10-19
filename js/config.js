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
   ============================================================ */
window.APP_CONFIG = {
  // Endereço público do site (links de compartilhar, canonical, SEO). É o único
  // lugar dele no front: o scripts/publicar.sh troca pelo valor de SITE_URL
  // quando a variável é passada (veja "Trocar o domínio" no README).
  SITE_URL: "https://assembleia-de-deus-pq-artur-alvim.vercel.app",

  SUPABASE_URL: "https://rtludbkopxbhiwlwycid.supabase.co",
  SUPABASE_KEY: "sb_publishable_eRsl3xo3p7Qe_DanIB4Z7A_5V6Q0p9m",

  // Bucket do Storage onde ficam imagens, QR codes e áudios do podcast.
  STORAGE_BUCKET: "images",

  // Brasão padrão (usado quando "logoUrl" não estiver nas configurações).
  DEFAULT_LOGO: "/assets/img/brasao.svg", // brasão em vetor (o mesmo da abertura)

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
// só SUPABASE_URL e SUPABASE_KEY; no site publicado este trecho nem roda.
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
    }
  } catch (e) {
    console.warn("js/config.local.json ignorado:", e.message);
  }
}

// Faixa de aviso fora da produção: banco de teste (amarela) ou o computador
// ligado ao banco de produção (vermelha). No site publicado com o banco de
// produção, nada aparece.
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
    faixa.textContent = teste ? `AMBIENTE DE TESTE · banco ${ref}` : "COMPUTADOR LIGADO AO BANCO DE PRODUÇÃO";
    document.body.appendChild(faixa);
  };
  if (document.body) mostrar();
  else document.addEventListener("DOMContentLoaded", mostrar);
})();

const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_KEY,
);
