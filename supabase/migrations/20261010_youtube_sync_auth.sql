-- ============================================================
-- PENDENTE — protege a função sync-youtube contra chamadas de visitantes
-- ------------------------------------------------------------
-- Passos (nesta ordem):
--  1. Gere um segredo aleatório, ex.: openssl rand -hex 24
--  2. supabase secrets set CRON_SECRET=<segredo>
--  3. Publique a nova versão: supabase functions deploy sync-youtube
--  4. Rode este SQL trocando <CRON_SECRET> pelo mesmo segredo.
-- O botão "Sincronizar agora" do painel continua funcionando (usa o login do admin).
-- ============================================================
select cron.unschedule('sync-youtube') where exists (select 1 from cron.job where jobname = 'sync-youtube');
select cron.schedule(
  'sync-youtube',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://rtludbkopxbhiwlwycid.supabase.co/functions/v1/sync-youtube',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bHVkYmtvcHhiaGl3bHd5Y2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjI1MTcsImV4cCI6MjEwMTkzODUxN30.o2gnYfLPN-4IweHm2hGKh4OTWgYHaLkotQT7fKlCouE',
         'x-cron-secret', '<CRON_SECRET>'
       ),
       body := '{}'::jsonb
     ); $$
);
