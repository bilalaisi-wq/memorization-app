# Shared arcade framework

## Scope and audit

Ayah Space and Ayah Serpent are now implemented; the other four future games remain **not implemented or advertised as playable**. See [the Asteroids guide](ayah-asteroids.md) and [the Snake guide](ayah-snake.md). `src/puzzles/arcade/registry.js` reserves Ayah Space, Sirat Quest, Memory Maze, Ayah Bubble Burst, Ayah Serpent and Bridge Builder identifiers. A developer-only contract preview demonstrates registration, shared configuration and persistence, without claiming to implement any of them.

Audit of the existing application:

- `src/data.js` supplies the existing verified library, exact word arrays and occurrence-specific audio helpers. No source Arabic, translation, word boundary, font or recording was changed.
- `src/puzzles/puzzle-lab.js` owns legacy mounts and disposes each game on navigation. Ayah Blocks retains its own established engine/UI and behavior: visible words, speed-only difficulty, automatic descent, safe side lanes and explicit repeat/next choices.
- `src/puzzles/puzzle-store.js` uses `ayah-puzzle-lab-v1`, schema 1, history receipts and per-reference weaknesses. Old receipts (including Falling's optional schema-2 `arcade` metadata) remain valid. Unknown/future or malformed data blocks writes and displays a warning; it is not overwritten.
- `src/learning-store.js` owns `ayah-learning-v1`, wallet XP, idempotent session receipts and FSRS. `recordLabPuzzle` grants at most 8 XP per ayah/game/local calendar day (assisted attempts request 2); repeated requests cannot exceed the existing cap. This path never grades recall, updates memory cards or awards mastery.
- Account profile storage already scopes these keys to the signed-in user and includes them in cloud backups. Guest keys and authenticated key names remain unchanged.

Vanishing Ayah, Jigsaw, Memory Match, Broken Chain, Continue the Ayah and Similar Ayah Detective are retained, including historical results and regression tests. Their cards are hidden and disabled for learners, and the launch handler also checks access. They appear only while developer preview is enabled for the confirmed owner account. Losing developer mode immediately disposes the restricted mount and restores Ayah Blocks. This is a presentation gate for bundled free-content experiments, **not** a substitute for server-side premium-content authorization.

To preview: sign in as the existing verified owner, choose **Developer mode → Enable developer access**, then open Puzzle Lab. The existing backend developer migration/RPC must already be configured. This task needs no new SQL.

## Modules and contract

Import shared APIs from `src/puzzles/arcade/index.js`.

| Module | Responsibility |
| --- | --- |
| `registry.js` | Reserved identifiers, validated registration, developer filtering and single-mounted-game launcher |
| `content.js` | Exact source occurrences, provenance, deterministic seeded shuffling, source-backed distractors, shared configuration, reviewed phrase adapter, visible-word speed profiles |
| `session.js` | Pure serializable reducer, lifecycle controller, three strikes, checkpoint retry, assistance and motor-error tracking |
| `services.js` | Owned audio, cleanup-safe ticker, keyboard/pointer/touch input, reduced-motion settings |
| `results.js` | Account-bound, retryable result recording through existing XP and Lab stores |
| `example.js` | Minimal developer-only registration example and accessible native controls |

A factory receives its DOM root, authorized content adapter, configuration, unique session ID and completion callback. It returns:

```js
{
  start(),                 // ready -> playing
  pause(),                 // playing -> paused; suspend owned audio/timing
  resume(),                // paused -> playing
  dispatch(action),        // map distinct game mechanics to shared learning events
  getSnapshot(),           // defensive clone, never a mutable state reference
  dispose()                // idempotent; remove input, timers, audio and owned UI
}
```

`createLauncher` disposes the previous game before creating another. A disposed shared controller cannot restart. Registration validates the lifecycle contract and rejects duplicates. Planned metadata alone is not a playable registration.

```js
import {createRegistry, createLauncher} from './arcade/index.js';
import {registrationExample} from './arcade/example.js';
const registry = createRegistry();
registry.register(registrationExample);
const launcher = createLauncher(registry);
// The actual Lab mount supplies root, adapter, config, id and onComplete.
launcher.launch('arcade-example', options, {developer: true});
// On navigation:
launcher.dispose();
```

Do not build six skins over the example. Each future game must implement its own spatial interaction and motor mechanics, translating only learning outcomes into the shared reducer.

## Content and configuration

`adapter.configure` validates Single Ayah or a contiguous Ayah Chain against available source references, with Classic/Practice rules, a speed profile and seed. A chain is capped at 50 references per configuration; mount only its active checkpoint. Configuration does not download or authorize premium text. Supply only library objects already authorized by existing backend entitlements.

`adapter.words('1:1')` returns exact display text, stable occurrence ID (`surah:ayah:zeroBasedWordIndex`), reference, source position and occurrence-specific audio. Display these strings without normalization. Comparison normalization is used only to exclude equivalent distractors, never to change display text. Duplicate target words retain distinct occurrence IDs. Seeded selection includes every target occurrence exactly once plus distinct non-target distractors, each with source/audio provenance. If there are insufficient verified distractors, selection fails rather than inventing words.

The word workspace refuses more than 40 target words. Long ayahs require `adapter.phrases(key, reviewedSegments)` and a game that renders a bounded active phrase workspace. The preview deliberately refuses long-ayah word banks. Reviewed segment input uses:

```js
{ key:'2:255', startWord:0, endWord:5, // zero-based, end exclusive
  status:'approved', reviewId:'persisted-review-id',
  recitationStop:false, stopStatus:'pending' }
```

The caller must obtain these records from the existing authorized teacher-review workflow, not learner input or the draft JSON. The adapter requires approved phrase boundaries, exact reference, a review identifier, contiguous coverage and no gaps/overlaps/out-of-range words. It slices original word objects without reconstructing Arabic. A phrase boundary does **not** become a recitation stop: `recitationStop` is true only with separate `stopStatus:'approved'`. The adapter supplies full-ayah reference audio; it never fabricates segment timestamps or waqf guidance. Until separate stop/audio approval exists, retain continuous full-ayah recitation. Existing draft segmentation in Passage Builder is unchanged.

## Session and learning rules

Shared reducer events are `start`, `pause`, `resume`, `mistake`, `motor-error`, `assist`, `checkpoint`, `retry`, `dispose`.

- A learning sequence mistake costs one of three strikes. Three freezes the run as lost.
- Motor/control mistakes are recorded separately and cost no learning strike.
- Assistance records audio, hint or reference usage. Paused/lost/won sessions reject learning actions.
- Classic retains strikes across successful checkpoints; loss and Retry restart the chain.
- Practice resets strikes at each successful checkpoint; Retry after loss preserves completed checkpoints and restarts the current ayah.
- Retry preserves mistake/assistance history for honest analytics. It does not reset progress outside the current session.
- Game-specific code alone decides whether an answer is correct, using the immutable source occurrences. The shared reducer is an event ledger, not an independent correctness oracle or a server trust boundary.

`createResultRecorder` records only a won session whose completed references exactly match its configured references. It uses stable per-checkpoint receipts `arcade:<sessionId>:<surah>:<ayah>`. Every checkpoint goes through the existing daily reward cap and duplicate receipt check. Both learning and Lab writes are independently idempotent, so retry after a storage failure cannot double-award XP. The recorder captures account identity and rejects submissions after an account switch. Do not reuse a recorder for another account.

Optional `arcade.schemaVersion:3` metadata stores mode, chain rules, seed, mistakes, motor errors, assistance and completed checkpoint keys. The root Lab schema stays 1. Historical legacy modes remain in the validator even when hidden. Future game identifiers are added to persistence and the existing learning XP allowlist without changing old receipts, XP, stars, completed progress or FSRS schedules.

Arcade completion is recognition/order practice. **It is neither independent spoken recall nor certified memorization.** No shared arcade service calls FSRS grading APIs. Keep self-assessed recitation and uncertain AI results separate.

## Audio, input and accessibility

The audio manager owns one `Audio` instance, replaces/stops previous playback, catches autoplay failures, supports mute and pause/resume, clears handlers/source and cancels stale asynchronous completions on dispose. Never allocate unowned audio or intervals inside a new game.

`bindArcadeInput` provides Arrow movement/rotation, Space drop, C hold and P pause intents, plus `data-arcade-action` native controls. Each game must implement only the commands meaningful for its mechanics and supply an explanation. Input from editable fields, links, dialogs and native buttons is left to browser controls. Pointer/touch activation and native keyboard/screen-reader clicks share the same dispatch path without double firing. Call the returned unbinder on disposal. The preview uses native buttons for word selection, focusable controls, Arabic RTL spans and live status messages.

`motionSettings` reads reduced-motion preference; use zero transition duration and avoid flashing/decorative motion in that mode. Reduced motion must not conceal words or change answer correctness. Profiles currently change descent speed only; all words stay visible. Do not confuse decorative animation reduction with pausing active gameplay.

## Validation and next steps

`tests/arcade-framework.spec.js` covers source provenance, deterministic solvability, phrase coverage and separate stop approval, three strikes, Classic/Practice checkpoints, lifecycle disposal, defensive snapshots, storage/reward retries, historic data, account isolation, FSRS non-interference, audio cleanup, reduced motion and keyboard/touch utilities. Legacy-mode UI regression tests explicitly enter developer preview; public tests verify learner exclusion and revocation cleanup. Existing Falling tests remain in the full suite.

Run `npm test` and `npm run build` before registering the first real game. Then implement one distinct game at a time, with its own engine tests, real pointer/mobile interactions, accessible equivalents and verified phrase review integration where needed. Ayah Space, Ayah Serpent and Memory Maze are registered real games; the other three remain planned. See `memory-maze.md` for the maze engine and verified phrase door rules.

### Existing review-record conversion

The existing teacher review service uses **one-based inclusive** `startWord`/`endWord` and `displayStatus`. The arcade adapter above uses **zero-based end-exclusive** indices. After verifying the review head's `source_hash` against the authorized canonical bundle's `contentRevision`, convert `startWord` to `startWord - 1`, leave `endWord` unchanged, map `displayStatus` to `status`, and carry the persisted review ID/reference and independent `stopStatus`/`recitationStop`. Never pass draft records as approved, or reuse approval against a different source revision. The contract preview does not fetch teacher records or expose a long-ayah mode; this conversion belongs in a future long-phrase game's authorized loader.

Original foundation validation: full Playwright suite **216 passed**; existing Deno backend suites **20 passed** (billing 6, content 4, recitation 5, coach 5); production Vite build passed. No hosted database or provider configuration was changed.
