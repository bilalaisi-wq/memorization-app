# Passage Builder stabilization audit

Scope: existing Vite/vanilla-JavaScript studio only. No Quest UI, Quran imports,
Arabic edits, changed stop approvals, subscription changes, or FSRS rule changes.

## Interaction audit and fixes

| Area | Reproduced defect | Repair / regression coverage |
| --- | --- | --- |
| Launch / reopen | Only passage membership was saved; the current ayah and selected reviewed unit were lost. | Add optional schema-1 current-reference/unit metadata; explicit Resume action restores its source/review-keyed page, hints, positions and reconstruction permutation. Older records remain valid. |
| Switching ayahs / units | Hint level leaked from an unrelated workspace when no draft existed. | Reset unsaved contexts to visible hints; restore the saved level when a compatible draft exists. |
| Damaged drafts | Structurally invalid page/order records could be rendered and overwritten. | Validate page bounds, exact page permutation, unique positions and per-page membership against current content; preserve the original raw document and show recovery guidance. Never infer missing words or repair Arabic. |
| Drag/drop | Dropping a built word onto a bank word inserted it into the build area. Dropping a piece onto itself could move it to the beginning. | Bank drops consistently return pieces; self-drop is a no-op. Keyboard/touch reordering remains available, with retained button focus and RTL-correct arrows. |
| Async content | Stop audio invalidated a pending content request. Older failed requests could redraw the wrong ayah. | Separate navigation, assessment-view and audio generations. Ignore superseded content results/errors. |
| Async recall | A delayed comparison/listen could affect a screen after returning to practice. Pre-declaration assistance could be misclassified if the learner declared before loading finished. | Guard the assessment view and record assistance when requested, before network work. Independent self-assessment, eligibility and scheduler rules remain unchanged. |
| Audio lifecycle | Return to practice could leave the reciter playing; an old playback rejection could stop newer playback. | Stop and release media on recall exit, content/unit switch, grading and dialog close; ignore superseded playback errors. Visual page changes deliberately preserve full-ayah audio. |
| Unavailable saved private content | Reopening could leave only a failing Resume action. | Provide an explicit free Al-Fatihah escape without deleting private draft or review records. |
| Small screens | Reorder arrows had small hit areas; long RTL tokens and excerpt cards could crowd controls. | Minimum 44px reorder targets, wrapping controls/tokens, bounded dialog width, sticky close/status, focus outlines and Night Sky styling. Validate at 320px and 390px. |

Audit also covered add/reset selected references, the ten-ayah limit, canonical
Passage Chain ordering, workspace and full reconstruction checks, all three hint
states, reference disclosure, reviewed-segment audio restrictions, assessment
resume/abandon/compare/grade, review schedule, export and revision-checked sync.

## Integrity and security preserved

- Exact Arabic remains sourced through the existing canonical bundles and slices.
- Visual phrases/pages remain study workspaces, not approved recitation stops.
- Only existing reviewed units can be selected; clipping still requires separate
  approved audio timings. No production approvals are added.
- `quran-content` still authenticates the user, checks authoritative entitlements
  or the explicit server developer/reviewer role, and verifies source/audio hashes.
- `billing-passages` still authorizes saved ranges server-side and scopes records
  to the authenticated account. No endpoint or RLS policy is relaxed.
- Workspace storage contains IDs/positions/settings only. Account storage scopes,
  independent recall history, FSRS eligibility, idempotent grading and reward caps
  are preserved. Old/corrupt data is not reset or silently migrated away.

## Validation and previews

Run the full Playwright suite and production build, plus the existing content,
billing, recitation and coach backend suites. The accompanying delivery records
actual results. Regression tests live in `tests/passage-model.spec.js` and
`tests/passage-ui.spec.js`; existing teacher-review tests run unchanged.

Recreate screenshots with `node scripts/passage-screenshots.mjs` against the local
Vite server (default port 5173; override `PASSAGE_PREVIEW_URL`). The previews use
mocked test entitlements and the existing 2:282 fixture; they do not demonstrate
hosted deployment or teacher approval.

- [Desktop](passage-previews/simple-desktop.jpg)
- [Mobile](passage-previews/simple-mobile.jpg)
- [Mobile word workspace](passage-previews/simple-workspace.jpg)
- [Night Sky desktop](passage-previews/night-desktop.jpg)
- [Night Sky mobile](passage-previews/night-mobile.jpg)
- [Night Sky word workspace](passage-previews/night-workspace.jpg)

## Remaining limitations

- Real hosted account/payment/content deployment and physical iOS/Android audio
  behavior need separate device/integration testing; automated tests use fixtures.
- No unreviewed internal stop or audio timing becomes approved through this work.
- Passage workspace drafts are local to the account/device; the existing optional
  review-history sync remains revision-checked and separate from workspace drafts.
- Corrupt drafts are preserved with recovery guidance, not automatically repaired.
- Large full-ayah reconstruction lists still require vertical scrolling; only the
  active word workspace is bounded. A redesigned Quest interface is out of scope.

## Changed files

- `src/passage/ui.js`: compatible current-context persistence, explicit resume/free
  fallback, navigation/audio/assessment lifecycle guards, immediate assistance
  tracking, corrected bank/self drops and keyboard focus.
- `src/passage/model.js`: pure, source-aware saved-workspace validation and cloning.
- `src/passage/passage.css`: narrow-screen layout, grouped piece controls,
  touch targets, focus visibility, sticky close/status and matching Night Sky colors.
- `tests/passage-model.spec.js`, `tests/passage-ui.spec.js`: draft/recovery,
  multi-page reconstruction, reviewed-unit restoration, account isolation,
  touch/keyboard/drop, request races and audio/assistance regressions.
- `scripts/passage-screenshots.mjs`: current developer presentation fixture,
  configurable local URL and populated workspace screenshots.
- `docs/passage-builder.md`, this audit and six `docs/passage-previews/*.jpg`:
  updated workflow, source-coverage facts, reproducible previews and limitations.

`src/passage/memory.js`, the original learning store, all Quran datasets, research
boundary data, backend authorization, database migrations and RLS remain unchanged.
No SQL migration or Edge Function deployment is needed for these frontend fixes.

## Completed verification

- `npm test -- --workers=2`: **290 passed**, including 14 added regressions
  and the unchanged segment-review tests (8.5 minutes).
- `npm run build`: production build passed.
- `npm run test:content`: 6 passed.
- `npm run test:billing`: 7 passed.
- `npm run test:recitation`: 5 passed.
- `npm run test:coach`: 5 passed.
- `npm run check:content`, `npm run check:billing`,
  `npm run check:recitation`, `npm run check:coach`: all passed.
- `node scripts/passage-screenshots.mjs`: all six previews regenerated;
  desktop Night Sky and mobile word-workspace captures visually inspected.
- `git diff --check`: passed. No hosted deployment or physical-device validation
  is implied by these local checks.
