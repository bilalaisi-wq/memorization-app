# Ayah Quest 3.0 Phase 6 — unified rescue and marathon revision

## Open and use

Open **Revision Lab → Memory Rescue & Long-Surah Marathon**. Cosmic Rush stays in the same lab and its original mission controls remain available. For a passage already selected across labs, use **Memory Rescue & Marathon · selected passage** in Revision Lab. There is no separate premium revision interface.

The marathon offers 5, 10, 15, 20 or 30 ayahs, a custom forward range, or an entire currently published surah. Presets clamp to the available remainder of a shorter surah. The shared selection can also start a marathon. A marathon stays within one surah; a cross-surah shared selection is rejected with an explanation rather than inventing an ayah boundary. The original free Cosmic Rush planner also offers 30 ayahs and remains restricted to Al-Fatihah/Juz Amma.

Only fully published chapters appear in the marathon chapter list. Metadata availability does not grant access: every private bundle/audio request still uses the authenticated backend. The server's existing developer-only preview restrictions remain in effect. Selecting a chapter does not imply that unpublished content is available to paid accounts.

## What a stage does

Stages contain at most five ayahs. Each has these checkpoints:

1. Full-ayah study audio, with encouragement to repeat aloud. Listening does not earn a recall grade.
2. A real bounded arcade activity: Ayah Serpent, Ayah Space, Memory Maze, Ayah Blocks, Bubble Burst or Sirat Quest. The existing passage host performs content compatibility checks, source grouping and result recording. No new static quiz replaces these engines.
3. An offered reduced-assistance repetition. Movement remains relaxed; memory settings change from guided to standard. Learners may proceed to recall without repeating the game. Advancing this optional step does not assert that a game or recitation was completed.
4. Upgraded **Ayah Link — Restore Both Boundary Pieces**, when an actual adjacent pair exists. The second and later stages include the preceding stage's last ayah, so seam transitions are not omitted. A single first ayah never invents a boundary.
5. Existing independent self-assessment: hidden text, recitation, reveal/compare, Again/Hard/Good/Easy. Any honest grade permits continuation. Assisted results remain assisted.
6. A stage summary showing references, boundary count, actual grade, independence and next review date. Learners can leave, resume, replay a game or continue.

Completed checkpoints stay completed. Interrupted game physics are not simulated offline: the existing arcade host resumes its saved bounded content stages, restarting an unfinished engine workspace where that engine does not persist its live physics. The campaign does not claim full-surah mastery on completion. Whole-surah campaigns use manageable stage recall rather than demanding one 286-ayah recitation.

## Rescue evidence and selection

`rescueRecommendations` is a transparent read-only projection of existing records:

| Source | What can be recommended | What it does not establish |
| --- | --- | --- |
| Puzzle Lab mistake with expected/selected source IDs | Word selection/order or phrase-continuation practice | Spoken recall or pronunciation accuracy |
| Cosmic Link adjacent-pair choice errors or explicit difficult recall | Boundary-connection repair using upgraded Ayah Link | A precise weakness elsewhere in the surah |
| Protect and Capture committed wrong-carrier records | Full-ayah recognition practice | Motor mistakes or speech errors |
| Explicit Again/Hard self-assessments | Supported revision followed by a fresh assessment | Teacher certification |
| Stored FSRS due date | Scheduled revision | Proof of forgetting or a penalty for a missed day |

Recommendations display their reason and evidence sources. Repeated observed Link responses are grouped by actual canonical pair, with their evidence IDs retained. Old aggregate errors without precise source IDs, motor events, hint-only activity and uncertain transcription do not become precise word diagnoses. An empty history shows an empty-state explanation, not invented weaknesses. At most 50 suggestions are displayed at once.

For transition rescue, upgraded Ayah Link itself is the corrective activity. Its optional repetition conceals the boundary immediately for fewer visual cues, then offers native recall; it does not send a transition problem through an unrelated word game first. Source/review fingerprints and original transition revision hashes are checked before evidence is reused. Unsupported or stale records stay available for recovery.

## Scheduling and reward integrity

There is no new scheduler and no changed FSRS parameter. `src/passage/memory.js` remains the scheduling authority for passage/reviewed-segment units. Older short-ayah recommendations return to the original `createLearningStore` + `mountRecall` assessment workflow, preserving their original card instead of silently creating a second passage card. Native recall UI now exposes an optional saved-assessment callback and a disposer; existing callers retain their behavior.

A native grade saves before its campaign checkpoint is acknowledged. If the campaign write fails, the original grade is retained. On reopening, the campaign compares the recorded assessment unit/history against its pending attempt baseline and offers recovery of the actual saved grade. It does not submit a replacement grade, infer Good from a victory, require Good/Easy to continue, or roll back a review because a later stage failed.

Arcade rewards continue through the existing result recorder, per-ayah/day caps and idempotent receipts. Repeating a campaign checkpoint does not grant a second checkpoint award. Campaign navigation and listening do not mint additional XP. Recognition, motor outcomes and actual independent self-assessments remain distinct.

## Contracts and persistence

- `src/revision/missions/model.js`: canonical range validation; deterministic plan identity; bounded stages and seam coverage; read-only evidence projection.
- `src/revision/missions/store.js`: schema-1 `ayah-revision-missions-v1` with source/review pins, ordered checkpoint receipts, assessment acknowledgements and pending-attempt baselines. Unknown/malformed data is preserved, not reset.
- `src/revision/missions/ui.js`: existing-lab launcher, source authorization, study audio, real arcade and upgraded Link hosting, native assessment handoff and lifecycle cleanup.
- `src/revision/ui.js`: regular lab entry and original free planner's 30-ayah option.
- `src/passage-context/ui.js`: authorized shared-passage entry.
- `src/learner/profile-storage.js`: account-scoped export/recovery coverage.

Plan identity is a SHA-256 of the versioned reference/configuration/evidence contract. Stage IDs append their index, and checkpoint IDs append the phase. Records contain references, hashes, IDs, settings, reasons and grading metadata, never private Quran text/audio or authentication tokens. Source/review changes block resume without replacing the original records. The full authorized Uthmani bundles live only in the current bounded activity.

Campaign checkpoints are **local and account-scoped**. They are included in **My account → Download device progress**. They are not a new cloud dataset. Existing authenticated learning, passage review and Cosmic cloud synchronization remain unchanged; signing out/in on the same browser restores that account's local marathon, while a different device does not automatically acquire the new marathon checkpoint metadata. No database migration or additional Supabase deployment is required.

## Authorization, media and accessibility

Every resumed stage reloads its authorized source before providing activities. Private study and recall screens also revalidate on focus and periodically during use. The existing arcade/Link hosts retain their own access checks. Entitlement revocation, account change, navigation, source mismatch and disposal stop media and remove active private source objects. Rendering never waits on a campaign database write.

Audio uses full verified ayah recordings; grouped visual workspaces are not waqf approval and no phrase audio is synthesized or cropped at unreviewed boundaries. Study replay releases previous resources and ignores stale audio responses. Audio failure is not a memory strike.

Navigation uses ordinary large buttons, keyboard-accessible forms, focused stage headings and existing touch controls. The scoped navy/violet panel works with the current theme. Reduced motion disables decorative transitions; no recitation deadline is introduced. Inspected screenshots: [desktop](screenshots/revision-missions/desktop.png), [390px mobile](screenshots/revision-missions/mobile-390.png).

## Validation

`tests/revision6.spec.js` and `tests/revision6-ui.spec.js` cover range validity, 286-ayah stage/seam coverage, evidence distinctions, idempotent receipts, source pinning, invalid-state recovery, account isolation, actual Snake and upgraded Link interaction, native Again continuation, the original short-ayah scheduler, failed acknowledgement recovery, private denial/downgrade and changed source revisions.

The complete application regression suite and production build are required before publishing. Browser premium tests use authenticated fixtures and simulated recitation audio. Live Supabase policies, device audio/autoplay behavior and cross-device review sync still require deployment checks; these tests do not certify live service configuration.

### Release evidence

- `npx playwright test --workers=3 --config=playwright.regression.config.js`: **866 passed**, 8.2 minutes, no failures or retries.
- New Phase 6 coverage: **17 tests**, including actual Snake completion, upgraded Link connection/reduced-cue replay, native assessment routing and failed-acknowledgement recovery.
- Backend suites: billing 7, content authorization 6, recitation 5, coach 5 — **23 passed**.
- `npm run build`: passed.
- Desktop and 390px mobile screenshots inspected; no horizontal viewport overflow in the mobile journey.

Deployment: manually deploy the latest `main` frontend on Railway. No SQL migration or new backend secrets are required. The new marathon checkpoint dataset does not automatically sync between devices; existing cloud-backed learning and review records retain their established synchronization controls.
