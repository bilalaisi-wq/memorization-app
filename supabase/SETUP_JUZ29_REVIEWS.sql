-- Paste this entire file into Supabase SQL Editor and Run.
-- Includes the missing review schema before registering source metadata.
-- Safe to rerun: preserves existing reviews; grants no reviewer roles or stop approvals.
begin;

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

select pg_notify('pgrst','reload schema');
commit;

-- Expected: 35 registered source rows or more; review_table_exists = true.
select to_regclass('public.quran_review_heads') is not null as review_table_exists,
       count(*) as registered_sources
from public.quran_review_heads;
