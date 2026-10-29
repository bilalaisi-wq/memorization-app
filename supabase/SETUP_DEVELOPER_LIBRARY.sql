-- Paste this ENTIRE file into Supabase SQL Editor and Run.
-- Includes billing, private storage, review schema/source metadata and developer access.
-- No Stripe keys required. New billing defaults to disabled test mode.
-- Preserves existing progress, reviews, billing configuration and menu layout.
-- Sign in once as bilalaisi@gmail.com before running to provision that verified owner.
begin;

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


-- Isolated from the existing progress RPC so older servers keep free sync working.
create table if not exists public.passage_learning (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null,
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.passage_learning enable row level security;
revoke all on public.passage_learning from public,anon,authenticated;
grant select on public.passage_learning to authenticated;
drop policy if exists own_passage_learning on public.passage_learning;
create policy own_passage_learning on public.passage_learning for select to authenticated using(user_id=auth.uid());
create or replace function public.save_my_passage_learning(expected_revision integer,document jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare revision integer;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if document->>'version' is distinct from '1' or jsonb_typeof(document->'records') is distinct from 'object' or document is null or octet_length(document::text)>524288 then raise exception 'Invalid passage progress';end if;
 if expected_revision=0 then
  insert into public.passage_learning(user_id,document) values(auth.uid(),document) on conflict do nothing returning passage_learning.revision into revision;
 else
  update public.passage_learning set document=save_my_passage_learning.document,revision=passage_learning.revision+1,updated_at=now()
   where user_id=auth.uid() and passage_learning.revision=expected_revision returning passage_learning.revision into revision;
 end if;
 if revision is null then raise exception 'Another device has newer passage progress. Export both copies before restoring.' using errcode='40001';end if;
 return revision;
end $$;
revoke all on function public.save_my_passage_learning(integer,jsonb) from public,anon;
grant execute on function public.save_my_passage_learning(integer,jsonb) to authenticated;
-- Supabase Storage is present on hosted projects, absent in plain SQL test fixtures.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public) values('quran-premium','quran-premium',false) on conflict(id) do update set public=false;
  execute 'drop policy if exists quran_premium_bucket_server_only on storage.buckets';
  execute 'create policy quran_premium_bucket_server_only on storage.buckets as restrictive for all to anon,authenticated using (id <> ''quran-premium'') with check (id <> ''quran-premium'')';
  execute 'drop policy if exists quran_premium_server_only on storage.objects';
  execute 'create policy quran_premium_server_only on storage.objects as restrictive for all to anon,authenticated using (bucket_id <> ''quran-premium'') with check (bucket_id <> ''quran-premium'')';
 end if;
end $$;


-- Staff roles are granted by a project administrator, never by email/UI state.
create table if not exists public.quran_reviewers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 120),
 credentials text not null check(length(trim(credentials)) between 1 and 500),
 role text not null check(role in ('teacher','scholar')),
 enabled boolean not null default false
);
create table if not exists public.quran_review_heads (
 verse_key text primary key check(verse_key ~ '^[0-9]+:[0-9]+$'),
 revision integer not null default 0,
 total_words integer not null,
 source_hash text not null,
 duration_ms integer not null
);
create table if not exists public.quran_review_versions (
 verse_key text not null references public.quran_review_heads(verse_key),
 version integer not null,
 source_hash text not null,
 reviewer_id uuid references auth.users(id) on delete set null,
 reviewer_name text not null,
 reviewer_credentials text not null,
 reviewed_at timestamptz not null default now(),
 source_edition text not null,
 riwayah text not null,
 segments jsonb not null,
 primary key(verse_key,version)
);
alter table public.quran_reviewers enable row level security;
alter table public.quran_review_heads enable row level security;
alter table public.quran_review_versions enable row level security;
revoke all on public.quran_reviewers,public.quran_review_heads,public.quran_review_versions from public,anon,authenticated;
grant all on public.quran_reviewers,public.quran_review_heads,public.quran_review_versions to service_role;
create or replace function public.is_quran_reviewer(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$select exists(select 1 from public.quran_reviewers where user_id=p_user and enabled)$$;
revoke all on function public.is_quran_reviewer(uuid) from public,anon,authenticated;
grant execute on function public.is_quran_reviewer(uuid) to service_role;
create or replace function public.my_quran_review_role() returns jsonb
language sql stable security definer set search_path='' as $$select jsonb_build_object('name',display_name,'credentials',credentials,'role',role) from public.quran_reviewers where user_id=auth.uid() and enabled$$;
revoke all on function public.my_quran_review_role() from public,anon;
grant execute on function public.my_quran_review_role() to authenticated;
create or replace function public.get_segmentation_review(reference text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_quran_reviewer(auth.uid()) then raise exception 'Qualified reviewer access required' using errcode='42501';end if;
 return jsonb_build_object('head',(select to_jsonb(h) from public.quran_review_heads h where verse_key=reference),
 'history',coalesce((select jsonb_agg(to_jsonb(v) order by version desc) from public.quran_review_versions v where verse_key=reference),'[]'::jsonb));
end $$;
create or replace function public.submit_segmentation_review(reference text,expected_revision integer,source_hash text,source_edition text,riwayah text,segments jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare staff public.quran_reviewers; head public.quran_review_heads; s jsonb; next_word integer:=1; next_id integer:=1; n integer; start_at integer; end_at integer;
begin
 select * into staff from public.quran_reviewers where user_id=auth.uid() and enabled;
 if not found then raise exception 'Qualified reviewer access required' using errcode='42501';end if;
 select * into head from public.quran_review_heads where verse_key=reference for update;
 if not found or head.source_hash<>submit_segmentation_review.source_hash then raise exception 'Canonical source hash differs. Reload the verified source.';end if;
 if head.revision<>expected_revision then raise exception 'Another reviewer saved a revision. Reload before saving.' using errcode='40001';end if;
 if length(trim(source_edition)) not between 1 and 250 or length(trim(riwayah)) not between 1 and 150 or source_edition is null or riwayah is null then raise exception 'Edition and riwayah required';end if;
 if segments is null or jsonb_typeof(segments)<>'array' or jsonb_array_length(segments)<1 or jsonb_array_length(segments)>head.total_words or octet_length(segments::text)>65536 then raise exception 'Invalid segmentation';end if;
 for s in select * from jsonb_array_elements(segments) loop
  if exists(select 1 from jsonb_object_keys(s) k where k not in ('id','startWord','endWord','displayStatus','stopStatus','restartWord','pauseMark','boundaryType','topic','audioStartMs','audioEndMs','audioApproved','note')) then raise exception 'Only boundary metadata may be edited';end if;
  n:=(s->>'id')::integer;start_at:=(s->>'startWord')::integer;end_at:=(s->>'endWord')::integer;
  if n is null or n<>next_id or start_at is null or start_at<>next_word or end_at is null or end_at<start_at or end_at>head.total_words then raise exception 'Word gap, overlap, repetition, or invalid boundary';end if;
  if s->>'displayStatus' is null or s->>'displayStatus' not in ('pending_review','approved','rejected') or s->>'stopStatus' is null or s->>'stopStatus' not in ('pending_review','approved','rejected') then raise exception 'Separate display/stop decisions required';end if;
  if s->>'stopStatus'='approved' and source_edition ilike '%to be confirmed%' then raise exception 'Confirm the exact source Mushaf edition before approving recitation stops';end if;
  if s->>'stopStatus'='approved' and ((s->>'restartWord') is null or (s->>'restartWord')::integer not between 1 and head.total_words) then raise exception 'An approved restart word is required';end if;
  if coalesce((s->>'audioApproved')::boolean,false) and (s->>'stopStatus'<>'approved' or (s->>'audioStartMs') is null or (s->>'audioEndMs') is null or (s->>'audioStartMs')::numeric<0 or (s->>'audioEndMs')::numeric<=(s->>'audioStartMs')::numeric or (s->>'audioEndMs')::numeric>head.duration_ms) then raise exception 'Reviewed stop and valid audio timing range required';end if;
  next_word:=end_at+1;next_id:=next_id+1;
 end loop;
 if next_word<>head.total_words+1 then raise exception 'Words omitted';end if;
 insert into public.quran_review_versions(verse_key,version,source_hash,reviewer_id,reviewer_name,reviewer_credentials,source_edition,riwayah,segments)
 values(reference,head.revision+1,head.source_hash,auth.uid(),staff.display_name,staff.credentials,submit_segmentation_review.source_edition,submit_segmentation_review.riwayah,submit_segmentation_review.segments);
 update public.quran_review_heads set revision=head.revision+1 where verse_key=reference;
 return head.revision+1;
end $$;
revoke all on function public.get_segmentation_review(text),public.submit_segmentation_review(text,integer,text,text,text,jsonb) from public,anon;
grant execute on function public.get_segmentation_review(text),public.submit_segmentation_review(text,integer,text,text,text,jsonb) to authenticated;

-- Pin reviews to the exact authoritative bundle/audio generation. Changing a hash
-- requires a fresh review; prior audit versions are never overwritten.
-- Public review metadata contains no Qur'anic content or payment information.
-- Free text stays usable even when this optional service is unavailable.
create or replace function public.published_segmentation_review(reference text,source_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('verseKey',v.verse_key,'version',v.version,'sourceHash',v.source_hash,'sourceEdition',v.source_edition,'riwayah',v.riwayah,'reviewerName',v.reviewer_name,'reviewedAt',v.reviewed_at,'segments',v.segments)
 from public.quran_review_versions v where v.verse_key=reference and v.source_hash=published_segmentation_review.source_hash order by v.version desc limit 1
$$;
revoke all on function public.published_segmentation_review(text,text) from public;
grant execute on function public.published_segmentation_review(text,text) to anon,authenticated;


-- Automatically prepared source registry. No approvals are created.
insert into public.quran_review_heads(verse_key,total_words,source_hash,duration_ms) values
('98:5',16,'13ad57fcb070a644619f4adf5f436276ddfc8bde9eb77ba813b1c531adb1a166',20689),
('98:6',16,'51403b89da7b64c8399c9e3f5d4d1bb1ab19728a4fcef0ad2e262b65ef621de5',18207),
('98:8',21,'f32cc30ba73c80d4dee53c4e8dd033b4f6219424f6c264304afe30594558b489',27063),
('85:10',14,'ace4a9d8055b8bfcb20c2b0fb177d5ccaa999d5d4a4ba51a25057e168482c581',18024),
('85:11',14,'44c550318e593ef6b80e540523d685312a0478c7091610ad91cc281a4a8cd38d',21786),
('78:38',14,'58a97b8d3b84f03d702f9e5224626cecae27d5172fa1b8d515d72d5916c02039',19696),
('78:40',15,'9318aa97210299a5977246dcee1d5aaa068f4ab6466f8e0a050d97ca007cb380',33672),
('67:3',18,'05a01f143057634844e69bbb2653604d87c6d5d57b26bb3130035fd4ca357635',19043),
('67:8',13,'5804a83392d19f6832ffa87bdc0cbe5030b90b8e852c32e05820a3f2299dd456',18965),
('67:9',18,'34e0e32e230eabb82c8ba58a9fff31e144ccd134375eed77d5845dd7b0ea78ff',20480),
('67:15',14,'f77dfe6963cddb3eac5617c9a10cb1f2eda491907defcb4955fb8fe5c2ee5f2e',15360),
('67:19',15,'86a43a3e02eafa0ee01d98ccb006e58a58d89b35da53cee9bd256f0c0b1dbc19',25078),
('67:20',15,'0d0cacf246349741fc488d580bf12e47ec76d2cf5070a382e919ff0422e37191',19827),
('67:27',13,'76b6ca19cd3f74540d06420dfb5c7d3cafcd181103ca749c00142629681dc0a5',17476),
('67:28',15,'5ad637e043c280168d9e23bc0cb669d06c5f73df95abc3d2c5aecd3c24a830c9',20349),
('67:29',13,'83f9f40fe57ef1e50080947ec6b24d8902bd1867bf5170a84ec67d67096a423e',15621),
('2:255',50,'762baf15b923f544dcc1c5b2c404fab9030e375cefac917cac6c50a40ebc6d55',51958),
('2:282',128,'b2ec22e91675ff6ebf61efdae72585a1fb0c4dad471451a5e901ce6c0984dcb2',144849),
('69:7',15,'4371d2c1fb930f07c74f68d2ba929306161fef810cc29a0e69f27ee74b77ea01',19435),
('71:1',14,'c59c454bc25f1c14a0064ba760e90ecfc18ee04364481bf605aeb4fb39a7c3b5',16953),
('71:4',18,'541adaaee0707f2df5cfe113f18d068129c487a9b251b94c3571e036f915533d',22361),
('71:7',14,'703938fcb471c69a6c52d790b76be86e120269149a62be302b4d90b79088a71d',25704),
('71:21',13,'2b104f56d144a3a2a4fc8bd84a46d62cfe91b675719547d169acaf175c52966b',13087),
('71:23',13,'1350290796dccaf5f76b807824327a4b699baaf862cda09e762f8d96c08028bf',13479),
('71:28',15,'1948ccedc77d372502a0ad7c5e12ff6a0c4b441e2f1029b6453b91ba95214a22',19461),
('72:1',13,'c87e4302eb25496097a20234b237559d687c26c443c889f2a96ff1b9749cc275',14002),
('72:9',13,'509e0f7f6669568932846feb9065632b7ddbff9deb235dbc9517c637429ef568',13244),
('72:10',13,'6ff281047c4fc564d7dcc3ede9b4e69b702bbe25053e9f6a29708bed0dbbf6ac',12408),
('72:13',14,'93f5f695953f69071790f4012774aabb9824544ac89ebb7f4052d188d9f89fb2',17162),
('72:23',16,'6e2dd84768c01cac309ca0e5cb64efe627143b980987a432ed33d0d99c0f77c8',23798),
('72:27',13,'ea5801f1948500d9adeacf9adc02bb94b897c9196d5d97b58b7e0a88ab3998b9',12199),
('72:28',13,'de0bf2bba740d8eb189aec2b0588ad0134cc1c0bb2215c34b0d3df56c7c371da',15229),
('73:20',78,'2c3a80005e91a1c17682007ca5a1a8a3143c189a594f88295a46b964b4e27340',89678),
('74:31',57,'8aecf9ad2f9ce08ef12134d050b29a1027201d1c75bc18df324dce28155e2615',65123),
('76:21',13,'2e2acfd6ac3af5fe40ebfae80c8381b85e5419b49d32ed11ed5c3721cda948f2',18207)
on conflict(verse_key) do nothing;


-- Run after billing setup. Owner identity is verified against auth.users, never request data.
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

-- Source registration only; no study/waqf/restart approvals are granted.
insert into public.quran_review_heads(verse_key,total_words,source_hash,duration_ms) values
('7:1',1,'efc8e64075ad397ef72aeb754418b930504537184cfc0c006d9381086454dffa',13793),
('7:2',13,'514c9446a2437540908113752adbea77ecf05d0568e0dbc9d8014fc56020a114',15151),
('7:3',14,'51455cd4315d7ec41891d67e3f586b9abe201db587fbca84048b8330be714fd5',23327),
('7:4',10,'4ef9b368688d6b1d9c951b7745f0f3bca437f17e55266be4d977d7541e1abcf9',16327),
('7:5',12,'e243e0b9da16aa9e0a4ed934febcba9edf0dd3f113a84666e99dc725b033b434',26619),
('7:6',6,'1827ffb623aae55e7b64c040404f8f3d600e7238c78bfee63d9abcc6ce68fbe7',11468),
('7:7',6,'030f40cb198b4af2d1bd689926aa577bc8717d3b27782f0a36a6eac5e8a2ac1b',13140),
('7:8',9,'af21ea7c71b0b825011e36f177153e0e196ed22b7bfb35dd5790eec15ecb4e40',14733),
('7:9',11,'59782a05b67ddc4038663e351e5e392a4db06bbfba0e385596c44f309503a779',19252),
('7:10',11,'bf027b89b304890147a701fc618ca6cabd4b1885aecc4b40c4008162a00b1c77',15020),
('7:11',16,'1219fa365090959ee5ae9deea7abb101be71383956af4b81f0e8c3d01cd33aeb',25940),
('7:12',17,'b8387e65099c60500310cbf11aebf5ee6a2abb4d3a097921e8adc20fe3ebdf9f',17920),
('7:13',13,'1e532bc2fee9ea0a93aac34b46b0c93e9808bf8c58da31ed32138802c38502db',13688),
('7:14',5,'3d0b22f68175fbfc483e2787818b4804ee2758ed840808b57355d4db7766918a',9587),
('7:15',4,'938d7263747832f853cfd34cd76c29dd026a00fc666a6c81f6955cef26f5389a',7706),
('7:16',7,'dfaa90fdda605b97b407e23b4ea9633e852d96ff30580b607870c6c19f296232',12016),
('7:17',15,'00114adb43191e5689fd982d81269b8c12e704fdb8d1be70e6a04d9480641567',21786),
('7:18',12,'e2e193b0dc72f95befeef6d73c1fa704c529d0afda33ac4da64d83d5928975ae',17868),
('7:19',16,'414c032b64b5efb79fbfa9960adf1ee83cde38c831559f83224b9761bc0956a8',22387),
('7:20',25,'59624e0fe1ec9ab161d667fbc8982b9bc879d42ae236900df2db72fc39b751a6',26906),
('7:21',5,'8cd3e101f9aafc08dfbbc68603c0b1d87c62daf4a5f723e5e68a29d10f4a40f5',10867),
('7:22',28,'65199e8d6f7b0a3ea5aabcad4fe220797ec136161f852d7a2040c839953e019b',46655),
('7:23',12,'1aa828166468ebe755c35ed1886f4b6abb72a1a0b995fe5e665b49f6955ff7fb',17685),
('7:24',12,'797398f288a7f234f2598051ea9ede1c6430fee5791c362b6c1e0b854bf31d1b',14655),
('7:25',7,'d9633180d99ba6e28b056c72b41c009da0b184532c58f5d8dc61d16e3a36145c',11520),
('7:26',19,'9d6516f9882d9808a306458258af1368448e7d78194f26d95c36bffd7f723aee',26723),
('7:27',30,'7a6cb2fc99769665c98addad9e8e7337411bd18c75bfa63658bbb08a5c3d5349',43572),
('7:28',22,'ac3112b1afdbb0e1b1eb72314b643946e911ce454fda6b48bead9038b4c99864',30903),
('7:29',16,'cc7b70d71b5b825f4d0c5ab7e61e42fa07b90b61d3c2a62694722e4a2323e5d9',20689),
('7:30',16,'6dd26d374d0ad64bac9d02cc60023b0ff6b3f757329f0618ad3fcf42bc42ddb4',29100),
('7:31',15,'a59af3724b6b8c6f7ce7fa6fc4818b13975f8c57e2484fd6d46ff6c49a702bba',19069),
('7:32',26,'bc0b4a7d3b1f4715ad017d3dd8801fa0acfb3adfbea4f9337aa38233d55be6c2',30067),
('7:33',29,'850f6f27d0036132da1bcd6f64fc9acc77b34eeed209021a469cf18547340010',31634),
('7:34',11,'84ce3c1c0dabfa7b2fac7032f0e37e8dc85b6a683369fb717030e27e64019471',16353),
('7:35',18,'8bb1ccb5b16bc37d81daa9c5311e1e86dd55df2ffed5c2398aa97f3fc6ee6e37',23223),
('7:36',11,'263e6117fe55e13aca6e2581982a43f862df752c349d6a7f48789d8878ab030c',19618),
('7:37',37,'3fc17493997cf0a116573c7e61d435aa7a2281a84de8e26b7e08961a8e140b8f',55406),
('7:38',40,'7824284cd4ba0814d34ca859e8bedccb3cda6703a69df2db5333bb2ec94393db',62041),
('7:39',14,'f0a9d346c3e17b204cc4d3186ba25fae0d3c3916962752a5d034ec6d5a7b77b2',20219),
('7:40',23,'e9c82ccbfaaf6a5a321d869f79cc0c76db1858ba1a7fea06dab29dfb9fdf4c4a',33672),
('7:41',10,'bd8be6b896dc702f6e4147a704a30df5049f3ec2e25402ecfb155d841415d1f3',15804),
('7:42',15,'a47659c2adcddfd87c6ba3b4204022951d7e4c59ce5c81f48b50e7cdf5221b67',30407),
('7:43',36,'30e9132ea588266e9f4590563d5c0581dda2a7f0453bcef5a56c2d48eed26e8b',48823),
('7:44',28,'1f920617fe37d2c14785ecb1fd779900cdb0648be8f28d29dd064dd5f5f5e88a',35422),
('7:45',10,'fd3ed4874cf9f7ce236534dbc364b078a00b264b1bbfb64b81febf9548fc9f92',15256),
('7:46',18,'7c0b85a3cbc0aeaf44ad97ea6fc082dd7cf62b5be8bc1418255a2407abd902ba',27638),
('7:47',13,'766b9781174f8c2b2c4843e186c12682cfebb7da5a168e86403d028db3cadd74',20872),
('7:48',14,'71cc6990c9352fd4ce64dbb03a391e4a88daabfdbdca127d9c11be34fefff8ab',29283),
('7:49',15,'f16ded3648ff6e97e7bbd4215165f04e94a2baa63a26c0a5455e3848929f0342',23928),
('7:50',20,'697b72161256878f6c5cda97c47bdb4d526440cb7f9050e4c461ac45f62ab62f',36362),
('7:51',19,'bf7350f511ab0ecbe52cf1d5c2e69a6337be247957e9cb63d7e4fe6eae194cfa',27272),
('7:52',10,'123e33e766eb708d7147cbae1aa9f363fe1017ce29195f14b6ad8ecbe3f4e90b',15909),
('7:53',38,'afeeefc2d402cde1c81322f56257fb4674bf2fcb63ffcb4b40004c6510c5f487',47909),
('7:54',32,'9025a798ff708b89e3dc5dfecf135d91c322a6255bf5b832175101a88d99d2d6',41117),
('7:55',8,'bbe839a0c86fd39107362cffb32e1570683e7d888589dca26b61d518a68fdcb7',11598),
('7:56',15,'1eef310bccb305bf08f564bd2ad0ab9b5e441e3507188c61066fc678d26aea36',17058),
('7:57',29,'7ccca40b808366e22b01e761231f948e47d5502dad28dc510664c8e2d6f13c93',41900),
('7:58',17,'72a1eddac58782b2bc03212fd3765e6af922677ddd8f726d27fb2637b9f721d8',20010),
('7:59',20,'7c263885b4bb0d1544f13fc60d079e4fd2f1fc5532d1d0d07d324858bac950da',29074),
('7:60',9,'5cfa3cb05052ea801ed4867db3051c9792c96a3b663c73fec3a1ca52c54181bc',12251),
('7:61',10,'44fef33a7e0197c7e7632399974d7157f68f1e39e4b493d4d2cb29047274959b',12147),
('7:62',11,'972c91ae8e8a508e052772494b24f50a4932067451e200848855083276004fb9',11703),
('7:63',13,'d882b6d18356018b482729c51c18c9fcf1d91d3ceacd46bfa5715bf85a5ca91b',21734),
('7:64',14,'8582af3ae2b21278be6b18160d714d3890d44a310f07ec1bdddfc9571ebf70b2',20323),
('7:65',15,'124c3af728f90857f4413c71862b37685c9bcaf4842024af580945d63717baff',16405),
('7:66',14,'30bc1616f518d5bd5fb6eb13312dc3036c57fef35964ac65e9f7a3454e854f53',23249),
('7:67',10,'02b9b66ce782cf141a5430b8a65635abcd595182d0d30e56b4d297588cdb7a5e',12643),
('7:68',7,'548d61f34036c7c49db774b938455589f2b13b8dd31038a7dd87c6e36c604d71',8046),
('7:69',27,'f7b687d6195d91e160a2eef04d1e07200d2b05b6815f93b348faf4623aab1e36',37355),
('7:70',17,'083fdacf87b44bafed7b9b0e55e71a78dececeec01bca556e9b171ea3b5c4542',23171),
('7:71',25,'418df7a08c5df45f2f335fbe8d6f3e3d2409f48ab3a3505dc71bd5a22a0f912c',46472),
('7:72',13,'27aebd517870866f2f28d7358513ec377930c66c393a1e2484b257117be70e86',26201),
('7:73',34,'842d8884c325ae07348050afe196a7e167bad15a8084dbb3931b3ed0894c996b',45192),
('7:74',25,'ff5c5c66dd2e7a9161dad12017628859a0da706c1031b132eab22ea4c9471c25',36284),
('7:75',23,'027c5543bc072576189591f7a25dd72602301d4f660815087f8d6efaedf15c69',32157),
('7:76',8,'35b0529d94ed75e8e8eade289c812d649db30cb6a6c232587b8dc840fffb3751',15099),
('7:77',15,'f43586f65dc59940f8d76e3f3d6e867d676db24e5dcc155f17fe1004ccd3733f',25417),
('7:78',6,'73412e1f0c7a70fd300d71dd0a813e0757d569e67bb2c773405621c93deae70a',8594),
('7:79',14,'69a2c97c331fc5a9952cfb2bbd10207ee1ee2cf64fd44cdc782576c76ff88c8a',20793),
('7:80',13,'dbe27af24216c606fb23a81d9a70f24813f86638a7f85a024a05a0e4b0c13bad',15935),
('7:81',11,'ea502c4fe35960c17735588544ffd8cd76a921895ff30f616f25291b9acb0760',18364),
('7:82',13,'11481a5ca9b85438e7cc8f3e99d2375976d52605d9749b325576a06681699f15',26410),
('7:83',7,'20c079fc4b2e906537b98daa9e0bdfd88d3a0906c14ff872d09381607461416b',11546),
('7:84',8,'1fc955d339aa16e247e67f51210e024f0437d21079e29ecb72d98525a792435a',12852),
('7:85',37,'26f8e7d6ef8538d79a202729df206ac7db8831486fafd5ebf8fd166f03c52871',42292),
('7:86',24,'b74b740f1bbbe193b74323d9fa85a95a4007f91196300beb46f57a5d9e431a5e',30067),
('7:87',19,'1bdf2d451456edc6e5e5a2abe1d3393b63ca3d27bcbb1e034ebd2ea4f5531f1c',33176),
('7:88',21,'3f28a47e741de1f0e3ea53aa5abe68e6515933ba8fe6ac712ae1787b575d2615',27246),
('7:89',42,'96ff9ac055f15e75b85c8e89bdf5492aada6488fdaa85614f64c4ad450c6d840',45192),
('7:90',12,'955359417a8c21f53df438a4612aa39aa263cdf9f8fba0697a82e04fd9b9fdda',14733),
('7:91',6,'a4c1084d8f51d3afd6e9e18a83103c87628e73eaa747090715c1873f43a235ed',8647),
('7:92',13,'ef83318e59069e4068cbbaefafc46ddbc60174b90ee2a2697091c800af64549b',16588),
('7:93',15,'c430734e25eab9a06eed938b924641778c70786076e088fbf056b23c39275054',20976),
('7:94',13,'5ef7edf1e85f49230f7d48421ddf762a937826888fffca80f3f331762dfb860c',24869),
('7:95',18,'1924afdb1b178c2ca921273e8884bf335a23efd698a07b73ea6b54d423ba9cd0',28238),
('7:96',18,'d3a49adcd8e83d1c46c8cd6c18e95a3e02369f87d192ccdb91eb7cbd75cc9c68',32914),
('7:97',9,'02449eb1f90409c4e03fd33e3fc168733a261087bbff99804e48a913955502e8',15151),
('7:98',9,'e77b33308fc4c9f714c1291a8ad435ba9d1f9fac3d6af8114b57963d631dd51e',13192),
('7:99',10,'5e559f24f9b40faf03ee988508ced3558dd15657aae4ff00107adc4c98d4fdf9',13140),
('7:100',19,'2d4a81711c40631cff642b22077b5424380586772f392f94c8e43556156cadf4',23510),
('7:101',23,'377659650ee0fb56259e56dc2db3d54fd186df81ce4c11214af6741778fc5d68',29492),
('7:102',9,'41e4df6944e7c16cd575e4ec54083e86773dc2b6088921ce420d4b515f77692c',15334),
('7:103',16,'d2c548883277cae6597d2bc798057068f41426844bc85f92f103a17f3ff368d1',21838),
('7:104',8,'ba587ab1e0f345db431aed86b75c253267f2546132668db5a6a7c095663dfeed',11781),
('7:105',18,'c76aa4abb10eaf179df51a0239a4bf7ab951cd36fa4a9942eda261fd42527d3a',24398),
('7:106',11,'1bc4c3def75385d217747e6364216a57fa1c4f9fc9393462840142e4f64ee0bf',13505),
('7:107',6,'1ab71d52cd1e74a31661bd23dc6479a3872f58ba1ea98a4f6c8c0607ffd09203',8046),
('7:108',6,'1e5adbb5184719f1482fd1be7d78bceab664191f9e1290d9eccf0edd7dd12e42',9900),
('7:109',9,'6e22c82ab4d63128485b2754fee9948e2df318219d3cb2901a524e6aa36372d1',10240),
('7:110',7,'0dec16f4c63bdfb919698a8e71ea6125867116ddd016e94fc632e83ab3150c22',10188),
('7:111',7,'3c9c05f676b963bfa016695f84f828ac14bf23ec64f33cd1c3047297d732f3fa',11180),
('7:112',4,'e354df529e40bf746df9870ae8de6ac2ee651fadc683c0cf47232b713486e2d6',5904),
('7:113',11,'8a410a019e0f733918db2f4437802e4e83d75c00e284ca0a19a70ef008e7b14b',21368),
('7:114',5,'bea22ab454d87037d8bd398f601f061c286a039720984e655d3d9771c054a911',7941),
('7:115',10,'9a626a0ad6e96de1640b23a79bdc6f8cd341506c6e35a66888c8db579e437af6',17110),
('7:116',11,'3e4ec87f704120d52fab554ebdcf1947a89ce26094f7c22261e00fed6a85ca45',19958),
('7:117',11,'1807a4662652e45df1fbb4d457d34eb1a256323b6b3994cbf123976b139887d7',15856),
('7:118',6,'7cbf5229202528b77bee4f43813afa2bde717f5ccfcbeaff85c1b274e581268a',7445),
('7:119',4,'eba8f77ec80bb485910a8ecf2057e506baae4193f051cb54a8af653281416781',8464),
('7:120',3,'51a2262440e31c4893fabb2563ee54e03a5c645804fd5e67bbd13926482effa7',5982),
('7:121',4,'c44866a8a9124d1df37c8672885d5809206a54eb203b34f6d2f6da472fa98981',8281),
('7:122',3,'df3a780ef9fe68a0fdbba841402792a4715d798ed0d94d43cc7a4c34588daef9',4937),
('7:123',19,'8a34c59f5569a894971bd716db5c4eba92c62f9e108c47ab543cdba58818d3fa',24764),
('7:124',8,'a3d20deb4d8b40be3de1fc947c4f57d4fd266ea03c6cd13ca724874850f0fcd4',14968),
('7:125',5,'bf0ec7ecf14393b758dd84ee0084f439ac8529f90c880f7295fd8b4cf0cc19f3',12251),
('7:126',16,'ff42b9634475b64e675f51c669ac940a28fdd76925f0856e8c6778bd8fc416f4',29362),
('7:127',21,'a87a97392aac2c1dfd54bd26cafc638972b9d176063288f53b5c9faf77b2bbc5',28134),
('7:128',16,'dc00a0883323db1742f2d3de7ec129d05080467605107ed0f6b270066e75225c',22152),
('7:129',22,'d2775c64822fa74428c191951ef176f4b83f3b0eaa7151d6de0c3c8e5c005adc',26593),
('7:130',10,'a5e73dd0237395ddc6a0cdf2f49ca9e42f06f47e0be7c3a69438bb9d8c2c39d2',15647),
('7:131',22,'234e5038c76b2238db2dd82a39bcf9767b47e648d24e1d5c7c3f76b3afcf76ed',33776),
('7:132',12,'4307d4fb4c9a7a84a1e59b499d0216ada76c5f04c1d99225c77455afb92a1f91',12826),
('7:133',13,'07e67910bbd78d2881d54ccfbfcb5f7671e47e1ac81218a0b6261bdba445a211',21682),
('7:134',22,'7a4bd5b1fd714406ad5c591aff8f24459a4d7154ffedd8f1a35d8f1705e50161',28238),
('7:135',11,'4bdd63ad657efc2c3f129daab40cdeb19f0afb77f69029c55b968d370421f81b',15229),
('7:136',11,'3f529ee0af87dfa267131ccd66c9f1a7ddaba4a2f3a8b1ede374ac65c0b699ab',24189),
('7:137',29,'5fa3ddd64d8ac6d7df6f35fdfe7d23122af00b5c9b02e33441b6bc3224689fc4',38766),
('7:138',23,'7f57416ac8cabbdb7a6d5aac733bd99876d8f7ddc81178cf03787f7a80d73c09',32235),
('7:139',10,'ff0bf1e9cb9d2cccb3397faa4a89bab4084e9d80acf16a3ecf8591349fae8514',14864),
('7:140',9,'80180d9a4dc8d30b613ff1f25b7d2ef9ac98cc0eff9e03fa7086bfc8198af926',11964),
('7:141',18,'a11650b8ffe056cd24a38971618f09724dde81749dd54e96ce82f78d6325997d',34168),
('7:142',23,'a472ba89a2938a0677ab55ef386ac2eeb11ed6a543cb2f737c07b8bec555e805',28604),
('7:143',41,'df04915c3c1cc7e787feed146dbdb992220b440969e6944b7760276f2aaf18e7',53656),
('7:144',14,'82b007996143d1ec51c3637a6a35f69dfb82a13e932a15ff91bf533e576a0297',20402),
('7:145',20,'5e02be3e1735a82e9aed5c067647b726266a74715bb784cb7425b318ce463002',26488),
('7:146',36,'3e27677db38886bb827461b17fd4b8c85d95fe794c3e45be817b2ff9effd5291',39993),
('7:147',13,'046f489340c56927e4691c3facaa2df3e112278426aa9e812f0f6959e37dad86',19122),
('7:148',22,'34ac32897275dda96431f6581df2b57ec506b49f9e38387f74c87f5788a4adf4',25757),
('7:149',18,'5aedaad7f88796b973dd25e0a97b43f7d18d30d3e6f12c7dd3e62bd3cc10e873',22883),
('7:150',39,'37b1f2d2b80f3bf5b5f1b768b8d5cbbae60c51ae694e7c9d131c1bc24b5c7e77',54883),
('7:151',11,'b78d46faf70ab3130590a49fa308eb2970b4d74816fb2c108bf28c1b5fb0be0e',13296),
('7:152',15,'3527a0d05c2acb8b7a11d7fea85ebed822a83309325a9d33d704815ad99d5342',19174),
('7:153',14,'e25547df8c98611a80af24563621f99526264fc53110a45f3e1f92dde019a34a',19017),
('7:154',15,'00ac634b16120183d993333e00ded5aed0eafcaa1806aea365a84bc0bab993e9',19853),
('7:155',41,'2fcfc03bad8a664823d155612a51595edc450c97fd3dea6da87b1ed7c4d9867e',55275),
('7:156',30,'4243c4937995f1db958f8a6895ea34273a83defe1059a21baf2ec2da247335ce',42919),
('7:157',43,'98e626f57530e548d0bbfffe2d4721a230768687fb5598b210e5ccdbac1c6b4e',79804),
('7:158',31,'f82309c3405c5d24f20dc1a823426da77bcfa7fa393340b4b72dd91c874d69c7',47778),
('7:159',8,'a5db7f7c6a070786e5cb5e3c0c21a91421c4d2420d1da61ab4564cee8f379192',13636),
('7:160',43,'a1bc15421989877002d80c48c93b215f5f03d4eaeaa490e23f30e17c0cac71b5',59977),
('7:161',20,'fea20d3696221c7bf13878ded74cc1c33e14d5b45bc0f76c67e9f021581ac78d',26645),
('7:162',17,'5894c029fecc0b4a34705d963ffd89ece7cecca1bcd647cf3bf5ada0322609e6',23275),
('7:163',27,'b961c6d5471bc5334e24e63501c2658ab6cc6e41519486e5f12ef3ba033cb033',37068),
('7:164',19,'c352d6f1211b353667c3413b6674dadff1ee7be3b644b01f44ce959a8835b8b5',23954),
('7:165',18,'7a11335c9591c04efc393bb76ddfe9e8b5ab4afc1202560d3d569b361ac5ae4d',36153),
('7:166',11,'3acc3157da4be146b6ff5e087d1e4b96bbd1fdbf5f031e6898ed2b7b340f94b5',12304),
('7:167',19,'98d4f10fb83d97c38a8168647921922134bd28bd507ddfd89bd8c222be54efb1',29074),
('7:168',14,'438231ebbb98b833cdcbec7fb2ef3da0dd2b0995ab2ea907c922f4ee280cf08b',20689),
('7:169',40,'4c0acd9bf1a0fd47e8989338900d75718c5ca31a7fc684fe80efbe5e9dbb769b',56137),
('7:170',10,'71f7e7cc9432bc80f1a0a6a71660aa2887de68989185dbd799829509b7e21bde',13610),
('7:171',19,'046eba2a5872225ab435afc8d2583d3c044b14f42395803550f24d4f4fb8457f',32836),
('7:172',26,'d19e653ee314bd816c2a2dd24d464d1fb222207490ca4444a840a53fbab0f1f7',34873),
('7:173',15,'8901379ac144f75bbd5d83c64c5b08f823aa003d5590e88fe9fbdb724f9b46fe',24242),
('7:174',5,'6eb36f51f0803c845cdaca3f9485806ec17e29d0e104178f1e1be83d27d346b0',8281),
('7:175',13,'a0ededf94048a7b8ef02da2590dff0398671c3874263aa783b7edf1aa70404ff',21029),
('7:176',30,'401f6eecf4738fac00f99c3b2677136433feef7a653b4cd00587d8f8ec6bcdeb',36545),
('7:177',9,'2eec17366b0dd38fa85054146b5f4fc3db7437448fb1a5aaf970fef42e52c8b3',14184),
('7:178',10,'b265f2c78d1df5a9cba776b2913c495ad4650e05773d75b51eb37589d7c30fa1',13949),
('7:179',30,'88f41866f0bcbac9725a328c2a6aab79a4c5ac76b9ee6c9894fa1855e5273455',36258),
('7:180',14,'9e9db9b939fe36093f02fe7b0f3ebd48a074b98a0c2b6fe561d166056bef2c0d',21159),
('7:181',7,'bd6d098a43062b521fd1079266d85b7752dc83c34f85ca23631fb5d8b28e90ce',13009),
('7:182',8,'26dd479f78afff0d0b446810f66db4784eba99d7e17a77d8af18605df4291e80',11520),
('7:183',5,'27a23b1f68c005a009e2e282da272fbd065cd2c3e407600d13f752997376abaf',7262),
('7:184',11,'07c8c0eeaeab96fa04d7b1323b4c721d104a838ae7b8b14f6094cfe52935116e',15673),
('7:185',22,'65e88d7e2f169617e6782c04bcbec596bf82e4149df80d35ea8be97a4fb11b23',27376),
('7:186',10,'481fdb48e3d7f618d405c9bba4557359903e7aede00e821b0515b39a665ae74c',11807),
('7:187',37,'4095825c6021de1eec6c9a97c6b55d5af2333a28c0b352939c75a4ae4b29ae56',45270),
('7:188',28,'c626e7d0b0d71ca3dcece81762f9dc7b1480844337667e3d41f14f718eb43a8f',34325),
('7:189',29,'1703f7577985e92c18c16a0ce613eb214bf5a1e49d53ef696a1ce9b9c4ed7245',38139),
('7:190',12,'253e545cb77f656804d4f403080b7a5e98262c5ebb968d73f936c803619eed3f',21969),
('7:191',7,'6809f69865fc90bfbaaed0548df5c19f18255b4f343d115f9dcfcdf5870e41cb',8594),
('7:192',7,'dd82bfc7e4ab7e5c0115e39137c3c0b1a66d688ad5b5f8d3672079102a7d0e08',12408),
('7:193',12,'c8ffe8b02b13cea361b50d8b3d6d7a1bd830a6ec32b9c16a664d28123b5e2852',17946),
('7:194',14,'baba003d8aded2b7a475312925dd9027b55d3a054afa110366903b9b43528e70',19984),
('7:195',26,'14783f5ce5dac3d1ec88dff9648f4304aca65e65916583e3c0de9cc42b8d2b05',33358),
('7:196',9,'98070e71a4a1508251e8ced2c283d4337ccce00fa119f36855bddffe1c2a61be',14054),
('7:197',10,'028f1ac3bc549f037c6d7fff7b347bacde82fcf3a5be0e075d23bb2233706daf',16196),
('7:198',12,'d4ee06977f873450a550e88efdbd8b0792565c35c32b6cff9eff3226d3dee7f7',14838),
('7:199',7,'c0c802a7a7dfbb2a7fe05d91d71fe8530adefb784aadc6f7356e93a121d78869',8542),
('7:200',10,'d799c91fcc07b75c853938766b3b86197ff9973262de5cacc2640d3efe28fd4f',19409),
('7:201',12,'16292eff9d7f54db99be7738ef922d72b1a2e4054d900014a9d881da22ea7032',19749),
('7:202',7,'863ffa85688ea01ff329b6fb68cc24759a0a81b3d6df1804642f4e8024b16cf1',9744),
('7:203',23,'a62c260a4c8a84e0aad2f7c9d541370f58db8e71688381858cdbe2d28a2fa8f1',32392),
('7:204',8,'9ca80e7dd5c09b0a96fcc510b696dd5d27563f52154e24fdebe992b28fa3d876',11572),
('7:205',16,'147e0a78e8e4b8b84af94e117843439dbf5f8a90be5103402d48290f32e138fa',18678),
('7:206',11,'8516ee73b850358fa1f17ca5ce4749e2935688eb1c3408678638ae385b1cefa9',19069)
on conflict(verse_key) do nothing;

commit;

select to_regclass('public.billing_config') is not null as billing_ready,
       to_regclass('public.quran_review_heads') is not null as review_ready,
       (select count(*) from public.quran_review_heads) as registered_sources,
       exists(select 1 from public.site_developers) as developer_account_provisioned;
