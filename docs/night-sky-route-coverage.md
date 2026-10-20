# Night Sky coverage and implementation audit

This is a Vite / vanilla JavaScript application with in-memory modes, not URL routes. No alternate framework or router will be introduced. The user supplied a visible Option 2 reference image and a Markdown design brief. The image is a style reference only; its mock Arabic, scores and fictitious catalogue are not product data. See `design-references/README.md` for the original PNG limitation.

## Sources and invariants

- Canonical Qur'an: `src/data.js` and bundled source/audio manifests. Unchanged.
- Learning: `createLearningStore` / `ayah-learning-v1`. `record.memory.stage === 'retained'` alone lights a mastered star. Games/legacy completion imply in-progress at most. Due is an independent overlay from the saved review date. FSRS, grading, hints and reward limits stay unchanged.
- Profiles: verified Supabase user ID selects isolated local keys through `profileStorage`; guest keys remain unchanged. Existing cloud progress uses revision checks. Appearance will use an independent owner-only settings table with graceful local fallback, so a missing appearance migration cannot block learning sync.
- Existing effects: successCue, transitionCue, mastery mosaic animations, optional feedback/motion settings. Night effects will share these preferences, remain nonblocking, and introduce no sound.
- Current CSS is mostly literal colors. Preserve it and load a scoped token-based Night Sky stylesheet after it; Simple receives no color/layout overrides.
- Tests: Playwright + PGlite, production Vite build. No lint script exists. Baseline build and all 112 baseline tests passed. Final build and all 127 tests passed (15 new theme tests); 43 screenshot artifacts cover the implemented surfaces.

## Implemented files

1. Foundation: `src/themes/{registry,appearance}.js`, root bootstrap, `night-sky.css`, settings chooser and independent appearance persistence. Simple remains default.
2. Coverage: scoped shared surfaces, all modes/dialogs, static decorative SVG horizon; no canvas/WebGL.
3. Progress: deterministic layout/status adapter, bounded interactive ayah map and paginated/searchable Galaxy catalogue. Presentation-only effects use persisted mastery and isolated seen receipts.
4. QA: model and browser checks, screenshot matrix, reduced motion/contrast/zoom, preference/profile switching and restore/error paths. Add a third-theme guide.

## Screen matrix

| Screen/state | Main components | Theme and completion treatment | Verification | Status |
|---|---|---|---|---|
| Shared shell / mobile | sidebar, header, navigation, footer | Stationary starfield, moon/nebula hero, cool glass surfaces; unchanged navigation | desktop/tablet/phone + 200% zoom | Verified |
| Practice / partial / solved | reference, pieces, build zone, controls | Original RTL/font/shapes; themed pieces and correct/error states, bounded ayah track | drag, audio, build/check | Verified |
| Puzzle Quest levels 1–3 | decoys, blanks, hints, rewards | Same shuffled options/level rules; correct pulse does not claim mastery | existing tests + Night tests | Verified |
| Active Recall | hidden pieces / reveal | Preserve hidden text; no star reveals words | conceal/reveal check | Verified |
| Ayah Chain | multi-ayah cards, order, audio | Same controls and order; themed containers | build/reorder/audio | Verified |
| Daily Quest / My plan | recommendations, goals, streak, activity | Real-data Galaxy, no fake counts; charts/badges themed | statuses / daily / reload | Verified |
| Independent assessment | hidden prompt, compare, grades, recorder | No decorative motion behind Arabic; due overlay; new mastery only after persisted retained state | grades, failure, recording | Verified |
| Mastery Gallery / Poetic Tafsir | mosaics, artwork detail, blank poetry | Keep original 2-day art unlocks separate from retained-star semantics | existing gallery tests + Night tabs | Verified |
| Falling Words | timed/untimed, discard, mute, pause | Theme board, slots, concealed blocks, completion/errors; no background movement in play area | keyboard/touch/audio | Verified |
| Vanishing Ayah | concealment and decoys | Theme bank and hidden slots, unchanged correctness | selection/retry | Verified |
| Ayah Jigsaw | groups/build | SVG pieces retain shape/meaning/audio | reorder/check | Verified |
| Memory Match | meaning/audio/continuation | Hidden/revealed/matched variants | all pair variants | Verified |
| Broken Chain | ayah cards / decoys | Canonical text/order unchanged | chain check / audio | Verified |
| Continue the Ayah | cued recall / build / compare | Hidden answer stays hidden, themed reference | reveal/build/check | Verified |
| Similar Ayah Detective | verified alternatives | Distinct selected/error states with text | choose/check | Verified |
| Settings / tutorial / goals | native dialogs + sandbox | Appearance chooser with preview/apply/cancel; all nested modals themed | keyboard/Escape/storage failure | Verified |
| Sign in / signup / Google / account | auth dialogs, sync, leaderboard | Theme local and verified-profile preferences; readable empty/error/loading states | auth tests + appearance isolation | Verified |
| Success / failure / loading | toasts, status, disabled controls | Nonblocking short cyan/lavender effect; no new sound; readable coral errors | motion + input check | Verified |
| Browser confirmations / third-party OAuth | native browser / provider pages | Outside app CSS control; no custom reroute of security UI | documented boundary | Not applicable |
| URL 404 / billing / paywall / canvas | None in current app | Do not invent routes, entitlements, analytics, or canvases | source audit | Not applicable |

## Limits to check

The supplied library has 38 surahs and at most 46 ayahs per surah (confirmed in tests during implementation); synthetic 200+ ayah fixtures will test pagination. Interactions render at most 24 ayah nodes, and catalogue pages at most six constellations. No continuously running animation loop or particle engine is used.
