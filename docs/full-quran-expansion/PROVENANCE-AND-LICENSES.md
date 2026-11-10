# Phase 1 — provenance, rights and review gaps

No new Quranic text, translation, transliteration, word meaning, recitation or religious lesson was downloaded/generated. The audit reads existing source artifacts and existing runtime free data without modifying them.

## Existing source inventory

| Asset | Existing evidence | Unresolved evidence |
| --- | --- | --- |
| Chapter/juz metadata | Quran.com API v4 chapter and juz URLs with two original response SHA-256 pins in `quran-catalog.json`; both stored range representations cross-check across all 6,236 IDs | Raw upstream metadata responses/independent external source were not re-fetched. Existing pins are declarations, not newly verified remote bytes |
| Uthmani Arabic/positions | Existing public source word records, canonical app text, private bundle SHA-256, source-response pins, provider content fingerprints and exact position checks | Independent edition/riwayah attestation and editorial sign-off are not documented by this audit |
| Additional free English translations | Legacy source registry declares Saheeh International resource 20 | Exact licensed edition/terms, full response provenance and human review evidence |
| Private English translations | Private bundles explicitly identify Saheeh International resource 20; original bundle hashes preserved | Commercial redistribution terms, attribution obligations and actual translation review |
| Al-Fatihah English | Existing hard-coded strings in `src/data.js`, with measured hashes | Exact translator/edition is not established. Do **not** automatically attribute these strings to the private importer's resource 20 |
| Additional word meanings/transliteration | Existing free source declaration and private API word fields; individual aid fingerprints and ordered source positions | Exact upstream translator/resource/license, editorial correctness and commercial-use evidence |
| Al-Fatihah word aids | Legacy hard-coded meanings, mnemonic cues and transliteration in `src/data.js` | Actual editorial/source basis. Do not call these a verbatim API resource or manufacture attribution |
| Full-ayah audio | Existing project identifies Alafasy/Quran.com hosting; 571 free local files hashed/header-checked; 639 private MP3s match their original SHA-256 and byte metadata | Recording/distribution rights, any required reciter/host attribution, independent semantic/audio verification; no new exhaustive codec decoding in this phase |
| Word audio | 2,337 free canonical ordinal files present and matching stored source filenames, plus six existing public distractor clips | Exact reciter/license evidence. Private word audio references remain unreviewed and disabled; a URL or filename alone does not approve isolated playback |
| Uthmanic font | `public/fonts/UthmanicHafs.woff2`, measured file checksum retained in manifest input pins | Exact upstream font version/license/notice. A filename does not certify the text edition or recitation riwayah |
| Internal segmentation | Whole-ayah metadata remains as-is; local declared reviewed-segment count is recorded without copying any source text | Supabase teacher reviews were not queried. No visual workspace becomes a valid waqf/ibtida point through this inventory |

The source registry records `commercialUse: null` and `rights.status: not-documented` where evidence is absent. **Not documented is neither a grant nor a legal finding that use is prohibited.** The underlying Quranic Arabic, a hosted edition/API, English translation, word resource, font and recorded performance are different rights questions. No blanket clearance is inferred from online availability.

The separately evaluated CC BY 4.0 English Ibn Kathir reference does not license Quran.com translations, audio or fonts, and its machine review does not constitute scholarly approval of comprehension lessons.

## What validation actually establishes

- The existing two catalog range projections agree; every chapter/juz/reference occurs in the correct internal order with no gap, alias or overlap.
- All 571 free ayahs align with the existing stored source-word records; comparison normalization is never written back to text. Exact display/position hashes preserve original spelling/marks, including 100:9's leading annotation.
- All 639 local private bundles match existing bundle/audio pins and declared word counts. The 637 developer-preview provider fingerprints are unchanged; the two storage-backed pilots retain their existing bundle/audio pins without inventing missing provider fingerprints.
- Required text/translation/word-aid fields are present, and full audio has matching bytes/hash and an MP3 header. Existing positive duration metadata is checked for consistency; duration is not newly measured by this auditor.
- None of this validates religious interpretation, commercial rights, pronunciation, tajweed, internal stops, current hosted object policies or public release.

## Operator/editorial evidence needed before new publication

For each actual source/edition, identify provider/resource/version, reuse basis, relevant terms/permission/public-domain or original-writing basis, required attribution, reviewer identity/date/scope and a stable evidence reference. Record whether the review covers Arabic alignment, translation, word aids, recitation recording, segmentation display or approved stop/restart separately. Use qualified independent review where required; do not assign review credentials to the operator by default.

For missing sources, keep the release gate blocked and report the gap. Do not fabricate a replacement translation, word meaning, transliteration, audio clip or approval to complete a row.
