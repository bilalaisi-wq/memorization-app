# Ayah Quest 3.0 migration and recovery report

Baseline: `96bd2d1`. This audit introduces no data migration, table, text import, schema bump, scheduler change or game-ID rename. Existing validators remain authoritative. “Supported” means the actual repository contract below, not arbitrary historic formats.

## Local compatibility matrix

Authenticated storage uses `ayah-user:<Auth UUID>:<key>`; guest keys remain unprefixed. A change of account selects another namespace, not a destructive migration. The following table inventories persisted learning/product schemas; ephemeral DOM IDs are excluded.

| Key(s) | Supported contract | Compatibility / recovery | Cloud scope |
| --- | --- | --- | --- |
| `ayah-mastery`, `ayah-quiz`, `ayah-completed` | Legacy win map, wallet, completed numeric Fatihah offsets or canonical references | Core migration copies original raw strings to `ayah-learning-legacy-v1`; old puzzle achievements create no memory cards | Core opt-in snapshot |
| `ayah-learning-v1`, `ayah-learning-legacy-v1` | `schemaVersion:1`; canonical records, wallet, receipts, FSRS cards/history; raw migration backup | Invalid/future core data becomes read-only; export retains raw canonical and backup; mirrors do not confer mastery | Core opt-in snapshot |
| `ayah-puzzle-lab-v1` | `schemaVersion:1`, history and weaknesses; old/new game IDs retained | Metadata-only all-Quran reference catalog allows private history to survive loss of content access; no content permission derives from history | Core opt-in snapshot |
| `ayah-gallery-v1`, `ayah-goals-v1`, `ayah-activity-v1`, `ayah-achievements-v1` | Gallery version 1; existing goals/activity/achievement contracts | No conversion or reset in this release; malformed bytes retained in device export; unreadable/future goals now block editing rather than being replaced | Core opt-in snapshot |
| `ayah-cloud-sync-v1`, `ayah-cloud-restore-backup-v1` | Sync version 1; durable restore journal with original/incoming copies | Unknown metadata blocks automatic restore; write failure rolls back or retains pending journal. Explicit recovery required | Device sync metadata, not a separate history |
| `ayah-passage-recall-v1`, `ayah-passage-sync-v1` | Version 1; ayah/segment/passage units, actual assessments/cards, active attempt; CAS base | Native cancel creates no grade. Raw invalid data export; remote conflicts preserve alternatives | Separate passage CAS sync |
| `ayah-passage-workspaces-v1` | Version 1 workspace document; legacy/grouped layouts stored separately | Source-position/sequence validation on restore; no guessed arrangements or recitation stops | Local only |
| `ayah-passage-context-v1` | Version 1 selection: canonical refs, active ref/lab, source/review fingerprints | Reauthorize before restore; stale revisions reject without overwriting descriptor/drafts | Local only |
| `ayah-memorization-lab-v1` | Version 1 adaptive records, grouping/page/round/orders/assistance, optional later metadata | Original position IDs; missing optional fields remain compatible; malformed/future blocked | Local only |
| `ayah-arcade-passages-v1` | Version 1 bounded stages/results/credited receipts; optional hints | Preserve original progress on invalid/future data | Local only |
| `ayah-quest-campaigns-v1`, `ayah-quest-revision-v1`, `ayah-quest-recovery-backup-v1` | Version 1 owner-bound campaign/revision documents; raw recovery copy | Deterministic checkpoint IDs and source pins; explicit restore validation, no second scheduler | Local only |
| `ayah-cosmic-expeditions-v1`, `ayah-cosmic-links-v1`, `ayah-cosmic-gateways-v1`, `ayah-cosmic-adaptive-v1` | Version 1; source-pinned routes and separately classified evidence | Existing optional metadata remains supported; source/owner mismatch blocks application | Dedicated Cosmic CAS whitelist |
| `ayah-cosmic-cloud-v1`, `ayah-cosmic-recovery-v1` | Version 1 cloud metadata/recovery copies | Explicit conflict/recovery, no blind merge | Device metadata |
| `ayah-cosmic-defense-capture-v1` | Version 1 runs; optional routes | Bounded page/cursor/receipts; original raw data preserved if invalid | Local only |
| `ayah-revision-missions-v1` | Version 1 source-pinned runs/tasks/assessment receipts | Saved ordering/source changes reject; actual native grade saved before campaign acknowledgement | Local only |
| `ayah-chronicles-v1` | Version 1 runs; inventory/objective IDs, source hash, optional rewarded IDs | Source-bound; no religious text or raw audio in progress. Discovery grants no XP | Local only |
| `ayah-bridge-checkpoints-v2`, `ayah-maze-expeditions-v2`, `ayah-sirat-journeys-v2` | Version 2 checkpoints | Structural validation followed by engine/source-specific restore validation; obsolete mechanics history remains in Puzzle Lab; no fabricated v1 physics conversion | Local only |
| `ayah-bridge-tutorial-v1` | Version 1 unseen/skipped/completed | Tutorial state separate from assessment and rewards | Local only |
| `ayah-rewards-v1`, `ayah-reward-remote-v1`, `ayah-nature-profile-v1` | Version 1 reward events/buckets; remote reward cache and companion ownership | Existing receipt/cap logic; server verifies bounded reward publication and purchases | Server reward/profile RPCs, not raw local trust |
| `ayah-appearance-v1`, `ayah-sky-celebrations-v1`, `ayah-coach-settings-v1`, `ayah-cosmic-preferences-v1` | Existing appearance/celebration/coach/flight preferences | Device export includes profile-scoped settings | Appearance has its own authenticated table |

Device-global preferences: `ayah-experience-v1`, `ayah-tutorial-v1`, `ayah-lab-muted`, `ayah-lab-volume` (not memorization histories). IndexedDB `ayah-feedback-media-v1` stores user-selected encouragement audio separately; it is not included in JSON progress exports. Supabase SDK auth storage is managed by the SDK and deliberately excluded from progress exports. In-memory audio URLs/recording blobs and request tokens are not learning records. See `src/learner/profile-storage.js` for the exact export whitelist.

## Cloud inventory

| Tables | Purpose / write authority |
| --- | --- |
| `learner_progress`, `leaderboard_preferences`, `weekly_activity` | Owner progress/CAS and opt-in public ranking; validated RPCs and ownership policies |
| `learner_appearance` | Owner-only appearance |
| `billing_config`, `billing_customers`, `billing_subscriptions`, `billing_events`, `billing_locks`, `billing_checkouts`, `billing_juz_choices`, `saved_passages` | Server billing authority; webhook receipts/locking and selected juz; client cannot set paid status |
| `passage_learning`, `cosmic_progress` | Owner-readable, revision-checked server-function writes; independent FSRS histories retained |
| `quran_reviewers`, `quran_review_heads`, `quran_review_versions` | Source-pinned segmentation review, explicit study/stop/restart status |
| `recitation_ai_config`, `recitation_adult_pilot`, `recitation_ai_usage`, `recitation_ai_requests` | Consent/feature gates, atomic quota, analysis metadata; no automatic mastery |
| `hifz_coach_config`, `hifz_coach_usage`, `hifz_coach_cache` | Feature gates, quota/cache; recommendations do not reschedule FSRS |
| `learning_reward_events`, `avatar_catalog`, `nature_profiles` | Idempotent bounded server reward receipts, active catalog, ownership/purchases |
| `site_developers`, `site_layout` | Verified developer roles; controlled layout changes |
| `chronicles_editors`, `chronicles_lessons`, `chronicles_audit` | Server-only source-reviewed publication workflow; no direct client table grants |
| Storage `quran-premium` | Private source/audio; restrictive policies and authorized server loading |

Canonical schema starts with `supabase/schema.sql`, followed by ordered files in `supabase/migrations/`. Do not paste data tuples or Markdown into SQL Editor. Later migrations depend on earlier table/types/RPCs. No new SQL is required by this audit.

## Migration evidence and recovery procedure

`memory-model.spec.js` covers original legacy wallet/completion migration, no invented memory, malformed records and backup failures. Existing passage, quest, cloud, bridge/maze/Sirat and source-context suites cover supported restores, revisions, owner switches and invalid data. `phase8-compatibility.spec.js` adds a common round-trip plus malformed/future-version matrix for seven newer stores, all export keys byte-for-byte, and premium-history preservation during free operation. These are supported-version tests, not proof that undocumented third-party JSON can be migrated.

Before update: Account → export device progress in each relevant account and guest profile; export passage reviews/workspaces where applicable. Keep the original files. On a recovery warning, do not clear browser storage or overwrite a draft. Export raw data; choose the native explicit cloud/device conflict direction or restore the original device journal. Unknown formats require manual diagnosis against the retained raw file. A downloaded export is a recovery artifact, not a promise of one-click import for every schema. Local-only campaigns cannot be recovered from Supabase alone.
