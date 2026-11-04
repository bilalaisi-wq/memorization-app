# Cosmic Rush Phase 7: private persistence and adaptive revision

## Database audit and migration choice

Core `learner_progress` uses a fixed ten-key legacy whitelist and optimistic concurrency. `passage_learning` contains the existing FSRS document and uses `save_my_passage_learning(integer,jsonb)`. Rewards and leaderboard receipt deduplication already exist. Neither core progress nor passage memory can safely hold a second, unrelated game document without changing their contracts.

This release adds **one table**, `cosmic_progress`, containing one private versioned document per user, a revision, last request UUID and update timestamp. It contains expedition checkpoints, pair evidence, game history and adaptive observations, never Quran text or recordings. No existing table rows are migrated, deleted or rewritten by installation. Core sync formats, FSRS parameters, reward caps and leaderboard privacy are unchanged.

Run [SETUP_COSMIC_PROGRESS.sql](../supabase/SETUP_COSMIC_PROGRESS.sql) in Supabase SQL Editor. Paste the entire SQL file, without Markdown fences or its filename. Prerequisite: the existing `20261023_passage_content.sql` migration. The script deliberately reports a missing prerequisite rather than creating a partial alternative passage schema. It can be run again safely. Deploy the frontend after applying it. No new API key, secret, bucket, AI service or Edge Function is required.

RLS and grants permit authenticated users to select only their own row. Anonymous access and direct authenticated insert/update/delete are denied. The write RPC binds `expected_user` to `auth.uid()`, validates the document scope, locks the user row and applies compare-and-swap revisions. Identical retries return the existing revision. An old differing snapshot cannot overwrite a newer one. These are private self-reported learning records, not server-certified recitation or premium entitlements.

A small account-bound wrapper delegates to the **existing** passage CAS RPC. It prevents a background request from writing an old profile's document under a newly signed-in account. It does not grade, reschedule or create a second FSRS implementation.

## Account and offline behavior

My account → **Cosmic Rush private sync** provides manual sync, an opt-in automatic-sync toggle, cloud download, explicit cloud restore, keeping the device copy after a conflict, and device-copy recovery. The option is per device and off by default. Signing in can restore an existing private copy into an empty device. Guest progress remains browser-local and is not silently copied into an account.

Local checkpoint writes remain synchronous and idempotent. Rendering and physics never await a database write. Automatic uploads are debounced in the background. Offline errors retain local data. New changes during an upload remain pending for a later pass. Requests are serialized and the pending request ID/snapshot survive reload for safe retries after lost acknowledgements.

Two devices editing the same document produce a visible conflict rather than a last-writer overwrite. Download both copies before choosing a restore direction. Keeping the device copy first backs up the cloud snapshot, then uses a fresh compare-and-swap check; it never forcibly replaces passage FSRS history. A restore saves the original and incoming documents to a durable recovery record before replacing keys. An interrupted restore remains recoverable. Recovering the original disables automatic uploads until the conflict is deliberately resolved. Malformed/future data is preserved for export rather than reset.

The native passage review document stays in `passage_learning`, with its existing concurrency and history. Equivalent cloud replies can acknowledge a lost upload without repeating a grade. An edit during a pending native restore stops the restore. A stale passage view cannot save over newer assistance flags or history; reopen the assessment. An unfinished active attempt cannot be silently replaced by a background restore. A conflicting unfinished recall from another device requires review/recovery; it is not merged into invented independent attempts.

## Tracked evidence and separate adaptation

Expedition task IDs derive from canonical mission/stage references. Saved records cover selected ayahs, all internal transitions including stage seams, completed activities/stages, pinned boss plans, shield outcomes and final assessment references. Link/boss logs separate observed errors, hints, supported recognition, typed retrieval and learner self-assessment. The adaptive ledger stores reference IDs and actual motor metrics; it does not store Arabic text, raw input or audio.

**Arcade model:** recent completed motor checkpoints, observed collisions, active lane changes and defense interceptions versus core impacts. Interception ratio is not shot accuracy. Repeated collisions suggest slower movement/fortress defense; three clean active checkpoints can suggest agile defense. Old collisions do not permanently lock a learner into support. Existing learner-selected slow pace is retained. These decisions never change recall quality or FSRS.

**Memory model:** recent observed memory-selection errors and hints, source-backed difficult adjacent pairs and existing independent passage recall history. Three successful independent review days recorded by the native scheduler can increase typed retrieval demand. The model uses the existing `successfulDays` rather than slicing UTC timestamps or counting early-repeat attempts as extra review days. Repeated difficulty selects supported Link demonstrations. Multiple-choice victories cannot produce the independent-day evidence required for extended retrieval. No forgetting formula is invented and missed days are not treated as proof of forgetting.

Both decisions are versioned and pinned for the current task, so reload does not silently change an interrupted challenge. The next checkpoint can reflect newer evidence. Boss question blueprints remain pinned independently, including safe fallback if phrase approval changes.

## Focused weak-link repair

Revision Lab offers repair routes only after at least two actual recorded transition difficulties. Each route cites evidence identifiers and includes the preceding/following context (normally N−1 through N+2), bounded to the same free surah. It reuses complete-ayah audio, Link practice and opportunities to recite. Motor failures, whole-passage self-reports and missing-verse reconstruction errors are not falsely mapped to a precise adjacent pair. Without sufficient evidence, no known-weakness repair mission is fabricated.

## FSRS and rewards

Only the existing declared-attempt → verified comparison → Again/Hard/Good/Easy workflow submits a native recall rating. Hint/audio-assisted attempts retain the existing eligibility rules. Recognition, motor success, boss shields and completed routes never submit successful recall ratings. Existing histories and scheduler settings remain unchanged. Native attempt IDs, private-document CAS and existing XP receipt IDs prevent repeated saves from awarding again. Leaderboard submissions continue through the existing capped receipt publisher; Cosmic documents are not made public.

## Operational limits

Live Supabase installation and real two-device verification require applying the migration in the target project. Automated SQL tests use PostgreSQL-compatible PGlite with real roles/RLS; service tests simulate outages, conflicts and account changes. Browser tests cover integration with the actual local app. These checks are not a claim that the migration has already run on the live project or that production cloud deployment was verified.

## Dashboard setup and smoke test

1. Open the existing Supabase project → **SQL Editor → New query**.
2. Open `supabase/SETUP_COSMIC_PROGRESS.sql` from this repository and copy its entire contents into the query. Run the SQL itself, not the filename or a Markdown label.
3. If the prerequisite error names `20261023_passage_content.sql`, install that existing migration first, then rerun this file. No existing data should be deleted to resolve the dependency.
4. Deploy the latest frontend commit in Railway using the normal manual deployment.
5. Sign in → **My account → Cosmic Rush private sync → Sync Cosmic Rush now**. Verify the private-sync status. Automatic uploads require the separate opt-in checkbox.
6. Complete a checkpoint, sync, then sign in on an empty second browser profile. Open Revision Lab and verify the saved route. Check the same account's passage recall dates after native review sync.
7. Verify another account cannot see that route. If two devices diverge, download both copies before restoring; never edit FSRS history or subscription tables to resolve a Cosmic sync conflict.

## Verification results

- Broad regression run: 188 checks passed, including the full adaptive Al-Ikhlas expedition, account flows, existing recall screens, passage workspaces and arcade engines. Its one failure was an older test's host/browser clock race (`pauseAt` attempted a past timestamp).
- The clock fixture was corrected to freeze using the browser clock before flight starts. Final focused run: **38 passed**, covering the corrected Runner behavior, SQL/RLS, private cloud persistence, both adaptive models, repair routes, existing FSRS models and the native successful-review-day rule.
- Production build and whitespace checks passed. SQL setup/migration files are identical; the setup SQL was tested twice for safe re-execution.
- The older long `mission stages advance` browser case was excluded. This is a targeted release check, not a claim that every repository test or live Supabase deployment ran.
