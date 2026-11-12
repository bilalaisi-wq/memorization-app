# Ayah Bubble Burst

Open **Your Space → Puzzle Lab → Ayah Bubble Burst**, choose a Single Ayah or consecutive Ayah Chain, then **Prepare bubbles → Start bubbles**.

## Playing

- Drag on the formation to aim; release to launch. The connector travels through space and reflects from the side walls.
- Keyboard: Left/Right aim, Space/Enter launches, P pauses. The large aim buttons, launch button and angle slider also support keyboard and touch.
- Connect the next verified word or phrase. Each suspended cluster repeats one piece; clearing that connected cluster adds the piece **once** to the RTL construction line.
- Incorrect committed hits consume one memory charge. Open-space misses are motor events only. Three memory mistakes end a Classic run; Practice restores the budget at each ayah and retries the current checkpoint. Navigation, lag and audio failures do not consume memory charges.
- Full-ayah replay is available through both the shared Puzzle Lab controls and the in-game control. Listen & Build repeats the full ayah; Silent leaves manual listening available. Phrase audio is study assistance and uses the exact source word clips sequentially. Volume/mute use the existing shared controls.
- A completed formation saves automatically. Failed saves stay visible and can be retried without duplicate rewards. Play Again starts a fresh flight immediately after a successful save. A chain offers an explicit next-formation transition.

## Mechanics and source integrity

`src/puzzles/arcade/bubble/engine.js` is a deterministic state reducer with swept/substepped projectile movement, circle collision detection, wall reflections, adjacency-based cluster search, shared three-strike sessions and bounded formations. Only four or six suspended circles are shown at once. Every target is reachable directly; ricochets offer an alternative route. Required clusters remain after misses or incorrect shots. Colors are identical for correct and incorrect candidates.

Beginner uses larger stationary word targets and two candidate clusters. Standard uses three denser clusters. Expert uses authentic similar phrase distractors, larger phrase targets and a dimmer geometric guide. Expert uses only complete short ayahs or source-matched published reviewed phrases, never draft visual boundaries. Bubble phrase targets are limited to four source words for readability; oversized phrases fail preparation without replacing the current game. Beginner/Standard can still study those ayahs word by word. No Qur'anic wording or reviewed boundaries are generated or changed.

The aim guide represents geometry only; it does not identify correct answers. Correctly resolved words remain intact in the construction line while cosmetic stars lift away. The visible construction line shows the latest 12 words for long ayahs; the complete canonical collected sequence remains in session state.

`ui.js` implements the existing start/pause/resume/dispatch/getSnapshot/dispose contract, plus shared listen/mute/setVolume controls. Disposal removes animation frames, media and event listeners. Background/inert surfaces reject keyboard input. Reduced-motion preferences remove cosmetic effects, not readable text or necessary projectile motion. CSS is imported by the Vite entry points, keeping UI module imports usable in Node tests.

The game is available through the shared registry and Quest activity host. Existing account-scoped result recording, daily XP caps and idempotent receipts are reused. `ayah-puzzle-lab-v1` records add safe Bubble score/shot/bounce metadata without a migration or reset. Motor evidence is separate from memory mistakes; reference/word audio counts as assistance. Arcade completion does not schedule FSRS, verify speech, certify tajweed or award independent memorization mastery. Existing premium-content authorization and source review policies are unchanged.

## Validation

`tests/bubble-engine.spec.js` covers deterministic provenance, real movement and ricochet collision, cluster clearing, lag/motor separation, three strikes, Classic/Practice chain budgets, multiple seeds and longer ayahs, reviewed phrase restrictions, lifecycle cleanup, owner isolation, XP idempotency and FSRS non-interference.

`tests/bubble-ui.spec.js` covers pointer/keyboard/touch play, victory and replay, visible save failure/retry, chain progression, shared replay, volume, sequential phrase audio, failed playback, game-over/retry, mobile sizing and reduced motion. Existing planned-game fallback tests now use the still-unimplemented Bridge Builder instead of Bubble Burst.

Screenshots: [desktop](bubble-burst/desktop.png), [mobile](bubble-burst/mobile.png), [mobile Expert phrases](bubble-burst/mobile-expert.png). These are local QA captures, not real learner data. Physical-device testing remains recommended before a mobile-store release.

Release checks: the full Playwright suite passed **445 tests** (including all existing Falling Words, Quest, account, source and FSRS regressions). The 18 Bubble tests were rerun after explicitly applying the existing Uthmanic font to both the bubbles and construction line. Production build passed. No SQL migration, API key or new package dependency is required.

## Focused gameplay upgrade (2026-11)

The launcher, circle collisions, wall reflections, audio, shared result system and canonical selection rules are retained. A three-lane six-circle field now persists across shots: only the resolved cluster and the newly assigned target lane are replenished. At least one unrelated cluster remains in place after an ordinary successful shot. Canonical wording is carried intact into the RTL construction rail; only neutral beads/stars float away.

Answer placement mixes the session seed before shuffling, varies both lane and height, and avoids repeating the previous target lane. Correct and incorrect circles use identical styling. Snapshot placement history and bounded result placement-count metadata support distribution audits; a 600-seed test checks all three lanes and vertical variation. Neutral pendants carry explicit support IDs; clearing their supporting cluster releases them and earns arcade combo points. Wall-bank captures add a bounded arcade bonus. These points do not bypass learning XP limits.

The geometric trajectory guide stops at its first circle collision and includes wall reflections. Relaxed movement never descends. Other movement profiles lower the formation by 18 world units after every four completed shots, with no reading countdown. The safe-line recovery freezes play and offers a height reset, preserving canonical construction and memory charges. Incorrect Arabic captures still cost exactly one strike; empty-space misses and recovery never grade memorization. Classic/Practice rules and historical game IDs remain unchanged.

Validation: **20 Bubble engine/browser tests passed**, including 600-seed balance, persistent IDs, support/cascade behavior, real bank collisions, long-source order, three strikes, motor recovery, guest/account result isolation, reward idempotency, mobile pointer/keyboard play and unchanged recall history. Production build passed. No Supabase migration is needed for Bubble Burst. Full merged regression is reported separately. Captures: `/workspace/artifacts/bubble2-desktop.png` and `/workspace/artifacts/bubble2-mobile.png` (390px; local fixture only).
