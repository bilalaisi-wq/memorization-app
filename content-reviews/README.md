# Internal recitation segment review

No internal boundaries are approved yet. Whole ayahs remain valid recitation units. Visual word workspaces are not recitation stops and do not cut audio.

A qualified human reviewer must supply each record in `segments.json` with `id`, `reference` (`surah:ayah`), `kind: "reviewed"`, exact inclusive `firstWord` / `lastWord`, and `startMs` / `endMs` in the bundled Alafasy full-ayah recording. Include `review: {status: "approved", reviewer: "…", reviewedAt: "ISO date", evidence: "review record or citation"}` only after checking both stop/start appropriateness and the timing against the precise source recording. Use `status: "draft"` for unapproved proposals; they are never published. Do not use AI to fabricate approval or rewrite Qur'anic Arabic.

Run `python3 scripts/prepare-quran-content.py` after approval. It validates references, ranges, timing bounds, source text, audio decoding and checksums; it does not establish religious appropriateness on the reviewer's behalf. Redeploy the changed metadata/Edge Function and matching private bundles together. Segment recall IDs include their reviewed definition hash, so altered segment boundaries do not inherit old mastery. Never edit Arabic to accommodate a boundary.

The in-app teacher interface and source-hash-bound audit ledger now provide the primary review workflow for **all** currently registered long ayahs. The supplied research draft is preserved verbatim and all recitation-stop statuses start pending. See [the full guide](../docs/passage-builder.md). The static `segments.json` path is an optional administratively reviewed import; it never auto-certifies the supplied research draft.
