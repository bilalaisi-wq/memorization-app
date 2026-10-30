# Shared Quest framework (Phase 2)

**Phase 3 update:** Passage Expedition now has a playable [edition-2 constellation UI](passage-expedition.md). This document records the original Phase 2 contracts; legacy routes remain compatible. The other four campaigns still have framework definitions only.


This is a reusable adventure foundation, **not the complete campaign UI**. There
are no new learner menu entries or advertised finished campaigns. Vanilla JS and
Vite remain in place. `loadQuestFramework()` in `src/passage/ui.js` is a lazy
integration seam; importing it never opens a campaign or changes existing progress.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/quest/registry.js` | Permanent identities and ordered activity policies for Passage Expedition, Constellation Rescue, Memory Repair Workshop, Muraja’ah Boss Rush and Hifz Survival. Status is `framework`, not a finished experience. |
| `checkpoints.js` | Canonical references, exact-source fingerprints, segmentation revisions, bounded visual workspace definitions and explicit reviewed recall-unit validation. |
| `map.js` | Deterministic ordered route IDs, locked/available/complete map projections, next checkpoint and authorized resume. |
| `store.js` | Separate version-1 guest/account campaign document, verified writes, recovery/export and idempotent completion. |
| `host.js` | Actual arcade registry/launcher integration, authoritative content loading, generation/identity guards, media ownership and existing recall handoff. |
| `practice.js` | Working keyboard/touch word assembly fallback, bounded by existing Passage Builder windows; all windows must succeed before an arcade fallback completes. |
| `revision.js` | Read-only due/weak selectors and existing self-assessed recall-evidence lookup. No scheduler. |
| `transitions.js`, `accessibility.js`, `quest.css` | Owned/cancellable transitions, reduced motion, status announcements, native keyboard/touch controls and scoped layout. |
| `rewards.js` | Existing capped arcade recorder and passage practice receipts; cosmetic unlock projections, never mastery. |

## Checkpoint contract

Maps are derived from **already verified bundles**. In production, obtain them
with `loadBundle(reference, client)`; do not build a premium text cache or treat a
campaign's saved references as an entitlement. Maximum ten distinct ayahs per map.
References use canonical `surah:ayah` strings (e.g. `7:172`, not `007:0172`). Routes
sort by surah/ayah; nonconsecutive chosen references remain explicit.

```js
{
  version: 1,
  id: 'quest:<sha256>',
  campaignId: 'passage-expedition',
  key: '1:1',
  sourceHash: '<sha256 of exact source and source revision>',
  segmentHash: '<sha256 of reviewed metadata and visual ranges>',
  type: 'study', // study | arcade | recall
  game: null,    // available arcade ID for arcade checkpoints, otherwise null
  workspace: { page: 0, firstWord: 1, lastWord: 4 }, // 1-based inclusive
  recall: null  // existing recallUnit definition only for recall checkpoints
}
```

- `study` uses the existing `wordWindow()` ranges: at most twelve movable words.
  It is **not** a recitation unit or waqf permission. Reference, listening and
  word assembly are study assistance, never independent recall.
- `arcade` is a complete-ayah activity using the actual existing registry,
  launcher and engine. Only registry metadata with `status: available` can be
  launched (currently `maze`, `snake`, `asteroids`). `sirat`, `bubble`, `bridge`,
  unknown IDs or unavailable registrations use practice. No planned engine is
  instantiated. Beginner/gentle, single-ayah Practice rules are the initial host
  defaults; campaign-specific mechanics and difficulty design are later work.
- `recall` hands off to the existing Passage Builder self-assessment. Defaults
  to full-ayah recitation. An optional `units: { 'surah:ayah': 'reviewed-segment-id' }`
  must identify a **current reviewed recitation unit** from the verified bundle;
  a visual page, draft boundary or rejected review is never accepted. Existing
  `recallUnit()` revision hashes remain authoritative. Separate audio-timing
  approval is still required by the existing studio before clipped playback.

The checkpoint digest covers its complete definition. The map digest covers the
ordered checkpoint digests. Source or segmentation revisions generate a new map;
old runs and receipts remain preserved. Reload the verified bundles to regenerate
the same map/IDs, then find the next incomplete checkpoint. If a previously chosen
reviewed segment no longer exists, resume fails explicitly rather than silently
converting it to a different recall unit.

## Persistence and result contracts

New key: `ayah-quest-campaigns-v1`, or
`ayah-user:<user-id>:ayah-quest-campaigns-v1` for authenticated accounts.
The document contains only version/owner, campaign and checkpoint IDs, chosen
references/game/unit IDs, source/review hashes, start/completion dates, safe result
counts and cosmetic unlock IDs. **No Arabic, translation, word bank, transcript,
media URL, access token or copied FSRS card is persisted.** Engine snapshots can
contain Arabic in memory; never serialize them as quest documents.

`createQuestStore({owner, getOwner, storage?, clock?})` exposes:

- `open(map)` creates/returns the run without resetting another run.
- `start(map, checkpoint)` starts the next unlocked checkpoint; repeated starts
  preserve its original timestamp.
- `complete(map, checkpoint, result)` records one completion/unlock. Repeats return
  the existing receipt with `duplicate: true`.
- `snapshot()` returns a fresh validated copy, `exportRaw()` preserves a recovery
  copy, and `warning` explains corrupt/unsupported data. Corrupt/future versions
  block writes; they are never silently erased or migrated.

Safe `result` fields are `xp`, `evidence` (`practice`, `arcade`, `self-assessed`),
`mistakes`, `motorErrors` and `assistance` counts. The store adds `at`. Store
completion is a persistence primitive, **not proof of religious/recitation
accuracy**; consumers must use the activity host for evidence/reward integration.
Local records are user-controlled and are not a security authority for paid
content or billing.

Resume is at the **checkpoint boundary**: completed activities survive reload;
an unfinished arcade or fallback activity restarts that checkpoint. Internal
ship/grid positions are not persisted. Existing Passage Builder drafts and
`ayah-passage-recall-v1` history retain their existing independent recovery/sync
behavior. Quest runs are local per account/device; cross-device campaign sync and
concurrent-device merging are not implemented in this phase.

## Host lifecycle

`createQuestHost({root, map, store, owner, getOwner, storage, learning, lab, client})`
uses the caller's **existing account-bound learning and Puzzle Lab stores**.
Do not construct a second scheduler. `storage` defaults to the same owner scope as
the campaign store. Pass the current Supabase client for private requests.

- `await launch(checkpointId)` rechecks content authorization, exact source and
  segmentation revisions, disposes the prior activity/media and starts the new
  one. A completed arcade may be replayed without another award. Denied content
  is an error, never a reason to render premium text through a fallback.
- `pause()`, `resume()`, `dispatch(action)`, `getSnapshot()` delegate to the mounted
  engine. Practice engines expose the same start/pause/resume/dispatch/snapshot/
  dispose shape as existing arcade engines.
- `confirmRecall()` reads the existing learning and passage histories. A
  successful **independent self-assessment** (Hard/Good/Easy) must have an attempt
  ID and timestamp since the checkpoint started. Listening assistance, Again,
  old attempts, puzzle wins and AI transcription cannot satisfy it. The check
  does not grade, reschedule, grant mastery or give a second recall XP award.
- `dispose()` is idempotent: removes engines, audio resources, animations and
  owned listeners. The parent must call it when unmounting. Account changes,
  developer-mode changes and page exit also dispose automatically; hidden pages
  pause. Superseded async content/media cannot mount into a later activity.

Optional `onRecall(unit)` is an integration handoff, not a grading callback. By
default the existing independent-recall studio opens. Actual success still comes
from its persisted self-assessment. Game study/recall buttons also reuse the
existing studio. Optional `volume()` / `muted()` hooks let a future shell provide controls; the default volume reads the existing saved Puzzle Lab level. Native buttons work with Enter/Space and touch; engine-specific
keyboard/pointer controls remain the existing ones. Reduced motion suppresses
quest transitions and is passed through the engines' existing motion handling.

## Rewards, integrity and authorization

- Arcade completion uses `createResultRecorder()` unchanged: existing per-ayah/
  game/day caps, account guards, learning receipts and Lab metadata apply. No
  arcade victory changes an FSRS card or memorization stage.
- Fallback practice shares the existing `passage` / `completion` reward bucket
  and daily limits. The only shared reward-store extension is an optional stable
  quest receipt ID; old event IDs, schema and award callers remain compatible.
- XP is committed **before** final quest completion with deterministic IDs.
  Retrying after a split-write failure reuses the reward receipt, then commits
  the checkpoint. It cannot add a second award. Stored checkpoint XP is the
  receipt amount, not a separate wallet; never sum quest records into XP totals.
- Recall rewards and FSRS updates happen only through the original recall flow.
- `visualUnlocks()` returns cosmetic activity tokens labeled explicitly as
  activity completion, not verified memorization or retained mastery.
- `selectRevision()` reads existing due dates and mistakes, filtered by the
  caller's currently authorized references. When the same unit exists in both stores, the earliest due date and strongest weak-memory signal take priority. It never changes workload dates or
  invents learner history.
- Premium text/audio still use authenticated `quran-content`; server entitlements,
  reviewer/developer roles, source hashes and private/no-store responses remain
  unchanged. Quest flags, saved map IDs or chosen campaign cannot grant access.
  Only already authorized current content plus existing free text supplies
  arcade distractors. Audio is requested for the active ayah; failed playback
  never adds a memory strike. No new Supabase schema or Edge Function is required.

## Minimal integration (no campaign screen)

```js
const q = await loadQuestFramework();
const bundles = await Promise.all(refs.map(key => loadBundle(key, client)));
const map = await q.createCampaignMap({
  campaignId: 'passage-expedition', bundles, game: 'maze',
});
const store = q.createQuestStore({ owner, getOwner });
const run = store.open(map);
const host = q.createQuestHost({
  root, map, store, owner, getOwner, learning, lab, client,
});
const next = q.nextCheckpoint(map, run);
if (next) await host.launch(next.id);
// Parent unmount/account navigation:
host.dispose();
```

After reload, use `resumeCampaignMap({store, runId, client})`. Inspect `changed`
before presenting a revised route to the learner; previous progress remains
available in the old run. Callers must handle authorization/recovery errors and
must not store the returned verified bundles in the campaign document.

## Verification

`tests/quest-model.spec.js` covers deterministic routes, source/review revisions,
reviewed-unit validation, metadata-only storage, locking/resume/recovery, failed
writes, account guards, planned games, read-only revision selectors, caps,
duplicate/split-write reward receipts and FSRS non-interference.

`tests/quest-ui.spec.js` is a **test-only consumer**, not a shipped campaign screen.
It exercises real Maze victory, fallback practice, the existing recall/FSRS flow,
reload, keyboard/touch/reduced motion, owner isolation, source/authorization
failures and late media cleanup. Existing arcade/Passage Builder/browser tests
remain required. Run:

```sh
npx playwright test tests/quest-model.spec.js tests/quest-ui.spec.js --workers=2
npm test -- --workers=2
npm run build
```

Hosted authorization and physical-device audio still need deployment/device QA;
local tests and a successful build do not certify hosted or religious accuracy.

## Completed validation

- 18 new quest model/browser tests passed in the focused run.
- The targeted quest, Passage Builder, teacher-review and reward regression run
  passed 43 tests before the final two additional quest cases were added.
- Full existing suite: **306 passed**, with two initial 30-second timeouts in
  existing account signup and theme tests (one during page creation). Both
  timed-out tests then **passed on a single-worker rerun without code changes**.
  All 308 tests have therefore passed across these runs; the full run was not
  a clean single-pass run. The timeouts are retained here rather than hidden by
  a timeout increase or test modification.
- Existing backend suites: content 6, billing 7, recitation 5 and coach 5 passed
  (23 total).
- `npm run build` passed and includes the lazy quest module in production output.
- `git diff --check` passed. No hosted deployment, remote account administration,
  new content import, production recitation-stop approval or real-device QA was
  performed by this phase.
