# Complete access and continuous revision baseline

Baseline commit: `84c3a69`. Existing unrelated Phase 9/10 account, legal, native release and gallery edits are retained separately and will not be merged into this assignment.

The fresh local auditor reports 114 surahs, 30 juz and 6,236 canonical references: 571 existing free ayahs and 639 private/developer ayahs technically validated locally. **5,026 asset sets remain missing.** No source pins were rewritten. The isolated importer `--all --dry-run` makes no network calls/writes and explicitly requires an independently attested reference manifest/pinned digest and commercial-use source policy. Those approvals were not found. No new import or approval is claimed.

A fresh authorized management read found production `quran-content` v5, `billing-passages` v5 and `chronicles-content` v1 active; 1,278 private objects and one enabled developer. No published Chronicles lessons exist. Staging versions differ (see `coverage.json` operational evidence), with eight private objects and zero enabled developers. Database role presence is not a real owner-browser sign-in test. No production account or subscription was modified by this reconciliation.

## Root cause

`src/passage-context/ui.js` sliced the original selection to five references before invoking `mountAuthorizedRunner`. The latter accepted at most five references and built a one-stage mission. Its callback rendered “Ayah set complete” and required a fresh manual launch. The remaining selected references were outside the runner's mission contract; hiding the overlay would not repair it.

The free mission director separately has five-ayah stages and explicit `nextStage()` guards. Existing basic UI waited for manual buttons even though the stage was complete. The new continuous handoff uses those engine guards rather than bypassing gameplay. Existing Ayah Link already includes the stage-seam pair through its `allRefs` mapping; that mechanism must not be duplicated.

## Preservation boundary

Original Qur'an text, source pins, reviewed waqf, FSRS parameters, Stripe/native subscriptions and RLS remain unchanged. New local stores contain references, progress and fingerprints, not private Quran bundles. Source loading still uses authenticated content functions. Existing content import gates and editorial publication controls remain closed for unapproved material.

The browser regression also caught two defects introduced during the continuous-range implementation: the basic game view incremented a navigation generation checked by the save guard, and the authorized wrapper referenced its lifecycle predicate before initialization. The owning-controller guard and initialization order were corrected. Dedicated tests exercise both the normal ten-ayah game route and the authorized full-range wrapper; the latter keeps all references while mounting one window at a time.
