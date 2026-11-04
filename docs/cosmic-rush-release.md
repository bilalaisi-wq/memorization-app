# Cosmic Rush Phase 8 — release validation

Validation date: November 4, 2026 (America/Chicago). This report concerns the local implementation, not a claim that Railway or the live Supabase project has been deployed and verified.

## Changes and audit findings

The existing hybrid expedition already coordinates real Star Runner flight, Meteor Defense, adjacent-ayah Link demonstrations, evidence-backed boss shields and native self-assessed passage recall. This phase preserves those engines and improves their presentation and lifecycle. No separate legacy Ayah Relay engine was found; the existing standalone Runner, Defense and Link entries remain available.

- **Lazy UI:** the Revision Lab imports activity renderers and expedition screens only when requested. Expedition activities are also loaded on demand. Existing generation guards reject stale launches after navigation. Candidate pools are warmed once per kind before flight instead of introducing first-use work during a moving wave.
- **Readable Arabic:** compact screens use the existing wide, staggered capsule treatment when an unbroken word would overflow a lane. The original word, diacritics, canonical ID, unit kind and audio remain unchanged; no Arabic is shortened, regenerated or split to fit. Short-word font sizing is checked against the complete free library.
- **Audio:** a shared Cosmic mute toggle works across activities; an explicit volume of zero survives activity changes. Players clean up preference listeners and interrupted media. Existing Quran-priority hooks suppress encouragement effects during recitation. Full ayahs use the original recordings; flowing word cues use existing verified independent word files, not synthesized or cut-and-spliced phrase recitation. Word-by-word educational playback is not presented as a certified recitation stopping pattern.
- **Effects:** Night Sky colors, restrained layered backgrounds, thruster trails, shield response, boss phases and gold constellation connections share a consistent treatment. The completed-route constellation requires actual ayah and internal-transition coverage, including stage seams. Full-surah language is used only for the entire canonical surah. Its animation is skippable and grants neither mastery nor a recall grade.
- **Accessibility:** keyboard focus survives gateway, hint and recall rerenders. Partially entered Arabic is retained during hint/audio redraws. Header/navigation focus is not stolen. Controls have visible focus, large touch targets, alternative buttons to swipe and readable contrast. Minimal effects, the site's reduced-motion setting and the operating-system preference reduce decorative movement. Low-memory/two-core device hints default to minimal effects without changing learning rules.
- **Work while paused:** static HUD nodes are reused and written only when values change. Link geometry is measured on rebuild/resize rather than every frame. Paused and hidden game lifecycles retain the existing safe recovery behavior.

No dependency, game engine, Quran import, segmentation revision, FSRS parameter, subscription policy or database migration is added in Phase 8. Existing progress and recovery documents are retained. The only new preference key is `ayah-cosmic-preferences-v1`; it is profile-local, included in local backups and separate from learning/cloud documents. Malformed settings are preserved rather than silently overwritten.

## Source changes

| Area | Files |
| --- | --- |
| Shared polish | `src/quest/cosmic/preferences.js`, `focus.js`, `celebration.js`, `polish.css`, `release.js` |
| Navigation and lazy loading | `src/revision/ui.js`, `src/quest/cosmic/expedition/ui.js` |
| Activity accessibility and controls | `src/puzzles/arcade/cosmic/{ui,defense-ui,link-ui,gateway-ui}.js`, `src/quest/cosmic/expedition/boss-ui.js` |
| Responsive flight | `src/puzzles/arcade/cosmic/flow-runner.js`, `src/quest/cosmic/controller.js` |
| Media and profile preferences | `src/puzzles/arcade/services.js`, `src/puzzles/audio-level.js`, `src/learner/profile-storage.js` |
| Reproducible checks | `tests/cosmic-polish*.spec.js`, `scripts/profile-cosmic.mjs`, `scripts/check-cosmic-rollout.mjs`, `package.json` |
| Documentation | This guide, `docs/cosmic-rush-performance.json`, link from `docs/cosmic-rush-spec.md` |

## Learner instructions

Open **Your Space → Revision Lab → Cosmic Rush**. Choose a free surah and five, ten, fifteen, twenty ayahs, a contiguous custom range, or the entire surah; shorter surahs can be selected in full. Read the briefing and launch the activity or expedition.

- **Star Runner:** steer with Left/Right or A/D; Space fires at neutral asteroids; B boosts. On a phone, use the lane, blaster and boost buttons or swipe. Move into the correct Arabic pickup. Quran words are redirected, never attacked by blasters. The target cue slows flight without imposing a timed recitation assessment.
- **Meteor Defense:** aim using the existing pointer/keyboard controls or large touch controls. Defend the core against neutral meteors. Quran gateways remain on the game screen. The full target ayah repeats during its wave; untimed memory choices provide abilities and recovery.
- **Ayah Link and bosses:** listen, connect the canonical ending/opening, request hints or retry. Supported recognition and typed practice are not automatic certification of spoken recall. Reviewed phrase repair is available only when approved source-backed boundaries exist; otherwise whole-ayah challenges remain available.
- **Pause** before interruptions; use **Resume**, **Restart** or return to the lab. Adjust the recitation volume or choose **Mute recitation**. Muting does not disable progression. **Minimal effects** reduces decoration while preserving mechanics. Expand the short help sections for detailed controls.
- At the final oral challenge, recite before revealing the verified text, compare honestly and use Again/Hard/Good/Easy. This existing native self-assessment is the path to FSRS scheduling; an arcade victory does not submit a successful recall rating.

## Release control and data setup

The existing Vite opt-out rollout convention is used: `VITE_COSMIC_EXPEDITIONS_ENABLED=false` hides the hybrid expedition entry, saved-route cards and focused expedition repair launches. Standalone flight, Defense and Link remain available and saved data is retained. Change this build-time variable in Railway and rebuild/redeploy; it is not a runtime database toggle. Removing it or setting it to `true` enables the entry. This is a presentation rollback, not content authorization.

`npm run check:cosmic-rollout` creates a separate disabled production build and runs a browser smoke check: the expedition entry is absent, standalone flight accepts movement/blaster input and the saved document is unchanged. It does not alter the normal `dist` build. The script currently writes its disposable output under `/workspace/artifacts` in this cloud environment.

There is **no new SQL to paste for Phase 8**. Private cross-device sync still requires the earlier [SETUP_COSMIC_PROGRESS.sql](../supabase/SETUP_COSMIC_PROGRESS.sql) and its prerequisites; see [Phase 7 setup and conflict recovery](cosmic-rush-phase7.md). Apply the entire SQL contents, not its filename or Markdown. Neither these local tests nor this report assert that this migration is installed on the live project. Guest play remains local; account isolation, opt-in sync, compare-and-swap writes and native passage recall storage retain their existing contracts.

Cosmic content remains restricted to Al-Fatihah and surahs 78–114 regardless of subscription or developer privileges. RLS, premium source authorization and account ownership are not replaced by UI hiding. Existing approved/unapproved segmentation distinctions remain enforced.

## Verification evidence

Commands and results are recorded below. Browser tests use the actual Vite application and real game engines. Some deterministic scenarios replace audio/network with fixtures, while the existing audio suite separately decodes bundled MP3 files. A passing local fixture is not proof of every mobile browser or external media provider.

- `npm run build`: passed. Main-entry output changed from 312.85 kB / 98.33 kB gzip to 190.12 kB / 60.65 kB gzip (about 38% smaller). This is the **main entry**, not the entire download. The existing shared content-availability chunk still exceeds Vite's 500 kB advisory; it was not rewritten to achieve a misleading warning-free build.
- New Phase 8 checks: 9 passed across `cosmic-polish.spec.js` and `cosmic-polish-ui.spec.js`. Includes all 38 eligible surahs × all six passage selection types, source/diacritic preservation, compact word typography, keyboard/touch actions, mute/zero volume, cleanup, focus and Arabic draft retention, reduced effects, exact constellation coverage, contrast and touch sizes.
- Focused mission, flowing content, Link, cue and expedition model checks: 33 passed.
- Backend suites: content 6, billing 7, recitation 5 and coach 5 passed (23 total). `check:content`, `check:billing`, `check:recitation` and `check:coach` also passed Deno type checks. These use controlled requests/provider fixtures; they do not charge live cards or send real learner audio.
- Disabled-production-build rollback smoke: passed; standalone interactive flight and existing saved progress retained.
- Enabled production-preview smoke: passed real lane movement, blaster projectiles, correct pickups to a checkpoint, pause/resume, Runner → Defense transition, moving meteors, defensive energy projectiles and clean navigation exit; no page errors. Audio was fixture-controlled in this smoke check.
- Complete repository run: `npm test -- --workers=2` executed **608 tests in 25.5 minutes: 607 passed, one new test-fixture readiness race failed**. The celebration fixture attempted to append its host before asynchronous app mounting created `main`; no game assertion failed. It now waits for the real main element. The corrected case passed on a separate targeted rerun: `npm test -- tests/cosmic-polish-ui.spec.js --grep 'full-surah celebration' --workers=1 --output=/workspace/artifacts/phase8-fixture-rerun-results` (**1 passed, 8.4 seconds**). Thus every case has a passing result after correction, but this is **not** a claim of a second clean 608-case invocation. No application source changed during or after the full run.
- The broad run includes the previously excluded long Runner stage case (**passed, 3.2 minutes**), the complete Al-Ikhlas hybrid expedition (**passed, 3.6 minutes**), actual browser recording/decoding and the full learning → arcade → independent recall → revision/repair journey. Production build, all four backend type-check commands and `git diff --check` passed.

Coverage includes game input/physics, actual pickups and combat, full multi-stage journeys, repeated text, approved/unapproved segments, checkpoint/reload/route exit, rapid action guards, idempotent rewards, native recall, account separation and SQL policies. The all-surah sweep validates deterministic content and mission construction; it is **not** 38 manually completed full-surah flights. SQL/RLS checks use PostgreSQL-compatible PGlite with roles, not the live Supabase project.

### Performance sample

`npm run profile:cosmic -- /workspace/artifacts/phase8-performance-after.json` profiles headless Chromium at a 390-pixel viewport against the local development server. It performs real keyboard movement/firing and samples rAF cadence, simulation advancement, paused mutations and CDP heap/DOM counts. Raw evidence is retained in [cosmic-rush-performance.json](cosmic-rush-performance.json).

| Metric | Normal CPU | Synthetic 4× CPU throttle |
| --- | --- | --- |
| Frame p50 / p95 | 16.7 / 16.7 ms | 16.7 / 49.9 ms |
| Maximum sampled frame interval | 33.4 ms | 83.3 ms |
| Simulation advanced during sample | 3.07 s | 3.28 s |
| Writes while actually paused | 0 | 0 |
| Visible game nodes after exit | 0 | 0 |
| JS heap after third exit | about 11.05 MB | about 11.09 MB |

Both runs remained actively running through the sampled interval. After repeated exits, DOM/listener counts settled to 782 nodes / 131 listeners. Earlier snapshots can include detached nodes pending collection; this short sample is not a leak-free long-soak claim or process-memory measurement. Initial launch including font readiness was 2.43 s normal / 8.77 s throttled; a warm local development launch is not a cold production-network benchmark. The 4× sample does not sustain 60 FPS. Minimal effects and the existing lag-safe pause provide fallbacks; physical-device profiling remains required.

## Remaining public-release checks

Local functional validation does not eliminate the following release conditions:

1. Apply/verify the Phase 7 migration in the target Supabase project, then test sign-in/out, two real accounts, two devices, offline edits/conflicts and live RLS/entitlement boundaries. Do not delete progress to resolve a migration prerequisite.
2. Manually deploy the reviewed commit in Railway. Verify the public Revision Lab, cache refresh, rollback variable and audio URLs after deployment. No automated production deployment was performed here.
3. Smoke-test real iOS Safari and Android touch/audio permission behavior, interrupted playback, OS reduced motion and a physical lower-performance device. Headless Chromium and synthetic CPU throttling are narrower evidence.
4. Conduct a longer memory/performance soak and a human RTL/Arabic readability review across representative long words and repeated phrases. Automated text identity checks cannot certify recitation or all visual edge cases.
5. Preserve the distinction between recognition, learner self-assessment and verified/teacher-reviewed evidence. No speech/tajweed certification is introduced.

Until live deployment, live authorization and physical-device checks pass, this should be described as a locally validated release candidate, not independently certified production readiness.
