-- ============================================================
-- Biblioteca: livros novos da planilha entram sozinhos no site
-- ------------------------------------------------------------
-- A equipe continua cadastrando os livros na planilha do Google. A função
-- api/biblioteca-sync.mjs (Vercel) lê a planilha todo dia (e quando alguém
-- toca "Atualizar agora") e chama as funções abaixo com a chave do servidor
-- LIB_SYNC_TOKEN (variável da Vercel; aqui fica só o SHA-256 dela).
--
--   library_sync_apply  cadastra os exemplares que ainda não estão no acervo.
--                       Cada livro guarda de qual linha da planilha veio
--                       (sheet_key = título|autor|dono#exemplar), então
--                       corrigir o título no painel não cria duplicata. Só
--                       ADICIONA: não apaga nem muda o que a equipe editou.
--   library_set_cover   guarda a capa que veio da planilha (ou o endereço da
--                       capa achada na internet: Open Library ou, com a chave
--                       GOOGLE_BOOKS_KEY na Vercel, Google Books) — só para
--                       livro SEM capa.
--   library_cover       entrega a capa guardada (pública, só livro visível).
--
-- As capas da planilha ficam na tabela library_covers (JPEG ~25 KB cada, já
-- reduzido pelo Google) e são servidas em /api/capa-livro/<id>-<versão>.jpg.
-- Pode rodar mais de uma vez.
-- ============================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.library_sync_key (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);
insert into private.library_sync_key (id, key_hash)
values (1, '281f5840385307b2f0f7be64ba7d4901e554a1df14385f764d8488ac30c1b699')
on conflict (id) do update set key_hash = excluded.key_hash;

create table if not exists private.library_sync_state (
  id       int primary key default 1 check (id = 1),
  last_at  timestamptz,
  summary  jsonb not null default '{}'
);
insert into private.library_sync_state (id) values (1) on conflict do nothing;

create or replace function private.library_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(char_length(p_key) >= 32, false)
     and exists (select 1 from private.library_sync_key k
                  where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$$;

-- Comparação de título/autor/dono sem acento, maiúsculas ou espaços extras.
-- (Tira o acento ANTES do lower(): em alguns bancos o lower() não mexe em "É".)
create or replace function private.lib_norm(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäåéèêëíìîïóòôõöúùûüçñ', 'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'));
$$;

create or replace function private.lib_key(p_title text, p_author text, p_owner text)
returns text
language sql
immutable
set search_path = ''
as $$
  select private.lib_norm(p_title) || '|' || private.lib_norm(p_author) || '|' || private.lib_norm(p_owner);
$$;

-- De qual linha da planilha o livro veio (privado: não é liberado para visitantes).
alter table public.library_books add column if not exists sheet_key text;
create unique index if not exists library_books_sheet_key on public.library_books (sheet_key) where sheet_key is not null;
-- Os livros que já vieram da planilha (importação de 12/10) recebem a marca.
update public.library_books b
   set sheet_key = x.k || '#' || x.n
  from (select id, private.lib_key(title, author, owner) as k,
               row_number() over (partition by private.lib_key(title, author, owner) order by created_at, id) as n
          from public.library_books) x
 where b.id = x.id and b.sheet_key is null;

-- Capas que vieram da planilha (bytes da imagem). Ninguém lê direto pela API.
create table if not exists public.library_covers (
  book_id    uuid primary key references public.library_books(id) on delete cascade,
  mime       text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data       bytea not null check (octet_length(data) between 100 and 600000),
  source     text not null default 'planilha' check (source in ('planilha', 'internet')),
  updated_at timestamptz not null default now()
);
alter table public.library_covers enable row level security;
revoke all on public.library_covers from public, anon, authenticated;

-- p_rows: [{title, author, category, synopsis, owner}] na ordem da planilha.
create or replace function public.library_sync_apply(p_key text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Guarda a capa de um livro SEM capa: bytes (planilha) ou endereço https (internet).
create or replace function public.library_set_cover(p_key text, p_book uuid, p_url text default null, p_mime text default null, p_data text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Capa guardada de um livro visível (para /api/capa-livro).
create or replace function public.library_cover(p_book uuid)
returns table (mime text, data text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.mime, encode(c.data, 'base64')
    from public.library_covers c
    join public.library_books b on b.id = c.book_id
   where c.book_id = p_book and b.visible;
$$;

revoke all on function public.library_sync_apply(text, jsonb) from public;
revoke all on function public.library_set_cover(text, uuid, text, text, text) from public;
revoke all on function public.library_cover(uuid) from public;
revoke all on function private.library_key_ok(text) from public, anon, authenticated;
grant execute on function public.library_sync_apply(text, jsonb) to anon, authenticated;
grant execute on function public.library_set_cover(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.library_cover(uuid) to anon, authenticated;

-- Conferência
select 'livros no acervo' as item, count(*)::text as valor from public.library_books
union all select 'sem capa', count(*)::text from public.library_books where cover_url = ''
union all select 'chave da sincronização', case when exists (select 1 from private.library_sync_key) then 'ok' else 'faltando' end;
