-- Run AFTER SETUP_REWARDS_SHOP.sql. No personal data is returned.
-- Expected: 13 catalog items, all three RLS checks true, all three direct-write
-- checks false, and authenticated_sync_allowed true.
select
  (select count(*) from public.avatar_catalog) as catalog_items,
  (select relrowsecurity from pg_class where oid='public.learning_reward_events'::regclass) as reward_rls_enabled,
  (select relrowsecurity from pg_class where oid='public.nature_profiles'::regclass) as profile_rls_enabled,
  (select relrowsecurity from pg_class where oid='public.avatar_catalog'::regclass) as catalog_rls_enabled,
  has_table_privilege('authenticated','public.learning_reward_events','INSERT') as direct_reward_insert_allowed,
  has_table_privilege('authenticated','public.nature_profiles','UPDATE') as direct_wallet_update_allowed,
  has_table_privilege('authenticated','public.avatar_catalog','UPDATE') as direct_price_update_allowed,
  has_function_privilege('authenticated','public.sync_learning_rewards(jsonb,integer,integer,integer,uuid)','EXECUTE') as authenticated_sync_allowed;
