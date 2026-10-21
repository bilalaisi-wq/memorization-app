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
