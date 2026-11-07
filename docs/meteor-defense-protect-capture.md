# Meteor Defense: Protect and Capture (Ayah Quest 3.0 Phase 5)

## Launch

Revision Lab → Cosmic Rush → select a **free** mission → mission briefing → select D1 or D2 and movement pace → **Launch Protect and Capture**. The existing **Launch Meteor Defense** button and saved legacy expedition flow retain their original recognition-gateway rules.

For a shared authorized passage, select it through the existing PassageContext, open Revision Lab and choose **Protect and Capture · authorized passage**. This separate adapter uses authenticated `quran-content` bundle/audio loading and current source/review fingerprints. It can use available private content after backend authorization. It does not broaden Cosmic Rush's free-only mission manifest, grant content from local subscription flags, or advertise unverified surahs.

## Two objectives on one battlefield

- **D1 Protected Ayah Orbs:** stationary source-backed carriers support relaxed targeting while neutral meteors move toward the core.
- **D2 Defend and Capture:** the same carriers drift along controlled trajectories while the learner aims, defends and deliberately captures the next source piece.

Both retain the original ring, crossfire and sweep meteor patterns, projectile collisions, core integrity, recoverable motor failures and four recognition-charged abilities. Movement settings independently change motor pace/density; they never certify memory strength.

Blaster (B) intercepts only neutral meteors. Tractor (T) locks and captures a deliberately selected Arabic carrier. Space activates the selected tool. Click/tap a carrier to lock and aim; the visible turret and beam indicate the lock. Pointer aiming, large aim buttons, a direction slider, and Next carrier support touch and keyboard users without precise dragging. The on-field controls provide the same tool, capture, redirection and pause actions. P pauses; D safely redirects a locked carrier.

Correct and incorrect carriers have the same shape, colors and shielding. Distractors match the current target's word count and use authentic, position-backed free Quran wording. Neither blaster interception nor any defensive ability destroys Arabic carriers. Projectile impacts are absorbed and flash the shield; safe redirection moves intact wording out of the field. Required pieces return after redirection. No aiming miss, audio failure, lapse of time, shield interception or core impact consumes a memory strike.

The tractor costs 30 energy per committed capture and regenerates 18 units/second up to 100. A wrong captured source unit costs exactly one memory strike. Empty/misaligned beam attempts are motor misses. Recognition charges are capped at two per ability and remain separate from core integrity and the three-strike budget. Motor recovery preserves captured source progress and memory strikes. Practice replenishes memory strikes at a new ayah; Classic retains them throughout the selected capture set. Motor recovery and Practice retries retain completed source workspaces; a Classic three-strike loss restarts the selected capture set.

Every workspace requires both its source sequence and a genuinely secured neutral wave. If the wave clears first, remaining captures are untimed. If the core goes offline or the defended count is insufficient, retry safely; partial source work remains. Missing or redirected required carriers respawn and beam energy continues recovering after neutral combat clears.

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
