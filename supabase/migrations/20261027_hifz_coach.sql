-- Cache/usage contain no Quran text, prompts, audio, raw histories or transcripts.
create table if not exists public.hifz_coach_config (
 id integer primary key check(id=1), enabled boolean not null default false,
 privacy_reviewed boolean not null default false,
 pathfinder_monthly integer not null default 20 check(pathfinder_monthly between 0 and 200),
 guardian_monthly integer not null default 40 check(guardian_monthly between 0 and 400)
);
insert into public.hifz_coach_config(id) values(1) on conflict do nothing;
create table if not exists public.hifz_coach_usage (
 user_id uuid not null references auth.users(id) on delete cascade, month date not null,
 used integer not null default 0, last_attempt timestamptz, hour_started timestamptz, hour_used integer not null default 0,
 inflight_until timestamptz, request_id uuid, primary key(user_id,month)
);
create table if not exists public.hifz_coach_cache (
 user_id uuid not null references auth.users(id) on delete cascade, fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),
 advice jsonb not null, metadata jsonb not null, expires_at timestamptz not null, primary key(user_id,fingerprint)
);
alter table public.hifz_coach_config enable row level security;
alter table public.hifz_coach_usage enable row level security;
alter table public.hifz_coach_cache enable row level security;
revoke all on public.hifz_coach_config,public.hifz_coach_usage,public.hifz_coach_cache from public,anon,authenticated;
grant all on public.hifz_coach_config,public.hifz_coach_usage,public.hifz_coach_cache to service_role;
create or replace function public.hifz_coach_access(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.hifz_coach_config; ent jsonb; allowance integer; total integer;
begin
 select * into cfg from public.hifz_coach_config where id=1;
 ent:=public.billing_entitlements_for(p_user);
 allowance:=case ent->>'plan' when 'pathfinder' then cfg.pathfinder_monthly when 'guardian' then cfg.guardian_monthly else 0 end;
 select used into total from public.hifz_coach_usage where user_id=p_user and month=date_trunc('month',now() at time zone 'UTC')::date;
 return jsonb_build_object('enabled',coalesce(cfg.enabled and cfg.privacy_reviewed and (ent->'features'->>'ai')::boolean and exists(select 1 from public.recitation_adult_pilot where user_id=p_user),false),'used',coalesce(total,0),'allowance',allowance);
end $$;
create or replace function public.my_hifz_coach_access() returns jsonb language sql security definer set search_path='' as $$select public.hifz_coach_access(auth.uid())$$;
revoke all on function public.hifz_coach_access(uuid) from public,anon,authenticated;
grant execute on function public.hifz_coach_access(uuid) to service_role;
revoke all on function public.my_hifz_coach_access() from public,anon;
grant execute on function public.my_hifz_coach_access() to authenticated;
create or replace function public.reserve_hifz_coach(p_user uuid,p_fingerprint text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare access jsonb; cached public.hifz_coach_cache; usage public.hifz_coach_usage; m date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 access:=public.hifz_coach_access(p_user);
 if not coalesce((access->>'enabled')::boolean,false) then raise exception 'Coach access unavailable' using errcode='42501';end if;
 if p_fingerprint is null or p_fingerprint!~'^[a-f0-9]{64}$' or p_request is null then raise exception 'Invalid coach reservation';end if;
 select * into cached from public.hifz_coach_cache where user_id=p_user and fingerprint=p_fingerprint and expires_at>now();
 if found then return jsonb_build_object('cached',true,'advice',cached.advice,'metadata',cached.metadata,'usage',access);end if;
 if exists(select 1 from public.hifz_coach_usage where user_id=p_user and inflight_until>now()) then raise exception 'Coach request in progress';end if;
 insert into public.hifz_coach_usage(user_id,month) values(p_user,m) on conflict do nothing;
 select * into usage from public.hifz_coach_usage where user_id=p_user and month=m for update;
 if usage.used >= (access->>'allowance')::int then raise exception 'Monthly coach allowance exhausted';end if;
 if usage.last_attempt>now()-interval '10 seconds' or (usage.hour_started>now()-interval '1 hour' and usage.hour_used>=10) then raise exception 'Coach rate limit';end if;
 update public.hifz_coach_usage set used=used+1,last_attempt=now(),hour_started=case when hour_started>now()-interval '1 hour' then hour_started else now() end,hour_used=case when hour_started>now()-interval '1 hour' then hour_used+1 else 1 end,inflight_until=now()+interval '90 seconds',request_id=p_request where user_id=p_user and month=m;
 return jsonb_build_object('cached',false,'requestId',p_request,'usage',jsonb_build_object('used',usage.used+1,'allowance',(access->>'allowance')::int));
end $$;
create or replace function public.finish_hifz_coach(p_user uuid,p_request uuid,p_fingerprint text,p_advice jsonb,p_metadata jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 -- A cache deletion invalidates the token, preventing an in-flight write from restoring it.
 if not exists(select 1 from public.hifz_coach_usage where user_id=p_user and request_id=p_request) then return;end if;
 if p_advice is not null then
  insert into public.hifz_coach_cache(user_id,fingerprint,advice,metadata,expires_at) values(p_user,p_fingerprint,p_advice,p_metadata,now()+interval '24 hours') on conflict(user_id,fingerprint) do update set advice=excluded.advice,metadata=excluded.metadata,expires_at=excluded.expires_at;
 end if;
 update public.hifz_coach_usage set inflight_until=null,request_id=null where user_id=p_user and request_id=p_request;
end $$;
revoke all on function public.reserve_hifz_coach(uuid,text,uuid),public.finish_hifz_coach(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_hifz_coach(uuid,text,uuid),public.finish_hifz_coach(uuid,uuid,text,jsonb,jsonb) to service_role;
create or replace function public.delete_my_hifz_coach_cache() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||auth.uid()::text,0));
 delete from public.hifz_coach_cache where user_id=auth.uid();
 update public.hifz_coach_usage set request_id=null where user_id=auth.uid();
end $$;
revoke all on function public.delete_my_hifz_coach_cache() from public,anon;
grant execute on function public.delete_my_hifz_coach_cache() to authenticated;
create or replace function public.purge_hifz_coach_cache() returns void language sql security definer set search_path='' as $$delete from public.hifz_coach_cache where expires_at<=now()$$;
revoke all on function public.purge_hifz_coach_cache() from public,anon,authenticated;
grant execute on function public.purge_hifz_coach_cache() to service_role;
