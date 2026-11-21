# Universal gameplay validation — Ayah A Day

## Implementation inventory

- Shared view-only feedback: `src/ui/gameplay-feedback.js` and CSS. Bounded gold outlines, connections and sequence effects use existing encouragement preferences; no reward or recall writes.
- Shared in-game controls: `src/ui/gameplay-frame.js`, CSS and `cosmic-gameplay-frame.js`. Existing controls and reducers remain authoritative. Settings retain actual listeners and selected values. Touch controls occupy reserved space rather than covering Arabic.
- Shared continuation: `src/ui/automatic-continuation.js`. One cancellable microtask for each completed source-backed checkpoint; no arbitrary transition timer.
- Engine adapters: Blocks; Space; Serpent; Maze; Bubble Burst; Sirat Quest; Bridge Builder; Cosmic Runner, Defense and Link. Existing rendering and physical mechanics remain.
- Passage host: automatic activation after a successfully saved bounded stage, with existing content reauthorization and source checks.
- Revision landing: six playable cards; compact standalone configuration; the existing advanced planner, saved expeditions and authorized passage mission route remain available.
- Existing correct-answer and approved Chronicles relationship feedback use the same view-only layer. Chronicles remains developer-gated.
- Existing encouragement key gains an optional effects value; no new competing preference store, source import or database migration.

## Reproduced defects addressed

1. Ordinary chain boundaries required manual Next/Start handoffs, even after correct completion.
2. Prepare then Start forced extra navigation; direct Start now mounts and starts the actual engine.
3. Settings and touch controls could sit outside the visible field; the shared frame reserves space for them.
4. Blocks toolbar Space could also hard-drop a piece. Native button activation is now excluded from gameplay shortcuts, and Resume restores field focus.
5. At limited heights Maze key-room controls could be clipped into a small grid row. Room interaction now overlays the maze within its bounded field; external movement controls stay reachable.
6. A runtime checkpoint-storage failure could leave a durable game running. Bridge, Maze and Sirat now pause safely and offer a same-run save retry; malformed legacy records retain their separate recovery path.
7. Silence selected explicitly during a chain was replaced at the next ordinary boundary. The chosen audio mode now carries forward.
8. Decorations could contribute to horizontal overflow after orientation changes. Their dedicated contained layer clips only decoration.
9. The compact Blocks layout initially hid Hold/parking. A bounded visible strip now preserves those views and the completed floors.
10. Blocks result choices were cramped inside its narrow board column. The result now uses the full in-game field with wrapping controls, above decorative effects.

## Evidence

- [Blocks: gold outline around a correct placement](screenshots/blocks-gold-desktop.png)
- [Blocks: phone controls](screenshots/blocks-mobile-controls.png)
- [Blocks: inline chain completion choices](screenshots/blocks-chain-complete.png)
- [Serpent: in-game settings](screenshots/serpent-paused-settings.png)
- [Revision landing: desktop](screenshots/revision-1440.png)
- [Revision landing: phone](screenshots/revision-390.png)
- [Maze: landscape field and touch deck](screenshots/maze-844.png)
- [Bridge: phone layout](screenshots/bridge-390.png)
- [Recorded phone Blocks playthrough](screenshots/blocks-phone-playthrough.webm)

Screenshots were opened and inspected. The video records actual browser input and gameplay, not a mockup or native-device session.

## Test scope

The new browser suites cover direct starts for all six shared-engine games, local pause/settings/volume, scoped shortcuts, effect deduplication and off preferences, a complete three-ayah Abasa Blocks chain, responsive layouts, portrait/landscape controls and actual storage failures. Existing suites exercise full Runner/Defense routes, adjacent links, long grouped passages, tutorial/checkpoint recovery, source revisions, account isolation, XP caps, FSRS non-interference and entitlement denials.

Final execution results are recorded below. Interrupted development runs are not counted as passing full-suite evidence.

## Preserved intentional checkpoints and limitations

- Maze's genuine boundary questions, its three-key objectives, Sirat's final continuation, Bridge Cold Crossing/Bridge Gate, cumulative Link recall and mission checkpoints remain learning interactions. Automatic navigation does not answer them.
- Configuring a new range or difficulty may restart the active stage through its original setup path. The UI explains this; already saved progress remains. Not every engine supports changing every parameter in place.
- Shared authorized-passage selections continue through the existing passage mission interface; premium authorization is not replaced by a local flag or new public content path.
- Space and Serpent retain their existing unfinished-run persistence behavior. This change does not invent cloud recovery for an unsaved in-memory run.
- Browser audio mocks verify ownership and cleanup, not the acoustic accuracy of external MP3 files. Full-ayah source audio remains unchanged.
- Real Supabase account/RLS staging checks, Railway deployment, physical iOS/Android performance, VoiceOver and TalkBack require their existing operator/device environments. These results do not establish production or native-store readiness.

## Release and rollback

No Supabase migration is required. Deploy the complete Vite asset set together through the existing website pipeline. Use existing native sync/signed-update procedures for apps; no native plugin was added. Keep an operator rollback to the previous complete build rather than mixing hashed chunks between releases. All original source IDs, learning stores, history and capped/idempotent reward paths remain in place.

## Executed checks

The complete regression invocation covered 1,077 cases: 1,064 passed, nine failed during development, and four production-offline cases skipped by design on the development server. After the mobile correction and updates for the intended navigation, all nine failed cases passed in an affected-file run of **87/87** tests; the initial startup timeout did not recur. The final scoped Blocks layout change passed a further **38/38** tests, including every game’s phone portrait/landscape controls.

The separately isolated source-validated Ayatul Dayn case and final Abasa chain both passed (**2/2**). Backend billing, content-policy, recitation, coach and Chronicles tests passed (**31/31**). The final `npm run build` passed. The production-offline suite passed **4/4**, covering the four cases skipped on the development server. Across the full run, successful reruns, isolated long-ayah case and offline run, all **1,078 distinct regression cases** were exercised successfully. This is combined evidence, not a claim that the first full invocation was clean.

Commands (from the repository root):

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/ayah-playwright NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 npx playwright test --config=playwright.regression.config.js --workers=3 --grep-invert 'source-validated Ayatul Dayn component'
# Rerun affected files after fixes; final results: 87 passing, then 38 layout checks passing.
PLAYWRIGHT_BROWSERS_PATH=/tmp/ayah-playwright NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 npx playwright test tests/irda-long-passage.spec.js tests/gameplay-experience.spec.js --config=playwright.regression.config.js --workers=1 --grep 'source-validated Ayatul Dayn component|Abasa chain'
npm run test:billing
npm run test:content
node_modules/.bin/deno test --allow-env --allow-read supabase/functions/_shared/recitation_test.ts supabase/functions/_shared/coach_test.ts supabase/functions/_shared/chronicles/handler_test.ts
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/ayah-playwright NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 npx playwright test --config=playwright.offline.config.js --workers=1
git diff --check
```

## Changed source files

- `index.html`
- `src/chronicles/ui.js`
- `src/main.js`
- `src/puzzles/arcade/asteroids/ui.js`
- `src/puzzles/arcade/bridge/ui.js`
- `src/puzzles/arcade/bubble/ui.js`
- `src/puzzles/arcade/cosmic/defense-capture-ui.js`
- `src/puzzles/arcade/cosmic/defense-ui.js`
- `src/puzzles/arcade/cosmic/link-boundary-ui.js`
- `src/puzzles/arcade/cosmic/link-ui.js`
- `src/puzzles/arcade/cosmic/ui.js`
- `src/puzzles/arcade/maze/ui.js`
- `src/puzzles/arcade/passage/host.js`
- `src/puzzles/arcade/sirat/ui.js`
- `src/puzzles/arcade/snake/engine.js`
- `src/puzzles/arcade/snake/ui.js`
- `src/puzzles/falling-ui.js`
- `src/puzzles/puzzle-lab.js`
- `src/quest/cosmic/controller.js`
- `src/quest/cosmic/link-evidence.js`
- `src/quest/cosmic/preferences.js`
- `src/revision/ui.js`
- `src/sequence.js`
- `src/ui/answer-feedback.js`
- `src/ui/automatic-continuation.js`
- `src/ui/cosmic-gameplay-frame.js`
- `src/ui/encouragement.js`
- `src/ui/gameplay-feedback.css`
- `src/ui/gameplay-feedback.js`
- `src/ui/gameplay-frame.css`
- `src/ui/gameplay-frame.js`

Existing navigation and chain tests were adapted to the new entry and automatic continuation behavior; source, scoring, privacy and recall assertions remain. New suites: `gameplay-experience.spec.js`, `gameplay-mobile.spec.js` and `gameplay-storage.spec.js`. Shared test navigation lives in `revision-helper.js` and `falling-helper.js`.
