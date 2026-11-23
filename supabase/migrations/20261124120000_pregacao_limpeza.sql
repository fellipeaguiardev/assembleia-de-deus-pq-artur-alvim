-- ============================================================
-- PREGAÇÕES ANTIGAS SAEM SOZINHAS DO PODCAST (programa scripts/pregacao/)
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo; não apaga nada na hora.
-- Precisa ter rodado antes 20261123120000_pregacao_audio.sql.
--
-- Uma vez por dia, o programa do computador chama pregacao_arquivar_antigas:
--  - pregação de culto com mais de 90 dias (decisão da equipe em 23/11/2026):
--    o episódio sai do podcast (é apagado) e o MP3 vai para o "lixo";
--  - episódio de pregação que a equipe excluiu à mão no painel (Podcast):
--    o MP3 que sobrou também vai para o lixo.
-- Depois o programa apaga do Storage os MP3 do lixo. Para isso, a regra
-- abaixo deixa apagar SÓ arquivos que estão no lixo de alguma pregação
-- (pregacao_apagavel). O painel também apaga o lixo ao abrir a aba Vídeos.
-- A linha da pregação fica (situação "arquivada"): o programa não refaz a
-- live, e a equipe pode tocar em "Gerar o áudio" para trazer de volta.
-- ============================================================

alter table public.pregacoes drop constraint if exists pregacoes_status_check;
alter table public.pregacoes add constraint pregacoes_status_check
  check (status in ('conferir', 'fila', 'pronta', 'erro', 'ignorar', 'arquivada'));

-- ---------- Arquivar ----------
create or replace function public.pregacao_arquivar_antigas(p_key text, p_dias int default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antigas int := 0;
  v_soltas int := 0;
  r record;
begin
  perform private.pregacao_exigir(p_key);
  if p_dias is null or p_dias < 30 then
    raise exception 'PREGACAO_DIAS'; -- proteção: nunca menos de 30 dias
  end if;

  -- 1) culto com mais de p_dias dias: tira o episódio e manda o MP3 para o lixo
  for r in
    select p.video_id, p.episodio, p.arquivo from public.pregacoes p
     where p.status in ('pronta', 'ignorar')
       and p.culto_em < now() - make_interval(days => p_dias)
       and (p.arquivo <> '' or p.episodio is not null)
     for update
  loop
    if r.episodio is not null then
      delete from public.podcasts where id = r.episodio and episode_number = 0;
    end if;
    update public.pregacoes
       set status = 'arquivada', episodio = null, arquivo = '', atualizado_em = now(),
           lixo = case when r.arquivo <> '' then array_append(lixo, r.arquivo) else lixo end
     where video_id = r.video_id;
    v_antigas := v_antigas + 1;
  end loop;

  -- 2) episódio excluído à mão no painel: o MP3 ficou sem dono
  update public.pregacoes
     set status = 'ignorar', lixo = array_append(lixo, arquivo), arquivo = '', atualizado_em = now()
   where status = 'pronta' and episodio is null and arquivo <> '';
  get diagnostics v_soltas = row_count;

  return jsonb_build_object('antigas', v_antigas, 'soltas', v_soltas);
end;
$$;

-- ---------- Lixo ----------
-- O que apagar do Storage.
create or replace function public.pregacao_lixo(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pregacao_exigir(p_key);
  return coalesce((select jsonb_agg(distinct n) from public.pregacoes p, unnest(p.lixo) n where n like 'pregacoes/%'), '[]'::jsonb);
end;
$$;

-- O programa apagou: tira da lista.
create or replace function public.pregacao_lixo_apagado(p_key text, p_nomes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.pregacao_exigir(p_key);
  update public.pregacoes
     set lixo = array(select n from unnest(lixo) n where not n = any(p_nomes))
   where lixo && p_nomes;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.pregacao_arquivar_antigas(text,int)', 'public.pregacao_lixo(text)', 'public.pregacao_lixo_apagado(text,text[])']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- Usada pelas regras do Storage abaixo: o arquivo está no lixo de alguma pregação?
create or replace function public.pregacao_apagavel(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_nome like 'pregacoes/%' and exists (select 1 from public.pregacoes p where p_nome = any(p.lixo));
$$;
revoke all on function public.pregacao_apagavel(text) from public, anon, authenticated, service_role;
grant execute on function public.pregacao_apagavel(text) to anon, authenticated, service_role;

drop policy if exists "Programa da pregação vê o lixo" on storage.objects;
create policy "Programa da pregação vê o lixo" on storage.objects for select to anon
  using (bucket_id = 'images' and public.pregacao_apagavel(name));
drop policy if exists "Programa da pregação apaga o lixo" on storage.objects;
create policy "Programa da pregação apaga o lixo" on storage.objects for delete to anon
  using (bucket_id = 'images' and public.pregacao_apagavel(name));

-- ---------- Conferir ----------
select 'função pregacao_arquivar_antigas' as item, (to_regprocedure('public.pregacao_arquivar_antigas(text,integer)') is not null)::text as valor
union all
select 'regras do lixo no Storage', (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'Programa da pregação%')::text;
