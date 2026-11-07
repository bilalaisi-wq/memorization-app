# Ayah Quest 3.0 Phase 4: Vanishing Boundary and Constellation Chain

## Current playable modes

Revision Lab → Cosmic Rush → mission briefing → **Ayah Link level** now offers:

- **L1 Endpoint Connections** (`endpoints`): the previous ending stays visible; connect it to one of three distinct, authentic next openings.
- **L2 Restore Both Boundary Pieces** (`boundary`): conceal both source endpoints; select or drag the correct ending onto the next opening, then connect them.
- **L3 Constellation Chain** (`constellation`): connect every real adjacent pair in the selected set, retain illuminated stars through mission stages, then reconnect studied boundaries cumulatively. The final stage's final round includes every selected route boundary, including stage seams.

The four original IDs (`guided`, `recognition`, `opening`, `extended`) and their gateway, typed and self-assessed comparison mechanics remain available. The arcade activity ID remains `link`; all evidence stays in `ayah-cosmic-links-v1`. Public Cosmic Rush missions still use Al-Fatihah and Juz Amma. This change does not bypass that mission entitlement boundary or advertise private content in the public launcher.

## Interaction and presentation

Study two complete, verified consecutive ayahs in RTL reading order. Their external Mushaf markers begin visible. Watch the luminous demonstration or skip it; the markers fade and endpoint text is concealed in presentation only. **Restore Mushaf Markers** remains available, including while paused. Ayah markers are annotations identifying canonical boundaries, not sentence-ending punctuation; their removal does not imply a stopping/restart ruling.

Click/tap an ending and an opening, then choose **Connect selected endpoints**. Keyboard users use Tab and Enter/Space on the same controls. Pointer/touch users can drag between opposite banks; a luminous preview follows the pointer. Dropping on a valid endpoint commits that link. Dropping elsewhere or cancelling a pointer is a motor event and never a memory strike. Correct endpoints snap together, restore exact source text, illuminate the connection and send a small star traveler across it. No answer timer is used.

Classic has three memory strikes across the route; losing requires restarting that Link route. Practice replenishes the budget at each completed boundary and preserves earlier connections when retrying a failed boundary. Hints, full-text comparison and listening are assistance. All endpoint selection results are recognition, never automatic spoken verification or FSRS grades.

Full preceding and following ayah recordings can play sequentially with stop and volume controls. No cropped or stitched recordings are introduced. Endpoint groups are visual cues, not approved recitation units. Reduced motion removes decorative fades/travel; skip controls remain available.

## Contracts and compatibility

- `boundary-content.js`: authenticated bundle loading, canonical word spans, complete source/review fingerprints, source-backed endpoint alternatives and full-ayah audio. `prepareBoundaryContent` also accepts authorized private pairs through the existing backend loader; it does not grant entitlement based on frontend state. Access/revision checks, account changes and disposal protect active source/audio objects.
- `link-boundary.js`: deterministic source selection, real adjacent pair IDs (`surah:ayah>surah:nextAyah`), two-endpoint commitment, memory/motor separation, Classic/Practice budgets, cumulative challenges and the standard game lifecycle.
- `link-boundary-ui.js`: RTL source cards, interactive connectors, constellation map, accessible controls, media lifecycle, existing evidence and bonus-reward APIs.
- `link.js` adapts the three new mode IDs while keeping original contracts intact. The shared mission controller preserves stage seams, route stars and Classic budgets.
- Evidence root version remains 1, with additive `boundaryVersion: 2`, expected/selected endpoint IDs and optional source/review fingerprint metadata. Legacy events remain valid. Private evidence requires a trusted authorized content context; after access ends, its metadata remains recoverable without re-exposing text. Weak-link selection skips inaccessible private sources.

Source text is never duplicated in the ledger. Old malformed/future ledger data remains exportable and is not overwritten. Cumulative recognition does not award extra transition receipts; replay uses the existing capped, idempotent rewards. There is no new database migration and no second scheduler.

Standalone live navigation remains session-local: reload restarts an unfinished Link set, while evidence and earned rewards persist. Existing saved expedition checkpoints and native recall history retain their original behavior. This phase does not add cross-device live-game resume.

## Validation

The new model suite exercises all **533 free adjacent-ayah pairs**, distinct normalized choices and exact source spans; authorized/private and denied pairs; ordered stage references; source/review changes; Classic/Practice recovery; full-route cumulative coverage; evidence isolation, duplicate receipts and FSRS non-interference. Browser tests exercise drag/missed drops, actual touch-enabled mobile input, keyboard selection, RTL, restored text, marker fading/restoration, sequential audio, account cleanup and reduced motion. Original Link tests still run against their legacy modes.

## Retained legacy contracts

The original `guided`, `recognition`, `opening` and `extended` modes retain gateway steering, typed text comparison and explicitly self-assessed spoken comparison. Their existing source checks, hints and events remain valid. The legacy Broken Verse Reactor still requires a complete source-matched, published approved visual partition; incomplete or unapproved partitions fall back to a whole-ayah component. Visual approval is separate from waqf/ibtida approval, and legacy audio remains full-ayah only. Local typed/recognition results never certify spoken recitation or replace the native recall scheduler.

## Release verification

- Complete Playwright regression suite: **828 passed** with three workers using `playwright.regression.config.js` (21.5 minutes).
- Focused new boundary model/browser suite: **18 passed**, including a model sweep of all **533 free adjacent pairs**.
- Supabase content-policy tests: **6 passed**; billing tests: **7 passed**.
- Quran-content Edge Function type check, production build and whitespace checks passed.
- [Desktop screenshot](screenshots/ayah-link-3/desktop.png) and [390px touch screenshot](screenshots/ayah-link-3/mobile.png) were captured from playable browser sessions and visually inspected.

Private-source tests use authorized fixtures and the existing authenticated loader. Live deployed Supabase policies and physical-device speaker playback were not revalidated. Standalone in-flight Link resume across reloads/devices is not added; completed evidence, existing expedition saves and earned rewards remain preserved. Railway deployment is manual.
