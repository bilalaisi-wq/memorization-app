# Meteor Defense 3.0 · Intelligent Laser & Tractor Beam

Revision Lab retains its existing free mission launch and shared authorized PassageContext launch. The original gateway-only Meteor Defense path and historical records remain available; **Protect and Capture now defaults to mechanics version 3**. No separate premium game or entitlement bypass is added.

## One control, two context-sensitive actions

Move the mouse, drag in the arena, tap a carrier to aim, use A/D or Left/Right, or use the accessible angle slider/aim buttons. Hold **Space** or the large **FIRE** button. The closest geometric ray intersection decides the behavior: neutral meteor → continuous damage laser; protected Arabic carrier → magnetic pull; empty space → harmless laser. The ray never reads source correctness to choose a target. All carriers have equivalent shapes and protection. No B/T weapon switch is required.

The turret rotates through the shortest angular path, bounded to 9 radians/second. Pointer coordinates map through the actual responsive arena dimensions. Touch aiming and the separately captured FIRE pointer are independent: lifting the aiming thumb does not release the firing thumb. Canceled FIRE touches, pause, visibility changes and disposal stop firing safely. Controls inside unrelated fields/dialogs do not aim or fire.

The beam lasts at most **1.5 seconds**, followed by **0.3 seconds** cooling and an explicit release before rearm. Holding Space after overheating cannot auto-fire. Normal meteors take approximately 0.2 seconds contact and strong ones 0.4 seconds (five damage/second). Pull speed is 420 arena units/second; home slots are within about 325 units of the core, so an aligned pull to collection radius fits comfortably in one hold. Tests exercise capture with 1.05–1.1 second holds including simulation overhead. No arbitrary duration extension was needed. Release retains position for 0.6 seconds before gradual drift home; a new hold can resume pulling.

## Finite waves and safe capture

Each expected verified piece receives its own deterministic finite wave: **7 relaxed / 11 normal / 14 arcade meteors**. Existing wave patterns, core health and recognition-charged abilities remain. Clear the wave before capturing for an untimed safe opportunity, or collect the correct piece early and finish that same wave. Early correct source progress stays captured; the next piece/wave cannot overlap it.

A wrong committed capture costs exactly one memory strike, shows its intact wording with a red outline/X, and restarts the current deterministic wave. Additional captures are blocked until that retry wave is secured. Completed earlier pieces remain intact. Meteor interception receipts are keyed to page/piece/meteor and deduplicated across failed-wave retries and reloads. Core damage and recovery remain motor outcomes; they never become memory grades. Classic/Practice strike and checkpoint rules are preserved.

Protected carriers cannot be destroyed by laser or abilities. Neutral meteors reflect off shields using deterministic circle collisions at 120 Hz substeps, with damped velocity, outward separation, a 0.35-second repeat-contact guard and a three-bounce outward escape. An escaped neutral hazard can resolve the defense objective without creating interception points. Brief shield flashes and direction arrows show ricochets. Lag over 0.25 seconds safely pauses rather than applying catch-up damage. The original inactive projectile/capture-v2 implementation remains an explicit compatibility adapter (`intelligentBeam:false`), not the learner default.

Full-ayah recitation, volume, transliteration, shared encouragement settings, readable source text and existing independent-recall boundaries remain. The success layer receives canonical capture events; the actor feedback retains the captured/incorrect original wording rather than shattering text. No laser sound is added over Quran audio.

## Long ayahs and source integrity

`defense-content.js` reuses the shared PassageContext fingerprints and the bounded arcade plan/word adapters. A workspace has at most 12 study pieces, up to three consecutive source words per piece, and at most three Arabic carriers exist at once. Larger ayahs get additional bounded workspaces. Original surah:ayah and zero-based word IDs remain attached to each piece. Captures preserve canonical order; repeated words cannot create two visually identical simultaneous choices.

Groups are visual study cues, **not approved recitation stops**. No Quran text, timings or stopping guidance is generated. The recorder plays the existing full-ayah audio only. Default continuous recitation loops during play; Listen before defending and manual Replay pause physics safely. Recitation can be paused, replayed and adjusted with the volume control. No game sound competes with recitation. Audio failure leaves a playable recovery/resume path without a memory penalty.

The public distractor cache is explicitly restricted to Al-Fatihah and Juz Amma, even if a developer previously loaded private chapters into the application library. Private words/audio are never added to a public frontend asset or this cache. Account/access changes dispose engines, source objects and media; focus revalidation rejects stale source/review revisions. Visible text exposure uses the existing assistance API, never a recall grade. If assistance persistence fails, carrier text is concealed until recovery.

## Persistence, rewards and interfaces

- `defense.js`: original neutral physics plus opt-in protected collision bounds and trusted capture-core hooks. Legacy defaults are unchanged.
- `defense-capture.js`: protected carriers, energy/locks, canonical capture checks, separate memory/motor outcomes, bounded pages, lifecycle and validated checkpoint export/restore.
- `defense-capture-host.js`: account-owned local persistence and standalone/shared-passage hosting.
- `defense-capture-ui.js`: live SVG/HTML battlefield, pointer/touch/keyboard tools, full-ayah audio and lifecycle cleanup.
- `defense-capture-store.js`: additive `ayah-cosmic-defense-capture-v1`, separate from FSRS. Existing keys remain untouched. Checkpoints store only source IDs, fingerprints in route identities, progress, settings, mistakes, assistance, motor counts and charge metadata. Invalid/future records are preserved for export/recovery.

Capture checkpoints are account-scoped and included in local profile exports. The regular mission director saves its active set/round and restores the matching capture checkpoint. Reload of an interrupted live wave restarts neutral combat with safe core health while retaining the source prefix, completed pages, charges and recorded evidence. Cleared workspaces and finished sets restore their completion screen directly; Replay starts a fresh canonical sequence. No offline catch-up damage is applied. Configuration/source-revision identities bind saved data to compatible content. This does not add cross-device live-game synchronization or a database migration.

Only completing all requested workspaces of an ayah emits the existing `defense:memory-correct` recognition reward. Existing daily caps and stable idempotent bonus receipts prevent duplicate XP across retries/reloads. Neutral combat points remain arcade points. No capture or battlefield result writes FSRS, invents spoken accuracy, or grants mastery. Existing independent self-assessment remains the scheduling authority.

## Validation

`tests/defense5.spec.js` exercises protected collisions, tractor targeting, wrong captures, energy regeneration, required recovery, simultaneous hazards, relaxed/normal/arcade solvability, three strikes, source-validated long content, checkpoint restoration/corruption recovery, mission resumption, public-cache isolation and XP/FSRS separation. `tests/defense5-ui.spec.js` covers real mission launch, keyboard capture, neutral movement, audio-aware pause, authorized private passage access/revocation, actual touch controls, reduced motion, assistance failure and account cleanup. Existing Meteor Defense and passage-context suites remain regression coverage.

Live deployed Supabase policies and physical-device audio hardware require deployment checks; browser/private-content tests use authorized fixtures and simulated audio. The frontend adapter does not weaken backend entitlement enforcement.

### Release evidence — 2026-11-07

- Full regression: `npx playwright test --workers=3 --config=playwright.regression.config.js` — **849 passed**, 18.1 minutes, no retries/failures.
- Focused new/legacy Defense and cross-lab regression: **46 passed**.
- Backend suites: billing 7, content authorization 6, recitation 5, coach 5 — **23 passed**. Corresponding `check:billing`, `check:content`, `check:recitation`, and `check:coach` Edge Function type checks pass.
- `npm run build` passes; no new engine or package dependency.
- Real neutral physics, keyboard/touch capture and a complete 2:282 source-word playthrough were exercised. Browser audio uses simulated playback; actual device/autoplay behavior and deployed Supabase policy configuration still need deployment checks.
- Desktop and 390px mobile screenshots were inspected for Arabic readability, carrier equivalence, in-field controls and viewport fit: [desktop](screenshots/meteor-defense/desktop.png), [mobile](screenshots/meteor-defense/mobile-390.png).

No SQL migration or new backend deployment is required. Deploy the latest frontend build through the existing Railway process. Existing backend content entitlements remain authoritative. Live-game capture checkpoints are local/account-scoped, not cross-device synced; existing cloud learning records and FSRS remain unchanged.


## Version 3 state and validation

The same account-scoped `ayah-cosmic-defense-capture-v1` envelope gains additive `mechanicsVersion:3`, pending-piece/wave cursor, retry-wave state, cosmetic score and deduplicated interception receipts. No source Arabic is added to checkpoints. Legacy records rebuild from their exact existing canonical prefix and restart the unfinished neutral wave safely. Unknown/malformed metadata remains recoverable and is not overwritten. Transient pull positions and beam heat are deliberately not restored; source progress is retained while the interrupted motor wave restarts safely.

See [Meteor Defense 3.0 validation](meteor-defense-3/validation.md) for changed modules, actual test results, inspected desktop/mobile screenshots, performance checks and remaining limitations. No database migration, new FSRS scheduler, entitlement rule or provider configuration is introduced.
