# Surah Rush 3.0 and Ayah Defense 2.1

Audit baseline: `2896280`. The existing `surah-rush` registration shares the verified source host, account-scoped `ayah-flow-adventures-v1` store, bounded reward receipts and full-ayah audio with Defense. Its 1260px course repeats three gap templates; number/click selection sets a route before a single x=730 gateway; every successful crossing resets x/camera. No genuine upper/lower route collision chooses Arabic. Five-ayah boundaries are not intentional mission endpoints in this host.

The upgrade retains these source/security/reward interfaces and the game IDs. Course geometry, fixed-step movement, artwork and source-backed route-sign presentation are modular additions to the existing engine. Visual groups remain study units, not waqf approvals. No arcade result grades FSRS.

Defense audit: geometry preview and engine placement already share `placementCheck`, but the preview omits purchase-state restrictions. Dynamic SVG objects are rebuilt during pointer gestures; relying on a later click against a removed target can lose a valid placement. The repair uses SVG pointer capture and a release commit, with the same complete purchase validation for preview and engine. This diagnosis is verified with pointer-down → render replacement → pointer-up regression, not assumed to explain every possible operator incident.

Unrelated pending Phase 9/10 work remains outside this change. Validation and release evidence are recorded after testing.


## Architecture and physical decisions

- `rush-course.js`: deterministic 1,640-unit course sections, five junction families, five original environments, support surfaces, slopes, springs, loops, moving crossings and conservative validation/fallback. The cache retains only nearby sections.
- `rush.js`: fixed 120 Hz physics, acceleration/friction, air control, jump buffer/coyote time, slide/drop, dash, moving-platform carry, curved terrain, loop traversal and continuous camera. The engine receives source-independent challenge IDs and candidate counts; it never knows which candidate is correct.
- `rush-art.js`: original lightweight SVG landscapes and traveler. Existing sound settings are reused; no third-party character, sprite, engine or sound pack was added.
- `ui.js`: authoritative source loading and fingerprints; read-only RTL world signs; physical route events validated against the current challenge; exact original full-ayah playback; account cleanup; checkpoint and recovery presentation. Routes cannot be committed through old answer buttons or number shortcuts.
- `store.js`: backward-compatible v1 envelope with optional v3 movement and checkpoint metadata. Historical source-independent movement is retained as `legacyArcade`; malformed/future saves stay available for recovery rather than being guessed or deleted.

Crossing the marked commitment coordinate at the upper, middle or lower route emits one decision. The host checks the current canonical source ID and commits a correct answer once. An incorrect answer creates a playable lower recovery detour and retains the unresolved source challenge. Motor falls and dropped input never become Arabic mistakes. Prepared next-source choices stream into the same world without resetting x or the camera.

The planner varies route elevations, curves, ledges, lifts, gaps, springs and obstacles. Five route families rotate without immediate duplicates. The three existing motor IDs remain compatible: Speed Course (`relaxed`), Adventure Course (`normal`) and Technical Course (`arcade`). Long labels slow the unresolved approach. Dash is bounded near unread junctions. Memory difficulty remains a separate setting.

## Controls and accessibility

Desktop: Left/Right or A/D move; Space/Up jumps; Down drops through supported one-way platforms; Shift dashes; S slides. The in-game legend is authoritative. Mobile has large independent movement/jump/drop/dash/slide buttons and supports simultaneous movement plus jumping. Pause, settings, audio replay, expanded size and Back remain inside the same game container. Keyboard input is scoped to the active battlefield; disposal clears held input, media, animation frames and listeners.

Reduced motion removes decorative drift and extra effects without removing physical navigation. The phone view fills its scene rather than letterboxing a desktop canvas; landscape uses a shorter visible world height and retains readable labels. Arabic is original source text, not animated glyphs. The scene HUD exposes the preceding source cue for supported learning. Grouping labels explicitly say study groups are not recitation stops.

## Passage progression and recovery

A custom range finishes at its actual final ayah, not after five ayahs. Full-surah detection uses canonical chapter length and exact references. Full surahs offer a checkpoint after each 25 completed ayahs, excluding the final endpoint. The choice panel supports Continue, Replay Previous Section, Save & Exit, Change Difficulty and Review Progress. Continue retains the original mission refs and cursor. Section replay opens a separate scoped practice host and leaves the parent campaign paused and intact. The same per-ayah reward receipts prevent repeated rewards. Reload returns to the pending checkpoint.

No Quran text is duplicated into campaign records. Existing source/review fingerprints continue to pin source integrity. A periodic authorization check is tied to its captured region and generation: a late response for ayah N cannot be compared with ayah N+1. A real denial for the current private source still disposes the active content. This was reproduced and regression-tested with a held request and subsequent denial.

## Ayah Defense 2.1

`purchaseCheck` includes engine state, budget, support prerequisites, capacity and geometry, and is shared by preview, pointer commit and engine dispatch. Pointer capture commits on release even if an animated SVG child disappears between pointer-down and pointer-up. A Chromium reproduction showed the old removed-target gesture delivers neither the expected click nor release to that target; SVG capture reliably receives release. This does not assume every historical failed placement had that cause.

The battlefield now fills substantially more of the game container, with a compact reading sidebar on desktop and horizontal shop controls on phones. New runs start with no towers or construction currency. The first 30 seconds retain a 0.2 baseline pace even after the first purchase; progression then ramps gradually. Reading safeguards remain. Established waves exercise walker, scout, armored, swarm, shielded and siege effects. The spawn-type counter was corrected so two advancing counters no longer alias and accidentally skip types. Existing combat, economy, source rewards and valid free-placement rules remain.

## Learning, security and deployment constraints

No new database migration, package or content import is required. Existing server-authoritative content loading is unchanged. No service-role credentials or private Quran text are added to the public bundle. Arcade completion is supported recognition, not independent recitation; no new FSRS grades are submitted. Existing bounded, idempotent per-ayah rewards remain in use.

Private-source tests use exact ignored operator assets and mocked authorization transport. They do not prove hosted developer access, real account A/B isolation or paid-source availability. A production Supabase access token and disposable owner/test-account sessions were not available for those checks. Physical iPhone/Android testing, native compilation/signing and store publication are outside verified results; Capacitor asset synchronization is a separate build check.

## Changed files

Source: `src/revision/adventures/{rush.js,rush-course.js,rush-art.js,defense.js,defense-art.js,store.js,ui.js,ui.css}` and minimal Surah Rush setup changes in `src/revision/ui.js`.

Tests: `tests/{adventures-model.spec.js,adventures-ui.spec.js,defense2-ui.spec.js,defense21.spec.js,rush3-helper.js,rush3-model.spec.js,rush3-ui-helper.js,rush3-ui.spec.js,rush3-mobile.spec.js,rush3-progression.spec.js,rush3-access.spec.js}`.

Evidence: this document and public-content desktop/mobile/zone PNGs in this directory. Al-Araf intermediate private-text screenshots are excluded.


## Validation evidence

The broad isolated regression run executed 1,266 cases: **1,253 passed, 12 skipped, 1 failed**. The single failure was the website-keyboard test observing a stale painted position after a mocked clock reset. Rendering now resets its paint timestamp when awakened or when timestamps move backwards. The original movement assertion was retained and passes in final focused regressions. The later completion-visibility assertion also found that the final victory event refreshed the ribbon without refreshing route-sign visibility. The completion branch now updates both; the unchanged physical journey and new hidden-sign assertion pass. A final 23-case UI/Defense run and full 206-ayah repeat passed after this fix. No failed run is being described as an all-green full run.

Final follow-up runs:

- **16 model/access tests passed**: deterministic reachability, real movement, recovery, legacy storage, 206/286 endpoint/checkpoint fixtures, actual Al-Araf source coverage, 225 zone/profile/layout/route combinations, 45 long-label slowdown combinations, and delayed-source authorization race/current denial.
- **16 final route UI tests passed**: actual physical navigation and error detour, five environments, eight viewport sizes (1920×1080 through 375×667 and 844×390), 25-ayah checkpoint replay/difficulty/save/reload.
- **58 final adventure/Defense/mobile regression tests passed**, including the original keyboard assertion, full Defense combat/economy/settings/account cleanup, all purchase shortcuts, dynamic-target placement, two-thumb input and both long-source pilots.
- **4 production offline tests passed**, including verified audio downloads, airplane-mode reload, removal/retry, stale estimate rejection and IndexedDB-unavailable audio fallback.
- **9 additional final account/reward/private-content boundary tests passed**, including direct policy checks and idempotent rewards.
- **36 backend policy tests passed** for billing, Quran access, experimental recitation, coach, Chronicles and native billing.
- Production Vite build passed; Capacitor iOS/Android asset synchronization and bundled-configuration checks passed. No native signed binary or physical device test is claimed.

### Genuine long-source host journey

The final browser host test physically steered through **all 206 Al-Araf ayahs**, including every required source-backed unit and continuous final crossing, all eight checkpoints (25, 50, 75, 100, 125, 150, 175, 200), section replay and save/reload at 50. It passed in approximately 3–4 minutes using virtual frames, real host keyboard dispatch and an intentionally throttled test renderer (1-second paints; actual game defaults to 30fps presentation and 120Hz physics). The driver never injects correct outcomes. This is deterministic interaction coverage, not a claim that a human completed the surah in three minutes. Exact ignored source assets are loaded; authorization transport and audio playback are controlled fixtures.

The earlier final-source attempt exposed the delayed periodic authorization race at ayah 49; that failure was retained in the operator evidence, fixed and independently reproduced by the held-request regression before the successful full rerun.

Authorized-source 2:255 expert and 2:282 long-workspace browser pilots pass without awarding spoken mastery. Whole Al-Baqarah 286 is covered by controller/reference fixtures only: a complete hosted 286-ayah source campaign was not available and is not advertised as verified here.

### Evidence locations

Operator logs under `/workspace/artifacts/`: `rush3-full-suite.log/json`, `rush3-final-extra.log`, `rush3-final-screens.log`, `rush3-final-regression.log`, `rush3-final-rerun.log`, `rush3-final-offline.log`, `rush3-backend.log`, `rush3-final-build.log`, `rush3-native-sync.log`, `rush3-final-security.log`, `rush3-release-full-host.log`, `rush3-release-ui.log`, `rush3-release-native-sync.log`. These local logs are not a hosted public evidence service.

Screenshots in this directory show actual game rendering: `routes-1440.png`, `routes-390.png`, `routes-844.png`, five `zone-*.png` views, `complete-desktop.png`, `defense21-1440.png`, `defense21-390.png` and `al-araf-complete-no-private-text.png` (completion ribbon only, with all private source text excluded). They contain free content or completion metadata only. Desktop, phone and landscape screenshots were visually inspected.

## Learner instructions

Open **Revision Lab → Surah Rush**, choose an available authorized surah/range, course and starting environment, then **Prepare game → Start journey**. Read the in-world continuation signs and physically move, jump or drop onto the corresponding route. Wrong selections lead to a recovery path; ordinary falls are motor recoveries. Use Replay ayah or the full-ayah hint when needed. Full-surah journeys offer section choices every 25 completed ayahs; a shorter custom range continues to its actual endpoint.

For **Ayah Defense**, begin supported revision to earn Construction Points, select an affordable tower, then tap/click valid free land (or use the existing placement keyboard controls). Green previews now include purchase validation, not just terrain validation. The opening grace period gives time to learn and build; neutral balloons are separate from protected Qur'anic content.

## Release and rollback procedure

Deploy the exact tested Git commit, not an unspecified Railway rebuild of the previous deployment. Verify `/build-info.json` matches that SHA and test both public games through Revision Lab after deployment. No SQL or hosted content upload accompanies this change. If an operational rollback is necessary, redeploy the previously known-good `2896280a5d79cfc5bfee293dcff98f445a017cef`; preserve/export any newer v3 run snapshots and never clear learning storage as part of a rollback. Earlier engines may offer recovery instead of resuming newer movement state. Independent recall/FSRS records remain separate.
