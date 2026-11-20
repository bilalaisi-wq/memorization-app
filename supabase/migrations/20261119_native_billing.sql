-- Additive, provider-neutral billing. Apply AFTER the existing billing/developer migrations.
-- All purchases remain disabled until operator configuration and sandbox/policy approval.
begin;
create table if not exists public.billing_store_config (
 provider text primary key check(provider in ('apple','google')),
 environment text not null default 'sandbox' check(environment in ('sandbox','production')),
 verification_enabled boolean not null default false,
 purchase_enabled boolean not null default false,
 sandbox_approved boolean not null default false,
 policy_reviewed boolean not null default false,
 privacy_url text not null default '', terms_url text not null default ''
);
insert into public.billing_store_config(provider) values('apple'),('google') on conflict do nothing;
create table if not exists public.billing_store_products (
 provider text not null references public.billing_store_config(provider),
 product_id text not null check(length(product_id) between 1 and 200),
 base_plan_id text not null default '',
 plan text not null check(plan in ('explorer','pathfinder','guardian')),
 cadence text not null check(cadence in ('monthly','annual')),
 enabled boolean not null default false,
 primary key(provider,product_id,base_plan_id),
 check(provider<>'apple' or base_plan_id='')
);
create table if not exists public.billing_store_bindings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 account_token uuid not null unique default gen_random_uuid()
);
create table if not exists public.billing_native_subscriptions (
 provider text not null, environment text not null check(environment in ('sandbox','production')),
 chain_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 transaction_id text not null, product_id text not null, base_plan_id text not null default '',
 plan text not null check(plan in ('explorer','pathfinder','guardian')),
 status text not null check(status in ('active','grace','billing_retry','canceled','expired','revoked','pending','paused','on_hold')),
 access_until timestamptz, expires_at timestamptz, auto_renew boolean not null,
 purchase_reference text not null, superseded_by text, verified_at timestamptz not null default now(),
 primary key(provider,environment,chain_id),
 foreign key(provider,product_id,base_plan_id) references public.billing_store_products(provider,product_id,base_plan_id)
);
create table if not exists public.billing_native_transactions (
 provider text not null, environment text not null, transaction_id text not null,
 chain_id text not null, user_id uuid references auth.users(id) on delete set null,
 verified_at timestamptz not null default now(), primary key(provider,environment,transaction_id)
);
create table if not exists public.billing_native_events (
 provider text not null, environment text not null, event_id text not null,
 processed_at timestamptz not null default now(), primary key(provider,environment,event_id)
);
create table if not exists public.billing_native_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null default now(), count integer not null default 0
);
-- No client may set a provider, product map, ownership binding, receipt or entitlement.
do $$declare t text;begin
 foreach t in array array['billing_store_config','billing_store_products','billing_store_bindings','billing_native_subscriptions','billing_native_transactions','billing_native_events','billing_native_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
drop policy if exists own_native_subscription on public.billing_native_subscriptions;
create policy own_native_subscription on public.billing_native_subscriptions for select to authenticated using(user_id=auth.uid());
grant select(provider,environment,product_id,plan,status,access_until,auto_renew,verified_at) on public.billing_native_subscriptions to authenticated;

-- Preserve the current Stripe/developer implementation rather than reimplement its rules.
do $$declare definition text;begin
 if to_regprocedure('public.billing_web_entitlements_for(uuid)') is null then
  definition:=pg_get_functiondef('public.billing_entitlements_for(uuid)'::regprocedure);
  execute replace(definition,'FUNCTION public.billing_entitlements_for(', 'FUNCTION public.billing_web_entitlements_for(');
 end if;
end $$;
revoke all on function public.billing_web_entitlements_for(uuid) from public,anon,authenticated;
grant execute on function public.billing_web_entitlements_for(uuid) to service_role;
create or replace function public.billing_entitlements_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; web jsonb; native record; winner text; cfg public.billing_config; providers jsonb;
begin
 result:=public.billing_web_entitlements_for(p_user);web:=result;
 if coalesce((result->>'developer')::boolean,false) then return result; end if;
 select * into cfg from public.billing_config where id=1;
 winner:=result->>'plan';
 select s.* into native from public.billing_native_subscriptions s
 join public.billing_store_config c on c.provider=s.provider and c.environment=s.environment
 where s.user_id=p_user and c.verification_enabled and c.environment=case cfg.stripe_mode when 'test' then 'sandbox' else 'production' end and s.superseded_by is null and s.status in ('active','grace','canceled') and s.access_until>now()
 order by case s.plan when 'guardian' then 3 when 'pathfinder' then 2 else 1 end desc,s.access_until desc limit 1;
 if found and (case native.plan when 'guardian' then 3 when 'pathfinder' then 2 else 1 end)>
 (case winner when 'guardian' then 3 when 'pathfinder' then 2 when 'explorer' then 1 else 0 end) then
  winner:=native.plan;
  result:=result||jsonb_build_object('plan',winner,'accessUntil',native.access_until,'cancelAtPeriodEnd',not native.auto_renew,'provider',native.provider);
 elsif found and winner=native.plan and native.access_until>coalesce((result->>'accessUntil')::timestamptz,'epoch') then
  result:=result||jsonb_build_object('accessUntil',native.access_until,'cancelAtPeriodEnd',not native.auto_renew,'provider',native.provider);
 end if;
 if result->>'provider' is null and winner<>'free' then result:=result||jsonb_build_object('provider','stripe');end if;
 select coalesce(jsonb_agg(jsonb_build_object('provider',s.provider,'plan',s.plan,'status',s.status,'accessUntil',s.access_until,'autoRenew',s.auto_renew)),'[]'::jsonb) into providers
 from public.billing_native_subscriptions s join public.billing_store_config c on c.provider=s.provider and c.environment=s.environment
 where s.user_id=p_user;
 if (web->>'plan')<>'free' then
  providers:=providers||jsonb_build_array(jsonb_build_object('provider','stripe','plan',web->>'plan','accessUntil',web->>'accessUntil'));
 end if;
 return result||jsonb_build_object('providers',providers,'features',coalesce(result->'features','{}')||jsonb_build_object(
 'juzAmma',true,'existingFreeFeatures',true,'basicRevision',true,'passageBuilder',winner<>'free',
 'allQuran',winner in ('pathfinder','guardian'),'advancedRevision',winner in ('pathfinder','guardian'),
 'memoryAnalytics',winner in ('pathfinder','guardian'),'ai',winner in ('pathfinder','guardian') and cfg.ai_enabled,
 'advancedAi',winner='guardian' and cfg.ai_enabled and cfg.advanced_ai_enabled));
end $$;
-- Replace the public forwarding function too, including databases with pre-bound SQL bodies.
create or replace function public.my_billing_entitlements() returns jsonb language sql stable security definer set search_path='' as $$select public.billing_entitlements_for(auth.uid())$$;
revoke all on function public.billing_entitlements_for(uuid) from public,anon,authenticated;
grant execute on function public.billing_entitlements_for(uuid) to service_role;

create or replace function public.billing_native_rate(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;begin
 insert into public.billing_native_requests(user_id,count) values(p_user,1)
 on conflict(user_id) do update set count=case when billing_native_requests.window_start<now()-interval '1 minute' then 1 else billing_native_requests.count+1 end,
 window_start=case when billing_native_requests.window_start<now()-interval '1 minute' then now() else billing_native_requests.window_start end returning count into n;
 return n<=20;
end $$;
create or replace function public.billing_native_commit(p_user uuid,p_lock uuid,p_mode text,p_snapshot jsonb,p_event text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner uuid; cfg public.billing_store_config; product public.billing_store_products; new_event boolean:=true;
begin
 perform 1 from public.billing_locks where user_id=p_user and mode=p_mode and token=p_lock and expires_at>now() for update;
 if not found then raise exception 'Billing lock expired';end if;
 select * into cfg from public.billing_store_config where provider=p_snapshot->>'provider';
 if not found or not cfg.verification_enabled or cfg.environment<>p_snapshot->>'environment' then raise exception 'Store environment unavailable';end if;
 select * into product from public.billing_store_products where provider=cfg.provider and product_id=p_snapshot->>'product_id' and base_plan_id=coalesce(p_snapshot->>'base_plan_id','');
 if not found then raise exception 'Unknown store product';end if;
 -- Lock the authenticated owner and chain. The service cannot accidentally reassign a receipt.
 select user_id into owner from public.billing_store_bindings where account_token=(p_snapshot->>'account_token')::uuid;
 if owner is distinct from p_user then raise exception 'Purchase belongs to another account';end if;
 perform pg_advisory_xact_lock(hashtextextended(cfg.provider||cfg.environment||(p_snapshot->>'chain_id'),0));
 select user_id into owner from public.billing_native_subscriptions where provider=cfg.provider and environment=cfg.environment and chain_id=p_snapshot->>'chain_id';
 if found and owner<>p_user then raise exception 'Purchase already assigned';end if;
 if p_event is not null then
  insert into public.billing_native_events values(cfg.provider,cfg.environment,p_event,now()) on conflict do nothing;
  if not found then new_event:=false;end if;
 end if;
 insert into public.billing_native_transactions(provider,environment,transaction_id,chain_id,user_id)
 values(cfg.provider,cfg.environment,p_snapshot->>'transaction_id',p_snapshot->>'chain_id',p_user)
 on conflict(provider,environment,transaction_id) do update set verified_at=now()
 where billing_native_transactions.user_id=excluded.user_id;
 if not found then raise exception 'Transaction already assigned';end if;
 insert into public.billing_native_subscriptions(provider,environment,chain_id,user_id,transaction_id,product_id,base_plan_id,plan,status,access_until,expires_at,auto_renew,purchase_reference)
 values(cfg.provider,cfg.environment,p_snapshot->>'chain_id',p_user,p_snapshot->>'transaction_id',product.product_id,product.base_plan_id,product.plan,p_snapshot->>'status',
 (p_snapshot->>'access_until')::timestamptz,(p_snapshot->>'expires_at')::timestamptz,(p_snapshot->>'auto_renew')::boolean,p_snapshot->>'purchase_reference')
 on conflict(provider,environment,chain_id) do update set transaction_id=excluded.transaction_id,product_id=excluded.product_id,base_plan_id=excluded.base_plan_id,plan=excluded.plan,status=excluded.status,
 access_until=excluded.access_until,expires_at=excluded.expires_at,auto_renew=excluded.auto_renew,purchase_reference=excluded.purchase_reference,verified_at=now();
 -- Google replacement tokens supersede their old chain without touching another owner's record.
 if cfg.provider='google' and p_snapshot->>'linked_reference' is not null then
  if exists(select 1 from public.billing_native_subscriptions where provider='google' and environment=cfg.environment and chain_id=p_snapshot->>'linked_reference' and user_id<>p_user) then raise exception 'Linked purchase belongs to another account';end if;
  update public.billing_native_subscriptions set status='expired',access_until=null,superseded_by=p_snapshot->>'chain_id' where provider='google' and environment=cfg.environment and chain_id=p_snapshot->>'linked_reference' and user_id=p_user;
 end if;
 return new_event;
end $$;
revoke all on function public.billing_native_rate(uuid),public.billing_native_commit(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.billing_native_rate(uuid),public.billing_native_commit(uuid,uuid,text,jsonb,text) to service_role;
-- Lock the account row even when an Explorer has never had a Stripe customer.
create or replace function public.choose_my_juz(choices integer[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare entitlement jsonb;begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform 1 from auth.users where id=auth.uid() for update;
 entitlement:=public.billing_entitlements_for(auth.uid());
 if entitlement->>'plan'<>'explorer' then raise exception 'Explorer subscription required' using errcode='42501';end if;
 if choices is null or cardinality(choices)>5 or exists(select 1 from unnest(choices) n where n is null or n not between 1 and 29) or (select count(distinct n) from unnest(choices) n)<>cardinality(choices) then raise exception 'Choose up to five distinct additional juz';end if;
 delete from public.billing_juz_choices where user_id=auth.uid();insert into public.billing_juz_choices select auth.uid(),n from unnest(choices) n;
 return public.billing_entitlements_for(auth.uid());
end $$;
create table if not exists public.billing_native_reservations (
 user_id uuid primary key references auth.users(id) on delete cascade,
 request_id uuid not null default gen_random_uuid(), expires_at timestamptz not null
);
alter table public.billing_native_reservations enable row level security;
revoke all on public.billing_native_reservations from public,anon,authenticated;
grant all on public.billing_native_reservations to service_role;
create or replace function public.billing_native_start(p_user uuid,p_provider text,p_product text,p_base text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare cfg public.billing_store_config; request uuid;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into cfg from public.billing_store_config where provider=p_provider;
 if not found or not cfg.verification_enabled or not cfg.purchase_enabled or (cfg.environment='production' and (not cfg.sandbox_approved or not cfg.policy_reviewed)) then raise exception 'Native purchases are not released';end if;
 if exists(select 1 from public.billing_checkouts where user_id=p_user and expires_at>now()) or exists(select 1 from public.billing_locks where user_id=p_user and expires_at>now()) then raise exception 'Another billing operation is pending';end if;
 if public.billing_entitlements_for(p_user)->>'plan'<>'free' then raise exception 'An existing subscription already provides access. Manage it before buying another.';end if;
 perform 1 from public.billing_store_products where provider=p_provider and product_id=p_product and base_plan_id=p_base and enabled and (plan<>'guardian' or (select guardian_enabled from public.billing_config where id=1));
 if not found then raise exception 'Store product unavailable';end if;
 if cfg.environment='production' and (cfg.privacy_url!~'^https://' or cfg.terms_url!~'^https://') then raise exception 'Publish privacy and subscription terms before release';end if;
 insert into public.billing_native_reservations(user_id,expires_at) values(p_user,now()+interval '10 minutes')
 on conflict(user_id) do update set request_id=gen_random_uuid(),expires_at=excluded.expires_at where billing_native_reservations.expires_at<now()
 returning request_id into request;
 if request is null then raise exception 'Another purchase is pending. Restore purchases or wait ten minutes.';end if;
 return request;
end $$;
revoke all on function public.billing_native_start(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_native_start(uuid,text,text,text) to service_role;


create or replace function public.billing_native_checkout_guard(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=p_user for update;
 return not exists(select 1 from public.billing_native_subscriptions s join public.billing_store_config c on c.provider=s.provider and c.environment=s.environment
 where s.user_id=p_user and s.superseded_by is null and s.status in ('active','grace','canceled') and s.access_until>now())
 and not exists(select 1 from public.billing_native_reservations where user_id=p_user and expires_at>now());
end $$;
revoke all on function public.billing_native_checkout_guard(uuid) from public,anon,authenticated;
grant execute on function public.billing_native_checkout_guard(uuid) to service_role;

select pg_notify('pgrst','reload schema');
commit;
