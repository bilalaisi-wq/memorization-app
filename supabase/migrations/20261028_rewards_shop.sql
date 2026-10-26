-- Cosmetic, earned-only rewards. No real-money value or paid/random purchases.
create table if not exists public.learning_reward_events(
 user_id uuid references auth.users(id) on delete cascade,event_id text not null check(event_id~'^[a-f0-9]{64}$'),
 occurred_at timestamptz not null,mode text not null check(mode in('practice','quest','recall-puzzle','active-recall','lab','chain','passage','passage-recall')),
 xp integer not null check(xp between 0 and 100),stars integer not null check(stars between 0 and 10),recalls integer not null check(recalls between 0 and 1),primary key(user_id,event_id)
);
create table if not exists public.avatar_catalog(id text primary key,kind text not null check(kind in('creature','outfit','scene')),price integer not null check(price>=0),active boolean not null default true);
create table if not exists public.nature_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 owned jsonb not null default '["sprout","garden"]',creature text not null default 'sprout',outfit text,scene text not null default 'garden',
 photo text check(photo is null or (length(photo)<=70000 and photo~'^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
 legacy_imported boolean not null default false,legacy_xp integer not null default 0,legacy_stars integer not null default 0,
 legacy_basis integer not null default 0 check(legacy_basis between 0 and 1000000),spent integer not null default 0 check(spent>=0),revision integer not null default 1
);
alter table public.learning_reward_events enable row level security;
alter table public.avatar_catalog enable row level security;
alter table public.nature_profiles enable row level security;
revoke all on public.learning_reward_events,public.avatar_catalog,public.nature_profiles from public,anon,authenticated;
grant select on public.avatar_catalog to anon,authenticated;
drop policy if exists public_catalog on public.avatar_catalog;
create policy public_catalog on public.avatar_catalog for select to anon,authenticated using(active);
insert into public.avatar_catalog(id,kind,price) values
('sprout','creature',0),
('owl','creature',80),
('fox','creature',120),
('turtle','creature',160),
('cactus','creature',200),
('butterfly','creature',240),
('scarf-lilac','outfit',35),
('scarf-teal','outfit',35),
('cape-gold','outfit',75),
('hat-rose','outfit',60),
('garden','scene',0),
('night','scene',95),
('dawn','scene',95)
on conflict(id) do update set kind=excluded.kind,price=excluded.price;
create or replace function public.my_nature_profile(expected_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.nature_profiles; earned bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_user is not null and expected_user<>auth.uid() then raise exception 'Account identity changed. Sign in again.' using errcode='42501';end if;
 insert into public.nature_profiles(user_id) values(auth.uid()) on conflict do nothing;
 select * into p from public.nature_profiles where user_id=auth.uid();
 select coalesce(sum(xp+stars*5),0)+p.legacy_basis into earned from public.learning_reward_events where user_id=auth.uid();
 return jsonb_build_object('owned',p.owned,'creature',p.creature,'outfit',p.outfit,'scene',p.scene,'photo',p.photo,'balance',earned-p.spent,'earned',earned,'spent',p.spent,'revision',p.revision,'lifetimeXp',(select coalesce(sum(xp),0) from public.learning_reward_events where user_id=auth.uid())+p.legacy_xp,'lifetimeStars',(select coalesce(sum(stars),0) from public.learning_reward_events where user_id=auth.uid())+p.legacy_stars);
end $$;
create or replace function public.sync_learning_rewards(events jsonb,legacy_basis integer default 0,legacy_xp integer default 0,legacy_stars integer default 0,expected_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; stamp timestamptz; old public.learning_reward_events; start_at timestamptz:=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC';
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_user is not null and expected_user<>auth.uid() then raise exception 'Account identity changed. Sign in again.' using errcode='42501';end if;
 if events is null or jsonb_typeof(events)<>'array' or jsonb_array_length(events)>500 or octet_length(events::text)>262144 or legacy_basis is null or legacy_basis<0 or legacy_basis>1000000 or legacy_xp is null or legacy_stars is null or legacy_xp<0 or legacy_stars<0 or legacy_basis<>legacy_xp+legacy_stars*5 then raise exception 'Invalid reward batch';end if;
 perform pg_advisory_xact_lock(hashtextextended('nature:'||auth.uid()::text,0));
 insert into public.nature_profiles(user_id)values(auth.uid())on conflict do nothing;
 for e in select value from jsonb_array_elements(events) loop
  if jsonb_typeof(e)<>'object' or not(e ?& array['id','at','mode','xp','stars','recalls']) or (select count(*) from jsonb_object_keys(e))<>6 or e->>'id'!~'^[a-f0-9]{64}$' or e->>'mode' not in('practice','quest','recall-puzzle','active-recall','lab','chain','passage','passage-recall') or jsonb_typeof(e->'xp')<>'number' or jsonb_typeof(e->'stars')<>'number' or jsonb_typeof(e->'recalls')<>'number' then raise exception 'Invalid learning receipt';end if;
  stamp:=(e->>'at')::timestamptz;
  if stamp is null or stamp>now() or stamp<'2000-01-01'::timestamptz then raise exception 'Invalid receipt timestamp';end if;
  stamp:=date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC';
  select * into old from public.learning_reward_events where user_id=auth.uid() and event_id=e->>'id';
  if found then
   if old.occurred_at<>stamp or old.mode<>e->>'mode' or old.xp<>(e->>'xp')::int or old.stars<>(e->>'stars')::int or old.recalls<>(e->>'recalls')::int then raise exception 'Receipt cannot be changed';end if;
  else
   insert into public.learning_reward_events values(auth.uid(),e->>'id',stamp,e->>'mode',(e->>'xp')::int,(e->>'stars')::int,(e->>'recalls')::int);
  end if;
 end loop;
 update public.nature_profiles set legacy_xp=case when legacy_imported then nature_profiles.legacy_xp else sync_learning_rewards.legacy_xp end,legacy_stars=case when legacy_imported then nature_profiles.legacy_stars else sync_learning_rewards.legacy_stars end,legacy_basis=case when legacy_imported then nature_profiles.legacy_basis else sync_learning_rewards.legacy_basis end,legacy_imported=legacy_imported or sync_learning_rewards.legacy_basis>0 or jsonb_array_length(events)>0 where user_id=auth.uid();
 if exists(select 1 from public.learning_reward_events where user_id=auth.uid() group by (occurred_at at time zone 'UTC')::date having sum(xp)>100000 or sum(stars)>5000 or sum(recalls)>5000 or count(*)>20000) then raise exception 'Daily reward safety limit reached';end if;
 if exists(select 1 from public.leaderboard_preferences where user_id=auth.uid() and enabled) then
  insert into public.weekly_activity(user_id,week_start,xp,stars,recalls)
  select auth.uid(),(start_at at time zone 'UTC')::date,least(700000,coalesce(sum(xp),0))::int,least(35000,coalesce(sum(stars),0))::int,least(35000,coalesce(sum(recalls),0))::int from public.learning_reward_events where user_id=auth.uid() and occurred_at>=start_at and occurred_at<=now()
  on conflict(user_id,week_start)do update set xp=greatest(weekly_activity.xp,excluded.xp),stars=greatest(weekly_activity.stars,excluded.stars),recalls=greatest(weekly_activity.recalls,excluded.recalls);
 end if;
 return public.my_nature_profile();
end $$;
-- Keep prior public totals valid while allowing legitimate XP from every learning mode.
alter table public.weekly_activity drop constraint if exists weekly_activity_xp_check;
alter table public.weekly_activity drop constraint if exists weekly_activity_stars_check;
alter table public.weekly_activity drop constraint if exists weekly_activity_recalls_check;
alter table public.weekly_activity add constraint weekly_activity_xp_check check(xp between 0 and 700000);
alter table public.weekly_activity add constraint weekly_activity_stars_check check(stars between 0 and 35000);
alter table public.weekly_activity add constraint weekly_activity_recalls_check check(recalls between 0 and 35000);
create or replace function public.buy_nature_item(item_id text,expected_price integer default null,expected_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.avatar_catalog;p public.nature_profiles;balance bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_user is not null and expected_user<>auth.uid() then raise exception 'Account identity changed. Sign in again.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('nature:'||auth.uid()::text,0));
 perform public.my_nature_profile();select * into p from public.nature_profiles where user_id=auth.uid() for update;
 select * into item from public.avatar_catalog where id=item_id and active;
 if not found then raise exception 'Item unavailable';end if;
 if p.owned ? item_id then return public.my_nature_profile();end if;
 if expected_price is not null and expected_price<>item.price then raise exception 'This item changed price. Reload the collection before buying.';end if;
 select coalesce(sum(xp+stars*5),0)+p.legacy_basis-p.spent into balance from public.learning_reward_events where user_id=auth.uid();
 if balance<item.price then raise exception 'Keep learning to earn more Seeds';end if;
 update public.nature_profiles set owned=owned||jsonb_build_array(item_id),spent=spent+item.price,revision=revision+1 where user_id=auth.uid();
 return public.my_nature_profile();
end $$;
create or replace function public.equip_nature_item(item_id text,expected_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_user is not null and expected_user<>auth.uid() then raise exception 'Account identity changed. Sign in again.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('nature:'||auth.uid()::text,0));
 perform public.my_nature_profile();
 if item_id='no-outfit' then update public.nature_profiles set outfit=null where user_id=auth.uid();return public.my_nature_profile();end if;
 if not exists(select 1 from public.nature_profiles where user_id=auth.uid() and owned ? item_id)then raise exception 'Item is not owned';end if;
 select c.kind into kind from public.avatar_catalog c where c.id=item_id;
 update public.nature_profiles set creature=case when kind='creature' then item_id else creature end,outfit=case when kind='outfit' then item_id else outfit end,scene=case when kind='scene' then item_id else scene end,revision=revision+1 where user_id=auth.uid();
 return public.my_nature_profile();
end $$;
create or replace function public.set_my_profile_photo(photo_data text,expected_user uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_user is not null and expected_user<>auth.uid() then raise exception 'Account identity changed. Sign in again.' using errcode='42501';end if;
 perform public.my_nature_profile();update public.nature_profiles set photo=photo_data,revision=revision+1 where user_id=auth.uid();
end $$;
revoke all on function public.my_nature_profile(uuid),public.sync_learning_rewards(jsonb,integer,integer,integer,uuid),public.buy_nature_item(text,integer,uuid),public.equip_nature_item(text,uuid),public.set_my_profile_photo(text,uuid) from public,anon;
grant execute on function public.my_nature_profile(uuid),public.sync_learning_rewards(jsonb,integer,integer,integer,uuid),public.buy_nature_item(text,integer,uuid),public.equip_nature_item(text,uuid),public.set_my_profile_photo(text,uuid) to authenticated;
drop function public.get_weekly_leaderboard();
create function public.get_weekly_leaderboard() returns table(alias text,xp integer,stars integer,recalls integer,avatar jsonb) language sql stable security definer set search_path='' as $$
 select p.alias,w.xp,w.stars,w.recalls,jsonb_build_object('creature',n.creature,'outfit',n.outfit,'scene',n.scene) from public.weekly_activity w join public.leaderboard_preferences p on p.user_id=w.user_id and p.enabled left join public.nature_profiles n on n.user_id=w.user_id where w.week_start=date_trunc('week',now() at time zone 'UTC')::date order by w.xp desc,w.recalls desc,p.alias limit 10
$$;
revoke all on function public.get_weekly_leaderboard() from public;
grant execute on function public.get_weekly_leaderboard() to anon,authenticated;

-- Older clients cannot replace a larger all-mode total with a partial snapshot.
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
  on conflict(user_id,week_start) do update set xp=greatest(weekly_activity.xp,excluded.xp),stars=greatest(weekly_activity.stars,excluded.stars),recalls=greatest(weekly_activity.recalls,excluded.recalls);
end $$;
