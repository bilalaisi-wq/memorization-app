# Sirat Quest 2.0 — Hilltop Gardens

Open **Your Space → Puzzle Lab → Sirat Quest**, choose a route and Single Ayah or a consecutive Ayah Chain, then **Prepare journey → Start exploring**. Existing free/premium content authorization and published phrase-review restrictions remain in force. No new dependency or database migration is required.

## Real exploration

Hold Left/Right or A/D to move; Up/W jumps. Space jumps during exploration and enters the nearest arch when standing at a gateway. Keys 1–3 select its continuation; E uses Echo. The large touch buttons support holding a direction while another finger taps Jump. P pauses; full-ayah Replay freezes physics until Resume. Continuous full-ayah recitation accompanies play by default; listen-first and temporary recitation pause remain available. Audio failure costs no strike.

The original gravity, jump impulse, horizontal collision handling, swept landings, moving-ferry carry and safe checkpoints are retained. New elevators carry the explorer vertically using the same collision loop. Optional relaxed movement reduces horizontal navigation speed to 75%; it does not alter jump strength, score, memory difficulty or recall outcomes. The responsive camera follows the explorer through the end of each section on phones as well as desktop.

Three selectable routes lead to the same canonical source sequence:

- **Guided Garden:** familiar wide terraces and ferry, recommended first.
- **Mountain Challenge:** a raised ferry and optional overlook, with mountain scenery.
- **Star Path:** a higher ferry and optional raised terrain under a starry sky. This route is optional, never required for memorization progress.

Every stable terrace supplies a safe landing. Moving platforms never become respawn checkpoints. Missed jumps and Return to Safe Checkpoint preserve connected words and powered surfaces and record motor events only. The memory elevator returns to its accessible dock after recovery. There are no navigation deadlines or penalties for missed study days.

## Memory-powered bridges and elevators

Each word/approved-phrase section ends in a courtyard of authentic continuation gateways. The bridge and elevator beyond it initially appear translucent and do not collide with the explorer. Correctly identifying the next canonical source occurrence powers both surfaces. Walk across the bridge and board the elevator: it rises after boarding and carries the explorer upward before the exit opens. It cannot depart before the learner reaches it.

Wrong committed Arabic choices cost one memory strike. Merely walking near a wrong arch, missed jumps, dropped touches, delays or failed audio never do. Classic has three strikes across the run; Practice restores three per ayah and retains completed gardens when retrying the current ayah. Correct gateway decisions cannot be repeated to farm score or Echo.

## Echo assistance

Existing positive-XP learning receipts provide a bounded **0–3 charge loadout per journey**. This reads actual saved learning data without inventing progress or changing learning records. A new learner earns a charge from each first correct gateway decision, up to three. Repeating that same decision after a retry does not earn another charge.

Echo consumes one charge to briefly reveal the exact verified current study piece for four seconds. It retains that piece even if a later decision is made while the reveal is visible. Use records reference assistance, never a strike, independent recall, mastery or an FSRS grade. Charges are a local journey aid, not a global purchased currency; a new journey can start with its receipt-based loadout again. Full-ayah replay is always available without Echo charges. No audio is cropped at an unapproved stop.

## Final continuation

Before an ayah garden is completed, reconnect up to three previously studied source pieces in their canonical order. For a short Expert whole-ayah unit in a chain, preceding studied ayah units provide context when available. A single whole-ayah source unit remains one legitimate unit; the game never invents internal phrase boundaries to create extra questions.

This challenge is untimed and physics is frozen. Choices retain canonical references and word ranges so repeated identical wording can be distinguished by occurrence. Correct links remain in place after a wrong choice; wrong committed continuations use the same Classic/Practice strike budget. All required links must be completed before the checkpoint or victory is recorded.

Victory offers the **existing independent self-assessed recall workflow**, replay and return to study. Arcade recognition never certifies spoken recitation or submits Again/Hard/Good/Easy ratings automatically. FSRS parameters, dates and recall history remain managed by the established learning system.

## Authentic content and presentation

Only verified application content is used. Beginner/Standard use canonical word occurrences. Expert uses short whole ayahs or source-matched published reviewed phrase boundaries with at most eight words per sign. Draft, incomplete, revoked or oversized phrase data fails preparation. Long sources use bounded consecutive sections; the construction line displays the latest twelve connected words while canonical coverage remains intact.

All Uthmanic spelling, diacritics, ordering and source IDs are preserved. Phrase signs and visible study groupings are not waqf/restart certification. Recitation always uses the complete verified ayah. This game depicts ordinary fictional gardens, mountain terraces, platforms and an animal-like explorer. It does not represent the actual eschatological Sirat, paradise/hell, spiritual worth or judgment.

## Persistence, accounts and compatibility

The game ID remains `sirat`. Existing `ayah-puzzle-lab-v1` history and XP caps are unchanged. New results add bounded route/Echo metadata and source-referenced final-continuation evidence. Existing result receipts remain idempotent and account-bound. Navigation evidence remains separate from Arabic errors and study assistance.

New `ayah-sirat-journeys-v2` records are scoped to the current account/guest and included in account export. They store references, source fingerprint, original session ID/config, completed ayahs, current section, safe checkpoint, powered state, Echo accounting and final challenge metadata—never duplicated Arabic or raw recordings. Prepare the same route/range/difficulty/rules to resume safely paused at the last stable landing. Moving elevators reset to the dock while learning progress is retained. When resuming between ayahs, choose Resume first, then Next Ayah Garden; the next full recitation starts on entry. Unfinished records are browser-local; this change does not introduce cross-device checkpoint synchronization.

Source content and reviewed segmentation are rebuilt through current authorized adapters on restore. Invalid/future/source-mismatched records remain preserved with export and study-recovery options. Save failures retain retry; an unsaved victory retains its original receipt for reload recovery. Profile changes and exit dispose animation frames, media, reveal timers, input handlers and the resize observer. No departing draft is written into the new account.

## Modules and QA

- `engine.js`: existing platform physics plus powered collision surfaces, vertical carry, responsive camera and final recognition progression. Legacy direct reducer consumers remain compatible; the learner UI uses version 2.
- `adventure.js`: route geometry decorations, exact-source final units and idempotent Echo earning.
- `checkpoints.js`: versioned metadata-only checkpoints, source validation and recovery.
- `ui.js` / `sirat.css`: real platform scene, in-frame Arabic choices, large two-thumb controls, source labels, audio, lifecycle and reduced-motion presentation.
- `tests/sirat-engine.spec.js`, `tests/sirat-ui.spec.js`: original physics, gameplay, strikes, audio, XP and FSRS regressions.
- `tests/sirat2-model.spec.js`, `tests/sirat2-ui.spec.js`: all routes/presets, powered surfaces, real elevator ascent, Echo assistance, final ordering, safe resume, account isolation, source integrity, mobile controls and reduced motion.

Run the Sirat suites with `npx playwright test tests/sirat-engine.spec.js tests/sirat-ui.spec.js tests/sirat2-model.spec.js tests/sirat2-ui.spec.js --config=playwright.regression.config.js --workers=1`, followed by the shared arcade/Quest regressions and `npm run build`.

Desktop and 390px mobile game captures: [powered elevator](sirat-quest/sirat2-desktop.png), [mobile](sirat-quest/sirat2-mobile.png). Reproduce with Vite running on port 5173 and `node scripts/sirat2-previews.mjs`. Physical-device and screen-reader certification remain separate from automated Chromium QA. See [release evidence](sirat2-release.md) for measured results and remaining limits.

Exact standing contact now remains grounded even in zero-duration frames. Previously the platform overlap test rejected equality, making grounded-dependent gateway choices flash off and on. The shared collision helper retains its swept landing/side/underside rules; no motor event becomes a memory strike.
