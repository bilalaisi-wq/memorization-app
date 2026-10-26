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

commit;

select to_regclass('public.billing_config') is not null as billing_ready,
       to_regclass('public.quran_review_heads') is not null as review_ready,
       (select count(*) from public.quran_review_heads) as registered_sources,
       exists(select 1 from public.site_developers) as developer_account_provisioned;
