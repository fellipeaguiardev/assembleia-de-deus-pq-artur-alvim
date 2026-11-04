# Histórico do banco (antes do baseline)

Estes arquivos foram rodados à mão no SQL Editor da produção, de 02/10 a 19/10/2026, e contam como
o banco chegou ao `supabase/migrations/00000000000000_baseline.sql`. **Tudo o que eles fazem já está
no baseline**: num banco novo, não rode nenhum deles.

Ficam fora de `supabase/migrations/` de propósito: o CLI do Supabase (`db push`) roda tudo o que
está lá, e estes arquivos não foram feitos para rodar duas vezes nem em sequência automática (alguns
pedem segredos colados à mão). Mudança nova no banco: `npx supabase@3 migration new <nome>` (veja
"Mudanças no banco" no README).
