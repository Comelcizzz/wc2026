-- WC2026 pool — create on the NEW Supabase project before migration.
-- Run in Supabase SQL Editor, then import the backup with:
--   node scripts/migrate-supabase.mjs --write

create table if not exists public.pool_data (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pool_data enable row level security;

-- v1-compatible open mode (same as current deployment).
-- Drop/recreate only if you are setting up a fresh project.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_data'
      and policyname = 'anon all'
  ) then
    create policy "anon all"
    on public.pool_data
    for all
    to anon
    using (true)
    with check (true);
  end if;
end $$;

-- Optional: keep updated_at fresh on writes.
create or replace function public.set_pool_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pool_data_updated_at on public.pool_data;
create trigger pool_data_updated_at
before update on public.pool_data
for each row execute function public.set_pool_data_updated_at();
