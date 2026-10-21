-- Complete account setup, safe to rerun. Preserves existing learner rows.
-- Generated from schema.sql and migrations/*.sql.
begin;
-- Run once in your Supabase SQL editor. No service-role key belongs in the browser.
create table if not exists public.learner_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2097152),
  updated_at timestamptz not null default now()
);
create table if not exists public.leaderboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text check (alias ~ '^[A-Za-z0-9 _-]{3,24}$'),
  enabled boolean not null default false,
  consent_at timestamptz,
  check (not enabled or alias is not null)
);
create table if not exists public.weekly_activity (
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,
  xp integer not null check (xp between 0 and 7000),
  stars integer not null check (stars between 0 and 350),
  recalls integer not null check (recalls between 0 and 350),
  primary key (user_id,week_start)
);
alter table public.learner_progress enable row level security;
alter table public.leaderboard_preferences enable row level security;
alter table public.weekly_activity enable row level security;
drop policy if exists own_progress on public.learner_progress;
create policy own_progress on public.learner_progress for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists own_preference_read on public.leaderboard_preferences;
create policy own_preference_read on public.leaderboard_preferences for select to authenticated using (user_id=auth.uid());
-- Weekly/public data may only be accessed through the redacted functions below.
grant select,insert,update,delete on public.learner_progress to authenticated;
grant select on public.leaderboard_preferences to authenticated;
revoke all on public.learner_progress, public.leaderboard_preferences, public.weekly_activity from anon;
revoke insert,update,delete on public.leaderboard_preferences from authenticated;
revoke all on public.weekly_activity from authenticated;

create or replace function public.set_leaderboard_preference(enabled boolean,chosen_alias text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if enabled and (chosen_alias is null or chosen_alias !~ '^[A-Za-z0-9 _-]{3,24}$') then raise exception 'Invalid alias'; end if;
  insert into public.leaderboard_preferences(user_id,alias,enabled,consent_at)
    values(auth.uid(),case when enabled then chosen_alias else null end,enabled,case when enabled then now() else null end)
    on conflict(user_id) do update set alias=excluded.alias,enabled=excluded.enabled,consent_at=excluded.consent_at;
  if not enabled then delete from public.weekly_activity where user_id=auth.uid(); end if;
end $$;
create or replace function public.publish_weekly_activity(learning jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare start_at timestamptz := date_trunc('week',now() at time zone 'UTC') at time zone 'UTC';
begin
  if auth.uid() is null or not exists(select 1 from public.leaderboard_preferences where user_id=auth.uid() and enabled) then raise exception 'Opt in first'; end if;
  if octet_length(learning::text)>2097152 or jsonb_typeof(learning->'records')<>'object' then raise exception 'Invalid progress'; end if;
  -- Client histories are self-reported. Server caps prevent unbounded scores; this is not anti-cheat proof or speech verification.
  insert into public.weekly_activity(user_id,week_start,xp,stars,recalls)
  select auth.uid(),(start_at at time zone 'UTC')::date,coalesce(sum(least(1000,xp)),0)::integer,coalesce(sum(least(50,stars)),0)::integer,coalesce(sum(least(50,recalls)),0)::integer
  from (
    select activity_day,sum(xp) xp,sum(stars) stars,sum(recalls) recalls from (
      select ((h->>'at')::timestamptz at time zone 'UTC')::date as activity_day,
        least(1000,greatest(0,coalesce((h->>'xp')::numeric,0))) xp,
        least(50,greatest(0,coalesce((h->>'stars')::numeric,0))) stars,0 recalls
      from jsonb_each(learning->'records') r,
        lateral jsonb_array_elements(coalesce(r.value->'game'->'history','[]')) h
      where (h->>'at')::timestamptz >= start_at and (h->>'at')::timestamptz <= now()
      union all
      select ((h->>'at')::timestamptz at time zone 'UTC')::date,
        least(1000,greatest(0,coalesce((h->'reward'->>'xp')::numeric,0))),
        least(50,greatest(0,coalesce((h->'reward'->>'stars')::numeric,0))),
        case when h->>'independent'='true' then 1 else 0 end
      from jsonb_each(learning->'records') r,
        lateral jsonb_array_elements(coalesce(r.value->'memory'->'history','[]')) h
      where (h->>'at')::timestamptz >= start_at and (h->>'at')::timestamptz <= now()
    ) events group by activity_day
  ) totals
  on conflict(user_id,week_start) do update set xp=excluded.xp,stars=excluded.stars,recalls=excluded.recalls;
end $$;
create or replace function public.get_weekly_leaderboard() returns table(alias text,xp integer,stars integer,recalls integer)
language sql stable security definer set search_path='' as $$
  select p.alias,w.xp,w.stars,w.recalls from public.weekly_activity w
  join public.leaderboard_preferences p on p.user_id=w.user_id and p.enabled
  where w.week_start=date_trunc('week',now() at time zone 'UTC')::date
  order by w.xp desc,w.recalls desc,p.alias limit 10;
$$;
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from auth.users where id=auth.uid();
end $$;
revoke all on function public.set_leaderboard_preference(boolean,text),public.publish_weekly_activity(jsonb),public.delete_my_account(),public.get_weekly_leaderboard() from public;
grant execute on function public.set_leaderboard_preference(boolean,text),public.publish_weekly_activity(jsonb),public.delete_my_account() to authenticated;
grant execute on function public.get_weekly_leaderboard() to anon,authenticated;
-- Apply the retention job from docs/accounts-and-privacy.md before public launch.

-- New projects: run migrations/20261018_progress_sync.sql after this schema.

-- Existing installations: run this migration after schema.sql.
-- It adds optimistic concurrency so one device cannot silently overwrite another.
alter table public.learner_progress add column if not exists revision integer not null default 1 check (revision > 0);
create or replace function public.save_my_progress(profile_id uuid,expected_revision integer,document jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare next_revision integer;
begin
  if auth.uid() is null or auth.uid() <> profile_id then raise exception 'Account identity mismatch' using errcode='42501'; end if;
  if jsonb_typeof(document) <> 'object' or document is null or octet_length(document::text)>2097152
    or exists(select 1 from jsonb_each(document) e where jsonb_typeof(e.value)<>'string' or e.key not in ('ayah-learning-v1','ayah-learning-legacy-v1','ayah-mastery','ayah-quiz','ayah-completed','ayah-gallery-v1','ayah-puzzle-lab-v1','ayah-goals-v1','ayah-activity-v1','ayah-achievements-v1'))
    then raise exception 'Invalid progress payload'; end if;
  if expected_revision = 0 then
    insert into public.learner_progress(user_id,payload,revision,updated_at)
      values(auth.uid(),document,1,now()) on conflict(user_id) do nothing returning revision into next_revision;
  else
    update public.learner_progress set payload=document,revision=revision+1,updated_at=now()
      where user_id=auth.uid() and revision=expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'Another device updated progress. Choose which copy to keep.' using errcode='40001'; end if;
  return next_revision;
end $$;
revoke all on function public.save_my_progress(uuid,integer,jsonb) from public;
grant execute on function public.save_my_progress(uuid,integer,jsonb) to authenticated;

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

-- Billing is isolated from learning. Apply with the project owner's SQL editor.
-- Stripe credentials belong ONLY in Edge Function secrets, never VITE_* variables.
create table if not exists public.billing_config (
  id integer primary key default 1 check(id=1),
  stripe_mode text not null default 'test' check(stripe_mode in ('test','live')),
  checkout_enabled boolean not null default false,
  guardian_enabled boolean not null default false,
  ai_enabled boolean not null default false,
  advanced_ai_enabled boolean not null default false
);
insert into public.billing_config(id) values(1) on conflict do nothing;
create table if not exists public.billing_customers (
  user_id uuid not null references auth.users(id),
  mode text not null check(mode in ('test','live')),
  stripe_customer_id text not null,
  closed_at timestamptz,
  primary key(user_id,mode), unique(mode,stripe_customer_id)
);
create table if not exists public.billing_subscriptions (
  mode text not null,
  stripe_subscription_id text not null,
  user_id uuid not null,
  plan text check(plan in ('explorer','pathfinder','guardian')),
  status text not null check(status in ('active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused')),
  price_id text not null,
  period_end timestamptz,
  access_until timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(mode,stripe_subscription_id),
  foreign key(user_id,mode) references public.billing_customers(user_id,mode)
);
create table if not exists public.billing_events (
  mode text not null check(mode in ('test','live')),
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key(mode,event_id)
);
create table if not exists public.billing_locks (
  user_id uuid not null references auth.users(id),
  mode text not null check(mode in ('test','live')),
  token uuid not null,
  expires_at timestamptz not null,
  primary key(user_id,mode)
);
create table if not exists public.billing_checkouts (
  user_id uuid not null,
  mode text not null,
  request_key text not null,
  price_id text not null,
  session_id text,
  checkout_url text,
  expires_at timestamptz not null,
  primary key(user_id,mode),
  foreign key(user_id,mode) references public.billing_customers(user_id,mode)
);
create table if not exists public.billing_juz_choices (
  user_id uuid not null references auth.users(id) on delete cascade,
  juz integer not null check(juz between 1 and 29),
  primary key(user_id,juz)
);
create table if not exists public.saved_passages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 1 and 80),
  surah integer not null check(surah between 1 and 114),
  first_ayah integer not null check(first_ayah>0),
  last_ayah integer not null check(last_ayah>=first_ayah),
  created_at timestamptz not null default now()
);
-- No direct subscription writes, even from the verified owner/developer UI.
alter table public.billing_config enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_locks enable row level security;
alter table public.billing_checkouts enable row level security;
alter table public.billing_juz_choices enable row level security;
alter table public.saved_passages enable row level security;
revoke all on public.billing_config,public.billing_customers,public.billing_subscriptions,public.billing_events,public.billing_locks,public.billing_checkouts,public.billing_juz_choices,public.saved_passages from public,anon,authenticated;
drop policy if exists own_billing on public.billing_subscriptions;
create policy own_billing on public.billing_subscriptions for select to authenticated using(user_id=auth.uid());
grant select on public.billing_subscriptions to authenticated;
-- Only the backend service role (never sent to the browser) may maintain billing.
grant all on public.billing_config,public.billing_customers,public.billing_subscriptions,public.billing_events,public.billing_locks,public.billing_checkouts,public.billing_juz_choices,public.saved_passages to service_role;

create or replace function public.billing_entitlements_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cfg public.billing_config; sub public.billing_subscriptions; chosen jsonb; effective text := 'free';
begin
  select * into cfg from public.billing_config where id=1;
  select * into sub from public.billing_subscriptions s where s.user_id=p_user and s.mode=cfg.stripe_mode
    and s.status in ('active','trialing','past_due') and s.access_until>now() and s.plan is not null
    order by case s.plan when 'guardian' then 3 when 'pathfinder' then 2 else 1 end desc,s.access_until desc limit 1;
  if found then effective:=sub.plan; end if;
  select coalesce(jsonb_agg(juz order by juz),'[]'::jsonb) into chosen from public.billing_juz_choices where user_id=p_user;
  return jsonb_build_object('plan',effective,'mode',cfg.stripe_mode,'checkoutEnabled',cfg.checkout_enabled,
    'guardianEnabled',cfg.guardian_enabled,'accessUntil',case when effective<>'free' then sub.access_until else null end,
    'cancelAtPeriodEnd',coalesce(sub.cancel_at_period_end,false),'selectedJuz',chosen,
    'features',jsonb_build_object('juzAmma',true,'existingFreeFeatures',true,'basicRevision',true,
      'passageBuilder',effective<>'free','allQuran',effective in ('pathfinder','guardian'),
      'advancedRevision',effective in ('pathfinder','guardian'),'memoryAnalytics',effective in ('pathfinder','guardian'),
      'ai',effective in ('pathfinder','guardian') and cfg.ai_enabled,
      'advancedAi',effective='guardian' and cfg.ai_enabled and cfg.advanced_ai_enabled));
end $$;
create or replace function public.my_billing_entitlements() returns jsonb
language sql stable security definer set search_path='' as $$select public.billing_entitlements_for(auth.uid())$$;
revoke all on function public.billing_entitlements_for(uuid) from public,anon,authenticated;
grant execute on function public.billing_entitlements_for(uuid) to service_role;
revoke all on function public.my_billing_entitlements() from public;
grant execute on function public.my_billing_entitlements() to anon,authenticated,service_role;

create or replace function public.choose_my_juz(choices integer[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entitlement jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  -- Lock a stable owner row, so parallel selections cannot exceed the limit.
  perform 1 from public.billing_customers where user_id=auth.uid() for update;
  entitlement:=public.billing_entitlements_for(auth.uid());
  if entitlement->>'plan'<>'explorer' then raise exception 'Explorer subscription required' using errcode='42501'; end if;
  if choices is null or cardinality(choices)>5 or exists(select 1 from unnest(choices) n where n is null or n not between 1 and 29)
    or (select count(distinct n) from unnest(choices) n)<>cardinality(choices)
    then raise exception 'Choose up to five distinct additional juz'; end if;
  delete from public.billing_juz_choices where user_id=auth.uid();
  insert into public.billing_juz_choices select auth.uid(),n from unnest(choices) n;
  return public.billing_entitlements_for(auth.uid());
end $$;
revoke all on function public.choose_my_juz(integer[]) from public,anon;
grant execute on function public.choose_my_juz(integer[]) to authenticated;

create or replace function public.billing_acquire_lock(p_user uuid,p_mode text,p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  insert into public.billing_locks values(p_user,p_mode,p_token,now()+interval '5 minutes')
  on conflict(user_id,mode) do update set token=excluded.token,expires_at=excluded.expires_at
    where public.billing_locks.expires_at<now();
  get diagnostics changed=row_count;
  return changed=1;
end $$;
create or replace function public.billing_release_lock(p_user uuid,p_mode text,p_token uuid) returns void
language sql security definer set search_path='' as $$delete from public.billing_locks where user_id=p_user and mode=p_mode and token=p_token$$;
create or replace function public.billing_commit_snapshot(p_user uuid,p_mode text,p_token uuid,p_event_id text,p_event_type text,p_snapshots jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare row jsonb;
begin
  perform 1 from public.billing_locks where user_id=p_user and mode=p_mode and token=p_token and expires_at>now() for update;
  if not found then raise exception 'Billing lock expired; retry' using errcode='40001'; end if;
  if jsonb_typeof(p_snapshots)<>'array' or p_snapshots is null or jsonb_array_length(p_snapshots)>100 then raise exception 'Invalid billing snapshot'; end if;
  if p_event_id is not null then
    insert into public.billing_events(mode,event_id,event_type) values(p_mode,p_event_id,p_event_type) on conflict do nothing;
    if not found then return false; end if;
  end if;
  for row in select * from jsonb_array_elements(p_snapshots) loop
    insert into public.billing_subscriptions(mode,stripe_subscription_id,user_id,plan,status,price_id,period_end,access_until,cancel_at_period_end)
      values(p_mode,row->>'id',p_user,row->>'plan',row->>'status',row->>'priceId',(row->>'periodEnd')::timestamptz,(row->>'accessUntil')::timestamptz,coalesce((row->>'cancelAtPeriodEnd')::boolean,false))
      on conflict(mode,stripe_subscription_id) do update set plan=excluded.plan,status=excluded.status,price_id=excluded.price_id,
        period_end=excluded.period_end,access_until=excluded.access_until,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()
      where public.billing_subscriptions.user_id=p_user;
    if not found then raise exception 'Subscription owner mismatch'; end if;
  end loop;
  delete from public.billing_subscriptions where user_id=p_user and mode=p_mode and stripe_subscription_id not in (select s->>'id' from jsonb_array_elements(p_snapshots) s);
  return true;
end $$;
revoke all on function public.billing_acquire_lock(uuid,text,uuid),public.billing_release_lock(uuid,text,uuid),public.billing_commit_snapshot(uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.billing_acquire_lock(uuid,text,uuid),public.billing_release_lock(uuid,text,uuid),public.billing_commit_snapshot(uuid,text,uuid,text,text,jsonb) to service_role;
-- Prevent orphaned recurring charges. Cancellation is done through Stripe Portal first.
create or replace function public.guard_billed_account_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.billing_customers where user_id=old.id and closed_at is null) then
    raise exception 'Close billing in Subscription & billing before deleting your account';
  end if;
  if exists(select 1 from public.billing_locks where user_id=old.id and expires_at>now()) or exists(select 1 from public.billing_checkouts where user_id=old.id and expires_at>now()) then
    raise exception 'A billing operation is pending. Finish checkout or wait for it to expire before deleting your account';
  end if;
  if exists(select 1 from public.billing_subscriptions where user_id=old.id and status not in ('canceled','incomplete_expired')) then
    raise exception 'Cancel billing in the Customer Portal and refresh billing before deleting your account';
  end if;
  delete from public.billing_checkouts where user_id=old.id;
  delete from public.billing_subscriptions where user_id=old.id;
  delete from public.billing_locks where user_id=old.id;
  delete from public.billing_customers where user_id=old.id;
  return old;
end $$;
drop trigger if exists guard_billed_account_deletion on auth.users;
create trigger guard_billed_account_deletion before delete on auth.users for each row execute function public.guard_billed_account_deletion();
revoke all on function public.guard_billed_account_deletion() from public;

create or replace function public.limit_saved_passages() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from auth.users where id=new.user_id for update;
  if (select count(*) from public.saved_passages where user_id=new.user_id)>=100 then raise exception 'Saved passage limit reached (100). Remove an old passage first.'; end if;
  return new;
end $$;
drop trigger if exists limit_saved_passages on public.saved_passages;
create trigger limit_saved_passages before insert on public.saved_passages for each row execute function public.limit_saved_passages();
revoke all on function public.limit_saved_passages() from public;

commit;
