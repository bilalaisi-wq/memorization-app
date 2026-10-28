# Falling Words 2.0 — Hybrid Stack + Tower

Open **Your Space → Puzzle Lab → Falling Words**. Existing records and other Lab games remain available. No database migration, new service, image upload, or paid dependency is required.

## Play

- Choose Single Ayah, a consecutive Ayah Chain, or Marathon, then press **Start**. Until Start is pressed, there is no motion or automatic audio. Start begins falling blocks and looping full-ayah recitation by default.
- Build the correct words in recitation order in the marked emerald middle lane (columns 4–7). Park extra words in either side lane (columns 1–3 or 8–10). All four cells must fit in a side lane for safe parking; rotate the I piece when necessary. A wrong word in the middle sequence costs a strike. Side parking never does. Required words parked to the side return so the ayah stays completable.
- There is no Discard button or D/Delete shortcut. Arrow keys move, ↑/X rotates, ↓ lowers, Space drops, C holds, and P pauses. Keyboard commands work while the game is active without requiring a click on the board; form inputs, dialogs, navigation and completion choices keep their own keyboard behavior.
- Blocks fall and lock automatically on landing. Slow, Normal and Fast are the only speed choices; there is no Relaxed mode or timed-descent checkbox. A paused game does not allow untimed movement or placement.
- **All words remain visible.** Falling and held words retain their original Uthmanic text. Settled blocks keep labels, accepted words remain in the RTL ayah line, and parked words remain in a full-size side ledger. Falling Words has no concealed-word levels or additional difficulty-based distractors. Other Puzzle Lab games retain their existing hint-removal levels.
- Every completed ayah pauses for a choice: repeat this ayah at the next faster speed, or continue to the next ayah. Speed increases cap at Fast; learners can lower speed without clearing the active puzzle. Advancing is always explicit, including inside a configured chain.
- Three red Xs end an attempt. Retry, Listen & Review, and Exit remain available. Classic carries strikes across a chain; Practice restarts the current ayah while preserving completed floors.
- Required occurrences are delivered in a solvable order with varied, source-backed extra words interleaved. Hold parks/swaps one word. A full physical workspace refreshes without erasing the readable ayah line or side ledger. Stack height is not a memory assessment.

## Audio

Listen & Build is the default and loops verified full-ayah recitation after Start. Silent Stack turns automatic playback off. Echo & Build plays it before movement begins. Manual word and ayah listening pauses motion until playback ends, or the learner selects Continue / Resume. There is one owned audio instance, canceled before another begins, before a floor changes, and on reset/exit. Autoplay failures show a recoverable message; they cannot cause strikes. Existing Mute and Replay controls remain usable.

Say each word aloud and echo the reciter. The game uses source-backed Quran words and original verified audio; no wording, pronunciation or internal recitation stops are generated. Playback is full-ayah or the existing verified word recording, with no arbitrary audio slicing.

## Progress, privacy and accuracy

`ayah-puzzle-lab-v1` remains schema version 1. New history rows add an optional `arcade` document with `schemaVersion: 2`: selected references, Classic/Practice rules, speed, audio mode/use, arcade score, completed floors, success/failure, and source-referenced errors. Historical entries remain valid; no migration or reset is required. Failure history awards zero game XP and contributes to corrective ordering practice. Errors already recorded during a Practice retry are not counted twice in weakness totals.

A successful journey uses the existing per-ayah/game/day bounded Lab reward and receipt deduplication. Replay, longer chains and faster settings cannot bypass that ceiling. Arcade score is separate from XP, stars, gallery gates and memorization mastery. These puzzles never grade recitation or reschedule FSRS. Existing bounded participation XP continues under the site's independent rules.

Records use the current account's existing versioned storage, with the same progress export/sync behavior. No microphone access, external AI transmission or new identity collection is added.

## Implementation milestones

| Milestone | Files / behavior | Verification |
|---|---|---|
| A | `falling-engine.js`: pure cells, collision, rotation, gravity, landing, queue/hold, strikes | Seven geometries, wall/stack bounds, automatic locking, safe side parking, middle-sequence strikes, recovery, duplicate occurrences, and the verified Ash-Shams/Al-Layl example |
| B | `falling-ui.js`, `falling.css`: single-ayah construction, three strikes, audio and accessible controls | Browser completion, game-over/retry, RTL, reduced motion, mobile width and manual audio tests |
| C | Same UI: consecutive chain, completed floors, transition, Classic and Practice budgets | Chain carry-over, Practice retry preservation, audio switching and completed-reference history tests |
| D | `puzzle-lab.js`, `puzzle-store.js`, `distractors.js`, `main.js`, memory tips | Existing capped rewards, storage failure recovery, legacy records, all other Lab games, production build and full Playwright suite |

## Intentional limits

This is a word-order memorization game, not independent recitation verification. Collision blocks illegal geometry. Automatic landing applies the same middle-sequence/side-parking rules as Space. Required-word order remains solvable rather than presenting a random sequence that forces errors with only one Hold slot. Cosmetic block animation respects reduced motion; per-word success uses the stack shimmer instead of an overlay obscuring Arabic. The app's existing celebration runs on journey completion. New premium-library surahs require their separate Puzzle Lab integration; this release preserves the currently supported Lab library.

## Release validation and previews

The production build passed. The revised full Playwright suite passed **207 tests**; final keyboard/audio checks were also verified with **41 targeted engine, browser and Lab regression tests**, followed by **8 UI checks** for the final Hold/side-ledger layout. All **20 existing backend tests** passed (billing 6, content 4, recitation 5, coach 5). Two earlier browser tests now explicitly wait for application readiness before invoking internal UI functions, eliminating startup races rather than relying on module timing.

[Desktop and mobile UI previews](falling-previews/README.md) and `scripts/falling-screenshots.mjs` provide reviewable captures. Existing verified Qur'anic data, audio files and the FSRS learning store were not modified. Word positions use the existing zero-based source/audio indexing; learner-facing positions are numbered from one.
