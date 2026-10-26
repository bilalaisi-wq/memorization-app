# All-mode XP, automatic leaderboards and Nature Companions

## What changed

The previous app published scores only when the learner pressed **Update leaderboard preference**. Practice interactions had an activity log but no XP, and the separate passage engine had no game reward output. The new system keeps every existing puzzle/recall reward and adds a separate, versioned study-XP ledger. Opted-in accounts automatically sync after new activity, reconnecting and opening the leaderboard. Repeated receipts are idempotent; opting out removes public rankings without taking away earnings, outfits or progress.

**Menu → My companion & shop** opens the responsive nature collection. Learners can adopt an owl, fox, turtle, cactus, butterfly or starter sprout; equip colored scarves, a sunbeam cape or petal hat; and choose a garden, dawn meadow or starry clearing. All companions are plants/animals, not people. The current collection includes 13 items with permanent ownership, fixed prices and no real-money purchase, randomness, expiring inventory or lost-streak penalty.

## XP and memory are different

- Existing Puzzle Quest, Lab and independent/self-assessed recall XP/stars remain unchanged in `ayah-learning-v1`.
- Meaningful word selection/movement and study listening across Practice, Quest, concealed-word recall, every Puzzle Lab game, Ayah Chain and Passage Builder add 1 study XP. The same word/action can earn up to five times per UTC day, with a 300 ms duplicate-gesture guard. Pausing/stopping audio and opening menus do not intentionally earn XP.
- Practice/chain/passage successful checks add 8 study XP (up to twice per unit/action/day). Main recall assessment participation adds 2 XP after successful persistence; recording captured audio adds 2 XP, and playing a local/reference track adds bounded study XP. Separate Passage Builder assessments add 10 XP for independent self-assessment or 3 for assisted assessment; no speech accuracy is inferred.
- New supplemental study XP is capped at 200 per mode and 600 total per UTC day. Existing game/retrieval caps remain authoritative and independent. This keeps learning worthwhile without rewarding endless clicks. Learners can continue using all learning features after limits without losing progress.
- Browsing the shop, editing profiles, viewing pages, purchases and AI output do not award XP. No new reward marks memorization complete, advances mastery, approves a recitation stop or changes an FSRS schedule. Existing reference/audio assistance rules remain in force.
- Header and learner dashboard show combined learning XP. The Daily Quest banner's original reward subtotal is explicitly labeled **puzzle & recall rewards**, so existing earned results remain accessible.

## Earned currency

**Seeds = earned XP + 5 × earned stars − Seeds already spent.** Stars and XP remain earned totals; buying a scarf never reduces leaderboard XP, star collections or memory mastery. No money, transfers, gambling, random drops or financial value is involved.

For signed-in accounts, prices and inventory come from server-controlled catalog rows. Purchases serialize per account, check owned inventory and balance atomically, and charge only once for an already-owned item. A displayed-price concurrency guard rejects a changed price instead of silently charging a different amount. Equipping unowned items fails; users cannot update their balance, receipts, inventory or catalog tables directly. Ownership and spending are server authoritative across devices. Requests bind to the expected authenticated account, so a sign-in switch cannot redirect pending earnings or profile changes to a different account. Guest wardrobes are local and separate, without a backend security guarantee.

The underlying learning evidence remains **client-recorded/self-reported**, as the existing puzzles/leaderboard have always been. Bounds, immutable event IDs, price checks and atomic transactions do not make browser learning cryptographically verified or provide comprehensive anti-cheat. Never attach monetary value or paid/tradable benefits to these Seeds without a separate trusted award system and review. Server receipt safety bounds reject more than 100,000 XP, 5,000 stars/recalls or 20,000 receipts on a UTC day; normal study caps are much lower.

## Persistence and migration

- `ayah-rewards-v1`: per-profile supplemental receipts and repeat buckets; corrupt/future records are preserved and writes blocked. The existing FSRS/game schema and Arabic/audio data are unchanged.
- `ayah-nature-profile-v1`: guest wardrobe, private resized picture and spending; logged-in wardrobe/picture/purchases are separate server rows.
- `ayah-reward-remote-v1`: per-profile cached server lifetime XP/star totals, allowing a restored account to display earnings from its other devices. This cache cannot authorize a server purchase or create reward receipts.
- Original dated puzzle/recall rewards become stable hashed receipt IDs. Additional receipts use UUIDs. The server sees mode, **UTC day** and XP/star/recall counts, without Quran text, ayah references, exact activity times, email or raw recordings. Batches are limited to 500 receipts / 256 KB. Shared public output is only opted-in alias, weekly totals and curated companion appearance.
- Existing undated legacy XP/stars are imported once into private lifetime earnings when the first nonempty receipt/earnings sync occurs. Their dates are unknown, so they are **not invented as current-week leaderboard XP**. First import is immutable; clearing/editing old histories later cannot repeatedly re-credit the legacy balance. New dated activity always earns normally. Import old private learning progress before first reward sync when restoring an older account.
- Server receipts are immutable and purchases/spending cannot be rolled back by restoring an older browser backup. Multiple devices re-sending the same receipt do not duplicate it. Distinct offline-device study events can be combined when they sync; browser-only repetition caps are not a global anti-cheat system.
- Existing cloud progress backup whitelists stay unchanged. New XP stays local until an account opts into the leaderboard or explicitly presses **Sync my earned rewards** in the shop; then minimal receipts back the account currency. Guest learning does not silently upload or join the leaderboard. Explicit guest-progress copying includes the guest study ledger only into an empty account; it does not silently transfer guest wardrobe purchases.
- My account export includes the new local reward ledger and the currently loaded customization; shop export downloads the current wardrobe/private picture. Account deletion cascades server receipts, wardrobe, photo and balance, and clears these local keys on that browser. Other devices require local clearing per the existing privacy policy.

## Leaderboard behavior and older deployments

Weekly rankings still use the current UTC week, XP descending, recall attempts as a tie-breaker, and the top ten. All learning modes contribute; coins spent do not subtract from the score. Publication is automatic only after existing leaderboard opt-in. Offline XP stays local and retries after reconnecting/new activity/opening the leaderboard. Server failures are shown when publishing/refreshing; no competitor scores are invented.

If `sync_learning_rewards` does not exist yet, automatic publishing falls back to the previous `publish_weekly_activity` function using current-week dated totals from all modes. This fixes the manual-publish problem without waiting for shop setup, but the old backend's daily/weekly bounds still apply until migration. The new migration increases bounds and ensures older clients cannot replace a larger all-mode score with a partial one. Existing weekly totals are preserved.

A newly opted-in account shares current-week dated rewards, not lifetime undated legacy achievements. A learner's local personal XP and their weekly public score are deliberately different scopes. The public footer continues to describe self-reported practice, not verified recitation.

## Private pictures and public companions

Pictures accept JPEG, PNG or WebP under 5 MB, with decoded dimensions at most 6000 × 6000. The browser center-crops to 160 × 160, re-encodes as JPEG (stripping original metadata) and limits the saved data URL to 70 KB. SVG/HTML and remote URLs are rejected. Original files are not uploaded or retained. Images remain in a private owner profile row (or local guest storage), not a public bucket. **Leaderboards never return a photo**; they use whitelisted locally drawn companion graphics instead.

Learners can remove their picture and download their customization. Update the operator privacy notice to cover private pictures, cosmetic purchases, minimal reward receipts and retention. Pictures/receipts can still be personal data and learning may reveal religious practice; protect backups and logs accordingly. Existing adult/parent account restrictions remain; no new public child registration or public photo directory is introduced. Encourage nature images and avoid sensitive photos. This implementation is not a legal-compliance certification.

## Database activation

Apply the existing account setup, then **`supabase/migrations/20261028_rewards_shop.sql`** in the project's Supabase SQL editor. It is safe to rerun and preserves existing learners, progress and public totals. No new secret/API key or external payment service is required. It adds:

- Private `learning_reward_events` and `nature_profiles`, RLS and own-user RPCs.
- Read-only active `avatar_catalog` with server-controlled prices.
- Atomic receipt sync, purchase, equip and photo RPCs, plus redacted companion data on the existing top-ten endpoint.
- Expanded weekly bounds and protection against partial legacy publishers lowering totals.

The application includes the code and migration; it does not claim to have applied hosted database changes with a browser publishable key. Account shop persistence needs this migration; the legacy leaderboard fallback works with the original account functions. Smoke-test two real staging accounts, opt-in/out, reconnect/reload, purchases from two devices, image removal and public redaction before broad release. Retain RLS and do not grant browser writes to the private tables/catalog.

## Updating the collection

`src/rewards/catalog.js` holds immutable IDs, curated descriptions, kinds and local SVG artwork. Add new items/graphics there and add matching rows through a new database migration; deploy the frontend with the new art. Never rename/remove owned IDs or change an item's kind. `avatar_catalog.active=false` can hide an unowned offering while owned items remain equippable. Server prices/availability load when the shop opens; a purchase rejects a stale displayed price. There are no fake “new this week” banners or promises of an automated content feed. Future releases can add more nature companions and clothing without invalidating earned ownership.

## Checks

`npm run build` and `npm test -- --workers=2`. Coverage includes all mode receipts, duplicate/retry behavior, automatic opt-in publication and legacy fallback, offline preservation, corrupted data, mobile layout, guest purchase persistence, private image processing/removal, account wardrobe restore, server price/ownership enforcement, immutable receipts, concurrent insufficient-funds purchases, A/B isolation and public-photo exclusion. These verify implementation behavior, not actual religious memorization or a deployed production backend.

## Visual previews

Local guest QA previews (not evidence of hosted database activation): [simple desktop](shop-previews/simple-desktop.jpg), [nature collection](shop-previews/simple-collection.jpg), [mobile](shop-previews/simple-mobile.jpg), [Night Sky desktop](shop-previews/night-desktop.jpg), [Night Sky collection](shop-previews/night-collection.jpg), [Night Sky mobile](shop-previews/night-mobile.jpg). Recreate with `node scripts/shop-screenshots.mjs` while Vite runs locally on port 5174.
