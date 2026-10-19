-- ============================================================
-- BASELINE — estrutura completa do banco, SEM dados
-- ------------------------------------------------------------
-- Gerado em 19/10/2026 a partir do banco de produção (projeto
-- rtludbkopxbhiwlwycid), lendo o catálogo do Postgres: o texto das funções,
-- políticas, restrições e permissões é o mesmo de lá.
--
-- Para quê: recriar o banco do site num projeto Supabase NOVO e vazio
-- (ambiente de teste, recuperação de desastre). Passo a passo no README,
-- seção "Recriar o banco do zero".
--
-- NÃO rode na produção. O arquivo roda numa transação só e o primeiro
-- comando de verdade (create schema private) falha num banco que já tem o
-- site: nada é aplicado.
--
-- Inclui: extensões, schema private, as 24 tabelas (19 em public, 5 em
-- private), chaves, restrições e índices, as 23 funções, triggers, RLS e
-- políticas, permissões por tabela, coluna e função, o bucket "images" e
-- suas políticas, e os agendamentos do pg_cron.
-- Não inclui: dados (cultos, eventos, livros, admins…), contas do Auth,
-- arquivos do Storage, segredos das Edge Functions e as configurações do
-- painel do Supabase (Auth → URL Configuration, cadastro público desligado).
-- Segredos: aparecem como <...> nos blocos 10 e 11; troque só na cópia
-- colada no SQL Editor (ou deixe para depois: sem eles, nada fica aberto).
--
-- Diferença intencional em relação à produção: as políticas de podcasts
-- (bloco 6), já na regra de todas as outras tabelas; a produção é corrigida
-- por 20261019_podcasts_admin.sql.
--
-- Num banco criado por este arquivo, as migrations com data (20261002_… em
-- diante) NÃO precisam ser rodadas: o que elas fazem já está aqui.
-- ============================================================
begin;

set check_function_bodies = off; -- as funções citam umas às outras; a ordem não importa

-- ------------------------------------------------------------
-- 1) Extensões e schema privado
--    (pgcrypto, uuid-ossp, pg_stat_statements e supabase_vault já vêm
--    ligadas em todo projeto novo do Supabase)
-- ------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Tabelas e funções que nenhum papel da API (anon, authenticated) enxerga.
create schema private;

-- ------------------------------------------------------------
-- 2) Tabelas (colunas e valores padrão; restrições na parte 3)
-- ------------------------------------------------------------
create table private.admin_access (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  session_id uuid not null,
  token_hash text not null,
  status text default 'pendente'::text not null,
  info jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  decided_at timestamp with time zone,
  approved_until timestamp with time zone
);

create table private.admin_access_key (
  id integer default 1 not null,
  key_hash text not null,
  updated_at timestamp with time zone default now() not null
);

create table private.ebd_sync_key (
  id integer default 1 not null,
  token_hash text not null,
  updated_at timestamp with time zone default now() not null
);

create table private.library_sync_key (
  id integer default 1 not null,
  key_hash text not null
);

create table private.library_sync_state (
  id integer default 1 not null,
  last_at timestamp with time zone,
  summary jsonb default '{}'::jsonb not null
);

create table public.admins (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.announcements (
  id uuid default gen_random_uuid() not null,
  text text not null,
  priority text,
  color text,
  link text,
  start_date date,
  end_date date,
  created_at timestamp with time zone default now()
);

create table public.donation_types (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  description text default ''::text,
  pix_key text default ''::text,
  pix_name text default ''::text,
  pix_city text default 'SAO PAULO'::text,
  cnpj text default ''::text,
  qr_image text default ''::text,
  active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  qr_code_url text
);

create table public.ebd_lessons (
  id uuid default gen_random_uuid() not null,
  quarter_id uuid not null,
  number integer not null,
  lesson_date date not null,
  title text default ''::text not null,
  golden_ref text default ''::text not null,
  reading_ref text default ''::text not null,
  daily_refs text[] default '{}'::text[] not null,
  key_idea text default ''::text not null,
  summary text default ''::text not null,
  questions jsonb default '[]'::jsonb not null,
  links jsonb default '[]'::jsonb not null,
  source_url text default ''::text not null,
  status text default 'rascunho'::text not null,
  publish_at timestamp with time zone,
  reviewed_by text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.ebd_quarters (
  id uuid default gen_random_uuid() not null,
  year integer not null,
  quarter integer not null,
  magazine text default 'Adultos'::text not null,
  magazine_slug text default 'adultos'::text not null,
  theme text default ''::text not null,
  commentator text default ''::text not null,
  publisher text default 'CPAD'::text not null,
  source_url text default ''::text not null,
  start_date date not null,
  lesson_count integer default 13 not null,
  visible boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.events (
  id uuid default gen_random_uuid() not null,
  name text not null,
  date date not null,
  "time" text,
  location text,
  address text,
  description text,
  image text,
  category text,
  link text,
  maps_url text,
  active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.library_books (
  id uuid default gen_random_uuid() not null,
  title text not null,
  author text default ''::text not null,
  category text default ''::text not null,
  synopsis text default ''::text not null,
  cover_url text default ''::text not null,
  owner text default ''::text not null,
  notes text default ''::text not null,
  visible boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  sheet_key text
);

create table public.library_covers (
  book_id uuid not null,
  mime text not null,
  data bytea not null,
  source text default 'planilha'::text not null,
  updated_at timestamp with time zone default now() not null
);

create table public.library_loans (
  id uuid default gen_random_uuid() not null,
  book_id uuid not null,
  reader_id uuid not null,
  loaned_on date default CURRENT_DATE not null,
  due_on date not null,
  returned_on date,
  renewals integer default 0 not null,
  notes text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.library_readers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  phone text default ''::text not null,
  notes text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.library_requests (
  id uuid default gen_random_uuid() not null,
  book_id uuid not null,
  kind text default 'fila'::text not null,
  name text not null,
  phone text default ''::text not null,
  message text default ''::text not null,
  status text default 'novo'::text not null,
  source text default 'site'::text not null,
  reader_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.ministries (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  image text,
  responsible text,
  instagram text,
  whatsapp text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.ministry_images (
  id uuid default gen_random_uuid() not null,
  ministry_id uuid not null,
  image_url text not null,
  caption text default ''::text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table public.news (
  id uuid default gen_random_uuid() not null,
  title text not null,
  slug text not null,
  summary text default ''::text,
  content text default ''::text,
  cover_image text default ''::text,
  published_at timestamp with time zone default now(),
  author text default ''::text,
  featured boolean default false not null,
  published boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.podcasts (
  id uuid default gen_random_uuid() not null,
  title text not null,
  description text default ''::text not null,
  episode_number integer not null,
  cover_url text default ''::text not null,
  audio_url text default ''::text not null,
  spotify_url text default ''::text not null,
  youtube_url text default ''::text not null,
  published_at timestamp with time zone,
  status text default 'Rascunho'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.services (
  id uuid default gen_random_uuid() not null,
  day text not null,
  items jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now()
);

create table public.settings (
  id text default 'main'::text not null,
  data jsonb default '{}'::jsonb not null
);

create table public.site_settings (
  id text default 'main'::text not null,
  theme jsonb default '{}'::jsonb not null,
  church jsonb default '{}'::jsonb not null,
  hero jsonb default '{}'::jsonb not null,
  home_sections jsonb default '[]'::jsonb not null,
  about jsonb default '{}'::jsonb not null,
  socials jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now()
);

create table public.videos (
  id uuid default gen_random_uuid() not null,
  title text not null,
  youtube_url text not null,
  category text,
  date date,
  description text,
  created_at timestamp with time zone default now(),
  youtube_id text,
  source text default 'manual'::text not null,
  hidden boolean default false not null
);
-- ------------------------------------------------------------
-- 3) Chaves, restrições e índices
-- ------------------------------------------------------------
alter table private.admin_access add constraint admin_access_pkey PRIMARY KEY (id);
alter table private.admin_access_key add constraint admin_access_key_pkey PRIMARY KEY (id);
alter table private.ebd_sync_key add constraint ebd_sync_key_pkey PRIMARY KEY (id);
alter table private.library_sync_key add constraint library_sync_key_pkey PRIMARY KEY (id);
alter table private.library_sync_state add constraint library_sync_state_pkey PRIMARY KEY (id);
alter table public.admins add constraint admins_pkey PRIMARY KEY (user_id);
alter table public.announcements add constraint announcements_pkey PRIMARY KEY (id);
alter table public.donation_types add constraint donation_types_pkey PRIMARY KEY (id);
alter table public.ebd_lessons add constraint ebd_lessons_pkey PRIMARY KEY (id);
alter table public.ebd_quarters add constraint ebd_quarters_pkey PRIMARY KEY (id);
alter table public.events add constraint events_pkey PRIMARY KEY (id);
alter table public.library_books add constraint library_books_pkey PRIMARY KEY (id);
alter table public.library_covers add constraint library_covers_pkey PRIMARY KEY (book_id);
alter table public.library_loans add constraint library_loans_pkey PRIMARY KEY (id);
alter table public.library_readers add constraint library_readers_pkey PRIMARY KEY (id);
alter table public.library_requests add constraint library_requests_pkey PRIMARY KEY (id);
alter table public.ministries add constraint ministries_pkey PRIMARY KEY (id);
alter table public.ministry_images add constraint ministry_images_pkey PRIMARY KEY (id);
alter table public.news add constraint news_pkey PRIMARY KEY (id);
alter table public.podcasts add constraint podcasts_pkey PRIMARY KEY (id);
alter table public.services add constraint services_pkey PRIMARY KEY (id);
alter table public.settings add constraint settings_pkey PRIMARY KEY (id);
alter table public.site_settings add constraint site_settings_pkey PRIMARY KEY (id);
alter table public.videos add constraint videos_pkey PRIMARY KEY (id);

alter table private.admin_access add constraint admin_access_token_hash_key UNIQUE (token_hash);
alter table public.donation_types add constraint donation_types_slug_key UNIQUE (slug);
alter table public.ebd_lessons add constraint ebd_lessons_quarter_id_number_key UNIQUE (quarter_id, number);
alter table public.ebd_quarters add constraint ebd_quarters_year_quarter_magazine_slug_key UNIQUE (year, quarter, magazine_slug);
alter table public.news add constraint news_slug_key UNIQUE (slug);
alter table public.videos add constraint videos_youtube_id_key UNIQUE (youtube_id);

alter table private.admin_access add constraint admin_access_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'permitido'::text, 'negado'::text, 'expirado'::text])));
alter table private.admin_access_key add constraint admin_access_key_id_check CHECK ((id = 1));
alter table private.ebd_sync_key add constraint ebd_sync_key_id_check CHECK ((id = 1));
alter table private.library_sync_key add constraint library_sync_key_id_check CHECK ((id = 1));
alter table private.library_sync_state add constraint library_sync_state_id_check CHECK ((id = 1));
alter table public.ebd_lessons add constraint ebd_lessons_number_check CHECK (((number >= 1) AND (number <= 20)));
alter table public.ebd_lessons add constraint ebd_lessons_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'revisao'::text, 'publicado'::text])));
alter table public.ebd_quarters add constraint ebd_quarters_lesson_count_check CHECK (((lesson_count >= 1) AND (lesson_count <= 20)));
alter table public.ebd_quarters add constraint ebd_quarters_quarter_check CHECK (((quarter >= 1) AND (quarter <= 4)));
alter table public.ebd_quarters add constraint ebd_quarters_year_check CHECK (((year >= 2000) AND (year <= 2100)));
alter table public.library_books add constraint library_books_author_check CHECK ((char_length(author) <= 200));
alter table public.library_books add constraint library_books_category_check CHECK ((char_length(category) <= 80));
alter table public.library_books add constraint library_books_cover_url_check CHECK ((char_length(cover_url) <= 800));
alter table public.library_books add constraint library_books_notes_check CHECK ((char_length(notes) <= 1000));
alter table public.library_books add constraint library_books_owner_check CHECK ((char_length(owner) <= 120));
alter table public.library_books add constraint library_books_synopsis_check CHECK ((char_length(synopsis) <= 8000));
alter table public.library_books add constraint library_books_title_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 300)));
alter table public.library_covers add constraint library_covers_data_check CHECK (((octet_length(data) >= 100) AND (octet_length(data) <= 600000)));
alter table public.library_covers add constraint library_covers_mime_check CHECK ((mime = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])));
alter table public.library_covers add constraint library_covers_source_check CHECK ((source = ANY (ARRAY['planilha'::text, 'internet'::text])));
alter table public.library_loans add constraint library_loans_check CHECK ((due_on >= loaned_on));
alter table public.library_loans add constraint library_loans_check1 CHECK (((returned_on IS NULL) OR (returned_on >= loaned_on)));
alter table public.library_loans add constraint library_loans_notes_check CHECK ((char_length(notes) <= 1000));
alter table public.library_loans add constraint library_loans_renewals_check CHECK (((renewals >= 0) AND (renewals <= 20)));
alter table public.library_readers add constraint library_readers_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120)));
alter table public.library_readers add constraint library_readers_notes_check CHECK ((char_length(notes) <= 1000));
alter table public.library_readers add constraint library_readers_phone_check CHECK ((char_length(phone) <= 40));
alter table public.library_requests add constraint library_requests_kind_check CHECK ((kind = ANY (ARRAY['emprestimo'::text, 'fila'::text])));
alter table public.library_requests add constraint library_requests_message_check CHECK ((char_length(message) <= 500));
alter table public.library_requests add constraint library_requests_name_check CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 120)));
alter table public.library_requests add constraint library_requests_phone_check CHECK ((char_length(phone) <= 40));
alter table public.library_requests add constraint library_requests_source_check CHECK ((source = ANY (ARRAY['site'::text, 'equipe'::text, 'planilha'::text])));
alter table public.library_requests add constraint library_requests_status_check CHECK ((status = ANY (ARRAY['novo'::text, 'fila'::text, 'avisado'::text, 'atendido'::text, 'cancelado'::text])));
alter table public.podcasts add constraint podcasts_status_check CHECK ((status = ANY (ARRAY['Rascunho'::text, 'Publicado'::text])));

alter table private.admin_access add constraint admin_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.admins add constraint admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ebd_lessons add constraint ebd_lessons_quarter_id_fkey FOREIGN KEY (quarter_id) REFERENCES public.ebd_quarters(id) ON DELETE CASCADE;
alter table public.library_covers add constraint library_covers_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.library_books(id) ON DELETE CASCADE;
alter table public.library_loans add constraint library_loans_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.library_books(id) ON DELETE CASCADE;
alter table public.library_loans add constraint library_loans_reader_id_fkey FOREIGN KEY (reader_id) REFERENCES public.library_readers(id) ON DELETE RESTRICT;
alter table public.library_requests add constraint library_requests_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.library_books(id) ON DELETE CASCADE;
alter table public.library_requests add constraint library_requests_reader_id_fkey FOREIGN KEY (reader_id) REFERENCES public.library_readers(id) ON DELETE SET NULL;
alter table public.ministry_images add constraint ministry_images_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE;

CREATE INDEX admin_access_session_idx ON private.admin_access USING btree (session_id);
CREATE INDEX admin_access_user_idx ON private.admin_access USING btree (user_id, created_at);
CREATE INDEX donation_types_order_idx ON public.donation_types USING btree (active, sort_order);
CREATE INDEX ebd_lessons_date_idx ON public.ebd_lessons USING btree (lesson_date);
CREATE INDEX ebd_lessons_quarter_idx ON public.ebd_lessons USING btree (quarter_id, number);
CREATE UNIQUE INDEX library_books_sheet_key ON public.library_books USING btree (sheet_key) WHERE (sheet_key IS NOT NULL);
CREATE INDEX library_loans_due_idx ON public.library_loans USING btree (due_on) WHERE (returned_on IS NULL);
CREATE UNIQUE INDEX library_loans_one_open ON public.library_loans USING btree (book_id) WHERE (returned_on IS NULL);
CREATE INDEX library_loans_reader_idx ON public.library_loans USING btree (reader_id);
CREATE INDEX library_requests_book_idx ON public.library_requests USING btree (book_id, status, created_at);
CREATE INDEX ministry_images_ministry_id_idx ON public.ministry_images USING btree (ministry_id, sort_order, created_at);
CREATE INDEX news_featured_idx ON public.news USING btree (featured, published);
CREATE INDEX news_published_idx ON public.news USING btree (published, published_at DESC);
CREATE INDEX podcasts_published_idx ON public.podcasts USING btree (status, published_at DESC);
-- ------------------------------------------------------------
-- 4) Funções (texto igual ao do banco de produção)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lib_norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäåéèêëíìîïóòôõöúùûüçñ', 'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'));
$function$;

CREATE OR REPLACE FUNCTION private.lib_key(p_title text, p_author text, p_owner text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select private.lib_norm(p_title) || '|' || private.lib_norm(p_author) || '|' || private.lib_norm(p_owner);
$function$;

CREATE OR REPLACE FUNCTION private.admin_key_ok(p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from private.admin_access_key k
     where p_key is not null and length(p_key) >= 32
       and k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  )
$function$;

CREATE OR REPLACE FUNCTION private.library_key_ok(p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(char_length(p_key) >= 32, false)
     and exists (select 1 from private.library_sync_key k
                  where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and exists (
       select 1 from private.admin_access s
        where s.user_id = auth.uid()
          and s.session_id::text = coalesce(auth.jwt() ->> 'session_id', '')
          and s.status = 'permitido'
          and s.approved_until > now()
     )
$function$;

CREATE OR REPLACE FUNCTION public.is_site_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_admin()
$function$;

CREATE OR REPLACE FUNCTION private.ebd_sync_allowed(p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_site_admin()
      or exists (
        select 1 from private.ebd_sync_key k
        where p_token is not null
          and length(p_token) >= 32
          and k.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      )
$function$;

CREATE OR REPLACE FUNCTION public.admin_access_peek(p_key text, p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r private.admin_access%rowtype;
begin
  if not private.admin_key_ok(p_key) then
    raise exception 'ACESSO_CHAVE';
  end if;
  select * into r from private.admin_access where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  return jsonb_build_object(
    'ok', true,
    'status', case when r.status = 'pendente' and r.expires_at <= now() then 'expirado' else r.status end,
    'email', (select u.email from auth.users u where u.id = r.user_id),
    'info', r.info,
    'created_at', r.created_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_session_status()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session text := coalesce(auth.jwt() ->> 'session_id', '');
  r private.admin_access%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    return 'nao_admin';
  end if;
  select * into r from private.admin_access s
   where s.user_id = auth.uid() and s.session_id::text = v_session
   order by s.created_at desc limit 1;
  if not found then
    return 'nenhum';
  end if;
  if r.status = 'permitido' then
    return case when r.approved_until > now() then 'permitido' else 'vencido' end;
  end if;
  if r.status = 'pendente' and r.expires_at <= now() then
    return 'expirado';
  end if;
  return r.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ebd_sync_needs(p_token text, p_year integer, p_quarter integer, p_slug text)
 RETURNS integer[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qid uuid;
begin
  if not private.ebd_sync_allowed(p_token) then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  select id into v_qid from public.ebd_quarters
  where year = p_year and quarter = p_quarter and magazine_slug = p_slug;
  if v_qid is null then
    return array(select generate_series(1, 20));
  end if;
  return array(
    select n from generate_series(1, 20) as n
    where not exists (
      select 1 from public.ebd_lessons l
      where l.quarter_id = v_qid and l.number = n
        and l.golden_ref <> '' and l.reading_ref <> ''
        and exists (select 1 from unnest(l.daily_refs) d where d <> '')
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.ebd_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.library_cover(p_book uuid)
 RETURNS TABLE(mime text, data text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.mime, encode(c.data, 'base64')
    from public.library_covers c
    join public.library_books b on b.id = c.book_id
   where c.book_id = p_book and b.visible;
$function$;

CREATE OR REPLACE FUNCTION public.library_status()
 RETURNS TABLE(book_id uuid, on_loan boolean, due_on date, waiting integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select b.id,
         l.id is not null,
         l.due_on,
         (select count(*)::int
            from public.library_requests r
           where r.book_id = b.id and r.status in ('novo', 'fila', 'avisado'))
    from public.library_books b
    left join public.library_loans l on l.book_id = b.id and l.returned_on is null
   where b.visible;
$function$;

CREATE OR REPLACE FUNCTION public.library_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_donation_types_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_news_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_podcasts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_access_decide(p_key text, p_token_hash text, p_allow boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r private.admin_access%rowtype;
begin
  if not private.admin_key_ok(p_key) then
    raise exception 'ACESSO_CHAVE';
  end if;
  select * into r from private.admin_access where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if r.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_decidido', 'status', r.status);
  end if;
  if r.expires_at <= now() then
    update private.admin_access set status = 'expirado' where id = r.id;
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  update private.admin_access
     set status = case when p_allow then 'permitido' else 'negado' end,
         decided_at = now(),
         approved_until = case when p_allow then now() + interval '12 hours' else null end
   where id = r.id;
  return jsonb_build_object('ok', true, 'status', case when p_allow then 'permitido' else 'negado' end,
                            'email', (select u.email from auth.users u where u.id = r.user_id));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_access_request(p_key text, p_user uuid, p_session uuid, p_token_hash text, p_info jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_recent int;
  v_email  text;
begin
  if not private.admin_key_ok(p_key) then
    raise exception 'ACESSO_CHAVE';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'ACESSO_TOKEN';
  end if;
  if not exists (select 1 from public.admins a where a.user_id = p_user) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_admin');
  end if;
  select u.email into v_email from auth.users u where u.id = p_user;

  -- Limpeza: registros com mais de 30 dias.
  delete from private.admin_access where created_at < now() - interval '30 days';

  -- Esta sessão já está liberada?
  if exists (select 1 from private.admin_access s
              where s.session_id = p_session and s.user_id = p_user
                and s.status = 'permitido' and s.approved_until > now()) then
    return jsonb_build_object('ok', true, 'status', 'permitido', 'email', v_email);
  end if;

  -- Freio: no máximo 6 e-mails por hora por conta.
  select count(*) into v_recent from private.admin_access s
   where s.user_id = p_user and s.created_at > now() - interval '1 hour';
  if v_recent >= 6 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  update private.admin_access set status = 'expirado'
   where session_id = p_session and status = 'pendente';
  insert into private.admin_access (user_id, session_id, token_hash, info, expires_at)
  values (p_user, p_session, p_token_hash, coalesce(p_info, '{}'::jsonb), now() + interval '20 minutes');
  return jsonb_build_object('ok', true, 'status', 'pendente', 'email', v_email);
end;
$function$;

CREATE OR REPLACE FUNCTION public.library_request(p_book uuid, p_name text, p_phone text, p_message text DEFAULT ''::text, p_trap text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name   text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 120);
  v_phone  text := left(btrim(coalesce(p_phone, '')), 40);
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_msg    text := left(btrim(coalesce(p_message, '')), 500);
  v_kind   text;
  v_req    public.library_requests%rowtype;
  v_pos    int;
begin
  -- Campo invisível preenchido = robô: responde "ok" sem gravar nada.
  if coalesce(p_trap, '') <> '' then
    return jsonb_build_object('ok', true, 'kind', 'emprestimo', 'position', 1);
  end if;
  if char_length(v_name) < 2 then
    raise exception 'LIB_NOME';
  end if;
  if char_length(v_digits) not between 10 and 13 then
    raise exception 'LIB_TELEFONE';
  end if;
  if not exists (select 1 from public.library_books b where b.id = p_book and b.visible) then
    raise exception 'LIB_LIVRO';
  end if;
  -- Já pediu este livro e o pedido está em aberto: não duplica.
  select * into v_req
    from public.library_requests r
   where r.book_id = p_book
     and r.status in ('novo', 'fila', 'avisado')
     and regexp_replace(r.phone, '\D', '', 'g') = v_digits
   limit 1;
  if found then
    select count(*)::int into v_pos
      from public.library_requests r
     where r.book_id = p_book and r.status in ('novo', 'fila', 'avisado') and r.created_at <= v_req.created_at;
    return jsonb_build_object('ok', true, 'kind', v_req.kind, 'position', v_pos, 'repeated', true);
  end if;
  -- Limites contra abuso
  if (select count(*) from public.library_requests r
       where r.status in ('novo', 'fila', 'avisado')
         and regexp_replace(r.phone, '\D', '', 'g') = v_digits) >= 4 then
    raise exception 'LIB_MUITOS';
  end if;
  if (select count(*) from public.library_requests r
       where r.source = 'site' and r.created_at > now() - interval '1 hour') >= 40 then
    raise exception 'LIB_LIMITE';
  end if;

  v_kind := case
    when exists (select 1 from public.library_loans l where l.book_id = p_book and l.returned_on is null)
      or exists (select 1 from public.library_requests r where r.book_id = p_book and r.status in ('novo', 'fila', 'avisado'))
    then 'fila' else 'emprestimo' end;

  insert into public.library_requests (book_id, kind, name, phone, message, status, source)
  values (p_book, v_kind, v_name, v_phone, v_msg, 'novo', 'site');

  select count(*)::int into v_pos
    from public.library_requests r
   where r.book_id = p_book and r.status in ('novo', 'fila', 'avisado');
  return jsonb_build_object('ok', true, 'kind', v_kind, 'position', v_pos);
end;
$function$;

CREATE OR REPLACE FUNCTION public.library_set_cover(p_key text, p_book uuid, p_url text DEFAULT NULL::text, p_mime text DEFAULT NULL::text, p_data text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_bytes bytea;
begin
  if not private.library_key_ok(p_key) then
    raise exception 'LIB_CHAVE' using errcode = '42501';
  end if;
  if not exists (select 1 from public.library_books b where b.id = p_book and b.cover_url = '') then
    return jsonb_build_object('ok', false, 'motivo', 'ja_tem_capa');
  end if;
  if p_data is not null then
    if p_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'LIB_TIPO';
    end if;
    v_bytes := decode(p_data, 'base64');
    insert into public.library_covers (book_id, mime, data, source)
    values (p_book, p_mime, v_bytes, 'planilha')
    on conflict (book_id) do update set mime = excluded.mime, data = excluded.data, source = excluded.source, updated_at = now();
    update public.library_books
       set cover_url = '/api/capa-livro/' || p_book || '-' || to_char(now(), 'YYYYMMDDHH24MISS') || '.jpg'
     where id = p_book;
  elsif p_url ~ '^https://covers\.openlibrary\.org/b/id/[0-9]+-[SML]\.jpg$'
     or p_url ~ '^https://books\.google\.com/books/content\?id=[A-Za-z0-9_-]+&printsec=frontcover&img=1&zoom=[0-9]$' then
    update public.library_books set cover_url = p_url where id = p_book;
  else
    raise exception 'LIB_CAPA';
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.library_sync_apply(p_key text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r      jsonb;
  k      text;
  sk     text;
  n      int;
  seen   jsonb := '{}';
  rowmap jsonb := '{}'; -- sheet_key → posição da linha enviada (para achar a capa)
  i      bigint;
  v_id   uuid;
  added  jsonb := '[]';
  v_last timestamptz;
begin
  if not private.library_key_ok(p_key) then
    raise exception 'LIB_CHAVE' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 3000 then
    raise exception 'LIB_DADOS';
  end if;
  -- Freio: no máximo uma sincronização a cada 30 s (o link da equipe pode ser tocado várias vezes).
  select last_at into v_last from private.library_sync_state where id = 1 for update;
  if v_last is not null and v_last > now() - interval '30 seconds' then
    return jsonb_build_object('ok', false, 'motivo', 'recente');
  end if;

  for r, i in select value, ordinality - 1 from jsonb_array_elements(p_rows) with ordinality loop
    continue when char_length(btrim(coalesce(r->>'title', ''))) = 0;
    k := private.lib_key(r->>'title', r->>'author', r->>'owner');
    n := coalesce((seen->>k)::int, 0) + 1;
    seen := jsonb_set(seen, array[k], to_jsonb(n));
    sk := k || '#' || n;
    rowmap := jsonb_set(rowmap, array[sk], to_jsonb(i));
    continue when exists (select 1 from public.library_books b where b.sheet_key = sk);
    -- Cadastrado à mão no painel antes de entrar na planilha: só liga os dois.
    select b.id into v_id from public.library_books b
     where b.sheet_key is null and private.lib_key(b.title, b.author, b.owner) = k
     order by b.created_at, b.id limit 1;
    if found then
      update public.library_books set sheet_key = sk where id = v_id;
      continue;
    end if;
    insert into public.library_books (title, author, category, synopsis, owner, visible, sheet_key)
    values (left(btrim(r->>'title'), 300),
            left(btrim(coalesce(r->>'author', '')), 200),
            left(btrim(coalesce(r->>'category', '')), 80),
            left(btrim(coalesce(r->>'synopsis', '')), 8000),
            left(btrim(coalesce(r->>'owner', '')), 120),
            true, sk)
    returning id into v_id;
    added := added || jsonb_build_object('id', v_id, 'title', btrim(r->>'title'));
  end loop;

  update private.library_sync_state
     set last_at = now(),
         summary = jsonb_build_object('added', jsonb_array_length(added), 'rows', jsonb_array_length(p_rows))
   where id = 1;

  -- Livros visíveis sem capa e de qual linha da planilha vieram (para achar a imagem).
  return jsonb_build_object(
    'ok', true,
    'added', added,
    'needCover', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'row', rowmap -> b.sheet_key))
        from public.library_books b
       where b.visible and b.cover_url = ''
    ), '[]'));
end;
$function$;

CREATE OR REPLACE FUNCTION public.ebd_sync_apply(p_token text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c_prefix constant text := 'https://www.estudantesdabiblia.com.br/';
  v_year     int;
  v_quarter  int;
  v_slug     text := p_data->>'magazine_slug';
  v_magazine text := left(btrim(coalesce(p_data->>'magazine', '')), 60);
  v_theme    text := left(btrim(coalesce(p_data->>'theme', '')), 300);
  v_comm     text := left(btrim(coalesce(p_data->>'commentator', '')), 120);
  v_pub      text := left(btrim(coalesce(p_data->>'publisher', '')), 60);
  v_src      text := coalesce(p_data->>'source_url', '');
  v_start    date;
  v_count    int;
  v_auto     boolean := coalesce(p_data->>'auto_publish', 'false') = 'true';
  v_qid      uuid;
  v_new_q    boolean := false;
  l          jsonb;
  v_n        int;
  v_date     date;
  v_title    text;
  v_golden   text;
  v_reading  text;
  v_daily    text[];
  v_lsrc     text;
  v_row      public.ebd_lessons%rowtype;
  v_created  int := 0;
  v_filled   int := 0;
  v_published int := 0;
begin
  if not private.ebd_sync_allowed(p_token) then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  -- Validação de tudo que chega de fora
  begin
    v_year    := (p_data->>'year')::int;
    v_quarter := (p_data->>'quarter')::int;
    v_start   := (p_data->>'start_date')::date;
    v_count   := coalesce((p_data->>'lesson_count')::int, 13);
  exception when others then
    raise exception 'dados inválidos' using errcode = '22023';
  end;
  if v_year is null or v_year not between 2000 and 2100 or v_quarter is null or v_quarter not between 1 and 4 or v_start is null then
    raise exception 'ano, trimestre ou data inicial inválidos' using errcode = '22023';
  end if;
  if v_slug is null or v_slug !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'revista inválida' using errcode = '22023';
  end if;
  if v_src <> '' and left(v_src, length(c_prefix)) <> c_prefix then
    raise exception 'link de origem inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'lessons') is distinct from 'array' or jsonb_array_length(p_data->'lessons') > 20 then
    raise exception 'lista de lições inválida' using errcode = '22023';
  end if;
  v_count := least(greatest(v_count, 1), 20);

  -- Trimestre: cria se não existir; se existir, só completa o que falta
  select id into v_qid from public.ebd_quarters
  where year = v_year and quarter = v_quarter and magazine_slug = v_slug;
  if v_qid is null then
    insert into public.ebd_quarters (year, quarter, magazine, magazine_slug, theme, commentator, publisher, source_url, start_date, lesson_count)
    values (v_year, v_quarter, coalesce(nullif(v_magazine, ''), initcap(v_slug)), v_slug, v_theme, v_comm,
            coalesce(nullif(v_pub, ''), 'CPAD'), v_src, v_start, v_count)
    returning id into v_qid;
    v_new_q := true;
  else
    update public.ebd_quarters q set
      theme        = case when q.theme = '' then v_theme else q.theme end,
      commentator  = case when q.commentator = '' then v_comm else q.commentator end,
      source_url   = case when q.source_url = '' then v_src else q.source_url end,
      lesson_count = greatest(q.lesson_count, v_count)
    where q.id = v_qid
    returning q.start_date into v_start; -- a data cadastrada pela equipe prevalece
  end if;

  for l in select value from jsonb_array_elements(p_data->'lessons') loop
    begin
      v_n := (l->>'number')::int;
    exception when others then
      continue;
    end;
    continue when v_n is null or v_n not between 1 and 20;
    v_title   := left(btrim(coalesce(l->>'title', '')), 200);
    v_golden  := left(btrim(coalesce(l->>'golden_ref', '')), 120);
    v_reading := left(btrim(coalesce(l->>'reading_ref', '')), 120);
    v_lsrc    := coalesce(l->>'source_url', '');
    if v_lsrc <> '' and left(v_lsrc, length(c_prefix)) <> c_prefix then
      v_lsrc := '';
    end if;
    v_daily := array(
      select left(btrim(t.x), 120)
      from jsonb_array_elements_text(case when jsonb_typeof(l->'daily_refs') = 'array' then l->'daily_refs' else '[]'::jsonb end)
           with ordinality as t(x, i)
      where t.i <= 6
      order by t.i
    );
    begin
      v_date := nullif(l->>'lesson_date', '')::date;
    exception when others then
      v_date := null;
    end;
    v_date := coalesce(v_date, v_start + 7 * (v_n - 1));

    select * into v_row from public.ebd_lessons where quarter_id = v_qid and number = v_n;
    if not found then
      insert into public.ebd_lessons (quarter_id, number, lesson_date, title, golden_ref, reading_ref, daily_refs, source_url)
      values (v_qid, v_n, v_date, v_title, v_golden, v_reading, v_daily, v_lsrc)
      returning * into v_row;
      v_created := v_created + 1;
    elsif (v_row.title = '' and v_title <> '')
       or (v_row.golden_ref = '' and v_golden <> '')
       or (v_row.reading_ref = '' and v_reading <> '')
       or (v_row.source_url = '' and v_lsrc <> '')
       or (not exists (select 1 from unnest(v_row.daily_refs) d where d <> '')
           and exists (select 1 from unnest(v_daily) d where d <> '')) then
      update public.ebd_lessons e set
        title       = case when e.title = '' then v_title else e.title end,
        golden_ref  = case when e.golden_ref = '' then v_golden else e.golden_ref end,
        reading_ref = case when e.reading_ref = '' then v_reading else e.reading_ref end,
        daily_refs  = case when not exists (select 1 from unnest(e.daily_refs) d where d <> '') then v_daily else e.daily_refs end,
        source_url  = case when e.source_url = '' then v_lsrc else e.source_url end
      where e.id = v_row.id
      returning * into v_row;
      v_filled := v_filled + 1;
    end if;

    -- Publicação automática (opcional, ligada no painel): rascunho com título e
    -- texto áureo entra no ar sozinho na segunda-feira da semana da lição.
    -- Para segurar uma lição, a equipe marca "Em revisão".
    if v_auto and v_row.status = 'rascunho' and v_row.title <> '' and v_row.golden_ref <> '' then
      update public.ebd_lessons e set
        status = 'publicado',
        publish_at = ((v_row.lesson_date - 6)::timestamp at time zone 'America/Sao_Paulo')
      where e.id = v_row.id;
      v_published := v_published + 1;
    end if;
  end loop;

  return jsonb_build_object('quarter_id', v_qid, 'new_quarter', v_new_q, 'created', v_created, 'filled', v_filled, 'published', v_published);
end;
$function$;

-- ------------------------------------------------------------
-- 5) Triggers (updated_at automático)
-- ------------------------------------------------------------
CREATE TRIGGER donation_types_updated_at BEFORE UPDATE ON public.donation_types FOR EACH ROW EXECUTE FUNCTION public.set_donation_types_updated_at();
CREATE TRIGGER ebd_lessons_touch BEFORE UPDATE ON public.ebd_lessons FOR EACH ROW EXECUTE FUNCTION public.ebd_touch_updated_at();
CREATE TRIGGER ebd_quarters_touch BEFORE UPDATE ON public.ebd_quarters FOR EACH ROW EXECUTE FUNCTION public.ebd_touch_updated_at();
CREATE TRIGGER library_books_touch BEFORE UPDATE ON public.library_books FOR EACH ROW EXECUTE FUNCTION public.library_touch_updated_at();
CREATE TRIGGER library_loans_touch BEFORE UPDATE ON public.library_loans FOR EACH ROW EXECUTE FUNCTION public.library_touch_updated_at();
CREATE TRIGGER library_readers_touch BEFORE UPDATE ON public.library_readers FOR EACH ROW EXECUTE FUNCTION public.library_touch_updated_at();
CREATE TRIGGER library_requests_touch BEFORE UPDATE ON public.library_requests FOR EACH ROW EXECUTE FUNCTION public.library_touch_updated_at();
CREATE TRIGGER news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.set_news_updated_at();
CREATE TRIGGER podcasts_set_updated_at BEFORE UPDATE ON public.podcasts FOR EACH ROW EXECUTE FUNCTION public.set_podcasts_updated_at();

-- ------------------------------------------------------------
-- 6) RLS e políticas
--    Leitura pública onde o site precisa; gravação só para admin com a
--    entrada liberada (is_site_admin() → is_admin()). As tabelas de private
--    não têm RLS porque nenhum papel da API tem acesso a elas.
--    (Algumas leituras públicas aparecem em dobro, com nomes diferentes:
--    é o que existe na produção; não atrapalha.)
-- ------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.announcements enable row level security;
alter table public.donation_types enable row level security;
alter table public.ebd_lessons enable row level security;
alter table public.ebd_quarters enable row level security;
alter table public.events enable row level security;
alter table public.library_books enable row level security;
alter table public.library_covers enable row level security;
alter table public.library_loans enable row level security;
alter table public.library_readers enable row level security;
alter table public.library_requests enable row level security;
alter table public.ministries enable row level security;
alter table public.ministry_images enable row level security;
alter table public.news enable row level security;
alter table public.podcasts enable row level security;
alter table public.services enable row level security;
alter table public.settings enable row level security;
alter table public.site_settings enable row level security;
alter table public.videos enable row level security;

create policy "Leitura pública announcements" on public.announcements for select to public using (true);
create policy "Public can read announcements" on public.announcements for select to anon, authenticated using (true);
create policy "Site admin gerencia" on public.announcements for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Public can read active donation types" on public.donation_types for select to public using ((active = true));
create policy "Site admin gerencia" on public.donation_types for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "EBD: admin gerencia lições" on public.ebd_lessons for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "EBD: lições publicadas são públicas" on public.ebd_lessons for select to anon, authenticated using ((public.is_site_admin() OR ((status = 'publicado'::text) AND ((publish_at IS NULL) OR (publish_at <= now())) AND (EXISTS ( SELECT 1
   FROM public.ebd_quarters q
  WHERE ((q.id = ebd_lessons.quarter_id) AND q.visible))))));

create policy "EBD: admin gerencia trimestres" on public.ebd_quarters for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "EBD: trimestres visíveis são públicos" on public.ebd_quarters for select to anon, authenticated using ((visible OR public.is_site_admin()));

create policy "Leitura pública events" on public.events for select to public using (true);
create policy "Public can read events" on public.events for select to anon, authenticated using (true);
create policy "Site admin gerencia" on public.events for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Biblioteca: acervo visível é público" on public.library_books for select to anon, authenticated using ((visible OR public.is_site_admin()));
create policy "Biblioteca: admin gerencia o acervo" on public.library_books for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "Biblioteca: só admin vê empréstimos" on public.library_loans for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "Biblioteca: só admin vê leitores" on public.library_readers for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "Biblioteca: só admin vê pedidos" on public.library_requests for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Leitura pública ministries" on public.ministries for select to public using (true);
create policy "Public can read ministries" on public.ministries for select to anon, authenticated using (true);
create policy "Site admin gerencia" on public.ministries for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Public can read ministry images" on public.ministry_images for select to public using (true);
create policy "Site admin gerencia" on public.ministry_images for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "public can read ministry images" on public.ministry_images for select to anon, authenticated using (true);

create policy "Public can read published news" on public.news for select to public using ((published = true));
create policy "Site admin gerencia" on public.news for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

-- Podcasts: DIFERENÇA INTENCIONAL em relação à produção de 19/10/2026.
-- Lá, a gravação de podcasts ainda está presa a um e-mail fixo
-- (auth.email() = '...'), sem a liberação por e-mail, e a leitura pública
-- vale só para anon. Aqui já vai a regra de todas as outras tabelas; a
-- correção da produção está em 20261019_podcasts_admin.sql.
create policy "Public can read published podcasts" on public.podcasts for select to anon, authenticated using ((status = 'Publicado'::text));
create policy "Site admin gerencia" on public.podcasts for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Leitura pública services" on public.services for select to public using (true);
create policy "Public can read services" on public.services for select to anon, authenticated using (true);
create policy "Site admin gerencia" on public.services for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Leitura pública settings" on public.settings for select to public using (true);
create policy "Site admin gerencia" on public.settings for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Leitura pública site_settings" on public.site_settings for select to public using (true);
create policy "Public can read site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Site admin gerencia" on public.site_settings for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

create policy "Leitura pública videos" on public.videos for select to public using (true);
create policy "Public can read videos" on public.videos for select to anon, authenticated using (true);
create policy "Site admin gerencia" on public.videos for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

-- ------------------------------------------------------------
-- 7) Permissões (iguais às da produção)
--    Um projeto novo do Supabase dá tudo para anon/authenticated nas
--    tabelas e funções de public; aqui tudo é retirado e devolvido só o
--    que existe hoje. O RLS continua sendo quem filtra as linhas.
-- ------------------------------------------------------------
revoke all on schema private from public, anon, authenticated, service_role;

-- Tabelas de private: nenhum papel da API (só as funções security definer).
revoke all on table private.admin_access, private.admin_access_key, private.ebd_sync_key,
                    private.library_sync_key, private.library_sync_state
  from public, anon, authenticated, service_role;

-- Tabelas de public
revoke all on table
  public.admins, public.announcements, public.donation_types, public.ebd_lessons, public.ebd_quarters,
  public.events, public.library_books, public.library_covers, public.library_loans, public.library_readers,
  public.library_requests, public.ministries, public.ministry_images, public.news, public.podcasts,
  public.services, public.settings, public.site_settings, public.videos
  from public, anon, authenticated, service_role;

-- Leitura e gravação pela API, filtradas pelo RLS
grant all on table
  public.announcements, public.donation_types, public.events, public.ministries, public.ministry_images,
  public.news, public.podcasts, public.services, public.settings, public.site_settings, public.videos
  to anon, authenticated, service_role;

-- EBD: visitante só lê
grant select on table public.ebd_lessons, public.ebd_quarters to anon;
grant all on table public.ebd_lessons, public.ebd_quarters to authenticated, service_role;

-- Biblioteca: o visitante lê só estas colunas do acervo (sem dono nem observações);
-- empréstimos, leitores e pedidos só para quem está logado (e o RLS exige admin).
grant select (id, title, author, category, synopsis, cover_url, visible, created_at, updated_at)
  on table public.library_books to anon;
grant all on table public.library_books, public.library_loans, public.library_readers, public.library_requests
  to authenticated, service_role;

-- Capas e lista de admins: ninguém pela API (só as funções)
grant all on table public.library_covers, public.admins to service_role;

-- Funções de private: só as funções internas de normalização ficam abertas
revoke all on function private.admin_key_ok(text) from public, anon, authenticated, service_role;
revoke all on function private.ebd_sync_allowed(text) from public, anon, authenticated, service_role;
revoke all on function private.library_key_ok(text) from public, anon, authenticated, service_role;
revoke all on function private.lib_key(text, text, text) from public, anon, authenticated, service_role;
revoke all on function private.lib_norm(text) from public, anon, authenticated, service_role;
grant execute on function private.lib_key(text, text, text) to public;
grant execute on function private.lib_norm(text) to public;

-- Funções de public chamadas pela API
revoke all on function public.admin_access_decide(text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.admin_access_peek(text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_access_request(text, uuid, uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_session_status() from public, anon, authenticated, service_role;
revoke all on function public.ebd_sync_apply(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.ebd_sync_needs(text, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.is_admin() from public, anon, authenticated, service_role;
revoke all on function public.is_site_admin() from public, anon, authenticated, service_role;
revoke all on function public.library_cover(uuid) from public, anon, authenticated, service_role;
revoke all on function public.library_request(uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.library_set_cover(text, uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.library_status() from public, anon, authenticated, service_role;
revoke all on function public.library_sync_apply(text, jsonb) from public, anon, authenticated, service_role;

grant execute on function public.admin_access_decide(text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.admin_access_peek(text, text) to anon, authenticated, service_role;
grant execute on function public.admin_access_request(text, uuid, uuid, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.admin_session_status() to authenticated, service_role;
grant execute on function public.ebd_sync_apply(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.ebd_sync_needs(text, integer, integer, text) to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_site_admin() to public, anon, authenticated, service_role;
grant execute on function public.library_cover(uuid) to anon, authenticated, service_role;
grant execute on function public.library_request(uuid, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.library_set_cover(text, uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.library_status() to anon, authenticated, service_role;
grant execute on function public.library_sync_apply(text, jsonb) to anon, authenticated, service_role;

-- Funções de trigger: como o Supabase cria por padrão
grant execute on function public.ebd_touch_updated_at(), public.library_touch_updated_at(),
  public.set_donation_types_updated_at(), public.set_news_updated_at(), public.set_podcasts_updated_at()
  to public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 8) Storage: bucket "images" (fotos, QR codes e áudios do podcast)
--    Público para leitura; só admin liberado envia, edita, lista ou apaga.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/wav'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Site admin apaga imagens" on storage.objects for delete to authenticated using (((bucket_id = 'images'::text) AND public.is_site_admin()));
create policy "Site admin edita imagens" on storage.objects for update to authenticated using (((bucket_id = 'images'::text) AND public.is_site_admin())) with check (((bucket_id = 'images'::text) AND public.is_site_admin()));
create policy "Site admin envia imagens" on storage.objects for insert to authenticated with check (((bucket_id = 'images'::text) AND public.is_site_admin()));
create policy "Site admin lista imagens" on storage.objects for select to authenticated using (((bucket_id = 'images'::text) AND public.is_site_admin()));

-- ------------------------------------------------------------
-- 9) Linha de controle da sincronização da biblioteca (não é dado da igreja:
--    só guarda quando foi a última sincronização, para o freio de 30 s).
-- ------------------------------------------------------------
insert into private.library_sync_state (id) values (1) on conflict do nothing;

-- ------------------------------------------------------------
-- 10) Chaves do servidor (só o SHA-256 fica no banco)
--     Troque cada <...> pelo MESMO valor da variável na Vercel. Pode deixar
--     para depois: sem a chave, a função correspondente simplesmente recusa
--     tudo (nada fica aberto). Troque só na cópia colada no SQL Editor.
-- ------------------------------------------------------------
do $$
declare
  admin_token text := '<ADMIN_ACCESS_TOKEN>'; -- liberação do painel por e-mail
  ebd_token   text := '<EBD_SYNC_TOKEN>';     -- importação da EBD
  lib_token   text := '<LIB_SYNC_TOKEN>';     -- planilha da biblioteca
  hash text;
begin
  if admin_token like '<%' then
    raise notice 'ADMIN_ACCESS_TOKEN não informado: a entrada no painel fica bloqueada até rodar este bloco.';
  else
    hash := encode(sha256(convert_to(admin_token, 'UTF8')), 'hex');
    insert into private.admin_access_key (id, key_hash) values (1, hash)
    on conflict (id) do update set key_hash = excluded.key_hash, updated_at = now();
  end if;
  if ebd_token like '<%' then
    raise notice 'EBD_SYNC_TOKEN não informado: a importação da EBD fica desligada.';
  else
    hash := encode(sha256(convert_to(ebd_token, 'UTF8')), 'hex');
    insert into private.ebd_sync_key (id, token_hash) values (1, hash)
    on conflict (id) do update set token_hash = excluded.token_hash, updated_at = now();
  end if;
  if lib_token like '<%' then
    raise notice 'LIB_SYNC_TOKEN não informado: a sincronização da biblioteca fica desligada.';
  else
    hash := encode(sha256(convert_to(lib_token, 'UTF8')), 'hex');
    insert into private.library_sync_key (id, key_hash) values (1, hash)
    on conflict (id) do update set key_hash = excluded.key_hash;
  end if;
end $$;

-- ------------------------------------------------------------
-- 11) Agendamentos (pg_cron)
-- ------------------------------------------------------------
-- Prazos de guarda da LGPD, todo dia às 04:30 (Brasília).
select cron.schedule(
  'lgpd-limpeza-diaria',
  '30 7 * * *',
  $$
    delete from public.library_requests
     where status in ('atendido', 'cancelado')
       and updated_at < now() - interval '6 months';
    delete from private.admin_access
     where created_at < now() - interval '30 days';
  $$
);

-- Vídeos do YouTube a cada 10 min (função sync-youtube). Precisa da função
-- publicada (supabase functions deploy sync-youtube) e do segredo
-- CRON_SECRET nas Edge Functions. Sem os três valores, o bloco só avisa.
do $$
declare
  projeto_url text := '<URL_DO_PROJETO>'; -- ex.: https://<ref>.supabase.co
  chave_anon  text := '<ANON_KEY>';       -- Settings → API Keys → Legacy → anon (JWT)
  segredo     text := '<CRON_SECRET>';    -- o mesmo de supabase secrets set CRON_SECRET=...
begin
  if projeto_url like '<%' or chave_anon like '<%' or segredo like '<%' then
    raise notice 'Agendamento sync-youtube não criado: preencha URL, chave anon e CRON_SECRET (veja 20261019_sync_youtube_segredo.sql).';
    return;
  end if;
  perform cron.schedule(
    'sync-youtube',
    '*/10 * * * *',
    format($cmd$ select net.http_post(
         url := %L,
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', %L,
           'x-cron-secret', %L
         ),
         body := '{}'::jsonb
       ); $cmd$, projeto_url || '/functions/v1/sync-youtube', 'Bearer ' || chave_anon, segredo)
  );
end $$;

commit;

-- ------------------------------------------------------------
-- Conferir (rode depois, separado): deve listar 24 tabelas, 23 funções,
-- 42 políticas (38 em public, 4 no Storage) e 2 agendamentos (1 se o bloco
-- do sync-youtube foi pulado).
--
-- select (select count(*) from pg_tables where schemaname in ('public','private')) as tabelas,
--        (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--          where n.nspname in ('public','private') and p.prokind = 'f'
--            and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')) as funcoes,
--        (select count(*) from pg_policies where schemaname in ('public','storage')) as politicas,
--        (select count(*) from cron.job) as agendamentos;
-- ------------------------------------------------------------
