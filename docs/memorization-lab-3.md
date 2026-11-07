# Memorization Lab 3.0 — Phase 2

## Entry points and preserved modes

The familiar Memorization Lab keeps Practice, Puzzle Quest, Active Recall and
Ayah Chain. **Adaptive groups & cumulative practice** opens the existing passage
workspace inline, alongside those mode tabs, rather than sending the learner to
a separate premium interface. Switching modes closes the inline study surface
and its audio. Independent self-assessment also conceals the parent reference
text and translation; returning to supported study restores them. Closing an
unfinished attempt to expose the reference records assistance through the
existing study-exposure guard before it can resume. The original full-ayah listening button delegates to the active
inline workspace when it is open.

Phase 1 selected passages use the same enhanced workspace. Existing free ayahs
also offer links back into their classic modes without clearing the selected
range or current canonical reference. Authorized long passages retain the
existing source-backed studio practice, reconstruction, passage chain and
self-assessment workflows; unsupported native activities are not fabricated.

## Adaptive visual groups (M1)

The automatic baseline is unchanged: 1–12 source words use one word per piece,
13–24 use two, 25–36 use three, and 37+ use up to five. Each active workspace has
at most twelve pieces. Learners can instead choose one, two, three, four or five
words per piece. The final piece may be shorter. Previous, Next and Jump controls
continue to use canonical source ranges.

`groupedWindow(bundle, page, segment, requestedSize?)` and
`restoreWorkspace(bundle, segment, saved, layout, requestedSize?)` retain their
old call signatures and defaults. The Phase 1 `groups` content view accepts an
optional `groupSize`. Every group retains its original one-based `positions`
array. Text is taken from original source words, including diacritics and stops;
there is no Quran re-import or generated Arabic.

Automatic grouped drafts retain the original `:grouped-v1` suffix; legacy word
windows retain their original keys. Explicit group sizes use separate
`:adaptive-v1:<size>` drafts. `groupSizes` stores per-ayah preferences in the
existing workspace envelope; invalid preferences trigger its recovery behavior.
Changing grouping does not erase earlier layouts or arrangements.

## Progressive expansion (M2)

`src/memorization/model.js` generates deterministic workspace rounds:

```
A → B → A+B → C → A+B+C → …
```

A section represents one bounded visual workspace. The completed-section rail
shows actual reconstruction results. Cumulative rounds revisit each participating
workspace in order through the section controls. Completed earlier sections are
represented in the rail, not expanded into hundreds of draggable words. Starting
expansion hides the ordinary workspace's interaction areas so only one board is
active. Returning restores the original workspace and its draft.

Each round saves its own original source-position arrangement. Tapping a piece
adds/removes it; earlier/later buttons reorder whole groups with keyboard or touch.
Repeated identical words remain interchangeable by exact displayed text, while
IDs remain unique and groups remain atomic. Completing a cumulative round requires
all its sections to reconstruct correctly. Once every round is complete, the
learner can launch complete-ayah independent self-assessment. Earlier rounds can
be repeated freely with **Practice this section again**. Restarting a draft keeps
its genuine earlier completion marker and does not grant another round reward.

Gold illuminated sections and constellation links are cosmetic practice feedback.
Reduced motion disables animation, and a local Skip progression effects control
is available. Completion does not grant memorization mastery.

## Reviewed memory anchors (M4)

No anchor corpus or newly reviewed tafsir was supplied for this phase. The app
therefore publishes no invented review approvals, tafsir, or depictions. Optional
anchors are accepted through the authorized bundle's `memoryAnchors` or a trusted
publisher's `openPassageStudio({anchors})` integration. The UI explains when no
reviewed anchor exists for the source revision.

Supported kinds: `vocabulary`, `meaning`, `visual` (reviewed mnemonic notes), and
`transition`. A publisher must provide:

```js
{
  id: 'publisher-stable-anchor-id',
  kind: 'vocabulary',
  reference: 'surah:ayah',
  sourceHash: 'exact-bundle-contentRevision',
  firstWord: 1,
  lastWord: 2,
  note: 'Reviewed study material supplied by the publisher',
  review: {
    status: 'approved',
    version: 1,
    reviewer: 'Actual reviewer attribution',
    date: 'YYYY-MM-DD'
  },
  sources: [{title: 'Actual source attribution', url: 'https://…'}]
}
```

Transition anchors additionally require a canonical adjacent `nextReference`,
including valid cross-surah boundaries. Draft/stale/missing-attribution anchors,
unknown kinds and out-of-bounds source positions do not appear. Approval metadata
must come from the trusted reviewed-content publication workflow, never an
untrusted learner upload. Private anchor material must travel through the existing
authenticated private-content delivery path, not public frontend assets.

Anchors are concealed until explicitly requested. Study reveals record anchor
ID, kind, review version and timestamp in the adaptive study record. Independent
recall clears study content and conceals all anchors. Explicitly choosing **Use
reviewed memory anchors** marks the actual recall attempt as assisted, even after
a declaration, and records the anchor IDs in its saved assessment. Such assistance
cannot schedule an independent successful FSRS review. Ordinary post-attempt text
comparison retains its established semantics.

This is the reviewed-material handoff for Qur'an Chronicles: source-matched,
attributed, versioned optional hints. No AI explanations, speech certification,
or new image-generation pipeline is introduced.

## Persistence, rewards and recall

`ayah-memorization-lab-v1` is a separate, versioned, account-scoped local store.
Its records include canonical reference, source/review fingerprints, group size,
current round/page, original-position orders, completed rounds and assistance
metadata. The key also includes the selected reviewed unit and group size. New
source/review revisions obtain distinct records; previous records remain intact.
Invalid/future state is preserved and read-only for recovery/export. Account
exports include the new key. This phase adds no database migration or new cloud
sync dataset.

Cumulative completion calls the existing `passage` / ayah / `completion` reward
bucket. It does not introduce per-round XP buckets, change daily caps, or create
new mastery receipts. Repeating a completed round awards no additional round XP.
The existing **16 actually earned XP** prompt and chosen-game gating remain.
Supported word study remains available, and any saved Again/Hard/Good/Easy
assessment can return the learner to study; a Good/Easy success is not required.

The existing passage memory engine and `ts-fsrs` remain authoritative. There is
no new scheduler. Only the existing self-assessed recitation flow can submit a
review. Puzzle reconstruction never submits an FSRS grade. Full-ayah audio stays
continuous across visual workspace changes; no synthetic phrase stitching or
unreviewed cropping is introduced. Source changes, exit and account changes keep
the existing audio disposal and authorization boundaries.

## Changed modules

- `src/memorization/model.js`: grouping/round helpers and reviewed-anchor policy.
- `src/memorization/store.js`: isolated, versioned adaptive practice persistence.
- `src/memorization/ui.js`, `ui.css`: bounded cumulative boards, rail, assistance,
  keyboard/touch controls, motion preferences and reviewed-anchor display.
- `src/memorization/native.js`: opt-in inline integration and listening lifecycle.
- `src/main.js`, `src/passage-context/ui.js`: preserved native navigation and shared
  selection integration.
- `src/passage/model.js`, `ui.js`: adjustable existing groups, separate draft keys,
  cumulative launch, optional `onAssessmentView(active)` host callback and existing
  self-assessment integration.
- `src/passage/memory.js`: explicit anchor assistance and assessment metadata.
- `src/passage-context/model.js`: optional visual group-size view parameter.
- `src/learner/profile-storage.js`: account-export coverage for adaptive records.

## Automated validation

`tests/memorization3-model.spec.js` covers baseline/custom sizes, partial groups,
original positions, repeated identical words, atomic restoration, round generation,
separate storage, invalid/future recovery, reviewed-anchor policy and assisted
recall eligibility.

`tests/memorization3-ui.spec.js` exercises the actual inline studio and classic
mode navigation, listening cleanup, the verified 128-word pilot, custom draft
reloads, 390px readability, cumulative A/B/AB/C/ABC reconstruction, persistence,
FSRS non-interference, Again continuation, repeat-XP prevention, parent-reference
concealment, unfinished-recall exposure tracking and concealed/explicit anchor usage.
Existing grouped-workspace, 16-XP prompt, XP-cap, recall, audio, account and
segmentation tests remain part of the full regression suite.

### Completed validation

- Full regression run: `npx playwright test --config=playwright.regression.config.js --workers=3` — **721 passed**, zero failures (17.6 minutes, including the workspace reconnection).
- After the final owner-scope guard, the memorization model/UI, grouped-workspace, account-auth and release-audit suites were rerun together — **41 passed**. This includes an additional test proving that closing an old profile's inline assessment cannot modify another profile's pending recall. This focused run validates the final ownership change; the earlier full-run total is not presented as a single 722-test batch.
- Backend suites: content **6**, billing **7**, recitation **5**, coach **5** — all **23 passed**.
- Content/billing Edge Function type checks, final `npm run build`, and `git diff --check` passed.
- Night Sky desktop and 390px mobile cumulative workspaces were captured and inspected using verified free 98:5. The mobile page has no horizontal overflow, the ordinary board/cue row is concealed during cumulative interaction, and Arabic pieces remain readable.

The final inline host guards the captured profile before recording restored
reference exposure, preventing a late cleanup callback from marking a different
account's recall as assisted. New adaptive progress is device-local and included
in account exports. No approved anchor corpus has been published by this change;
curated notes require actual review and attribution before appearing.
