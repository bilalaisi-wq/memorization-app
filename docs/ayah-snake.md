# Ayah Snake

Puzzle Lab → **Ayah Snake** → Single Ayah or Ayah Chain → **Prepare trail** → **Start trail**.

Snake is a distinct, continuously moving 10 × 12 grid game. The learner steers a growing snake into the next canonical Arabic word, while avoiding the walls, tail and incorrect word choices. Collectibles are not clickable answers. Each readable word occupies a three-by-two-cell area; entering any of those cells collects it. A separately readable RTL line assembles the exact source words.

## Controls and audio

- Arrow keys / WASD steer; reverse turns are ignored. Only one direction change is queued per grid step.
- The large direction pad supports touch, pointer and native keyboard activation. Swipe the garden to turn on touch devices.
- **Slow** (1 second/cell), **Steady** (650 ms/cell) and **Brisk** (380 ms/cell) can be changed during play. P or Pause trail pauses; Resume restores movement with a fresh interval.
- Full-ayah **Listen & grow** loops the existing verified recitation. Replay ayah works independently; Silent stops playback. The existing Lab mute also applies.
- Window blur/backgrounding pauses. Animation frame gaps over 200 ms are discarded instead of catching up several moves and colliding unfairly.
- Reduced motion removes decorative portal, victory and transition effects, while retaining necessary grid movement. Arabic never disappears at higher speed.

Say each word aloud as it is collected. Arcade recognition is separate from independent spoken recall. Audio failure does not stop movement or consume a memory strike; successful listening is recorded as assistance. Recordings are not spliced at word boundaries or presented as new recitation stopping guidance.

## Memory mistakes versus motor collisions

Only collecting an incorrect word costs a memory strike. Correct collection grows the tail by one cell and gives 100 arcade points. Completing a garden gives another 200 points. The board always spawns the next required word with up to two verified distractors. No source Arabic is rewritten, normalized for display or AI-generated.

A wall/tail bump records a **motor event**, safely pauses the snake and offers **Continue on a safe route**. Recovery preserves the words already collected, tail length, score and memory strikes, and relocates collectibles. It does not count as failed recall or reduce learning XP.

Placement is seeded and deterministic. Food cannot overlap the snake or another food object, or spawn immediately against the head. The required food is placed in reachable free space first. A distractor is admitted only if a route to the required word remains without crossing incorrect food. Reachability is checked conservatively against the body; if the growing tail later closes a route, the game offers a safe reset instead of an unwinnable position. Required words return after relocation or an incorrect collection.

Moving into the cell vacated by the tail is legal unless the snake is growing. No word is exploded or visually fragmented.

## Journeys and completion

Single Ayah assembles one ayah. In Ayah Chain, finishing an ayah creates a reachable glowing **portal**. The learner must physically steer into it to enter the next garden. Each garden starts with a fresh three-cell snake and empty construction line.

- **Classic:** three memory strikes across the whole run. Retry restarts at the first ayah and resets the arcade score.
- **Practice:** three per ayah, with completed portal checkpoints preserved. Retry restarts the current ayah and removes only its unfinished arcade points.

Victory confirms **Trail saved**, then offers replay, a short next range, different ayahs, Practice, self-assessed recall or a break. Replay/continuation retain speed, recitation preference and checkpoint rules, with a fresh session/seed. Recommendations reuse the shared goal/due-review/time-budget policy; recent Snake rounds count separately from Asteroids flights.

A save failure is visible in the victory panel, and Retry saving uses the same receipt. Replays wait for a successful save; explicit Return to study remains available. Saving does not award memorization mastery. Failed/unfinished rounds stay in the active session; completed-run records retain mistakes and motor events, including retries.

## Verified content and persistence

The available library is the existing Al-Fatihah and full Juz Amma collection: 38 surahs / 571 ayahs. All currently supplied ayahs have at most 21 verified words. Only the active ayah's next word and distractors render, so long chains never create hundreds of collectibles.

The shared adapter supplies exact display words, stable occurrence/reference IDs and verified audio. Unknown references or word workspaces over 40 words fail closed. This release does not expose additional premium surahs or implement unreviewed long-ayah phrase workspaces.

The existing shared result recorder handles per-ayah/game/day XP caps, account identity binding and duplicate receipts. The `ayah-puzzle-lab-v1` root schema/key is unchanged. Optional schema-3 arcade metadata adds bounded Snake score, grid-step count and speed alongside existing mistake, assistance, motor-error and checkpoint records. Arcade points are **not** leaderboard XP and have no exchange rate. No database migration is required; existing history, XP, stars, accounts, FSRS cards and due dates remain unchanged.

## Files and tests

- `src/puzzles/arcade/snake/engine.js`: pure grid movement, queued direction, growth, collision classification, reachable placement, portal/checkpoint flow and scoring.
- `ui.js` / `snake.css`: garden, head/tail, readable Arabic, continuous clock, keyboard/touch/swipes, full-ayah audio, reduced motion, completion choices and owned-resource cleanup.
- `src/puzzles/arcade/next-steps.js`: shared pacing policy, with the old Asteroids import preserved by a compatibility re-export.
- Registry, Puzzle Lab launcher and existing result recorder integrate the new game without changing older engines.

The tests cover deterministic source provenance, queued controls, growth, walls/tail, all current verses' initial placement reachability, the longest current ayah's complete playable route, physical portal crossing, Classic/Practice budgets, score resets, capped/idempotent XP, FSRS non-interference, continuous clock/lag behavior, real mobile touch/swipes, reduced motion, audio cleanup/failure, saved progress/replay and failed-save recovery.

[Desktop preview](snake-previews/desktop.png) · [Mobile preview](snake-previews/mobile.png). The screenshots show real local play with the first Al-Fatihah word collected, not fabricated account progress. Reproduce with Vite on port 5183 and `node scripts/snake-screenshots.mjs`.

Validation: the full Playwright suite passed **247 tests**, including the existing Falling Words and Asteroids suites. After refining held-direction handling, all **14 focused Snake tests** passed again. The final production Vite build passed. No hosted configuration, database migration or canonical Qur'anic data changed.
