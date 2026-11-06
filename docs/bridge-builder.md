# Bridge Builder 2.0 · Ayah Link

Bridge Builder now tests **the transition between adjacent ayahs**, not the order of words inside one ayah. The permanent arcade identifier remains `bridge`. It remains developer-only for review, as requested in the preceding rollout; no premium content or developer authorization has been relaxed.

## Playing

Open Your Space → Puzzle Lab → Bridge Builder in developer mode. Choose **Single Transition** (two adjacent ayahs) or **Ayah Chain**, a start/end, strike rules and difficulty. Prepare crossing, then Start linking. The last ayah of a surah cannot be chosen as a starting boundary; opening on that ayah selects the preceding pair. A chain of N selected ayahs generates N−1 challenges, including every internal boundary. The existing shared arcade configuration bounds each route to at most 50 ayahs; choose a subsequent contiguous range for longer surahs.

The right island shows the ending of ayah N, and the left island asks how N+1 begins. Say the opening aloud, choose its connector and watch the bridge snap in and the lantern cross **right to left**. Continue to the next boundary. The built-in How to play demonstration explains this without requiring engineering knowledge.

- Beginner: last word, three distinguishable opening cues, stationary connectors, guided full-ayah recitation by default.
- Intermediate: last three words (or all available), up to three opening words, gently floating connectors.
- Advanced: recall aloud before revealing choices, similar authentic alternatives when available, **no automatic audio**. Selecting Guided Listen or Replay remains possible and is recorded as assistance. This is recognition practice after a self-directed attempt, not a verified independent recall grade.
- Tap/click any connector. Keyboard: Left/Right selects a connector, Space/Enter commits; 1–3 directly choose; P pauses. Tab/Enter works on ordinary controls. Intermediate/Advanced also allow dragging a connector onto the gap. Dragging is optional; a missed/canceled drag is a motor event, never a memory mistake. There is no response timer. Pausing freezes the traveler; reduced motion removes connector float and cosmetic demonstration movement.
- Classic: three wrong openings across the chain; retry restarts that route. Practice: three per boundary; completed bridges remain intact on retry.

All door meanings, connectors, feedback and audio controls are inside the game scene. Mobile uses large, vertically arranged connector buttons. No engineering selectors, load tests, piers, stiffness budgets, cart simulation or intra-ayah beam reconstruction remain in active gameplay. `structure.js` is retained as inactive legacy code; it is not imported by the new engine/UI.

## Verified source and audio

`buildCrossings` accepts only two or more same-surah, consecutive canonical references from the existing authorized content adapter. Transitions have stable IDs such as `1:1>1:2`. Exact source spelling, diacritics and word IDs are retained; neither Arabic nor audio is generated or rewritten.

Displayed endings/openings are **visual recall cues**, not new reviewed recitation units or certified waqf/restart guidance. Opening candidates are compared using the existing normalization for ambiguity detection; their displayed source text is never normalized. Identical displayed normalized openings are excluded from distractors. Advanced selection prioritizes alternatives sharing authentic opening vocabulary, then uses other distinguishable verified openings. Three distinct choices are required or preparation fails safely.

Audio uses complete existing recordings only. Guided Listen repeats the preceding full ayah and plays the following full ayah during a successful crossing. Listen Before Challenge pauses activity for full-ayah listening; resume ends listening-first playback. Silent Challenge is explicit (and the Advanced default). Shared volume/mute and manual replay remain available. Audio failures do not consume strikes. Media and listeners are disposed on navigation, profile changes and sign-out through existing app cleanup. No unapproved crops, phrase splices or spoken grading claims are introduced.

## Persistence, recovery and rewards

Existing `ayah-puzzle-lab-v1` history, including old engineering fields, is unchanged. Old completed Bridge records remain historical construction achievements; they are not converted into transition evidence. No migration resets or rewrites them.

New version-2 boundary checkpoints use the **account-scoped** `ayah-bridge-checkpoints-v2` store, included in account export. They contain references, canonical word IDs in mistake evidence, source revision fingerprint, original session seed/config, completed boundary IDs, strikes, assistance and transition errors. Qur'anic text/audio are rebuilt from currently authorized sources rather than copied into persistence.

A matching route/difficulty can be prepared again after reload and resumes safely paused, retaining its original receipt/session ID. Save points occur after actions and each completed crossing. Unfinished animation may restart at its last saved animation position; no completion is awarded twice. The store is browser-local; this task does not add cloud checkpoint synchronization or a new backend table.

Invalid/future checkpoint data and source-revision mismatches are preserved without overwriting. The recovery panel offers a JSON export rather than silently resetting. Existing record export/recovery remains available. Private content must be reauthorized before a saved route can be reconstructed. Single-ayah Passage Builder trials cannot form an adjacent pair and retain the shared host’s existing practice fallback.

The shared result recorder rewards the **target ayah** once per transition/session through existing per-ayah/day XP caps. New receipts add versioned adjacent-reference metadata and transition errors, separately from motor failures. Repeated save/retry requests remain idempotent. Account ownership is checked before result writes; switching accounts disposes the old scene without writing its checkpoint into the next profile.

A game victory never submits an FSRS grade, changes review dates or grants spoken mastery. The completion screen offers the existing independent recall workflow.

## Validation

`tests/bridge-engine.spec.js`: adjacency, N−1 count, exact source, distinct repeated openings, all presets, strikes, motor separation, Classic/Practice, checkpoint recovery/source revisions, old history, XP idempotency, account binding and FSRS non-interference.

`tests/bridge-ui.spec.js`: real pointer/keyboard/touch input, recall-first, right-to-left crossing, tutorial, reload recovery, actual complete-ayah audio, volume, audio failures, save retry, account cleanup, invalid-data export and mobile/reduced-motion layout.

Repository previews: [desktop](bridge-builder/desktop.png) and [mobile](bridge-builder/mobile.png). Screenshots are generated from actual interactive test sessions at `/workspace/artifacts/bridge-link-desktop.png` and `/workspace/artifacts/bridge-link-mobile.png`. Final run evidence is documented in `docs/bridge-link-release.md`. Screenshots are not evidence of independent recitation or physical-device certification.

## First-time tutorial and Bridge Gate

Bridge opens an interactive first-time tutorial before setup. Al-Ikhlas 112:1–3 is preferred; another authorized consecutive triple is used only when needed. The tutorial plays each complete source recording in sequence after a learner gesture, highlights the previous ending and following opening, forms the bridge, then hides the opening for two actual connector decisions. The first has a golden guide; the second removes that guide. Wrong tutorial choices have no strikes. No tutorial result calls the learning, reward or FSRS APIs.

Skip/Escape opens setup and remembers that the tour was skipped. How to Play replays it from setup or a paused real run. Tutorial completion is saved independently in account-scoped `ayah-bridge-tutorial-v1` and included in export. Completed flags cannot be downgraded by replay/skip. Future or malformed flags are retained, with failed persistence reported. Replaying cannot award XP. A real run is paused and saved before the tutorial; closing returns to setup while its Resume action and checkpoint remain available.

No-audio mode supports the entire lesson visually. Skip, No Audio and Pause are available at the top of the dialog; replay and volume remain available. Playback errors permit retry or explicit visual continuation. Closing, account changes and navigation release media/listeners. Reduced motion replaces the traveling effect with a stable connection and shorter cosmetic delay; Skip Animation is always available. These demonstrations do not approve recitation stopping points or certify spoken recall.

The scene now includes deep-blue water, turquoise banks/joints, golden snapping connections, a right-to-left island chain map, visible strike lanterns and arrival/result effects. Beginner connectors remain stationary; Intermediate can drift gently; Advanced is labeled Cold Crossing and retains recall-before-options with no automatic audio.

The optional **Bridge Gate** checkbox adds a two-boundary review after each three completed bridges when more of the route remains. It reviews two consecutive existing links, asks for recall before options, preserves provenance and uses the selected Classic/Practice strike rules. Gate completions do not duplicate completed boundaries, score or XP and never submit FSRS ratings. Gate state is saved in the existing checkpoint format as optional metadata; old version-2 runs remain compatible. Gate-enabled routes use a separate checkpoint key so they cannot overwrite a non-Gate route.

Tutorial previews, captured in actual pointer and native touch-tap sessions: [desktop 1280×950](bridge-builder/tutorial-desktop.png) and [mobile 390×844](bridge-builder/tutorial-mobile.png). Both were inspected for clipped headings, Arabic readability and reachable controls. Run `node scripts/bridge-tutorial-screenshots.mjs` against the local Vite server to reproduce the two-transition, no-reward touch/pointer smoke check. The script uses an explicit local developer presentation fixture, not a production sign-in.
