# Add the six Nature Companions

This additive update adds Penguin (100 Seeds), Beaver (140), Otter (160), Capybara (180), Red Panda (220) and Quokka (240). Existing catalog IDs, prices, active status, ownership, balances, photos, XP and learning records are preserved. Seeds remain earned cosmetics with no monetary value. The local SVG designs are original in-project artwork with no external image dependencies.

## Supabase SQL Editor

1. Open your Supabase project's **SQL Editor → New query** using the owner/default database role.
2. If the existing signed-in shop has not been activated, apply [SETUP_REWARDS_SHOP.sql](../supabase/SETUP_REWARDS_SHOP.sql) first; follow [the base shop setup](activate-rewards-shop.md).
3. Open [SETUP_COMPANION_ADOPTIONS.sql](../supabase/SETUP_COMPANION_ADOPTIONS.sql), copy **all SQL contents**, paste into the editor and click **Run**. Paste no Markdown backticks or filename. This file is identical to migration `20261112_companion_adoptions.sql` and wraps the update in a transaction. It is safe to rerun.
4. In a new query, run all of [VERIFY_COMPANION_ADOPTIONS.sql](../supabase/VERIFY_COMPANION_ADOPTIONS.sql). Expect `new_companions=6`, `catalog_items>=19`, both RLS flags true, both direct-write permissions false, `anonymous_purchase_allowed=false` and `authenticated_purchase_allowed=true`.
5. Deploy the matching frontend commit to Railway. Refresh the shop while signed in: all active new animals should be available at the server's displayed prices. Adopt an affordable one, check the mascot beside your profile picture, then reload and test a second device.

A project using the Supabase CLI can apply `supabase/migrations/20261112_companion_adoptions.sql` through its normal reviewed migration deployment instead. Do not run unrelated unapplied migrations blindly. No new secret keys, storage buckets, policies, Edge Functions or authentication provider setup is needed.

## Adoption and safety

The existing purchase RPC now equips a **newly purchased creature atomically** with ownership and spending under the existing per-account transaction lock. A repeated purchase never charges twice and never overwrites a companion selected after the original purchase. Outfits/homes retain existing purchase/equip semantics and existing clients may still call equip after buying.

A catalog rerun does not reset customized prices or reactivate intentionally disabled items. A conflicting identifier with a non-creature kind aborts the entire update with an actionable error. Signed-in purchases still use server inventory/prices, authenticate the expected account and deny direct inventory/balance writes. Public leaderboards still exclude private photos.

This repository includes the migration; hosted execution is an operator action and is not claimed as completed. Before launch, use two real staging accounts and devices to verify sign-out isolation, currency, purchases, equipment restoration and private-photo exclusion. PGlite policy tests exercise the SQL and repeated installs locally but are not a live Supabase attestation.
