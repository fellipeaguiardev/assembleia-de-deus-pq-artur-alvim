-- ============================================================
-- LGPD: prazos de guarda cumpridos pelo próprio banco + ajuste de segurança
-- ------------------------------------------------------------
-- A política de privacidade (/privacidade) promete:
--   • pedidos de livros concluídos ou cancelados apagados depois de 6 meses;
--   • registros de entrada no painel apagados depois de 30 dias.
-- Antes, a limpeza só acontecia quando alguém abria a aba Biblioteca do painel
-- ou entrava no painel. Agora o pg_cron (já usado pela sincronização do YouTube)
-- faz isso todo dia às 04:30 (horário de Brasília = 07:30 UTC).
--
-- Também: fixa o search_path de 3 funções de gatilho (aviso do verificador de
-- segurança do Supabase) e tira a listagem pública dos arquivos do Storage (fim do arquivo).
-- Pode rodar mais de uma vez.
-- ============================================================

alter function public.set_news_updated_at() set search_path = '';
alter function public.set_donation_types_updated_at() set search_path = '';
alter function public.set_podcasts_updated_at() set search_path = '';

select cron.unschedule(jobid) from cron.job where jobname in ('lgpd-limpeza-diaria');

select cron.schedule(
  'lgpd-limpeza-diaria',
  '30 7 * * *',
  $$
    delete from public.library_requests
     where status in ('atendido', 'cancelado')
       and updated_at < now() - interval '6 months';
    delete from private.admin_access
     where created_at < now() - interval '30 days';
  $$
);

-- ---------- Storage: visitante não lista mais os arquivos ----------
-- As imagens continuam abrindo pelo endereço público (/storage/v1/object/public/…),
-- que não passa por estas regras. O que deixa de funcionar é só a LISTAGEM de
-- todos os nomes de arquivo por qualquer pessoa (expunha arquivos antigos e de teste).
-- Depois de rodar, abra o site e confira que as fotos aparecem normalmente.
drop policy if exists "public read church images" on storage.objects;
drop policy if exists "Site admin lista imagens" on storage.objects;
create policy "Site admin lista imagens" on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and public.is_site_admin());
