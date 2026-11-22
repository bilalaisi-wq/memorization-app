# Bridge Builder 3.0 — implementation and validation

## Delivered behavior

The existing `bridge` game still tests authentic adjacent-ayah boundaries. Each completed correct connection adds a supported deck/truss span to one continuous RTL bridge. Ordinary chain boundaries automatically continue. Final completion starts a deterministic lantern/cart/wagon crossing through every constructed span. Numbered joints, missing dashed spans, load-dependent flex and additional braces make structure state visible without relying on color alone.

Basic crossing always passes a complete correctly constructed required sequence. Optional heavier trials inspect load/capacity for every span and safely identify those needing a brace. Rehearsing the original source-backed boundary adds that brace. Wrong main-run choices retain existing Classic/Practice strikes; optional post-completion rehearsal has its own three-charge budget so an already saved result is not rewritten. Structural failures consume no memory strikes. Rehearsal attempts are assisted recognition, not oral assessment.

The existing interactive tutorial remains separate from learning history, now explaining supports, strength, repair and multi-span bridges. Audio remains full-ayah; reinforcement replay follows the actual boundary under repair, not the final boundary of the route. Existing audio/transliteration/effects preferences are retained. Final crossing celebration uses the shared feedback layer, with no reward or scheduler writes.

Phone layouts keep readable Arabic and full-size controls inside the bounded game container; some narrow portrait configurations require **within-game scrolling**, not returning to page setup. Up to eight structural spans fit the overview. Longer bridges support horizontal exploration and follow the moving load unless the overview has keyboard focus. Reduced motion uses stepped traveler positions and suppresses flex/decorative support animation; the underlying result calculation is unchanged. Pause/settings, account changes and disposal prevent active simulation or audio continuing in the wrong context.

## Changed files

- `src/puzzles/arcade/bridge/memory-structure.js`: additive reference-only structural state, deterministic capacity/stress/load/deflection, inspection, crossing and validation.
- `src/puzzles/arcade/bridge/structure-view.js`: SVG spans, trusses, supports, braces, traveler, strength and reduced-motion rendering. No Quranic text is generated.
- `src/puzzles/arcade/bridge/engine.js`: spans driven by correct canonical transitions, Grand Crossing, optional reinforcement and rehearsal charges; no changes to shared FSRS or reward rules.
- `src/puzzles/arcade/bridge/checkpoints.js`: optional structural metadata in existing account-scoped v2 records; legacy reconstruction and explicit invalid-data recovery.
- `src/puzzles/arcade/bridge/ui.js` and `bridge.css`: structural overview, safe inline results, repair/heavier-load controls, responsive layout and correct repair audio.
- `src/puzzles/arcade/bridge/tutorial.js`: extends the existing no-strike/no-XP tutorial.
- `tests/bridge-structure.spec.js`, `tests/bridge-grand-crossing.spec.js`: structural and actual five-ayah pointer/touch journeys.
- `tests/bridge-ui.spec.js`: touch selection explicitly scrolls a connector into view inside the newly extended game before a real touchscreen tap.
- `docs/bridge-builder.md`, this report and screenshots: updated behavior, model contract, recovery and evidence.

No new package, public/private content import, backend function, database migration, FSRS parameter or reward rule is introduced. The old inactive engineering model remains preserved. Existing game ID, v2 checkpoint envelope and historical achievements remain intact; no engineering-era result is promoted to transition evidence.

## Executed validation

- Broad Bridge + shared arcade + content/difficulty + Puzzle Lab + gameplay/storage/mobile regression: **176 passed**.
- Final affected Bridge suite: **44 passed**, including all existing Bridge engine/UI/tutorial/assistance tests plus structural and five-ayah Grand Crossing tests.
- Production Vite build (**351 modules**) and Capacitor iOS/Android frontend synchronization: **passed**, including the existing private-bundle/configuration guard.
- The actual five-ayah journey uses Al-Fatihah 1:1–5: exactly four boundaries, genuine pointer/touch choices, four supports/truss spans, automatic continuation, complete basic crossing, pause/settings, heavy trial, targeted brace recognition, repeat heavy crossing, rotation/resizing, unchanged receipts/history and no FSRS grades.
- Existing tests cover Classic/Practice, old checkpoint recovery, source revisions, ambiguous/repeated openings, full audio lifecycle, motor separation, account changes, reward idempotency and authorized private-content revocation. These are local controlled tests, not hosted Supabase or native store certification.

Earlier validation exposed an obsolete phone test assumption that a connector was already in the viewport after adding the overview; it now explicitly brings the target into view before real touch. The recording test initially lacked Playwright's FFmpeg path; using the installed system FFmpeg resolved that environment issue. No application failure is silently counted as a passing test.

## Inspected gameplay captures

All are real local Chromium game sessions. They do not certify physical devices or teacher-reviewed recitation. The screenshot camera is set to the top of the game container to make structural progression comparable; all input remains actual pointer/touch gameplay.

| State | Desktop | 390px phone |
|---|---|---|
| Building | [View](bridge-builder/3-desktop-building.png) | [View](bridge-builder/3-mobile-building.png) |
| Correct connection | [View](bridge-builder/3-desktop-connection.png) | [View](bridge-builder/3-mobile-connection.png) |
| Moving load | [View](bridge-builder/3-desktop-load.png) | [View](bridge-builder/3-mobile-load.png) |
| Targeted repair | [View](bridge-builder/3-desktop-repair.png) | [View](bridge-builder/3-mobile-repair.png) |
| Grand Crossing | [View](bridge-builder/3-desktop-grand.png) | [View](bridge-builder/3-mobile-grand.png) |

## Limits and deployment

The load model is intentionally stylized, not a certified engineering solver. Existing same-surah adjacent ranges and route bounds remain (maximum 50 selected ayahs). Checkpoints remain account-scoped device storage; this task adds no cloud checkpoint synchronization. Interrupted optional reinforcement can be offered again while completed braces persist. Optional post-completion rehearsal evidence lives in the checkpoint metadata; it does not rewrite an already issued XP result.

The independent-recall button retains the established app recall route. No new speech verification or automatic mastery is claimed. Actual iPhone/Android hardware, store builds, signing, hosted RLS and deployment are outside these local test results. Frontend synchronization bundles these changes for both existing native projects, but does not publish an app or Capgo update. No Railway deployment or app-store submission is claimed.

Sanitized command evidence: [176-case regression](bridge-builder/3-evidence/regression.log), [final 44-case Bridge suite](bridge-builder/3-evidence/bridge-final.log), [production build and native sync](bridge-builder/3-evidence/build-native.log).
