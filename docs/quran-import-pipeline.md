# Qur’an import pipeline — Phase 2

## Scope and status

This extends `scripts/prepare-quran-content.py` and `scripts/upload-quran-content.mjs`. It retains schema-1 runtime bundles, canonical `surah/ayah` paths, the current catalog, full-ayah audio, and existing authorization. It does **not** modify runtime availability, publish surahs, alter entitlements, copy premium content into Vite/public, or replace the existing catalog. Source preparation is an operator process, not a browser feature.

New files are isolated in ignored `.quran-private/candidates/<deterministic ID>/`. Existing `.quran-private/manifest.json`, validated bundles, free data, audio, reviews, user records and FSRS are untouched. Phase 1's audit remains the inventory; candidate preparation does not assert deployment or scholarly review.

**Release gates remain pending:** the repository does not contain independently attested external reference mappings or documented commercial-use approval for all required editions/assets. The example files intentionally fail approval. Do not turn their booleans on without real evidence. Network retrieval and a free download do not establish reuse permission. No new real content has been imported or uploaded in this phase. Tests use clearly marked synthetic permissions, an existing Arabic fixture and generated silent audio; these are never release materials.

## Approved fetch providers and provenance

The existing provider set is retained and hard-coded:

| Asset | Fixed source | Validation |
|---|---|---|
| Exact Uthmani ayah | `https://api.quran.com/api/v4/quran/verses/uthmani?verse_key=…` | exact response bytes retained, SHA-256, canonical reference |
| Word positions, meanings, transliteration; translation | `https://api.quran.com/api/v4/verses/by_key/…?words=true&word_fields=text_uthmani,audio_url&translations=20` | contiguous positions, complete aids, reference/juz, resource 20 |
| Full Alafasy ayah audio | `https://verses.quran.com/Alafasy/mp3/SSSAAA.mp3` | SHA-256, byte count, MP3 signature, ffmpeg decode, ffprobe duration |
| Optional reviewed word recording | `https://audio.qurancdn.com/wbw/SSS_AAA_WWW.mp3` | source word path, exact text/audio SHA, explicit word-position approval and separate reuse evidence |

Only HTTPS on port 443 is accepted; redirects, credentials in URLs, arbitrary providers and arbitrary audio paths are rejected. Each download is bounded to 32 MiB, three attempts and a 45-second network timeout. Preparation uses 1–8 workers (default four). A missing required asset fails the candidate; missing/unreviewed optional word audio is explicitly reported. Word paths are never guessed and marked verified merely because an ordinal URL exists.

Provider availability is not an edition guarantee. Known legacy source versions that differ from the selected policy are rejected until an explicit refresh migration; unversioned legacy data retains its original hashes and provenance rather than being relabeled as a fresh fetch. Record the actual provider version in `sourceVersion`; changing it, translation resource, canonical edition, or provider endpoints requires a reviewed migration/code change. Raw source JSON is retained privately under `sources/<SHA>.json`. No automatic scholarly segmentation approvals are imported. Full ayah is the only automatically supplied segment; visual grouping remains a separate downstream concern.

## Prerequisites

Use the repository root with Python 3, Node 22+ (JSON import attributes), ffmpeg and ffprobe installed. No pip dependency, AI call, service key or frontend framework change is needed for preparation/validation.

1. Copy `docs/quran-import/source-policy.example.json` into a secure operator folder. Complete commercial-use evidence, source edition/version, reviewer and review date for **each** required asset class. Resource 20 is the current Saheeh International integration; it is not an approval to use an edition commercially.
2. Obtain a genuinely independent reference manifest from a documented authority. Use `docs/quran-import/reference-manifest.example.json` as the schema, filling **all 6,236** unique `{ "key": "SURAH:AYAH", "juz": N }` rows and real independent-source/reviewer metadata. It must describe the same edition/reference convention. Do not generate this attestation from the Quran.com catalog and call it independent.
3. Compute its file SHA-256 separately (`sha256sum /secure/reference-manifest.json`, or PowerShell `Get-FileHash ... -Algorithm SHA256`). Supply the exact digest. The importer checks every reference and juz against the existing catalog and retains the pinned independent manifest privately.

Approval fields are operator attestations, not automatic legal or scholarly certification. Preserve the supporting source documents outside the public bundle.

## Select and preview (no writes or network)

```sh
python3 scripts/prepare-quran-content.py --juz 29 --dry-run
python3 scripts/prepare-quran-content.py --juz 1 2 3
python3 scripts/prepare-quran-content.py --surahs 2 7
python3 scripts/prepare-quran-content.py --range 2:255-3:5
python3 scripts/prepare-quran-content.py --range 2:255-282
python3 scripts/prepare-quran-content.py --references 2:255 2:282
python3 scripts/prepare-quran-content.py --all
```

Exactly one selection type is required. Lists are numeric/canonical; invalid surahs, juz, aliases, reversed ranges and duplicate explicit references fail. Range syntax is **SURAH:START-SURAH:END**, or **SURAH:START-END** for a single surah. Cross-surah ranges follow canonical order, including mid-surah juz boundaries. `--all` selects 6,236 references; 571 free references are delegated to existing free assets, leaving 5,665 private references. Juz 30 produces no private duplicate copies. No availability claims are generated for free assets by this tool.

## Prepare and independently validate

```sh
python3 scripts/prepare-quran-content.py --juz 29 --prepare \
  --policy /secure/source-policy.json \
  --reference-manifest /secure/reference-manifest.json \
  --reference-sha256 ACTUAL_SHA256 \
  --concurrency 4
```

This creates a deterministic candidate and invokes the separate Node validator. No catalog/runtime/legacy file is rewritten. Exact canonical full text is retained. Stop symbols attached to tokens remain attached, standalone marks remain with their canonical neighboring word; normalization is only an alignment comparison, never text output. Meanings or transliterations are never fabricated to fill gaps.

Revalidation, without fetching or repairing Arabic:

```sh
python3 scripts/prepare-quran-content.py --validate-only --release .quran-private/candidates/ID
node scripts/validate-quran-release.mjs --release .quran-private/candidates/ID
# Retained legacy check for current locally pinned Juz 29:
node scripts/validate-private-juz.mjs 29
```

The independent validator uses the existing runtime `validateBundle` contract and canonical catalog. It checks reference selection, source fingerprints, license attestations, exact source full text, word aids, original provenance, full-ayah/word recording pins, decode/duration and safe contained paths. It generates `upload-manifest.json` only after success. Validation can write that derived manifest but never repairs malformed source files.

### Optional reviewed word audio

Add `--word-audio-review /secure/word-audio-review.json`. Schema:

```json
{
  "schemaVersion": 1,
  "entries": [{
    "key": "2:255", "position": 1, "status": "approved",
    "textSha256": "SHA256_OF_EXACT_CANONICAL_WORD_UTF8",
    "audioSha256": "SHA256_OF_REVIEWED_MP3",
    "reviewer": "ACTUAL_REVIEWER", "reviewedAt": "ACTUAL_DATE",
    "evidence": "ACTUAL_ALIGNMENT_REVIEW_REFERENCE"
  }]
}
```

`rights.wordAudio` must carry the same approval fields as required asset rights. A reviewed clip must match the actual provider's `audioSource`, exact canonical word spelling/marks and position. It grants no internal waqf approval. Without a review there is no fetched/published word clip and `audioVerified` stays false. Adding clips to an existing validated bundle requires an explicit migration (below). Word reviews outside the selected private references are rejected.

## Resume and recovery

Rerun the **same command/configuration** to resume. Candidate IDs include selected refs, source version, approval fingerprints, optional word reviews and legacy-manifest fingerprint. A changed approval/config creates a separate candidate instead of mutating a prior release. Completed entries are rehashed before reuse; failures and missing assets are retained in `journal.json.errors` and the actionable `missing-assets.json` report. Invalid data is never silently repaired or discarded.

Use `--recover` on the same preparation command only after an interrupted process left an `import.lock`. A lock is removed automatically only when its recorded process no longer exists on the same host. Active or foreign-host locks are not stolen. Preserve malformed locks/journals and candidate files for operator investigation; do not delete or guess repairs. Interrupted unvalidated temporary files may be replaced by the next attempt; validated completed assets are not overwritten.

For a deliberate source update, use a new `sourceVersion`, add a documented `migrationReason` to the policy, and pass `--refresh --migration-from SHA256_OF_EXISTING_PRIVATE_MANIFEST`. This prepares new bytes in a new candidate and records prior bundle/audio hashes. It does not overwrite the old assets or activate new runtime pins. Review both versions before any later activation. Never use refresh to conceal an unexplained source difference.

## Candidate contracts

| File | Purpose |
|---|---|
| `selection.json` | schema 1 / pipeline 2; deterministic selection, free delegation, edition/version, approval/catalog/legacy hashes |
| `manifest.json` | compatible schema-1 `verses` rows; pipeline 2/release ID; per-asset pins, counts, provenance and migration evidence |
| `legacy-manifest.json` | exact prior operator manifest snapshot, never rewritten in original location |
| `source-policy.json`, `reference-manifest.json`, `word-audio-review.json` | private pinned operator attestations |
| `sources/*.json` | content-addressed exact provider responses |
| `SURAH/AYAH/bundle.json`, `full.mp3`, optional `word-POSITION.mp3` | existing bundle layout and optional reviewed audio |
| `missing-assets.json` | blocked references, source/recovery reasons and suggested operator action |
| `journal.json` | atomic preparation receipts and actionable per-reference errors |
| `upload-manifest.json` | independent validator output; paths, hashes, sizes, MIME types, duplicates and missing optional word audio |
| `upload-journal.json` | project/release-scoped, key-free remote verification receipts |

Identical bytes are detected by SHA-256 and marked `duplicateOf`. Canonical per-reference paths remain intact for compatibility; deduplication does not merge repeated Arabic word positions or reuse a recording across different references without review. No raw Quran content enters public metadata. A release candidate is not a declaration of launch readiness.

## Idempotent private Supabase upload

1. Ensure the existing `quran-premium` Storage bucket exists and is **private**, with current server-only content access policies. This phase needs no new table or RLS migration. Never make it public or add client SELECT permission to bypass the Edge Function.
2. Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in a secure operator shell/CI secret store. Use a service-role JWT or Supabase backend secret; never `VITE_*`, browser publishable keys, command-line arguments, chat or a committed `.env`.
3. Validate, inspect and dry-run:

```sh
node scripts/validate-quran-release.mjs --release .quran-private/candidates/ID
node scripts/upload-quran-content.mjs --release .quran-private/candidates/ID --dry-run
```

4. Explicit upload after reviewing the manifest:

```sh
node scripts/upload-quran-content.mjs --release .quran-private/candidates/ID --upload
```

The uploader independently revalidates local assets and requires the derived upload manifest to match. It probes bucket privacy and uploads under immutable **`releases/ID/SURAH/AYAH/...`**, not the active runtime path. GET/compare skips identical remote bytes; POST uses `x-upsert: false`; a conflict is accepted only if a fresh GET verifies the identical hash. Writes are sequential, requests have 60-second timeouts and up to three bounded retries. Journals are atomic and project-scoped. Repeat the command after interruption, including a crash after a remote commit; remote hashes are rechecked regardless of local receipts.

An unexpected remote hash, public bucket, malformed receipt, changed project or modified local asset fails safely. Nothing is deleted or overwritten. Preserve diagnostics and investigate instead of forcing an upsert. The old implicit upload of root `.quran-private/manifest.json` has deliberately been removed because it bypassed approval gates and overwrote active storage.

**Activation is a separate reviewed deployment step**, not performed by this importer: review pins/provenance, stage through the existing authorized content workflow, update the existing server manifest/provider mapping explicitly, and test entitlement/RLS. The current Edge Function does not automatically serve quarantined `releases/ID` files. Do not advertise prepared content or change public availability until that activation and its access tests pass. To roll back preparation/upload, leave runtime pins unchanged and retain the inactive immutable candidate; no learner progress changes are needed.

## Tests and limitations

Recorded results: [Phase 2 validation evidence](quran-import/VALIDATION.md).

Run `npm run test:quran-import`, the complete Playwright regression suite and `npm run build`. Tests cover all 30 boundaries, cross-surah ranges, long/repeated-word alignment, missing aids/audio, independent mapping/source mismatches, interrupted preparation/uploads, stale/active locks, legacy byte reuse, explicit version migration, optional word reviews, immutable remote conflicts/races, private bucket checks, safe paths and malformed recovery records. Synthetic transport tests do not establish live provider availability, real licensing or deployed Supabase authorization. Those are operator/staging release gates. No new private surahs are included in the public bundle by these changes.

### Vite development boundary

Git ignore rules do not prevent Vite from serving files. The npm dev/build/preview commands explicitly use `scripts/private-vite.config.mjs`: existing `.env`/key/Git denies are retained and private Quran/recitation directories are denied too. A plugin rejects imports from these directories and rejects protected folders placed or resolved inside `public`. Use the npm commands, not a bare `vite` command that bypasses the configuration. Restart an already-running dev server after this configuration change. The Railway static server continues serving only `dist`.
