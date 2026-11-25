-- ============================================================
-- SEGURANÇA: limites contra spam, rascunhos fora da leitura pública
-- e registro do que o painel altera (auditoria de 25/11/2026)
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga dados.
-- Precisa ter rodado antes 20261111120000_rotina_resumo_alertas.sql
-- (usa a chave do servidor ROTINA_TOKEN, private.rotina_key_ok).
--
--  1. Formulário de contato (api/contato.mjs): limite guardado no banco,
--     que vale para todas as instâncias da função: no máximo 3 mensagens
--     por endereço em 10 minutos e 30 no total por hora. O IP não é
--     guardado: só um hash com sal (a chave do servidor), apagado em 1 dia.
--  2. Pedidos da biblioteca (library_request): além dos limites de antes
--     (4 por telefone, 40 por hora no total), no máximo 5 por endereço por
--     hora. Quem trocava de telefone a cada pedido esgotava os 40 da hora.
--     O hash do IP (sem sal: dá para reverter por força bruta, por isso é
--     apagado em 1 dia) fica em private.biblioteca_pedido_ip.
--  3. Eventos desativados (rascunhos, ex.: criados pelo cartaz) e vídeos
--     ocultos deixam de ser lidos por visitantes. O painel continua vendo
--     tudo pela política "Site admin gerencia".
--  4. Auditoria: toda criação, alteração e exclusão nas tabelas do site
--     (inclusive a chave PIX em donation_types e a lista de admins) fica
--     anotada em private.auditoria: quando, quem (id do login), antes e
--     depois. Só se lê pelo SQL Editor. Guarda 1 ano.
--     Consulta: select em, quem, tabela, acao, antes, depois
--                 from private.auditoria order by em desc limit 50;
-- ============================================================

create schema if not exists private;

-- ---------- 1) Formulário de contato ----------
create table if not exists private.contato_envios (
  id      bigint generated always as identity primary key,
  ip_hash text not null,
  em      timestamptz not null default now()
);
create index if not exists contato_envios_ip_em on private.contato_envios (ip_hash, em);
create index if not exists contato_envios_em on private.contato_envios (em);
revoke all on table private.contato_envios from public, anon, authenticated, service_role;

-- 'ok' (pode enviar; já conta), 'ip' (este endereço mandou demais) ou 'geral' (o site recebeu demais)
create or replace function public.contato_pode_enviar(p_key text, p_ip_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rotina_key_ok(p_key) then
    raise exception 'ROTINA_CHAVE' using errcode = '42501';
  end if;
  if coalesce(p_ip_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'CONTATO_IP';
  end if;
  delete from private.contato_envios where em < now() - interval '1 day';
  if (select count(*) from private.contato_envios
       where ip_hash = p_ip_hash and em > now() - interval '10 minutes') >= 3 then
    return 'ip';
  end if;
  if (select count(*) from private.contato_envios where em > now() - interval '1 hour') >= 30 then
    return 'geral';
  end if;
  insert into private.contato_envios (ip_hash) values (p_ip_hash);
  return 'ok';
end;
$$;
revoke all on function public.contato_pode_enviar(text, text) from public, anon, authenticated, service_role;
grant execute on function public.contato_pode_enviar(text, text) to anon, authenticated, service_role;

-- ---------- 2) Pedidos da biblioteca ----------
create table if not exists private.biblioteca_pedido_ip (
  ip_hash text not null,
  em      timestamptz not null default now()
);
create index if not exists biblioteca_pedido_ip_idx on private.biblioteca_pedido_ip (ip_hash, em);
revoke all on table private.biblioteca_pedido_ip from public, anon, authenticated, service_role;

-- Igual à do baseline, mais o limite por endereço (linhas "por endereço").
-- O endereço vem dos cabeçalhos que o PostgREST passa ao banco; sem eles,
-- valem só os limites de antes.
create or replace function public.library_request(p_book uuid, p_name text, p_phone text, p_message text default ''::text, p_trap text default ''::text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name   text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 120);
  v_phone  text := left(btrim(coalesce(p_phone, '')), 40);
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_msg    text := left(btrim(coalesce(p_message, '')), 500);
  v_kind   text;
  v_req    public.library_requests%rowtype;
  v_pos    int;
  v_hdr    json;
  v_ip     text;
  v_iph    text;
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
  -- por endereço: no máximo 5 pedidos por hora
  begin
    v_hdr := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  exception when others then
    v_hdr := '{}'::json;
  end;
  v_ip := btrim(split_part(coalesce(v_hdr->>'cf-connecting-ip', v_hdr->>'x-real-ip', v_hdr->>'x-forwarded-for', ''), ',', 1));
  v_iph := case when v_ip <> '' then encode(sha256(convert_to(v_ip, 'UTF8')), 'hex') end;
  if v_iph is not null and (select count(*) from private.biblioteca_pedido_ip i
       where i.ip_hash = v_iph and i.em > now() - interval '1 hour') >= 5 then
    raise exception 'LIB_LIMITE';
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

  -- por endereço: anota (e esquece o que tem mais de 1 dia)
  delete from private.biblioteca_pedido_ip where em < now() - interval '1 day';
  if v_iph is not null then
    insert into private.biblioteca_pedido_ip (ip_hash) values (v_iph);
  end if;

  select count(*)::int into v_pos
    from public.library_requests r
   where r.book_id = p_book and r.status in ('novo', 'fila', 'avisado');
  return jsonb_build_object('ok', true, 'kind', v_kind, 'position', v_pos);
end;
$function$;
revoke all on function public.library_request(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.library_request(uuid, text, text, text, text) to anon, authenticated, service_role;

-- ---------- 3) Rascunhos de eventos e vídeos ocultos ----------
drop policy if exists "Leitura pública events" on public.events;
drop policy if exists "Public can read events" on public.events;
drop policy if exists "Public can read active events" on public.events;
create policy "Public can read active events" on public.events
  for select to anon, authenticated using (active is not false);

drop policy if exists "Leitura pública videos" on public.videos;
drop policy if exists "Public can read videos" on public.videos;
drop policy if exists "Public can read visible videos" on public.videos;
create policy "Public can read visible videos" on public.videos
  for select to anon, authenticated using (hidden is not true);

-- ---------- 4) Auditoria ----------
create table if not exists private.auditoria (
  id       bigint generated always as identity primary key,
  em       timestamptz not null default now(),
  quem     uuid,                  -- auth.uid() de quem mudou (vazio: rotina do servidor)
  tabela   text not null,
  acao     text not null,         -- INSERT, UPDATE ou DELETE
  registro text,                  -- id da linha
  antes    jsonb,
  depois   jsonb
);
create index if not exists auditoria_em on private.auditoria (em);
create index if not exists auditoria_tabela_em on private.auditoria (tabela, em desc);
revoke all on table private.auditoria from public, anon, authenticated, service_role;

create or replace function private.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.auditoria (quem, tabela, acao, registro, antes, depois)
  values (auth.uid(), tg_table_name, tg_op,
          coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'user_id', to_jsonb(old) ->> 'user_id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  -- de vez em quando, esquece o que tem mais de 1 ano
  if random() < 0.01 then
    delete from private.auditoria where em < now() - interval '1 year';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.auditar() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['donation_types', 'settings', 'admins', 'news', 'events', 'announcements',
                           'podcasts', 'ministries', 'ministry_images', 'services', 'site_settings']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists auditoria on public.%I', t);
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function private.auditar()', t);
    end if;
  end loop;
end $$;

-- ---------- Conferir ----------
select 'limite do contato' as item, (to_regprocedure('public.contato_pode_enviar(text,text)') is not null)::text as valor
union all
select 'limite por endereço na biblioteca', (select count(*) from pg_proc where proname = 'library_request' and prosrc like '%biblioteca_pedido_ip%')::text
union all
select 'eventos/vídeos: regras de leitura pública', (select count(*) from pg_policies where schemaname = 'public' and policyname in ('Public can read active events', 'Public can read visible videos'))::text
union all
select 'tabelas com auditoria', (select count(*) from pg_trigger where tgname = 'auditoria' and not tgisinternal)::text;
