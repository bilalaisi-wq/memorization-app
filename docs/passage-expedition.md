# Passage Expedition 2.0

A playable constellation campaign on the existing vanilla-JS/Vite Quest and
Passage Builder foundation. No Qur'anic text is imported, rewritten or generated.
The classic studio, its drafts, existing games, account records and FSRS workflow
remain available.

## Open and play

Under the site's current advanced-feature visibility policy, enable **Developer
mode → Menu → Passage Expedition**, or choose **Explore Passage Expedition** in
Classic Passage Builder. This phase retains that existing developer-menu policy;
it does not publicly release the private library. Free Al-Fatihah/Juz Amma work
without a content backend once the expedition is opened. Paid/private requests
still require valid server authorization. Al-A'raf/Juz 29 remain developer-only.

Choose an available juz, surah, starting reference, up to ten supported ayahs and
a registered arcade game. The selector lists source-prepared references, not the
whole unpublished Quran. Private pilots are marked as authorization requests;
a listed reference is not a guarantee that its server assets are deployed.
Selected references (including any gaps between available pilots) are explicit.

1. **Discovery Gate** shows the original full ayah, translation and source links.
   Play the complete recording or read and continue. No audio permission/success
   is required; listening alone earns no independent-memory credit.
2. **Word Forge** uses the existing bounded `wordWindow()` workspaces, at most
   twelve movable words. Drag pieces or use the touch/keyboard reorder buttons without clearing your work. Complete three rounds: visible words, partial hints,
   then hidden words. Stable piece colors/shapes support recognition. Reveal
   hints and repeat aloud freely; this is supported study, not an assessment.
3. **Passage Link** follows each Forge and connects all studied workspaces in
   canonical sequence. Cards represent exact source excerpts, not recitation
   stops. This keeps cumulative construction manageable without rendering
   hundreds of draggable word pieces.
4. **Arcade Trial** uses the first verified visual workspace for a brief
   word-level trial. Runtime registry detection supports **Ayah Blocks (Falling
   Words), Ayah Space (Asteroids), Ayah Serpent (Snake), and Memory Maze**. A
   registered available alternative replaces a missing/planned choice. When no
   compatible engine is registered, or a learner prefers study, guided Forge
   practice keeps the checkpoint playable. Source word IDs/indices remain exact;
   no artificial Qur'anic verse is constructed. Full-ayah audio is used throughout.
5. **Independent Memory Challenge** opens the existing passage self-assessment:
   recite from memory, declare, reveal/compare, then self-grade. A successful
   independent Hard/Good/Easy attempt since the checkpoint began is required.
   Assisted attempts, Again, puzzle wins and AI output cannot pass this gate.
6. For a multi-ayah route, connect the ayahs in **Passage Chain**, then finish a
   separate **Independent Passage Challenge** using the exact chosen references.
7. **Constellation Reveal** displays only completed activity stars and the count
   of saved independent self-assessments. It does not certify tajweed or long-term
   memorization. Existing FSRS due dates remain authoritative.

Visual pages, excerpt cards and arcade word scopes are **not approved waqf or
restart guidance**. No internal stop or clipped audio timing is approved by this
campaign. The research-draft segments remain study aids. Full verified text and
full-ayah recitation are preserved, including original spelling and stop symbols.

## Navigation, audio and accessibility

The map shows completed gold stars, the current teal star, and locked checkpoints.
Select the reachable star to continue or a completed star to inspect it. Up/Down
and Home/End navigate enabled map buttons; Enter/Space activate native controls.
Keyboard input and large touch controls are retained inside the actual games.

The full-screen shell traps focus while open and restores the previous page and
focus on exit. Existing native recall dialogs keep their own modal focus behavior.
Close/Your Space and Expeditions navigation stay available. Games/media/listeners
are disposed on switches, account/developer changes and exit. Hidden tabs pause.

The toolbar supports activity pause/resume, audio pause/resume, stop and volume;
arcade audio pause pauses the game too, so movement cannot punish listening.
The volume uses the existing saved Puzzle Lab preference. Full-ayah audio starts
only on request in study; arcade trials start silent and provide replay controls.
Failures never add a memory strike or force the learner to obtain microphone
permission. No recording/transcription or new AI service is introduced here.

Night Sky styling uses navy/violet, teal navigation, gold completion effects,
animated constellation connections and existing Uthmanic typography/encouragement
sound preferences. **Skip animations** cancels decorative effects; system reduced
motion is respected. Gameplay movement remains essential for movement-based games.
Layouts support mobile and desktop; only the current word workspace is movable.

## Resume, recovery and source changes

The existing `ayah-quest-campaigns-v1` schema remains version 1. Optional
`routeVersion: 2` distinguishes expedition routes from older framework maps.
Existing runs are preserved. Each run retains reference IDs, checkpoint IDs,
source/segmentation hashes, completion receipts and safe position-only drafts.
No Arabic, translation, MP3, bearer token or copied FSRS card is stored there.

Forge drafts store round, selected source positions, mistakes, assistance and
whether hints were revealed. Link drafts store card indices. Reload, open the
expedition and select **Resume**: completed stars and unfinished study work restore.
Unfinished arcade physics restarts its checkpoint; it does not discard completed
stars. Quest state remains local per account/device (no new cross-device sync).
Existing independent passage reviews keep their separate existing sync behavior.

Every resume and activity launch re-authorizes content through `loadBundle()` and
checks the source and segmentation fingerprints. Multi-ayah final checkpoints
validate every reference. If source/review metadata changed, the old route stays
saved and the learner explicitly chooses whether to start the updated route.
Revoked/unavailable private content never renders through a fallback.

**Export recovery copy** downloads the raw quest document. **Restore an expedition
export** checks the current owner/version and asks the learner to restore the
checked backup. The previous quest document is retained under
`ayah-quest-recovery-backup-v1` before replacement. Existing learning history,
workspace records, XP ledgers and FSRS are never part of this restore. Corrupt or
future-version data blocks mutations and stays available for export; it is not
silently reset. Never import another learner's records or edit receipt IDs.

## Architecture and integrity

- `src/quest/expedition/model.js`: edition-2 deterministic route generator,
  supported reference selection, draft/source validation and resume.
- `activities.js`: bounded three-round Forge and cumulative Link/Chain activity.
- `blocks.js`: lifecycle adapter over the existing Falling Words UI/engine,
  with verified canonical targets before distractors, fixed quest configuration
  and full-ayah audio. Original standalone Blocks settings/behavior remain intact.
- `ui.js`, `expedition.css`: selection, map, activity shell, recovery, completion
  reveal, keyboard/touch/reduced-motion controls and owned media/feedback lifecycle.
- Shared Quest store/host retain their version-1 contracts with optional v2 draft,
  source-pin, scoped-trial and completion callback support. Legacy maps still work.
- A small optional studio callback reports a **saved existing self-assessment**;
  it does not introduce another grader or scheduler. Reopening the same source text before declaring an unfinished recall marks it assisted, so study cannot accidentally pass an independent checkpoint. Quest reads the persisted
  result before marking the checkpoint. No FSRS dates change through a puzzle.
- Rewards use existing per-game/day caps and passage practice buckets with stable
  checkpoint receipts. Opening Discovery earns zero XP. Replay/recovery cannot
  grant the same checkpoint a second award. Quest XP is not a second wallet.
- Private text/audio uses existing authenticated Supabase content functions and
  byte/hash validation. No subscription assertion supplied by the client grants
  access. No RLS, billing plan, backend key or server authorization was changed.

No Supabase migration or Edge Function deployment is required for the frontend
upgrade. Private pilot content still requires the project's existing content
functions/assets and appropriate entitlements to be deployed separately.

## Pilots, tests and screenshots

Tests use the existing source-validated fixtures for 2:255/2:282 and mocked server
authorization. They do not demonstrate that hosted private assets are available.

- Free Al-Fatihah 1:1 completes through actual Maze play, existing self-assessment
  and a five-star reveal. Actual Blocks, Space and Serpent mechanics also launch.
- Authorized 2:255 and 2:282 verify exact text, bounded workspaces and authorization
  behavior. The 128-word 2:282 route completes all 43 checkpoints without changing
  or duplicating its source words; independent recall uses the existing system.
- Selected 1:1–1:2 chain completes 12 checkpoints, including a separate passage
  recall unit, not just independent individual-ayah cards.
- Coverage also includes metadata-only storage, draft resume, corrupt-data recovery,
  revoked access, audio pause/cleanup, mobile touch, keyboard and reduced motion.

Recreate local screenshots with a Vite server on port 5193 and
`node scripts/expedition-screenshots.mjs` (override `EXPEDITION_PREVIEW_URL` if needed).
The desktop private-pilot preview uses fixture authorization; the mobile preview
uses the real existing free ayah. Progress shown comes from actual UI actions.

- [Selection](expedition-previews/selection.png)
- [Desktop long-ayah Word Forge](expedition-previews/desktop-forge.png)
- [Mobile Word Forge](expedition-previews/mobile-forge.png)
- [Mobile map](expedition-previews/mobile-map.png)

Remaining checks: physical iOS/Android media behavior and hosted private-content
availability need separate device/deployment QA. Human-reviewed waqf/ibtida and
aligned segment audio remain outside this release. A successful self-assessment
is not automatic speech or tajweed verification.

## Completed validation

- **332 Playwright tests passed** in one final full-suite run (5.7 minutes),
  including **24 new expedition model/browser tests** and all existing arcade,
  Passage Builder, authentication, billing, learning and theme regressions.
- Production build passed after the final code changes.
- Existing backend suites passed: content 6, billing 7, recitation 5, coach 5
  (23 total); no backend authorization or database code changed.
- A real Blocks trial win was tested with a simulated quest-write failure.
  The retry action saves visibly without additional XP. Switching between
  arcade and guided practice after a split-write failure reuses the first
  reward receipt, so it cannot mint a second checkpoint reward.
- Four screenshot artifacts were generated from actual UI actions; desktop
  and mobile Forge previews were visually inspected. Private preview transport
  uses the existing authorized test fixture, not a live deployment claim.
- `git diff --check` passed. Qur'anic source datasets, research draft boundaries,
  approved recitation stops, Supabase RLS and existing FSRS settings are unchanged.

## Constellation Rescue revision

After the constellation reveal, **Open Constellation Rescue** shows the existing passage review cards and due queue. See [the revision dashboard guide](constellation-rescue.md). Opening it does not recalculate FSRS or add recall history.
