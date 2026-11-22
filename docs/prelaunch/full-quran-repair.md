# Full Qur’an library repair — implementation and operator report

[Hosted follow-up: the pending Supabase operations have now been executed; see the dated operational report for current deployment evidence.](supabase-hosted-repair.md)

## Status

Local repair completed; complete-Qur’an publication and authenticated hosted access remain blocked. This report supersedes historical hosted-status statements in older preview guides. No migration, Storage upload, Edge Function deployment or source approval was performed during this repair.

The existing Hafs catalog has **114 surahs, 30 juz and 6,236 unique canonical references**. The local source inventory contains **1,210 technically validated ayahs**: **571 existing free ayahs**, **637 developer-preview ayahs** (Al-A‘raf and Juz 29), and **two Baqarah pilots, 2:255 and 2:282**. **5,026 ayahs still need source assets.** The complete Al-Baqarah is not prepared. Technical integrity is not commercial-use clearance or scholarly segmentation approval.

The machine-readable [coverage matrix](../../content-audit/repair/coverage.json) records every reference, asset presence/hash, all 114 chapter totals and all 30 juz totals. CATALOGED, PREPARED and VALIDATED are local evidence. UPLOADED, DEPLOYED, AUTHORIZED and USABLE remain null where not authenticated and observed. RELEASED preserves the existing free-policy designation; it does not certify a new release.

## Root causes and changes

1. A catalog entry was being mistaken for prepared/deployed content. Added `src/content/coverage.js` and a collapsible availability browser in `src/passage-context/ui.js` and `ui.css`. It shows exact partial-surah juz counts, exposes existing registered references through the common authorized loader, and disables unavailable rows. It does not invent missing assets or authorize private content.
2. Baqarah pilot references were missing from the main developer selector. `src/main.js` now offers the two actual pilots via the shared Memorization Lab passage route. It never labels them as a complete chapter.
3. The private handler consulted active developer authorization only for developer-only chapters/chapter requests. `supabase/functions/_shared/quran-handler.ts` now obtains the existing service-side developer role for every private request, allowing the active owner to access registered pilots through the same source validation. Ordinary subscriptions, reviewed-source checks, private/no-store responses and authentication remain enforced.
4. Existing Baqarah availability entries lacked canonical provider fingerprint/audio metadata used by pinned fallback. `scripts/sync-existing-pilot-pins.mjs` verifies existing local bundle/audio SHA-256 before enriching just those entries in `_shared/content-availability.json`. It does not replace source bytes or approve stops.
5. Current live provider responses for **both Baqarah pilots differ from their pinned content fingerprints**. The probe returned “Provider canonical content fingerprint changed.” This remains correctly blocked. Upload the exact validated pinned assets, or perform an explicit reviewed source-version migration; do not silently repin current responses.
6. `scripts/full-quran-repair-audit.mjs` produces the detailed operational coverage matrix alongside the existing audit. The existing importer remains the only preparation pipeline.

## Coverage by juz

“Prepared” below includes existing free assets and registered private assets. Hosted availability is not inferred from these counts.

| Juz | Canonical first–last | Expected | Prepared/validated | Missing local assets |
|---|---|---:|---:|---:|
| 1 | 1:1–2:141 | 148 | 7 | 141 |
| 2 | 2:142–2:252 | 111 | 0 | 111 |
| 3 | 2:253–3:92 | 126 | 2 | 124 |
| 4 | 3:93–4:23 | 131 | 0 | 131 |
| 5 | 4:24–4:147 | 124 | 0 | 124 |
| 6 | 4:148–5:81 | 110 | 0 | 110 |
| 7 | 5:82–6:110 | 149 | 0 | 149 |
| 8 | 6:111–7:87 | 142 | 87 | 55 |
| 9 | 7:88–8:40 | 159 | 119 | 40 |
| 10 | 8:41–9:92 | 127 | 0 | 127 |
| 11 | 9:93–11:5 | 151 | 0 | 151 |
| 12 | 11:6–12:52 | 170 | 0 | 170 |
| 13 | 12:53–14:52 | 154 | 0 | 154 |
| 14 | 15:1–16:128 | 227 | 0 | 227 |
| 15 | 17:1–18:74 | 185 | 0 | 185 |
| 16 | 18:75–20:135 | 269 | 0 | 269 |
| 17 | 21:1–22:78 | 190 | 0 | 190 |
| 18 | 23:1–25:20 | 202 | 0 | 202 |
| 19 | 25:21–27:55 | 339 | 0 | 339 |
| 20 | 27:56–29:45 | 171 | 0 | 171 |
| 21 | 29:46–33:30 | 178 | 0 | 178 |
| 22 | 33:31–36:27 | 169 | 0 | 169 |
| 23 | 36:28–39:31 | 357 | 0 | 357 |
| 24 | 39:32–41:46 | 175 | 0 | 175 |
| 25 | 41:47–45:37 | 246 | 0 | 246 |
| 26 | 46:1–51:30 | 195 | 0 | 195 |
| 27 | 51:31–57:29 | 399 | 0 | 399 |
| 28 | 58:1–66:12 | 137 | 0 | 137 |
| 29 | 67:1–77:50 | 431 | 431 | 0 |
| 30 | 78:1–114:6 | 564 | 564 | 0 |

## Actual hosted observations

Production project: `ycgyuatjgdbhiakqourg`.

| Probe | Observed response | Meaning |
|---|---|---|
| Anonymous private `quran-content` bundle request | 401 Sign in required | Function exists and rejects unauthenticated access; current deployed source/version and authorized content retrieval are unknown. |
| `chronicles-content` list | 404 function not found | Reviewed-lesson service needs deployment. Developer fictional demo uses fresh existing entitlement RPC authorization and does not require this endpoint. |
| Anonymous `developer_enabled` RPC | Permission denied | Service-only role lookup is protected; no developer account verification was performed. |
| Public Storage object route | NoSuchBucket | Public retrieval did not succeed. This response does **not** establish that a private bucket or object is absent. |

Fixed-provider sample requests for `67:1` (9 words) and `7:1` (1 word) matched their pinned canonical fingerprints. These are provider-source checks, not authenticated Supabase or complete-chapter checks. Both Baqarah pilot checks remained blocked by fingerprint drift.

No disposable authenticated developer/free/premium accounts or management/service-role credentials were available. Therefore account A/B isolation, premium expiration and actual hosted text/audio loading were **not verified live**. Local policy tests are not a substitute.

## Safe operator deployment steps

These commands are instructions, not completed operations. Start in the repository folder. On Windows PowerShell use `npx.cmd` if script execution policy blocks `npx`.

```sh
npx supabase login
npx supabase link --project-ref ycgyuatjgdbhiakqourg
```

Browser login is an alternative to finding/copying a personal token. Never put a management token or service-role secret into Vite variables, chat, Git or the mobile app. A public publishable key cannot deploy functions.

1. Sign into the website with the configured confirmed owner account. Back up staging and review existing migrations. If developer/content prerequisites are missing, run the **entire raw** `supabase/SETUP_DEVELOPER_LIBRARY.sql` in staging SQL Editor first. Do not paste Markdown wrappers or isolated VALUES rows. It includes prerequisites in order and must report developer provisioning. Do not claim a review approval merely because source-head rows exist.
2. For Chronicles editorial features, apply the existing `supabase/migrations/20261108_chronicles.sql` after its billing/developer prerequisites, and provision editorial roles through the existing reviewed workflow. This repair adds no new SQL migration or learner table. The fictional mechanics demo needs only existing server developer entitlement resolution.
3. Verify the existing immutable source release before uploading:

```sh
node scripts/validate-private-juz.mjs 29
node scripts/sync-existing-pilot-pins.mjs
node scripts/audit-quran-manifest.mjs --check
node scripts/full-quran-repair-audit.mjs
```

4. In Supabase Storage, keep `quran-premium` **private**. For an existing pinned ayah, upload its exact `.quran-private/SURAH/AYAH/bundle.json` and `full.mp3` to `SURAH/AYAH/bundle.json` and `SURAH/AYAH/full.mp3` in that bucket. For example, Baqarah pilot paths are `2/255/bundle.json`, `2/255/full.mp3`, `2/282/bundle.json`, `2/282/full.mp3`. Compare SHA-256 to server availability pins before and after upload; do not overwrite conflicting objects. Dashboard upload is suitable for these few existing pilot files. Do not expose the bucket publicly to fix authorization errors.
5. New missing content must use the existing candidate pipeline. The following are safe dry-run/validation commands:

```sh
python3 scripts/prepare-quran-content.py --all --dry-run
node scripts/validate-quran-release.mjs --release .quran-private/candidates/ID
node scripts/upload-quran-content.mjs --release .quran-private/candidates/ID --dry-run
```

Actual preparation requires the documented approved provider policy, independent reference manifest and its hash, licensed required resources, and explicit `--prepare` arguments in [the import guide](../quran-import-pipeline.md). After all gates pass, the existing uploader accepts `--upload` with operator-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It uploads immutable **inactive quarantine releases**; it does not activate runtime availability. Review and synchronize the server manifest separately. Do not pretend a quarantine upload is a published release.
6. Deploy the updated functions and shared source dependencies:

```sh
npx supabase functions deploy quran-content --project-ref ycgyuatjgdbhiakqourg
npx supabase functions deploy billing-passages --project-ref ycgyuatjgdbhiakqourg
npx supabase functions deploy chronicles-content --project-ref ycgyuatjgdbhiakqourg
```

Retain repository JWT configuration: handlers explicitly verify users. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside functions. Confirm `BILLING_SITE_URL` matches the website origin and approved mobile origins remain configured. Do not change RLS to get a request working.
7. Deploy the matching frontend through the existing Railway path after tests. Authenticate as the confirmed owner, enable server developer mode, open all eleven Juz 29 surahs and the two Baqarah pilots; play verified full audio and launch compatible labs. Then disable developer mode and repeat direct requests as free/under-entitled users. Verify private content/audio disposal and account A/B isolation in staging before release.

## Required gates and remaining blockers

- Missing 5,026 prepared ayahs and associated licensed resources.
- Independent source-manifest attestation, commercial rights/attribution and required editorial approval. Existing technical source checks do not attest these.
- Baqarah live-provider fingerprint drift; pinned Storage upload or reviewed migration needed.
- Function deployment, database prerequisite verification, private uploads and authenticated hosted tests require operator access.
- No new approved internal recitation stops or isolated phrase audio. Full-ayah playback remains authoritative.
- No full-Qur’an release claim, paid feature activation, or real-device certification is made.

## Validation evidence

See [Chronicles validation](../chronicles-explorer/validation.md) for the combined current regression/build evidence. The new library selector screenshot is [desktop availability](full-quran-library-selector.png). It is a genuine local browser rendering; it is not proof of hosted private content authorization.

### Local workspace visual evidence

The following browser images use the exact existing pinned local private bundle through mocked authorized transport. They demonstrate real workspace rendering, not a hosted Storage/authentication pass. No source bytes were imported, regenerated or repinned for the screenshots.

- [Juz 29, Al-Mulk 67:1](juz29-local-workspace.png)
- [Al-Baqarah 2:255](baqarah-local-workspace.png)
- [Al-Baqarah 2:282, bounded grouped workspace](long-ayah-local-workspace.png)

The long-ayah image was inspected for legibility and visible study-boundary/audio disclaimers. These previews do not establish approval of internal recitation stops.
