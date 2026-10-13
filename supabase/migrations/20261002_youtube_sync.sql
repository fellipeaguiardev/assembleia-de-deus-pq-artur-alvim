-- ============================================================
-- Sincronização automática do YouTube → tabela "videos"
-- ============================================================

-- 1) Novas colunas
alter table public.videos add column if not exists youtube_id text;
alter table public.videos add column if not exists source text not null default 'manual'; -- 'manual' | 'auto'
alter table public.videos add column if not exists hidden boolean not null default false;  -- ocultar sem apagar

-- 2) Preenche youtube_id dos vídeos já cadastrados a partir do link
update public.videos
set youtube_id = substring(youtube_url from '(?:youtu\.be/|[?&]v=|/embed/|/live/|/shorts/)([A-Za-z0-9_-]{11})')
where youtube_id is null and youtube_url is not null;

-- 3) Um mesmo vídeo do YouTube não entra duas vezes
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'videos_youtube_id_key') then
    alter table public.videos add constraint videos_youtube_id_key unique (youtube_id);
  end if;
end $$;

-- 4) Agendamento: chama a Edge Function a cada 10 minutos.
--    O token é a chave "anon" (pública, a mesma que pode ficar no navegador);
--    ele só serve para passar na verificação de JWT da função.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sync-youtube') where exists (select 1 from cron.job where jobname = 'sync-youtube');
select cron.schedule(
  'sync-youtube',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://rtludbkopxbhiwlwycid.supabase.co/functions/v1/sync-youtube',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bHVkYmtvcHhiaGl3bHd5Y2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjI1MTcsImV4cCI6MjEwMTkzODUxN30.o2gnYfLPN-4IweHm2hGKh4OTWgYHaLkotQT7fKlCouE'
       ),
       body := '{}'::jsonb
     ); $$
);
