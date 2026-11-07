# Cosmic Rush Phase 4 — Meteor Defense

Ayah Quest 3.0 Phase 5 adds [Protect and Capture](meteor-defense-protect-capture.md): protected Arabic carriers, tractor targeting and bounded shared-passage workspaces. The rules below document the retained legacy gateway mode.

Phase 6 update: [Saved expeditions and Weak-Link Bosses](cosmic-rush-expeditions.md) now coordinate these activities and offer final native passage recall. Release details below describe the original standalone implementation.

Meteor Defense is a playable second activity in the regular Revision Lab. It uses the existing Vite/vanilla JavaScript stack, a bounded SVG battlefield, the same canonical mission manifest and the same mission director as Star Runner. No engine dependency, Quran import or database migration was added. Later campaign phases coordinate Weak-Link Boss and final self-assessed oral recall; this document describes the original defense activity rather than those campaign additions.

## Start and transitions

Revision Lab → Cosmic Rush → choose a free contiguous mission → View mission briefing. Select a defense configuration and launch Meteor Defense, or launch Star Runner and choose **Defend the core** after clearing a Runner checkpoint. A Defense victory offers **Continue in Star Runner**. Returning restores the exact existing Runner checkpoint and collected pieces when one exists. Direct Defense launch can hand over to a fresh Runner stage within the same mission.

The director owns both pure activity engines, stage/round indices, deduplicated points/checkpoints and a shared run ID. Switching is allowed only at a safe completed checkpoint. An inactive engine is retained as pure checkpoint data, with no animation loop, input listeners or media. UI handovers abort listeners, dispose SVG nodes/audio and unsubscribe the old view. Advancing to the next round/set disposes both old engines. Completion coverage is counted separately for each activity. Reaching the last route position after switching activities does not claim earlier, unplayed checkpoints or expose an inactive next-stage action. Existing Runner-only continuation remains available; this is not yet a mandatory full hybrid campaign.

## Mechanics

- A turret ship orbits a central celestial energy core. Aim with the pointer, touch, Left/Right or A/D, the large on-screen aim buttons, or the accessible aim range input.
- Space or Fire launches actual energy projectiles; holding fires repeatedly. Bullets travel and collide with neutral moving meteors. Larger meteors need two hits. Missed shots are motor events, not memory mistakes.
- Ring, crossfire and sweep trajectories use deterministic seeds. Sets contain at most five canonical ayahs, each with an untimed memory checkpoint and a separate combat wave. Meteors approach from several directions; there is no word-order lane mechanic in this activity.
- Neutral impacts damage the core. Securing a wave requires defending at least 40% of its meteors and retaining positive core health. After the last wave, an explicit victory checkpoint is shown. Core failure or insufficient defense offers a motor recovery retry; observed Quran recognition progress remains intact.
- Motor retries refill core integrity and replay the same wave without granting more recognition charges or duplicate meteor points. Full Restart defense set restarts the current set's memory/combat flow. Repair Beam can also revive an offline core when a charge remains and the wave can still be secured. A quota-only failure with no remaining meteors requires Retry wave; it cannot waste a repair charge on an unwinnable continuation.

| Configuration | Core integrity | Turret turn rate | Fire cooldown | Base meteor speed |
| --- | ---: | ---: | ---: | ---: |
| Balanced | 100 | 2.5 rad/s | 0.22 s | 65 units/s |
| Fortress | 130 | 1.9 rad/s | 0.30 s | 58 units/s |
| Agile | 90 | 3.2 rad/s | 0.16 s | 72 units/s |

Slow pace reduces meteor travel speed. Later stages/rounds modestly increase meteor count and speed. These are motor configurations, not measures of Quran mastery.

## Memory and abilities

Before each wave, combat and action timers stop completely. The existing untimed Quran gateway panel prompts the learner to recite the next ayah before revealing three authentic, distinct candidates. Candidates are compared by canonical ayah ID. Preceding-ayah listening, full-ayah hint playback, explicit readiness and educational retry are reused. No recitation timer or automatic speech certification is introduced.

A correct choice grants one charge of each ability, capped at two stored charges per ability. Incorrect choices grant no charges, do not damage the core and lead to an untimed repair opportunity. Hint-assisted choices remain labeled supported recognition; neither they nor unassisted multiple-choice answers become FSRS grades.

| Key | Ability | Actual effect |
| --- | --- | --- |
| 1 | Star Shield | Blocks neutral core impacts for five seconds. |
| 2 | Pulse Wave | Clears neutral meteors within 220 world units. |
| 3 | Repair Beam | Restores up to 36 integrity; can revive a core. Full-health use is disabled. |
| 4 | Constellation Burst | Launches eight radial projectiles with real hit detection. |

Timing abilities is part of the motor strategy. No amount of firing, listening or navigation grants recognition charges. The summary separates core impacts from Quran-choice repairs.

## Learning integrity and privacy

Only Al-Fatihah and Juz Amma are eligible. `createFlightController` rebuilds/compares the canonical manifest; the defense engine also validates consecutive free references. Arabic is shown only in the separate accessible RTL gateway panel. The physical SVG layer contains no Quran text: only neutral meteors, the core, projectiles and cosmetic effects.

The existing `ayah-cosmic-gateways-v1` store is extended compatibly for supported Defense recognition and completion summaries. No historic records are reset. Shared run IDs keep Runner and Defense events in one run. Motor failures, assistance and observed selection mistakes remain distinct. Malformed histories are preserved for recovery. Account changes dispose media and controls; reward writes check profile ownership around asynchronous hashing.

Defense interceptions earn arcade points, deduplicated per mission/activity/stage/round/meteor. Correct Quran checkpoints can earn 4 supplementary XP through the existing lab/day/ayah/action caps and stable receipts. Replays cannot duplicate XP or mission points. Existing opt-in leaderboard publishing/privacy applies. No Defense action updates FSRS or memorization mastery. No backend or raw audio storage is added.

Combat has no loud sound effects. Quran playback is owned, volume-controlled and exclusive: continuing combat, pausing, changing activities, leaving the mode or switching accounts stops it. Phase 4 memory prompts are deliberately untimed paused checkpoints; Star Runner's guided target cues retain their existing slow-moving playback behavior.

## Star Runner boost adjustment

Boost travel changes from **1.65× to 2.31×** (old boosted speed multiplied by 1.4), retaining four seconds of fuel, the B key/tap control, correct-pickup star bursts and capped rewards. This does not alter the 5:1:4 target mix, canonical ordering, required revision rounds or base round difficulty.

## Performance, accessibility and limitations

The defense simulation uses bounded 1/120-second steps and pauses on large timing gaps instead of applying catch-up damage. Active data is capped at 10 meteors, 32 projectiles and 12 short effects. SVG nodes are reused. Pointer mapping accounts for the SVG's aspect-preserving letterbox. Large touch controls, keyboard aiming/firing/abilities, an aim slider, readable RTL text and reduced-motion presentation are available. The arena scrolls back into view when combat begins.

Automated tests cover all configurations/wave types, genuine shooting/aiming, failure and repair, all charged abilities, source restrictions, deterministic solvability, idempotent rewards, Runner↔Defense handovers, profile disposal, mobile touch/width and audio cleanup. Screenshots are written to `/workspace/artifacts/meteor-desktop.png` and `/workspace/artifacts/meteor-mobile.png` during browser checks. Responsive Chromium tests and bounded simulation tests are not a physical-device FPS certification.

Campaign animation state remains in-session; closing/reloading ends the current flight, as before. Evidence and existing progress remain saved. Cross-device campaign resume, the remaining hybrid activities and certified spoken assessment are outside this phase.

Final verification: 89 distinct focused cases passed across completed runs and targeted reruns. This includes the 86-case Cosmic/shared-arcade/Snake/Falling Words/rewards regression, the original multi-stage Runner browser journey, the quota-recovery edge case and per-activity completion coverage. Targeted Defense/reduced-motion reruns also passed. Production build and `git diff --check` passed. This is focused regression verification, not a run of the full application suite or a live physical-device FPS certification.

Phase 5 adds [Ayah Link](cosmic-rush-ayah-link.md) to the same checkpoint handovers. The director now retains three available pure activity engines; disposal and per-activity completion rules are unchanged.
