# Star Runner — flowing Quran pickups

The public flight now replaces navigation-star collection with verified Quran pickups. Movement, obstacle avoidance and Quran sequence decisions happen in the same running scene. The untimed gateway system remains available as an optional review at stage checkpoints; it no longer interrupts the default flight after each wave.

## Play

Revision Lab → Cosmic Rush → mission briefing → choose **Pickup style**:

| Style | Flowing content |
| --- | --- |
| Mixed (default) | Target 5 visual chunks (2–3 words) : 1 whole ayah : 4 single words. |
| Word by word | Every canonical word of every selected ayah, in order. |
| Whole ayahs | Complete, original ayah texts on wider staggered ribbons. |

Steer with arrows, A/D, swipe or the on-screen lane buttons. If already in the desired lane, press **Space** or **Stay / collect** to commit to it. Each wave requires active lane input; an unattended animation cannot clear the route.

Word and chunk waves have three simultaneous pickups, one per lane. Whole-ayah ribbons are staggered and explicitly label their physical lane so the complete Arabic can wrap at readable size on phones. Their reading time and spacing increase with text length. Ordinary unlabeled asteroids arrive separately and independently of the correct lane; the answer cannot be inferred from asteroid placement or pickup color.

A correct collision collects the next canonical word/ayah and advances the readable RTL construction/continuation line. An incorrect text collision records a sequence-selection mistake and returns the same required target in another wave. Previously collected pieces remain. A missed piece returns without a memory mistake. Asteroid impacts affect the ship shield and motor-error count only. Shield depletion offers a retry from the current piece, retaining earlier connections; explicit Restart stage begins that stage's sequence again.

Every word/ayah in the selected range must be collected before its stage can complete. Stage ordering and source references still come from the original free-only mission. Untimed review, when selected, happens after that stage's flowing collection and must finish before the next stage. Returning to the briefing or reloading ends the current flight; evidence remains in profile export.

## Mix and revision rounds

Mixed mode targets **5 chunks : 1 whole ayah : 4 single words by pickup count** using deterministic weighted deficits. Whole ayahs are eligible only at ayah openings; chunks contain 2 or 3 contiguous words and never cross ayah boundaries. Unavailable kinds defer to eligible kinds, so short passages can differ from the target. All source words remain covered once per round. The full free-corpus distribution test allows one percentage point deviation per kind.

Choose **3–10 rounds per stage ayah set** in the briefing (default/minimum 3). Each stage contains up to five selected ayahs. Complete every round of that set before moving to the next stage. Every round ends at an untimed safe checkpoint. Round 1 uses base speed and one asteroid per wave. Each following round adds 7% of base speed and one asteroid per wave (round 3: 114%, three asteroids). Slow pace remains available.

Asteroids arrive in staggered lanes and clear before the Quran collection window, avoiding blocked correct answers. Reading time extends where necessary to accommodate hazards. Each round uses a different deterministic wave seed and mixed-selection phase, varying presentation even for one-ayah sets. Round transitions dispose the old engine and restore shields. Restart stage replays the current round at its current difficulty. Checkpoint IDs include the round index. Optional untimed gateway review happens after the first pass of each stage; it is not duplicated on subsequent rounds. Arcade outcomes never grade independent recall or alter FSRS.

## Source and learning integrity

`src/quest/cosmic/flow-content.js` uses the existing free canonical content adapter and original Uthmanic text. Whole ayahs and zero-based word IDs retain their exact source spelling and word boundaries. Parts are individual verified words or contiguous groups of 2–3 original words. Chunk IDs retain their canonical ayah and zero-based start/exclusive end indices. These are visual study groups, not approved phrases or recitation stops. Full-ayah audio remains continuous. There is no generated Quranic Arabic or new audio segmentation.

Candidate selection excludes equivalent displayed wording, including identical wording from another source occurrence. Whole-ayah distractors are selected within a comparable length range. Wrong choices remain authentic Quran content, not fabricated incorrect Arabic. All pickup types use the same visual treatment; correctness is determined by canonical unit ID and physics contact.

`src/puzzles/arcade/cosmic/flow-runner.js` is a deterministic simulation with the same start/pause/resume/dispatch/getSnapshot/dispose contract. Each new wave is bounded to three Quran pickups plus 1–10 environmental asteroids depending on the revision round. Only active objects are rendered. Progress is a canonical unit cursor, separate from shield/motor errors and selection mistakes.

The existing controller selects the new engine for the public pickup styles. Its original motor-only engine remains available to existing simulation consumers/tests. This does not introduce another frontend framework, physics dependency or FSRS scheduler.

## Audio, evidence and accessibility

Listen to current ayah pauses the flight and plays the original full-ayah recording through an owned audio manager. Volume, stop, resume, navigation and account-change cleanup prevent overlapping/stale playback. Listening is recorded as assistance for that reference. Displaying pickups and collected context uses the existing study-exposure protection for unfinished independent recall; if assistance cannot be recorded, the flight pauses and Arabic stays hidden until recovery.

Correct and incorrect pickups extend the existing `ayah-cosmic-gateways-v1` practice ledger compatibly. Word-unit IDs, selected source IDs and per-ayah completion are retained as supported recognition evidence. Correct-unit receipts are deduplicated within each round on replay; separate rounds retain separate practice evidence. Historic records remain intact. No native recall grade, long-term mastery, leaderboard award or new FSRS review is inferred from flying into a pickup. No Supabase migration is required.

Full Arabic remains DOM text with `lang="ar"`, RTL layout, the existing Quran font and no ellipses or hidden words. Whole-ayah phone layouts reserve a taller flight field; controls remain available while scrolling. Reduced motion keeps essential movement and removes decorative effects. Checkpoint/recovery summaries focus their heading rather than a button, preventing a held Space key from accidentally restarting or advancing the stage.

## Validation

- Every free surah: canonical word reconstruction, exact whole-ayah text, complete coverage and authentic distinct distractors.
- Real collision choices, retained progress, separate motor/selection errors, repeated required pieces, idle-input prevention and pause/disposal.
- Browser keyboard steering, moving Quran capsules, no star pickups, no default quiz interruptions, mobile ribbons, full-ayah audio pause/cleanup and fail-closed assistance protection.
- Optional untimed review, cross-stage progression and old memory/gateway records remain covered by the existing tests.

All 55 selected Cosmic Rush, shared arcade framework, Snake and Falling Words regression cases passed across the completed runs and focused reruns. The four-round UI assertion was corrected to count distinct rounds, since word-only phases can record multiple pickups per round; its focused rerun passed. The mix-phase model test also passed. Production build and `git diff --check` passed. This is a focused regression verification, not the full application suite.
