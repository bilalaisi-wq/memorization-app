# Ayah A Day — Ayah Defense 2.0: Celestial Fortress

This update retains the `ayah-defense` ID, authorized source adapter, full-ayah audio, account-scoped adventure records, bounded XP receipts and existing independent recall APIs. It changes strategy/economy/placement, not Quran text or FSRS.

## Audit and progression diagnosis

The starting `e49bb01` host already carried the entire selected reference range. There was no intentional five-ayah slice in `marathonRange` or `mountAdventure`. A baseline browser-host run with the actual local Al-Araf sources passed 7:5→7:6, 7:50, 7:100 and 7:150 before its slower driver timed out at 7:155. Thus a hard five-ayah cap was **not** reproduced and is not claimed as the confirmed cause of the owner's authenticated production incident.

Confirmed lifecycle defects: coverage was only assigned to the host record after a successful storage write, so a failed write discarded the accepted in-memory change; source coverage, construction credit and five-ayah region change were separate operations; the previous authorized source was fetched again unnecessarily; in-flight audio could act after a source/save failure. Source delivery problems legitimately stop the game and must not be bypassed.

The fix stages a validated complete checkpoint in memory, including source cursor, stable construction receipt and region change, then persists it. On failure, the game pauses, retains that draft, offers Retry and pending-checkpoint export, and does not claim saving succeeded. Retry persists that exact draft before awarding pending capped XP or loading the next source. Previously accepted source IDs prevent duplicate construction credit. The just-authorized preceding bundle can supply the next transition cue without a redundant request. Audio leases/epochs are invalidated on failure. Only the actual selected endpoint starts the final neutral wave; five-ayah boundaries remain internal saves/region updates.

The full integration test uses all exact ignored `7:1`–`7:206` operator bundles through the actual browser activity host. It injects a failed write at 7:5 and temporarily unavailable 7:6, retries both, restarts the current challenge with new difficulty at 7:10, exits/reloads/resumes, and checks 50/100/150/200/206. Transport authorization is mocked; this is not certification of the owner's real hosted account or storage deployment.

## Economy and opening

New attempts begin with zero Construction Points, zero Upgrade Coins and no towers. Prices are Arrow 50, Frost 90, Beam 130, Pulse 160, Guardian 180 and Observatory 200. Correct primary/review source decisions allocate a per-ayah budget of 20–80 points, distributed across the actual units; very long ayahs do not earn unlimited resources just for having more fragments. Each unit has one stable receipt for the run. Hints, listening, waiting, errors and held keys earn nothing.

A tiny selected passage that completes before earning 50 receives a bounded, once-only completion supplement so it can still purchase its first defense. This is earned by genuine source completion, never at startup. Upgrade Coins come from actual defeated neutral balloons. Coins and Construction Points are independent of account XP.

The visible Grace Wave has at most two very slow balloons and holds them before the fortress until the first tower is placed. No idle kills or coins are awarded. Pressure ramps gradually over 45 active seconds after the first tower. Reading pauses reduce pressure without grading response speed. Ordinary defense failures are motor events, not memory mistakes.

## Shared geometry and four maps

`defense-maps.js` owns paths, world bounds, blocked ponds/trees/rocks/water, footprint clearance, legal terrain and SVG coordinate conversion. The same data draws the track and rejects purchases on it. Full circular footprints must stay inside the map and clear every path segment, other towers and entry/fortress structures. Pointer coordinates use the SVG screen transformation, including letterboxing, viewBox zoom, browser/device scaling and resizing.

- Garden Trail: long S path and generous garden terrain.
- Spiral Grove: nested turns reward covering multiple path segments.
- Twin Rivers: two true enemy routes, streams and bridge crossings.
- Celestial Crossroads: three approaches, split bends and crystal/stone restrictions.

Map choice is independent of memory and motor difficulty. Optional expedition map touring changes the track at safe region boundaries. Valid towers retain their coordinates and upgrades. Displaced towers return exactly their paid Construction Points and spent upgrade coins; no extra currency is created. The refund policy is displayed before changing maps. Placement is otherwise permanent.

## Construction, input and artwork

All scenery, miniature fortress, towers, balloons, flowers, crystals and combat effects are original procedural SVG, with no borrowed game assets. Static environment groups are retained between frames; dynamic tower/enemy/effect counts are bounded. Buildings assemble over 600ms; upgrade levels change roofs/weapons/crystals/rings/walls/instruments. Reduced/off effects remove decorative motion without changing mechanics. No Arabic appears on destructible combat objects.

Buy an affordable shop item, then click/tap valid land or drag from the shop. Invalid drops and cancellation spend nothing. A footprint/range preview shows both symbols and explanation. Keyboard arrows move a placement preview; Enter builds and Escape cancels before the universal Pause handler. The keyboard Build Here action and tower selector provide alternatives to precision dragging. Selected towers expose First/Last/Strongest/Nearest targeting and coin-priced upgrades.

Digit1–3 and Numpad1–3 immediately commit the numbered displayed Arabic option. Physical held-key state survives prompt transitions; repeat/composition/editing/menu input is ignored. Click/touch remain available. Arabic logical/RTL order and source spelling are preserved.

The battlefield is anchored in a grid. The answer ribbon and shop have their own bounded scroll areas so purchases cannot scroll the map off screen. Expand, Pause, settings, full-ayah replay, volume and transliteration retain the existing shared infrastructure.

## Persistence and authorization

The existing `ayah-flow-adventures-v1` envelope remains version 1; new defense physics checkpoints declare version 2. Valid old snapshots are copied to `legacyArcade` before adaptation. Existing active towers are retained where terrain permits; displaced or unfinished legacy purchases return their original paid/charged value. Previous source coverage, XP and evidence are not reset. Malformed/future data remains blocked for export/recovery.

New gameplay saves remain device-local/account-scoped, as before. No Quran text/audio is stored in the campaign checkpoint. No Supabase schema migration or new secret is required. Source loading and periodic authorization rechecks continue through existing server-authoritative functions. No arcade action calls an FSRS grader.

## Validation, screenshots and deployment

The complete implementation-snapshot regression run executed 1,221 cases: 1,209 passed, 10 conditional cases skipped, and two failed. Both failures subsequently passed separately: the Chronicles preview case initially used a hardcoded server port before its alias was available; the 1440px Star Runner journey exceeded its timeout under concurrent load and passed unchanged in isolation. This is reported as rerun evidence, not a claim that the first run was failure-free.

Backend policy tests: 36 passed across billing, authorized content, AI/recitation policies, coach, Chronicles and native billing. Production offline browser suite: 4 passed. Production Vite build and Capacitor iOS/Android asset synchronization with bundled-frontend/secret checks passed. Native compilation, store publication and physical-device verification were not performed.

The dedicated actual-host Al-Araf journey passed all 206 references and 1,665 canonical/grouped decisions over 3,320 source-word positions, including the real final neutral wave and a persisted finished record. Additional conditional private-source cases skipped in the broad clean snapshot are not represented as hosted successes. The final clean-snapshot focused suite passed **50/50**, including the conditional full-source model and actual-host journey. See [machine-readable validation](validation.json). The initial failure/recovery iterations are retained in workspace artifacts; no failing assertion was removed to obtain this result. Deployment is verified separately against the exact committed build and reported in the execution result.

## Changed interfaces and files

- `src/revision/adventures/defense-maps.js`: map registry, real route geometry, full-foundation placement checks and screen/world conversion.
- `src/revision/adventures/defense-art.js`: original retained SVG scenery, miniature towers, balloons, construction, upgrades and placement previews.
- `src/revision/adventures/defense.js`: earned dual economy, grace protection, real free placement, map transfers, six tower roles, snapshot adaptation and bounded rendering snapshots.
- `src/revision/adventures/content.js`: reusable free-only candidate pool; supplied authorized candidates remain request-local. Canonical source slices and group provenance are unchanged.
- `src/revision/adventures/store.js`: additive validation for v2 defense checkpoints; the existing account-scoped envelope stays compatible.
- `src/revision/adventures/ui.js` and `ui.css`: atomic source/strategy checkpoints, explicit recovery/export, free placement, immediate numbered answers, anchored responsive battlefield and real restart/replay. Optional injected frame scheduling supports deterministic host tests without replacing combat or source decisions.
- `src/revision/ui.js`: map/touring configuration within the existing game setup.
- `tests/defense2-{engine,ui,combat,progression}.spec.js` and `tests/adventures-{model,ui}.spec.js`: economy, geometry, input, actual host progression, recovery, replay and shared Surah Rush regressions.

No new framework, external artwork, public premium data, database migration or backend credential is introduced.

Recovery testing also found that a storage failure during an explicitly requested whole-range restart could leave the pause menu covering Retry. Failure handling now closes that menu while keeping combat paused and the pending checkpoint available. A completed retry rebuilds the fresh zero-resource attempt; the earlier attempt remains archived. Delayed listen-before completion cannot resume combat behind an explicitly opened pause menu.

## Inspected gameplay screenshots

| Map | Desktop | 390px phone |
| --- | --- | --- |
| Garden Trail | [Desktop](map-0-desktop.png) | [Phone](map-0-phone.png) |
| Spiral Grove | [Desktop](map-1-desktop.png) | [Phone](map-1-phone.png) |
| Twin Rivers | [Desktop](map-2-desktop.png) | [Phone](map-2-phone.png) |
| Celestial Crossroads | [Desktop](map-3-desktop.png) | [Phone](map-3-phone.png) |

[Zero-resource opening](zero-opening-desktop.png) · [Invalid footprint](invalid-foundation-desktop.png) · [Construction](construction-desktop.png) · [Six tower roles and earned upgrade](upgrade-and-combat-desktop.png) · [206/206 completion without private Arabic](araf-completion-no-source-text.png).

## Remaining external verification

No separate staging deployment or real authenticated owner/private-library browser session was performed. The environment has no Supabase management token or owner session; existing hosted delivery of 7:6 and later private sources therefore remains an operator/account verification requirement. The tests intentionally use mocked authorization transport rather than weaken entitlements. No database setup is needed for this gameplay update.

Mobile coverage is Chromium touch/DPR and responsive browser testing, not physical iPhone/Android verification. Capacitor synchronization is not a signed mobile release or a Capgo publication. Real recording, headset/interruption and device-performance acceptance remain device checks. Existing campaign saves remain device-local/account-scoped; this update does not add cloud campaign synchronization.

Production smoke testing found an additional startup race: the Start button was visible and enabled before initial source authorization finished. An early click was rejected, leaving the game ready and requiring a second click once loading completed. Start now begins disabled with “Preparing verified passage…” and becomes actionable only after the verified source is ready. Dedicated delayed-source tests cover both Ayah Defense and the shared Surah Rush host. No authorization step is skipped.
