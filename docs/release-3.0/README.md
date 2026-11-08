# Ayah Quest 3.0 — Phase 8 release audit

Audit date: November 8, 2026. Baseline: `96bd2d1`. **Release status: NOT production-ready.** Local automation does not establish deployed account isolation, payment configuration or reviewed religious lesson readiness. No customer records, paid subscription state, canonical Quran text or FSRS parameters were changed.

## Findings and changes

- Fixed a reproduced source-adapter defect: Al-‘Adiyat **100:9** begins with a standalone rubʿ al-ḥizb annotation. `canonicalSpans` previously rejected it as “Unexpected opening mark,” preventing grouped views. The adapter now keeps the original annotation bytes with the first canonical word without adding/reordering words or assigning a recitation ruling.
- Fixed empty-string core/passage records being mistaken for absent data; existing empty legacy backups and concurrently emptied core records are preserved rather than silently replaced.
- Fixed goals editing so unreadable/future goals cannot be silently replaced; raw device export remains available. Reflowed mobile Blocks parking/Hold into a visible column, hid the narrow-screen reference decoration and corrected Night Sky mission-button contrast. Each fix has a regression test.
- Added a shared compatibility/recovery suite for newer stores, raw owner-scoped exports, retained premium history during free use, every free ayah's original text/positions/group coverage, and the exact 100:9 regression.
- Added a repeatable four-lab responsive screenshot/metrics harness. Updated the Ibn Kathir source assessment to record the supplied repository's CC BY 4.0 license and its lack of formal scholarly review.
- No database migration, Quran import, reward increase, mastery inference or game-ID change is introduced.

## Deliverables

- [Storage inventory, compatibility and recovery](migration-report.md)
- [Security, entitlements and learning integrity](security-findings.md)
- [Deployment, staging procedure, feature controls and rollback](deployment-and-rollback.md)
- [Read-only hosted probes](hosted-probes.json)
- [UI measurements](ui-metrics.json)
- [Runner frame/heap/lifecycle measurements](performance.json)

## Release checklist

| Requirement | Status / evidence |
| --- | --- |
| Existing and new unit/browser/policy regression suite | Final results below |
| Backend behavior and Edge Function types | Final results below |
| Production build and rollout-disabled behavior | Final results below |
| Original Uthmani strings and word positions | All 571 free ayahs exercised across group sizes 1/2/3/5; existing private pilot/source-revision tests retained |
| Legacy progress and invalid data recovery | Core migration, native store/restore suites, added cross-store/raw export coverage; no schema changes |
| XP caps, duplicate receipts, no game-driven FSRS | Existing reward, arcade, passage, Cosmic and Chronicles tests |
| Account and entitlement policies | Local SQL/handler/browser fixtures; hosted authenticated matrix still pending |
| Four labs / themes / narrow screens | 24 local cases: four labs × 320/390/1440px × two themes; actual theme asserted; zero document-level horizontal overflow |
| Audio/engine lifecycle, keyboard/touch and reduced motion | Existing lifecycle/browser suites, actual gameplay tests and measured zero paused Runner DOM mutations; physical devices pending |
| Real screen readers and high-zoom manual review | Pending; Chromium semantics/emulation are not VoiceOver/TalkBack certification |
| Supabase hosted staging A/B and private storage checks | BLOCKED: no controlled staging sessions supplied; anonymous denial alone is insufficient |
| QUR'AN CHRONICLES deployment | BLOCKED: hosted Edge Function probe returns 404 NOT_FOUND |
| QUR'AN CHRONICLES real lessons | BLOCKED: actual reviewed/published religious pilot cards still pending; test fixtures are not lessons |
| Stripe test checkout/renewal/failure/cancel/change | Pending real configured test environment; local tests are not transactions |
| Live Stripe readiness | Not claimed; requires separate live validation |

## Hosted observations

The public Railway home returned HTTP 200. Anonymous `quran-content` private bundle request returned 401 “Sign in required.” The supplied project's `chronicles-content` URL returned 404 “Requested function was not found.” These were read-only network probes against the existing public deployment, not a candidate staging deployment. No real authenticated subscription, A/B progress or private bucket transaction was exercised.

## Screenshots and visual inspection

Fresh local Night Sky captures; guest state, empty published lesson catalog, no fabricated learner history. Screenshots are full-page and therefore show normal vertical page scrolling. No private text or real account details are captured.

| Lab | 390px mobile | 1440px desktop |
| --- | --- | --- |
| Memorization | [Mobile](screenshots/memorization-390.png) | [Desktop](screenshots/memorization-1440.png) |
| Puzzle | [Mobile](screenshots/puzzle-390.png) | [Desktop](screenshots/puzzle-1440.png) |
| Revision | [Mobile](screenshots/revision-390.png) | [Desktop](screenshots/revision-1440.png) |
| Comprehension | [Mobile](screenshots/comprehension-390.png) | [Desktop](screenshots/comprehension-1440.png) |

Visual defects found and fixed: the 390px Blocks side-parking panel required poorly discoverable nested horizontal scrolling, reference-card decoration overlapped Arabic, and a Night Sky mission action inherited white text on a pale teal background. Parking/Hold now stack, narrow-screen reference decoration is hidden, and the action explicitly retains dark text. `phase8-mobile.spec.js` checks panel bounds/no nested horizontal overflow, the pseudo-element and actual computed action color. Fresh screenshots replace the initial captures; screenshots alone do not prove every in-game state readable.

Existing game suites exercise actual movement/collision/selection, not screenshots alone. Prior test-fixture gameplay screenshots remain in their feature docs and must not be represented as approved religious lessons.

## Performance interpretation

Local shared-host Runner sample: median frame intervals approximately 16.7ms (normal) and 33.3ms (4× CPU slowdown); p95 50ms and 66.7ms. Both retained active simulation during sampling, showed zero DOM mutations over the paused sample and zero remaining game scene nodes after exit. Repeated exits stabilized at 152 event listeners / 843 nodes, with small heap variation; this short sample is not a long-session leak proof. Cold device/network performance remains unmeasured. UI metrics measure local warm entry, not production load.

The build includes about 182MiB of existing free recitation assets copied to `dist/audio`; these are not all fetched at startup. Six existing public cross-surah distractor word recordings (from surahs 2 and 55) are intentionally retained for free Puzzle Quest audio; those are not complete private premium ayah recordings. JS asset metadata includes availability hashes/references, not premium source text. Do not confuse deployment artifact size with initial network transfer. Chronicles and heavy game views remain dynamic imports.

## Reproduction commands

```sh
npx playwright test --config=playwright.regression.config.js --workers=4
npm run test:billing
npm run test:content
npm run test:recitation
npm run test:coach
npm run test:chronicles
npm run check:billing
npm run check:content
npm run check:recitation
npm run check:coach
npm run check:chronicles
npm run build
npm run check:cosmic-rollout
# With local Vite running on 5173:
node scripts/audit-3.0-ui.mjs
node scripts/profile-cosmic.mjs docs/release-3.0/performance.json
git diff --check
```

## Changed modules

`supabase/functions/_shared/segmentation.js` preserves leading canonical annotations; `src/learning-store.js` and `src/passage/memory.js` preserve empty invalid records; `src/learner/insights.js` protects unreadable goals. `src/puzzles/falling.css`, `src/style.css` and `src/revision/revision.css` fix the observed mobile layout/decoration/contrast defects. New Phase 8 tests, the UI audit script and this report directory contain verification and release instructions. No SQL schema or canonical data file changed.

## Final command evidence

- Full command: `npx playwright test --config=playwright.regression.config.js --workers=4` completed **900 passed / 1 failed** in **13.8 minutes**. The sole failure was a new assertion expecting “recovery” after a write attempt; the existing refresh guard correctly reports “Learning data could not be read and will not be overwritten.” No application source changed to resolve it. The assertion now checks the initial recovery warning, rejected write, and exact preserved bytes.
- Corrected compatibility/mobile suites: **16 passed**, zero failures (12.5 seconds), including the previously failed case. Every test in the 901-test inventory has therefore passed either the full run or this corrected rerun; **there was not a subsequent single clean 901-test full command**. Do not describe the earlier command as a clean full pass.
- Targeted core/passage/mobile regressions before the full command: 31 passed. Earlier interrupted runs and the test-assertion development failures are not counted as full passes.
- Backend behavior: **28 passed / 0 failed** (billing 7, content 6, recitation 5, coach 5, Chronicles 5). All five Edge Function type-check commands passed.
- Final production build: **passed**, 6.46 seconds. Rollout-disabled build/browser check: passed; expedition entry hidden, interactive standalone flight retained, saved progress unchanged.
- UI harness: **24/24 cases**, zero document overflow, maximum local warm entry **1,233ms**. Eight refreshed desktop/mobile screenshots visually inspected. Runner performance sample and limitations appear above.
- `git diff --check`: passed.

No real hosted A/B authentication, paid transaction, published religious lesson, physical handset or actual screen-reader pass is claimed. Those release gates remain open.
