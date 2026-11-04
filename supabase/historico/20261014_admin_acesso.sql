-- ============================================================
-- SEGURANÇA DO PAINEL — admins por usuário + aprovação por e-mail
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo sem problema.
--
-- O que muda:
--  1. Quem é admin deixa de ser uma lista de e-mails no código: fica
--     na tabela public.admins (id do usuário), sem nenhum acesso pela
--     API. O site não precisa mais saber o e-mail do admin.
--  2. Segundo fator por e-mail: ao entrar no painel com e-mail e senha,
--     a função api/admin-acesso.mjs (Vercel) manda um e-mail com
--     "Liberar acesso" / "Não fui eu". Só depois de liberar, AQUELA
--     sessão (session_id do login) pode gravar — por 12 horas.
--  3. public.is_admin() = é admin E a sessão foi liberada. A função
--     antiga public.is_site_admin(), usada por TODAS as políticas de
--     escrita (tabelas e Storage), passa a chamar is_admin(): nenhuma
--     política precisa ser reescrita.
--  4. Bucket "images": limite de 50 MB e só imagens e áudio.
--  5. No fim, um relatório de auditoria (tabelas sem RLS e políticas
--     de escrita abertas) aparece como resultado da consulta.
--
-- Se um dia ficar trancado para fora (e-mail não chega): rode no SQL
-- Editor o bloco "LIBERAÇÃO DE EMERGÊNCIA" do README.
-- ============================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- 1) Admins ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
-- (sem políticas: ninguém lê nem grava pela API; só as funções abaixo)

-- Os dois administradores de hoje (contas com e-mail confirmado).
-- AVISO (19/10/2026): esta lista serviu só para preencher a tabela na
-- primeira vez. A fonte oficial agora é a própria public.admins; para
-- adicionar ou remover um admin, veja o README (não edite este arquivo).
insert into public.admins (user_id)
select u.id from auth.users u
 where lower(u.email) in ('adparque@gmail.com', 'fellipe.aguiar1058@gmail.com')
   and u.email_confirmed_at is not null
on conflict (user_id) do nothing;

-- ---------- 2) Pedidos de liberação (um por login) ----------
create table if not exists private.admin_access (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  session_id     uuid not null,
  token_hash     text not null unique,
  status         text not null default 'pendente' check (status in ('pendente', 'permitido', 'negado', 'expirado')),
  info           jsonb not null default '{}'::jsonb,   -- aparelho, local aproximado, IP
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,                 -- o link do e-mail vale 20 min
  decided_at     timestamptz,
  approved_until timestamptz                           -- a sessão liberada vale 12 h
);
create index if not exists admin_access_session_idx on private.admin_access (session_id);
create index if not exists admin_access_user_idx on private.admin_access (user_id, created_at);

-- Chave do servidor (só o hash; a chave fica na variável ADMIN_ACCESS_TOKEN da Vercel)
create table if not exists private.admin_access_key (
  id         int primary key default 1 check (id = 1),
  key_hash   text not null,
  updated_at timestamptz not null default now()
);
insert into private.admin_access_key (id, key_hash)
values (1, '29e1d0ae07d61661123274458bf55426efc5f2f23e0b19c5e5a86b2559d91be5')
on conflict (id) do update set key_hash = excluded.key_hash, updated_at = now();

create or replace function private.admin_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_access_key k
     where p_key is not null and length(p_key) >= 32
       and k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  )
$$;
revoke all on function private.admin_key_ok(text) from public;

-- ---------- 3) Quem pode gravar ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and exists (
       select 1 from private.admin_access s
        where s.user_id = auth.uid()
          and s.session_id::text = coalesce(auth.jwt() ->> 'session_id', '')
          and s.status = 'permitido'
          and s.approved_until > now()
     )
$$;

-- A função usada por todas as políticas de escrita passa a exigir a liberação.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
$$;

-- ---------- 4) Funções usadas pela Vercel (protegidas pela chave do servidor) ----------
-- Cria o pedido de liberação de uma sessão. Devolve o e-mail da conta
-- para a função montar a mensagem.
create or replace function public.admin_access_request(
  p_key        text,
  p_user       uuid,
  p_session    uuid,
  p_token_hash text,
  p_info       jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Mostra o pedido na página do link do e-mail (sem decidir nada).
create or replace function public.admin_access_peek(p_key text, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Decide pelo botão da página: libera (12 h) ou bloqueia.
create or replace function public.admin_access_decide(p_key text, p_token_hash text, p_allow boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Para o painel saber em que pé está a sessão atual (sem chave: usa o login).
create or replace function public.admin_session_status()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.admin_access_request(text, uuid, uuid, text, jsonb) from public;
revoke all on function public.admin_access_peek(text, text) from public;
revoke all on function public.admin_access_decide(text, text, boolean) from public;
revoke all on function public.admin_session_status() from public, anon;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.admin_access_request(text, uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.admin_access_peek(text, text) to anon, authenticated;
grant execute on function public.admin_access_decide(text, text, boolean) to anon, authenticated;
grant execute on function public.admin_session_status() to authenticated;

-- ---------- 5) Bucket "images": tamanho e tipos aceitos ----------
-- Leitura pública continua; envio/edição/remoção já exigem is_site_admin()
-- (políticas de supabase/seguranca.sql), que agora exige a liberação.
update storage.buckets
   set file_size_limit = 52428800, -- 50 MB (áudio do podcast); imagens são bem menores
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav'
       ]
 where id = 'images';

-- ---------- 6) Relatório de auditoria (aparece como resultado) ----------
select 'tabela sem RLS' as problema, c.relname as onde, '' as detalhe
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'escrita aberta (using/with check true)', p.tablename, p.policyname || ' [' || p.cmd || ' para ' || array_to_string(p.roles, ',') || ']'
  from pg_policies p
 where p.schemaname in ('public', 'storage')
   and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   and (coalesce(p.qual, '') in ('true', '(true)') or coalesce(p.with_check, '') in ('true', '(true)'))
union all
select 'escrita para visitante (anon/public)', p.tablename, p.policyname || ' [' || p.cmd || ']'
  from pg_policies p
 where p.schemaname in ('public', 'storage')
   and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   and (p.roles && array['anon', 'public']::name[])
union all
select 'bucket', b.id, 'público=' || b.public || ' · limite=' || coalesce(b.file_size_limit::text, 'sem limite') || ' · tipos=' || coalesce(array_to_string(b.allowed_mime_types, ','), 'todos')
  from storage.buckets b
union all
select 'admins cadastrados', count(*)::text, '' from public.admins;
