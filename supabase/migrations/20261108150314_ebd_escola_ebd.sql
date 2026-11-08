-- ============================================================
-- EBD: nova fonte (escola-ebd.com.br) e lições liberadas sem esperar o dia
-- ------------------------------------------------------------
-- Como aplicar: npx supabase@3 db push --remote=<ref> (README, "Mudanças no
-- banco"), ou cole este arquivo no SQL Editor e clique em Run. Pode rodar de
-- novo: só troca a função e libera o que ainda estiver preso.
--
-- O que muda:
--  1. ebd_sync_apply aceita os links do escola-ebd.com.br (além do site
--     antigo, estudantesdabiblia.com.br). Link antigo de lição ou de
--     trimestre é trocado pelo do escola-ebd quando ele chega; o resto
--     continua só preenchendo o que está vazio (nunca apaga o que a equipe
--     escreveu).
--  2. Publicação automática (painel → EBD → "Publicar sozinho"): a lição
--     importada entra no ar NA HORA, mesmo antes do dia e mesmo sem
--     conteúdo ainda — o site mostra "ainda não disponível" até a fonte
--     publicar a página dela. Para segurar uma lição, marque "Em revisão".
--  3. Uma vez: lições já agendadas para depois são liberadas agora, e os
--     rascunhos com título (vindos da importação) entram no ar, se a
--     publicação automática estiver ligada.
-- Só títulos, datas, referências bíblicas e o link são guardados: o texto
-- da revista (CPAD) não é copiado.
-- ============================================================
begin;

-- ---------- Endereços aceitos ----------
create or replace function private.ebd_fonte_nova(p_url text)
returns boolean language sql immutable set search_path to ''
as $$ select starts_with(coalesce(p_url, ''), 'https://escola-ebd.com.br/') $$;

create or replace function private.ebd_fonte_antiga(p_url text)
returns boolean language sql immutable set search_path to ''
as $$ select starts_with(coalesce(p_url, ''), 'https://www.estudantesdabiblia.com.br/') $$;

create or replace function private.ebd_fonte_ok(p_url text)
returns boolean language sql immutable set search_path to ''
as $$ select coalesce(p_url, '') = '' or private.ebd_fonte_nova(p_url) or private.ebd_fonte_antiga(p_url) $$;

revoke all on function private.ebd_fonte_nova(text) from public, anon, authenticated;
revoke all on function private.ebd_fonte_antiga(text) from public, anon, authenticated;
revoke all on function private.ebd_fonte_ok(text) from public, anon, authenticated;

-- ---------- Importação ----------
CREATE OR REPLACE FUNCTION public.ebd_sync_apply(p_token text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
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
  if not private.ebd_fonte_ok(v_src) then
    raise exception 'link de origem inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'lessons') is distinct from 'array' or jsonb_array_length(p_data->'lessons') > 20 then
    raise exception 'lista de lições inválida' using errcode = '22023';
  end if;
  v_count := least(greatest(v_count, 1), 20);

  -- Trimestre: cria se não existir; se existir, só completa o que falta
  -- (e troca o link do site antigo pelo do escola-ebd)
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
      source_url   = case when q.source_url = '' or (private.ebd_fonte_antiga(q.source_url) and private.ebd_fonte_nova(v_src)) then v_src else q.source_url end,
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
    if not private.ebd_fonte_ok(v_lsrc) then
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
       or (v_lsrc <> '' and (v_row.source_url = '' or (private.ebd_fonte_antiga(v_row.source_url) and private.ebd_fonte_nova(v_lsrc))))
       or (not exists (select 1 from unnest(v_row.daily_refs) d where d <> '')
           and exists (select 1 from unnest(v_daily) d where d <> '')) then
      update public.ebd_lessons e set
        title       = case when e.title = '' then v_title else e.title end,
        golden_ref  = case when e.golden_ref = '' then v_golden else e.golden_ref end,
        reading_ref = case when e.reading_ref = '' then v_reading else e.reading_ref end,
        daily_refs  = case when not exists (select 1 from unnest(e.daily_refs) d where d <> '') then v_daily else e.daily_refs end,
        source_url  = case when v_lsrc <> '' and (e.source_url = '' or (private.ebd_fonte_antiga(e.source_url) and private.ebd_fonte_nova(v_lsrc))) then v_lsrc else e.source_url end
      where e.id = v_row.id
      returning * into v_row;
      v_filled := v_filled + 1;
    end if;

    -- Publicação automática (opcional, ligada no painel): a lição com título
    -- entra no ar na hora, sem esperar o dia nem o conteúdo (o site avisa
    -- "ainda não disponível" enquanto não houver). "Em revisão" segura.
    if v_auto and v_row.status = 'rascunho' and v_row.title <> '' then
      update public.ebd_lessons e set status = 'publicado', publish_at = null
      where e.id = v_row.id;
      v_published := v_published + 1;
    end if;
  end loop;

  return jsonb_build_object('quarter_id', v_qid, 'new_quarter', v_new_q, 'created', v_created, 'filled', v_filled, 'published', v_published);
end;
$function$;

-- Igual ao baseline: tira tudo e devolve só o EXECUTE (a função confere a
-- chave EBD_SYNC_TOKEN antes de qualquer coisa; as funções de api/ chamam com
-- a chave publicável). Sem o grant, a importação dá "permission denied"
-- (aconteceu na 1ª versão deste arquivo; consertado em 20261108152500).
revoke all on function public.ebd_sync_apply(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.ebd_sync_apply(text, jsonb) to anon, authenticated, service_role;

-- ---------- Uma vez: libera o que estava preso ----------
-- Lições já publicadas, mas agendadas para depois: no ar agora.
update public.ebd_lessons set publish_at = null
where status = 'publicado' and publish_at > now();

-- Rascunhos com título (vindos da importação): no ar, se a publicação
-- automática estiver ligada no painel. "Em revisão" não é mexido.
update public.ebd_lessons set status = 'publicado', publish_at = null
where status = 'rascunho' and title <> ''
  and coalesce((select (s.data->'ebdSync'->>'autoPublish')::boolean from public.settings s where s.id = 'main'), false);

commit;
