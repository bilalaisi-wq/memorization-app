# Bridge Builder

Open **Your Space → Puzzle Lab → Bridge Builder**, choose an ayah or consecutive chain and difficulty, then **Prepare crossing → Start building**.

## Construction and controls

Select the next Arabic continuation in canonical order. A correct selection creates an accepted construction beam. Drag a new piece directly onto a deck bay, or drag an accepted beam between bays. The large **Accepted beam / From joint / To joint / Connect chosen beam** controls provide an equivalent keyboard and touch alternative. Beams connect neighboring deck joints. Occupied bays and invalid connections give engineering feedback without removing accepted words or consuming memory charges.

Beam numbers record acceptance order; geometric position is your engineering choice. You can move or unplace beams without retaking their Arabic selection. The RTL line retains canonical order even when members are moved. Exact source wording appears on the scene and accepted-beam cards.

A connected road can still fail. Choose a deck joint and install a permitted pier or a diagonal strut from either bank. These are neutral engineering supports, not additional Arabic choices. Support buttons toggle the selected support. Reinforcement upgrades increase a beam's stiffness and load capacity; upgrades can be removed and reassigned. Budgets are limited, so different layouts behave differently.

**Test crossing** runs a cart across the deck. The model shows deflection and member load utilization. A failed test stops the cart, preserves every word and connection, and lets you repair the structure. It never creates a memory strike. Correct all-Arabic selection alone cannot complete the game: a continuous, load-bearing crossing is required.

- **Beginner:** shorter span, a visibly marked middle pier foundation and one reinforcement upgrade. For a single-beam crossing with no interior joint, reinforce the beam.
- **Standard:** a longer span, one selectable pier, two bank struts and two upgrades. A central pier or two quarter-point struts are distinct viable layouts for a four-bay crossing.
- **Expert:** longest span, no interior piers, two struts and two upgrades, with similar authentic phrase distractors. Reviewed four-piece crossings can use two bank struts and two middle-beam upgrades. There is no movement-speed or speech-certification score.

The scene pans horizontally on narrow screens; the surrounding page remains responsive. Large selectors remain available without dragging or precise tapping. Keyboard: Tab/Enter activates choices and construction controls; T tests and P pauses when focus is on the scene. Reduced motion retains necessary cart/load motion without extra cosmetic effects.

## Modes, listening and progress

Single Ayah builds one crossing, or sequential bounded four-piece sections for a longer ayah. Ayah Chain creates successive crossings for consecutive ayahs. Classic keeps three Arabic-memory strikes across the run; Practice restores the budget per ayah and retries that ayah. Selecting an incorrect Arabic continuation consumes a strike; failed construction, missing connections, exhausted engineering budgets and failed load tests are recorded separately as motor/engineering events.

Guided listening plays the verified full ayah before construction. Shared Puzzle Lab replay and the in-game replay pause construction and the cart. Resume stops recitation and unfreezes the current state. Volume/mute reuse the existing controls; audio failure leaves an explicit silent-resume path without a strike. Opening another study surface stops even an already-paused recitation.

Successful crossings save through the existing account-scoped arcade result recorder. Failed saves stay visible and can be retried without duplicate receipts. A partial chain save can award the remaining legitimate ayah receipt when retried, without re-awarding earlier receipts. Build Again starts a fresh session after a successful save. Completed records survive reload; an unfinished construction is in-memory and restarts on reload.

`ayah-puzzle-lab-v1` remains compatible. New records add safe numeric construction score, engineering-event and test counts; existing history is not reset. Existing daily XP caps and account isolation apply. Arcade success never grades independent recall, advances mastery or changes FSRS dates. No database migration, API key or package installation is needed.

## Structural and source model

`src/puzzles/arcade/bridge/structure.js` uses a deck graph connectivity search and a bounded Euler–Bernoulli beam stiffness solve. Each deck joint has vertical-displacement and rotation degrees of freedom. Bank supports constrain vertical displacement; piers add constraints and diagonal bank struts add angle/length-dependent support stiffness. A moving cart applies consistent beam-element loads at 25 positions. The model calculates bending curves and checks game-specific deflection/member-utilization limits. Reinforcement changes stiffness and capacity, and longer unsupported spans bend more.

This is a simplified linear-elastic teaching simulation, **not a civil-engineering design or certification tool**. It omits real buckling, plasticity, foundation failure and dynamic vehicle effects. The limits are game units. The display lifts accepted wording intact; failed engineering does not destroy Qur'anic words or imply failed memorization.

`engine.js` keeps canonical selection separate from construction edits and load simulation. Workspaces contain at most four Arabic deck beams and five deck joints. `ui.js` implements the shared start/pause/resume/dispatch/getSnapshot/dispose contract plus shared listen/mute/volume controls. Animation frames, media and listeners are disposed when leaving. Static load reports are shared immutably between ticks to keep animation work bounded.

Content comes only from the existing verified adapter and authorized library. Beginner/Standard use exact words. Expert uses short whole ayahs or source-matched published reviewed phrase boundaries; oversized phrases (over eight words) fail safely and offer word mode. No new Arabic, phrase boundaries or recitation-stop approval is generated. Audio remains full-ayah recitation. All six shared arcade games are now implemented; unknown/unregistered-game fallbacks remain tested.

## Validation and previews

`tests/bridge-engine.spec.js` covers connected versus overloaded structures, alternate viable layouts, bending curves, canonical order independent of placement, engineering versus memory mistakes, all presets, legal reviewed Expert solutions, budgets, chains, long-ayah source coverage, pause/lag/disposal, account isolation, XP idempotency and FSRS non-interference.

`tests/bridge-ui.spec.js` drives actual mouse and held-touch dragging, keyboard placement, moving loads, repair without memory penalty, alternate strut layouts, save/retry/reload, replay, full-ayah listening, volume, audio failures, mobile panning, Night Sky contrast and overlays that remain visible after panning.

Previews: [desktop load test](bridge-builder/desktop.png), [mobile construction](bridge-builder/mobile.png). These are local QA scenes, not real learner records. Browser touch checks do not constitute physical-device or app-store certification.

## Final validation results

- All **22 new Bridge Builder tests passed**, including the full-size SVG, held-touch drag, reviewed Expert load solution and separation of engineering events from memory mistakes.
- Complete suite run: `npm test -- --workers=2` — **486 passed; two test-driver failures**. The account-workspace fixture needed to wait for application/account initialization before assigning a fixture owner. The Sirat traversal helper needed to renew keyboard movement after a safe-landing recovery. No application logic changed to address these failures.
- After correcting those drivers, the affected account test and all eight Sirat browser tests passed **three consecutive repetitions: 27 passed**. The complete 488-test suite was not rerun after these test-only corrections; the figures above describe the actual runs rather than a claimed clean single-run total.
- `npm run build` and `git diff --check` passed. Desktop and mobile screenshots were inspected; both page layouts stay within the viewport, while the mobile construction canvas intentionally pans horizontally.
