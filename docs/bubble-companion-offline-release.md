# Bubble Burst, Companion Shop and offline study delivery

The work is separated by task in Git history. Bubble Burst was implemented and tested first. Catalog/profile improvements and the offline foundation have their own commits. The existing Qur'anic text, FSRS implementation, game IDs, reward caps and paid content authorization were retained.

## Priority 1 — Ayah Bubble Burst

Completed: mixed seeded horizontal/vertical answer placement, distinct authentic distractors, persistent bounded formations, connected-cluster clearing, supported neutral pendants/cascades, arcade combo/bank bonuses, collision-aware reflected trajectory preview and optional shot-based descent. Relaxed movement never descends. The safe-line recovery retains words and memory charges. Qur'anic words stay intact; floating effects are neutral stars. Classic/Practice, audio controls and reward receipts remain in use.

Files: `src/puzzles/arcade/bubble/{engine,ui}.js`, `bubble.css`, bounded Bubble metadata in `src/puzzles/arcade/results.js`, `tests/bubble-{engine,ui}.spec.js`, and `docs/bubble-burst.md`.

Focused evidence: 20 engine/browser tests passed after final distinct-distractor checks, including a 600-seed placement audit, persistent IDs, support/cascade integrity, real ricochet captures, empty-space motor errors, three strikes, long source order, mobile/keyboard play, capped/idempotent results and unchanged recall records. Desktop/mobile captures: `/workspace/artifacts/bubble2-desktop.png`, `/workspace/artifacts/bubble2-mobile.png`.

Migration: none. Remaining external checks: physical phone aiming and sustained low-end device testing. Existing four-word reviewed-phrase readability limits remain; visual groups do not certify stops.

## Priority 2 — Companion Shop and profile

Completed: a separate equipped mascot beside the private photo/default avatar; MY COMPANION in My Account with name, outfit/home, large preview and shop/change controls; immediate adoption/equipment confirmation; owned/unowned filtering; current-companion labels; reduced-motion-aware reveal; six original local SVG animals. Signed-in state is refreshed from existing RPCs and guarded by account plus identity revision. Offline account wardrobes require reconnection rather than invented local purchases.

Files: `src/rewards/{catalog,shop,companion,account-photo,publisher,store}.js`, `shop.css`, `src/learner/accounts.js`, `tests/companion-{catalog,profile}.spec.js`, `tests/rewards-policies.spec.js`, `docs/rewards-and-shop.md`, `docs/companion-adoptions-setup.md`, and updated `docs/shop-previews/`.

Required additive database update: `supabase/migrations/20261112_companion_adoptions.sql`, provided identically as **`supabase/SETUP_COMPANION_ADOPTIONS.sql`** for easy pasting. Then run `supabase/VERIFY_COMPANION_ADOPTIONS.sql`. This adds the six server catalog rows and atomic first-time creature auto-equip; migration reruns and duplicate purchases preserve balances, operator prices and later equipment choices. No existing purchases or progress are reset. Hosted SQL has not been applied.

Focused evidence: 23 account/shop/model/policy checks passed, followed by eight repeated visual/profile checks after fixing the generic SVG-height conflict; 14 auth/profile/offline identity checks passed after the final device-namespace integration. Database tests exercise real SQL locally with PGlite and preserve RLS/account separation; these are not a live Supabase attestation.

Before screenshots: `/workspace/artifacts/companions-before/`. After screenshots: `docs/shop-previews/` and `/workspace/artifacts/companion-{simple,night-sky}-mobile-{account,header}.png`, plus `companion-{simple,night-sky}-desktop-shop.png`. Both themes and 390px layouts were inspected. Remaining external checks: apply SQL, real signed-in A/B accounts, second-device wardrobe refresh and deployed private-photo redaction.

## Separate Phase 5 — Offline Qur'an/mobile foundation

Completed: selected free surah/Juz Amma downloads, text-only or verified full/word audio, pre-download size estimate including shell overhead, progress/failed items/retry, pause/removal, IndexedDB media/text storage, verified offline shell, offline reader and compatible regular free practice. Audio supports byte-range playback and browser/headset controls where permitted. Existing consent-aware cloud sync queues local changes and checks revisions before reconnecting; conflicting copies require explicit choice.

Files: `src/offline/{model,store,shell,identity,ui}.js`, `offline.css`, `public/ayah-offline-sw.js`, `scripts/offline-vite-plugin.mjs`, `scripts/private-vite.config.mjs`, menu/startup wiring in `src/main.js`, additive queue handling in `src/learner/cloud-progress.js`, device-only identity handling in `src/learner/accounts.js`, dedicated Playwright configs, `tests/offline-{model,ui,account}.spec.js`, Node manifest/sync tests, and `docs/offline-study.md`.

Safety: no new scheduler, no raw recordings in downloads/sync, no audio bundles in localStorage, no private API caching. Premium material remains online-only: no offline premium license is issued or inferred from a cached subscription. A last verified device namespace is local progress access only; public client/user/developer state remains null until actual online authentication. Reconnection verifies the account again. Account/guest histories are not merged silently.

Focused evidence: nine offline Node tests plus two existing build-info tests passed; 14 IndexedDB/cloud/recovery browser tests passed; all four final production offline tests passed (real airplane-mode reload, verified audio/range playback, mobile text/removal, stale estimate rejection and IndexedDB-failure online-audio fallback). Signed-in device namespace is covered separately alongside auth regressions. No Supabase migration is required.

Remaining limits: browser eviction/private mode can remove downloads; app-shell cache is shared public/free data, not protected native storage. No native app binary or at-rest encryption claim is made. Physical iOS/Android, headset/background policy, deployed HTTPS worker scope and real Supabase reconnect/conflicts still need operator staging checks. Premium offline support needs a future audited server-issued, owner/device/source-scoped expiring license and native storage policy.

## Deployment

1. Apply only the companion SQL update and its verification query, following `docs/companion-adoptions-setup.md`. Paste SQL contents, not a Markdown filename or code fence.
2. Deploy the tested GitHub commit using Railway's manual **Deploy Latest Commit** flow. The normal build remains `npm run build`, start `npm start`.
3. Verify `build-info.json` matches the deployed commit. Check `offline-manifest.json` returns JSON and `ayah-offline-sw.js` returns JavaScript over HTTPS. No service-role/Stripe/AI secrets belong in browser configuration.
4. Test adoption, photo+mascot, account switch, downloads and an airplane-mode reload on the deployed origin. Preserve browser storage: do not clear learner data as a deployment workaround.

No live deployment, hosted migration, payment execution or production-readiness certification is implied by local tests. Full merged validation results are appended below after completion.

## Final merged validation

- Full regression command executed **970 cases**: **965 passed**. It exposed one in-memory fixture/build-hook issue and four production-worker cases incorrectly entering the development-server suite. The build hook now skips manifest generation for `build.write:false` fixtures while retaining private import guards; production cases now run only in their dedicated built-server configuration.
- After those fixes and final Settings/source-revision safeguards, the affected-file regression run passed **47 tests**, with **four production-only cases intentionally skipped** on the development server. It includes the previously failing build-policy case, regular/shared-passage Bubble pause/resume, legacy passage drafts, private-source denial/downgrade, account scope, source metadata and unchanged independent recall. A second exhaustive 970-case run was not performed; this is full-run plus corrected affected-file evidence.
- The dedicated final production build/worker suite passed **all four cases** on the actual built app: real airplane-mode reload/audio, mobile text/removal, selection-estimate races and online audio fallback when IndexedDB fails.
- Node checks passed **11 tests** (nine offline manifest/sync plus two build-version checks). Backend content/billing/comprehension/recitation/coach checks passed **29 tests**. Companion catalog/security SQL is additionally exercised in the full policy suite and focused runs.
- `npm run build` and `git diff --check` passed. Screenshots were visually inspected; remaining external staging/device checks are listed above.

The Download Manager uses existing pause contracts rather than disposing active games: closing Settings leaves the words and current run available to resume. Passage Studio exposes a small pause seam, and shared context forwards it to its current activity; no game or scheduling engine was rewritten. Downloaded source checks compare the complete canonical bundle fingerprint, so changed translation/word/source metadata is rejected even when Arabic spelling is unchanged, while the old asset remains available for explicit recovery/update.

Screenshot quick links (local QA):

- [Bubble desktop](/workspace/artifacts/bubble2-desktop.png) · [Bubble 390px mobile](/workspace/artifacts/bubble2-mobile.png)
- [Shop before desktop](/workspace/artifacts/companions-before/simple-desktop.jpg) · [Shop before mobile](/workspace/artifacts/companions-before/simple-mobile.jpg)
- [Shop after desktop](/workspace/memorization-app/docs/shop-previews/simple-desktop.jpg) · [Shop after mobile](/workspace/memorization-app/docs/shop-previews/simple-mobile.jpg)
- [Night Sky account/companion](/workspace/artifacts/companion-night-sky-mobile-account.png) · [Header photo and companion](/workspace/artifacts/companion-simple-mobile-header.png)
- [Offline desktop](/workspace/artifacts/offline-manager-desktop.png) · [Offline mobile](/workspace/artifacts/offline-manager-mobile.png)
