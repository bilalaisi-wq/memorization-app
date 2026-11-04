# Cosmic Rush Phase 6 — Weak-Link Bosses and Expeditions

Phase 7 update: [Private cloud sync and adaptive revision](cosmic-rush-phase7.md) now extends this local-first route. The original Phase 6 release limits below are historical.

## Entry and route

Revision Lab → Cosmic Rush → choose a free passage → **Start or resume full expedition**. The existing 5/10/15/20 presets, contiguous custom ranges and entire-surah selections are retained. Al-Fatihah and Juz Amma are the only eligible content, irrespective of developer/subscription status.

Each stage contains at most five ayahs and follows Star Runner (the selected 3–10 revision rounds), Meteor Defense, Ayah Link and the Weak-Link Sentinel. The ship, aiming, collisions, audio and gateway mechanics reuse the existing actual game engines. This is a coordinated route, not replacement quizzes for the arcade portions. Later stages cannot be skipped through the expedition UI.

Ayah Link receives the full global selected reference list even when resuming a later stage, preserving the N→N+1 seam across stage boundaries. Every selected ayah is covered by flight and defense, and every internal transition is covered by Link. A single-ayah selection has no invented internal link. Pickup style, guidance and pace are saved with the route, so resuming does not silently change the selected learning settings. The route summary distinguishes fully saved stages, ayah coverage, practiced links and final assessment.

## Boss contracts

The Sentinel has multiple visible energy shields and outer-shield, inner-core and restored phases. Shields release in response to completed memory challenges, not shots or navigation. Boss rewards reuse existing capped and idempotent Puzzle Lab XP receipts. Questions include next-ayah recognition, ending/opening connections, bounded missing-ayah reconstruction, approved visual phrase repair when available, opening recall and stage-wide self-assessed spoken comparison. All challenges are untimed, hints are available, and incorrect attempts preserve restored shields.

Boss question blueprints store only task/reference contracts and evidence provenance. They remain fixed across resume even when new history arrives. If a previously approved phrase partition disappears or changes, the pending repair becomes an opening-recall fallback with the same checkpoint identity; old approval is never silently reused.

Known-difficulty labels require at least two recorded difficulty observations from source-current adjacent-pair evidence. Otherwise questions are explicitly baseline practice. The source evidence identifiers and category distinctions remain available; the UI does not claim a measured forgetting probability. Three or more successful independent recall days in relevant existing passage history increase next-ayah retrieval demand from choices to typed text. Movement speed is not a proxy for memorization strength.

Approved phrase repairs reuse published source-matching visual partitions only. Pending/unavailable review does not authorize segmentation. Canonical word-tile reconstruction is bounded to twelve words; longer missing-ayah tasks use a whole-ayah component. Neither word tiles nor visual phrases prescribe waqf. Identical-text components are accepted in equivalent positions without an occurrence-ID trap. Full-ayah playback is used throughout boss practice.

## Persistence and recovery

`ayah-cosmic-expeditions-v1` is a profile-scoped, versioned local store separate from FSRS, other Quest campaigns and existing Cosmic evidence. It is included in profile exports. It stores canonical configuration/source identifiers, learning settings, completed checkpoint IDs, pinned boss contracts, boss evidence and assessment references; it does not duplicate Quran text or store audio/transcripts.

Genuine engine completion saves the activity immediately; a boss shield is saved before its success is acknowledged. Duplicate notifications do not advance a second checkpoint. Save failures stay visible and retain the current checkpoint for retry. Completed activities survive navigation and browser reload. An interrupted active flight or wave restarts from its last saved activity checkpoint, not an arbitrary mid-frame physics snapshot. Current expeditions are browser/profile-local, not automatic cross-device cloud saves.

Malformed/future data, source mismatches, storage limits and account changes fail without silently deleting or replacing existing progress. Export/recovery messages are shown. A content-source revision change requires deliberate recovery rather than silently counting old practice against changed content.

## Final oral recall

The route first completes **gameplay**. It then offers a separate final passage assessment. Quran text is hidden at the start; the learner declares their recitation attempt before full verified text is revealed. Again/Hard/Good/Easy ratings use `createPassageMemory` and the existing canonical `recallUnit` contract. No second scheduler is introduced.

Only this explicit learner rating invokes existing FSRS rules. Assistance before the declared attempt is recorded; assisted practice cannot schedule an independent review. Early review and duplicate grade behavior remain native. A spoken result is self-assessed, never automatic recitation/tajweed verification. Gameplay progress remains complete even if the learner chooses Again or leaves recall pending.

The saved final attempt ID is checked against the native active assessment on resume. An unrelated unfinished passage assessment is not overwritten. If another surface changes the active attempt, the user is shown a recovery message and the game route remains saved. Native graded results can be reconciled after an interrupted final save without issuing a second grade.

## Meteor Defense continuous revision

Public Defense now plays the current full ayah on repeat while its wave runs. After the wave, neutral hazards freeze and that ayah's gateway opens **inside the arena**. Correct gateway entry advances to the next wave and loops its full ayah. The final gateway completes the defense checkpoint. Abilities are still earned only by actual correct choices; initial defense begins without fabricated memory-earned charges.

Wave recitation is assistance. It stops during gateway selection, pause, recovery, navigation and account disposal, and does not overlap optional gateway recitation. Volume, stop and replay controls remain available. Autoplay/network failure is reported and never becomes a memory mistake. Desktop gateways use a three-column arena layout; mobile uses large stacked choices. Exceptionally long text remains available through internal scrolling instead of being truncated or shrinking Arabic to unreadable sizes.

The pure Defense engine retains an explicit legacy `revisionLoop:false` path for existing callers and deterministic compatibility tests; the public mission controller uses `revisionLoop:true`.

## Validation scope

Tests cover deterministic routes, full-surah and custom coverage, checkpoint order/idempotence, browser resume, malformed storage, profile isolation, weakness evidence thresholds, boss recovery, assistance, native FSRS grading and its separation from games. Browser tests exercise the real free full-surah route and mobile recall resume. Physical-device performance, live audio availability and cloud cross-device expedition syncing are not certified by headless Chromium checks.

Release validation: **119 targeted regression tests passed**, including Cosmic mechanics, shared arcade lifecycle, Falling Words, Snake, rewards and passage models. The real full-Al-Ikhlas expedition journey and later-stage resume/seam check passed separately. Production build and `git diff --check` passed. The older long `mission stages advance` browser case was excluded from this targeted run; this is not a claim that the complete repository-wide suite ran. Screenshots: `/workspace/artifacts/expedition-finish.png`, `/workspace/artifacts/expedition-mobile.png` and `/workspace/artifacts/meteor-mobile.png`.

No Supabase migration or new dashboard configuration is required for this phase. Existing authorization and cloud APIs are unchanged. Deploy the committed frontend through the normal manual Railway deployment.
