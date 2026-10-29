# Memory Maze

Memory Maze is a navigable top-down Puzzle Lab adventure, alongside Ayah Blocks, Ayah Space and Ayah Serpent. It uses the existing authorized Qur’an library, arcade session ledger, audio manager, account-bound result recorder and learning XP caps. No database migration is required.

## Play

Open **Your Space → Puzzle Lab → Memory Maze**. Choose Single Ayah or a consecutive Ayah Chain, a starting/ending ayah, Classic/Practice checkpoints and difficulty. Select **Prepare maze**, then **Enter maze**.

Use arrow keys/WASD, the large touch direction pad, a swipe, or an adjacent tile tap to move one tile. Walk to a numbered door, read its Arabic sign below the map, and press Enter/Space or **Open door**. Signs cannot be clicked to bypass navigation. There is no timer, movement race, or penalty for taking time to read.

A correct continuation appends its exact source words to the RTL construction line and opens the next maze wing. Each wing is a new layout within the same ayah chamber. Incorrect choices cost exactly one memory strike and physically enter a one-tile dead end: move up to return to the choice hall. Merely approaching a wrong door never costs a strike. Wall bumps are recorded as motor events only. The final doorway completes the ayah; in Chain mode the doors become portals, and opening one enters the next ayah chamber.

- **Beginner:** 9-column carved maze, visible map, two doors.
- **Standard:** 13-column maze, explored-map fog, three doors.
- **Expert:** 17-column maze, fog, three phrase doors, distractors ranked by normalized textual similarity to the current target. This is a distractor heuristic, not an interpretation of meaning.

A seeded depth-first backtracker carves a connected maze. A separate choice hall and independent alcoves guarantee that every door can be reached without traversing another door. Every carved tile, listening station and alcove has a path back to the entrance. Navigation itself cannot make the required continuation disappear or become inaccessible. Seeds and canonical positions determine the same layout and door ordering on replay of a state; a new journey receives a new seed.

Fog remembers explored nearby tiles. **Reveal map** toggles the full map and records hint assistance in fog modes. Beginner's already-visible map does not create a hint. Zoom in/out changes only map scale; the scrollable camera follows the player. The map announces coordinates and available directions as a nonvisual navigation aid, with door text in normal accessible HTML. Reduced-motion preference disables victory decoration. The map has no animated movement requirement.

## Audio and learning integrity

Full verified ayah audio plays once at chamber entry by default. **Replay full ayah** is always available, including at the marked ♫ listening station. Silent mode stops playback; replay remains available on request. Shared Puzzle Lab mute and saved 0–100% volume work unchanged. Failed playback never consumes a strike or prevents exploration. Pausing/backgrounding pauses the session; leaving the game disposes media and all owned input listeners. There is no simulation timer to leak or catch up after lag.

Beginner/Standard use exact canonical word occurrences for short ayahs. Expert uses teacher-approved study segments, or an existing short whole-ayah boundary (at most eight words). Longer ayahs require published, approved segment coverage matching the canonical source revision; draft, overlapping, incomplete, oversized or mismatched content is refused. Approved phrases are limited to twelve words for sign readability. Distractors carry their original ayah/word references and audio provenance; display text is never normalized or generated.

A study phrase is **not** permission to stop recitation there. This game always uses full-ayah audio. Waqf/restart approval stays separate from visual segmentation. A short whole-ayah Expert chamber can contain just one phrase doorway; it tests continuation recognition without inventing internal phrase boundaries.

Classic has three memory strikes for the entire run and restarts from the first chamber after a loss. Practice resets the strike budget when entering a new chamber and retries the current ayah after a loss, retaining completed chambers in that active session. Completed results persist; unfinished mid-maze position is not resumed after a browser reload, consistent with existing arcade games.

Victories save through `createResultRecorder` with stable per-ayah receipts. Repeated saves are idempotent, account switches are rejected, historic `ayah-puzzle-lab-v1` records remain valid, and existing per-ayah/game/day XP caps apply. Arcade scores do not change FSRS, independent recall, stars or mastery rules. Completion offers confirmed-save/retry feedback, play again, next ayah(s), custom selection, Practice, self-assessed recall and study/break options. Suggestions use existing goals and due-review facts; they never grade recitation.

## Files and verification

- `src/puzzles/arcade/maze/engine.js`: deterministic layouts, verified content adaptation, choices, navigation, fog, strikes and portals.
- `src/puzzles/arcade/maze/ui.js`: lifecycle contract, accessible map/signs, keyboard/touch, audio, completion and next steps.
- `src/puzzles/arcade/maze/maze.css`: garden and Night Sky presentation, responsive controls, reduced motion.
- Puzzle Lab/registry/store registration, tutorial and pro tip additions preserve existing IDs and storage.
- `tests/maze-engine.spec.js`: connected solvable layouts across seeds/difficulties; all current ayahs' source integrity; movement, fog, assistance, motor errors, dead-end recovery, checkpoints/retry, approved phrase guards, longest ayah completion, persistence, account isolation, XP caps and FSRS non-interference.
- `tests/maze-ui.spec.js`: actual launcher/keyboard/doorway play, RTL results, save/replay/reload, chain retry, fog/zoom/input guards, audio/volume/failure/disposal, mobile touch/reduced motion/Night Sky, failed saves and unavailable phrase approval.

Run `npx playwright test tests/maze-engine.spec.js tests/maze-ui.spec.js`, then `npm test` and `npm run build`. Physical mobile-device and screen-reader QA remain separate from automated Chromium checks. No hosted content, billing, review approvals or backend configuration is changed by this feature.

Release validation: the full application suite passed **275 Playwright tests** and the production build. Preview images are in `docs/memory-maze-previews/`; reproduce them with Vite on port 5192 and `node scripts/maze-screenshots.mjs`.
