# Bridge Builder 2.0 tutorial and polish

## Learning flow

First-time Bridge entry automatically opens a skippable, replayable lesson before setup. It prefers the existing verified Al-Ikhlas 112:1–3 content. If unavailable, it uses an authorized consecutive triple; it never fabricates missing content.

1. Introduce the first two complete ayahs.
2. Start their existing full recordings in order, advancing only on recording completion. No cropped clips are created.
3. Highlight the previous ending and following opening and form a golden bridge.
4. Hide the opening and split the bridge.
5. Select a source-backed connector, with one explicit golden guide.
6. Connect the bridge and watch the lantern cross right to left.
7. Attempt a second adjacent transition without the answer guide.
8. Finish with a short explanation and open setup.

No strikes, game receipts, XP, stars, mastery or FSRS grades are generated. When a matching unfinished recall already exists, the established study-exposure API marks it assisted before reference text/audio appears; its review history and schedule are unchanged. If that assistance cannot be recorded, references and audio stay blocked rather than exposing help as independent recall. Wrong choices invite another attempt. Keyboard selection uses turquoise focus; the first lesson's answer guide is gold. The second lesson does not retain an answer cue. Both complete ayahs remain canonical source text; the visual connection does not approve a recitation stop.

Skip and Escape return to setup. How to Play works from setup and from a paused real game. No-audio mode supports the entire lesson. Audio errors offer retry or visual continuation; pause, replay and volume are available. Native dialog focus handling, keyboard controls, touch buttons and reduced-motion alternatives are supported. Hidden pages pause audio; closing/navigation/account changes dispose playback and listeners.

## State and real runs

`ayah-bridge-tutorial-v1` stores only a version and `unseen`, `skipped` or `completed` status in the current profile. It is separate from all memory/game history, included in export and never awards repeat rewards. A completed flag cannot be downgraded by skipping a replay. Invalid/future data is retained rather than reset; failed writes are reported.

A real run is paused and saved before tutorial replay. It remains available to resume afterwards. Preparing the same authorized route, difficulty, strike rules and Gate setting after reload restores its checkpoint safely paused. Old version-2 Bridge records remain supported. Animation may resume/replay from its last saved fraction. New tutorial flags and Bridge checkpoints remain browser-local/account-scoped; this change does not add cloud tables or claim cross-device tutorial synchronization.

## Scene and optional Gate

The game adds deep-blue water, turquoise banks/joints, golden snapping connections, a moving lantern, a right-to-left island chain map, strike lanterns, arrival transitions and completion/recovery scenes. Reduced motion preserves understandable progress without connector drift or decorative travel.

Beginner remains stationary/clickable. Intermediate can drift slowly. Advanced is labeled **Cold Crossing**, with recall before options and no automatic recitation. The optional **Bridge Gate** reviews two consecutive completed links after every three bridges when more of the chain remains. It uses the selected strike rules, has source-backed choices and saves its review state. It does not duplicate boundary completion, score, XP or FSRS outcomes.

## Files and reproduction

- `src/puzzles/arcade/bridge/tutorial.js`: separate tutorial content, flags, media and lifecycle.
- `engine.js`, `checkpoints.js`, `ui.js`: optional Gate and compatible run state, map and tutorial replay.
- `bridge.css`: scene polish, responsive tutorial and reduced motion.
- `src/puzzles/puzzle-lab.js`: automatic first visit and setup replay.
- `src/learner/profile-storage.js`: include tutorial flags in account export.
- `tests/bridge-tutorial.spec.js`: first visit, audio order, two actual choices, skipping/replay, keyboard, no audio, privacy cleanup, preservation/reload, mobile and Gate rewards.

Run `npm test -- --config=playwright.regression.config.js --workers=1` for the complete suite, and `npm run build` for production assets. With Vite running, `node scripts/bridge-tutorial-screenshots.mjs` performs actual pointer/native-touch decisions and captures full 1280×950 and 390×844 viewports using an explicit local developer fixture.

Inspected previews: [desktop](bridge-builder/tutorial-desktop.png), [390px mobile](bridge-builder/tutorial-mobile.png). Headings, complete source ayahs, highlights and the main action are unclipped. Skip, No Audio and Pause are at the top.

Bridge remains developer-only pending owner review. Physical iOS/Android autoplay behavior and live Railway deployment require the usual smoke test; the no-audio path is available when playback cannot start. No database migration, new package, Arabic replacement or FSRS parameter change is required.

## Validation evidence

- Focused tutorial/game checks: **30 passed**.
- Complete serial suite: **642 passed in 35.6 minutes**, with no failures. A keyboard-focus regression and global-header clipping were fixed before this run.
- After the full run, the final reference-exposure guard and two new pending-recall tests were added. All **42 targeted tutorial, Bridge, memory and active-learning checks passed** against that final logic. The expanded 644-case collection was not rerun in full after this small guard addition.
- Final production build: passed (existing large-chunk advisory remains). `git diff --check`: passed.
- Pointer and native touch-tap smoke: completed both transitions at **1280×950** and **390×844**, saved flags and verified no reward/history writes for an idle learner. Normal-motion bridge formation and lantern animations were checked separately from reduced-motion captures.
- Built-app/static-server smoke: direct planner, lazy Runner load, steering, blaster, navigation cleanup, retired-asset 404 and HTML cache policy passed; no JavaScript page errors observed.
- Both full-viewport screenshots were inspected and committed. No SQL migration or live deployment was performed.

Workspace evidence: `/workspace/artifacts/bridge-tutorial-full.log`, `bridge-tutorial-final-integrity.log`, `bridge-tutorial-production-build.log`, `bridge-tutorial-preview.json` and `bridge-tutorial-production-smoke.json`.
