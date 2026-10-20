-- Optional appearance sync is independent of memorization/progress backups.
create table if not exists public.learner_appearance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null check (jsonb_typeof(settings)='object' and settings ?& array['version','theme','reduceEffects','updatedAt'] and jsonb_typeof(settings->'updatedAt')='string' and settings->>'version'='1' and settings->>'theme' in ('simple','night-sky') and jsonb_typeof(settings->'reduceEffects')='boolean' and octet_length(settings::text)<2048),
  updated_at timestamptz not null default now()
);
alter table public.learner_appearance enable row level security;
drop policy if exists own_appearance on public.learner_appearance;
create policy own_appearance on public.learner_appearance for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.learner_appearance to authenticated;
revoke all on public.learner_appearance from anon;
