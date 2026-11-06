# Sirat Quest 2.0 release evidence

## Audit and changes

The repository already had a functional vanilla-JavaScript side-scrolling reducer: horizontal movement, gravity, jump arcs, swept landings, a moving ferry, safe checkpoints, per-word/approved-phrase gateways, audio and capped account-bound result receipts. Those mechanics were retained. The requested powered surfaces, distinct routes, Echo and final continuation were absent.

The release adds:

- `src/puzzles/arcade/sirat/adventure.js`: three route decorations, canonical final units and idempotent bounded Echo earning from real study progress.
- `engine.js`: powered bridge collisions, boarding-triggered vertical elevator carry, docking recovery, optional relaxed speed, responsive camera and untimed final recognition before completion. Legacy direct reducer consumers remain compatible.
- `checkpoints.js`: versioned account-scoped metadata-only saves, source fingerprint validation and export/recovery. A resumed journey starts safely paused at a stable landing.
- `ui.js` / `sirat.css`: in-frame readable choices, powered-surface and elevator presentation, route scenery, Echo, final linking, pointer-down Jump and independent held-pointer tracking, resize cleanup and keyboard/reduced-motion support.
- `src/puzzles/puzzle-lab.js`: route and relaxed-navigation settings.
- `src/puzzles/arcade/results.js`: bounded route/Echo and canonical final-decision evidence; existing XP caps, receipt IDs and motor/Arabic distinction remain intact.
- `src/learner/profile-storage.js`: include the new local checkpoint store in account export.
- Existing helpers/tests plus dedicated `tests/sirat2-model.spec.js` and `tests/sirat2-ui.spec.js`.

No Quran text was imported, modified or regenerated. No new engine, dependency, SQL migration, billing permission or FSRS scheduler was introduced.

## Reproduce

Run Vite on port 5173 in a persistent terminal, then:

```sh
npx playwright test tests/sirat-engine.spec.js tests/sirat2-model.spec.js tests/sirat-ui.spec.js tests/sirat2-ui.spec.js tests/active-learning-lab.spec.js --config=playwright.regression.config.js --workers=1
npx playwright test tests/sirat-ui.spec.js tests/sirat2-ui.spec.js tests/arcade-framework.spec.js tests/arcade-controls.spec.js tests/quest-ui.spec.js tests/expedition-ui.spec.js tests/repair-ui.spec.js tests/bridge-ui.spec.js tests/maze-ui.spec.js --config=playwright.regression.config.js --workers=1
npm run build
node scripts/sirat2-previews.mjs
```

Tests drive real keyboard/touch movement, gravity and platform collisions. They do not substitute a static quiz or screenshot for gameplay. Route/preset models cover all 19 ferry phase seeds. Browser checks include two simultaneous thumb contacts, memory-platform solidity, elevator motion, motor recovery, Echo expiration/assistance, final canonical ordering, Classic/Practice chains, volume/full-ayah audio, failed saves, paused resume at ayah boundaries, unsaved-victory receipt recovery, profile isolation, invalid-source recovery, reduced motion and mobile fit.

The implementation work uncovered and fixed a ledge obstructing the normal jump route, mobile click-based Jump behavior, phone camera limits near the elevator, Echo remaining visible during paused listening, and a paused chain-boundary screen that could offer Next before Resume. An early hot-reload/test-server interruption was rerun against a persistent server.

## Screenshots and limits

Inspected gameplay frames: [desktop powered elevator](sirat-quest/sirat2-desktop.png), [390px mobile](sirat-quest/sirat2-mobile.png). The capture script navigates with actual keyboard input and photographs a moving elevator after a verified gateway decision.

- Focused regression evidence is documented below; this is not a claim that the entire application suite was freshly rerun.
- Unfinished Sirat checkpoints are browser/account-local and included in export. New cross-device checkpoint sync is not added. Established completed progress synchronization is unchanged.
- Hosted Supabase, Stripe and Railway services were not modified or live-tested. Content authorization continues through existing source loaders and backend policy.
- Physical phones, other browser engines and screen readers need separate device QA. Chromium two-thumb input, keyboard controls, reduced motion and viewport fit were exercised.
- Recognized continuations and navigation success never certify spoken recitation. Independent recitation stays optional and uses the existing assessment flow. Word/phrase study labels do not certify waqf or restart positions.
- Deployment to Railway remains manual.

## Final results

- **121 distinct focused/regression tests passed** across the listed suites. The complete application suite was not freshly rerun.
- Core Sirat/active-learning pass: **57/57** (2.2 minutes).
- Shared integration pass: **79/79** (5.2 minutes), including content denial, account isolation, Quest, Expedition, Repair Workshop, Bridge and Maze.
- Expanded model pass: **16/16** (20.4 seconds), including **171 complete route × preset × ferry-phase-seed simulations**, with zero motor recoveries or Arabic strikes on the scripted valid path.
- Final mobile/visual/recovery pass: **31/31** (2.6 minutes), including Expert Star visibility, two-thumb input, chain-boundary resume and unsaved-victory XP idempotency.
- `npm run build`: **passed**, 4.90 seconds. Vite retains the existing large-content-chunk warning; no new engine or dependency was installed.
- `git diff --check`: passed.

The final screenshot review also corrected Night Sky control contrast and moved Safe Return into the eight-button touch pad, preventing toolbar/gateway overlap. Arabic choices now expand at an unanswered gateway and collapse during traversal, keeping elevated routes visible. Long phrase cards remain readable within a bounded in-game panel rather than pushing essential controls below the game.
