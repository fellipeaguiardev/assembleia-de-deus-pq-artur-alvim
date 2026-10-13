-- ============================================================
-- EBD — importação automática do sumário + reforço de segurança
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga nada.
-- (Precisa do 20261010_ebd.sql aplicado antes.)
--
-- O que faz:
--  1. Reforça public.is_site_admin(): além do e-mail da lista, exige
--     que o usuário exista no Auth com o e-mail CONFIRMADO (o token
--     sozinho não basta). Só troca se a conta do painel estiver
--     confirmada — assim ninguém fica trancado para fora.
--  2. Cria public.ebd_sync_needs / public.ebd_sync_apply, usadas pela
--     função do Netlify que lê o sumário das lições (títulos, datas e
--     referências bíblicas — nunca o texto da revista).
--     Segurança: só funcionam com a chave do servidor (guardada no
--     Netlify; aqui fica apenas o hash SHA-256 dela) ou para um admin
--     logado. Os dados recebidos são validados e a função só PREENCHE
--     campos vazios — nunca apaga nem sobrescreve o que a equipe
--     escreveu. Sem SQL dinâmico.
-- ============================================================

-- 1) Admin = usuário do Auth, e-mail confirmado e na lista
do $outer$
begin
  if exists (select 1 from auth.users where lower(email) = 'adparque@gmail.com' and email_confirmed_at is not null) then
    create or replace function public.is_site_admin()
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
    as $fn$
      select exists (
        select 1
        from auth.users u
        where u.id = auth.uid()
          and u.email_confirmed_at is not null
          and lower(u.email) in ('adparque@gmail.com', 'fellipe.aguiar1058@gmail.com')
      )
    $fn$;
    raise notice 'is_site_admin reforçada';
  else
    raise notice 'is_site_admin NÃO alterada: confirme o e-mail adparque@gmail.com em Authentication → Users e rode de novo';
  end if;
end
$outer$;

-- 2) Chave do servidor (só o hash; a chave fica na variável EBD_SYNC_TOKEN do Netlify)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.ebd_sync_key (
  id          int primary key default 1 check (id = 1),
  token_hash  text not null,
  updated_at  timestamptz not null default now()
);
insert into private.ebd_sync_key (id, token_hash)
values (1, 'b2ccf895ee8d3136743d4b83ee1f188f8075dcd9235b918f26a59f48694178a4')
on conflict (id) do update set token_hash = excluded.token_hash, updated_at = now();

create or replace function private.ebd_sync_allowed(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_site_admin()
      or exists (
        select 1 from private.ebd_sync_key k
        where p_token is not null
          and length(p_token) >= 32
          and k.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      )
$$;
revoke all on function private.ebd_sync_allowed(text) from public;

-- 3) Quais lições ainda estão sem referências (para buscar só essas na origem)
create or replace function public.ebd_sync_needs(p_token text, p_year int, p_quarter int, p_slug text)
returns int[]
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

-- 4) Grava o que veio do sumário (só preenche o que está vazio)
create or replace function public.ebd_sync_apply(p_token text, p_data jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.ebd_sync_needs(text, int, int, text) from public;
revoke all on function public.ebd_sync_apply(text, jsonb) from public;
grant execute on function public.ebd_sync_needs(text, int, int, text) to anon, authenticated;
grant execute on function public.ebd_sync_apply(text, jsonb) to anon, authenticated;
