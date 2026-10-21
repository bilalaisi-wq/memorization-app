-- Preserve existing opt-in permissions and ranking rules; reduce public results to ten.
create or replace function public.get_weekly_leaderboard() returns table(alias text,xp integer,stars integer,recalls integer)
language sql stable security definer set search_path='' as $$
  select p.alias,w.xp,w.stars,w.recalls from public.weekly_activity w
  join public.leaderboard_preferences p on p.user_id=w.user_id and p.enabled
  where w.week_start=date_trunc('week',now() at time zone 'UTC')::date
  order by w.xp desc,w.recalls desc,p.alias limit 10;
$$;
