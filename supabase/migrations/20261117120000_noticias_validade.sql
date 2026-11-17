-- ============================================================
-- NOTÍCIAS COM VALIDADE: saem do site sozinhas
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga nada.
--
-- O que faz:
--  1. news.expires_at (data): o ÚLTIMO dia em que a notícia aparece no site
--     (Painel → Notícias → "Fica no site até"). Vazio = 1 semana depois da
--     data da notícia (pedido da equipe em 17/11/2026).
--  2. A regra de leitura dos visitantes passa a esconder as vencidas. A
--     notícia NÃO é apagada: continua no painel como "Expirada" (a equipe vê
--     tudo pela regra "Site admin gerencia") e volta ao site se ganhar uma
--     data nova.
-- A data da notícia (published_at) é gravada como o dia em UTC (00:00Z), por
-- isso a conta usa "at time zone 'UTC'"; o "hoje" é o de Brasília.
-- ============================================================

alter table public.news add column if not exists expires_at date;

drop policy if exists "Public can read published news" on public.news;
create policy "Public can read published news" on public.news
  for select to public
  using (
    published = true
    and coalesce(expires_at, (published_at at time zone 'UTC')::date + 7)
        >= (now() at time zone 'America/Sao_Paulo')::date
  );

-- ---------- Conferir ----------
select 'coluna expires_at' as item,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'news' and column_name = 'expires_at')::text as valor
union all
select 'notícias que continuam no site',
       (select count(*) from public.news
         where published = true
           and coalesce(expires_at, (published_at at time zone 'UTC')::date + 7)
               >= (now() at time zone 'America/Sao_Paulo')::date)::text
union all
select 'notícias que saem do site (ficam no painel)',
       (select count(*) from public.news
         where published = true
           and coalesce(expires_at, (published_at at time zone 'UTC')::date + 7)
               < (now() at time zone 'America/Sao_Paulo')::date)::text;
