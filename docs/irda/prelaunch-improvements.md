# iRDA prelaunch gameplay improvements

## Scope and compatibility

The app remains Vite/vanilla JavaScript. Existing game IDs, canonical Arabic, source loaders, entitlement checks, XP caps and FSRS APIs are retained. iRDA is the display name; native package identity `com.ayahaday.app` stays unchanged. Store listings and new native binaries still require operator publication.

## Responsive layout

`src/ui/learning-layout.css` adds container reflow, wrapping toolbars, touch controls, scrollable overlays and safe-area-aware dialogs. Worlds retain their engine coordinate systems. Reading guides sit outside physics surfaces and scroll independently; short landscape displays can scroll the page instead of shrinking Arabic. Individual engines retain their existing pointer-to-world mapping.

The new matrix exercises all seven public Puzzle Lab engines at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×667 and 844×390, with reading aids on and off. This is Chromium browser coverage, not physical-device or screen-reader certification.

## Check feedback

`src/ui/answer-feedback.js` supplies a shared, screen-reader-announced status with an explicit check/X and text. Correct answers use a green panel and brief gold stars; incorrect checks use a red panel and gentle pulse. Reduced motion removes animations. Existing sound/reward caps remain authoritative. Practice and Ayah Chain credit completion once per run; temporary reward-storage failures remain retryable. Passage workspace/whole/chain checks reuse the existing hashed receipt contract, keyed to reward day and source/review workspace identity. Repeated checks create no second reward event, including after reload. The 16-earned-XP recall prompt is unchanged: its regression now earns that XP from two different workspaces rather than duplicate clicks. Wrong arrangements remain in place, with no automatic answer reveal. This component is used by core Practice/Quest/recall puzzles, Ayah Chain, adaptive Memorization workspaces and Passage Builder reconstruction. Oral self-assessment continues to use the learner's Again/Hard/Good/Easy rating, not automatic puzzle correctness.

## Ayah Blocks: Constellation Tower

The active board remains 10×18. Every four accepted pieces form an archived floor, and collision pressure can safely archive the active section earlier. The archive rail preserves canonical source sequence and supports inspection without expanding physics to hundreds of rows. Follow Active Floor advances the rail; selecting an archived floor disables follow until returning. This is a logically segmented tower, not an infinite physical world.

The existing landing ghost can be toggled. It indicates geometry, never correctness. Every eight accepted pieces presents an untimed continuation gate using distinct source-backed candidate text. While a gate is open, descent and movement are frozen. Deliberately selecting incorrect wording consumes a memory strike; merely waiting does not. Repeated identical wording is accepted by display text, not punished because an identical occurrence has a different index.

Five-word labels wrap within the board, and resize handling keeps the active label and floor rail in bounds without rebuilding the engine. Grouped counters distinguish pieces from canonical source words. Four correct decisions add a modest 25-point arcade combo bonus. This is arcade score, not additional learning XP or mastery. Existing bounded rewards and idempotent receipts apply at completion.

`src/puzzles/tower-units.js` derives 1/2/3/up-to-5-word visual pieces using the existing adaptive baseline. Existing PassageContext supplied entries remain in use for authorized long passages. No canonical text is changed; groups are not recitation-stop approval. Registered PassageContext activities keep their existing declared group-size limits; the registration now carries original source positions and counts so its piece counters remain accurate. Grouped audio uses the full verified ayah.

`ayah-blocks-checkpoints-v1` is account scoped through the existing profile-storage adapter. It stores canonical reference, a local word-revision fingerprint, accepted prefix count, arcade-score counters, strikes and sanitized mistake metadata, never private Quran text/audio. A safe checkpoint resumes paused. Source mismatch disables that checkpoint without deleting it. A later checkpoint on a new source revision archives the previous metadata in the same exportable store. Malformed records remain intact and block overwrites through the existing versioned-store recovery behavior. Current checkpoints cover the active ayah's completed sections; they do not reconstruct a whole previous multi-ayah run or claim fresh recall evidence.

## Optional transliteration

`src/ui/reading-aids.js` reuses `src/quest/cosmic/transliteration.js`; no new transliteration algorithm or source provider is introduced. Existing Cosmic Roman formatting stays intact. Word/group mappings use original positions and complete source transliteration only. Missing pronunciation is never generated. Companion guides show an explicit unavailable state when needed.

Show Transliteration is account scoped (`ayah-reading-aids-v1`), defaults off, and is shared between Puzzle/Revision surfaces. The toggle changes visibility, without dispatching game actions, stopping audio, resetting checkpoints or changing world coordinates. Tiny moving objects use an adjacent bounded reading guide; Sirat/Bridge choices use their existing readable cards. Inline Roman elements reserve their boxes when off, so target hitboxes remain stable. Completed Arabic sequences remain separate, exact copyable text; their Latin reading strip is a sibling rather than interleaved in the Arabic source line.

Core Cosmic Runner, defense gateways, Link, reactor, boss and expedition views retain their original Roman components. On narrow Star Runner displays, the same source-backed Roman strings move to a lane-labelled companion panel; reserved inline boxes keep collision geometry stable. Advanced revision adds source-backed Roman only to visible study or discrimination prompts. Passage recall comparisons reveal transliteration only with the existing explicit verified-text comparison, after the attempt's existing reveal/assistance rules. No hidden independent-recall answer is exposed by enabling the global setting.

## Validation and limits

See `validation.md` for executed checks and screenshot evidence. No Supabase migration is required for these four changes. The separate pending native subscription work has its own migration and launch gates in `docs/native/billing.md`; it is not activated by this task.

Real VoiceOver/TalkBack, iOS/Android hardware, live Supabase account/plan transitions and store sandbox billing require the configured environments. Browser mocks and policy tests must not be represented as those external checks. Published premium content is still limited by the existing verified catalog and authoritative backend; this change does not publish more content.

## Learner controls

- Check an arrangement: read the check/X panel, adjust pieces in place, and check again. A correct puzzle remains supported recognition, not spoken assessment.
- Ayah Blocks: arrows move, B/N rotate, Space drops, C holds, P pauses. Toggle Ghost Landing Preview as desired. Four connected pieces illuminate a floor; select its star to inspect it and use Return to Active Floor to follow play again. At a Constellation Gate, select the next wording; there is no countdown. A saved section offers Resume Saved Tower Section and starts paused.
- Puzzle/Revision Lab: use Show Transliteration. Small moving words keep their geometry and share a reading guide alongside play. Star Runner uses a lane-labelled reading guide on phones, while preserving its original Roman cards on desktop. Open/collapse the guide or scroll its candidates. Missing source pronunciation remains explicitly unavailable; verified recitation is still available.
- Independent recall: attempt from memory, then explicitly compare the verified text. Reading aids do not automatically submit a grade or award mastery.

## Changed module map

| Area | Modules |
| --- | --- |
| Global responsive/feedback UI | `src/ui/learning-layout.css`, `answer-feedback.js`, `src/main.js` |
| Supported answer checks | `src/sequence.js`, `src/memorization/ui.js`, `src/passage/ui.js` |
| Tower engine, grouping and recovery | `src/puzzles/falling-engine.js`, `falling-ui.js`, `falling.css`, `tower-units.js`, `tower-checkpoints.js` |
| Shared source reading aid | `src/ui/reading-aids.js`, `reading-aids.css`, `src/quest/cosmic/transliteration.js` |
| Game candidate and completed-sequence views | `src/puzzles/arcade/{asteroids,snake,maze,bubble,sirat,bridge}/ui.js` |
| Canonical Roman propagation | `src/puzzles/arcade/content.js`, `src/puzzles/arcade/passage/adapter.js`, `src/quest/expedition/blocks.js` |
| Existing Revision views | `src/puzzles/arcade/cosmic/ui.js`, `src/quest/advanced/ui.js`, `src/quest/cosmic/expedition/ui.js` |
| Profile export and view cleanup | `src/learner/profile-storage.js`, `src/ui/dom.js`, `src/passage-context/ui.js` |
| Display name only | `index.html`, `capacitor.config.ts`, native iOS/Android display-name resources |
| New coverage | `tests/irda-prelaunch-model.spec.js`, `irda-prelaunch-ui.spec.js`, `irda-live-layout.spec.js`, `irda-long-passage.spec.js`, `irda-loading.spec.js`; extended `tests/passage-grouping-ui.spec.js` |

Mode selections made before the Passage Studio module is ready are queued, with the last selection winning. Pending independent recall uses a text-free loading view; it never paints study tiles first. Account/source generation guards still cancel obsolete loads.
