-- ============================================================
-- SEGURANÇA DO BANCO (RLS) — rodar no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Problemas encontrados em 02/10/2026:
--  1. A tabela "events" permite que QUALQUER visitante (anon)
--     crie, edite e apague eventos usando a chave pública.
--  2. Nas demais tabelas, qualquer usuário logado (não só o
--     admin) pode escrever. Existem 2 contas no Auth hoje.
--
-- Este script deixa a escrita só para admin com a entrada liberada.
-- A leitura pública continua igual. Pode rodar mais de uma vez.
--
-- Quem é admin: a tabela public.admins (a única fonte; veja "Adicionar ou
-- remover um admin" no README). A conferência é public.is_admin(): está na
-- tabela E a sessão foi liberada por e-mail (12 h). Precisa do
-- 20261014_admin_acesso.sql (ou do 00000000000000_baseline.sql) aplicado antes.
-- (Até 14/10/2026 esta função comparava uma lista de e-mails escrita aqui.)
-- ============================================================

-- Todas as políticas de escrita (tabelas e Storage) chamam is_site_admin(),
-- que só repassa para is_admin().
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
$$;

-- 1) Remove as políticas que liberam escrita para visitantes
drop policy if exists "Permitir update dos eventos" on public.events;
drop policy if exists "Permitir inserir eventos"    on public.events;
drop policy if exists "Permitir excluir eventos"    on public.events;

-- 2) Remove políticas de escrita "qualquer usuário logado"
drop policy if exists "Authenticated can manage announcements"  on public.announcements;
drop policy if exists "Admin write announcements"               on public.announcements;
drop policy if exists "Authenticated can manage donation types" on public.donation_types;
drop policy if exists "Authenticated can manage events"         on public.events;
drop policy if exists "Admin write events"                      on public.events;
drop policy if exists "Authenticated can manage ministries"     on public.ministries;
drop policy if exists "Admin write ministries"                  on public.ministries;
drop policy if exists "Authenticated can insert ministry images" on public.ministry_images;
drop policy if exists "Authenticated can update ministry images" on public.ministry_images;
drop policy if exists "Authenticated can delete ministry images" on public.ministry_images;
drop policy if exists "authenticated can insert ministry images" on public.ministry_images;
drop policy if exists "authenticated can update ministry images" on public.ministry_images;
drop policy if exists "authenticated can delete ministry images" on public.ministry_images;
drop policy if exists "Authenticated can manage news"           on public.news;
drop policy if exists "Authenticated can manage services"       on public.services;
drop policy if exists "Admin write services"                    on public.services;
drop policy if exists "Admin write settings"                    on public.settings;
drop policy if exists "Authenticated can manage site settings"  on public.site_settings;
drop policy if exists "Admin write site_settings"               on public.site_settings;
drop policy if exists "Authenticated can manage videos"         on public.videos;
drop policy if exists "Admin write videos"                      on public.videos;
-- podcasts: políticas antigas presas a um e-mail fixo (veja 20261019_podcasts_admin.sql)
drop policy if exists "Admin can read all podcasts"              on public.podcasts;
drop policy if exists "Authenticated admins can delete podcasts" on public.podcasts;
drop policy if exists "Authenticated admins can insert podcasts" on public.podcasts;
drop policy if exists "Authenticated admins can update podcasts" on public.podcasts;

-- 3) Cria uma política única de escrita para o admin em cada tabela
do $$
declare t text;
begin
  foreach t in array array[
    'announcements','donation_types','events','ministries','ministry_images',
    'news','podcasts','services','settings','site_settings','videos'
  ] loop
    execute format('drop policy if exists "Site admin gerencia" on public.%I', t);
    execute format(
      'create policy "Site admin gerencia" on public.%I for all to authenticated
         using (public.is_site_admin()) with check (public.is_site_admin())', t);
  end loop;
end $$;

-- 4) Storage: só o admin envia/edita/apaga arquivos do bucket "images"
drop policy if exists "Admin upload de imagens"             on storage.objects;
drop policy if exists "Admin update de imagens"             on storage.objects;
drop policy if exists "Admin delete de imagens"             on storage.objects;
drop policy if exists "authenticated upload church images"  on storage.objects;
drop policy if exists "authenticated update church images"  on storage.objects;
drop policy if exists "authenticated delete church images"  on storage.objects;
drop policy if exists "Site admin envia imagens"            on storage.objects;
drop policy if exists "Site admin edita imagens"            on storage.objects;
drop policy if exists "Site admin apaga imagens"            on storage.objects;

create policy "Site admin envia imagens" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_site_admin());
create policy "Site admin edita imagens" on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_site_admin())
  with check (bucket_id = 'images' and public.is_site_admin());
create policy "Site admin apaga imagens" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_site_admin());

-- Recomendado também: Authentication → Sign In / Providers →
-- desativar "Allow new users to sign up".
