# Constellation Rescue

A read-only revision sky over the existing `ayah-passage-recall-v1` records,
with direct handoff to the existing Passage Builder self-assessment. It does
not introduce another FSRS scheduler, copy cards into quest history, or turn
arcade progress into memory evidence.

## Open

Under the current advanced-feature visibility policy, enable **Developer mode →
Menu → Constellation Rescue**. The Classic Passage Builder header and completed
Passage Expedition also link here. Existing developer-menu visibility rules are
preserved; this release does not make private Quran sources publicly available.

## Stars and dates

A star requires both a saved passage card and at least one successful independent
Hard/Good/Easy history entry for that same unit. One whole ayah, reviewed portion,
or chosen multi-ayah passage is one unit/star. Main-learning cards, puzzle XP,
listening-only work, assisted-only history and an initial Again without previous
independent success do not manufacture passage stars. Empty accounts show a real
empty state, not seeded demonstrations. Older unsupported-source records remain
preserved and are reported separately.

States read `record.card.due` without changing it:

- **Upcoming:** the saved due instant is still in the future, even if later today.
- **Ready today:** the due instant has passed on the current local calendar day.
- **Waiting for review:** the due instant is on an earlier local calendar day.

The saved passage document's timezone is used for display/day classification,
with a UTC formatting fallback for invalid timezone metadata. Missing a day does
not add an Again, lapse, mistake, XP penalty or reset. Star brightness and location
are presentation only; neither diagnoses forgetting or estimates retention.

The map paginates at 24 stars. Keyboard arrows/Home/End move among visible stars;
Enter/Space and touch select them. Details show the exact saved next-review date,
latest recorded self-assessment and independent attempt count. The queue orders
currently due/waiting units by their saved due instant, oldest first. Up to 50
queue entries are visible at once; map pagination remains available for all stars.
The dashboard refreshes local records every 30 seconds while visible and idle,
and after assessment dialogs close. It never fetches all private Quran text just
to render the map.

## Guided daily revision

Choose a route of up to 3, 5, 10 or 15 currently due units. The two-minute-per-unit
focus suggestion is only a rough UI estimate. The route is an in-memory navigation
list, not another schedule or a persistent record of claimed reviews.

Start/continue opens the next due unit. A session skip only changes this route;
it never snoozes or changes a card. An unfinished assessment is preserved and
resumed before starting another unit; skipping is disabled while it is unfinished.
Use the existing assessment's finish/return-to-practice controls rather than
fabricating a grade to move on. Closing the dashboard is safe and adds no history.

## Existing recall flow, unchanged scheduling

Every recall launch first loads verified content through the existing library.
Private content requires the authenticated backend entitlement/reviewer/developer
checks. Reviewed portions must still resolve to the exact existing `recallUnit()`
revision. Changed or unavailable boundaries stop the launch without deleting or
replacing the old card. Visual study pages never become approved recitation units.

The existing studio prompts recitation from memory, declaration, reveal/compare,
and Again/Hard/Good/Easy. Its existing scheduler alone calculates and persists the
next date. Rescue receives a save notification and verifies the actual persisted
attempt ID/history before updating its display:

- Independent scheduled grades update the displayed card date and count as a
  completed review step. Again is an honest completed review, not a correctness
  award, and offers corrective practice.
- Assisted grading preserves the previous schedule and does not restore a star
  or count as an independent route review.
- Early successful independent practice retains the existing due date and does
  not pretend that a due review was completed. Explicit early Again follows the
  scheduler's existing lapse behavior; Rescue does not override it.
- Duplicate notifications cannot create another result or route credit.

The brief gold restoration marks **review attention recorded**, not certified
recitation, tajweed accuracy or lasting memorization. It appears when returning
from the dialog, including after an honest Again/Hard. Dates remain authoritative.

After Again/Hard, **Corrective practice · listen & rebuild** opens the existing
bounded studio workspaces with full-source listening. Opening/practicing alone
does not create a new review or move the due date. Return to independent recall
when ready. No speech transcription, AI grading or recording upload is introduced.

## Persistence, ownership and cleanup

Rescue adds no learning-data schema and no duplicate card store. Existing passage
record format, scheduling settings, successful days, history and optional original
sync remain unchanged. Graded dates survive closing/reloading through the same
existing passage key. The new studio cleanup handle and optional close callback
only let the dashboard refresh and dispose its child dialog safely.

All reads and actions are bound to the current guest/account namespace. Account
or developer-mode changes close the dashboard and its owned assessment/media;
superseded source responses cannot reopen them. Rescue and Expedition claim a
single active quest surface, so switching screens cannot leave hidden overlays
or an inert page behind. Focus returns to the selected star after an assessment,
and to the previous page on exit. Reduced motion and Skip animations suppress
decorative effects.

Malformed/future-version passage data is never reset or overwritten. **Export
passage review history** downloads the original scoped document for recovery;
the classic studio retains its existing review/export/sync tools. Rescue does
not add a new cloud-sync protocol. Private source errors leave saved dates and
history intact; they do not grant a fallback download or mark the learner wrong.
No Supabase migration, new Edge Function, secret key or RLS change is needed.

## Files and tests

- `src/quest/rescue/model.js`: pure eligible-star, due-state, route and persisted
  assessment selectors; no scheduler calls or storage writes.
- `content.js`: authorized reference loading and existing recall-unit validation.
- `ui.js`, `rescue.css`: map, queue, recall/practice handoffs, transient restoration,
  pagination, accessibility and owned lifecycle.
- Existing menu, studio and expedition integration: entry links, optional studio
  close callback/cleanup handle, and single quest-surface navigation.
- `tests/rescue-model.spec.js`: actual existing FSRS grades under fixture clocks,
  all four results, exact due persistence, early/assisted behavior, calendar/DST
  classification, long breaks, eligible units and changed segment rejection.
- `tests/rescue-ui.spec.js`: real dialog grading, reload, corrective practice,
  empty/corrupt data preservation, pending attempts, account isolation, private
  denials/late responses, pagination, screen switching, keyboard/touch/reduced motion.

## Screenshots

These are **local QA examples**, not live learner accounts. Test helpers seed
records using the real existing assessment store/grader under controlled fixture
clocks; no fake/demo history is shipped in production code. The reviewed screenshot
uses actual UI declaration/comparison/grading to update the fixture's card.

Run Vite on port 5194, then `node scripts/rescue-screenshots.mjs` (or override
`RESCUE_PREVIEW_URL`).

- [Desktop map](rescue-previews/desktop-map.png)
- [Desktop after review](rescue-previews/desktop-reviewed.png)
- [Desktop guided route](rescue-previews/desktop-route.png)
- [Mobile map](rescue-previews/mobile-map.png)
- [Mobile detail](rescue-previews/mobile-detail.png)

Hosted private-source availability and physical iOS/Android audio behavior need
separate deployment/device QA. Local tests do not certify recitation accuracy or
prove that a private source has been deployed.

## Validation results

Validated locally on 2026-10-30:

- Full Playwright suite: **352 passed**, including 20 Constellation Rescue tests.
- Focused Rescue, Passage Builder and Quest browser/model regressions: **45 passed**.
- Existing content, billing, recitation and coach backend suites: **23 passed**.
- `npm run build` and `git diff --check`: passed.
- Five desktop/mobile QA screenshots captured using the existing assessment grader.

No database migration, new scheduler, or production learner seed data is introduced.
Hosted private-source and physical-device checks remain separate from these local results.
