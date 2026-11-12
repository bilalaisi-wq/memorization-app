-- Run after SETUP_COMPANION_ADOPTIONS.sql. No personal data is returned.
select
 (select count(*) from public.avatar_catalog where kind='creature'
   and id in('penguin','beaver','otter','capybara','red-panda','quokka')) as new_companions,
 (select count(*) from public.avatar_catalog) as catalog_items,
 (select relrowsecurity from pg_class where oid='public.nature_profiles'::regclass) as profile_rls_enabled,
 (select relrowsecurity from pg_class where oid='public.avatar_catalog'::regclass) as catalog_rls_enabled,
 has_table_privilege('authenticated','public.nature_profiles','UPDATE') as direct_wallet_update_allowed,
 has_table_privilege('authenticated','public.avatar_catalog','UPDATE') as direct_catalog_update_allowed,
 has_function_privilege('anon','public.buy_nature_item(text,integer,uuid)','EXECUTE') as anonymous_purchase_allowed,
 has_function_privilege('authenticated','public.buy_nature_item(text,integer,uuid)','EXECUTE') as authenticated_purchase_allowed;
