# Meteor Defense 3.0 — audit, implementation and evidence

## Completed upgrade

The existing Protect and Capture launch now defaults to a continuous intelligent ray. The original free-only mission rules, authorized PassageContext content adapter, legacy gateway-defense game, source plans, word identities, full-ayah audio, reward rules and FSRS workflow remain in place.

| Audited behavior | Repair / resulting behavior |
|---|---|
| Tractor committed instantly from up to 450 units | Actual time-based pull into collection radius; interrupted pulls retain position, then slowly drift home |
| Manual blaster/tractor switching, projectiles in capture mode | One held Space/FIRE control; nearest ray/circle intersection selects continuous meteor damage or protected tractor behavior |
| Lock bypassed intervening geometry | A foreground meteor blocks the carrier ray until intercepted; geometry never checks answer correctness |
| Pointer aimed only while pressed; instantaneous rotation | Hover/drag aiming with responsive-coordinate mapping, shortest-path rotation and continuous A/D/arrow alternatives |
| Touch release could cancel an unrelated pointer | Separate captured aim/fire pointer identities; cancel/lost-capture cleanup; defensive capture guards |
| No accessible click-only firing alternative | Screen-reader activation supplies a bounded beam pulse; keyboard and hold inputs remain available |
| One neutral wave for an entire word workspace | Finite deterministic wave per piece, pending early-capture state, safe untimed capture and automatic progression |
| Wrong capture could simply redirect a carrier | Exactly one strike, intact red feedback, repeated deterministic defense objective and capture lockout during retry combat |
| Retrying identical waves could re-emit interception points | Page/piece/meteor receipts persisted and deduplicated independently of recognition/XP receipts |
| Protected carriers only absorbed bullets | New beam never damages carriers; neutral meteors reflect with bounded substeps, damped velocity, separation and repeat-contact guards |
| Legacy all-words-captured but unfinished-wave save | Canonical prefix retained and the unfinished last defense objective remains pending, not silently skipped |
| Sequence/progress could sit outside the game viewport | Current reference/piece count in compact HUD; assembled sequence in the game's existing control deck |

Full/partial source learning progress survives safe retries. Motor/core events and memory strikes are distinct. Full-ayah recordings remain authoritative; no phrase stitching, generated Arabic, pronunciation scoring or automatic mastery is introduced.

## Modules and contracts

- `defense-beam.js`: nearest ray intersection, shortest-angle calculation, beam timing constants, deterministic shield reflection.
- `defense-intelligent.js`: default capture-v3 engine, heat/rearm, pull/return, finite per-piece waves, pending captures, wrong-wave recovery, stable score receipts and additive checkpoint metadata.
- `defense.js`: reuses neutral core physics, patterns, abilities and health; bounded continuous beam damage and capture-only reflections; no ordinary projectiles/burst bullets in upgraded gameplay. Legacy noncapture behavior remains intact.
- `defense-capture.js`: delegates normal launches to v3; retains the old instant-capture model as an explicit compatibility adapter (`intelligentBeam:false`).
- `defense-capture-host.js` and `quest/cosmic/controller.js`: carry the default v3 option through existing directors without a new content/learning store. `defenseBeamVersion:2` exists for explicit legacy-model compatibility tests, not learner weapon selection.
- `defense-capture-ui.js`, `defense.css`: one FIRE control, accessible aiming, compact HUD, docked source sequence, gold/red actor feedback, gold trail to the sequence, shield flashes and reflected-direction arrows. Existing shared encouragement preferences control decorative success effects. No competing audio/feedback preferences were created.
- `defense3-helper.js`, `defense3.spec.js`, `defense3-ui.spec.js`: deterministic pilot, model tests and actual keyboard/touch/accessible UI checks.
- Existing `defense5` model tests explicitly exercise the retained v2 model; UI tests now hold the actual beam rather than invoking instant legacy capture. Legacy gateway-defense tests are unchanged.

The same `ayah-cosmic-defense-capture-v1` envelope carries additive `mechanicsVersion:3`, pending-piece/wave cursor, retry-wave state, score and deduplicated receipts. Arabic/audio are reconstructed from authorized sources, not added to checkpoint storage. Old canonical prefixes upgrade without rewriting historical results. Unknown mechanics/source revisions remain recoverable. Transient actor positions/heat are not persisted: interrupted motor waves restart safely while source-prefix progress remains. No Supabase migration is needed.

## Tuning and fairness

- Continuous beam: **1.5 seconds maximum**, **0.3 seconds cooling**, explicit release to rearm; held Space cannot auto-repeat after overheating.
- Neutral contact damage: **5 HP/second**, about 0.2 seconds for a normal meteor and 0.4 for a stronger one.
- Pull speed: **420 arena units/second**, collection radius about 90 units. Tested aligned holds of 1.05–1.1 seconds complete home-position captures, so the requested default duration did not need increasing.
- Relaxed / Normal / Arcade: **7 / 11 / 14** meteors per piece, with the existing seeded ring/crossfire/sweep patterns and separate motor difficulty.
- Reflection: 120 Hz physics substeps, damped velocity, outward separation, 0.35-second repeat-contact guard, bounded repeated-bounce escape. Escaped neutral hazards can resolve a wave without awarding interception points.
- Long-frame interruption above 0.25 seconds pauses safely rather than applying catch-up damage.
- Correct-answer homes are mixed deterministically and spread over all three slots across 60 tested seeds. Shape/size/colors do not encode correctness.

## Test evidence

Final validation passed:

- **116 tests** in the combined Meteor Defense, Revision Lab, campaigns, persistence, policies, storage and mobile regression run.
- **22 tests** in the final affected model/UI/premium-boundary run after adding the explicit in-game briefing and stricter recovery checks.
- **16 model tests** after adding deterministic completed-checkpoint ID restoration, including legacy unfinished-wave recovery.
- **Production Vite build and Capacitor iOS/Android frontend sync passed**, including the private-bundle/configuration guard. `git diff --check` passed.

Counts overlap; they are separate executed runs, not a sum of distinct tests. Earlier broad regression passed 101 tests and the subsequent focused input/mobile run passed 35 tests. The initially missing Playwright FFmpeg path was pointed at the system FFmpeg before the passing mobile recording recheck.

Coverage includes nearest-hit blocking; heat/rearm; partial pull; all three motor speeds; safe and early capture; exact three-strike Classic/Practice behavior; retries and score deduplication; real shield collisions; source text preservation; balanced positions; legacy prefixes/unfinished-wave recovery; a complete authorized Al-Baqarah 2:282 grouped-source fixture; a multi-ayah chain with automatic UI continuation; audio cleanup; accessible activation and two-thumb event handling; old histories; XP/FSRS separation; account changes; content revocation; saved campaigns and source revisions.

The deterministic pilot uses only the real aim/fire/ability/tick APIs. It does not inject answers, actor positions or collision results. Browser fixture audio is mocked; private passage tests use controlled verified fixtures. These are not real hosted Supabase entitlement certification, human reading-speed evaluation, physical-device testing or speech assessment.

A model-only Node sample of 1,200 arcade ticks measured approximately **0.128 ms average / 0.201 ms p95** on this workspace, with a maximum of seven simultaneous model objects in that sample and three carriers. This is a CPU sample, not measured mobile frame pacing or a worst-case object bound. The implementation bounds waves at 14 neutral meteors and core effects at 12; private source stages remain bounded by existing adapters.

## Inspected desktop and mobile gameplay captures

These are actual local Chromium states with deterministic simulation timing. Gold/red screenshots require visible feedback; ricochet screenshots require an actual reflected neutral meteor. Keyboard input drives the first capture; the deterministic pilot completes later waves/chain through the same engine APIs.

| State | Desktop | 390px phone |
|---|---|---|
| Laser interception | [View](desktop-laser.png) | [View](mobile-laser.png) |
| Tractor pull | [View](desktop-tractor.png) | [View](mobile-tractor.png) |
| Correct capture | [View](desktop-gold.png) | [View](mobile-gold.png) |
| Incorrect capture | [View](desktop-red.png) | [View](mobile-red.png) |
| Shield ricochet | [View](desktop-ricochet.png) | [View](mobile-ricochet.png) |
| Safe capture | [View](desktop-safe.png) | [View](mobile-safe.png) |
| Completed chain | [View](desktop-complete.png) | [View](mobile-complete.png) |

## Remaining limits

Physical iPhone/Android performance, VoiceOver/TalkBack, headset interruption and real staging authorization still require operator/device testing. The circle simulation is mapped through the responsive arena; the visual shells may appear oval in portrait. Source readability takes priority over an undistorted decorative field. Long multiword cards and extensive sequences may need scrolling within their bounded in-game reader/deck. Checkpoints remain in the existing account-scoped local store; no new cloud-sync schema is introduced.

No live feature flag, private-content publication, Stripe configuration, Supabase migration, Railway deployment, Capgo publication or store submission is performed by this implementation task. Native frontend synchronization is not a native binary build or physical-device test. Earlier unrelated prelaunch work remains separate.

Sanitized command evidence: [116-case regression](evidence/regression.log), [22-case final affected suite](evidence/affected-final.log), [16-case final model suite](evidence/model-final.log), [production build/native sync](evidence/build-native.log).
