-- Run once in your Supabase SQL editor. No service-role key belongs in the browser.
create table public.learner_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2097152),
  updated_at timestamptz not null default now()
);
create table public.leaderboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text check (alias ~ '^[A-Za-z0-9 _-]{3,24}$'),
  enabled boolean not null default false,
  consent_at timestamptz,
  check (not enabled or alias is not null)
);
create table public.weekly_activity (
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
create policy own_progress on public.learner_progress for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy own_preference_read on public.leaderboard_preferences for select to authenticated using (user_id=auth.uid());
-- Weekly/public data may only be accessed through the redacted functions below.
grant select,insert,update,delete on public.learner_progress to authenticated;
grant select on public.leaderboard_preferences to authenticated;
revoke all on public.learner_progress, public.leaderboard_preferences, public.weekly_activity from anon;
revoke insert,update,delete on public.leaderboard_preferences from authenticated;
revoke all on public.weekly_activity from authenticated;

create function public.set_leaderboard_preference(enabled boolean,chosen_alias text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if enabled and (chosen_alias is null or chosen_alias !~ '^[A-Za-z0-9 _-]{3,24}$') then raise exception 'Invalid alias'; end if;
  insert into public.leaderboard_preferences(user_id,alias,enabled,consent_at)
    values(auth.uid(),case when enabled then chosen_alias else null end,enabled,case when enabled then now() else null end)
    on conflict(user_id) do update set alias=excluded.alias,enabled=excluded.enabled,consent_at=excluded.consent_at;
  if not enabled then delete from public.weekly_activity where user_id=auth.uid(); end if;
end $$;
create function public.publish_weekly_activity(learning jsonb) returns void
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
create function public.get_weekly_leaderboard() returns table(alias text,xp integer,stars integer,recalls integer)
language sql stable security definer set search_path='' as $$
  select p.alias,w.xp,w.stars,w.recalls from public.weekly_activity w
  join public.leaderboard_preferences p on p.user_id=w.user_id and p.enabled
  where w.week_start=date_trunc('week',now() at time zone 'UTC')::date
  order by w.xp desc,w.recalls desc,p.alias limit 50;
$$;
create function public.delete_my_account() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from auth.users where id=auth.uid();
end $$;
revoke all on function public.set_leaderboard_preference(boolean,text),public.publish_weekly_activity(jsonb),public.delete_my_account(),public.get_weekly_leaderboard() from public;
grant execute on function public.set_leaderboard_preference(boolean,text),public.publish_weekly_activity(jsonb),public.delete_my_account() to authenticated;
grant execute on function public.get_weekly_leaderboard() to anon,authenticated;
-- Apply the retention job from docs/accounts-and-privacy.md before public launch.
