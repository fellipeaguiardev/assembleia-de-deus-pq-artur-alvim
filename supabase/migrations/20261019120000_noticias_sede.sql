-- ============================================================
-- NOTÍCIAS DA AD BELÉM – SEDE → sugestões no painel
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga nada.
--
-- O que faz:
--  1. A tabela news ganha 4 colunas, vazias nas notícias da equipe:
--     source_id   id da notícia no site da sede (único: não duplica);
--     source_url  link para ler a notícia completa lá (só https://ad.org.br/);
--     source_name "AD Belém – Sede";
--     dismissed   descartada pela equipe (some do painel e não volta).
--  2. Chave do servidor: no banco fica só o SHA-256; a chave mesmo é a
--     variável NEWS_SYNC_TOKEN da Vercel (api/noticias-sede.mjs).
--  3. news_sede_apply(chave, linhas): grava as notícias novas como NÃO
--     publicadas (sugestão). Valida tudo o que chega (link só da sede, data
--     dos últimos 60 dias, tamanhos), nunca mexe no que já existe e nunca
--     publica. O visitante continua vendo só published = true (RLS).
-- Só título, data, resumo curto e link são guardados: o texto completo e as
-- fotos ficam no site da sede (direito autoral).
-- ============================================================

-- ---------- 1) Colunas ----------
alter table public.news add column if not exists source_id text;
alter table public.news add column if not exists source_url text;
alter table public.news add column if not exists source_name text;
alter table public.news add column if not exists dismissed boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'news_source_id_key') then
    alter table public.news add constraint news_source_id_key unique (source_id);
  end if;
end $$;
alter table public.news drop constraint if exists news_source_url_check;
alter table public.news add constraint news_source_url_check
  check (source_url is null or source_url ~ '^https://ad\.org\.br/');

-- ---------- 2) Chave do servidor (só o hash) ----------
create schema if not exists private;
create table if not exists private.news_sync_key (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);
insert into private.news_sync_key (id, key_hash)
values (1, '3dcfeb70542009c01bace431b23243b402915a61c28bef2cc9368777aee87478')
on conflict (id) do update set key_hash = excluded.key_hash;
revoke all on table private.news_sync_key from public, anon, authenticated, service_role;

create or replace function private.news_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(char_length(p_key) >= 32, false)
     and exists (select 1 from private.news_sync_key k
                  where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$$;
revoke all on function private.news_key_ok(text) from public, anon, authenticated, service_role;

-- ---------- 3) Gravar as sugestões ----------
create or replace function public.news_sede_apply(p_key text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       jsonb;
  v_sid   text;
  v_title text;
  v_sum   text;
  v_url   text;
  v_slug  text;
  v_date  date;
  novas   jsonb := '[]';
begin
  if not private.news_key_ok(p_key) then
    raise exception 'NEWS_CHAVE' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 60 then
    raise exception 'NEWS_DADOS';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_sid   := left(coalesce(r->>'source_id', ''), 40);
    v_title := left(btrim(coalesce(r->>'title', '')), 300);
    v_sum   := left(btrim(coalesce(r->>'summary', '')), 600);
    v_url   := coalesce(r->>'url', '');
    v_slug  := coalesce(r->>'slug', '');
    begin
      v_date := (r->>'date')::date;
    exception when others then
      v_date := null;
    end;
    -- Só o que vem certinho da sede; data = dia em que a sede publicou.
    continue when v_sid !~ '^adbelem:[0-9]{1,12}$'
      or v_title = ''
      or char_length(v_url) > 500 or v_url !~ '^https://ad\.org\.br/[^[:space:]"<>]*$'
      or v_slug !~ '^[a-z0-9-]{3,120}$'
      or v_date is null or v_date < current_date - 60 or v_date > current_date + 1;
    -- Já existe (publicada, sugerida ou descartada): não mexe.
    continue when exists (select 1 from public.news n where n.source_id = v_sid);
    if exists (select 1 from public.news n where n.slug = v_slug) then
      v_slug := left(v_slug, 110) || '-' || left(md5(v_sid), 6);
    end if;
    insert into public.news (title, slug, summary, content, cover_image, published_at, author,
                             featured, published, source_id, source_url, source_name)
    values (v_title, v_slug, v_sum, '', '', (v_date::text || 'T00:00:00Z')::timestamptz, 'AD Belém – Sede',
            false, false, v_sid, v_url, 'AD Belém – Sede')
    on conflict do nothing;
    if found then
      novas := novas || to_jsonb(v_title);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'novas', novas);
end;
$$;
revoke all on function public.news_sede_apply(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.news_sede_apply(text, jsonb) to anon, authenticated, service_role;

-- ---------- Conferir ----------
select 'colunas novas em news' as item,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'news'
           and column_name in ('source_id', 'source_url', 'source_name', 'dismissed'))::text as valor
union all
select 'chave do servidor', (select count(*) from private.news_sync_key)::text
union all
select 'função news_sede_apply', (to_regprocedure('public.news_sede_apply(text,jsonb)') is not null)::text;
