# Revision Lab gameplay upgrade 4.0

Baseline: 2758b9b. This task extends the existing engines; no replacement framework, Quran import or database migration is planned.

Audit: `content.js` already builds canonical slices and look-back cues, but uses two-word groups for 13–24-word ayahs and can leave one/two-word tails. `defense.js` already has six towers, free terrain placement, upgrades, currency caps, graceful reading protection and distinct balloons; its wave counter increments per spawn and does not provide true escalating wave budgets. `rush-course.js` currently cycles five junction families and uses common upper/middle geometry. `rush.js` already supplies fixed-step physics, continuous camera, springs, slopes, moving platforms, recoverable physical selection and bounded streaming. `ui.js` owns authorization, source hashes, full-ayah audio, account isolation, 25-ayah checkpoints and rewards; its continuous audio is currently the default. The Defense ribbon is a constrained scrolling side panel. Existing PassageContext adapters remain authoritative for source words; source and review fingerprints, not visual grouping, determine content integrity.

Historical records in `ayah-flow-adventures-v1` must retain their original unit planner and procedural generator. New optional revision fields will pin new planners without rewriting old source positions or earned receipts. Versioned-store recovery, daily reward caps and independent FSRS records remain unchanged. Full-ayah recordings continue through the current authorized loader; no new recording, licensing claim, recitation stop or synthetic fragment is introduced.

## Implemented modules and contracts

`content.js` adds planner version 4. A deterministic weighted partition uses widths 3/4/5/6 and redistributes the remainder instead of leaving one/two-word tails. Entire ayahs of one or two words remain intact. Every group retains original canonical word IDs, target positions, separate preceding-context positions, group index, difficulty and the authorized source/review fingerprint. Distractors use exact canonical slices and remain distinct authentic source choices. Groups are visual revision units, not approved waqf or audio segments.

Across 1,000 partitions of 100 words the measured distribution was 4,792 groups of 3, 9,449 of 4, 6,544 of 5 and 2,518 of 6 (approximately 21%, 41%, 28%, 11%). On the exact locally prepared Al-Araf source, all 3,320 word positions are covered in 759 units, compared with 1,597 legacy guided units. The only one-word unit is a complete canonical short ayah. This reduces decisions by about 52%; it is not evidence of improved long-term recall.

`defense-waves.js` produces bounded deterministic wave plans and threat budgets from health, armor, shielding, density, composition and speed. The first three waves are forgiving; the measured wave-4 threat index is approximately 2.13× wave 3. Later budgets increase rather than merely repeating the same balloons. New runs use true wave completion, not one wave number per spawn. Reading accommodations delay pressure but do not reduce the queued wave's underlying threat. The original opening protection and existing currencies, tower costs, free placement, upgrades and commander abilities remain.

The neutral roster contains basic, swift, layered and reinforced balloons; slow armor-resistant rolling boulders; armored rovers with a local escort effect; and late siege tanks with high durability, armor and visible health bars. Beam piercing, Frost control and mixed layouts interact differently with these enemies. Artwork is original SVG geometry; no Qur'anic text is used in combat objects or pop effects.

A deterministic 480-second combat fixture compared representative positions and levels, with canonical revision events keeping reading protection from hiding leaks. Three basic arrows reached wave 8 with 45 kills and only 9 core health; upgraded arrows reached wave 11 with 86 kills and 100 core health; a Beam/Frost/Arrow mix reached wave 11 with 99 kills and full core/shield. Poorly positioned basic arrows lost the fortress at wave 8. These are reproducible relative balance fixtures, not proof of ideal difficulty for every child or device. Starting inventories are test fixtures; this test does not award learners free towers or currency.

## Ten route variations and Express

`rush-course.js` retains the legacy generator and adds version 4. Upper routes: Spring Ascent, curved Spiral Ramp, Lift Climb, Wall-Jump Tower and Sky Rail. Middle routes: Rolling Hills, Slide Tunnel, Loop Run, Gap Hops and Conveyor Dash. Their springs, varying surfaces, lift carry, wall impulses, rail transport, slide collision, momentum threshold, actual gaps and conveyor velocity are simulated by the existing fixed-step runner. Safe recovery remains separate from memory mistakes.

Weighted selection discounts recent route IDs and strongly discourages identical adjacent junction pairs. Over 4,000 seeded junctions all ten route IDs and all 25 pairings appeared; only three adjacent duplicate pairings occurred at generator block seams. The generator is not a fixed five-layout cycle. Geometry validation/fallback remains, and 720 physical cases cover both travel modes, short/long labels, all motor profiles, elevations and representative layouts. Additional assertions exercise actual rail transport, lift support, wall-jump impulses and slide-only clearance.

Express compresses empty approaches/exits (1,640 to 1,315 world units per section), retains the recognition area, streams the same canonical units and adds bounded flow acceleration. Reading-aware approach limits still apply. On the same eight decisions covering all 29 Al-Fatihah word positions, Standard versus Express simulation times were approximately 50.73/36.87 seconds (relaxed), 39.92/29.52 (normal), and 35.72/27.58 (arcade), with zero wrong or skipped decisions. This is a controlled motor/throughput benchmark, not a memorization assessment or a promised human completion time.

Auto-Sprint is optional and off by default. It supplies forward motion but waits before a commitment point until the player makes a deliberate movement/route gesture and the reading window has elapsed. It never uses the correct answer ID. Pause freezes it. Touch buttons and ordinary keyboard controls remain. Express is selected when preparing a new run; Auto-Sprint may be toggled in paused settings. Changing a saved run's Express geometry in place is intentionally unsupported.

## Full-ayah audio and assistance

The in-game toolbar offers Independent Revision (new default), Listen & Revise (one complete recording at ayah entry), and Repeat & Practice (complete-ayah looping), plus manual replay, pause/resume, mute and volume. A saved historical Listen Before Play value remains understood. The current canonical reference is tracked independently of fragment position. Changing fragments does not restart recitation; changing ayah/account/source stops the old audio and revokes private leases.

Only the existing authorized full-ayah audio loader and recorded assets are reused. No recording is cropped, stitched, synthesized, newly imported or given a new commercial license assertion. Existing audio provenance/release conditions remain applicable. No additional audio rights clearance is claimed by this gameplay change.

Audible automatic/manual replay and source reveals are recorded as assistance. Recognition history distinguishes assisted from unassisted recognition and retains source-position evidence, without claiming independent spoken verification. Arcade recognition cannot submit an FSRS recall grade. Independent self-assessment continues through the established passage recall APIs.

## Storage compatibility and security

The `ayah-flow-adventures-v1` envelope and game IDs remain. New runs pin `plannerVersion:4`; old records without it use planner 3 so an unfinished unit is not silently replaced or reindexed. The runner retains movement snapshot version 3, with optional generator version, seed, pinned junction IDs, Express and Auto-Sprint state. Old procedural checkpoints retain their old generator. Defense retains snapshot version 2 with optional wave planner/state and bounded active neutral-enemy snapshots. Historical spawn-counter runs retain their original planner. New wave restoration preserves pending enemy positions and does not duplicate defeated-enemy coins or final waves.

No Arabic source content is stored in the campaign. Account-scoped profile storage, authorized bundle/audio loading, source revision checks, idempotent per-ayah rewards, XP caps and recoverable invalid data remain. Reviewed segmentation status is not inferred from visual grouping. No Supabase migration or new dependency is required.

## Layout and learner flow

Revision Lab keeps its existing game cards and passage setup. Surah Rush adds Express and Auto-Sprint checkboxes. Both games show a short dismissible recitation reminder, replayable via How to revise. All audio controls are inside the game viewport. The desktop Defense ribbon uses compact context plus three answer columns, visible without a primary-panel scrollbar; Arabic wraps rather than truncates. Narrow layouts retain readable stacked/touch alternatives and may scroll their bounded choice area. The battlefield remains separate from the reading panel and the shop.

Full selected ranges still complete only at their real endpoint. Surah Rush's existing 25-ayah full-surah choices and Defense's seamless internal boundaries are retained. Gameplay completion remains supported recognition, not certified spoken mastery.

## Final persistence safeguards

New-format campaign keys hash `[4, game, canonicalRefs]`; existing `[1, game, canonicalRefs]` keys remain available. New clients resume an existing legacy run when appropriate, but never overwrite its grouping under an older client. Explicitly choosing the new plan forks the modern key and retains the legacy record. The game IDs and per-ayah reward identities are unchanged. A saved setup differing from the selected setup offers **Archive saved attempt & start new plan**; there is no silent reset.

Queued source rewards are flushed under their original fingerprints before archiving. The prior attempt retains its planner, movement/wave snapshot, source pins, settings and assistance evidence. A fresh attempt clears its current assistance flags without erasing the archived evidence. Historical attempts remain bounded by the existing 50-attempt history policy; recent recognition diagnostics are bounded to 300 events, while canonical coverage, source pins and existing FSRS records remain separate.

The current wave, active neutral enemies, resources and movement snapshot are saved on pause/background/pagehide and at bounded five-second intervals during active play. No database round trip is introduced into the render loop. Save failures retain recovery/export behavior instead of resetting progression. A final-wave checkpoint cannot respawn defeated enemies or wait forever for an already completed final wave. A legacy context-only final review earns zero points; the existing first-defense allowance is attached to the final newly targeted group so a tiny passage remains playable.

## Changed files

Source:

- `src/revision/adventures/content.js`: versioned grouping, canonical distractor slices and source-backed unit metadata.
- `src/revision/adventures/defense-waves.js`: new neutral roster and deterministic escalating wave plans.
- `src/revision/adventures/defense.js`: wave execution, specialized defenses, bounded restoration and context-safe construction income.
- `src/revision/adventures/defense-art.js`: original family silhouettes, health bars and restrained neutral pop effects.
- `src/revision/adventures/rush-course.js`: ten layouts, weighted anti-repetition and Express geometry.
- `src/revision/adventures/rush.js`: rail/wall/lift/tunnel interactions, Express flow, reading-aware approaches and deliberate Auto-Sprint commits.
- `src/revision/adventures/rush-art.js`: terrain/rail/wall/curve/gap rendering matching physical geometry.
- `src/revision/adventures/store.js`: additive validated planner/wave/input/evidence fields and fresh-attempt state.
- `src/revision/adventures/ui.js`: audio modes, compact controls, correct recognition assistance, explicit plan upgrades, safe reward flushing and wave persistence.
- `src/revision/adventures/ui.css`: compact non-scrolling desktop ribbon, responsive controls, visible shop costs and expanded-view corrections.
- `src/revision/ui.js`: minimal additions to existing setup for Express and optional Auto-Sprint.

Tests:

- `tests/revision4-model.spec.js`: grouping, distribution, threat budgets, representative combat balance, 4,000 seeded junctions, 720 physical paths, Express comparison, Auto-Sprint, actual mechanism interactions and final-wave restoration.
- `tests/revision4-ui.spec.js`: full-ayah audio modes, assistance, eight viewports, Al-Mulk sources, setup/archive behavior and actual family spawning.
- `tests/revision4-routes-ui.spec.js`: actual movement through all ten recovered route layouts with genuine game rendering.
- `tests/revision4-legacy-ui.spec.js`: context-only review economy, background/reload state and old-client key isolation.
- `tests/rush3-helper.js`, `tests/rush3-ui-helper.js`: physical control drivers extended for the new routes; no correctness outcomes are injected.
- `tests/rush3-model.spec.js`: explicit legacy-generator compatibility checks; canonical source checks reflect the reduced new unit count.
- `tests/defense21.spec.js`: the previous balloon roster test explicitly exercises preserved historical wave behavior; new variants have dedicated v4 tests.

No canonical source dataset, backend function, SQL migration, subscription rule or FSRS implementation is modified.

## Validation and evidence

Baseline: 29 existing model/Defense/route tests passed before implementation. Focused follow-ups include 26 new model cases, 63 host/legacy/Defense/route regressions, the complete 206-ayah Al-Araf host journey, all ten route screenshot journeys, and 36 backend policy tests. Exploratory runs exposed and fixed route interference, lift landing tolerance, saved-plan ambiguity, stale replay assistance and current-wave persistence; interrupted exploratory runs are not counted as successful full-suite runs. The final full-suite result is recorded below when it finishes.

The full Al-Araf test uses exact ignored operator sources and mocked authorization transport. It steers physical controls through every selected unit, checks all eight 25-ayah choices, replays a section, reloads/resumes, reaches 206/206 and verifies no FSRS grades or private source text enter the campaign store. Al-Mulk uses exact locally prepared 67:1–5 sources. Existing long-pilot tests exercise available 2:255 and 2:282 assets. These are local authorized-source fixtures, not authenticated production account verification or proof that all those private sources are published live.

Desktop/tablet/phone coverage: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×667 and 844×390, plus existing DPR2 two-thumb/reduced-motion tests. Desktop context and all three answers are checked without a primary-panel scrollbar. Narrow screens retain bounded internal scrolling where necessary. Screenshots were visually inspected for Arabic legibility, field size, controls and shop costs.

Screenshots in this directory:

- `defense-*.png`: actual free-source gameplay showing the compact panel and responsive layouts.
- `route-{spring,ramp,lift,wall,rail,hills,tunnel,loop,gaps,conveyor}.png`: actual engine movement in explicit recovered-layout test fixtures, before committing an Arabic answer.
- `enemy-{walker,scout,shielded,armored,boulder,rover,tank}.png`: actual host rendering from explicit saved-wave-10 test scenarios. Their starting towers/wave are test fixtures, not a claim that a human earned those resources.

No private Arabic source screenshot is included in this report. The original Surah Rush screenshot tests may regenerate their separate evidence directory, which is outside this commit.

## Operator and deployment notes

No Supabase migration, new audio download, new engine or package is required. Existing server content/audio authorization remains necessary. Finish the usual build and exact-commit Railway deployment, verify `/build-info.json`, then open both games through Revision Lab and test real keyboard/touch alternatives. Public verification does not substitute for a private developer/premium test-account session.

Capacitor assets can be synchronized with `npm run native:sync`; this does not distribute a signed native app or prove physical-device behavior. No native signing, Capgo upload, App Store/Play submission or physical-device verification is claimed here.

Rollback: preserve/export the campaign store, then redeploy the prior known-good `2758b9b277b8e282b0685460e8686b53c438aaf0` if needed. New-format versioned keys remain stored for updated clients; older clients use their legacy keys rather than interpreting new groups as old ones. Do not clear learning storage or merge different planner indices by guessing.

Unverified operator checks: real hosted account A/B, developer/premium access and subscription-expiration sessions; physical iPhone/Android audio/touch testing; end-user balance evaluation with learners. A Supabase management token/test-account session was not available. These limits do not justify weakening entitlements, claiming source publication or advertising certified spoken recall.

Old-client isolation is implemented with versioned campaign keys, not by changing canonical ayah IDs or the shared storage envelope. New clients prefer their modern key but can resume a genuine older key. The explicit upgrade action retains the older-client record byte-for-byte apart from legitimately flushed pending rewards, and archives the old unit plan under the new attempt. This also keeps source-based XP receipt identities stable across versions. A regression stages a genuine legacy hash and verifies both records coexist safely.

Construction income retains the existing bounded per-decision/per-ayah rules: at least 20 and at most 80 Construction Points per ayah, distributed over newly targeted groups; contextual reviews earn none. Fewer groups can reduce total income for an individual passage while increasing revision throughput; no free expensive towers are added to compensate. The six-role economy regression therefore earns until the actual combined purchase cost is met rather than assuming the old fragment count at an arbitrary ayah cursor. Tower prices, upgrade costs, XP and first-defense safeguards are unchanged.

## Release test results

The broad run executed **1,332 cases: 1,325 passed, 4 skipped, 3 failed** (22.9 minutes). The failures were: the phone battlefield exactly meeting an older strict height threshold; an economy test assuming the former fragment count funded all six towers after 39 ayahs; and missing Playwright video-encoder tooling after workspace restart. They were not reported as an all-green broad run.

All three were corrected/rechecked. The layout now reserves the required tall-phone battlefield minimum, the economy test earns the actual purchase total using canonical revision, and the video case passes using the available system ffmpeg through a temporary Playwright binary path. No application dependency was added for this tooling issue.

**63 post-fix affected tests passed**, including the entire Al-Araf 1–206 physical journey, all eight checkpoint choices, 2:255/2:282 pilots, exact Al-Mulk source progression, purchase/placement, wave balance, layout, accounts, source revisions and lifecycle tests. A final **22-case audio/UI follow-up passed**, including manual replay after pause, resuming the current ayah after a paused source change, concealing old context when switching to Expert without moving the group, preserving prior assistance, and recording assistance when volume is raised in pause settings. A concealed transition cue no longer falsely marks Expert recognition as assisted.

Other completed checks: **36 backend policy tests**, **4 production offline tests**, the recorded mobile Ayah Blocks regression, production Vite build, Capacitor synchronization and native bundled-configuration/secret checks. All identified failures from the broad run have passing follow-up evidence. Physical-device and real hosted account checks remain unverified as noted above.

Additional changed test files: `tests/defense2-combat.spec.js` uses actual affordable purchase totals; `tests/revision4-control-edges.spec.js` contains the five final audio/settings/assistance regressions.

Operator evidence is retained under `/workspace/artifacts/`: `revision4-final-suite.log/json`, `revision4-release-checks.log`, `revision4-final-audio.log`, `revision4-video-recheck.log`, `revision4-backend.log`, `revision4-offline.log` and the build/native logs. Early interrupted/exploratory runs are retained separately and are not counted as successful release runs. Exact deployed commit and public-site verification are stated in the final implementation report after deployment; staging and authenticated production verification are not implied.
