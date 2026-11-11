# Ayah Quest 3.0 Phase 1: shared passage context

## Audit and scope

The application remains Vite/vanilla JavaScript. `main.js` owns lab navigation;
`passage/ui.js` owns the established Passage Builder, workspace drafts and passage
self-assessment; `passage/memory.js` owns its existing FSRS workflow. Arcade
content/registry/services and the Quest activity host already provide verified
word adapters, lifecycle management and capped, idempotent practice rewards.
`learning-store.js` continues to own short-ayah learning records. Neither store
is migrated or replaced by this phase.

Private bundles and whole-ayah audio already come from authenticated
`quran-content`. Its server-side entitlement and developer policies, Storage
restrictions, source checks and RLS remain authoritative. Catalog metadata is
public; private Arabic and recordings are not added to frontend assets. Existing
Cosmic mission/gateway/link-content modules explicitly support free content only;
this phase retains that policy rather than claiming a premium Cosmic engine.

## User flow

Open **Selected passage** in any learning lab. Choose a first ayah and a last
ayah number (or full `surah:ayah` reference for a cross-surah range), then select
**Use passage in all labs**. The selected range and current ayah follow the
Memorization, Puzzle and Revision navigation. Every selection is loaded through
the existing authorized content loader. Unreleased catalog entries cannot open.

The Memorization Lab mounts the existing Passage Builder inline. Puzzle and
Revision offer bounded canonical-word activities and existing self-assessment.
Bridge uses adjacent ayahs from the selected same-surah range. Revision offers
the existing Cosmic route only for supported free, same-surah selections.
**Use regular ayah browsing** returns to the original native lab experience.
The original modal Passage Builder remains available, including its saved draft
recovery. Its selected range can also be shared into the labs.

## Contract

`src/passage-context/model.js` supplies canonical forward range validation
(1–300 ayahs, including cross-surah ranges), exact source views and SHA-256
source/review fingerprints. The serializable descriptor is:

```js
{
  version: 1,
  refs: ['1:2', '1:3'],
  active: '1:3',
  lab: 'memorization', // or puzzle, revision
  fingerprints: {
    '1:2': {source: '<sha256>', review: '<sha256>'},
    '1:3': {source: '<sha256>', review: '<sha256>'}
  }
}
```

No descriptor contains Arabic, audio URLs, an entitlement, or a recall result.
Source fingerprints include original text, translation, citations, source word
positions and source revision. Review fingerprints include segmentation and its
review metadata. A changed fingerprint blocks resume without overwriting the
old selection or workspace drafts.

`createPassageSession()` in `session.js` provides:

- `open(refs, {active, lab, restore})`, `restore()`, `saved()` and `descriptor()`;
- `navigate(lab, active)`, retaining the selected canonical range;
- guarded `bundle(key)`, `view(kind, key, options)` and `audio(key)`;
- `assertBundle(freshBundle)` before activity launches;
- `own(disposer)`, `invalidate(reason)`, `clear()` and `dispose()`.

Authorization occurs in `open`, using `content/library.js`, never by trusting the
saved descriptor. `has()` reports only a live account-owned handle. Superseded
requests cannot reactivate an old selection. Resources and consumers are disposed
when the context expires. Do not retain a returned bundle after disposal.

### Content views

| View | Meaning |
| --- | --- |
| `words` | Exact source words with zero-based canonical IDs and original one-based positions |
| `groups` | Existing adaptive visual groups, with original source ranges |
| `workspaces` | Existing bounded visual word windows |
| `study-segments` | Only published, source-matched reviewed study partitions |
| `ayah` | Complete original ayah, translation and citations |
| `transitions` | N−1 adjacent canonical boundaries, with ending/opening source words |

Visual grouping never grants stop approval. Reviewed study partitions, stop
approval and restart approval are separate fields. A legacy combined stop review
is not silently promoted to independently approved restart guidance. Whole-ayah
audio remains whole-ayah audio; no new cropped or stitched recordings are made.

## Compatibility and integration

`compatibility.js` centralizes explanatory availability/fallback decisions. The
arcade registry accepts optional `options.passageContext`; existing callers
remain compatible. Existing engine constraints still apply.

| Activity | Shared selection support |
| --- | --- |
| Existing supported practice/self-assessment | Any available authorized ayah; range retained while browsing |
| Blocks, Space, Serpent, Maze, Bubble, Sirat | Bounded canonical-word workspace; full-ayah audio |
| Bridge | Same-surah adjacent-ayah chain, existing engine range limits |
| Cosmic Rush | Existing free-content same-surah missions only |
| Chronicles | Reserved contract; unavailable until implemented |

Cross-surah selections are valid context data, but engines that require a single
surah receive a clear compatibility response. Large ranges remain bounded at
activity launch. Visual groups cannot be passed as approved phrase units.

### Changed existing interfaces

- `passage/ui.js`: optional `inlineRoot`, `initialRefs`,
  `onReferenceSelected(key)`, `onPassageSelection(refs)` and optional
  `own(disposer)` for context-owned dialogs; legacy modal API and
  saved workspace format remain intact.
- `revision/ui.js`: optional `selectedPassage` and `onMissionSelection`; native
  Cosmic selections only synchronize when opened through a shared context.
- `passage/practice-plan.js`: adds already implemented Bubble and Sirat choices.
- `passage/games.js`, arcade content/registry and `quest/host.js`: reuse existing
  game contracts, enforce compatibility and private audio lifecycle. Private
  words never fall back to public word clips.
- `content/library.js`: rejects in-flight private responses after an account
  change; private `freeAudio` fields cannot bypass authorized audio loading.
- `billing/client.js`: emits an access-change event after a verified entitlement
  response changes, without granting access through the event.
- `learner/profile-storage.js`: account revision guard and selection backup key.
- `main.js`: shared navigation, mounting, reauthorization and disposal.

## Persistence and authorization

Only `ayah-passage-context-v1` is added. Authenticated storage uses the existing
`ayah-user:<id>:` namespace; guest selection uses the legacy guest namespace.
Schema/fingerprint validation is explicit. Invalid/future records remain raw
and exportable through **Export selection metadata**. Existing progress,
workspace orders, practice receipts, review history and recovery formats remain
unchanged. Selection metadata is included in account exports, but is browser-local
and is not a new cloud-sync dataset. No SQL migration or new RLS policy is needed.

Sign-out/account changes invalidate the handle. Verified billing changes and
401/403 content denials purge active private consumers. Private contexts are
invalidated while the tab is hidden and reauthorized on return. Focus and a
60-second authorization probe detect externally changed access while a visible
session remains open; this is bounded polling, not an instantaneous server push.
A failed/missing recording does not by itself erase authorized text. Free content
continues to work without billing availability.

No practice victory creates independent recall or modifies FSRS. Existing
self-assessed Again/Hard/Good/Easy workflows remain the only assessment route
used here. No additional scheduler, reward ledger, or duplicate XP path is added.

## Phase 2 / Chronicles handoff

Consume a live session and its canonical views; do not read text from selection
storage. Declare required source units and call centralized compatibility before
launch. Register only a functioning activity, revalidate source fingerprints,
and register all media/listener cleanup with `own()`. Future comprehension
material must have its own verified citations and permissions; this phase adds
no generated religious explanations or comprehension results.

## Validation

`tests/passage-context-model.spec.js` covers canonical/source integrity, reviewed
versus visual boundaries, strict persistence, stale revisions, account races,
resource disposal, compatibility and forged private audio URLs.
`tests/passage-context-ui.spec.js` covers free/private common surfaces, lab
navigation, reload, existing game launches, denied access, account changes,
verified downgrades and recovery. The existing Passage Builder, segmentation,
arcade, account and learning regression suites remain part of release checks.

### Completed validation (2026-11-07)

- Full regression suite: `npx playwright test --config=playwright.regression.config.js --workers=3` — **708 passed**, no failures (11.3 minutes).
- Focused cleanup/context rerun — **54 passed** before the final complete run.
- `npm run test:content` — **6 passed**; `npm run test:billing` — **7 passed**.
- `npm run test:recitation` and `npm run test:coach` — **5 passed each**.
- `npm run check:content`, `npm run check:billing`, `npm run build` and `git diff --check` passed.
- Rendered desktop (1440px) and mobile (390px) free-passage screenshots inspected. The inline workspace uses page scrolling, keeps Arabic pieces visible, and has no horizontal overflow at 390px.

The full audit caught and fixed an inherited modal height limit, an unscoped old
results-panel test locator, inactive-session interference with legacy account
cleanup, and missing denial feedback after activity disposal. Private asset
requests remain backed by existing server policies; these automated tests do not
claim a new live Supabase deployment or live paid-content certification.

## Revision missions

[Memory Rescue and Long-Surah Marathon](revision-missions.md) use the same authorized selection in Revision Lab. The original free-only Cosmic Rush mission policy remains unchanged; premium marathon stages use authenticated source adapters and reauthorize on resume. See that guide for checkpoint, assessment and local/export persistence contracts.

Phase 4 integration and precise engine limits are documented in [shared full-Qur’an labs](full-quran-phase4-labs.md). Selected free and authorized private sources use the same bounded lab surfaces; staged Revision campaigns can span canonical chapter/juz ranges without inventing cross-chapter Ayah Link pairs.
