# Memory Repair Workshop

Open **Developer mode → Menu → Memory Repair Workshop**. This respects the current policy that advanced surfaces stay out of the learner menu. It does not add a client entitlement bypass: private text/audio still require the existing authenticated content endpoint.

## Transparent evidence rules

This is a deterministic, read-only recommendation system, with no AI calls or new scheduler. Dashed connections show opportunities for supported practice; they do not mean that the learner has forgotten a passage.

| Signal | Evidence source | Suggested activity | Limits |
| --- | --- | --- | --- |
| Wrong non-target word | New arcade selection metadata | Ayah Space | An observed input, not a diagnosis of a memory error |
| Canonical word at a wrong position | New arcade selection metadata | Ayah Serpent | Only recorded positional decisions can identify this category |
| Wrong phrase continuation | New multiword decision metadata | Memory Maze | Does not infer an approved recitation stop |
| Similar-passage task mistakes | Existing Similar Ayah Detective result | Memory Maze | Task-level signal; no specific conflicting passage inferred |
| Audio/hint/reference or non-independent assessment | Existing assistance metadata / recall history | Memory Maze | Support use is welcome; dependence is not established |
| Again or Hard | Latest five actual attempts per passage unit | Ayah Serpent | Learner self-report, with original independence and scheduling flags |
| Old aggregate or sequence-only mistakes | Existing Puzzle Lab history | Ayah Serpent | Cause and exact word are unknown; kept generic |

Every recommendation exposes dated record IDs, activity source, and original canonical positions where actually available. Duplicate receipt/event evidence is deduplicated. There is no invented weakness score, precision estimate, automatic resolution, decay formula or missed-day penalty. Recent difficult self-assessments and historic game errors are suggestions, not permanent diagnoses. All six requested problem categories have policies; categories without evidence are explicitly listed as unestablished.

### Sources that must remain distinct

- **Observed arcade mistake:** actual wrong selection or older aggregate game result.
- **Self-reported recall difficulty:** actual learner Again/Hard grade. An independent attempt is still self-assessed.
- **Independently graded recall:** no external teacher/examiner grading source is connected. No such grades are fabricated from self-grading or game results.
- **Motor-control failure:** visible separately and excluded from memory recommendations.
- **Unverified audio/transcription inference:** not consumed by this engine. No AI diagnosis or tajweed claim is made.

The assistance indicator deliberately says “Study assistance used.” It does not claim that listening is failure or establish assistance dependence. Similar-passage recommendations describe the observed task only; specific substitutions are shown only when actual canonical identifiers exist.

## Targeted missions and fallbacks

`src/quest/repair/mission.js` obtains the current authorized bundle, validates source/segmentation revisions, and selects the bounded existing visual workspace containing the recorded expected word. If no exact location was recorded, it starts with the first workspace and says which words are being practised. It never renders hundreds of draggable words at once.

Ayah Space, Ayah Serpent and Memory Maze are detected through the shared registry at runtime. The preferred activity runs at beginner pace, with the existing optional full-ayah audio and navigation assistance. Planned/hidden games are never launched. If unavailable or incompatible, another registered game is chosen, then bounded supported reconstruction remains the fallback. Fallback includes the verified reference text and full-ayah listening.

These are **word-based visual study missions**, not newly authorized phrase segments or permissible recitation stops. No Qur'anic text is generated, imported or rewritten. Existing reviewed phrase/recitation restrictions remain intact. New phrase-error metadata can come from existing reviewed/full-ayah phrase gameplay, but the workshop itself does not promote a draft into phrase authority.

The result summary shows practice XP, mistakes, assistance, motor events, exact workspace and activity. It offers repeat practice, return to the workshop or a new independent recall. If an unfinished native assessment exists, that assessment resumes first. Reviewed segment/passage units are revalidated against current content before recall. Changed/revoked units retain their history and require the existing recovery workflow.

## Persistence, rewards and cleanup

- Existing `ayah-puzzle-lab-v1` remains schema version 1; optional mistake metadata is additive. Existing receipts and aggregate history remain valid.
- New game events may add `category`, `expected` and `selected` canonical word identifiers. The shared reducer bounds and validates these fields. No duplicate Arabic text/audio is stored by the workshop.
- Mission receipt identities include the evidence IDs, canonical reference, source hash, segmentation hash and workspace. Replaying the same evidence cannot repeatedly reward the same mission. Existing shared per-ayah/day XP caps continue to apply, including fallback/arcade split-write retry protection.
- Existing profile-scoped stores isolate accounts. Corrupt/future records are warned about and preserved; no silent reset or migration is introduced.
- The workshop has no persistent “repaired/mastered” flags and writes no FSRS cards, due dates or assessment results from practice completion.
- Only the existing independent recall workflow can record a self-grade and update FSRS under its established eligibility rules.
- Exit, back navigation, account changes, developer-mode changes and quest-surface changes dispose the game/audio/listeners. Late authorized source/audio responses cannot mount into a closed workshop or another account.
- Focus restoration, a focus trap, keyboard controls, large touch controls and reduced-motion styling are provided. Restoration animation is cosmetic.

## Files

- `src/quest/repair/model.js`: read-only rules, evidence and runtime game selection.
- `src/quest/repair/mission.js`: bounded, authorized shared-arcade host and supported fallback.
- `src/quest/repair/ui.js`, `repair.css`: workshop map, evidence details, activity flow and result summary.
- `src/puzzles/arcade/evidence.js`, shared reducer and three existing engines: additive canonical decision metadata.
- `src/billing/ui.js`, `src/quest/registry.js`: developer-menu entry and campaign availability.
- `tests/repair-model.spec.js`, `tests/repair-ui.spec.js`: model, browser, fallback, permissions, mobile and performance coverage.

## Screenshots

Local QA fixture records only; no demo history ships in production. Run Vite on port 5195, then `node scripts/repair-screenshots.mjs`, or set `REPAIR_PREVIEW_URL`.

- [Desktop map](repair-previews/desktop-map.png)
- [Desktop evidence](repair-previews/desktop-evidence.png)
- [Mobile map](repair-previews/mobile-map.png)
- [Mobile evidence](repair-previews/mobile-evidence.png)
- [Mobile arcade mission](repair-previews/mobile-mission.png)

## Remaining limits

Physical iOS/Android audio/device behavior and hosted private-content deployment need separate QA. Historical data cannot reveal an unrecorded exact word, hidden cause of a wrong input, teacher grade, or dependence on assistance. Repairs are suggested practice and do not certify memorization or recitation. No new migration or backend deployment is required for the workshop itself.

## Validation — 2026-11-01

- Complete Playwright suite: **369 passed** (including 17 new workshop tests: 9 model and 8 browser).
- Targeted existing arcade/passage/quest/revision regressions: **90 passed**; the additional malformed-metadata model check also passed.
- Existing content, billing, recitation and coach backend suites: **23 passed**.
- Production build and `git diff --check`: passed.
- A 10,000-record projection performance check passed the two-second regression budget (121 ms in the isolated local run; this is not a device performance guarantee).
- Touch-enabled 390px browser checks verify map/evidence layout, no horizontal overflow, header separation, large arcade controls, focus containment and reduced motion.
- Five desktop/mobile screenshots captured and visually reviewed. These use explicit local QA evidence, not production learner history.

The summary displays XP **on the saved receipt**; replaying that receipt does not add XP again. After this final copy clarification, the eight workshop browser tests and production build were checked again. Physical-device and hosted-private-source QA remain the limits stated above.
