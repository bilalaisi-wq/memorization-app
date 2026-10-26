-- Run after billing setup. Owner identity is verified against auth.users, never request data.
begin;
create table if not exists public.site_developers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false
);
alter table public.site_developers enable row level security;
revoke all on public.site_developers from public,anon,authenticated;
-- Existing verified owner only. If not signed up yet, sign in first and rerun this file.
insert into public.site_developers(user_id)
select id from auth.users where lower(email)='bilalaisi@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
create or replace function public.developer_enabled(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.site_developers where user_id=p_user and enabled)
$$;
revoke all on function public.developer_enabled(uuid) from public,anon,authenticated;
grant execute on function public.developer_enabled(uuid) to service_role;
create or replace function public.set_my_developer_mode(active boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.site_developers set enabled=active where user_id=auth.uid();
 if not found then raise exception 'Developer account required' using errcode='42501'; end if;
 return active;
end $$;
revoke all on function public.set_my_developer_mode(boolean) from public,anon;
grant execute on function public.set_my_developer_mode(boolean) to authenticated;
create table if not exists public.site_layout (
 id integer primary key check(id=1), menu_order jsonb not null default '[]'::jsonb
 check(jsonb_typeof(menu_order)='array' and octet_length(menu_order::text)<10000)
);
insert into public.site_layout(id) values(1) on conflict do nothing;
alter table public.site_layout enable row level security;
revoke all on public.site_layout from public,anon,authenticated;
grant select on public.site_layout to anon,authenticated;
drop policy if exists read_layout on public.site_layout;
create policy read_layout on public.site_layout for select using(true);
create or replace function public.save_site_menu(items jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.developer_enabled(auth.uid()) then raise exception 'Active developer mode required' using errcode='42501'; end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>100 or exists(select 1 from jsonb_array_elements(items) x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>150) then raise exception 'Invalid menu order';end if;
 update public.site_layout set menu_order=items where id=1;
end $$;
revoke all on function public.save_site_menu(jsonb) from public,anon;
grant execute on function public.save_site_menu(jsonb) to authenticated;
create or replace function public.billing_entitlements_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cfg public.billing_config; sub public.billing_subscriptions; chosen jsonb; effective text := 'free';
begin
  if public.developer_enabled(p_user) then
    return jsonb_build_object('plan','pathfinder','developer',true,'mode','test','checkoutEnabled',false,'selectedJuz','[]'::jsonb,
      'features',jsonb_build_object('juzAmma',true,'existingFreeFeatures',true,'basicRevision',true,'passageBuilder',true,'allQuran',true,'advancedRevision',true,'memoryAnalytics',true,'ai',false,'advancedAi',false));
  end if;
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
select pg_notify('pgrst','reload schema');
commit;
