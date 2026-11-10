# Juz 29: private library and developer preview

This increment covers **Al-Mulk (67) through Al-Mursalat (77), all 431 ayahs**. No Juz 28 or earlier juz has been added by this increment. Al-Fatihah and Juz Amma remain free. Existing 2:255 and 2:282 research pilots remain separate.

## Content and validation

The import fetches Quran.com Uthmani full-verse text, word metadata, Saheeh International translation (resource 20), and Alafasy full-ayah MP3s. It checks canonical references/juz, ordinal word alignment, coverage, exact asset SHA-256 and MP3 decoding/duration. Words use the canonical full-verse spelling with its stopping symbols; Unicode decomposition is used only to compare source feeds, never to rewrite the displayed text. Source URLs and hashes are recorded per bundle.

This is source validation, **not scholar approval of internal recitation stops**. Passage Builder uses bounded study workspaces, continuous full-ayah audio, reconstruction, passage chains and existing FSRS recall. No unreviewed word audio/timing is asserted. Existing short-ayah game modes and free content are unchanged. Premium content opens in Passage memorization; it is not yet copied into every legacy puzzle mode.

## Deploy (administrator)

1. Open Supabase SQL Editor and paste the **entire [SETUP_JUZ29.sql](../supabase/SETUP_JUZ29.sql)**, then Run. It installs all SQL prerequisites together: billing tables, private passage storage, review schema, source registry and developer access. It fixes both `public.billing_config` missing and `public.quran_review_heads` missing errors. Existing progress/reviews/configuration are preserved; it does not activate payments or upload content.
2. Sign in once as **bilalaisi@gmail.com**, the previously configured owner address, before running the setup. If you already ran it before signing in, sign in and rerun the same file. Expect `billing_ready = true`, `review_ready = true`, `registered_sources = 35` (or more), and `developer_account_provisioned = true`. No teacher roles or recitation-stop approvals are created.
3. Existing pinned local releases remain validatable with `node scripts/validate-private-juz.mjs 29`. Keep private backups of exact files and manifests. For new preparation, follow the [Phase 2 import guide](quran-import-pipeline.md):

   ```sh
   python3 scripts/prepare-quran-content.py --juz 29 --dry-run
   ```

   Actual fetching requires `--prepare`, a source policy with documented reuse evidence, and a pinned independent reference manifest. It creates `.quran-private/candidates/ID`, never overwriting the existing `.quran-private/manifest.json`, catalog, availability or existing text/audio. New source hashes require an explicit reviewed migration. Do not copy any private source into `public/`.
4. Validate and preview the isolated candidate:

   ```sh
   node scripts/validate-quran-release.mjs --release .quran-private/candidates/ID
   node scripts/upload-quran-content.mjs --release .quran-private/candidates/ID --dry-run
   ```

   After review, securely set `SUPABASE_URL` and backend `SUPABASE_SERVICE_ROLE_KEY` and explicitly run the same uploader with `--upload`. It writes immutable inactive `releases/ID` objects in the private bucket. **It does not activate them for the existing runtime.** Follow the import guide's separate reviewed server-manifest activation requirements before deploying new availability. Root manifest uploads without `--release` are intentionally rejected. Browser keys cannot upload; no key belongs in Vite, Git or chat. Deploy the authorized `quran-content` Edge Function for active pinned content; keep restrictive Storage policies in place.
5. Deploy the matching frontend to Railway. Until private upload/function deployment is completed, content requests show a deployment error rather than claiming playable content.

## Review all eleven surahs

Sign in → Menu → Developer mode → Enable developer access. Reopen Menu → Juz 29 library. It lists:

| Surah | Ayahs |
|---|---:|
| 67 Al-Mulk | 30 |
| 68 Al-Qalam | 52 |
| 69 Al-Haqqah | 52 |
| 70 Al-Ma'arij | 44 |
| 71 Nuh | 28 |
| 72 Al-Jinn | 28 |
| 73 Al-Muzzammil | 20 |
| 74 Al-Muddaththir | 56 |
| 75 Al-Qiyamah | 40 |
| 76 Al-Insan | 31 |
| 77 Al-Mursalat | 50 |

Open each surah; select any ayah in Passage memorization and check text, translation, full audio, reconstruction and independent recall. Approval of this increment precedes importing another juz.

Return to regular learning with Developer mode → Return to learner mode. Developer access is server stored and applies across your account's devices until disabled. It grants content, Passage Builder and revision tools without creating a paid Stripe subscription. It never grants database administration, fabricated review approval, unavailable AI services, or an exemption from AI privacy/quota controls. Qualified teacher review roles remain separate.

## Menu edits

Developer mode → enable access → move menu items with the up/down controls → Save menu order. This publishes navigation ordering to all learners. It does not change text, Qur'anic content, access controls or arbitrary page layouts. Refresh to verify persistence. New/unrecognized menu items remain accessible. Only allowlisted developer accounts can save; learners can read the layout only.

Paid access remains backend authoritative: Explorer must select Juz 29; Pathfinder has all available juz. Free/expired accounts and forged browser state cannot fetch private assets. Previously downloaded content cannot be remotely erased from a user's device. Use the [Stripe quick-start guide](stripe-quick-start.md) to activate test payments first.
