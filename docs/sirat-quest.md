# Sirat Quest — Hilltop Gardens

Open **Your Space → Puzzle Lab → Sirat Quest**, select Single Ayah or a consecutive Ayah Chain, then **Prepare journey → Start exploring**.

## Controls and journey

- Hold Left/Right or A/D to move; Space, Up or W jumps. P pauses. The large mobile direction buttons support held touch while the other finger taps Jump.
- Cross terraces and ride the moving ferry. Horizontal movement, gravity, swept landing/solid-platform collisions, moving-platform carry and side-scrolling camera movement are actual game physics.
- Every stable terrace updates a safe landing checkpoint. A missed jump returns the explorer to that landing, preserving connected words, opened gateways and memory charges. Moving platforms are not unsafe respawn positions. Return to safe checkpoint is available manually.
- Reach the courtyard to unlock the continuation buttons. Choose the next exact word or approved phrase with its button or keys 1–3. A correct choice opens the arch; walk through it to reach the next connected section. Choices cannot be committed from the starting area or repeatedly farmed after an arch opens.
- Wrong committed continuations consume one memory charge. Ordinary platforming failures are motor events only. Classic keeps three charges for the entire run; Practice restores three per ayah and retries the current ayah after game over. No missed-day or movement penalty affects learning XP or FSRS.
- Guided listening plays the full verified ayah before exploration. Both in-game and shared Puzzle Lab replay freeze the physics. Resume stops recitation and restores movement. Silent exploration is optional; volume/mute use the existing shared controls. Playback failure leaves a clear resume path without a strike. Opening another study surface stops even an already-paused listening track.
- Completion saves through the existing account-bound recorder. Save failures stay visible with retry. Partial chain saves can finish the remaining ayah receipts without duplicating the successful ones. Play Again starts a new run after saving; independent recall and return to study remain available.

## Content and fairness

Beginner has wider platforms and two continuation choices. Standard has narrower approaches and three branches. Expert adds authentic similar phrase choices and optional raised ledges. Required routes stay reachable; optional terrain is not required to demonstrate Quran knowledge. Movement speed, jump strength and gravity remain identical across presets.

Only verified application content is used. Beginner/Standard use canonical words in order; Expert uses short whole ayahs or source-matched published reviewed phrase boundaries, with at most eight words per phrase for gateway readability. Unreviewed/draft or oversized phrases fail preparation and offer word mode instead. No arbitrary phrase splitting, regenerated Arabic or new recitation-stop certification is introduced. Recitation always uses the full ayah.

Sirat Quest depicts **ordinary fictional gardens, terraces and stone architecture**. It does not represent the actual eschatological Sirat, paradise/hell, spiritual worth or religious judgment. An animal-like garden explorer and ordinary safe returns keep feedback about play and recognition skills.

## Framework and persistence

- `src/puzzles/arcade/sirat/engine.js`: deterministic reducer, seeded section geometry, shared strike/checkpoint events, canonical continuation evidence and bounded current-section platforms.
- `src/puzzles/arcade/sirat/ui.js`: existing start/pause/resume/dispatch/getSnapshot/dispose contract plus shared listen/mute/setVolume controls. Animation frames, input listeners and audio are disposed on exit. Lost focus pauses safely; inert underlying surfaces cannot consume movement input.
- Vite entry points import the scoped CSS. Night Sky and Simple themes retain readable Uthmanic Arabic, large controls and reduced-motion behavior. Cosmetic walk/success effects do not change physics or accuracy.
- Registered in the shared arcade registry and Quest host. Existing free/premium authorization and reviewed-source loaders remain in use.
- `ayah-puzzle-lab-v1` retains its existing format and historic data. New Sirat receipts add bounded numeric recognition score/recovery metadata. Existing per-ayah/day XP caps, duplicate receipt protection and account isolation are reused. No SQL migration, API key or dependency is required.
- Arcade victories never create recall grades, alter FSRS dates or certify spoken memorization. Study exposure is marked only for the displayed ayah; later chain selections alone do not mark unseen ayahs as studied.

Current platform positions/checkpoints are in-memory for the active run; completed receipts survive reload. Reloading restarts an unfinished run. Long ayahs use sequential bounded sections and the construction line shows the latest 12 collected words, while the full canonical sequence stays in session state.

## Tests and previews

`tests/sirat-engine.spec.js` covers deterministic geometry, real jump/landing/camera physics, ferry carry, motor-only recovery, physical gateway arrival, wrong choices, all difficulty routes over multiple seeds, Classic/Practice chains, long source coverage, phrase restrictions, pause/lag/disposal, ownership, capped receipts and FSRS non-interference.

`tests/sirat-ui.spec.js` and `tests/sirat-helper.js` drive real keyboard/touch platform traversal, completion/replay, chain transitions, partial-save recovery and reloads, guided entry audio, shared replay/volume, overlay audio suspension, failures, Night Sky contrast, mobile sizing and reduced motion. Existing Quest planned-game tests now leave only Bridge Builder/unknown IDs as unavailable examples.

Previews: [desktop courtyard](sirat-quest/desktop.png), [mobile ferry crossing](sirat-quest/mobile.png). These are local QA captures without real learner data; physical-device/store certification is outside these browser checks.

Release validation: **466 Playwright tests passed** (5.4 minutes), including the 21 new Sirat engine/browser cases and all existing free-learning, arcade, Quest, persistence, account and entitlement regressions. Production build passed (5.25 seconds). Desktop and 390px mobile screenshots were visually inspected; neither layout overflows the page. Night Sky gateway and paused-overlay text contrast has explicit regression checks. `git diff --check` passed.
