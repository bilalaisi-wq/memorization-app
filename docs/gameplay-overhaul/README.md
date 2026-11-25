# Ayah A Day — Ayah Defense, Surah Rush and shared gameplay upgrade

## Audit and preservation boundary

Baseline: `9bc1d98`. The existing app uses Vite/vanilla JavaScript, DOM/SVG arcade scenes, independent memory/motor profiles, shared gameplay frames and input focus, authenticated passage loaders, bounded arcade passage plans, immutable source/review fingerprints, account-scoped local stores and capped reward receipts. No external game engine was needed or installed.

The audit found working automatic basic Cosmic stage handoffs and existing start/resume focus. Missing pieces were current-challenge difficulty restart contracts, an expand control, and two actual replacement long-passage games. Blocks had a constrained board/grid; the first size change exposed a percentage/aspect-ratio cycle on narrow screens and a landscape reading-guide rule that could put the keypad in an implicit third row, leaving the playfield zero height. Regression tests cover those exact start/control failures and resizing without rebuilding physics.

Existing memorization, Puzzle Lab mechanics, FSRS, source text, original game IDs, billing and RLS remain authoritative. Unrelated pending Phase 9/10 account/legal/native-release work is excluded from this change. No missing Quran assets are imported or advertised as released.

## Two new games

### Ayah Defense

`src/revision/adventures/defense.js` is a pure 60 Hz fixed-step tower-defense engine. Its world has a winding waypoint path, six build sites, queued inactive blueprints, a core with shields, coins, construction energy, upgrades, cooldowns and moving neutral enemies. Correct source decisions supply six construction energy exactly once per prompt receipt. A priority queue fills towers automatically; no construction confirmation screen interrupts revision. Coins are ordinary deterministic arcade resources, never paid currency.

The six towers have distinct original vector symbols and implement different mechanics. A verified decision sends a gold energy trace toward the queued site; a completed tower rises briefly with a gold ring. Reduced/off effects remove decorative motion without changing construction:


| Tower | Actual behavior and upgrades |
|---|---|
| Arrow | Frequent direct attacks; range/rate growth and level-three multi-target fire |
| Frost | Slow; stronger slowdown and level-three area freeze |
| Beam | Frequent sustained damage that bypasses shields/armor; level-three piercing targets |
| Pulse | Area damage, growing blast radius, shorter firing interval |
| Guardian | Shield regeneration, local barrier knockback and a level-three emergency shield |
| Observatory | Nearby range/fire-rate bonuses and reduced nearby construction cost |

Walkers, scouts, armored units, swarms, shielded units and siege units differ in speed, durability, armor, shield or swarm behavior. Optional shield, overcharge and frost abilities have visible cooldowns. Five fictional expedition regions change presentation, with alternating path layouts; towers and upgrades carry forward. Source regions advance automatically, including five-ayah seams.

After twelve seconds without a committed revision response, neutral pressure drops, active enemies are bounded and the core cannot be unavoidably destroyed while reading. Core damage/recovery is motor performance. Three committed recognition mistakes pause for corrective retry; earlier source coverage stays saved. After the final ayah, the learner finishes a final neutral defense wave; victory is not shown at an internal seam.

### Surah Rush

`src/revision/adventures/rush.js` is an original 120 Hz fixed-step momentum platformer, not the lane runner. It has acceleration, friction, air control, buffered jumping, coyote time, dash cooldowns, sliding/low arch clearance outside Relaxed movement, slopes, gaps, springs, constrained optional loop/rail motion, a following camera and safe landings/recovery. Narrow screens use a closer following camera rather than shrinking the entire desktop course. Three bounded gap/spring layouts recycle as the logical journey advances. No copyrighted characters, sprites or sounds are used.

Arabic continuations live in a stable on-screen ribbon before the junction. At a closed gateway, approach speed is safely controlled and the runner waits indefinitely for a deliberate route. Number keys or route buttons choose a path; moving into the junction commits it. Correct wording opens the route and activates momentum/spring/loop behavior. A wrong route returns to a safe approach with recognition evidence; missed jumps are motor events. No Arabic is attacked or destroyed.

A final physical finish line is reached only after all selected source units have been accepted. A flow chain affects arcade score/momentum, never memorization mastery.

Controls: arrows/A/D move, Space jumps, S/Down slides, Shift dashes, 1–3 selects wording, Escape opens the shared pause menu. All essential movement/route actions have touch controls. Jump does not submit an Arabic response. Jumping off a rail provides an exit. There are no timed recitation requirements.

## Shared source stream and persistence

`content.js` plans exact canonical word-position slices. Short ayahs can use whole-ayah recognition; medium and long ayahs use bounded groups, and long units periodically include explicitly labeled cumulative reviews of previously studied groups. These reviews repeat study material intentionally; primary coverage remains the original ordered word positions. They are visual study workspaces, not approved waqf/ibtida units. The entire verified ayah recording is used, never synthetic stitched group audio.

Candidate text comes only from the authorized target source or existing free Quran sources. Canonical spelling/marks are retained. Comparison-only identity checks reject ambiguous distractors. Correct slots use seeded balanced permutations; hover/color does not disclose correctness. Hard memory requires readiness before choices and increases cumulative checks/similarity without shortening reading time.

Only current/adjacent source material is held by the new engine adapter. The complete selected reference range remains metadata. New games launch both from Revision Lab and the shared authorized-passage surface. New setup supports 5/10/15/20/30, custom contiguous ranges and entire surahs; private text/audio still requires the existing server loader. No local developer flag grants access.

`store.js` adds `ayah-flow-adventures-v1`, scoped through existing profile storage and included in export/recovery. It contains references, source/review hashes, settings, completed prefixes, current unit, bounded observed evidence, arcade construction/counters and reward retry receipts—not Quran text or recordings. Invalid records and invalid attempted mutations are blocked/preserved for export. Replay retains prior observed evidence. Resume starts a safe current physics section rather than claiming to restore an exact mid-jump coordinate.

This new store is device-local, not a claim of cross-device cloud synchronization. Existing cloud records and old game schemas are unchanged. Atlas, Forge and Command retain their IDs/data and are reachable through a clearly labeled archive, rather than primary recommendation cards.

## Learning and rewards

Memory, motor, assistance, independent assessment and FSRS outcomes remain distinct. The new engines never call an FSRS grader. A completed canonical ayah can earn the existing bounded lab reward with a stable `quest:` receipt keyed by game/reference/source fingerprint. Restart/replay cannot duplicate that award. Neutral combat and flow bonuses are arcade points only. Pending reward acknowledgments can retry idempotently.

Final independent self-assessment is offered through the established Passage Studio, in labeled sections up to ten ayahs. The underlying reference game is concealed while that assessment modal is open. Only the learner's actual assessment through the existing API can schedule a review.

Continuous full-ayah recitation is the default. Listen-before and paused audio are explicit options. Volume, mute, interruption cleanup, effects and optional transliteration reuse existing systems. Audio failure does not create a memory strike or certify assistance that was never heard. Private access is rechecked periodically and at source changes; access/profile changes dispose sources, media and input.

## Universal gameplay controls

- Shared Expand Game uses native fullscreen where available with an in-page fixed-viewport fallback.
- Blocks fills its allocated grid area without changing logical cells. Portrait controls retain thumb-sized buttons; duplicate Pause/full-ayah actions already in the toolbar do not take additional keypad rows. Hold, word playback and listening recovery remain reachable.
- Start/resume/current-challenge restart focuses the actual game surface. Inputs, selects and dialogs retain their normal keyboard behavior.
- Pause exposes independent memory/motor draft settings and an explicit **Restart with New Settings** action. The new games rebuild only the current pending challenge; basic Cosmic preserves saved earlier stages; ordinary Puzzle Lab retains original range and completed checkpoint/evidence; passage arcade retains its exact validated stage boundaries and earlier results.
- Changing a passage game's memory settings at a checkpoint changes support/distractors while retaining already planned source boundaries. A whole-plan regrouping remains an explicit setup operation; no completed source positions are silently reinterpreted.
- Classic losses retain their existing retry rules. Difficulty controls are shown only when a mounted host provides a safe restart contract. Boss/assessment screens retain their specific flows; they are not reinterpreted as generic arcade difficulty dialogs.
- Deliberate mission/boss/self-assessment handoffs are retained. Ordinary source/ayah boundaries in the new games and compatible existing chains do not require a new Start or Next Five action.

## Validation and deployment

Validation used clean staged snapshots so unrelated pending release work was not deployed. Results:

| Check | Result |
|---|---|
| Complete 1,196-case regression invocation | 1,182 passed; five initial failures; nine mode/fixture-dependent skips |
| All five failures rerun together after correction | **5 passed** |
| New adventure browser journeys | **8 passed**, including real combat/traversal, ten-ayah seam/reload, mobile/account disposal, 128-word reconstruction and source-load/retry recovery |
| Final focus/retry checks after the last focus adjustment | **2 passed** in separate focused invocations |
| Shared controls/viewport focused run | **31 passed**, one private-fixture skip subsequently exercised with operator files |
| Source model/operator run | **6 passed**, including all 206 prepared Al-Araf sources |
| Other operator-source checks | **5 passed**: full Al-Araf runner physics, pinned 67:1/2:255/2:282 workspaces and unavailable-service developer entry |
| Production-only offline cases | **4 passed** on the production worker/server |
| Backend billing/content/recitation/coach/Chronicles/native-billing policies | **36 passed** |
| Final production build, Capacitor asset synchronization and configuration check | **Passed** |

All nine conditional skips from the general run were exercised separately in the appropriate production or operator-fixture environment. This is a full run plus corrected/conditional reruns, not a claim that the original raw report contained zero failures. No remaining failing case was left unresolved in these runs.

The five general-run failures exposed one actual keypad size regression (restored to 68px), an obsolete broad speed-option assertion, two mobile tests targeting duplicate controls replaced by the toolbar, and an absent Playwright FFmpeg cache. Tests now use the real visible toolbar actions; the video test honors the configured base URL. The CDN denied the FFmpeg download, so recording used the installed system FFmpeg. Original assertions about source order, mistakes, storage, XP and FSRS were retained.

Screenshot review also caught swallowed SVG self-closing tokens, light-theme fullscreen contrast and undersized phone runner rendering; dedicated visibility/contrast/camera tests now cover those defects. Source-error controls survive repaint/repeated failure, and keyboard focus returns after successful selections and verified recovery.

Screenshots are actual browser rendering, not concept art:

| View | Desktop | Phone |
|---|---|---|
| Active tower defense | [Battlefield](defense-active-desktop.png) | [Expanded battlefield](defense-active-phone.png) |
| New games | [Defense completion](defense-desktop.png), [Rush completion](rush-desktop.png) | [Defense](ayah-defense-phone.png), [Surah Rush](surah-rush-phone.png) |
| Ayah Blocks | [Active board](blocks-active-1440.png) | [Portrait board and keypad](blocks-active-390.png) |
| Pause/settings | [Desktop/rotated capture](blocks-1440.png) | [Landscape controls](blocks-390.png) |

Full-suite JSON and individual command logs are retained as execution artifacts under `/workspace/artifacts/overhaul-*`. Web deployment uses a specific reviewed Git commit followed by a public build-info and interactive smoke check; the final implementation report records its result. No physical-device, signed store build or Capgo OTA publication is inferred from browser tests or Capacitor synchronization.

## Operator and release limitations

- The existing corpus blocker remains: unavailable/unreviewed assets stay unavailable. In particular, full live Al-Baqarah is not claimed; its long pilots and metadata/controller scenarios are labeled separately.
- Full source-validated Al-Araf checks require the ignored operator source directory; those assets are never committed into the public build.
- Real authenticated staging A/B, live developer/premium delivery and physical iPhone/Android/VoiceOver/TalkBack remain operator checks if credentials/devices are unavailable.
- No new Supabase migration, billing secret or religious publication approval is required for these frontend mechanics. Existing security and publication gates remain closed.
- Native projects can synchronize the same bundled frontend; this is not a signed store build, physical-device verification or proof of a Capgo OTA publication.

## Changed modules

| Files | Purpose |
|---|---|
| `src/revision/adventures/{content,store,defense,rush,ui}.js`, `ui.css` | Source-backed stream, recoverable adventure store, real engines and responsive game host |
| `src/revision/ui.js`, `src/passage-context/ui.js` | New primary cards and shared authorized-passage launches; retain old archive |
| `src/ui/gameplay-frame.{js,css}`, `cosmic-gameplay-frame.js` | Expand, independent pending settings, safe restart and usable Blocks geometry/keypad |
| `src/puzzles/puzzle-lab.js`, `falling-ui.js`, `arcade/session.js`, `arcade/bridge/engine.js` | Current-checkpoint restart with original completed prefix/evidence |
| `src/puzzles/arcade/passage/{host,store}.js` | Preserve exact long-passage stage boundaries and earlier result records |
| `src/quest/cosmic/{authorized-runner,controller}.js`, `src/revision/continuous/model.js`, `src/puzzles/arcade/cosmic/{flow-runner,ui}.js` | Streamed runner presentation/restart contract and actual independent motor rate |
| `src/learner/profile-storage.js` | Include additive adventure key in account-scoped export/recovery |
| `tests/adventures-{model,ui}.spec.js`, `gameplay-upgrade-ui.spec.js` | New engines, full-range seams, source positions, revocation, visible SVGs, viewport and safe restart regressions |
| Existing catalog, passage, falling-interaction tests | Archive visibility, primary-card count, restart preservation and properly scoped legacy-speed assertion |

No canonical Quran data, approved recitation boundaries, FSRS parameters or Supabase policies were changed. No new engine dependency was installed.
