# Advanced Revision: Boss Rush & Hifz Survival

Open **Developer mode → Menu → Muraja’ah Boss Rush** or **Hifz Survival**. Advanced entries follow the existing developer-only presentation policy. Private material still requires the authenticated server content endpoint; menu visibility is not authorization.

## Two distinct experiences

### Muraja’ah Boss Rush

A five-gate challenge tower increases recall demands:

1. **Opening recall:** the first complete selected ayah.
2. **Continuation recall:** the complete following ayah, prompted by the previous reference.
3. **Similar passage discrimination:** choose the canonical opening matching a reference among verified alternatives.
4. **Consecutive ayah recall:** an expanding complete-ayah linked unit.
5. **Full independent passage recall:** all selected ayahs, requiring independent Hard/Good/Easy self-assessment to clear.

| Preset | Discrimination choices | Consecutive gate | Selected passage limit |
| --- | --- | --- | --- |
| Beginner | 2 | Up to 2 ayahs | 2–3 ayahs |
| Standard | 3 | Up to 3 ayahs | 2–6 ayahs |
| Expert | 4 | Up to 4 ayahs | 2–10 ayahs |

Selection must be consecutive, in one surah, and available from the verified library. Only supported surahs appear. If a short selection makes the last two gates use the same unit, gate four permits supported outcomes while gate five requires a fresh independent result.

Distractors are selected deterministically from verified public content, ranked by shared canonical-word identity with the target. Identical normalized opening previews are excluded, including authentic repeated ayahs at different references, so every choice is distinguishable. The UI explicitly reports when there is no shared wording rather than inventing semantic similarity. Options show exact source opening slices, capped at 12 words and labelled as visual previews, not recitation stops. No Arabic is generated, altered or used as a fabricated verse.

A wrong discrimination choice costs one **game** life, records observed text-choice correctness and locks until explicit retry. It creates no recall grade. Again self-grades cost one game life. Hard/Good/Easy clear supported recall gates. The final gate additionally requires actual independence; an assisted successful self-grade never wins and never costs a life merely for using support.

**Classic:** three lives across the entire run; retry restarts gate one. **Practice:** retry retains cleared gates and resumes the current gate. Actual prior recall grades remain saved in both cases.

### Hifz Survival

A coverage-oriented expedition uses existing passage cards, not a progressively harder multiple-choice quiz:

- Select individual ayah, reviewed segment or passage units from records with an actual independent Hard/Good/Easy history entry and an existing card.
- Due units sort first using the existing saved due dates. The oldest-due shortcut selects up to ten; a short route uses at most three, an extended route at most ten. The form retains settings across selection/pagination.
- Upcoming selected material can be included. Native early-review rules still apply; the UI does not reschedule it itself.
- Every stop launches the existing complete recall-unit assessment. After a grade, coverage advances even after Again, recording the difficulty honestly and consuming one lantern for Again.
- Three lantern charges are expedition resources, not a memory-strength estimate. Navigation, listening, support and elapsed days consume none.
- Extended routes have camps every three stops. Practice camps save checkpoints and refill lanterns; Classic camps save location while preserving the run-wide three-charge budget.
- At any stop, use full-ayah text/audio support, save and rest, or finish early. Recovery stations separate rest from recall grading.
- On game over, Practice returns to the last recovered campsite; Classic restarts the route. Previously recorded assessments are never removed or changed.
- Summaries show distinct units covered, independent/assisted attempts, difficult grades, actual scheduled reviews and support visits. Coverage is not certified memorization.

There is no timer, missed-day penalty or simulated forgetting. A route stays where the learner left it regardless of time away.

## Recall integrity and assistance

Both modes launch `openPassageStudio` and use the existing `createPassageMemory` assessment workflow. The actual persisted assessment history is the source of truth. Existing FSRS settings and grading/scheduling rules are unchanged. A callback result alone is insufficient: the active assessment must be graded, match the pending unit, have a new matching timestamp, and have a previously unused attempt ID.

Independence is still **learner self-assessment**, not speech or tajweed certification. Navigation is never graded as recall. Discrimination correctness is labelled separately. No game victory, camp, charge, animation or pause calls FSRS.

Workshop text/audio exposure sets support metadata. A small opt-in `assessmentAssisted` context seam in the existing passage UI marks that matching assessment assisted through the existing assistance flag API. The native `begin` API accepts an optional initial assistance flag so a new supported attempt is stored atomically; its default remains unchanged. It affects no other callers or scheduler rules. Exposure is recorded before support text is shown. It also handles a resumed, already-declared assessment so support cannot be accidentally relabelled independent. Native listening/reveals continue to track their own assistance.

Hide support and explicitly begin a fresh attempt when ready; finishing an assisted final assessment allows another independent attempt without a life penalty. An unrelated unfinished native assessment is resumed first and cannot clear the current gate. Coach review opens one verified assessment view after preparation; this prevents a delayed handoff from replacing the first reveal click on a resumed attempt.

If saving game progress fails after the actual recall grade succeeded, the pending checkpoint remains. The primary action becomes **Apply saved self-assessment**; the explicit **Apply saved assessment** recovery button is also available. Both recheck source access and consume the persisted grade without grading again. This survives closing/reloading the browser. Consumed attempt IDs prevent duplicate advancement or life consumption across checkpoints and runs.

## Architecture and persistence

- `src/quest/advanced/model.js`: campaign-backed deterministic plans, canonical units, source/segmentation pins, verified similarity candidates, FSRS-aware selectors and read-only summaries.
- `src/quest/advanced/store.js`: versioned `ayah-quest-revision-v1` companion campaign state, per-profile owner guards, transactional read/validate/write/readback, game charges, camp state, receipts and resume.
- `src/quest/advanced/ui.js`, `revision.css`: distinct tower/trail surfaces, shared transitions/accessibility/audio lifecycle, native recall handoff, source checks, responsive keyboard/touch controls.
- `src/passage/memory.js` and `src/passage/ui.js`: atomic initial assistance, supported-attempt tracking and the single coach-review preparation handoff; existing scheduler settings and grading rules are unchanged.
- `src/billing/ui.js` and `src/quest/registry.js`: developer-menu entry points and existing campaign availability.
- Existing Quest campaign identities, source hashing, native recall APIs, profile isolation, shared audio manager, motion transitions and accessibility scope are reused. This companion state holds mode-specific resources rather than changing legacy `ayah-quest-campaigns-v1` contracts.
- Plans store references, hashes and checkpoint definitions, never duplicate Quran text/audio or FSRS cards. Loaded content and media stay ephemeral.
- Private downloads and audio retain existing server authorization/integrity checks. Each checkpoint is reauthorized and compared with saved source/segmentation pins before text, audio or recall launch. Changed reviewed units fail closed; old records stay available for recovery/export.
- No new segmentation boundaries are made. Whole ayahs/passages and current reviewed units use the existing canonical `recallUnit` model. Long text previews are visual workspaces, not approved waqf guidance.
- The new key does not modify old progress, XP, Quest runs, puzzle history or FSRS documents. Malformed/future revision data is preserved and exportable, not silently reset.
- Runs resume in this browser/profile; no new cross-device merge protocol is introduced. Existing account/recall sync behavior remains unchanged.
- Close, source changes, quest-surface switches, account/developer changes and page exit stop audio and invalidate late loads. Focus restoration/trapping, touch-sized controls, volume, explicit stop, keyboard operation and reduced motion are supported.

## Rewards

Actual recall retains the native bounded reward path. Discrimination uses the existing study reward store with a deterministic checkpoint receipt and normal per-unit/day limits. Replaying a plan does not repeat the same discrimination receipt. Victory/restoration effects are cosmetic and grant no mastery. A failed XP/game-state split write can be retried with the same idempotent receipt.

## Testing and screenshots

`tests/advanced-model.spec.js` and `tests/advanced-ui.spec.js` cover plans, presets, selection, gate/life policies, assistance, no fake FSRS updates, duplicate attempts, failed saves/reload, camps, no absence penalty, source changes, private denial, stale loads, accounts, recovery, volume, mobile touch/keyboard and reduced motion.

Run Vite on port 5196, then `node scripts/advanced-revision-screenshots.mjs` (or set `ADVANCED_PREVIEW_URL`). Screenshots use local QA records made through the actual existing grader; no demo history is shipped in production modules.

- [Desktop Boss gates](advanced-revision-previews/desktop-boss-gates.png)
- [Desktop Boss discrimination](advanced-revision-previews/desktop-boss-discrimination.png)
- [Mobile Boss gates](advanced-revision-previews/mobile-boss-gates.png)
- [Mobile Boss discrimination](advanced-revision-previews/mobile-boss-discrimination.png)
- [Desktop Survival trail](advanced-revision-previews/desktop-survival-trail.png)
- [Desktop campsite](advanced-revision-previews/desktop-survival-camp.png)
- [Mobile Survival trail](advanced-revision-previews/mobile-survival-trail.png)
- [Mobile campsite](advanced-revision-previews/mobile-survival-camp.png)

No new Supabase migration is needed. Hosted private-source deployment and physical iOS/Android audio/device QA remain separate from local automated browser checks.

## Validation — 2026-11-01

- Complete Playwright suite: **394 passed** (including **25 new mode tests: 12 model and 13 browser**).
- Focused native recall/Quest/Expedition/Rescue/Repair regression run: **77 passed**.
- Existing content, billing, recitation and coach backend suites: **23 passed**.
- `npm run build` and `git diff --check`: passed.
- Eight desktop/mobile QA screenshots captured; gate, discrimination, trail and campsite layouts reviewed.

The full-suite run includes the repeated authentic-wording discrimination regression, delayed native preparation, resumed declared assistance, atomic initial support flags, primary saved-grade recovery after reload, mobile focus and account isolation. The final successful full run completed with no retries or timeout increases.

Physical-device audio testing, hosted private-source availability and cross-device merging of the new local journey state remain outside these local results. Existing account and recall sync behavior is preserved. There are no new secrets, migrations, AI calls or backend billing changes.
