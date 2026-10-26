-- Experimental ADULT pilot only. No recordings or transcripts are stored here.
create table if not exists public.recitation_ai_config (
 id integer primary key check(id=1), enabled boolean not null default false,
 privacy_reviewed boolean not null default false,
 pathfinder_monthly integer not null default 30 check(pathfinder_monthly between 0 and 200),
 guardian_monthly integer not null default 60 check(guardian_monthly between 0 and 400)
);
insert into public.recitation_ai_config(id) values(1) on conflict do nothing;
create table if not exists public.recitation_adult_pilot (
 user_id uuid primary key references auth.users(id) on delete cascade,
 approved_at timestamptz not null default now(), approved_by text not null,
 policy_version text not null check(policy_version='adult-pilot-2026-10-v1')
);
create table if not exists public.recitation_ai_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 month date not null, used integer not null default 0 check(used>=0),
 primary key(user_id,month)
);
create table if not exists public.recitation_ai_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, created_at timestamptz not null default now(),
 finished_at timestamptz, state text not null default 'pending' check(state in('pending','complete','failed')),
 metadata jsonb, feedback text check(feedback in('helpful','false_positive','false_negative','inaccurate_transcript','uncertain')),
 deleted_at timestamptz,
 primary key(user_id,request_id)
);
create index if not exists recitation_ai_recent on public.recitation_ai_requests(user_id,created_at desc);
alter table public.recitation_ai_config enable row level security;
alter table public.recitation_adult_pilot enable row level security;
alter table public.recitation_ai_usage enable row level security;
alter table public.recitation_ai_requests enable row level security;
revoke all on public.recitation_ai_config,public.recitation_adult_pilot,public.recitation_ai_usage,public.recitation_ai_requests from public,anon,authenticated;
grant all on public.recitation_ai_config,public.recitation_adult_pilot,public.recitation_ai_usage,public.recitation_ai_requests to service_role;
create or replace function public.recitation_ai_access(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.recitation_ai_config; ent jsonb; quota integer; total integer;
begin
 select * into cfg from public.recitation_ai_config where id=1;
 ent:=public.billing_entitlements_for(p_user);
 quota:=case ent->>'plan' when 'guardian' then cfg.guardian_monthly when 'pathfinder' then cfg.pathfinder_monthly else 0 end;
 select used into total from public.recitation_ai_usage where user_id=p_user and month=date_trunc('month',now() at time zone 'UTC')::date;
 return jsonb_build_object('enabled',coalesce(cfg.enabled and cfg.privacy_reviewed and (ent->'features'->>'ai')::boolean and exists(select 1 from public.recitation_adult_pilot where user_id=p_user and policy_version='adult-pilot-2026-10-v1'),false), 'allowance',quota,'used',coalesce(total,0),'period','UTC calendar month');
end $$;
create or replace function public.my_recitation_ai_access() returns jsonb
language sql security definer set search_path='' as $$select public.recitation_ai_access(auth.uid())$$;
revoke all on function public.recitation_ai_access(uuid) from public,anon,authenticated;
grant execute on function public.recitation_ai_access(uuid) to service_role;
revoke all on function public.my_recitation_ai_access() from public,anon;
grant execute on function public.my_recitation_ai_access() to authenticated;
create or replace function public.reserve_recitation_ai(p_user uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare access jsonb; m date:=date_trunc('month',now() at time zone 'UTC')::date; total integer;
begin
 -- User lock spans months and serializes rate, idempotency, and allowance checks.
 perform pg_advisory_xact_lock(hashtextextended('recitation:'||p_user::text,0));
 access:=public.recitation_ai_access(p_user);
 if not coalesce((access->>'enabled')::boolean,false) then raise exception 'Experimental AI access unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.recitation_ai_requests where user_id=p_user and request_id=p_request) then raise exception 'Request already reserved; do not retry' using errcode='23505'; end if;
 if exists(select 1 from public.recitation_ai_requests where user_id=p_user and ((state='pending' and created_at>now()-interval '90 seconds') or created_at>now()-interval '10 seconds')) or (select count(*) from public.recitation_ai_requests where user_id=p_user and created_at>now()-interval '1 hour')>=10 then raise exception 'Rate limit; try later' using errcode='P0001'; end if;
 insert into public.recitation_ai_usage(user_id,month) values(p_user,m) on conflict do nothing;
 select used into total from public.recitation_ai_usage where user_id=p_user and month=m for update;
 if total >= (access->>'allowance')::integer then raise exception 'Monthly allowance exhausted' using errcode='P0001'; end if;
 update public.recitation_ai_usage set used=used+1 where user_id=p_user and month=m;
 insert into public.recitation_ai_requests(user_id,request_id) values(p_user,p_request);
 return jsonb_build_object('used',total+1,'allowance',(access->>'allowance')::integer,'period','UTC calendar month');
end $$;
revoke all on function public.reserve_recitation_ai(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_recitation_ai(uuid,uuid) to service_role;
-- A user may remove analysis metadata, but not reset quotas or idempotency/rate ledgers.
create or replace function public.delete_my_recitation_analysis() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 update public.recitation_ai_requests set metadata=null,feedback=null,deleted_at=now() where user_id=auth.uid();
end $$;
create or replace function public.recitation_ai_feedback(p_request uuid,p_feedback text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_feedback not in('helpful','false_positive','false_negative','inaccurate_transcript','uncertain') or p_feedback is null then raise exception 'Invalid feedback' using errcode='42501'; end if;
 update public.recitation_ai_requests set feedback=p_feedback where user_id=auth.uid() and request_id=p_request and state='complete' and deleted_at is null;
 if not found then raise exception 'Analysis unavailable' using errcode='42501'; end if;
end $$;
revoke all on function public.delete_my_recitation_analysis(),public.recitation_ai_feedback(uuid,text) from public,anon;
grant execute on function public.delete_my_recitation_analysis(),public.recitation_ai_feedback(uuid,text) to authenticated;
-- Schedule daily in the operator's approved job runner; no content is retained.
create or replace function public.purge_recitation_ai_metadata() returns void
language sql security definer set search_path='' as $$delete from public.recitation_ai_requests where created_at<now()-interval '30 days'$$;
revoke all on function public.purge_recitation_ai_metadata() from public,anon,authenticated;
grant execute on function public.purge_recitation_ai_metadata() to service_role;
