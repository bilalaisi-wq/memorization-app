# Ayah Quest 3.0 deployment and rollback

## Before deployment

1. Keep the known working Railway build/commit and Supabase backup. Export guest/account device progress and passage records; local-only campaigns require device exports.
2. Run the commands in the release checklist on the exact candidate commit. Do not mutate source during browser runs (Vite HMR changes the tested application).
3. Review existing `supabase/schema.sql` and migration history. Apply missing migrations in order through the Supabase CLI linked to the correct staging project; do not blindly replay seed/setup scripts or paste Markdown into SQL Editor. Confirm applied migrations with `supabase migration list`. This audit adds no migration.
4. Deploy the required Edge Functions to staging using their existing guides, including [QUR'AN CHRONICLES setup](../../supabase/CHRONICLES_SETUP.md). Configure server secrets in Supabase, never `VITE_*`. Browser configuration contains only project URL/public publishable key and approved auth redirect URL. Preserve private bucket policies and RLS.
5. Run real staging guest/free/paid/expired/developer/A-B tests: sign in/out, load bundle and audio directly, try forbidden writes/other-owner reads, switch accounts during requests/audio, downgrade and resume campaigns, create a cloud conflict and recover both copies. Confirm pending/invalid raw exports. Use controlled accounts and test products, never customer data.
6. Configure Stripe test products/Price IDs, Checkout/Portal return URLs and signed webhook endpoint following the existing billing setup guide. Exercise checkout/failure/cancel/renew/change/expire/duplicate/out-of-order events; verify effective entitlements against server state. Test live billing separately.
7. Publish only independently reviewed, rights-documented Chronicles lessons using the explicit editor workflow. Bilal Ahmad's provisional contact record alone is not a scholarly approval. Test draft/withdrawn and private lesson denial.
8. Inspect mobile/desktop screenshots, then test physical iOS Safari, Android Chrome, VoiceOver/TalkBack and keyboard/zoom/reduced-motion/audio focus. Confirm performance on a lower-powered device.
9. The owner deploys Railway manually: select the tested candidate commit, deploy, then verify static module requests, auth redirects and content access. Vite flags are build-time values; rebuild after changing them. Keep the prior build available.

## Rollout controls

`VITE_COSMIC_EXPEDITIONS_ENABLED=false` hides expedition entry while retaining standalone mechanics and existing saved expedition records. Validate with `npm run check:cosmic-rollout`. Existing Night Sky rollout conventions remain available. This flag does not disable all revised labs or authorize content. Chronicles publication can be withdrawn server-side and optional AI features remain server-feature-flagged. There is no comprehensive per-lab emergency kill switch: use the previous frontend build for a broader rollback. Never use UI flags as authorization controls.

## Rollback

Redeploy the previous tested frontend artifact/commit without clearing localStorage, IndexedDB or Supabase tables. Withdraw an affected published Chronicles lesson or disable the relevant server feature if needed. Preserve schema additions and RLS; do not run destructive down migrations against live learning rows. Preserve both copies of cloud conflicts and raw invalid records. Restore from a database backup only through a reviewed incident procedure, since restoring an old database can remove newer learner progress. Re-run auth/content denials and core free study after rollback.

A previous client may not understand newer local schemas; it must preserve them rather than downgrade/overwrite them. No migration is introduced in this audit, so rollback requires no schema reversal. Re-enable only after reproducing/fixing the failure and rerunning affected/full checks.
