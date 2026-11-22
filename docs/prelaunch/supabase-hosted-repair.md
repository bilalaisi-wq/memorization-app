# Hosted Supabase repair — November 22, 2026

This operational report supplements the earlier [local library repair](full-quran-repair.md) and [Chronicles validation](../chronicles-explorer/validation.md). Earlier “not deployed” observations remain historical; the operations below were actually executed with authorized management access.

## Diagnosis confirmed against hosted projects

- Production `ycgyuatjgdbhiakqourg` had two older functions (`quran-content` and `billing-passages`, version 3), no Chronicles function/tables, and **zero objects** in the existing **private** `quran-premium` bucket.
- The confirmed owner account was already provisioned and its server-side developer mode enabled. It did not need a new identity, paid subscription or authentication bypass.
- Staging `ygxtnvoycirmktxudzsp` was healthy but had no application tables, buckets or functions.
- The management token was supplied as `Supabase_Access_Token`. Its value was never printed, committed or placed in the frontend. Management requests succeeded. Deployment used the official server-side multipart deployment API because the older CLI's local token-format check did not accept the environment-delivered credential representation.

## Database and configuration operations

1. Initialized the empty staging application's existing library/billing/review/developer prerequisites with the repository's complete `SETUP_DEVELOPER_LIBRARY.sql`.
2. Applied the existing `20261108_chronicles.sql` migration to staging and production. It creates isolated private editorial tables, RLS and source-bound revision/publish operations. No new migration file was needed.
3. Applied `CHRONICLES_SETUP_BILAL.sql` to the existing confirmed production owner: Bilal Ahmad is an editor/publisher, **not an approved reviewer**. `can_review=false`; no lesson was authored, reviewed or published by these operations.
4. Explicitly kept `CHRONICLES_LEARNER_ENABLED=false` in both projects. Set the existing website origin as `BILLING_SITE_URL` where it was missing. No payment key, checkout switch, AI flag, subscription purchase record or production entitlement plan was changed.
5. Did not rerun the broad developer-library setup against production or replace its existing effective entitlement functions. Existing native billing, progress and review schemas were retained.

## Functions deployed

| Function | Staging | Production |
|---|---:|---:|
| `quran-content` | active v1 | active v5 |
| `billing-passages` | active v1 | active v5 |
| `chronicles-content` | active v1 | active v1 |

Each deployment included the exact current entrypoint and recursively referenced local JS/TS/JSON dependencies. The gateway JWT setting remains the repository's `verify_jwt=false`; the handlers perform explicit identity verification, server entitlement checks and role checks. This setting is not an authentication bypass.

## Private source deployment

The upload uses only the existing immutable, registered `.quran-private` source release. Every bundle and MP3 must match the existing availability SHA-256 **before upload**. Existing remote objects are compared before writes; uploads use `x-upsert:false`; uploaded bytes are read back and hashed. Conflicting content is rejected rather than overwritten. Concurrency is bounded.

The private release comprises **639 ayahs / 1,278 objects**: Al-A‘raf (206), all eleven Juz 29 surahs (431), and two Baqarah pilots (2:255, 2:282). Staging receives only eight exact sample objects for 7:1, 67:1, 2:255 and 2:282. No missing Qur’an source was invented or re-imported, no new internal recitation stops were approved, and no protected asset was copied into the Vite bundle.

The exact pinned Baqarah files avoid dependence on the mismatching live-provider fallback identified in the earlier report. The provider pins were **not** relaxed or silently updated.

**Completed:** all **1,278 production objects were newly uploaded and read back with matching SHA-256**; SQL inspection confirms exactly 1,278 objects and `public=false`. All eight staging sample objects were also verified. A second staging upload pass verified all eight as unchanged and performed zero writes, demonstrating immutable idempotent reruns. See the [upload receipt](supabase-hosted-evidence/production-storage.jsonl) and [final hosted inspection](supabase-hosted-evidence/final-inspection.json).

The [per-reference hosted receipt](../../content-audit/repair/hosted-2026-11-22.json) supplements the earlier local-only coverage matrix. It records actual uploaded/digest-verified production objects and staging authorized bundle checks for every registered private reference, while explicitly keeping owner-browser verification and new source approvals false.

## Hosted validation

Disposable accounts were created only in staging, signed in through the real Auth password endpoint, used for requests with real session tokens, and removed afterward. No production user was impersonated and no production learner progress was created for testing.

Checks cover:

- Exact authorized bundle text for both Baqarah pilots, Al-Mulk and Al-A‘raf.
- Complete chapter loading of Al-A‘raf and all eleven Juz 29 surahs: 637 canonical ayahs, exact Arabic text and original word order compared to local pins.
- Full-ayah audio SHA-256 verification.
- Anonymous and forged/free requests rejected, including direct private Storage and editorial table access.
- Developer mechanics capability allowed for an active server developer and denied to a free account.
- Empty reviewed-lesson library and Coming Soon behavior; no fictional demo seeded into editorial data.
- Account B cannot list or delete account A's saved passage; the owner can still read it afterward.
- Revoking developer mode denies private content to the same existing session.
- Server-seeded, disposable **staging entitlement fixtures** exercise Explorer selected-juz rules, the five-juz limit, cancellation until the paid period ends, expiry, preservation of free capabilities and denial of direct subscription updates.

**Results:** **48 distinct hosted staging checks passed** (38 content/isolation checks plus 10 additional entitlement scenarios). [Content results](supabase-hosted-evidence/staging-content-checks.json), [entitlement results](supabase-hosted-evidence/staging-entitlement-checks.json), and [four production anonymous-denial checks](supabase-hosted-evidence/production-anonymous-checks.json) retain the outcomes. Final staging inspection confirms no remaining test Auth accounts, saved passages, customer fixtures or subscription fixtures.

The entitlement fixtures are explicitly **not evidence of a verified Stripe/store purchase, webhook, renewal or restoration**. No billing provider was contacted or live payment enabled. Production anonymous probes separately verify protected endpoints reject unauthenticated requests.

## What the owner should do

Refresh the deployed website, sign into the existing confirmed owner account, enable Developer mode in the menu if necessary, then open Al-A‘raf, a Juz 29 chapter, or either Baqarah pilot. Open QUR'AN CHRONICLES → Play Developer Demo to test the fictional archive adventure. Reviewed lesson publication remains a separate editorial process.

An authenticated production browser walkthrough as the owner still requires the owner's own session; management access was not used to impersonate that account.

## Remaining release limits

- The full Qur’an is **not** released: 5,026 ayahs still lack prepared assets.
- Private preview deployment is not new commercial-rights clearance or scholarly review.
- No comprehension lesson has qualified independent approval/publication.
- Real provider purchase tests, physical-device checks and broader Phase 9/10 store readiness remain separate.
- No changes were made to Quran wording, learner FSRS schedules, existing XP/reward history, production subscriptions or actual user recordings.
