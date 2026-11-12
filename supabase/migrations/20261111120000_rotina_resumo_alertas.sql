-- ============================================================
-- RESUMO SEMANAL E ALERTAS POR E-MAIL (api/rotina.mjs)
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga nada.
--
-- O que faz:
--  1. Chave do servidor: no banco fica só o SHA-256; a chave mesmo é a
--     variável ROTINA_TOKEN da Vercel (nunca sai de lá).
--  2. private.rotina_status: como foi a última vez que cada rotina
--     automática rodou (EBD, biblioteca, notícias da sede) e o último
--     alerta enviado. Só o servidor lê e grava.
--  3. rotina_registrar(chave, tarefa, ok, detalhe): cada rotina anota
--     se deu certo (conta as falhas seguidas).
--  4. rotina_painel(chave): junta numa resposta só o que vai no resumo da
--     segunda-feira e nos alertas: eventos e avisos da semana, eventos
--     esperando conferência, livros atrasados e vencendo, pedidos novos da
--     biblioteca, sugestões da sede, lições da EBD do domingo, último
--     vídeo do YouTube e o estado das rotinas. Só leitura.
-- Nenhum dado novo de visitante é guardado aqui.
-- ============================================================

-- ---------- 1) Chave do servidor (só o hash) ----------
create schema if not exists private;
create table if not exists private.rotina_key (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);
insert into private.rotina_key (id, key_hash)
values (1, '59444c251293a94a6a03ccfb15afe1033b2110405df11b355f6174bc9b9c176a')
on conflict (id) do update set key_hash = excluded.key_hash;
revoke all on table private.rotina_key from public, anon, authenticated, service_role;

create or replace function private.rotina_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(char_length(p_key) >= 32, false)
     and exists (select 1 from private.rotina_key k
                  where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$$;
revoke all on function private.rotina_key_ok(text) from public, anon, authenticated, service_role;

-- ---------- 2) Estado das rotinas ----------
create table if not exists private.rotina_status (
  tarefa  text primary key,
  ok      boolean not null,
  detalhe text not null default '',
  em      timestamptz not null default now(),
  falhas  int not null default 0 -- falhas seguidas (volta a 0 quando dá certo)
);
revoke all on table private.rotina_status from public, anon, authenticated, service_role;

-- ---------- 3) Anotar como a rotina foi ----------
create or replace function public.rotina_registrar(p_key text, p_tarefa text, p_ok boolean, p_detalhe text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rotina_key_ok(p_key) then
    raise exception 'ROTINA_CHAVE' using errcode = '42501';
  end if;
  if p_tarefa is null or p_tarefa !~ '^[a-z-]{2,30}$' then
    raise exception 'ROTINA_TAREFA';
  end if;
  insert into private.rotina_status as s (tarefa, ok, detalhe, em, falhas)
  values (p_tarefa, coalesce(p_ok, false), left(coalesce(p_detalhe, ''), 500), now(),
          case when coalesce(p_ok, false) then 0 else 1 end)
  on conflict (tarefa) do update
    set ok = excluded.ok,
        detalhe = excluded.detalhe,
        em = excluded.em,
        falhas = case when excluded.ok then 0 else s.falhas + 1 end;
end;
$$;
revoke all on function public.rotina_registrar(text, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.rotina_registrar(text, text, boolean, text) to anon, authenticated, service_role;

-- ---------- 4) Tudo o que o resumo e os alertas precisam ----------
create or replace function public.rotina_painel(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  domingo date := hoje + ((7 - extract(dow from hoje)::int) % 7); -- hoje, se for domingo
begin
  if not private.rotina_key_ok(p_key) then
    raise exception 'ROTINA_CHAVE' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'hoje', hoje,
    'domingo', domingo,

    -- Eventos ativos dos próximos 7 dias
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', e.name, 'data', e.date, 'hora', coalesce(e.time, ''), 'local', coalesce(e.location, ''))
                       order by e.date, e.time)
        from public.events e
       where e.active is not false and e.date between hoje and hoje + 7), '[]'::jsonb),

    -- Eventos futuros DESATIVADOS (ex.: criados pelo cartaz, esperando conferência)
    'eventos_rascunho', coalesce((
      select jsonb_agg(jsonb_build_object('nome', e.name, 'data', e.date) order by e.date)
        from public.events e
       where e.active is false and e.date >= hoje), '[]'::jsonb),

    -- Avisos que valem em algum dia desta semana
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('texto', left(a.text, 200), 'ate', a.end_date) order by a.start_date nulls first)
        from public.announcements a
       where (a.start_date is null or a.start_date <= hoje + 7)
         and (a.end_date is null or a.end_date >= hoje)), '[]'::jsonb),

    -- Biblioteca: atrasados, vencendo nos próximos 7 dias e pedidos novos
    'livros_atrasados', coalesce((
      select jsonb_agg(jsonb_build_object('livro', b.title, 'leitor', r.name, 'telefone', r.phone, 'vence', l.due_on) order by l.due_on)
        from public.library_loans l
        join public.library_books b on b.id = l.book_id
        join public.library_readers r on r.id = l.reader_id
       where l.returned_on is null and l.due_on < hoje), '[]'::jsonb),
    'livros_vencendo', coalesce((
      select jsonb_agg(jsonb_build_object('livro', b.title, 'leitor', r.name, 'telefone', r.phone, 'vence', l.due_on) order by l.due_on)
        from public.library_loans l
        join public.library_books b on b.id = l.book_id
        join public.library_readers r on r.id = l.reader_id
       where l.returned_on is null and l.due_on between hoje and hoje + 7), '[]'::jsonb),
    'pedidos_biblioteca', coalesce((
      select jsonb_agg(jsonb_build_object('livro', b.title, 'nome', q.name, 'tipo', q.kind, 'em', q.created_at) order by q.created_at)
        from public.library_requests q
        join public.library_books b on b.id = q.book_id
       where q.status = 'novo'), '[]'::jsonb),

    -- Notícias da sede esperando a equipe decidir
    'sugestoes_sede', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', n.title, 'data', n.published_at::date) order by n.published_at desc)
        from public.news n
       where n.source_id is not null and not n.published and not n.dismissed), '[]'::jsonb),

    -- Lições da EBD do próximo domingo (revistas visíveis)
    'ebd', coalesce((
      select jsonb_agg(jsonb_build_object(
               'revista', q.magazine, 'numero', l.number, 'titulo', l.title, 'data', l.lesson_date,
               'publicada', l.status = 'publicado' and (l.publish_at is null or l.publish_at <= (l.lesson_date + 1)::timestamptz),
               'conteudo', l.golden_ref <> '' or l.summary <> '' or l.key_idea <> '')
             order by q.magazine)
        from public.ebd_lessons l
        join public.ebd_quarters q on q.id = l.quarter_id
       where q.visible and l.lesson_date = domingo), '[]'::jsonb),
    -- revistas visíveis cujo trimestre cobre o domingo (para notar lição que nem existe)
    'ebd_revistas', coalesce((
      select jsonb_agg(distinct q.magazine)
        from public.ebd_quarters q
       where q.visible and domingo between q.start_date and q.start_date + (q.lesson_count * 7)), '[]'::jsonb),

    -- Último vídeo que chegou sozinho do YouTube
    'ultimo_video', (select max(v.created_at) from public.videos v where v.source = 'auto'),

    -- Como as rotinas automáticas foram
    'rotinas', coalesce((
      select jsonb_object_agg(s.tarefa, jsonb_build_object('ok', s.ok, 'detalhe', s.detalhe, 'em', s.em, 'falhas', s.falhas))
        from private.rotina_status s), '{}'::jsonb)
  );
end;
$$;
revoke all on function public.rotina_painel(text) from public, anon, authenticated, service_role;
grant execute on function public.rotina_painel(text) to anon, authenticated, service_role;

-- ---------- Conferir ----------
select 'chave do servidor' as item, (select count(*) from private.rotina_key)::text as valor
union all
select 'função rotina_registrar', (to_regprocedure('public.rotina_registrar(text,text,boolean,text)') is not null)::text
union all
select 'função rotina_painel', (to_regprocedure('public.rotina_painel(text)') is not null)::text;
