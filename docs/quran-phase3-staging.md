# Phase 3: per-juz preparation and staging

## Verified state (2026-11-10)

The catalog is complete: **114 surahs, 30 juz, 6,236 canonical ayahs**. Local technically validated coverage remains **1,210 ayahs**: 571 free and 639 private/developer/pilot ayahs. **5,026 ayahs are still missing**. Existing Al-A‘raf, Juz 29 and Al-Baqarah pilots retain their original pins. No new text has been regenerated, no old asset overwritten and no availability flags changed.

**Batch A is not released.** Juz 29 has all 431 ayahs locally prepared, but source-rights evidence, independent reference attestation, required release review, private staging deployment and live authorization/device tests remain unverified. No source policy or independent manifest has been supplied. Neither `SUPABASE_URL` nor `SUPABASE_SERVICE_ROLE_KEY` is present in the operator environment. Therefore no real import, Storage upload, Edge Function deployment, SQL migration or publication was attempted. These are blocked operator steps, not successful external actions.

## Release dashboard and audit

Run:

```sh
node scripts/quran-release-status.mjs
# Independently revalidate candidate contents when approved candidates exist:
node scripts/quran-release-status.mjs --validate-candidates
```

Open [`../content-audit/releases/index.html`](../content-audit/releases/index.html). Each card shows exact first/last references, expected count, original local coverage, prepared-candidate coverage, free coverage, gates and deployment status. The adjacent `juz-N.json` files contain canonical reference/hash manifests and source-validation gaps; `status.json` aggregates all 30 and includes source provenance, missing ayahs/aids/audio, duplicate/overlap problems, word-count problems, incomplete rights, unvalidated release revisions and recorded staging failures. Metadata only is exported; protected Arabic, translations and recordings remain private.

Candidate presence is never treated as validation. `--validate-candidates` calls the independent Phase 2 validator. A valid private Storage receipt does not prove deployed Edge authorization or public release. Failed attempts remain visible in the private staging journal and dashboard. A local integrity count never approves internal recitation stops. Existing free content remains unrestricted irrespective of these new-release gates.

## Batch order and previews

```sh
python3 scripts/stage-quran-batches.py --batch A   # 29
python3 scripts/stage-quran-batches.py --batch B   # 28, 27, 26
python3 scripts/stage-quran-batches.py --batch C   # 25 through 21
python3 scripts/stage-quran-batches.py --batch D   # 20 through 11
python3 scripts/stage-quran-batches.py --batch E   # 10 through 1
```

Previews are offline and make no writes. Every juz uses exact canonical ranges, including mid-surah boundaries; one ayah has one canonical ID. Juz 30 is preserved as the existing free library, not duplicated into private candidates. Free Al-Fatihah references within Juz 1 are delegated similarly.

## Exact operator actions to unblock

1. Complete the actual reuse/attribution evidence in [the Phase 2 source policy](quran-import-pipeline.md), for Uthmani distribution, resource-20 translation, word meanings/transliteration and full recordings. Free availability of a source is not evidence of commercial redistribution rights. Do not manufacture missing aids or approvals.
2. Obtain the independently reviewed full reference/juz manifest and compute its exact SHA-256. The example JSON files intentionally fail these gates.
3. After those approvals, prepare **Batch A first**:

   ```sh
   python3 scripts/stage-quran-batches.py --batch A --prepare \
     --policy /secure/source-policy.json \
     --reference-manifest /secure/reference-manifest.json \
     --reference-sha256 ACTUAL_SHA256 --concurrency 4
   ```

   The runner reuses the existing Phase 2 importer, copies existing validated bytes exactly, calls the independent validator per juz and records the candidate ID/status in ignored `.quran-private/staging-attempts.json`. It stops at the first failure. Repeating the same command resumes; `--recover` supports safely stale preparation locks. Keep malformed originals for recovery. Explicit source migrations still use the Phase 2 workflow; the batch runner never refreshes old validated assets implicitly.
4. Configure a **separate Supabase staging project** using the existing private-content/billing/review migrations and authorized content functions. No new database schema is needed for the operator journal or dashboard. Use secure environment variables for its project URL/backend credential; never chat, browser variables or Git. With the same approval arguments, add `--upload` to explicitly verify/create immutable inactive private Storage objects. Repeat to resume/verify; no upserts or active-object overwrites occur.
5. Review the resulting per-juz provenance, actual source edition, required content-review status and attribution. Obtain appropriate staff review separately; technical validation does not confer scholar-approved waqf or word-audio alignment.
6. **Activation is still a separate staging deployment.** Current Edge Functions do not automatically serve `releases/ID` quarantines. Follow the Phase 2 activation review: explicitly bind staged references to validated bundle/audio/provider fingerprints through the existing authorized content system, deploy the matching Edge Function/configuration to staging, preserve all old pins/history and keep the bucket private. Do not run `prepare-developer-preview` or regenerate active source pins blindly.
7. Test direct Storage denial, anonymous/Free/under-entitled denial, authorized premium/staff access, account A/B isolation, downgraded/sign-out cleanup, correct full-ayah playback and desktop/390px mobile passage/game flows on staging. Capture real test evidence with source revision and staging project identity. A generated dashboard or passing local tests does not substitute for these live tests.
8. Publish only after all gates are reviewed. No automated publication or false `released` state exists here. Record the actual approved deployment/source revision in a subsequent reviewed activation change. Continue B → C → D → E only after checking each batch.

## Current limitations and validation

The deliverable currently consists of local per-juz integrity/provenance reports, a gated resumable batch runner and an operator release-status dashboard. **All remaining content has not been prepared or staged.** Required external evidence and secure staging access are absent. Live endpoint/device/security checks remain operator gates. Tests use real existing canonical metadata plus explicitly synthetic failure/candidate states; they never attest real uploads or rights.

Snake's separate boost change adds 60% speed for five active seconds, two seconds of cooldown, Space/mobile activation, and 150 rather than 100 arcade points per correct boosted piece. Pause/motor recovery freeze its timer; lag is not simulated as extra movements. It does not change learning XP caps or FSRS.
