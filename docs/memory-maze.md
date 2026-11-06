# Memory Maze

Memory Maze is a navigable top-down Puzzle Lab adventure, alongside Ayah Blocks, Ayah Space and Ayah Serpent. It uses the existing authorized Qur’an library, arcade session ledger, audio manager, account-bound result recorder and learning XP caps. No database migration is required.

## Play

Open **Your Space → Puzzle Lab → Memory Maze**. Choose Single Ayah or a consecutive Ayah Chain, a starting/ending ayah, Classic/Practice checkpoints and difficulty. Select **Prepare maze**, then **Enter maze**.

Use arrow keys/WASD, the large touch direction pad, a swipe, or an adjacent tile tap to move one tile. Walk to a numbered door, read its Arabic sign inside the playfield, and press Enter/Space or **Open door**. Signs cannot be clicked to bypass navigation. There is no timer, movement race, or penalty for taking time to read.

A correct continuation appends its exact source words to the RTL construction line and opens the next maze wing. Each wing is a new layout within the same ayah chamber. Incorrect choices cost exactly one memory strike and physically enter a one-tile dead end: move up to return to the choice hall. Merely approaching a wrong door never costs a strike. Wall bumps are recorded as motor events only. The final doorway requires all three memory keys to complete the ayah. In Chain mode the doors become portals: opening one presents an untimed last-word-to-next-opening decision. Only its correct canonical continuation enters the next ayah chamber.

- **Beginner:** 9-column carved maze, visible map, two doors.
- **Standard:** 13-column maze, explored-map fog, three doors.
- **Expert:** 17-column maze, fog, three phrase doors, distractors ranked by normalized textual similarity to the current target. This is a distractor heuristic, not an interpretation of meaning.

A seeded depth-first backtracker carves a connected maze. A separate choice hall and independent alcoves guarantee that every door can be reached without traversing another door. Every carved tile, listening station and alcove has a path back to the entrance. Navigation itself cannot make the required continuation disappear or become inaccessible. Seeds and canonical positions determine the same layout and door ordering on replay of a state; a new journey receives a new seed.

Fog remembers explored nearby tiles. **Reveal map** toggles the full map and records hint assistance in fog modes. Beginner's already-visible map does not create a hint. Zoom in/out changes only map scale; the scrollable camera follows the player. The map announces coordinates and available directions as a nonvisual navigation aid, with door text in normal accessible HTML. Reduced-motion preference disables victory decoration. The map has no animated movement requirement.

## Memory Maze 2.0 rooms

Each wing has seven distinct reachable rooms within the existing carved corridors. None blocks a mandatory route.

- **◆ Crystal:** briefly reveals the exact first verified source piece, then conceals it after four seconds. Conceal immediately when ready; re-visit it for assistance. There is no deadline to answer and no penalty for taking time.
- **R Recognition:** identify the previously revealed crystal wording.
- **C Continuation:** identify the next canonical source piece after a visible cue.
- **L Connection:** connect the preceding selected ayah’s last word to the current opening. In the first chamber, connect consecutive source pieces; a one-piece whole-ayah chamber instead links its ending to the complete verified unit.
- **↺ Correction:** after an actual Arabic error, optionally revisit the same mistaken source piece with a different cue. Corrections preserve their piece index, original cue and event provenance. They do not clear a strike, award extra XP or submit an FSRS review. Disable correction rooms in setup if desired.
- **⚙ Switch:** opens an optional loop through an existing wall. All rooms and doors remain reachable without it.
- **☾ Moon Garden:** a navigation landmark with directions to the listening station and southern choice hall.

Press **E** or **Interact** while standing in a room. Answer its readable in-frame choices with pointer, touch or keyboard. Return to Exploration dismisses a room decision without a strike. All three keys are required at the major gate, retained between wings of an ayah and reset for the next chamber. Each chain boundary also requires a genuine next-opening decision before progression. Canonical IDs and distinct verified wording determine correctness; repeated identical wording is removed from alternatives.

## Audio and learning integrity

Full verified ayah recitation loops continuously by default. Listen Before Exploring plays one full recording while navigation is paused; the learner resumes deliberately. Pause Recitation temporarily silences the current ayah, with continuous recitation restored at the next chamber. **Replay full ayah** is always available, including at the marked ♫ listening station. Silent mode stops playback; replay remains available on request. Shared Puzzle Lab mute and saved 0–100% volume work unchanged. Failed playback never consumes a strike or prevents exploration. Pausing/backgrounding pauses the session; leaving the game disposes media and all owned input listeners. There is no simulation timer to leak or catch up after lag.

Beginner/Standard use exact canonical word occurrences for short ayahs. Expert uses teacher-approved study segments, or an existing short whole-ayah boundary (at most eight words). Longer ayahs require published, approved segment coverage matching the canonical source revision; draft, overlapping, incomplete, oversized or mismatched content is refused. Approved phrases are limited to twelve words for sign readability. Distractors carry their original ayah/word references and audio provenance; display text is never normalized or generated.

A study phrase is **not** permission to stop recitation there. This game always uses full-ayah audio. Waqf/restart approval stays separate from visual segmentation. A short whole-ayah Expert chamber can contain just one phrase doorway; it tests continuation recognition without inventing internal phrase boundaries.

Classic has three memory strikes for the entire run and restarts from the first chamber after a loss. Practice resets the strike budget when entering a new chamber and retries the current ayah after a loss, retaining completed chambers in that active session. Unfinished runs now resume safely paused, including canonical cursor, position, fog, keys, corrections and completed chamber boundaries. Re-select the same range, difficulty and checkpoint rules and choose Prepare Maze, then Resume Exploration. Completed runs start fresh when played again; their result receipts remain saved. If result saving failed, reopening retries the original victory receipt instead of discarding it or duplicating XP.

Victories save through `createResultRecorder` with stable per-ayah receipts. Repeated saves are idempotent, account switches are rejected, historic `ayah-puzzle-lab-v1` records remain valid, and existing per-ayah/game/day XP caps apply. Arcade scores do not change FSRS, independent recall, stars or mastery rules. Completion offers confirmed-save/retry feedback, play again, next ayah(s), custom selection, Practice, self-assessed recall and study/break options. Suggestions use existing goals and due-review facts; they never grade recitation.

## Persistence and compatibility

The game ID stays `maze`. Existing `ayah-puzzle-lab-v1` history is never rewritten or reset. New account-scoped `ayah-maze-expeditions-v2` checkpoints contain metadata and source fingerprints, not copied Arabic or audio. Restore rebuilds the maze and choices from currently authorized canonical content, checks source revision, and conceals any crystal reveal. Account changes dispose the map, timers, media and listeners. Malformed/future or revision-mismatched saves are preserved with export and study recovery actions; they are not silently replaced.

Results append source-referenced room evidence and completed adjacent-ayah boundary IDs through the existing idempotent recorder. Motor errors, Arabic recognition mistakes and assistance remain separate. Existing XP caps and account checks apply. Neither room success nor corrections modify FSRS scheduling or claim independent spoken recall. No database migration is required.

## Files and verification

- `src/puzzles/arcade/maze/engine.js`: deterministic layouts, verified content adaptation, choices, navigation, fog, strikes and portals.
- `src/puzzles/arcade/maze/adventure.js`: deterministic room placement, authentic cue/choice adapters, keys, correction provenance and secret paths.
- `src/puzzles/arcade/maze/checkpoints.js`: versioned metadata-only run persistence and recovery.
- `src/puzzles/arcade/maze/ui.js`: lifecycle contract, accessible map/signs, keyboard/touch, audio, completion and next steps.
- `src/puzzles/arcade/maze/maze.css`: garden and Night Sky presentation, responsive controls, reduced motion.
- Puzzle Lab/registry/store registration, tutorial and pro tip additions preserve existing IDs and storage.
- `tests/maze-engine.spec.js`: connected solvable layouts across seeds/difficulties; all current ayahs' source integrity; movement, fog, assistance, motor errors, dead-end recovery, checkpoints/retry, approved phrase guards, longest ayah completion, persistence, account isolation, XP caps and FSRS non-interference.
- `tests/maze-ui.spec.js`: actual launcher/keyboard/doorway play, RTL results, save/replay/reload, chain retry, fog/zoom/input guards, audio/volume/failure/disposal, mobile touch/reduced motion/Night Sky, failed saves and unavailable phrase approval.

Run `npx playwright test tests/maze-engine.spec.js tests/maze-ui.spec.js`, then `npm test` and `npm run build`. Physical mobile-device and screen-reader QA remain separate from automated Chromium checks. No hosted content, billing, review approvals or backend configuration is changed by this feature.

Maze 2 regression coverage adds `tests/maze2-engine.spec.js` (180 deterministic seed/preset combinations, keys, corrections, chain transitions, persistence, account checks and FSRS neutrality) and `tests/maze2-ui.spec.js` (actual room traversal, crystal concealment, mistakes, reload, recovery and 390px touch). Preview images are in `docs/memory-maze-previews/`; reproduce with Vite on port 5173 and `node scripts/maze-screenshots.mjs`. See `docs/memory-maze-release.md` for the latest validation evidence and limitations.
