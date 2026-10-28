# Falling Words 2.0 — Hybrid Stack + Tower

Open **Your Space → Puzzle Lab → Falling Words**. Existing records and other Lab games remain available. No database migration, new service, image upload, or paid dependency is required.

## Play

- Pick Single Ayah, a consecutive Ayah Chain within the current surah, or Marathon (whole surah, Classic rules). Apply the range with Start journey.
- Move the actual four-cell tetromino around the 10 × 18 board. Rotate, lower, use its ghost landing, or hard-drop. The full Uthmanic word stays together on a readable placard attached to the piece's row; its letters are never distributed over squares.
- Confirm words in recitation order. The geometric stack is a workspace; the separate RTL construction line keeps every accepted word. Word-position buttons also allow direct placement decisions. Wrong order/position, a dropped distractor, or rejecting a required occurrence costs one strike. Required occurrences return; identical repeated words retain their multiplicity.
- The required occurrences arrive in a completable canonical sequence with shuffled distractors interleaved. Hold allows parking/swapping one word. Pieces stop at contact until a deliberate confirmation. A full physical workspace refreshes without erasing the constructed ayah; stack height is not a memory assessment.
- Three red Xs end the attempt. Retry, Listen & Review, and Exit are available in a keyboard-accessible dialog. Classic restarts the entire journey. Practice restarts the failed ayah and retains completed tower floors, giving a fresh three-strike budget for that ayah.
- Relaxed has no automatic descent. Slow, Normal and Fast change only gravity. Speed can change without resetting the run; faster play or recitation receives no extra XP.

## Audio

Silent Stack has no automatic playback. Listen & Build loops verified full-ayah recitation. Echo & Build plays it before movement begins. Manual word and ayah listening pauses motion until playback ends, or the learner selects Continue / Resume. There is one owned audio instance, canceled before another begins, before a floor changes, and on reset/exit. Autoplay failures show a recoverable message; they cannot cause strikes. Existing Mute and Replay controls remain usable.

Say each word aloud and echo the reciter. The game uses source-backed Quran words and original verified audio; no wording, pronunciation or internal recitation stops are generated. Playback is full-ayah or the existing verified word recording, with no arbitrary audio slicing.

## Progress, privacy and accuracy

`ayah-puzzle-lab-v1` remains schema version 1. New history rows add an optional `arcade` document with `schemaVersion: 2`: selected references, Classic/Practice rules, speed, audio mode/use, arcade score, completed floors, success/failure, and source-referenced errors. Historical entries remain valid; no migration or reset is required. Failure history awards zero game XP and contributes to corrective ordering practice. Errors already recorded during a Practice retry are not counted twice in weakness totals.

A successful journey uses the existing per-ayah/game/day bounded Lab reward and receipt deduplication. Replay, longer chains and faster settings cannot bypass that ceiling. Arcade score is separate from XP, stars, gallery gates and memorization mastery. These puzzles never grade recitation or reschedule FSRS. Existing bounded participation XP continues under the site's independent rules.

Records use the current account's existing versioned storage, with the same progress export/sync behavior. No microphone access, external AI transmission or new identity collection is added.

## Implementation milestones

| Milestone | Files / behavior | Verification |
|---|---|---|
| A | `falling-engine.js`: pure cells, collision, rotation, gravity, landing, queue/hold, strikes | Seven geometries, wall/stack bounds, pause/loss immutability, recovery, duplicate occurrences and deterministic solvability tests |
| B | `falling-ui.js`, `falling.css`: single-ayah construction, three strikes, audio and accessible controls | Browser completion, game-over/retry, RTL, reduced motion, mobile width and manual audio tests |
| C | Same UI: consecutive chain, completed floors, transition, Classic and Practice budgets | Chain carry-over, Practice retry preservation, audio switching and completed-reference history tests |
| D | `puzzle-lab.js`, `puzzle-store.js`, `distractors.js`, `main.js`, memory tips | Existing capped rewards, storage failure recovery, legacy records, all other Lab games, production build and full Playwright suite |

## Intentional limits

This is a word-order memorization game, not competitive Tetris or independent recitation verification. Collision blocks illegal geometry; stack height and time never produce automatic strikes. Required-word order remains solvable rather than presenting a random sequence that forces errors with only one Hold slot. Cosmetic block animation respects reduced motion; per-word success uses the stack shimmer instead of an overlay obscuring Arabic. The app's existing celebration runs on journey completion. New premium-library surahs require their separate Puzzle Lab integration; this release preserves the currently supported Lab library.

## Release validation and previews

The production build passed. The full Playwright suite passed **204 tests**; the final animation/focus optimization was then verified with **39 targeted engine, browser, persistence and Lab regression tests**. All **20 existing backend tests** passed (billing 6, content 4, recitation 5, coach 5). Two earlier browser tests now explicitly wait for application readiness before invoking internal UI functions, eliminating startup races rather than relying on module timing.

[Desktop and mobile UI previews](falling-previews/README.md) and `scripts/falling-screenshots.mjs` provide reviewable captures. Existing verified Qur'anic data, audio files and the FSRS learning store were not modified. Word positions use the existing zero-based source/audio indexing; learner-facing positions are numbered from one.
