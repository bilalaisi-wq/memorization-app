# Cosmic Rush Phase 1 — Revision Lab and mission planning

Historical milestone: the current public launch now includes [Phase 3 Quran memory gateways](cosmic-rush-gateways.md). Availability statements below describe this earlier milestone.
This implementation adds regular Revision Lab navigation and Cosmic Rush mission planning. It does not implement or launch the arcade stages. The current Phase 1 request supersedes the Phase 0 proposal's initial two-to-five-ayah route limit and private-only planner: the public planner supports 5, 10, 15 and 20 ayahs, custom contiguous ranges, and entire free surahs.

## Navigation

Choose **Your Space → Revision Lab → Cosmic Rush → View mission briefing**. Memorization Lab and Puzzle Lab remain separate and accessible. The planner uses the existing application navigation and stops previous study/game audio when entered. Entering this text-free planner does not mark an unfinished recall attempt as assisted.

The mission card explicitly distinguishes available planning from future gameplay. No Start/Play/Launch flight button or placeholder arcade registry entry exists. Stage selection and previous/next controls navigate the route preview; they never mark checkpoints completed, award XP or alter FSRS.

## Selection rules

- Source catalog: original `src/data.js` free library, filtered to surah 1 and surahs 78–114 and checked against the existing free-content policy. No subscription or developer state can expand this list.
- Presets select up to 5, 10, 15 or 20 ayahs from the chosen starting ayah. At the end of a surah, they include all remaining ayahs; the briefing shows the actual count. A three-ayah surah can therefore be selected with any preset.
- Entire surah ignores start/end fields and includes every ayah.
- Custom range requires whole-number bounds, `1 <= first <= last <= surah length`. Reversed/out-of-range values are rejected, not silently repaired.
- Every route is contiguous and within one surah. Stages partition it in canonical order into groups of up to five, with no omissions or overlaps. Groups are mission organization, not approved recitation stops.

## Contract and modules

`src/quest/cosmic/mission.js` exports the restricted catalog, selection validator, mission factory, objective definitions and `COSMIC_GAMEPLAY_AVAILABLE = false`. The mission factory is asynchronous because it hashes exact existing source text and word arrays; it neither regenerates nor persists Arabic.

The manifest has `schema`, `policy`, `surah`, `first`, `last`, `stageSize`, `sourceHash`, deterministic `id`, canonical `refs`, and ordered `stages`. Each stage has its stable ID, ordinal, references, first/last bounds and ordered objective IDs. Equivalent normalized routes produce identical configuration IDs irrespective of which selection control produced them. Configuration IDs are not unique gameplay runs or reward receipts.

This is a source-text fingerprint, not a segmentation approval hash. It must not be used to assert reviewed phrases, audio boundaries or waqf approval. A future gameplay manifest must add the Phase 0 review/source pin contracts before using reviewed phrases.

`src/revision/ui.js` owns the card, selector and interactive mission briefing. Generation checks prevent stale asynchronous construction from replacing a newer view. The UI displays the five planned objectives and honest availability status. `src/revision/revision.css` scopes the navy/violet, teal and gold presentation, constellation links and touch-sized controls without changing the user's selected website theme.

## Persistence and compatibility

No database migration, account requirement, remote premium request, new localStorage key, FSRS mutation or reward write is introduced. Current selection is in memory; browser reload returns to the application's normal study entry. Existing saved learning records are untouched. Cross-device mission resume and actual gameplay are future work, not implied by a briefing preview.

## Validation

`tests/cosmic-mission.spec.js` checks every full free-surah route (38 surahs / 571 ayahs), deterministic IDs, stage coverage, presets, short/last-ayah routes, custom boundaries and unauthorized/malformed selections. `tests/cosmic-ui.spec.js` checks ordinary navigation, stage selection, all presets, full/custom routes, absence of a gameplay launch, mobile/keyboard access, no premium requests, no progress writes and return to existing labs.

The Phase 0 spec remains an audit/design snapshot, not a claim that its later gameplay acceptance gates are implemented here.

### Execution results

- Focused new model/browser suite: **5 passed** (8.6 seconds).
- Full existing-plus-new suite, `npm test -- --workers=2`: **491 passed, 2 failed** (13.8 minutes). Failures were existing `release-journeys` profile setup and `repair-ui` workshop-opening cases; both timed out before their intended lifecycle checks.
- `npm test -- --last-failed --workers=1`: **2 passed** (6.3 seconds), without application or test changes. This is a successful serial rerun, not a claim that the initial full run was clean. Parallel setup timing remains an intermittent test concern.
- `npm run build`: **passed** (5.23 seconds, after the final layout adjustment).
- `git diff --check`: passed.
- Additional browser checks: entire 46-ayah An-Nazi'at route produces ten stages; Night Sky theme renders correctly at desktop and 320px mobile widths without page overflow. Desktop constellation uses one scrollable path; mobile uses a vertical path. Screenshots captured locally under `/tmp/cosmic-phase1-shots/`.

No live Supabase deployment, physical-device certification or new arcade gameplay is claimed by these checks.
