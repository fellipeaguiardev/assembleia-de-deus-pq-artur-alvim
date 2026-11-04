-- ============================================================
-- BIBLIOTECA DOS JOVENS — acervo, leitores, empréstimos e pedidos
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo sem problema (não
-- apaga nada que já exista).
--
-- Segurança (RLS + privilégios mínimos):
--   visitantes → veem o acervo (sem o dono do livro nem as observações
--                internas) e só a SITUAÇÃO de cada livro — emprestado?
--                volta quando? quantas pessoas esperando? — pela função
--                public.library_status(). Nomes e telefones de quem pegou
--                ou pediu um livro nunca saem do banco para visitantes.
--                Pedidos pelo site passam por public.library_request(),
--                que valida tudo e limita abusos.
--   admins     → leem e gravam tudo (public.is_site_admin(), criada em
--                supabase/seguranca.sql).
-- ============================================================

-- ---------- Tabelas ----------
create table if not exists public.library_books (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 300),
  author      text not null default '' check (char_length(author) <= 200),
  category    text not null default '' check (char_length(category) <= 80),
  synopsis    text not null default '' check (char_length(synopsis) <= 8000),
  cover_url   text not null default '' check (char_length(cover_url) <= 800),
  owner       text not null default '' check (char_length(owner) <= 120),   -- privado: dono do exemplar
  notes       text not null default '' check (char_length(notes) <= 1000),  -- privado: observações da equipe
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Quem pega livros (para aplicar as regras: limite por pessoa, suspensão por atraso).
create table if not exists public.library_readers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  phone       text not null default '' check (char_length(phone) <= 40),
  notes       text not null default '' check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.library_loans (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.library_books(id) on delete cascade,
  reader_id   uuid not null references public.library_readers(id) on delete restrict,
  loaned_on   date not null default current_date,
  due_on      date not null,
  returned_on date,
  renewals    int  not null default 0 check (renewals between 0 and 20),
  notes       text not null default '' check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (due_on >= loaned_on),
  check (returned_on is null or returned_on >= loaned_on)
);
-- Um exemplar só pode estar com uma pessoa por vez.
create unique index if not exists library_loans_one_open on public.library_loans (book_id) where returned_on is null;
create index if not exists library_loans_reader_idx on public.library_loans (reader_id);
create index if not exists library_loans_due_idx on public.library_loans (due_on) where returned_on is null;

-- Pedidos e fila de espera.
--   kind:   emprestimo (livro estava livre) | fila (livro emprestado ou já pedido)
--   status: novo (chegou pelo site) → fila (confirmado na espera) → avisado
--           (livro voltou, pessoa avisada) → atendido (virou empréstimo) | cancelado
create table if not exists public.library_requests (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.library_books(id) on delete cascade,
  kind        text not null default 'fila' check (kind in ('emprestimo', 'fila')),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  phone       text not null default '' check (char_length(phone) <= 40),
  message     text not null default '' check (char_length(message) <= 500),
  status      text not null default 'novo' check (status in ('novo', 'fila', 'avisado', 'atendido', 'cancelado')),
  source      text not null default 'site' check (source in ('site', 'equipe', 'planilha')),
  reader_id   uuid references public.library_readers(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists library_requests_book_idx on public.library_requests (book_id, status, created_at);

-- updated_at automático
create or replace function public.library_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists library_books_touch on public.library_books;
create trigger library_books_touch before update on public.library_books
  for each row execute function public.library_touch_updated_at();
drop trigger if exists library_readers_touch on public.library_readers;
create trigger library_readers_touch before update on public.library_readers
  for each row execute function public.library_touch_updated_at();
drop trigger if exists library_loans_touch on public.library_loans;
create trigger library_loans_touch before update on public.library_loans
  for each row execute function public.library_touch_updated_at();
drop trigger if exists library_requests_touch on public.library_requests;
create trigger library_requests_touch before update on public.library_requests
  for each row execute function public.library_touch_updated_at();

-- ---------- RLS ----------
alter table public.library_books    enable row level security;
alter table public.library_readers  enable row level security;
alter table public.library_loans    enable row level security;
alter table public.library_requests enable row level security;

drop policy if exists "Biblioteca: acervo visível é público" on public.library_books;
create policy "Biblioteca: acervo visível é público" on public.library_books
  for select to anon, authenticated
  using (visible or public.is_site_admin());

drop policy if exists "Biblioteca: admin gerencia o acervo" on public.library_books;
create policy "Biblioteca: admin gerencia o acervo" on public.library_books
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "Biblioteca: só admin vê leitores" on public.library_readers;
create policy "Biblioteca: só admin vê leitores" on public.library_readers
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "Biblioteca: só admin vê empréstimos" on public.library_loans;
create policy "Biblioteca: só admin vê empréstimos" on public.library_loans
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "Biblioteca: só admin vê pedidos" on public.library_requests;
create policy "Biblioteca: só admin vê pedidos" on public.library_requests
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

-- Privilégios mínimos. Visitante: só algumas colunas do acervo (sem
-- "owner" e "notes") e nada das outras tabelas.
revoke all on public.library_books, public.library_readers, public.library_loans, public.library_requests from anon;
grant select (id, title, author, category, synopsis, cover_url, visible, created_at, updated_at) on public.library_books to anon;
grant select, insert, update, delete on public.library_books, public.library_readers, public.library_loans, public.library_requests to authenticated;

-- ---------- Situação pública dos livros (sem nomes) ----------
create or replace function public.library_status()
returns table (book_id uuid, on_loan boolean, due_on date, waiting int)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
         l.id is not null,
         l.due_on,
         (select count(*)::int
            from public.library_requests r
           where r.book_id = b.id and r.status in ('novo', 'fila', 'avisado'))
    from public.library_books b
    left join public.library_loans l on l.book_id = b.id and l.returned_on is null
   where b.visible;
$$;

-- ---------- Pedido pelo site ----------
-- Valida os dados, decide se é empréstimo (livro livre) ou fila (emprestado
-- ou já pedido por alguém), evita pedido repetido e limita abusos.
-- Erros voltam como mensagens curtas (LIB_...) que o site traduz.
create or replace function public.library_request(
  p_book    uuid,
  p_name    text,
  p_phone   text,
  p_message text default '',
  p_trap    text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.library_status() from public;
revoke all on function public.library_request(uuid, text, text, text, text) from public;
grant execute on function public.library_status() to anon, authenticated;
grant execute on function public.library_request(uuid, text, text, text, text) to anon, authenticated;
