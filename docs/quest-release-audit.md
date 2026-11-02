# Quest system release audit — Phase 7

Audit date: November 1, 2026. Repository baseline: `6428890`.

## Release decision

Local regression, source validation and simulated-account testing are documented below. **This is not production certification.** Hosted authenticated account isolation, configured Stripe test transactions, and physical-device checks remain release gates. No real customer records or payment transactions were modified during this audit.

The audit covers Passage Expedition, Constellation Rescue, Memory Repair Workshop, Muraja'ah Boss Rush, Hifz Survival, existing Puzzle Lab/arcade games, short-ayah learning and passage recall. Existing progress formats, canonical references, entitlement checks and the existing FSRS scheduler remain in use. No Qur'anic text was imported or regenerated, and no database migration is required for these fixes.

## Reproduced defects and repairs

| Defect | Repair and regression coverage |
| --- | --- |
| Underlying Blocks could continue movement/audio beneath a quest; keyboard events could resume an inert game. | Quest/study overlays suspend the underlying game without clearing its draft; arcade keyboard handlers reject inert surfaces. `release-audit.spec.js` checks movement, audio, keyboard and subsequent resume. |
| A delayed reward response from account A could update B's displayed totals after an account switch. | Publisher is bound to its original profile and rejects disposed/stale results before and after awaits. Account transition disposes private surfaces/media and clears the previous identity. |
| Standalone passage dialogs and pending requests could outlive their account; delayed billing responses could navigate after a switch. | Owner-bound storage and lifecycle guards close/dispose passage and billing dialogs. Late results cannot apply or redirect. |
| Multi-key cloud restore could partially overwrite progress on storage failure. | A verified durable journal stores both original and incoming documents before mutation; failed application attempts rollback. Interrupted rollback retains both copies for explicit recovery. Unknown sync metadata is preserved and requires an explicit choice. |
| Device export omitted quest/passage/workspace records; corrupt passage export substituted an empty document. | Owner-scoped raw exports include the local records and recovery journal; native passage/workspace exports preserve original bytes, including invalid data. Guest account screen now offers export. |
| An unavailable private pending recall could block free study. | Explicit “set aside” clears only the unfinished attempt, without a grade or scheduling change; free practice remains available. Advanced/repair headers expose unfinished-recall management. |
| Returning from an assessment to practice synthesized an Again result. | Canceling a pending attempt changes no card/history/due date. Explicit grades carry self-assessment provenance; ambiguous old assisted Again/Hard records are labeled legacy evidence rather than attributed to a learner. |
| Studying matching text in another quest could leave a pending recall unassisted. | Shared exposure reporting marks matching undeclared core/passage attempts as assisted before source presentation. Metadata-only maps remain neutral. No grade, history entry or review date is generated. |
| Quest volume sliders had only 16px hit areas. | Scoped slider targets are at least 44px high; keyboard value changes are tested. |

The shared exposure utility is `src/study-exposure.js`. It reports canonical references, stores no duplicate text, and fails closed if assistance cannot be recorded. Existing native assessment rules still determine when an attempt is independent.

## Persistence and cloud scope

| Records | Current behavior |
| --- | --- |
| Existing core game/learning progress | Existing opt-in cloud sync with optimistic revision checks; durable local restore journal added. |
| Passage recall history and FSRS cards | Existing separate passage sync, explicitly initiated in Passage Builder. |
| Quest campaigns, revision expeditions and workspace drafts | Browser/profile-local persistence and raw device export. **No cross-device campaign/draft merge is implemented.** |
| Guest-to-account copy | Explicitly copies core progress only. Guest quest/workspace documents remain preserved in the guest profile. |

Account-bound exports exclude other profile prefixes and auth tokens. Invalid saved records are not silently replaced during export or restore. To recover a failed cloud restore: download device progress first; use **Recover pre-restore device copy** in Account; autosync remains disabled; explicitly choose the appropriate cloud/device direction. The recovery journal retains the saved source copies. Do not hand-edit invalid JSON without keeping its raw export.

## Learning and source integrity

- Canonical Arabic strings, spelling, source references, word boundaries and segmentation restrictions are unchanged.
- Visual workspace pages are not approved recitation stops. Draft segmentation remains study-only; continuous audio restrictions remain enforced.
- Arcade success and cosmetic repair effects do not grade independent recall, confer memorization mastery or call a second scheduler.
- Actual Again/Hard/Good/Easy assessments use the existing passage/core APIs. Canceling, assistance exposure, route display and navigation do not schedule reviews.
- Repair evidence distinguishes motor errors, observed selection/order errors, learner self-assessment, uncertain legacy records and unverified inference. No generated pronunciation or tajweed certification is introduced.
- Inventory measured by the local audit: 38 free surahs / 571 free ayahs, plus 639 staged private ayahs. Private source fixtures are not evidence that premium content is publicly launch-ready or that all Quran content is available.

## Automated evidence

New suites:

- `tests/release-audit.spec.js`: background lifecycle, input, stale account responses, raw exports, entitlement transitions, cancellation, sign-out disposal, touch controls, billing races, audio ownership and guest-copy scope.
- `tests/release-persistence.spec.js`: partial writes, durable recovery, backup failure, unknown metadata, cancel semantics and legacy provenance.
- `tests/release-journeys.spec.js`: genuine study → arcade → independent recall → due revision → repair → Survival journey; Boss/Survival reload states; account disposal; cross-mode assistance tracking.
- `tests/release-helpers.js`: deterministic QA fixtures using actual record APIs, never production demo progress.

Existing suites retain coverage for checkpoint/XP idempotency and daily caps, invalid source/segmentation revisions, free/premium content authorization, direct database policies, subscription lifecycle/webhook behavior, game solvability, reduced motion, keyboard/touch, and FSRS non-interference. Mocked billing transitions exercise UI refresh and retained records; they are not actual Stripe transactions.

Final command results are recorded in the validation section below.

## Responsive and runtime measurements

Reproduce with a local Vite server on port 5197 and `node scripts/quest-release-audit.mjs` (or set `RELEASE_AUDIT_URL`). The script uses QA-only records and mocked account endpoints, checks that scene opening/closing leaves passage FSRS bytes unchanged, and writes [metrics](release-audit/metrics.json) and ten screenshots.

The matrix covers five quest modes × two themes × four widths (320, 390, 768, 1440px): 40 cases. Mobile widths use a 4× CPU slowdown. Network is loopback; this is a modal/scene response measurement, not a production cold-load or physical handset benchmark. The local warm-opening budget is 2.5 seconds; touch target budget is 44px. Final figures are in the validation section and machine-readable metrics.

Screenshots (Night Sky; mobile 390px and desktop 1440px):

| Mode | Mobile | Desktop |
| --- | --- | --- |
| Expedition | [Screenshot](release-audit/mobile-expedition.png) | [Screenshot](release-audit/desktop-expedition.png) |
| Rescue | [Screenshot](release-audit/mobile-rescue.png) | [Screenshot](release-audit/desktop-rescue.png) |
| Repair | [Screenshot](release-audit/mobile-repair.png) | [Screenshot](release-audit/desktop-repair.png) |
| Boss Rush | [Screenshot](release-audit/mobile-boss.png) | [Screenshot](release-audit/desktop-boss.png) |
| Survival | [Screenshot](release-audit/mobile-survival.png) | [Screenshot](release-audit/desktop-survival.png) |

Screenshots capture the current scene viewport, including vertically scrolled scenes; they do not imply the entire campaign fits above the fold.

## Hosted probes and remaining release gates

Read-only probes: deployed Railway home returned HTTP 200; unauthenticated private content request returned HTTP 401 (“Sign in required”); deliberately invalid bearer returned HTTP 401 (“Verified sign-in required”). These checks demonstrate endpoint rejection only, not full hosted RLS or bucket configuration correctness.

Before public release, complete:

1. **Hosted account isolation:** two controlled real accounts, guest/account transitions, sign-out/in, Google/email login, multiple devices, direct private progress/API/storage requests and cloud conflicts. No hosted A/B credentials were available in this audit.
2. **Stripe test environment:** configure products/prices, secrets, redirects and signed webhook endpoint; run real test checkout, payment failure, cancellation, renewal, upgrades/downgrades, expiration and duplicate/out-of-order delivery. Local backend and mocked browser tests do not replace these. Test live billing separately before any live-production claim.
3. **Physical devices:** iOS Safari and Android Chrome touch controls, screen reader navigation, microphone permission/codec behavior, audio focus and volume. Browser emulation and screenshots do not establish physical-device compatibility.
4. **Private content deployment:** verify deployed private storage policies, source hashes and developer/premium access. Teacher approval is required before enabling reviewed segmented recitation; research-draft visual boundaries are not certified stops.
5. **Cross-device product scope:** campaigns/drafts remain local. Keep that limitation visible; implement reviewed conflict-safe sync before advertising those records as universally synced.

No remaining locally reproduced defect is intentionally waived. Unverified external/deployment requirements above remain release blockers, not assumed passes.

## Changed-file summary

- `src/main.js`, `src/puzzles/puzzle-lab.js`, `src/puzzles/falling-ui.js`, arcade `services.js` and Space/Serpent/Maze `ui.js`: overlay suspension, input and audio ownership cleanup.
- `src/learner/accounts.js`, `profile-storage.js`, `cloud-progress.js`, `src/rewards/publisher.js`, `src/billing/ui.js`: account-scoped async work, complete exports, restore journaling and stale redirect protection.
- `src/passage/memory.js`, `src/passage/ui.js`: raw exports, owner lifecycle, cancel-without-grade, unfinished assessment recovery and explicit self-assessment provenance.
- `src/study-exposure.js`, quest Expedition UI, Repair mission, advanced revision UI: matching-reference assistance tracking without scheduling.
- Quest Repair model/UI: honest legacy evidence attribution and access to unfinished assessment management.
- Expedition/advanced CSS: volume-slider touch targets.
- Four new test/helper files, existing passage fixture ownership correction, stable object-target selection in the Space test helper and event-boundary audio logging in the Memory Match test, local measurement script, this report and ten screenshot/metrics artifacts.

The source text module, passage segmentation model and core FSRS scheduler configuration have no changes in this audit.

## Validation results

- Final complete suite: `npm test -- --workers=4` — **427 passed, zero failures, no retries** (5.2 minutes). This includes all pre-existing tests and the new release suites.

- Production build: `npm run build` passed (4.04 seconds).
- Backend: `npm run test:billing`, `test:content`, `test:recitation`, `test:coach` — **23 passed, zero failed** (7 + 6 + 5 + 5).
- Edge Function type checks: `check:billing`, `check:content`, `check:recitation`, `check:coach` — all passed.
- Cross-mode assistance plus existing passage regressions: 31 passed.
- Space Chain interaction: 5 consecutive repeat passes after correcting the moving-target test helper. The first full run was stopped after this test-only timing failure; it is not counted as a full pass. A subsequent complete run had 426 passes and one Memory Match test-observation race: automatic selection audio could start between clearing the mock log and explicit replay. Its assertion now clears the log synchronously at the replay event boundary. These earlier runs are not represented as clean full-suite passes.
- Memory Match continuation replay: 5 consecutive repeat passes after synchronizing the mock log with the replay event.
- Responsive/runtime script: **40/40 cases**, zero overflow cases, zero clipped Arabic cases, zero undersized controls, zero warm openings above 2.5 seconds; maximum measured warm opening **1,584ms**. Final screenshots were visually inspected.
- `git diff --check`: passed.
