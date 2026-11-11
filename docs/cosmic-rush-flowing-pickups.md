# Star Runner — flowing Quran pickups

The public flight now replaces navigation-star collection with verified Quran pickups. Movement, obstacle avoidance and Quran sequence decisions happen in the same running scene. The untimed gateway system remains available as an optional review at stage checkpoints; it no longer interrupts the default flight after each wave.

## Play

Revision Lab → Cosmic Rush → mission briefing → choose **Pickup style**:

| Style | Flowing content |
| --- | --- |
| Mixed (default) | Target 5 visual chunks (2–3 words) : 1 whole ayah : 4 single words. |
| Word by word | Every canonical word of every selected ayah, in order. |
| Whole ayahs | Complete, original ayah texts on wider staggered ribbons. |

Steer with arrows, A/D, swipe or the on-screen lane buttons. Flying through a pickup collects it immediately, including when the ship is already in the correct lane. No per-wave confirmation or second pass is required. Missed pickups still return. Start flight is an explicit learner action; running is supported recognition practice, never independent recall certification.

Word and chunk waves have three simultaneous pickups, one per lane. Whole-ayah ribbons are staggered and explicitly label their physical lane so the complete Arabic can wrap at readable size on phones. Their reading time and spacing increase with text length. Ordinary unlabeled asteroids arrive separately and independently of the correct lane; the answer cannot be inferred from asteroid placement or pickup color.

A correct collision collects the next canonical word/ayah and advances the readable RTL construction/continuation line. An incorrect text collision records a sequence-selection mistake and returns the same required target in another wave. Previously collected pieces remain. A missed piece returns without a memory mistake. Asteroid impacts affect the ship shield and motor-error count only. Shield depletion offers a retry from the current piece, retaining earlier connections; explicit Restart stage begins that stage's sequence again.

Every word/ayah in the selected range must be collected before its stage can complete. Stage ordering and source references still come from the original free-only mission. Untimed review, when selected, happens after that stage's flowing collection and must finish before the next stage. Returning to the briefing or reloading ends the current flight; evidence remains in profile export.

## Mix and revision rounds

Mixed mode targets **5 chunks : 1 whole ayah : 4 single words by pickup count** using deterministic weighted deficits. Whole ayahs are eligible only at ayah openings; chunks contain 2 or 3 contiguous words and never cross ayah boundaries. Unavailable kinds defer to eligible kinds, so short passages can differ from the target. All source words remain covered once per round. The full free-corpus distribution test allows one percentage point deviation per kind.

Choose **1–10 rounds per stage ayah set** in the briefing (default/minimum 1). Each stage contains up to five selected ayahs. After one completed round, proceed to the next set, switch activity, or optionally repeat; remaining optional rounds can be skipped without receiving completion credit. Every round ends at an untimed safe checkpoint. Round 1 uses base speed and one asteroid per wave. Each following round adds 7% of base speed and one asteroid per wave (round 3: 114%, three asteroids). Slow pace remains available.

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
- Real collision choices, retained progress, separate motor/selection errors, repeated required pieces, first-pass automatic contact and pause/disposal.
- Browser keyboard steering, moving Quran capsules, no star pickups, no default quiz interruptions, mobile ribbons, full-ayah audio pause/cleanup and fail-closed assistance protection.
- Optional untimed review, cross-stage progression and old memory/gateway records remain covered by the existing tests.

All 55 selected Cosmic Rush, shared arcade framework, Snake and Falling Words regression cases passed across the completed runs and focused reruns. The four-round UI assertion was corrected to count distinct rounds, since word-only phases can record multiple pickups per round; its focused rerun passed. The mix-phase model test also passed. Production build and `git diff --check` passed. This is a focused regression verification, not the full application suite.

## Blaster, boost and points

**Space / Blaster** fires a real upward projectile from the ship, with a 250 ms cooldown and at most eight active bolts. Bolts collide only with ordinary unlabeled asteroids. Quran pickups are never shot, fragmented or rewritten. Asteroids have a brief ring effect when hit. A shot is not a memory assessment.

Hold **B**, or tap **Boost** to toggle it, for 3.234× environmental travel speed (another 40% above the previous 2.31× boost). Boost fuel lasts four seconds and recharges at 0.6 seconds of fuel per second of normal flight. Release to stop boosting. Pause, recovery, stage completion and disposal release boost; pausing does not consume fuel. On touch devices, Boost and Blaster are simple tap buttons beside the arrow controls. Boost stays active until tapped off or fuel runs out. Full-ayah manual listening and opening the separate theme dialog pause the flight. Automatic target cues keep the flight moving slowly.

Correct normal pickups earn 20 arcade points; correct boosted words, chunks or ayahs earn 40 and a brief eight-star burst around the ship. Wrong pickups receive neither bonus nor star burst. Destroyed asteroids earn 10 arcade points. Point receipts are limited to one per canonical unit or per asteroid slot for the current target and revision round. Repeating a missed wave or restarting a round cannot farm mission points. The mission HUD retains the total across rounds and stages; the existing practice ledger stores the awarded point metadata, boost flag and motor-defense evidence separately from memory errors.

A destroyed asteroid can also award **2 supplementary XP**, and a correct boosted pickup **4 supplementary XP**, through the existing lab reward store. Stable day/mission/stage/round/action receipts deduplicate replay and reload. Existing per-ayah/action, mode/day, cooldown and overall daily caps remain in force. XP goes through the existing opt-in leaderboard publisher; participation/privacy settings are unchanged. Arcade score remains separate from XP, stars, mastery and FSRS. Account checks before and after asynchronous receipt hashing prevent awarding another signed-in profile. Raw audio and private profile content are not involved.

Reduced-motion settings replace star expansion with a stationary, brief fade. Burst effects have no Quran text and do not add sounds over recitation. The Theme button now lives in the top-right header beside XP and ayahs practiced. It opens the existing profile-aware preview/cancel/apply dialog; Encouragement settings retains sound and celebration preferences only.

Validation for this addition includes first contact in all pickup kinds, consecutive same-lane collection, blaster motion/cooldown and text safety, boost fuel and acceleration, wrong boosted selections, visible mobile star bursts, capped/idempotent XP, account isolation, mission point deduplication, existing round progression, header appearance persistence, and keyboard/touch lifecycle cleanup. Final verification covered 75 distinct focused cases across the completed runs and reruns: combat/boost/first-pass collection, browser touch/keyboard controls, existing flow and gateway models, shared arcade/Snake/Falling Words, appearance, encouragement, rewards and opt-in publishing. The production build and `git diff --check` passed. This does not represent a run of the full application test suite.

## Guided audio revision

Target guidance is **on by default** in the mission briefing. Before each new target, the original word recording, the ordered word clips for a 2–3-word visual chunk, or the verified full-ayah recording plays once. Each completed target cue is tracked by stage, round and canonical unit ID, so a missed wave does not repeatedly play it. New rounds and explicit round restarts offer the cues again. Chunk clips are word study aids, not newly approved recitation stops or an invented phrase recording.

During automatic or manually replayed target cues, the flight **continues at 25% of its current round pace**. Movement controls remain responsive. The ordinary round speed returns after the final clip ends; there is no automatic pause or automatic resume of a learner-paused flight. Boost uses its normal four-second fuel budget during cues. The separate full-ayah listening button retains its explicit pause behavior.

Replay target cue repeats the current reference. Stop recitation cancels it and restores normal pace. Playback failure restores normal pace, shows a retry message, and avoids trapping learners in silence or a permanent slowdown. Each word clip has a 30-second watchdog; full ayahs have a 180-second watchdog. Pause, navigation, profile changes, new targets and disposal cancel stale playback and callbacks. Volume uses the existing recitation level control. Learners can disable automatic guidance for a quiet session in the briefing.

Cue use is marked as study assistance. It never grades independent recitation, grants mastery or changes FSRS scheduling. All sources are obtained from the existing free canonical corpus and audio adapter. No Quran text or source audio is regenerated.

Keyboard mapping: **Space = blaster**, **hold B = boost**, arrows/A/D = steer, P/Escape = pause. Space still activates focused buttons normally and selects untimed gateway choices when applicable. J and Shift are no longer flight shortcuts. The redundant Stay / collect button is removed because pickups collect on first contact.

Verification for this update: 62 distinct focused cases passed across the completed regression and targeted reruns, including cue sequencing, moving slowdown/restoration, unavailable audio, cancellation, remapped controls, mobile taps, four-second boost, existing flow/gateway behavior, shared arcade, Snake/Falling Words and FSRS non-interference. The production build and `git diff --check` passed. This was not a run of the full application suite.

Meteor Defense and the 40% boost-speed increase are documented in [Phase 4](cosmic-rush-meteor-defense.md).
