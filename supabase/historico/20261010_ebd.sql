-- ============================================================
-- EBD — Escola Bíblica Dominical (trimestres e lições)
-- ------------------------------------------------------------
-- Como aplicar: Supabase → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Pode rodar de novo sem problema
-- (não apaga nada que já exista).
--
-- Modelo: o trimestre é cadastrado uma vez (ano, trimestre, revista/
-- faixa, tema, data da 1ª lição) e o painel cria as lições em
-- sequência, uma por domingo, como rascunho. A cada semana a equipe
-- revisa e publica a lição correspondente.
--
-- Direitos autorais: aqui ficam só referências bíblicas, textos
-- escritos pela equipe da igreja e links para a fonte oficial. O
-- texto integral da revista (CPAD) não deve ser copiado para cá.
--
-- Segurança (RLS):
--   visitantes  → leem trimestres visíveis e SÓ lições publicadas
--                 (status 'publicado' e data de publicação já passada)
--   admins      → leem e gravam tudo (função public.is_site_admin(),
--                 criada em supabase/seguranca.sql)
-- ============================================================

create table if not exists public.ebd_quarters (
  id           uuid primary key default gen_random_uuid(),
  year         int  not null check (year between 2000 and 2100),
  quarter      int  not null check (quarter between 1 and 4),
  magazine     text not null default 'Adultos',   -- revista / faixa etária
  magazine_slug text not null default 'adultos',  -- usado no endereço (/ebd/2026/4/adultos)
  theme        text not null default '',          -- tema do trimestre
  commentator  text not null default '',          -- comentarista da revista
  publisher    text not null default 'CPAD',
  source_url   text not null default '',          -- link oficial (sumário / loja)
  start_date   date not null,                     -- domingo da 1ª lição
  lesson_count int  not null default 13 check (lesson_count between 1 and 20),
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (year, quarter, magazine_slug)
);

create table if not exists public.ebd_lessons (
  id           uuid primary key default gen_random_uuid(),
  quarter_id   uuid not null references public.ebd_quarters(id) on delete cascade,
  number       int  not null check (number between 1 and 20),
  lesson_date  date not null,
  title        text not null default '',
  golden_ref   text not null default '',          -- texto áureo (só a referência)
  reading_ref  text not null default '',          -- leitura bíblica em classe (referência)
  daily_refs   text[] not null default '{}',      -- leitura diária, segunda a sábado
  key_idea     text not null default '',          -- ideia central (escrita pela equipe)
  summary      text not null default '',          -- pontos principais (escritos pela equipe)
  questions    jsonb not null default '[]'::jsonb, -- [{ "q": "...", "a": "..." }]
  links        jsonb not null default '[]'::jsonb, -- materiais complementares [{ "label", "url" }]
  source_url   text not null default '',          -- link da lição na fonte oficial
  status       text not null default 'rascunho' check (status in ('rascunho', 'revisao', 'publicado')),
  publish_at   timestamptz,                       -- opcional: publica sozinha nessa data/hora
  reviewed_by  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (quarter_id, number)
);

create index if not exists ebd_lessons_date_idx on public.ebd_lessons (lesson_date);
create index if not exists ebd_lessons_quarter_idx on public.ebd_lessons (quarter_id, number);

-- updated_at automático
create or replace function public.ebd_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ebd_quarters_touch on public.ebd_quarters;
create trigger ebd_quarters_touch before update on public.ebd_quarters
  for each row execute function public.ebd_touch_updated_at();

drop trigger if exists ebd_lessons_touch on public.ebd_lessons;
create trigger ebd_lessons_touch before update on public.ebd_lessons
  for each row execute function public.ebd_touch_updated_at();

-- ---------- RLS ----------
alter table public.ebd_quarters enable row level security;
alter table public.ebd_lessons  enable row level security;

drop policy if exists "EBD: trimestres visíveis são públicos" on public.ebd_quarters;
create policy "EBD: trimestres visíveis são públicos" on public.ebd_quarters
  for select to anon, authenticated
  using (visible or public.is_site_admin());

drop policy if exists "EBD: admin gerencia trimestres" on public.ebd_quarters;
create policy "EBD: admin gerencia trimestres" on public.ebd_quarters
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "EBD: lições publicadas são públicas" on public.ebd_lessons;
create policy "EBD: lições publicadas são públicas" on public.ebd_lessons
  for select to anon, authenticated
  using (
    public.is_site_admin()
    or (
      status = 'publicado'
      and (publish_at is null or publish_at <= now())
      and exists (select 1 from public.ebd_quarters q where q.id = quarter_id and q.visible)
    )
  );

drop policy if exists "EBD: admin gerencia lições" on public.ebd_lessons;
create policy "EBD: admin gerencia lições" on public.ebd_lessons
  for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

-- Privilégios mínimos: visitante só lê; gravação só para quem está logado
-- (e a RLS acima ainda exige ser admin).
revoke all on public.ebd_quarters, public.ebd_lessons from anon;
grant select on public.ebd_quarters, public.ebd_lessons to anon;
grant select, insert, update, delete on public.ebd_quarters, public.ebd_lessons to authenticated;
