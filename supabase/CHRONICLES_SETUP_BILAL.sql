-- QUR'AN CHRONICLES: initial owner/editor assignment requested by the account owner.
-- Run AFTER 20261108_chronicles.sql. Confirm this Auth email belongs to Bilal Ahmad.
-- This does NOT approve any lesson and does NOT grant reviewer permission.
do $$
declare owner_id uuid;
begin
 select id into owner_id from auth.users
 where lower(email)='bilalaisi@gmail.com' and email_confirmed_at is not null;
 if owner_id is null then
  raise exception 'Verified owner account not found. Confirm the Auth user UUID/email before assigning editorial access.';
 end if;
 insert into public.chronicles_editors(user_id,display_name,qualification,can_review,can_publish)
 values(owner_id,'Bilal Ahmad','Pilot owner/editor; reviewer qualifications and scholarly review pending',false,true)
 on conflict(user_id) do update set display_name=excluded.display_name;
end $$;
