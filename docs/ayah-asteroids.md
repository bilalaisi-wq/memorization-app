# Ayah Space

Puzzle Lab → **Ayah Space** → choose a journey and difficulty → **Prepare flight** → **Start flight**.

This is a spatial 2D game, not a word-choice quiz. The ship has a position and heading; objects have independently moving trajectories. A tractor beam reaches only a bounded cone in front of the ship. Clicking or tapping an object aims/tracks it, but does not capture it or teleport the ship. A shield pulse redirects nearby objects intact.

## Controls and accessibility

- Arrow keys / WASD: hold to fly in four directions. Diagonal speed is normalized.
- Q / R: turn the aim; manual rotation releases tracked aim.
- Space: tractor capture. E: shield pulse. P: pause/resume.
- Mouse: aim at space, or select a moving object to track its heading. Drag the ship to navigate.
- Touch: hold the directional pad or drag the ship, tap an object to aim, then use Tractor beam / Shield pulse. Touch input uses pointer capture and cancellation cleanup.
- Keyboard-only: Tab/Enter can select an object's aim; arrow keys move, Q/R rotate and Space captures. Native form controls retain their keyboard behavior.
- **Navigation assist** approaches an aimed object without making the answer decision. It is recorded as assistance. Pause lets learners read without pressure; empty/out-of-range captures count only as motor events.

The dotted beam/reticle and glowing outline show capture range. Arabic labels remain visible at every difficulty. The captured sequence is separately readable in RTL order, with bounded scrolling for long text. Reduced motion removes decorative victory/transition animations and the expanding shield effect, while keeping necessary game movement. Window blur/backgrounding pauses active flight. Frame gaps over 150 ms are skipped instead of advancing the world.

## Journeys, fairness and difficulty

**Single Ayah** captures one ayah in order. **Ayah Chain** traverses consecutive references in separate sectors, with an explicit Next sector handoff. Classic shares three sequence strikes across the run and restarts the chain after loss; Practice resets strikes per ayah and keeps completed checkpoints on retry. Changing settings and preparing a new flight disposes the old instance.

Only a deliberate wrong capture costs a strike. Ship collisions, missed objects, shield use, control errors and failed audio never cost strikes. Incorrectly captured objects are redirected off-screen rather than destroyed. Shielding a required piece is safe: it returns. Missing a required piece also returns it. The bounded wave always includes the next required piece and, where available, its successor; only a few objects are rendered at once. Explicitly tracked objects cannot silently fall back to capturing an unrelated nearby piece when their target leaves range.

| Difficulty | Flight behavior |
| --- | --- |
| Beginner | Slower drift, one distractor, visible next-piece cue (recorded assistance) |
| Standard | Faster drift, up to five objects, three distractors, no next-word cue |
| Expert | Faster phrase flight, fewer larger objects for readability, two spelling-similar verified whole-ayah distractors, no next-piece cue |

Every word/phrase retains its source reference and exact canonical occurrences. Identical wording can be captured interchangeably, while the accepted RTL display uses the canonical target occurrence. A random session seed selects reproducible distractors; starting another flight varies the seed. Similarity ranks existing verified candidates; it never generates Arabic.

## Phrase integrity and current availability

The game uses the existing free Puzzle Lab library (Al-Fatihah and Juz Amma); it does not open new paid content or bypass backend entitlements.

Beginner and Standard use verified source words for ayahs up to 40 words, displaying only the active wave. Expert uses an existing short **whole ayah** of at most eight words as one phrase unit, or published teacher-approved study segments. Longer word workspaces also require approved phrase boundaries. Phrases over 12 words are refused to avoid unreadable flight cards; a teacher must provide appropriately sized boundaries rather than the game inventing subdivisions.

The Lab loader requests the existing published review through `loadBundle`. It verifies the source revision/hash, exact reference, word count and exact source word strings, then converts the review's one-based inclusive indices to the shared adapter's zero-based end-exclusive indices. The adapter checks complete coverage, no gaps/overlaps, review identifiers and approved display status. Draft/rejected/pending boundaries cannot enable Expert. A missing service or unavailable approval produces an explanatory error and offers the existing short-ayah word modes; there is no fabricated fallback segmentation.

Study-segment approval never implies a valid recitation stop. Audio always remains continuous full-ayah reference recitation. This game does not splice recordings, invent timestamps or certify waqf/restart positions.

## Audio and learning records

Listen & Build loops verified full-ayah audio. Echo holds the sector while its reference plays; learners can continue without audio at any time. Silent stops playback. Manual listening during flight also holds movement until the reference ends or the learner continues silently. Audio errors release the hold without strikes. Pause/resume and navigation own/clean up the shared audio instance; stale playback completions cannot affect a later flight.

Audio/reference cues and navigation assistance are recorded separately from motor errors and sequence mistakes. The shared result recorder stores completed-run checkpoint receipts through the existing `ayah-puzzle-lab-v1` and learning stores. It retains per-ayah/game/day XP caps, account identity checks and duplicate receipt prevention; retries after a storage failure cannot award twice. No new SQL or storage-key migration is needed.

Game success is recognition/order practice. It never grades independent recitation, awards memorization mastery or changes FSRS cards/due dates. Existing Ayah Blocks and developer-only legacy games remain intact.

## Implementation and verification

- `src/puzzles/arcade/asteroids/engine.js`: deterministic pure flight physics, bounded waves, aim/range checks, captures, deflections, lag protection and shared checkpoint/strike reducer.
- `content.js`: canonical word/approved phrase units, source-backed distractors and flight difficulty profiles.
- `ui.js` / `asteroids.css`: ship, beam/shield effects, readable Arabic/RTL capture, keyboard/pointer/touch, audio modes, status and result controls, lifecycle cleanup.
- Lab uses the existing registry/launcher and result recorder; `main.js` supplies the existing authorized bundle loader.
- `tests/asteroids-engine.spec.js` and `tests/asteroids-ui.spec.js`: physics/provenance, range, returning objects, deflection, lag, both chain rules, reviewed phrases, capped/idempotent XP, FSRS separation, keyboard/touch, reduced motion, Echo failure/success, looping audio, cleanup, victory and game-over retry.

[Desktop preview](asteroids-previews/desktop.png) · [Mobile preview](asteroids-previews/mobile.png). These are real local UI captures with verified source text, not mock learner progress. Reproduce with a local Vite server on port 5182 and `node scripts/asteroids-screenshots.mjs`.

Validation: the complete Playwright suite passed **230 tests**, including all existing Ayah Blocks tests and **14 new Asteroids tests**. Production Vite build passed. No hosted provider configuration, database migration or Qur'anic source data was changed.

## After a completed flight

Completion now confirms **Flight saved** inside the victory panel. The normal actions are **Play again** (same ayah/range, a fresh session and shuffled seed), **Continue to the next ayah(s)**, **Choose different ayahs**, **Practise with the reciter**, **Try self-assessed recall**, and **Return to study / take a break**. Replay and continuation start a new flight directly, retaining audio preference, difficulty and checkpoint rules. Choose different ayahs focuses the existing configuration form.

A storage failure instead shows an inline error and **Retry saving result**. Successful retry visibly confirms the save and removes the retry action. Starting another activity through the completion choices first requires the current result to be saved; retries retain the same receipt and cannot double-award XP. The learner can still explicitly return to study. Saved recognition progress never becomes independent recall credit.

The next-step suggestion reads existing goals, confidence, intended study time, recorded mistakes, recent flights and actually due FSRS reviews. Due review takes priority; shaky confidence or sequence mistakes suggest Practice. Review goals, confidence in recall, reaching the study-time intention or several recent flights encourage self-assessed recitation and a change of skill. Otherwise, continuation offers one gentle ayah or a short range of up to three, bounded by the surah end. Learners retain all choices. These are local recommendations, not AI judgments, verified mastery claims or scheduler changes.

Completion-flow validation: **233 tests passed** across the full Playwright suite, and the production build passed. Added coverage includes save-failure recovery without duplicate XP, keyboard continuation, fresh replay, recall navigation and goal-aware pacing recommendations.
