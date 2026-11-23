-- ============================================================
-- PREGAÇÃO EM ÁUDIO NO PODCAST (programa no computador: scripts/pregacao/)
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga nada.
-- Precisa ter rodado antes 20261111120000_rotina_resumo_alertas.sql.
--
-- Como funciona:
--   Um programa num computador (scripts/pregacao/rodar.mjs) roda de hora em
--   hora. Ele vê as lives que terminaram, pede ao site (Gemini) onde está a
--   pregação, baixa o áudio, corta só a pregação, envia o MP3 para o Storage
--   e publica o episódio no podcast do site.
--
-- O que este arquivo cria:
--  1. Chave do programa: no banco fica só o SHA-256; a chave mesmo fica no
--     computador (C:\Users\<você>\.pregacao-podcast\config.json), fora do GitHub.
--  2. public.pregacoes: uma linha por live (onde a pregação começa e termina,
--     pregador, tema, texto e a situação). O painel (aba Vídeos) lê e corrige.
--     Só admin liberado vê e mexe.
--  3. Funções do programa (todas conferem a chave): estado, salvar,
--     falhou, vale de envio, publicar e registrar.
--  4. "Vale de envio": o programa só consegue enviar o arquivo cujo nome o
--     banco acabou de sortear (pregacoes/<vídeo>-<sorteio>.mp3, vale 2 horas).
--     Nenhum outro envio é liberado para visitantes.
--  5. pregacao_atualizar_episodio(vídeo): o painel chama depois de corrigir
--     pregador, tema ou texto, para o título do episódio acompanhar.
-- Nenhum dado de visitante é guardado aqui.
-- ============================================================

create schema if not exists private;

-- ---------- 1) Chave do programa (só o hash) ----------
create table if not exists private.pregacao_key (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);
insert into private.pregacao_key (id, key_hash)
values (1, '6391a3de4154fc95a89b0ca69a35eead8b81ed85fc48240fb642d761eeb0d21f')
on conflict (id) do update set key_hash = excluded.key_hash;
revoke all on table private.pregacao_key from public, anon, authenticated, service_role;

create or replace function private.pregacao_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(char_length(p_key) >= 32, false)
     and exists (select 1 from private.pregacao_key k
                  where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$$;
revoke all on function private.pregacao_key_ok(text) from public, anon, authenticated, service_role;

-- O site confere a chave antes de gastar o Gemini (api/rotina/[tarefa].mjs).
create or replace function public.pregacao_chave_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.pregacao_key_ok(p_key); $$;
revoke all on function public.pregacao_chave_ok(text) from public, anon, authenticated, service_role;
grant execute on function public.pregacao_chave_ok(text) to anon, authenticated, service_role;

-- ---------- 2) As pregações ----------
create table if not exists public.pregacoes (
  video_id      text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  titulo        text not null default '',          -- título da live
  culto_em      timestamptz,                       -- quando a live começou
  inicio        int check (inicio >= 0),           -- segundos do vídeo
  fim           int,
  pregador      text not null default '',
  tema          text not null default '',
  texto         text not null default '',          -- texto bíblico
  confianca     text not null default '',
  como          text not null default '',          -- como o Gemini identificou
  status        text not null default 'conferir'
                check (status in ('conferir', 'fila', 'pronta', 'erro', 'ignorar')),
  detalhe       text not null default '',          -- última mensagem de erro
  tentativas    int not null default 0,
  episodio      uuid references public.podcasts(id) on delete set null,
  arquivo       text not null default '',          -- caminho do MP3 no Storage (bucket images)
  lixo          text[] not null default '{}',      -- MP3 antigos que o painel apaga
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or inicio is null or fim > inicio)
);
alter table public.pregacoes enable row level security;
drop policy if exists "Site admin gerencia" on public.pregacoes;
create policy "Site admin gerencia" on public.pregacoes for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
revoke all on table public.pregacoes from anon;
grant select, insert, update, delete on table public.pregacoes to authenticated;

-- Título e descrição do episódio a partir da linha (um lugar só).
create or replace function private.pregacao_campos(p public.pregacoes)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', left(
      coalesce(nullif(p.tema, ''), 'Pregação'
               || coalesce(' de ' || to_char(p.culto_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), ''))
      || case when p.pregador <> '' then ' – ' || p.pregador else '' end, 200),
    'description', concat_ws(E'\n',
      'Pregação do culto “' || nullif(p.titulo, '') || '”'
        || coalesce(', em ' || to_char(p.culto_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), '') || '.',
      'Pregador: ' || nullif(p.pregador, '') || '.',
      'Texto bíblico: ' || nullif(p.texto, '') || '.',
      'Culto completo no YouTube: https://www.youtube.com/watch?v=' || p.video_id)
  );
$$;
revoke all on function private.pregacao_campos(public.pregacoes) from public, anon, authenticated, service_role;

-- ---------- 3) Funções do programa ----------
create or replace function private.pregacao_exigir(p_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pregacao_key_ok(p_key) then
    raise exception 'PREGACAO_CHAVE' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.pregacao_exigir(text) from public, anon, authenticated, service_role;

-- O que o programa já conhece e o que tem para fazer.
create or replace function public.pregacao_estado(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pregacao_exigir(p_key);
  return jsonb_build_object(
    'conhecidos', coalesce((select jsonb_agg(p.video_id) from public.pregacoes p), '[]'::jsonb),
    'trabalho', coalesce((
      select jsonb_agg(to_jsonb(p) - 'lixo' order by p.culto_em)
        from public.pregacoes p
       where p.status = 'fila' or (p.status = 'erro' and p.tentativas < 3)), '[]'::jsonb)
  );
end;
$$;

-- Uma pregação (para o e-mail de aviso).
create or replace function public.pregacao_ler(p_key text, p_video text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pregacao_exigir(p_key);
  return (select to_jsonb(p) - 'lixo' || jsonb_build_object('episodio_titulo', e.title)
            from public.pregacoes p left join public.podcasts e on e.id = p.episodio
           where p.video_id = p_video);
end;
$$;

-- Resultado do Gemini para uma live nova. Não mexe numa live que já existe
-- (a equipe pode ter corrigido no painel). Confiança baixa ou sem início:
-- fica para conferir; senão entra na fila do áudio.
create or replace function public.pregacao_salvar(p_key text, p_video text, p_dados jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ini int := nullif(p_dados->>'inicio', '')::int;
  v_fim int := nullif(p_dados->>'fim', '')::int;
  v_conf text := coalesce(p_dados->>'confianca', '');
  v_status text;
begin
  perform private.pregacao_exigir(p_key);
  if v_fim is not null and (v_ini is null or v_fim <= v_ini) then v_fim := null; end if;
  v_status := case when v_ini is not null and v_conf in ('alta', 'media') then 'fila' else 'conferir' end;
  insert into public.pregacoes (video_id, titulo, culto_em, inicio, fim, pregador, tema, texto, confianca, como, status)
  values (p_video,
          left(coalesce(p_dados->>'titulo', ''), 200),
          nullif(p_dados->>'culto_em', '')::timestamptz,
          v_ini, v_fim,
          left(coalesce(p_dados->>'pregador', ''), 80),
          left(coalesce(p_dados->>'tema', ''), 160),
          left(coalesce(p_dados->>'texto_biblico', ''), 120),
          v_conf,
          left(coalesce(p_dados->>'como_identificou', ''), 240),
          v_status)
  on conflict (video_id) do nothing;
  return (select status from public.pregacoes where video_id = p_video);
end;
$$;

-- Não deu para gerar o áudio: anota (o programa tenta de novo até 3 vezes).
create or replace function public.pregacao_falhou(p_key text, p_video text, p_detalhe text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v int;
begin
  perform private.pregacao_exigir(p_key);
  update public.pregacoes
     set status = 'erro', tentativas = tentativas + 1, detalhe = left(coalesce(p_detalhe, ''), 500), atualizado_em = now()
   where video_id = p_video and status in ('fila', 'erro')
  returning tentativas into v;
  return v;
end;
$$;

-- ---------- 4) Vale de envio do MP3 ----------
create table if not exists private.pregacao_envio (
  nome     text primary key,
  video_id text not null,
  expira   timestamptz not null
);
revoke all on table private.pregacao_envio from public, anon, authenticated, service_role;

create or replace function public.pregacao_vale(p_key text, p_video text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_nome text;
begin
  perform private.pregacao_exigir(p_key);
  if not exists (select 1 from public.pregacoes where video_id = p_video and status in ('fila', 'erro')) then
    raise exception 'PREGACAO_FORA_DA_FILA';
  end if;
  delete from private.pregacao_envio where expira < now() - interval '2 days';
  v_nome := 'pregacoes/' || p_video || '-' || replace(gen_random_uuid()::text, '-', '') || '.mp3';
  insert into private.pregacao_envio (nome, video_id, expira) values (v_nome, p_video, now() + interval '2 hours');
  return v_nome;
end;
$$;

-- Usada pela regra do Storage abaixo: o nome tem vale válido?
create or replace function public.pregacao_envio_ok(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.pregacao_envio e where e.nome = p_nome and e.expira > now());
$$;
revoke all on function public.pregacao_envio_ok(text) from public, anon, authenticated, service_role;
grant execute on function public.pregacao_envio_ok(text) to anon, authenticated, service_role;

drop policy if exists "Programa da pregação envia o áudio" on storage.objects;
create policy "Programa da pregação envia o áudio" on storage.objects for insert to anon
  with check (bucket_id = 'images' and public.pregacao_envio_ok(name));

-- ---------- Publicar o episódio ----------
create or replace function public.pregacao_publicar(p_key text, p_video text, p_arquivo text, p_audio_url text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pregacoes;
  c jsonb;
  v_ep uuid;
begin
  perform private.pregacao_exigir(p_key);
  if not exists (select 1 from private.pregacao_envio e where e.nome = p_arquivo and e.video_id = p_video) then
    raise exception 'PREGACAO_ARQUIVO';
  end if;
  if p_audio_url !~ '^https://' or right(p_audio_url, char_length(p_arquivo) + 1) <> '/' || p_arquivo then
    raise exception 'PREGACAO_URL';
  end if;
  select * into p from public.pregacoes where video_id = p_video and status in ('fila', 'erro') for update;
  if not found then raise exception 'PREGACAO_FORA_DA_FILA'; end if;
  c := private.pregacao_campos(p);

  update public.podcasts
     set title = c->>'title', description = c->>'description', audio_url = p_audio_url,
         youtube_url = 'https://www.youtube.com/watch?v=' || p.video_id || '&t=' || coalesce(p.inicio, 0) || 's',
         status = 'Publicado', updated_at = now()
   where id = p.episodio
  returning id into v_ep;
  if v_ep is null then
    insert into public.podcasts (title, description, episode_number, cover_url, audio_url, youtube_url, published_at, status)
    values (c->>'title', c->>'description', 0,
            'https://i.ytimg.com/vi/' || p.video_id || '/hqdefault.jpg',
            p_audio_url,
            'https://www.youtube.com/watch?v=' || p.video_id || '&t=' || coalesce(p.inicio, 0) || 's',
            coalesce(p.culto_em, now()), 'Publicado')
    returning id into v_ep;
  end if;

  update public.pregacoes
     set status = 'pronta', episodio = v_ep, detalhe = '', tentativas = 0, atualizado_em = now(),
         lixo = case when arquivo <> '' and arquivo <> p_arquivo then array_append(lixo, arquivo) else lixo end,
         arquivo = p_arquivo
   where video_id = p_video;
  return v_ep;
end;
$$;

-- Como foi a rodada (entra nos alertas por e-mail: api/_lib/rotina.mjs).
create or replace function public.pregacao_registrar(p_key text, p_ok boolean, p_detalhe text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.pregacao_exigir(p_key);
  insert into private.rotina_status as s (tarefa, ok, detalhe, em, falhas)
  values ('pregacao', coalesce(p_ok, false), left(coalesce(p_detalhe, ''), 500), now(),
          case when coalesce(p_ok, false) then 0 else 1 end)
  on conflict (tarefa) do update
    set ok = excluded.ok, detalhe = excluded.detalhe, em = excluded.em,
        falhas = case when excluded.ok then 0 else s.falhas + 1 end;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.pregacao_estado(text)', 'public.pregacao_ler(text,text)', 'public.pregacao_salvar(text,text,jsonb)',
    'public.pregacao_falhou(text,text,text)', 'public.pregacao_vale(text,text)',
    'public.pregacao_publicar(text,text,text,text)', 'public.pregacao_registrar(text,boolean,text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ---------- 5) Painel: título do episódio acompanha a correção ----------
create or replace function public.pregacao_atualizar_episodio(p_video text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pregacoes;
  c jsonb;
begin
  if not public.is_site_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select * into p from public.pregacoes where video_id = p_video;
  if not found or p.episodio is null then return; end if;
  c := private.pregacao_campos(p);
  update public.podcasts set title = c->>'title', description = c->>'description', updated_at = now() where id = p.episodio;
end;
$$;
revoke all on function public.pregacao_atualizar_episodio(text) from public, anon, authenticated, service_role;
grant execute on function public.pregacao_atualizar_episodio(text) to authenticated;

-- ---------- Conferir ----------
select 'tabela pregacoes' as item, (to_regclass('public.pregacoes') is not null)::text as valor
union all
select 'chave do programa', (select count(*) from private.pregacao_key)::text
union all
select 'função pregacao_publicar', (to_regprocedure('public.pregacao_publicar(text,text,text,text)') is not null)::text
union all
select 'regra de envio do áudio', (select count(*) from pg_policies where schemaname = 'storage' and policyname = 'Programa da pregação envia o áudio')::text;
