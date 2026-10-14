/* ============================================================
   CONFIGURAÇÃO — Supabase
   ------------------------------------------------------------
   A chave abaixo é a chave PUBLICÁVEL (sb_publishable_...).
   Ela foi feita para ficar no navegador: qualquer visitante
   consegue vê-la, e isso é esperado. Quem protege os dados são
   as regras RLS do banco (veja supabase/seguranca.sql).

   NUNCA coloque aqui a chave "secret" / "service_role".
   ============================================================ */
window.APP_CONFIG = {
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

const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_KEY,
);
