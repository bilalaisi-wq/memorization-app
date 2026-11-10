# Full-Qur'an expansion — Phase 1 review package

Scope: **Phase 1 only** of the [uploaded implementation plan](IMPLEMENTATION-PLAN.md). The plan says to send phases in order, “reviewing each phase before merging.” Work is on `full-quran-phase1-manifest`; main, content policy, source text, existing private pins, game IDs, progress formats and FSRS behavior are unchanged. No content import, upload, publication, payment activation, engine installation or native project creation was performed.

## Deliverables

- [Canonical machine-readable manifest](../../content-audit/generated/canonical-manifest.json): 114 surahs, 30 juz, 6,236 stable references, exact mid-surah boundaries, individual asset/pin inventory and separate evidence stages.
- [Per-juz coverage/release-status report](../../content-audit/generated/juz-audit.md): all 30 juz, canonical endpoints and counts.
- [Missing-content and integrity issues](../../content-audit/generated/missing-content.json): every reference lacking required local assets; no inferred words/translation/audio.
- [Compact summary](../../content-audit/generated/summary.json).
- [Source registry](../../content-audit/sources.json) and [license/provenance review](PROVENANCE-AND-LICENSES.md).
- [Audit contracts, evidence limits and Phase 2 actions](AUDIT-AND-NEXT-STEPS.md).
- `scripts/audit-quran-manifest.mjs`, reusable pure coverage checks in `scripts/lib/quran-coverage.mjs`, and `tests/quran-coverage-audit.spec.js`.

## Results in this workspace

| Scope | Count / state |
| --- | --- |
| Canonical catalog | 114 surahs, 30 juz, 6,236 unique references |
| Existing free material | 571 ayahs: Al-Fatihah and Juz Amma |
| Existing private/developer material | 639 ayahs: Al-A'raf (206), Juz 29 (431), pilots 2:255 and 2:282 |
| Locally present with required assets passing integrity checks | 1,210 ayahs |
| Missing required local material | 5,026 references |
| Pin/alignment conflicts in current local snapshot | 0 |
| Existing free word recordings | 2,337 ordinal clips, all present and matching recorded source filenames |
| Additional free distractor recordings | 6 clips; these do not make their full ayahs available |
| Private internal phrase/word-audio approval | Not attested; no approvals invented |
| Commercial-rights / edition / human-review gates | Not attested or not documented; see provenance report |
| Hosted per-ayah deployment / public delivery | Not verified in this offline audit |

The local private files are Git-ignored. A fresh checkout without them will show **571** locally present ayahs and **5,665** missing local bundles, while retaining all 639 original private availability pins. That difference is a device/workspace inventory, not a release or loss of production data.

## Run the audit

```sh
npm run audit:quran
npm run check:quran-audit
node scripts/validate-private-juz.mjs 29
npx playwright test tests/quran-coverage-audit.spec.js --workers=1
```

The first command regenerates only `content-audit/generated/`. The second compares the generated snapshot against the current local inputs without writing. It intentionally differs on a machine with different/missing private assets; review/regenerate the local snapshot instead of assuming private downloads are present. `--help` is offline and does not invoke the legacy importer. The auditor fetches nothing, uses no credentials, and does not touch browser/account storage.

Generated files are metadata only, outside `public/` and outside application imports. They contain IDs, counts, asset hashes and evidence status; no private Qur'anic text, translations, word bodies, private download URLs, recordings or credentials. Existing raw private bundle/audio hashes are preserved exactly.

## Validation

- Full suite: **922 passed, zero failures** (14.5 minutes), including all six new audit tests.
- Backend behavior: **29 passed** (billing 7, content 6, recitation 5, coach 5, Chronicles 6).
- All existing Edge Function type checks passed.
- Production build passed (8.55 seconds).
- `npm run audit:quran` and `npm run check:quran-audit` passed with the complete local snapshot and zero local integrity conflicts.
- Existing independent Juz 29 validator passed: all 431 text/audio digests and 2,661 ordered words match the preserved pins.
- No changes under existing `src/`, `public/` or `supabase/`; sentinel tests also prohibit reading/writing progress storage.
- Two sample private long-ayah bodies and the audit directory were absent from static output; see [build boundary evidence](build-boundary-check.json). This is a scoped check, not an exhaustive security certification.
- `git diff --check` passed.

See [machine-readable validation](validation.json). No real hosted content/account tests, new source downloads, license approvals, scholarly review, mobile builds or store submissions are claimed.

This is not a complete-Qur'an release or mobile release. The existing catalog's `fullyVerifiedJuz: [29,30]` is a retained legacy technical-coverage declaration; it is not proof of commercial rights, teacher-approved stops or hosted publication.
