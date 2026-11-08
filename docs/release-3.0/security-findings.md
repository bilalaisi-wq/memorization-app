# Ayah Quest 3.0 security and learning-integrity findings

## Evidence boundary

Local SQL policy tests run in PGlite and backend tests use controlled services. They validate implemented policy/handler behavior, not deployed Supabase roles, bucket policies, secrets or production JWT configuration. Live read-only probe output and final local results are recorded in the release checklist. Real hosted A/B tests remain required.

## Authorization matrix

| Account state | Intended server behavior | Existing automated evidence |
| --- | --- | --- |
| Anonymous / signed out | Al-Fatihah and Juz Amma source/audio remain free; no private text/audio/cards or private progress | Content/backend, account, context and Chronicles suites |
| Free | Same unrestricted free library; authenticated owner progress | Content/billing policies and browser fixtures |
| Explorer | Five server-selected additional juz, only available released sources; no local-plan override | Billing selected-juz/handler and content policy tests |
| Pathfinder | Available authorized all-Quran features; unpublished/unavailable sources still unavailable | Billing/content handlers and Chronicles authorized premium pilot test |
| Guardian | Initially disabled unless configured; no assumed AI feature availability | Billing feature flags and quota policies |
| Cancelled while paid-through | Preserve access until applicable period end and retain records | Billing model/backend/SQL tests |
| Expired / downgraded | Return to effective Free/remaining entitlements; dispose active private source/audio; keep history | Billing, passage context, revision missions, Chronicles/browser tests |
| Account A → B | A's async replies, content, media and writes cannot populate B; private rows owned by Auth UUID | Account/RLS/cloud/Cosmic/Chronicles suites |
| Verified developer | Server developer role, not an email/local toggle, authorizes private library | Developer policy tests |

Direct requests must be checked as bundle, audio and comprehension actions separately. Public URLs in browser state, saved plan names and local developer state are not entitlement evidence. SQL tables use RLS/revoked direct writes or service-only workflows as appropriate; deployment must preserve these grants. New comprehension publication is server-only, hash-bound, rights-documented, reviewed and explicitly published; author cannot approve their own current draft. AI quota and Stripe webhook secrets remain server-only.

The current source manifest stages Surah 7 and surahs 67–77 as developer-only. Paid plan names alone do not unlock those preview chapters; do not advertise the complete Quran as already released.

## Learning distinctions

Motor errors remain separate from memory selections. Supported recognition and comprehension relationships earn bounded receipts but do not grade recitation. Arcade wins do not call FSRS. Again/Hard/Good/Easy remains learner self-assessment through the original core/passage APIs; assistance is recorded, and text/audio exposure before declaration is not independent recall. Comprehension inventory discovery grants no XP. No transcription is certified tajweed or proof of memorization.

Source adapters retain canonical references, Uthmani strings and word positions; grouped visual pages never authorize recitation stops. Reviewed study segmentation and approved stop/restart metadata are distinct. Long-source audio uses complete verified recordings rather than synthetic stitched/cropped prompts.

## Release blockers / limitations

- Hosted real-user A/B, direct endpoint/storage access and role deployments have not been established by local mocks. Run the staging matrix before release.
- Stripe configuration and real test-mode transactions must be verified separately; live billing is outside this audit's evidence.
- QUR'AN CHRONICLES has no actual reviewed published pilot cards in the repository. Mechanics fixtures must never be seeded as religious lessons.
- Several new records are local/export-only; do not advertise universal cross-device campaign sync.
- Real screen readers, physical iOS/Android audio/input and production cold-load performance require device testing.

## Updated Ibn Kathir reference finding

The owner's proposed `SafhaJournal/tafsir-ibn-kathir-english` repository at commit `9684fc5b28462cfb8e9ec9f66cfecb5d59b557ff` contains CC BY 4.0 licensing and an attribution notice (© 2026 Yvette Z). That license permits commercial reuse/adaptation subject to its conditions; it is licensed, not uncopyrighted. Preserve attribution, source/license links and change notices. The repository describes AI translation/machine grading and no formal scholarly review. Its automated scores are not lesson approval. Shared tafsir blocks must retain their covered references and report reliability distinctions. This is a potentially usable draft/reference source, not an automatically publishable reviewed lesson set. No corpus was imported by this audit; provenance claims were not independently certified. Other supplied editions remain unverified.
