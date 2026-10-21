# Qur’an content and long-ayah Passage Builder

## Scope and release status

The architecture covers **all 114 surahs, 30 juz and 6,236 ayah references**. Long-ayah segmentation/review rules apply generally to every ayah longer than the 12-word viewport. The uploaded 2:255/2:282 ranges are reference-specific seed overrides, not a template of numeric indices to paste onto other ayahs.

The application does **not** claim that the entire Qur’an content library has been imported or released:

| Material | Validation / readiness |
|---|---|
| Existing Al-Fatihah + Juz Amma | 38 complete surahs / 571 ayahs. Existing text, translations, audio, puzzles and FSRS remain unchanged and free. |
| Al-Mulk (67:1–30), Juz 29 | 30 complete source-validated ayahs prepared for private deployment; exact Uthmani text, translation 20, orthographic word boundaries and full Alafasy audio. Not a complete Juz 29 release. |
| Al-Baqarah 2:255 and 2:282, Juz 3 | Two source-validated long-ayah pilots: 50 and 128 words. Not a complete Al-Baqarah or Juz 3 release. |
| All other surahs/juz | Reference metadata verified; additional content unavailable until separately imported, validated and privately deployed. |
| Internal recitation stops / restart positions | **No production approvals seeded.** Qualified teacher/scholar decisions are required. |
| New per-word audio | Original source references are retained, but alignment discrepancies were found. Not offered as verified word audio. New passage practice uses full-ayah audio. Existing free per-word recordings are unchanged. |

Only **Juz 30** is fully available as a juz. There are 39 complete source-validated surahs when the prepared Al-Mulk expansion is counted, plus two isolated Al-Baqarah references: 603 prepared/current ayahs in total. Private assets have been prepared locally, not uploaded to hosted Supabase by this task. Neither payment setup nor metadata alone makes unpublished content available. The UI lists only existing free references and prepared private references; other references are not advertised as usable.

## Authoritative text and draft handling

`src/data.js`, `src/additional-surahs.json`, existing source manifests, bundled audio and `src/learning-store.js` are unchanged. The importer never writes into them or into `public/`.

The supplied [guide](../content-reviews/CODEX_LONG_AYAH_SEGMENTATION.md) and [draft JSON](../supabase/functions/_shared/quran_long_ayah_segments_DRAFT.json) are preserved as research input, not certified waqf guidance. Qur’anic text is never created from the JSON’s Arabic topic labels. Study ranges slice the authoritative text by verified orthographic word indices. `canonicalSpans()` retains exact character offsets; `canonicalSlice()` preserves original spelling and attached or standalone pause symbols. Full-ayah text remains byte-for-byte unchanged. No AI is involved in Arabic production or boundary certification.

The provided ranges cover 2:255 in 9 study phrases and 2:282 in 19. They are validated for 1-based inclusive indexing, exact counts, contiguity, no overlap/repetition, and complete coverage. The opening يَـٰٓأَيُّهَا in 2:282 remains one orthographic word.

**Recorded source discrepancy:** the draft gives `none` after word 95 of 2:282, while the authoritative Uthmani text contains **ۖ** there. The interface flags this; neither the uploaded draft nor canonical text is silently corrected. No mark, including ۚ, ۗ or ۖ, automatically approves a stop. The three supplied phrase-only draft breaks remain study boundaries, with continuation guidance; read-aloud recall remains full-ayah unless reviewed recitation units are available.

For other long ayahs, initial **unapproved visual proposals** use the verified source’s actual pause-mark positions and the ayah end. If there is no internal mark, the entire ayah is one proposed phrase. This is a display aid, not an interpretation of permissible waqf. Human reviewers can modify the ranges. Larger phrases get bounded visual subpages, explicitly labeled continuation; these subpages never become recitation boundaries. The 17-word phrase of 2:282 therefore uses two viewports: 19 phrases, 20 viewports.

## Learner workflow

Open **Menu → Passage memorization**, or **Passage Builder → Open memorization studio**. Guest access to existing free ayahs needs no subscription or backend. Additional private references are checked on the server.

- Choose an ayah; no more than 12 movable word pieces are rendered in the current viewport.
- Reduce word hints progressively, reveal as needed, and say the words aloud as you work.
- Complete each phrase workspace and arrange the workspace excerpts to reconstruct the full ayah. Excerpts are labeled; they never replace the authoritative full reference.
- Full-ayah audio is loaded only on request, and continues through visual page changes. No timing is inferred from text punctuation, screen breaks or breaths.
- Add up to ten chosen references. Passage Chain challenges their canonical surah/ayah order; selected gaps remain explicit.
- Use independent ayah, passage or **approved** recitation-portion recall. The word bank/reference is removed and the modal backdrop obscures the underlying app. Declare recitation, reveal/compare, and self-grade Again/Hard/Good/Easy. No automatic speech verification is claimed.

Draft visual phrase completion never becomes independent recall, FSRS mastery or a teacher-certified stop. Whole-ayah reconstruction and Passage Chain celebrate progress but grant no additional XP, stars or retained-memory credit. Existing short-ayah modes work exactly as before.

Workspace state stores only reference IDs, word positions, hint state and order—not premium text/audio. Private bundles/audio are held in memory and cleared when the studio is closed. The browser receives audio as an authenticated response/temporary object URL, not a public or signed storage link. Previously delivered content cannot be retroactively removed from a user-controlled browser; future downloads always re-check entitlements.

## FSRS and persistence

`ayah-passage-recall-v1` is isolated per guest/account. It uses the existing `ts-fsrs` version and settings without modifying the existing ayah store. Whole-ayah, reviewed-portion and exact-reference-list passage cards are distinct units. Completing a portion does not certify the entire ayah. Reviewed-portion keys include their source/boundary definition hash; changed approvals do not inherit old portion mastery.

An independent, eligible recall updates its own card. Listening/revealing before declaring recall records assistance and does not schedule independent success. Duplicate grades are idempotent; early successful practice preserves the due schedule. New passage history neither overwrites old FSRS cards nor earns duplicate wallet rewards. Local write failures do not acknowledge an unsaved result, and malformed records are preserved for recovery.

`ayah-passage-workspaces-v1` saves piece arrangements separately, keyed by reference/source/review revision. **Sync private passage reviews** uses the optional `passage_learning` table and revision-checked RPC. New devices can restore; concurrent changes fail without silently overwriting either device. Export is available before manual recovery. This is independent of the existing cloud progress whitelist, so a missing passage migration cannot break existing free progress sync. Passage cards appear in the studio’s own review schedule; the original Daily Quest store remains unchanged.

## Teacher/scholar review

The review interface exposes every currently source-registered long ayah, not just the two research examples. Future long-ayah sources use the same schema and worklist after import/registration.

**Teacher segment review** appears for an enabled server-assigned reviewer. The developer owner can see an entry for setup, but developer email alone cannot read restricted review history, certify stops or impersonate a scholar. A project administrator must verify qualifications and grant the role in Supabase:

```sql
insert into public.quran_reviewers(user_id,display_name,credentials,role,enabled)
values ('VERIFIED_AUTH_USER_UUID','Reviewer name','Verified relevant qualification','teacher',true);
```

Use `scholar` where appropriate. Do not grant roles from client metadata or self-asserted email. The name/credentials are captured in the audit record; obtain the reviewer’s agreement to their published attribution.

The interface provides:

- Read-only canonical Arabic context, original word IDs and full-ayah reference.
- Source-vs-draft pause symbols, mismatch warnings and proposed division.
- End-word edits that adjust the next start while preserving total coverage.
- Separate `pending_review` / `approved` / `rejected` decisions for visual chunking and recitation stops.
- Explicit restart word, verified reviewer identity/credential, source Mushaf edition, riwāyah and server timestamp.
- Optional full-source audio player and independently approved timing bounds.
- Append-only revision history; optimistic revision checks prevent competing editors overwriting decisions.

Changing a boundary/restart clears the relevant previous approval. Rejecting a visual division merges adjacent display ranges without losing words. Approving visual chunking does not approve waqf. Approving a stop does not approve its timing. Every approved stop requires an explicit valid restart word; it is never assumed to be `end + 1`. Record the exact source edition before approving recitation guidance. Audio approval additionally requires timing bounds within the exact source recording and deliberate human confirmation. Until then, full-ayah recitation remains available and clipped portion playback stays disabled.

Stop/edition decisions are received from privileged, source-hash-bound database records. A forged local flag or modified draft cannot publish them. Review schema supports all valid long-ayah references; registry rows are seeded only for currently validated sources. If a source hash changes, do not overwrite old approvals: register the new source through a reviewed migration and obtain new decisions.

## Private content deployment

1. Existing billing setup must be present for Explorer/Pathfinder entitlements. Free content still works without it.
2. Apply these migrations in order:
   - [`20261023_passage_content.sql`](../supabase/migrations/20261023_passage_content.sql)
   - [`20261024_segmentation_review.sql`](../supabase/migrations/20261024_segmentation_review.sql)
   - [`20261025_review_sources.sql`](../supabase/migrations/20261025_review_sources.sql)
3. The first migration creates a **private** `quran-premium` bucket and restrictive object/bucket policies for browser roles. This blocks access even if another permissive storage policy exists. No client gets write access to reviewer roles, source registry or audit rows. Existing storage buckets are unaffected.
4. Prepare content on an authorized backend workstation with Python 3, curl, ffmpeg, ffprobe, and Node 24:
   ```sh
   python3 scripts/prepare-quran-content.py
   node scripts/register-quran-review-sources.mjs
   ```
   This writes `.quran-private/` (gitignored), validates exact references, separate Uthmani/word source responses, translation provenance, MP3 decoding and SHA-256 digests. It keeps raw translation/source references; limited pause/pronunciation-annotation normalization is used only for comparison, never to rewrite displayed Arabic. New WBW audio references with alignment concerns are retained but not offered as certified audio.
5. Incremental imports are explicit: `--surahs 3 4`, `--references 3:1 3:2`, or `--all`. The latter can be a very large private import; it is never run implicitly. Existing manifests are merged, not replaced. A juz/surah becomes complete in availability metadata only when every reference is validated. Re-run registry generation for new source hashes and deploy metadata with the matching assets; do not republish stale registry approvals.
6. In a secure shell, provide `SUPABASE_URL` and the backend `SUPABASE_SERVICE_ROLE_KEY`, then run:
   ```sh
   node scripts/upload-quran-content.mjs
   ```
   No backend key goes into `VITE_*`, browser code, logs or chat. The uploader verifies hashes and writes only the private bucket. It does not alter Quran text.
7. Deploy the updated billing-passages function and the new content function:
   ```sh
   supabase functions deploy billing-passages --project-ref YOUR_PROJECT_REF
   supabase functions deploy quran-content --project-ref YOUR_PROJECT_REF
   ```
   `quran-content` manually verifies the Supabase user JWT and source-derived juz entitlement. It does not depend on Stripe secrets merely to serve content. It checks bundle/audio hashes, validates schema, and streams the selected object with private/no-store headers. Client-provided plan/juz/bucket/path fields cannot grant access. Authorized reviewers may fetch source material to perform their review. Never expose the bucket publicly or replace this with an unguarded static route.
8. Redeploy the frontend and assign qualified reviewer roles. New internal stops remain unapproved until staff explicitly submit decisions. No production reviewer, deployment, private upload or stop approval has been fabricated by this task.

For a new account project, apply the existing account/billing setup first, then the three content migrations above. They are intentionally separate from the previous combined setup and learning whitelist.

## Tests and limitations

Run `npm run build`, `npm test -- --workers=2`, `npm run check:content`, `npm run test:content`, and the existing billing Edge checks. The tests cover canonical range preservation, 50/128 word counts, symbol discrepancies, general long-ayah proposals, bounded rendering, themes/RTL/font, private endpoint authorization, forged entitlement fields, integrity failures, role/row isolation, restrictive storage RLS, immutable review history, restart/timing checks, source hash/version conflicts, FSRS assistance/duplicate/persistence rules, and existing app regressions.

Backend tests use real validation code and local PostgreSQL-compatible execution with explicit network fixtures. They do not establish that the hosted Supabase bucket/functions or live subscription service have been deployed. Human waqf-and-ibtidāʾ review cannot be replaced by these tests. No additional complete juz or unreviewed recitation guidance is advertised.

## Local visual previews

These previews use mocked test-account entitlements and the source-validated 2:282 fixture; they are not evidence of a hosted deployment. Recreate them with `node scripts/passage-screenshots.mjs` while the local Vite server runs on port 5174.

- [Simple desktop](passage-previews/simple-desktop.jpg) · [mobile](passage-previews/simple-mobile.jpg) · [word workspace](passage-previews/simple-workspace.jpg)
- [Night Sky desktop](passage-previews/night-desktop.jpg) · [mobile](passage-previews/night-mobile.jpg) · [word workspace](passage-previews/night-workspace.jpg)
