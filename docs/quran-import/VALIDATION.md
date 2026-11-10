# Phase 2 validation evidence

Date: 2026-11-10. Branch: `full-quran-phase2-pipeline` (review before merge).

## Changes verified

- The existing preparer is now an offline-safe CLI over a reusable operator module. It creates isolated candidates rather than rewriting the live catalog, root manifest or availability.
- The separate Node validator reuses the existing canonical catalog and runtime bundle validator, checks independent mapping evidence, source/raw-response hashes, exact Uthmani source text and canonical word tokens, required aids, MP3 decoding/duration and reviewed optional clips.
- Uploads require an independently generated manifest, a private bucket and server credentials. Objects are immutable, remotely rehashed and placed in inactive release paths. Identical reruns and create races are safe; differing bytes fail.
- Vite's development server previously returned HTTP 200 for a local private manifest. Explicit private-directory denies now block it; build guards reject imports or copied protected directories while preserving free builds. No production exposure was inferred from the local reproduction.
- Existing source validation and local/free content are unchanged. No new real downloads, credentials, uploads, source approvals or availability claims were created.

## Commands and results

| Check | Result |
|---|---|
| `python3 scripts/test_quran_import.py` | 14 offline integration tests passed |
| Focused Playwright import + private-boundary tests | 15 passed |
| Complete Playwright regression, final Vite configuration | 937 passed in 14.5 minutes |
| `test:billing`, `test:content`, `test:recitation`, `test:coach`, `test:chronicles` | 29 backend tests passed (7/6/5/5/6) |
| `check:billing`, `check:content`, `check:recitation`, `check:coach`, `check:chronicles` | All passed |
| `npm run build` | Passed; no protected paths among 3,017 output files |
| `node scripts/validate-private-juz.mjs 29` | 431 ayahs / 2,661 ordered words; all pinned text/audio digests passed |
| `npm run check:quran-audit` | Unchanged: 114 surahs, 30 juz, 6,236 references; 1,210 local validated; 571 free; 639 private; 5,026 missing; zero audit issues |
| `git diff --check` | Passed |

The Python suite is also invoked by one of the Playwright tests; its 14 cases are not 14 additional browser journeys. It uses existing verified Arabic fixtures and generated silent audio, with conspicuously test-only mock permissions. It is not a published lesson, real rights attestation, external reference approval or recitation review.

Tests cover all 30 juz starts/ends/counts, mid-surah and cross-surah selection, noncanonical and duplicate references, missing/changed mappings and editions, source alignment and repeated words, incomplete word aids/recordings, invalid MP3s, interrupted preparation and upload, active/stale locks (including mocked Windows read-only process queries), explicit migrations, unchanged legacy bytes, malformed records, reviewed word clips, immutable remote conflicts/races, project isolation, public-bucket rejection, path escapes, and development/build boundaries.

## Remaining operator gates

1. Obtain documented source reuse evidence for Arabic, translation, transliteration, word meanings, recordings and optional word clips.
2. Obtain and independently attest the matching 6,236-reference/juz manifest. Current catalog consistency alone is not independent attestation.
3. Run a real approved pilot import against live fixed providers and inspect its missing-assets/provenance reports.
4. Validate private Storage/RLS and credentials in the intended Supabase staging project; current upload tests use injected transport, not live credentials.
5. Review candidate hashes and use the existing authorized content system for a separate explicit activation. Quarantined `releases/ID` objects are not automatically consumed by the current runtime.
6. Retain human review of any internal recitation boundaries and word-audio alignment; no such approval is created by this phase.

Windows recovery uses read-only Win32 process queries and is covered by API mocks; a real Windows operator run was not performed.

This phase is implemented tooling, not a declaration that the complete Qur’an is downloaded, licensed, deployed or launch-ready. Existing user progress, FSRS, app content and entitlement modules were not changed.
