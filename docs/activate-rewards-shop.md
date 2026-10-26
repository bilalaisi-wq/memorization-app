# Activate the rewards shop in Supabase

This is the update for the existing Ayah Quest accounts/leaderboard database. It enables automatic all-mode leaderboard XP, private profile pictures, account wardrobes and Seeds. Existing accounts, Quran progress, XP and stars remain intact. No new API keys, storage buckets, Edge Functions or authentication providers are required.

## 1. Open your SQL editor

Open [your Supabase project's SQL editor](https://supabase.com/dashboard/project/ycgyuatjgdbhiakqourg/sql/new) and sign in as the project owner. Select **New query** if needed. Use the SQL editor's default database role (`postgres`, if a role selector is shown).

## 2. Copy and run the setup

Open **[SETUP_REWARDS_SHOP.sql](../supabase/SETUP_REWARDS_SHOP.sql)**, copy the entire file, paste it into the SQL editor, then press **Run**. Paste only the SQL, without Markdown backticks.

GitHub copy/download link: [raw setup SQL](https://raw.githubusercontent.com/bilalaisi-wq/memorization-app/main/supabase/SETUP_REWARDS_SHOP.sql).

There are no placeholders to replace. The file wraps the migration in a transaction, checks that the existing account/leaderboard setup is present, and refreshes Supabase's API schema cache. It is safe to rerun this same setup; a failure rolls back the update. Existing owned items and balances are preserved. Rerunning restores the catalog's supplied prices, so keep any intentional price customizations in a later migration.

If the preflight reports missing account/leaderboard tables, stop and install the base account setup first. A project already running the existing leaderboard should have these prerequisites. This update does not require rerunning the older combined account/billing setup.

## 3. Verify the installation

Create another query and paste the entire **[VERIFY_REWARDS_SHOP.sql](../supabase/VERIFY_REWARDS_SHOP.sql)** file, then press **Run**.

GitHub copy/download link: [raw verification SQL](https://raw.githubusercontent.com/bilalaisi-wq/memorization-app/main/supabase/VERIFY_REWARDS_SHOP.sql).

The results should show:

| Column | Expected |
| --- | --- |
| `catalog_items` | `13` (or more if you added items) |
| `reward_rls_enabled` | `true` |
| `profile_rls_enabled` | `true` |
| `catalog_rls_enabled` | `true` |
| `direct_reward_insert_allowed` | `false` |
| `direct_wallet_update_allowed` | `false` |
| `direct_price_update_allowed` | `false` |
| `authenticated_sync_allowed` | `true` |

## 4. Test on the website

1. Refresh [Ayah Quest](https://ayah-a-day.up.railway.app/). The latest GitHub frontend must be deployed on Railway.
2. Sign in, then open **Menu → My companion & shop**.
3. Press **Sync my earned rewards** to include existing learning earnings in the account Seed balance.
4. Adopt an affordable companion and equip an outfit. Refresh the page and confirm they remain selected.
5. Upload a small JPEG/PNG/WebP profile picture, then test **Remove picture**. Pictures are private; the leaderboard displays the nature companion.
6. In **My account**, opt into the leaderboard with a made-up alias and press **Update leaderboard preference** once. Future earned XP publishes automatically while opted in.
7. Do a practice activity, wait a few seconds, then open **Leaderboard**. Check that this week's XP reflects the activity. Lifetime undated legacy XP contributes to Seeds, not an invented current-week leaderboard score.

If the app says a function is missing after SQL succeeds, wait a few seconds and refresh the page. The setup already requests an API schema refresh. If it persists, confirm the SQL was run in the same Supabase project used by the website and that Railway has deployed the latest code.

Guest wardrobes remain local and separate. Account purchases and currency use the database, and spending Seeds never deducts earned XP, stars or mastery. More details: [rewards/shop behavior and privacy](rewards-and-shop.md).
