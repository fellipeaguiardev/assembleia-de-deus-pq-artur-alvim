-- ============================================================
-- PENDENTE — agendamento da função sync-youtube com segredo
-- (substitui 20261010_youtube_sync_auth.sql, que nunca foi rodado)
-- ------------------------------------------------------------
-- A nova versão da função (supabase/functions/sync-youtube/index.ts) só
-- aceita duas chamadas:
--   - o agendamento abaixo, com o header x-cron-secret = CRON_SECRET;
--   - um admin com a entrada liberada no painel (public.is_admin()).
-- Sem o segredo configurado, ela recusa o agendamento: por isso a ordem
-- dos passos importa. Nesta ordem o YouTube continua sincronizando o tempo
-- todo (a versão que está no ar hoje ignora o header):
--
--  (A CLI do Supabase não precisa ser instalada: "npx supabase …" baixa
--   na hora. Uma vez só: npx supabase login, que abre o navegador.)
--  1. Gere um segredo aleatório (Git Bash):   openssl rand -hex 32
--  2. Guarde no Supabase:   npx supabase secrets set CRON_SECRET=<segredo> --project-ref rtludbkopxbhiwlwycid
--     (ou Dashboard → Edge Functions → Secrets → Add new secret)
--     Confira com:  npx supabase secrets list --project-ref rtludbkopxbhiwlwycid
--  3. Cole ESTE arquivo no SQL Editor, troque '<CRON_SECRET>' (linha
--     "segredo text := ...") pelo mesmo segredo e rode. Troque só na cópia
--     colada no editor: o segredo não vai para o repositório. Se esquecer,
--     o bloco para com erro sem mexer no agendamento.
--  4. Publique a função (na pasta do projeto; --use-api dispensa o Docker):
--     npx supabase functions deploy sync-youtube --project-ref rtludbkopxbhiwlwycid --use-api
--  5. Confira (passos no fim do arquivo).
--
-- O Authorization abaixo é a chave pública antiga (anon, JWT): o Supabase
-- exige um JWT para chamar a função. Ela é pública por natureza; quem
-- protege agora é o x-cron-secret.
-- ============================================================
do $$
declare
  segredo text := '<CRON_SECRET>';  -- ← troque aqui (só na cópia colada no SQL Editor)
begin
  -- Trava: sem o segredo de verdade, não mexe em nada.
  if segredo like '<%' or length(segredo) < 32 then
    raise exception 'Troque <CRON_SECRET> pelo segredo do passo 2 antes de rodar.';
  end if;

  perform cron.unschedule('sync-youtube') where exists (select 1 from cron.job where jobname = 'sync-youtube');
  perform cron.schedule(
    'sync-youtube',
    '*/10 * * * *',
    format($cmd$ select net.http_post(
         url := 'https://rtludbkopxbhiwlwycid.supabase.co/functions/v1/sync-youtube',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bHVkYmtvcHhiaGl3bHd5Y2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjI1MTcsImV4cCI6MjEwMTkzODUxN30.o2gnYfLPN-4IweHm2hGKh4OTWgYHaLkotQT7fKlCouE',
           'x-cron-secret', %L
         ),
         body := '{}'::jsonb
       ); $cmd$, segredo)
  );
end $$;

-- ------------------------------------------------------------
-- Conferir (rode separado, uns 10 minutos depois do passo 4):
--
--   select status_code, left(content::text, 120), created
--     from net._http_response order by created desc limit 5;
--   → 200 com {"ok":true,...}. Se aparecer 401, o segredo do passo 3 não
--     é o mesmo do passo 2. Um 500 "Feed do YouTube respondeu …" quer dizer
--     que a autorização passou e o problema é o feed do próprio YouTube.
--
-- No painel, Vídeos → "Sincronizar agora" continua funcionando para quem
-- entrou com a liberação por e-mail.
-- ============================================================
