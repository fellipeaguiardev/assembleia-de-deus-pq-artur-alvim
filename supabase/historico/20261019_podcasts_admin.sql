-- ============================================================
-- PENDENTE — podcasts: gravação só para admin com a entrada liberada
-- ------------------------------------------------------------
-- Encontrado em 19/10/2026 (revisão do banco): a tabela podcasts não usa
-- is_site_admin() como as outras. Ela tem 4 políticas criadas pelo painel
-- do Supabase que comparam o e-mail de uma conta fixa (auth.email() = '...').
-- Efeito hoje:
--   - essa conta grava, edita e apaga episódios só com a senha, SEM a
--     liberação por e-mail de 12 h;
--   - os outros admins (public.admins) não conseguem gravar podcasts;
--   - a leitura pública vale só para visitante sem login (anon): quem está
--     logado e não é aquela conta vê a página do podcast vazia.
--
-- Depois deste arquivo, podcasts segue a regra de todas as tabelas:
--   - leitura dos episódios publicados para todos (anon e logados);
--   - leitura de rascunhos e gravação só para admin liberado
--     (public.is_site_admin() → public.is_admin()).
--
-- Como aplicar: Supabase → SQL Editor → cole o arquivo inteiro → Run.
-- Pode rodar de novo sem problema. Não apaga nenhum episódio.
-- ============================================================
begin;

drop policy if exists "Admin can read all podcasts"              on public.podcasts;
drop policy if exists "Authenticated admins can delete podcasts" on public.podcasts;
drop policy if exists "Authenticated admins can insert podcasts" on public.podcasts;
drop policy if exists "Authenticated admins can update podcasts" on public.podcasts;
drop policy if exists "Public can read published podcasts"       on public.podcasts;
drop policy if exists "Site admin gerencia"                      on public.podcasts;

create policy "Public can read published podcasts" on public.podcasts
  for select to anon, authenticated
  using (status = 'Publicado');

create policy "Site admin gerencia" on public.podcasts
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

commit;

-- Conferir: deve listar só as duas políticas acima.
select policyname, cmd, roles, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'podcasts'
 order by policyname;
