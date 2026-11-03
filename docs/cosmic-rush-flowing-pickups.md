# Star Runner — flowing Quran pickups

The public flight now replaces navigation-star collection with verified Quran pickups. Movement, obstacle avoidance and Quran sequence decisions happen in the same running scene. The untimed gateway system remains available as an optional review at stage checkpoints; it no longer interrupts the default flight after each wave.

## Play

Revision Lab → Cosmic Rush → mission briefing → choose **Pickup style**:

| Style | Flowing content |
| --- | --- |
| Ayahs + word pieces (default) | Whole ayahs of up to four words; longer ayahs are collected word by word. |
| Word by word | Every canonical word of every selected ayah, in order. |
| Whole ayahs | Complete, original ayah texts on wider staggered ribbons. |

Steer with arrows, A/D, swipe or the on-screen lane buttons. If already in the desired lane, press **Space** or **Stay / collect** to commit to it. Each wave requires active lane input; an unattended animation cannot clear the route.

Word waves have three simultaneous pickups, one per lane. Whole-ayah ribbons are staggered and explicitly label their physical lane so the complete Arabic can wrap at readable size on phones. Their reading time and spacing increase with text length. Ordinary unlabeled asteroids arrive separately and independently of the correct lane; the answer cannot be inferred from asteroid placement or pickup color.

A correct collision collects the next canonical word/ayah and advances the readable RTL construction/continuation line. An incorrect text collision records a sequence-selection mistake and returns the same required target in another wave. Previously collected pieces remain. A missed piece returns without a memory mistake. Asteroid impacts affect the ship shield and motor-error count only. Shield depletion offers a retry from the current piece, retaining earlier connections; explicit Restart stage begins that stage's sequence again.

Every word/ayah in the selected range must be collected before its stage can complete. Stage ordering and source references still come from the original free-only mission. Untimed review, when selected, happens after that stage's flowing collection and must finish before the next stage. Returning to the briefing or reloading ends the current flight; evidence remains in profile export.

## Source and learning integrity

`src/quest/cosmic/flow-content.js` uses the existing free canonical content adapter and original Uthmanic text. Whole ayahs and zero-based word IDs retain their exact source spelling and word boundaries. Parts are individual verified words, not newly invented phrases or approved recitation stopping points. There is no generated Quranic Arabic or new audio segmentation.

Candidate selection excludes equivalent displayed wording, including identical wording from another source occurrence. Whole-ayah distractors are selected within a comparable length range. Wrong choices remain authentic Quran content, not fabricated incorrect Arabic. All pickup types use the same visual treatment; correctness is determined by canonical unit ID and physics contact.

`src/puzzles/arcade/cosmic/flow-runner.js` is a deterministic simulation with the same start/pause/resume/dispatch/getSnapshot/dispose contract. Each new wave is bounded to three Quran pickups plus one environmental asteroid. Only active objects are rendered. Progress is a canonical unit cursor, separate from shield/motor errors and selection mistakes.

The existing controller selects the new engine for the public pickup styles. Its original motor-only engine remains available to existing simulation consumers/tests. This does not introduce another frontend framework, physics dependency or FSRS scheduler.

## Audio, evidence and accessibility

Listen to current ayah pauses the flight and plays the original full-ayah recording through an owned audio manager. Volume, stop, resume, navigation and account-change cleanup prevent overlapping/stale playback. Listening is recorded as assistance for that reference. Displaying pickups and collected context uses the existing study-exposure protection for unfinished independent recall; if assistance cannot be recorded, the flight pauses and Arabic stays hidden until recovery.

Correct and incorrect pickups extend the existing `ayah-cosmic-gateways-v1` practice ledger compatibly. Word-unit IDs, selected source IDs and per-ayah completion are retained as supported recognition evidence. Correct-unit receipts are deduplicated on stage replay. No native recall grade, long-term mastery, leaderboard award or new FSRS review is inferred from flying into a pickup. No Supabase migration is required.

Full Arabic remains DOM text with `lang="ar"`, RTL layout, the existing Quran font and no ellipses or hidden words. Whole-ayah phone layouts reserve a taller flight field; controls remain available while scrolling. Reduced motion keeps essential movement and removes decorative effects. Checkpoint/recovery summaries focus their heading rather than a button, preventing a held Space key from accidentally restarting or advancing the stage.

## Validation

- Every free surah: canonical word reconstruction, exact whole-ayah text, complete coverage and authentic distinct distractors.
- Real collision choices, retained progress, separate motor/selection errors, repeated required pieces, idle-input prevention and pause/disposal.
- Browser keyboard steering, moving Quran capsules, no star pickups, no default quiz interruptions, mobile ribbons, full-ayah audio pause/cleanup and fail-closed assistance protection.
- Optional untimed review, cross-stage progression and old memory/gateway records remain covered by the existing tests.

The selected Cosmic, shared arcade framework, Snake engine and Falling Words engine run covered 52 tests: 50 initially passed, and the two browser-control checks passed after freezing their test clocks between deliberate simulation steps. The production build and `git diff --check` passed. This was a focused regression run, not a rerun of the entire application suite.
