-- ============================================================
-- Conserta 20261108150314_ebd_escola_ebd.sql: a 1ª versão dela tirava a
-- permissão de rodar a importação da EBD e não devolvia (o "Sincronizar
-- agora" do painel dava "Não foi possível ler o sumário agora", e o log da
-- Vercel: "permission denied for function ebd_sync_apply").
-- Devolve só o EXECUTE, como no baseline: a função confere a chave
-- EBD_SYNC_TOKEN antes de qualquer coisa. Pode rodar de novo sem problema.
-- ============================================================
grant execute on function public.ebd_sync_apply(text, jsonb) to anon, authenticated, service_role;
