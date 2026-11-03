# Cosmic Rush Phase 2 — Star Runner

Current public flight: [flowing Quran pickups](cosmic-rush-flowing-pickups.md) supersede navigation stars; untimed gateway review is optional at stage checkpoints. Earlier phase descriptions below are historical snapshots.
Historical milestone: the current public launch now includes [Phase 3 Quran memory gateways](cosmic-rush-gateways.md). Availability statements below describe this earlier milestone.
## Play

**Your Space → Revision Lab → Cosmic Rush → choose a free passage → View mission briefing → Launch Star Runner → Start flight.** Select Standard or Slow pace in the briefing before launch. The route begins at stage 1; each approximately five-ayah mission group has a separate flight stage. The other four hybrid phases are still planned, not playable.

Steer with Left/Right arrows or A/D, horizontal swipes over the flight field, or the large Left lane/Right lane buttons. P or Escape pauses/resumes; buttons provide the same operations. Restart stage returns to the current safe stage start without erasing earlier in-session flight checkpoints. Return to mission leaves the flight and restores the briefing. Existing lab navigation also disposes the flight.

Collect at least three navigation stars and make at least two lane changes during a stage. Reaching the end of the scrolling field alone cannot clear a stage. Stars occupy alternating open lanes; input-free flight cannot collect enough stars. The open lane is spatial, and the player must actually steer into it. There are no questions or Qur'anic word selections in this motor-only phase.

Each stage has six waves, taking about 20 seconds of active simulation at standard pace. Asteroid impacts consume one of three shield charges, followed by 1.5 seconds of collision immunity. An empty shield returns the player to a recoverable stage retry screen. A failed star objective also offers a stage retry. A successful stage freezes at a safe checkpoint, restores shields and waits for explicit continuation. The final checkpoint reports only that the Star Runner route was cleared.

## Architecture

- `src/puzzles/arcade/cosmic/runner.js`: pure deterministic simulation; no browser/storage/learning API dependency. Exposes `start`, `pause`, `resume`, `dispatch`, `getSnapshot`, `dispose`.
- `src/quest/cosmic/controller.js`: validates the Phase 1 manifest against a freshly generated canonical free-content configuration and adapts runner events to ordered mission stages. Owns current stage and an in-memory set of stable checkpoint IDs.
- `src/puzzles/arcade/cosmic/ui.js`: owned animation loop, accessible HUD, keyboard/pointer controls, collision feedback, reduced-motion handling, pause/exit and disposal.
- `runner.css`: scoped ship, shield, asteroid, star and parallax environment presentation.
- `src/revision/ui.js`: adds the actual runner launch, pace selection and return-to-briefing flow.
- `src/main.js`: disposes Revision Lab activity on render/navigation and pauses it for shared study overlays.

`COSMIC_GAMEPLAY_AVAILABLE` remains false for the complete hybrid mission. `STAR_RUNNER_AVAILABLE` identifies the implemented phase. The public action is explicitly **Launch Star Runner**, not a promise that the whole hybrid campaign is implemented. It is deliberately not registered as a completed Quran-recognition game in the existing reward registry.

### Simulation and fairness

The world is 600 × 720 logical units with lane centers at 120, 300 and 480. The ship moves continuously toward its selected lane at 1,400 units/second; it does not teleport. Collision tests use current positions and conservative circular ship bounds rather than the ship's full wings or decorative shield. Internal steps are at most 1/120 second to prevent tunneling.

A seeded generator supplies six reusable patterns:

| Pattern | Actual obstacle behavior |
| --- | --- |
| Twin rocks | Two simultaneous fixed-x rocks with a reserved open lane. |
| Drift | Rocks oscillate horizontally within their blocked lanes. |
| Slalom | Rocks arrive at staggered times before the navigation star. |
| Pinch | Larger, oscillating rocks narrow the apparent corridor while preserving its safe center. |
| Star pocket | Two leading rocks create a staggered pocket ahead of the collectible. |
| Sweep | Faster, wider horizontal oscillation, still bounded away from the open lane. |

At least one lane remains safe through every wave. Horizontal drift never spans the reserved lane. Consecutive waves leave more than two seconds between star-arrival times, even at the highest configured stage difficulty. Later stages gradually increase obstacle descent speed and reduce spacing within conservative bounds; Slow pace remains selectable. This motor difficulty is never described as Quran mastery.

Frames delayed by more than 250 ms pause rather than apply accumulated damage. Tab hiding and window blur pause immediately. Resume resets frame timing. Background time does not advance the simulation. Pause freezes object positions, parallax and the thruster animation. Essential lane movement remains animated under reduced motion, while decorative parallax, banking and thruster pulsing are disabled. Collision feedback is a warm shield glow and border tint, with no camera shake.

### Renderer decision

This phase uses the repository's existing DOM/CSS/SVG approach: one ship, a bounded set of visible objects and CSS scenery. The wave manifest has at most eighteen objects total; only in-range unresolved objects are mounted. Sprite nodes are reused by ID and updated through positions rather than rebuilding the scene every frame. The camera effect is a small parallax offset, not a large world renderer. No new game engine was installed. The Phase 0 Canvas proposal remains a future option if profiling of a busier hybrid scene justifies it.

### Mission event contract

The controller invokes `onEvent(event)` with `type`, `stageId`, elapsed simulation time, mission ID, stage index and completed checkpoint IDs. Event types are:

- `runner:start`, `runner:lane`, `runner:star`
- `runner:collision`, `runner:recovery`
- `runner:pause`, `runner:resume`, `runner:restart`
- `runner:checkpoint`, `runner:dispose`

Collision events explicitly identify `category: 'motor-control'`. Successful checkpoints have stable `<stageId>:runner-clear` IDs, star count and motor-error count. Duplicate checkpoint notifications within the same controller are suppressed, including stage replay. `nextStage()` only succeeds at a checkpoint and never jumps past the route bounds. A snapshot exposes `routeComplete` for the final flight checkpoint; this is not a `missionComplete`, independent-recall result or memorization award.

The interface is ready for a future host to continue into Meteor Defense/Ayah Link. This implementation does not launch those phases or submit a synthetic success for them.

## Learning, accounts and cleanup

Flight stars are temporary motor-practice score. Neither flight completion nor collision writes XP, leaderboard events, learning history, memory strikes or FSRS schedules. Existing study reward click selectors do not include the runner surface. The only passage references come from the Phase 1 free manifest; premium/developer content cannot be injected into a runner route. No Arabic source, segmentation, recitation stops or audio is altered. This phase introduces no recitation playback or recording.

Pause and dispose are distinct. Shared study overlays pause a current flight. Navigation, detached roots and profile changes cancel animation, abort listeners, release input state and dispose the simulation. A pending launch checks account identity, connection and the current view before mounting. No gameplay continues invisibly after exit. The optional controller event callback does not publish private mission data globally or remotely.

## Tests and observed behavior

`tests/cosmic-runner.spec.js` exercises deterministic generation over 100 seeds and both paces, open-lane geometry, smooth movement, drifting/scrolling objects, collision immunity, lag pausing, restart/disposal, active-input requirements, collision-free piloting across seeded high-difficulty routes, canonical mission validation and idempotent stage checkpoints.

`tests/cosmic-runner-ui.spec.js` exercises real keyboard steering through a complete flight, moving rendered asteroids, all six collected stars, shield reactions, stable checkpoints, pause/resume/restart, overlay pause, navigation cleanup, actual Chromium touch events through the swipe handlers, large touch controls, reduced motion, account changes and unchanged learning/reward storage. Phase 1 navigation tests now expect the implemented runner launch while still rejecting a full-hybrid launch claim.

During browser checks, keyboard-controlled flight collected six stars, reached a stable safe checkpoint and restored shields; collision feedback reduced the shield to 2/3; pause held positions; restart reset shield/score. Mobile touch steering and swipes changed lanes. Night Sky desktop and 390px mobile views were inspected, with no horizontal page overflow or browser errors in the observed flight. Screenshots were captured under `/tmp/cosmic-runner-shots/`.

## Remaining scope and limitations

- Meteor Defense, Ayah Link, Weak-Link Boss and Final Oral Recall integration are not implemented here.
- Flight checkpoints are in memory only within the current flight. Returning to the briefing, navigating away or reloading ends that flight session and does not restore a flight; no new database migration or localStorage record is introduced. The controller contract provides the safe boundary for later versioned persistence.
- No learning XP/mastery is awarded for this motor-only phase; reward integration must wait for actual recognition/recall activities and existing caps.
- Chromium touch emulation is not physical iOS/Android certification. No physical-device performance claim or frame-rate benchmark is made.
- The ordinary Quran-learning audio and all existing game engines retain their own current behavior; this runner is silent.

### Execution results

- Targeted arcade/navigation regression run: **74 passed** (2.0 minutes).
- Full pre-final-fix suite, `npm test -- --workers=2 --retries=1`: **501 passed** (8.9 minutes), with no retries needed.
- Final Cosmic model/browser suite after the pending-launch button fix and two added regressions: **15 passed** (29.3 seconds). This includes the complete two-stage route and cancellation during asynchronous source validation. The two added cases were not in the earlier 501-test collection.
- Final production build: **passed**, 4.07 seconds.
- `git diff --check`: passed.

Browser testing found and fixed swipe capture intercepting overlay buttons, incorrect running-status text, and an interrupted pending launch leaving the launch button disabled. No known blocking gameplay defect remains from these tests; the scope and device-validation limitations above remain.
