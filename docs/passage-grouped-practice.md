# Passage Builder: grouped workspaces and chosen games

## Learner workflow

Open **Passage Builder → memorization studio** and select an available ayah. New workspaces default to **Grouped · up to 12 pieces**:

| Words in the selected ayah / reviewed unit | Words per movable piece | Maximum pieces per page |
| --- | --- | --- |
| 1–12 | 1 | 12 |
| 13–24 | 2 | 12 |
| 25–36 | 3 | 12 |
| 37 or more | Up to 5 | 12 |

The last piece can contain fewer words. Longer ayahs use further pages. The verified 128-word Ayatul Dayn pilot therefore has pages covering words 1–60, 61–120 and 121–128; the final page has one five-word and one three-word piece. This is a visual study layout, **not a certification of valid recitation stops**. Approved recitation units remain a separate selector and require the existing teacher-reviewed definitions and audio alignment.

Move an entire piece by tapping, dragging or using its earlier/later buttons. Canonical word positions inside a piece cannot be reordered. Use **Jump to workspace**, Previous/Next, and **Check full ayah reconstruction** to connect the pages. Hint hiding applies to original words within a piece. Full-ayah audio continues across visual pages and stops on content switches/exit.

Under **Choose your passage games**, check the games you want and launch any selected one in your preferred order. No automatic tour through all games is imposed by the studio. You can return to Passage Builder at any time; games are disposed before another activity or assessment opens. The separate pre-existing Passage Expedition route is preserved rather than silently changing its saved checkpoint contracts.

After **16 actually awarded studio/game XP** for the current ayah or selected passage, a self-assessment prompt appears. Another studio game requires completing that self-assessment first. You may leave or continue supported word study without being assigned an invented grade. XP caps still apply; capped/duplicate rewards do not advance the meter. Progress is scoped to the selected reference list, not the global wallet.

Recite before revealing the text, compare, then rate Again/Hard/Good/Easy. This is **self-assessed recitation**, not speech verification. Assistance retains the existing eligibility rules; an assisted assessment never becomes independent recall just to unlock a game. Again/Hard ratings are accepted honestly; no Good/Easy rating is required to continue. An approved-portion assessment does not waive a whole-ayah/passage checkpoint. Afterwards choose continued practice, the last game, or the next available ayah/set in that surah. Each new private download still requires authorization.

## Which game is appropriate?

Recommendations use a transparent rule rather than an AI-generated diagnosis or a second scheduler. They do not change any FSRS due date.

| Activity | Best fit and limits |
| --- | --- |
| **Ayah Space** | Default for long ayahs with no due/difficulty evidence: controlled incoming waves keep visible choices bounded. Good for repeated word selection with a motor component; collisions are not recall grades. |
| **Ayah Serpent** | Default for shorter units: repeated canonical sequencing with a growing trail and slow movement. Motor mistakes and memory mistakes remain separate. Long workspaces use existing bounded-tail mechanics. |
| **Memory Maze** | Suggested when native FSRS records are due or recent independent self-assessments report Again/Hard. Door decisions are untimed; the preceding recommendation asks the learner to self-assess due material first. This supports corrective sequencing, not a claim to identify a precise forgotten word. |
| **Ayah Blocks** | Optional construction/ordering practice. Motion adds motor load, so it is not the default recommendation after reported recall difficulty. Existing touch, rotate, pause and audio controls are reused. |
| **Cosmic Rush / Star Runner** | Appropriate for supported free revision in Revision Lab, but deliberately restricted to Al-Fatihah and Juz Amma. It is not registered as a premium passage game and is not used to bypass that content boundary. |

Due dates and the last three native history entries are read as evidence. Only an independent self-assessment's Again/Hard contributes difficulty evidence; assisted ratings, motor bumps, game success and missing history cannot establish retained memory or a specific weak transition. With no history, the recommendation says explicitly that it is based on content length. Learner choice is retained even if the suggestion changes.

The arcade adapter uses the selected visual page's **original individual words**, with authenticated full-ayah audio. It does not promote arbitrary five-word visual groups into approved recitation phrases. All four games retain real controls, authentic distractors, existing motor/memory distinctions and bounded visual rendering. The game mechanics and shared content authorization path are unchanged. The four keyboard handlers now recognize their own enclosing dialog, while rejecting foreign/nested dialogs and interactive form fields. This repairs keyboard navigation inside the studio without steering background games.

## Persistence and compatibility

- Existing `ayah-passage-workspaces-v1` remains version 1. Optional `layoutPreference`, checkbox `games`, `practice` receipts and `current.layout` are additive. The existing device export includes this document.
- Grouped arrangements have a `:grouped-v1` key suffix; original word-window records retain their original keys. **Original word windows · saved drafts** reopens them. Existing saved drafts select their previous layout automatically. Switching layouts preserves both arrangements, hint states and reconstruction order.
- Orders still store original canonical word positions, not Arabic text. Restore validates complete, contiguous atomic groups and rejects partial/duplicated/out-of-range data without silently repairing or overwriting it. Unknown/malformed optional practice data is preserved for recovery.
- Game results use the existing Quest host, source/review hashes, authenticated loaders, Puzzle Lab records, per-ayah/day caps and idempotent receipts. Temporary one-workspace trials are separate from saved Expedition 2.0 campaigns. Partial arcade physics are not newly serialized; return to the studio to relaunch a workspace.
- Only earned rewards reported by those established paths advance the prompt ledger; the ledger does not award XP. This new counter starts with activities recorded by this version. Historic supplemental events lack reliable per-ayah attribution and are not guessed or backfilled.
- Checkbox/layout/XP-prompt state is device-local under the current profile and included in workspace export. The existing native passage FSRS document retains its separate cloud-sync/CAS workflow. This change does not claim cross-device sync for workspace layouts.
- No new tables, migration, Edge Function, API key, content import, approved boundary or FSRS parameter is required. Free content and private/developer content visibility retain their current policies.

## Validation

The model suite covers every grouping threshold, exact 128-word coverage, shorter final groups, reviewed-unit bounds, original draft compatibility, corrupt atomic orders, receipt deduplication, capped XP, context separation, assessment acknowledgement and evidence-backed recommendations.

Browser checks exercise mobile grouped-piece reordering/reload, layout switching, saved checkbox choices, an earned XP → native self-assessment → return journey, all four actual game launches on the last Ayatul Dayn workspace, and a real Maze completion with scoped Puzzle Lab XP and a return-to-game option. Existing passage, teacher review, Quest, recovery and learning/revision journeys are also run. Final verification:

- A 119-case targeted regression batch finished with **117 passes**, one new fixture-startup failure, and one existing Serpent chain case exceeding its 90-second test timeout. The fixture now explicitly waits for app mounting. The Serpent scenario had passed in the earlier broad run and passed again in isolation without changing its engine or assertions.
- Final new-feature rerun: **10 passed (24.6 seconds)** across `passage-grouping.spec.js` and `passage-grouping-ui.spec.js`, including the corrected modal fixture and genuine Maze completion → XP header update → native recall → return/advance flow.
- Final isolated Serpent chain rerun: **1 passed (30.5 seconds)**. Every case in the targeted batch therefore has a passing result after follow-up; this is not a claim of a second completely green 119-case invocation or a run of the entire repository suite for this change.
- `npm run build`: passed (8.77 seconds). The existing large shared-chunk advisory remains. `git diff --check`: passed.
- Mobile and desktop fixture captures showed 12 five-word pieces with no horizontal overflow: studio client/scroll widths were 352/352 and 1096/1096 respectively. Images are local review artifacts under `/workspace/artifacts/passage-grouped-{mobile,desktop}.png`, not shipped runtime assets.

The targeted run included the original passage model/UI suite, teacher segment review, shared Quest model/UI, Expedition models, release-audit and learning/revision journey suites, plus Space, Serpent, Maze and Blocks browser suites. Original-layout tests explicitly seed that layout; the new suite separately verifies the grouped default. This preserves the old assertions rather than replacing them with new-layout expectations.

Changed files: `src/passage/model.js`, `ui.js`, `passage.css`, new `practice-plan.js` and `games.js`; new `src/puzzles/arcade/input-scope.js` and the four games’ keyboard handlers; the two new grouping test files, original passage UI fixture, and these passage documentation files.

Live private content still depends on the existing Supabase setup; fixture-based tests do not assert that the long-ayah pilot is deployed to the public site. No new material is advertised as launch-ready. Physical-device audio permission behavior remains a deployment smoke-test item.
