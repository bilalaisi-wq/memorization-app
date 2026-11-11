# Phase 4 — shared labs for authorized Qur’anic passages

## What changed

The existing lab navigation, content library, passage session, arcade contracts, rewards and native recall APIs remain in use. There is no premium-only lab renderer or second content catalog. Selection eligibility never grants authorization: `loadBundle` / `loadAudio` still use the existing Supabase content endpoint, registered source hashes, account guards and entitlements.

Memorization Lab exposes Practice, Puzzle Quest, Active Recall and Ayah Chain for private inline selections as well as free selections. Private Practice/Quest use the existing bounded adaptive workspace and hint levels; free legacy mode routes remain available. The inline mode bar stays outside the assessment surface. Returning to supported study explicitly sets an unfinished assessment aside without creating a rating. Existing Again/Hard/Good/Easy self-assessment, 16-earned-XP prompts, reviewed memory anchors, cumulative A / B / A+B rounds, source fingerprints and legacy/grouped drafts are retained.

Grouping remains 1/2/3/up-to-5 words for 1–12/13–24/25–36/37+ words, with at most 12 movable pieces per active workspace. Longer ayahs use pages; ayah-chain practice uses a bounded batch of up to ten selected ayahs starting at the active reference. This is visual grouping, not waqf approval.

Puzzle Lab still uses its seven existing engines and declared contracts. The context Bridge route now delegates to the same Passage Arcade host as Puzzle Lab, rather than assembling a separate partial private adapter. All engines keep distinct movement/physics and the existing result recorder, caps and assistance/motor evidence.

Revision Lab adds a shared authorized Star Runner source adapter and reuses the **same** Star Runner engine, keyboard/touch controls, blasters, boost and renderer. The source is per-stage/account, owns its audio leases, revalidates source fingerprints and is disposed on access changes, account changes or exit. Private wording never enters the global free distractor caches. Words/chunks retain canonical positions; long ayahs never become a whole moving paragraph. Private cues use complete verified ayah recordings once per ayah/round, without guessed phrase timings or stitched recordings.

The existing Memory Rescue / Marathon planner now accepts published-library surahs, juz selection and explicit canonical reference ranges. It supports up to 6,236 metadata references, splits gameplay into at most five ayahs, and does not preload an entire multi-juz campaign. Stage rail rendering is bounded. Selected free and private passages both enter this common campaign planner when opening Cosmic Rush. Same-surah legacy campaign IDs/task order are retained. Juz and multi-juz ranges split at chapter boundaries: no last-surah/first-surah endpoint pair is fabricated. Stage seams inside one surah include the real incoming adjacent transition. Every stage/reload loads and verifies authorized sources before study or play. Corrective practice and independent recall still use the established scheduler; Runner recognition never submits a recall grade.

QUR'AN CHRONICLES has a 114-chapter comprehension metadata catalog, driven by the server-filtered **published lesson** listing. An imported ayah does not create a lesson. Opening a lesson still verifies reviewer/publication metadata, lesson hash, source pins, source rights and content authorization. The existing developer-preview/coming-soon rollout remains unchanged until actual lessons are independently approved; no tafsir was generated or published.

## Contracts and compatibility

| Activity | Supported source units / real limits |
|---|---|
| Memorization | Canonical words, adaptive groups, cumulative bounded pages; whole-ayah independent recall |
| Ayah Blocks | Up to 12 active units; visual groups up to 2 words |
| Ayah Space | Up to 12 active units; visual groups up to 3 words |
| Ayah Serpent | Up to 12 active units; visual groups up to 2 words |
| Memory Maze | Up to 12 active units; visual groups up to 3 words |
| Ayah Bubble Burst | Up to 12 active units; visual groups up to 2 words |
| Sirat Quest | Up to 12 active units; visual groups up to 3 words |
| Bridge Builder | Actual same-surah adjacent-ayah transitions, with short endpoint groups; no single-ayah fake bridge |
| Shared Star Runner | At most five source ayahs per stage; one target plus two authentic distractors; long ayahs use 1–3-word visual units, full audio |
| Authorized campaigns | Up to 6,236 consecutive metadata references; five-ayah/chapter-bounded stages, reauthorization on reopening, account-scoped resume |
| QUR'AN CHRONICLES | All chapters recognized; activities require an actual approved, published, source-matched lesson |

Standalone Puzzle Lab chains retain the declared 50-ayah maximum and use smaller staged workspaces. The active cross-lab session retains its 300-ayah selection limit; whole Al-Baqarah fits, while larger multi-juz routes are planned in the staged Revision campaign. Approved study segments exceeding a game's readability limits are rejected with the existing compatible alternative. Visual grouping never upgrades them into approved recitation phrases.

The legacy free-only Cosmic expedition director and its saved boss blueprint format remain available through regular free mission browsing. This change does not pretend those legacy boss saves can accept private text: authorized passages use the common staged Runner/arcade, Protect and Capture, real boundary-link and native-recall paths. No premium boss questions or religious lessons are invented.

## Data, security and persistence

- No canonical text/audio, published availability, billing policy, source-provider pins or database schema was changed.
- `ayah-revision-missions-v1` accepts the additive `runner` activity and canonical chapter-spanning ranges. Old valid records and same-surah task IDs remain valid; malformed data still needs explicit recovery.
- The gateway recorder now accepts canonical references throughout the catalog for metadata history; this validator does not authorize downloads or award mastery.
- New Runner manifests/checkpoints store canonical references and source hashes, not private text, audio URLs or tokens. Existing reward receipts and per-ayah/day caps are reused.
- Private renderer/controller/audio cleanup is owned by the existing context or campaign; the Runner also rechecks private access on focus and periodically. Pending media loads revoke their lease if ownership changes.
- All scheduling remains in the existing independent-recall APIs. No new FSRS engine, parameters or game-derived successful ratings were added.

## Validation and remaining gates

Tests cover all 30 juz and cross-juz planning, complete canonical ordering, chapter-safe stage seams, long/repeated-word source positions, genuine private-pilot Runner objects and controls, server denial, source-revision changes, disposal, mode navigation, account switching, unchanged recall data and the 114-chapter lesson registry. Existing game compatibility, XP receipts, grading and old-storage tests are included in the full regression run.

Early/middle juz without published assets are tested as **metadata planning and fail-closed availability**, not claimed as playable verified content. Al-Baqarah 2:282 uses the existing authoritative test fixture and mocked authorized responses; this is not a live account/rights attestation. Existing Juz 29 server-role/policy tests remain relevant. Real Supabase staging, paid-account content delivery and physical-device validation remain external release gates.

The Phase 3 content limitation remains: **1,210 locally validated ayahs and 5,026 missing**. This integration does not publish the missing Qur’an or turn developer-only content into a paid release. The currently published/authorized source set determines what can actually open.

## Revision pacing and release verification

See [revision pacing and deployment](revision-pacing-and-deployment.md) for one-pass defaults, optional repeat recovery, Level 3 cumulative-chain behavior, source-backed transliteration and manual Railway deployment verification.

## Final local verification — 2026-11-11

- Production `npm run build`: passed, including generated public build metadata.
- Full Playwright regression run: 952 cases executed; 943 passed initially. Nine cases retained obsolete three-round defaults, old checkpoint button labels, or Arabic-only tile text assumptions. Their expectations were updated to the new one-round flow and source transliteration. Explicit three-round compatibility coverage was retained.
- Reran all eight affected test files, including the new pacing suite: **45 passed, zero failed**. This includes every initially failing case, actual keyboard flight, optional four-round escalation, native drag repair, cloud/account mocks, celebration coverage, selected-stage launch and the complete 15-ayah route. Thus every case in the full run passed either initially or in the corrected affected-file run; a second complete 952-case run was not performed.
- Backend tests: content 6, billing 7, comprehension 6, recitation 5 and coach 5 — **29 passed**. Content, billing, comprehension, recitation and coach Deno type checks passed.
- Build-info tests: **2 passed**. `git diff --check`: passed.
- Browser screenshots include `/workspace/artifacts/boundary-link-desktop.png`, `boundary-link-mobile.png`, `ayah-link-mobile.png`, `ayah-link-reactor.png` and `cosmic-release-mobile.png`.

These tests use local fixtures/mocked account services where documented. They do not substitute for real Railway deployment, live Supabase RLS/payment checks or physical-device validation. The live service still required its owner's manual deployment at verification time; `/build-info.json` on the old public deployment returned 404.
