# Cosmic Rush Phase 3 — Quran memory gateways

Current public flight: [flowing Quran pickups](cosmic-rush-flowing-pickups.md) supersede navigation stars; untimed gateway review is optional at stage checkpoints. Earlier phase descriptions below are historical snapshots.
## Availability repair

The earlier Revision Lab/Star Runner files were present only in the working tree. GitHub `main` and the public Railway JavaScript bundle were still at the Bridge Builder version; the live bundle contained neither `nav-revision-lab` nor `Launch Star Runner`. This release includes the missing Phase 1/2 files with Phase 3 so a deployment can actually expose **Your Space → Revision Lab → Cosmic Rush** to ordinary learners on desktop and mobile. No developer flag or paid account is required for this free-content surface.

## Learning flow

The public Star Runner launch enables memory gateways. At a safe interval after a wave, the controller pauses the engine in orbit. Simulation elapsed time, hazards, shields and descent remain frozen for as long as the learner needs.

1. Show the actual preceding ayah, with optional verified full-ayah audio.
2. Prompt the learner to recite the next ayah aloud before choices are shown.
3. Wait for **Ready — show gateways**. This is a self-reported readiness action, not speech verification.
4. Display three complete authentic candidate ayahs. Steer left/right with arrows, A/D, swipes or buttons; the selected portal, ship and full-text card stay aligned. Tapping a card selects its lane. Enter/Up from the flight field, or **Enter gateway**, commits the choice.
5. Compare canonical surah:ayah IDs. A wrong commitment enters a safe repair state; prior coverage, flight position, stars and shields remain. The learner may reveal/listen to a hint and retry without a deadline or life penalty.
6. A correct commitment opens the selected route and shows a short constellation effect. **Continue flight · skip animation** stops recitation, returns focus to flight and resumes from the frozen simulation time. Reduced motion disables the cosmetic effect. Several stable frames rebase timing after the layout transition, preventing catch-up travel.

The first selected ayah also receives a gateway. If its number is greater than 1, its true preceding ayah supplies context even when outside the selected range. For a surah opening, the prompt explicitly asks for the opening ayah and invents no predecessor. The final selected ayah is tested; no nonexistent next ayah is requested.

Every selected reference is covered exactly once per mission session, in canonical order. Five-ayah stages are only mission groups: the gateway for stage 2's first ayah uses stage 1's last ayah as predecessor. They are not approved recitation stops. Motor retries retain already-corrected gateway coverage. Replaying a cleared flight stage retains its connections; launching a new mission session starts a fresh gateway sequence.

## Content integrity

`src/quest/cosmic/gateways.js` resolves only the existing Al-Fatihah/Juz Amma source library. Premium references, padded/noncanonical references and out-of-range ayahs are rejected. It copies existing display text exactly and uses the existing full-ayah audio helper. No Quran text, word boundaries, translations, reviewed segments or audio cuts are generated or changed.

Candidates prefer the same surah and fall back to the other free surahs. Comparison-only Unicode normalization rejects equivalent full texts; matching three-word openings are excluded as an additional safeguard. The displayed Arabic remains unchanged and fully readable in RTL. Duplicate verses such as Al-Kafirun 109:3 and 109:5 cannot appear as competing indistinguishable answers. Only one candidate has the actual target identifier. Candidate IDs are retained as source provenance; source citations are shown during feedback/hints rather than used as visible numeric answer cues.

Longer free ayahs wrap in full with the existing Uthmanic font. No clipped excerpts are used to make otherwise ambiguous candidates appear different. Candidate sets are deterministic and cached per gateway rather than regenerated on every steering input.

## Modules and contracts

- `src/quest/cosmic/gateways.js`: pure gateway plan/state; prompt → choices → repair/retry or open → continue. No timers, DOM or FSRS APIs.
- `controller.js`: interleaves gateways with actual runner waves, includes gateway snapshots and blocks stage advancement until its selected references are connected. A pure motor-only option remains for existing simulation consumers/tests; the public UI always enables gateways.
- `gateway-store.js`: account-scoped practice evidence recorder with immutable per-run source references.
- `src/puzzles/arcade/cosmic/gateway-ui.js` / `gateways.css`: accessible untimed prompts, full RTL candidates, portal steering, repair/hints, focus, animation and exclusive full-ayah audio with volume/stop controls.
- Existing runner UI: safe-orbit presentation, functional lane controls and keyboard commitment, stopped timers, audio disposal and clean simulation resume.

The controller emits `gateway:orbit`, `ready`, `hint`, `retry`, `mistake`, `correct` and `continue` events (each uses the `gateway:` prefix). Events include canonical target/predecessor, gateway ID, source hash, stage index and assistance. Wrong commitments identify the selected and expected ayahs as **observed gateway-selection errors**, not recitation errors, motor collisions or independently assessed recall.

Flight `routeComplete` additionally requires coverage of every selected ayah. A correct recognition choice never becomes a native recall grade, a Tajweed judgment or memorization mastery. The full hybrid availability flag remains false: Meteor Defense, Weak-Link Boss and native final-oral handoff remain later work.

## Persistence, accounts and audio

`ayah-cosmic-gateways-v1` is a separate version-1 ledger through the existing profileStorage wrapper. It stores run UUID, mission/source hashes, canonical refs, completed coverage, timestamped readiness/assistance/selection events and cross-stage evidence. It duplicates no Arabic or audio and publishes nothing to the leaderboard. Profile changes abort the flight/audio and prevent writes for the former owner.

The key is included in account progress export. XP, legacy puzzle records and existing cloud payload whitelists are unchanged. Revealing a matching preceding/candidate/hint ayah uses the existing reportStudyExposure mechanism to mark unfinished recall as assisted; no FSRS card, grade or schedule is created by a gateway. If assistance cannot be recorded, choices stay hidden until recovery/retry. No Supabase migration is needed. This history is browser/profile-local, not newly implemented cross-device sync. Flight position still does not resume after reload; recorded gateway evidence remains available in exports.

Malformed/unknown stored data is preserved verbatim and produces a recovery warning. Storage failure does not fabricate a saved event or block supported practice. At the explicit history size limit, recording warns rather than silently pruning older history. Earlier answers remain in the current session even if browser persistence fails.

Audio reuses the existing owned audio manager and volume support. Starting another reference stops the former one. Selection changes, leaving a gateway, flight pause, navigation and profile changes stop recitation and pending playback. No automatic recitation countdown, new game sound effect, microphone upload or AI inference is introduced.

## Validation

- Exhaustive model coverage of all 571 free ayahs: authentic three-choice sets, normalized uniqueness, canonical targets, full coverage and correct predecessor/stage mappings.
- Al-Kafirun repeated wording, custom starting references, opening/one-word ayahs, invalid/premium references, repair, assistance and deterministic retry.
- Full controller journey across stage boundaries; no advancement with incomplete gateway coverage and no time movement during a gateway.
- Ledger preservation, owner guard, malformed-data recovery, source-only metadata and unchanged FSRS records.
- Browser keyboard/touch selection, two-minute virtual recall pause, wrong→hint→correct recovery, exclusive audio, mobile RTL layout, clean resume, complete flights and two-stage journeys.

### Execution results

- Full run: `npm test -- --workers=2 --retries=1` — **506 passed + 3 flaky cases passed on retry**, 22.1 minutes. The retry cases were existing Snake movement/chain and Sirat mobile tests, not gateway failures.
- Final focused run after the independent-recall exposure safeguard and focus fixes: `npm test -- tests/cosmic*.spec.js --workers=1` — **23 passed**, 2.6 minutes. This includes two additional exposure-protection regressions added after the full-suite collection.
- Final production build: **passed**, 8.63 seconds.
- All **571** free full-ayah audio asset paths exist locally.
- `git diff --check`: passed.

Public deployment smoke check: verify the Revision Lab sidebar entry at the Railway URL, open Cosmic Rush, select a free passage, launch and steer the ship, then verify the untimed readiness/gateway flow. The old live bundle lacked these entry points, so a local preview alone is insufficient proof of this availability repair.

Flight position remains session-only; gateway history is profile-local/exportable. Cross-device synchronization and the remaining hybrid phases are not implemented by this release.
