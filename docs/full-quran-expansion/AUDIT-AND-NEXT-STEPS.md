# Phase 1 audit contract and next implementation boundary

## Existing architecture reused

- `src/data.js`, existing free JSON/provenance/audio: unchanged source of free content.
- Existing `quran-catalog.json`: sole canonical chapter/juz metadata catalog; the new audit does not introduce competing numbering or learning IDs.
- Existing `content-availability.json`: sole current release/developer pin declaration, unchanged.
- `content-policy.js` and `provider-content.js`: existing bundle validation/provider fingerprint contracts reused read-only.
- `.quran-private/manifest.json` and original private bundle/audio: inventoried without rewriting pins or files.
- Existing authentication/RLS/entitlements, FSRS, lab engines, learning stores and mobile controls: untouched.

The new files are **operator audit metadata/tools**, not a new content-serving system. No runtime lab imports the audit outputs; no new paid/free policy is wired from them. No migration is required.

## Evidence stages

| Field | Meaning |
| --- | --- |
| `cataloged` | Exact canonical reference exists in the current catalog and its two range projections agree |
| `downloaded` | Source material/bundle exists locally in this audit workspace; inspect individual assets for partial availability |
| `validated` | Required local assets pass the declared local integrity/presence checks. This is not new upstream, religious or license approval |
| `reviewed` | `not-attested` until actual relevant human-review evidence is provided; presence of a source pin does not substitute |
| `deployed` | `not-verified` without actual hosted deployment/object/authorization evidence |
| `publiclyAvailable` | `not-verified` without per-content delivery evidence; `policy: free` separately records the preserved current free-library rule |

All ayahs retain one canonical `surah:ayah` key. Juz ranges may begin/end within a surah; imports must not clone that surah into competing canonical records. Al-Fatihah is free in Juz 1; Juz 1 itself is not therefore complete/free. Six public word distractor recordings do not supply whole ayahs or unlock premium references.

`preservedPins` copies the existing private bundle/audio/provider hashes and word counts. `inputPins` identifies immutable source metadata/free text/source/font inputs and the local private-manifest snapshot. Each generated report includes the canonical manifest digest so mismatched/stale report generations can be detected.

Missing optional private word audio is distinct from missing required full-ayah audio. No private word timing or approved phrase boundary is guessed. The source registry is audit attribution/evidence metadata; it is not an automatic license validator or a backend authorization flag.

## Current inventory

All 6,236 references are cataloged. 1,210 have required local assets passing integrity checks: 571 free and 639 private/developer. 5,026 still lack required local material. Juz 29 is technically present (431 ayahs); Juz 30 has the existing free material (564 ayahs). Juz 1 has seven free Al-Fatihah ayahs; Juz 3 has two private pilots; Juz 8/9 contain the existing Al-A'raf preview portions. Other source coverage remains missing. See the generated report for exact first/last/count values for all 30 juz.

No current local integrity conflicts were found, but rights/review/hosted deployment gates remain unverified. None of the 30 juz is newly marked released by this audit.

## Findings for Phase 2 — do not run the old importer blindly

1. **Argument parsing comes after network/catalog writes.** `prepare-quran-content.py` currently fetches chapter/juz metadata and writes `quran-catalog.json` before parsing command arguments. Even a help/error invocation is not a safe dry-run interface. The new offline auditor does not invoke it.
2. **No explicit source-version migration guard.** The old importer overwrites bundle JSON, merges the manifest and rewrites availability; it can update existing pins implicitly. Phase 2 must require explicit source migration rather than silently replacing validated assets.
3. **Current availability rewriting risks dropping developer metadata.** The preparer's final availability object does not preserve all later preview/provider fields by construction. Preserve unknown/legacy fields and the exact existing fingerprints until an approved migration.
4. **Missing source license/approval checks.** Existing provider/resource declarations do not document commercial rights or human review. Dry-run/release reports must retain these gaps rather than manufacture missing assets or approvals.
5. **Importer interface is incomplete for the new plan.** It currently has surahs/references/all, not the full selected-juz/contiguous-range/dry-run/validation-only/recovery interface. `--all` is deliberately large and is not executed here.
6. **Resume/version semantics are insufficient for a complete corpus.** Existing audio-file skipping and manifest merge are not independent proof of matching source versions or transactional/interrupted deployment recovery. Add bounded resumable imports and independent validation before deploying later batches.

These findings do not change existing production files or claim they have already caused a hosted incident. They are specific inspected implementation risks that the next phase must repair.

## Phase sequence and release limits

The uploaded plan requires phase review before merging. Phase 1 is a concrete review package on its own branch; it does not silently continue into imports, publishing, native SDK installation or store submission. Once reviewed, Phase 2 should generalize the existing importer/validator and add controlled fixture-based tests before Phase 3 downloads/staging.

Native projects/features/billing/store submissions remain Phases 6–10, not implemented by the content manifest. Store SDK/target API/purchase/age/testing policy claims in the uploaded planning document must be rechecked against current official platform requirements when those phases begin; this audit does not certify them. Apple signing/macOS/Xcode, Android SDK/build tools, store credentials, physical devices, purchase sandboxes and operator/legal/editorial review are separate external gates. Do not claim native builds, full Quran publication or any store submission based on this phase.
