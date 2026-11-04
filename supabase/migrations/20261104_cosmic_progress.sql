-- Run after 20261023_passage_content.sql. No existing progress or FSRS rows change.
begin;
do $$begin
 if to_regprocedure('public.save_my_passage_learning(integer,jsonb)') is null then
  raise exception 'Install 20261023_passage_content.sql before Cosmic progress.';
 end if;
end $$;
create table if not exists public.cosmic_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null,
 revision integer not null default 1 check(revision>0),
 last_request uuid not null,
 updated_at timestamptz not null default now()
);
alter table public.cosmic_progress enable row level security;
revoke all on public.cosmic_progress from public,anon,authenticated;
grant select on public.cosmic_progress to authenticated;
drop policy if exists own_cosmic_progress on public.cosmic_progress;
create policy own_cosmic_progress on public.cosmic_progress for select to authenticated using(user_id=auth.uid());
create or replace function public.save_my_cosmic_progress(expected_user uuid,expected_revision integer,request_id uuid,document jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare saved public.cosmic_progress; inserted_revision integer;
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user then raise exception 'Account identity mismatch' using errcode='42501';end if;
 if request_id is null or expected_revision is null or expected_revision<0 or document is null or
    exists(select 1 from jsonb_object_keys(document) k where k not in ('version','entries')) or document->>'version' is distinct from '1' or jsonb_typeof(document->'entries') is distinct from 'object' or
    octet_length(document::text)>4194304 or exists(select 1 from jsonb_each(document->'entries') e
      where e.key not in ('ayah-cosmic-expeditions-v1','ayah-cosmic-links-v1','ayah-cosmic-gateways-v1','ayah-cosmic-adaptive-v1') or jsonb_typeof(e.value)<>'string') then raise exception 'Invalid Cosmic progress payload';end if;
 if expected_revision=0 then
  insert into public.cosmic_progress(user_id,document,last_request) values(auth.uid(),document,request_id)
   on conflict(user_id) do nothing returning revision into inserted_revision;
  if inserted_revision is not null then return inserted_revision;end if;
 end if;
 select * into saved from public.cosmic_progress where user_id=auth.uid() for update;
 if not found then raise exception 'Cloud revision changed' using errcode='40001';end if;
 if saved.last_request=request_id and saved.document<>document then raise exception 'Request identifier reused for different content';end if;
 if saved.document=document then return saved.revision;end if;
 if saved.revision<>expected_revision then raise exception 'Another device changed Cosmic progress; preserve both copies.' using errcode='40001';end if;
 update public.cosmic_progress set document=save_my_cosmic_progress.document,revision=saved.revision+1,last_request=request_id,updated_at=now() where user_id=auth.uid();
 return saved.revision+1;
end $$;
revoke all on function public.save_my_cosmic_progress(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.save_my_cosmic_progress(uuid,integer,uuid,jsonb) to authenticated;
-- Reuse the established passage CAS workflow, adding account binding for background work.
create or replace function public.save_my_cosmic_passage_learning(expected_user uuid,expected_revision integer,document jsonb) returns integer
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user then raise exception 'Account identity mismatch' using errcode='42501';end if;
 return public.save_my_passage_learning(expected_revision,document);
end $$;
revoke all on function public.save_my_cosmic_passage_learning(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_my_cosmic_passage_learning(uuid,integer,jsonb) to authenticated;
commit;
