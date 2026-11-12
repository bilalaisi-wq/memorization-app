-- Additive Nature Companions expansion. Existing balances/ownership stay intact.
-- Run after the existing rewards/shop setup. Safe to rerun.
begin;
do $$
begin
 if to_regclass('public.avatar_catalog') is null
    or to_regclass('public.nature_profiles') is null
    or to_regprocedure('public.my_nature_profile(uuid)') is null then
  raise exception 'Install SETUP_REWARDS_SHOP.sql before adding the new companions.';
 end if;
end $$;

-- Never overwrite an existing price, active status, or owned identifier.
insert into public.avatar_catalog(id,kind,price) values
 ('penguin','creature',100),
 ('beaver','creature',140),
 ('otter','creature',160),
 ('capybara','creature',180),
 ('red-panda','creature',220),
 ('quokka','creature',240)
on conflict(id) do nothing;
do $$
begin
 if exists(select 1 from public.avatar_catalog
   where id in('penguin','beaver','otter','capybara','red-panda','quokka')
   and kind<>'creature') then
  raise exception 'A companion identifier already has a different catalog kind. No changes were applied; review the catalog before retrying.';
 end if;
end $$;

-- Purchase and adoption occur under the same existing account lock/transaction.
-- Retrying an owned purchase never charges again or overwrites a later selection.
create or replace function public.buy_nature_item(item_id text,expected_price integer default null,expected_user uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.avatar_catalog;p public.nature_profiles;balance bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_user is not null and expected_user<>auth.uid() then raise exception 'Account identity changed. Sign in again.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('nature:'||auth.uid()::text,0));
 perform public.my_nature_profile();
 select * into p from public.nature_profiles where user_id=auth.uid() for update;
 select * into item from public.avatar_catalog where id=item_id and active;
 if not found then raise exception 'Item unavailable';end if;
 if p.owned ? item_id then return public.my_nature_profile();end if;
 if expected_price is not null and expected_price<>item.price then raise exception 'This item changed price. Reload the collection before buying.';end if;
 select coalesce(sum(xp+stars*5),0)+p.legacy_basis-p.spent into balance
 from public.learning_reward_events where user_id=auth.uid();
 if balance<item.price then raise exception 'Keep learning to earn more Seeds';end if;
 update public.nature_profiles
 set owned=owned||jsonb_build_array(item_id),spent=spent+item.price,
     creature=case when item.kind='creature' then item_id else creature end,
     revision=revision+1
 where user_id=auth.uid();
 return public.my_nature_profile();
end $$;
revoke all on function public.buy_nature_item(text,integer,uuid) from public,anon;
grant execute on function public.buy_nature_item(text,integer,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
