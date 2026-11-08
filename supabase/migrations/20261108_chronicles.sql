-- QUR'AN CHRONICLES: private editorial data, explicit source-bound publication.
-- Requires existing auth and billing/content functions. No learning/FSRS rows change.
begin;
create table if not exists public.chronicles_editors(user_id uuid primary key references auth.users(id) on delete cascade,display_name text not null check(length(trim(display_name))>=3),qualification text not null check(length(trim(qualification))>=10),can_review boolean not null default false,can_publish boolean not null default false);
create table if not exists public.chronicles_lessons(id text primary key,revision integer not null default 1,document jsonb not null,title text generated always as (document->>'title') stored,refs jsonb generated always as (document->'refs') stored,source_pins jsonb not null,content_hash text not null,author uuid references auth.users(id) on delete set null,status text not null default 'draft' check(status in ('draft','reviewed','published','withdrawn')),reviewer uuid references auth.users(id) on delete set null,reviewed_hash text,rights_evidence jsonb,review_note text,reviewed_at timestamptz,published_by uuid references auth.users(id) on delete set null,published_at timestamptz);
create table if not exists public.chronicles_audit(id bigint generated always as identity primary key,lesson_id text not null,actor uuid references auth.users(id) on delete set null,action text not null,revision integer not null,content_hash text not null,at timestamptz not null default now());
alter table public.chronicles_editors enable row level security;
alter table public.chronicles_lessons enable row level security;
alter table public.chronicles_audit enable row level security;
revoke all on public.chronicles_editors,public.chronicles_lessons,public.chronicles_audit from public,anon,authenticated;
grant all on public.chronicles_editors,public.chronicles_lessons,public.chronicles_audit to service_role;
grant usage,select on sequence public.chronicles_audit_id_seq to service_role;
create or replace function public.chronicles_edit(p_actor uuid,p_action text,p_id text,p_expected integer,p_document jsonb default null,p_pins jsonb default null,p_hash text default null,p_note text default null,p_rights jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_row public.chronicles_editors; row_data public.chronicles_lessons;
begin
 select * into role_row from public.chronicles_editors where user_id=p_actor;if not found then raise exception 'Editor assignment required' using errcode='42501';end if;
 if p_action='draft' and p_expected=0 then
  insert into public.chronicles_lessons(id,document,source_pins,content_hash,author) values(p_id,p_document,p_pins,p_hash,p_actor) on conflict do nothing;
  if not found then raise exception 'Revision changed';end if;
 else
  select * into row_data from public.chronicles_lessons where id=p_id for update;
  if not found or row_data.revision<>p_expected then raise exception 'Revision changed; preserve both drafts';end if;
  if p_action='draft' then
   update public.chronicles_lessons set document=p_document,source_pins=p_pins,content_hash=p_hash,revision=revision+1,author=p_actor,status='draft',reviewer=null,reviewed_hash=null,rights_evidence=null,reviewed_at=null,published_at=null,published_by=null where id=p_id;
  elsif p_action='review' then
   if not role_row.can_review or row_data.author=p_actor or row_data.status<>'draft' or p_hash is distinct from row_data.content_hash or p_pins is distinct from row_data.source_pins or p_note is null or length(trim(p_note))<10 or p_rights is null then raise exception 'Independent qualified source/rights review required' using errcode='42501';end if;
   update public.chronicles_lessons set status='reviewed',revision=revision+1,reviewer=p_actor,reviewed_hash=p_hash,review_note=p_note,rights_evidence=p_rights,reviewed_at=now() where id=p_id;
  elsif p_action='reject' then
   if not role_row.can_review or row_data.status='published' or p_note is null or length(trim(p_note))<10 then raise exception 'Qualified review note required';end if;
   update public.chronicles_lessons set status='draft',revision=revision+1,reviewer=null,reviewed_hash=null,reviewed_at=null,rights_evidence=null,review_note=p_note where id=p_id;
  elsif p_action='publish' then
   if not role_row.can_publish or row_data.status<>'reviewed' or row_data.reviewed_hash is distinct from row_data.content_hash or p_pins is distinct from row_data.source_pins then raise exception 'Reviewed source-bound lesson and publisher role required' using errcode='42501';end if;
   update public.chronicles_lessons set status='published',revision=revision+1,published_by=p_actor,published_at=now() where id=p_id;
  elsif p_action='withdraw' then
   if not role_row.can_publish then raise exception 'Publisher role required' using errcode='42501';end if;
   update public.chronicles_lessons set status='withdrawn',revision=revision+1 where id=p_id;
  else raise exception 'Invalid editorial action';end if;
 end if;
 select * into row_data from public.chronicles_lessons where id=p_id;
 insert into public.chronicles_audit(lesson_id,actor,action,revision,content_hash) values(p_id,p_actor,p_action,row_data.revision,row_data.content_hash);
 return to_jsonb(row_data);
end $$;
revoke all on function public.chronicles_edit(uuid,text,text,integer,jsonb,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.chronicles_edit(uuid,text,text,integer,jsonb,jsonb,text,text,jsonb) to service_role;
commit;
