-- Existing installations: run this migration after schema.sql.
-- It adds optimistic concurrency so one device cannot silently overwrite another.
alter table public.learner_progress add column if not exists revision integer not null default 1 check (revision > 0);
create or replace function public.save_my_progress(profile_id uuid,expected_revision integer,document jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare next_revision integer;
begin
  if auth.uid() is null or auth.uid() <> profile_id then raise exception 'Account identity mismatch' using errcode='42501'; end if;
  if jsonb_typeof(document) <> 'object' or document is null or octet_length(document::text)>2097152
    or exists(select 1 from jsonb_each(document) e where jsonb_typeof(e.value)<>'string' or e.key not in ('ayah-learning-v1','ayah-learning-legacy-v1','ayah-mastery','ayah-quiz','ayah-completed','ayah-gallery-v1','ayah-puzzle-lab-v1','ayah-goals-v1','ayah-activity-v1','ayah-achievements-v1'))
    then raise exception 'Invalid progress payload'; end if;
  if expected_revision = 0 then
    insert into public.learner_progress(user_id,payload,revision,updated_at)
      values(auth.uid(),document,1,now()) on conflict(user_id) do nothing returning revision into next_revision;
  else
    update public.learner_progress set payload=document,revision=revision+1,updated_at=now()
      where user_id=auth.uid() and revision=expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'Another device updated progress. Choose which copy to keep.' using errcode='40001'; end if;
  return next_revision;
end $$;
revoke all on function public.save_my_progress(uuid,integer,jsonb) from public;
grant execute on function public.save_my_progress(uuid,integer,jsonb) to authenticated;
