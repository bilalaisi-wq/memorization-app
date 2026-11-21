# Ayah A Day: coordinated gameplay experience

## Architecture and audit

The existing vanilla JavaScript engines remain authoritative. This update does not introduce a renderer, scheduler, account model, content loader or reward system.

Before this change:

- Puzzle Lab used a setup form, a Prepare action and then a second Start action. Individual engines already had real controls and overlay panels.
- Blocks, Space, Bubble Burst, Sirat Quest and Bridge Builder had explicit between-ayah handoff buttons. Serpent required navigation to a portal even after all words were collected.
- Maze's portal can contain a genuine adjacent-ayah decision. That decision must remain, as must its three-key objectives and Sirat's final continuation task.
- Passage game hosts saved a bounded stage, then required another Continue action.
- Revision Lab immediately opened the full Cosmic Rush planner. Saved expeditions and advanced controls already existed.
- Encouragement already owned sound preferences, custom local sound clips, recitation ownership, reduced motion and mobile success events.

## Shared view contracts

`src/ui/gameplay-feedback.js` provides `createGameplayFeedback(root)` with `correct(target, {id, sound})`, `complete(target, {id})`, `mistake()` and `dispose()`. Call only after source-backed correctness has been established. IDs deduplicate effects within a mount. The layer never reads or writes rewards, learning records or FSRS. Gold outlines surround containers; glyphs are untouched. Three verified decisions form a cosmetic connection. Completion labels deliberately say “Sequence connected” because a bounded visual workspace may not comprise a complete canonical ayah.

`src/ui/gameplay-frame.js` provides an adapter around existing render/dispatch functions. The engine calls `update(state)` from its existing paint path; the adapter creates no animation loop. Toolbar, pause/settings panel and supported journey actions live within the mounted game root. Real controls are moved with their listeners, rather than cloned. Keyboard actions are scoped to the active root and exclude typing and dialogs. The adapter disposes listeners and effects with the engine.

`src/ui/cosmic-gameplay-frame.js` adapts mission-controller snapshots to the view contract. Verified pickup/capture/link events drive feedback; neutral combat does not count as a Quranic correct response. Existing controller events, evidence ledgers and bounded bonus recording remain unchanged.

`src/ui/automatic-continuation.js` queues one microtask per completed checkpoint. There is no arbitrary waiting timer or XP write. Disposing cancels pending work. Engines still validate `next` actions. Source exposure, ownership, review rules and host authorization remain in their established paths.

## Learning and continuity

- Blocks keeps selected chain floors and strike policy in the current run and starts the next selected ayah automatically. Its memory gates remain untimed.
- Space, Bubble Burst and Sirat use their existing next-sector/formation/section reducers. Bridge waits for the actual lantern crossing and retains optional Cold Crossing/Bridge Gate tasks.
- Serpent's guarded `next` action requires all current words plus a real available portal. The existing physical-portal reducer remains compatible with prior consumers.
- Maze automatically opens its earned portal; a real boundary question is retained where the existing engine requires it. Navigation cannot answer that question.
- Passage game hosts save results and source-only campaign metadata before activating the next bounded stage, with the same reauthorization and fingerprint checks. Hard failures expose a retry inside the game.
- Cosmic Link waits for its existing serialized evidence queue before an ordinary solved connection continues. Cumulative passes, oral comparison, mission checkpoints and independent recall are not bypassed.
- Automatic progression retains the selected audio mode. Full-ayah playback remains authoritative; no phrase audio or recitation stops are fabricated.

Independent recall and the 16-earned-XP prompting workflow are unchanged. Cosmetic combo counts cannot award XP or submit FSRS grades. Rewards still flow through the existing capped/idempotent recorders.

## Preferences and accessibility

The existing `ayah-experience-v1` key now accepts `effects: full | minimal | off`; older saved sound/motion/volume values remain valid. Motion disabled preserves minimal, static feedback; explicit effects off disables decorative feedback. System reduced motion and existing Cosmic minimal-effects preferences reduce decoration. Recitation/recording ownership still stops encouragement sounds. Custom sound clips remain device-local.

The settings panel offers real supported controls, recitation volume, transliteration, encouragement settings and shortcuts. Changing a range/difficulty through game setup explicitly restarts the active run; already saved learning remains. There is no claim that all engines support live changes to every difficulty parameter.

## Revision navigation

Revision opens with Star Runner, Meteor Defense, Ayah Link, Cosmic Rush Adventure, Memory Rescue and Long-Surah Marathon cards. Standalone Cosmic games offer a compact surah/range/memory/speed form. Custom ranges, entire surahs and optional rounds remain available. Advanced Settings links to the original complete planner; saved expeditions appear under Continue Your Adventure. Shared authorized passage missions remain in the existing mission interface rather than a parallel paid lab. Developer-only Chronicles and unfinished games retain their existing access controls.

## Persistence and deployment

No Supabase migration or content re-import is required. Existing storage keys, game IDs, source pins, private content loaders and learning history schemas are preserved. This frontend update must be built and deployed as one asset set, with existing dynamic-import recovery behavior retained. Native builds use the existing shared frontend pipeline; physical-device and store release verification are separate operator checks.

See [validation results, screenshots and limitations](validation.md). Browser tests are not a substitute for real authenticated Supabase, VoiceOver/TalkBack or physical-device verification.

## Using the updated screens

Open Revision Lab and choose a game card. Choose a surah and ayahs, then Start Game. Advanced Settings retains full mission options and saved routes. Authorized shared-passage selections continue to use the established passage mission screen.

Inside a game, use Pause or Settings; Escape provides a keyboard alternative. Resume returns focus to gameplay. Replay ayah uses the verified recording. Sound, transliteration and decorative effects remain optional.

A selected chain continues automatically at ordinary completed ayah boundaries. Complete any real memory checkpoint when it appears. After the final ayah, choose replay, a harder supported replay, another passage or self-assessed recall where offered. Game completion does not grade recitation.
