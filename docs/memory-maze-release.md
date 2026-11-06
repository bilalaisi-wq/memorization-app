# Memory Maze 2.0 and learner Bridge release

## Delivered

The existing `maze` engine still generates and navigates carved corridors, intersections, fog and recoverable door alcoves. Adventure rooms add source-backed crystal memory, Recognition/Continuation/Connection keys, optional corrective cues, landmarks, shortcut switches and explicit adjacent-ayah portal decisions. Existing Classic/Practice mechanics separate motor events from Arabic mistakes. All source wording and full-ayah recitation remain canonical.

Metadata-only, profile-scoped checkpoints resume unfinished runs safely paused. They restore the original deterministic session, keys, source cursor, position, explored map, correction queue and completed boundaries. Invalid/future/revised saves remain exportable. Finished results retain the existing receipt IDs, XP caps, account checks and FSRS separation. No database migration is required.

Bridge Builder is available in the ordinary learner launcher and shared registry again. Its first-time tutorial, replay, checkpoints, content entitlements and independent-recall safeguards are retained. Legacy unreleased games stay hidden.

## Verification

Across the focused runs, **120 distinct tests passed**, and the final production build passed. Final recovery checks: 24/24 passed, including resumed full-ayah audio and an unsaved victory recovered with its original receipt/unchanged XP. One account-initialization wait timed out during a broader rerun; the unchanged endpoint-denial test passed after a cold Vite restart. The full application suite was not rerun for this change.

Commands used:

```sh
npx playwright test tests/maze2-engine.spec.js tests/maze-engine.spec.js tests/maze-ui.spec.js tests/active-learning-lab.spec.js tests/bridge-ui.spec.js tests/bridge-engine.spec.js tests/bridge-tutorial.spec.js --config=playwright.regression.config.js --workers=1
npx playwright test tests/maze2-ui.spec.js tests/arcade-framework.spec.js tests/arcade-controls.spec.js tests/quest-ui.spec.js tests/repair-ui.spec.js tests/expedition-ui.spec.js --config=playwright.regression.config.js --workers=1
npx playwright test tests/maze2-engine.spec.js tests/maze2-ui.spec.js tests/maze-ui.spec.js tests/active-learning-lab.spec.js tests/quest-ui.spec.js --config=playwright.regression.config.js --workers=1
npx playwright test tests/maze2-engine.spec.js tests/maze2-ui.spec.js tests/maze-ui.spec.js --config=playwright.regression.config.js --workers=1
npx playwright test tests/quest-ui.spec.js --grep 'authorized map metadata' --config=playwright.regression.config.js --workers=1
npm run build
node scripts/maze2-preview.mjs
```

The new model suite checks room reachability and optional paths across 180 deterministic seed/preset combinations. Existing Maze coverage additionally checks connected layouts, canonical text/distractors, approved segmentation, three-strike budgets, longest-ayah behavior, XP caps and FSRS neutrality. Browser coverage exercises actual navigation and decisions, source audio, touch, keyboard, map controls, correction provenance, safe reloads, malformed recovery and profile disposal. Shared regression journeys cover runtime arcade cleanup, real Quest/Expedition completion, long-passage workspaces, server-denied content and repair practice.

Screenshots from real game sessions: [desktop](memory-maze-previews/maze2-desktop.png), [390px mobile](memory-maze-previews/maze2-mobile.png). These show an actual Recognition room reached by navigating the maze. `scripts/maze2-preview.mjs` also samples 100 synchronous navigation/render events per viewport; the local measurements are not physical-device or frame-rate certification.

## Limits

- This change was validated with focused integration/regression suites; it does not claim a fresh run of the entire application suite.
- New unfinished Maze checkpoints are local to the current browser/account profile and included in account export. No new cross-device checkpoint sync or backend endpoint is introduced; established completed learning-history sync is unchanged.
- Screen-reader and physical mobile-device QA remain separate from Chromium keyboard/touch/reduced-motion checks.
- The crystal is a brief study reveal, not a timed answer. Learners may revisit it, replay full recitation and take unlimited time for decisions.
- A single-piece whole-ayah chamber uses whole-ayah recognition and an ending cue rather than inventing an unreviewed internal phrase. Source phrases are not waqf approval.
- Games do not certify spoken recall or submit FSRS grades. Independent assessment remains in the established self-assessed recall workflow.
- Deployment to the public Railway website remains a manual action.

The inspected previews show the game frame at desktop and 390px mobile viewport sizes, with readable Night Sky controls and Arabic choices. Hosted Supabase and Railway services were not modified or live-tested.

Local 100-event input/render sample (99-tile Beginner board, headless Chromium; synchronous dispatch + render + checkpoint write):

| Viewport | Median | 95th percentile | Maximum |
| --- | ---: | ---: | ---: |
| 1280px desktop | 11.1 ms | 17.0 ms | 39.0 ms |
| 390px mobile emulation | 6.0 ms | 22.5 ms | 59.7 ms |

These are local responsiveness samples, not sustained FPS or physical-device measurements. Both inspected frames retain the explorer, Arabic choices and large controls without horizontal overflow.
