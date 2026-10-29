# Developer-only long-surah preview

This release adds Al-A‘raf (7, 206 ayahs) and all eleven Juz 29 surahs (67–77, 431 ayahs) to the developer library. It does not release these chapters to paying learners yet. Qur’anic Arabic and audio stay out of the static Vite bundle and Git repository. Public release metadata contains only references, counts, source validation status and integrity hashes.

## Why the old library could be invisible/unusable

The previous menu opened a separate Passage Studio selector, not the main surah selector. The endpoint also required every private bundle and audio file to have been uploaded before any content could load. This release connects a developer-authorized chapter loader to the main study library and adds a pinned-provider fallback, so missing Storage files no longer silently prevent the preview. The updated Edge Function must be deployed; a frontend push cannot update a Supabase function by itself.

## Activate the backend

1. First sign into the website as `bilalaisi@gmail.com` at least once so the confirmed account exists. Then sign into Supabase as the project owner. Paste **all of `supabase/SETUP_DEVELOPER_LIBRARY.sql`** into SQL Editor and run it. This installs billing/developer/review prerequisites in order and registers Al-A‘raf review sources; it is safe to rerun. It retains existing learning data. The final result must show `developer_account_provisioned = true`; if false, sign into the correct website account and rerun the SQL. The owner allowlist uses the confirmed account `bilalaisi@gmail.com`; sign into that account on the website before enabling developer mode.
2. From a local checkout with the Supabase CLI installed, run `supabase login`, then `supabase link --project-ref ycgyuatjgdbhiakqourg`.
3. Deploy the updated source and its private content pins with `supabase functions deploy quran-content --project-ref ycgyuatjgdbhiakqourg`. Also run `supabase functions deploy billing-passages --project-ref ycgyuatjgdbhiakqourg` so named passages use the updated chapter availability and developer-only access rules. Non-payment passage operations work without a Stripe key; checkout still requires a valid key in the selected test/live environment. Keep the repository gateway configuration: the function performs explicit `auth.getUser` verification and a service-side `developer_enabled` lookup; no request is authorized by browser flags. Dashboard deployment is also possible using the repository function and its `_shared` dependencies.
4. Check Edge Function secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally supplied by Supabase. `BILLING_SITE_URL` must be `https://ayah-a-day.up.railway.app` (no trailing slash). No service-role secret belongs in the browser or chat.
5. On the website, sign in with the confirmed owner account, open Menu → Developer mode → Enable developer access. A subtle gradient and Developer preview indicator distinguish the mode. The ordinary learner view hides paid/advanced menu items and private chapter choices.
6. Choose Al-A‘raf or a Juz 29 chapter in the main surah selector. Loading is explicit and errors are shown in place; the selected free surah stays usable if the private fetch fails. Check the full chapter count, first and final ayahs, practice/quest, recall, chain and arcade entry.
7. Disable developer mode. Private chapter state, media URLs and views are removed from the active interface. Progress remains saved under stable references and is available when reopening authorized content. Another account, a Free/paid learner, or a forged frontend flag must receive 403 from the preview endpoint.

## Content provenance and audio

The source preparation script fetched Quran.com API word records, canonical Uthmani verse text and Saheeh International translation, reconciled word boundaries including stopping symbols, and validated full Alafasy MP3s with ffmpeg. Al-A‘raf was prepared privately with `python3 scripts/prepare-quran-content.py --surahs 7`; existing Juz 29 preparation was retained. Run `node scripts/prepare-developer-preview.mjs` after any deliberate, separately reviewed source update to regenerate safe integrity pins and review-source SQL. `node scripts/verify-provider-preview.mjs` checks every requested live provider chapter against those pins. Never copy `.quran-private` into `public` or commit its contents.

The backend first checks the authenticated user's server-side developer flag. It can use the existing private Storage objects, or fetch fixed provider endpoints and reject any canonical text/word/translation fingerprint or audio digest mismatch. No caller chooses an arbitrary URL, Storage path, plan or user ID. Whole chapter responses remain private/no-store. Audio is fetched separately and resolved into short-lived in-memory Blob URLs after server authorization.

New premium word-audio alignments are **not teacher-reviewed**. Until alignment review is available, piece audio uses the continuous verified full ayah and the interface explains that fallback. It does not claim to play an isolated word or stop at an unapproved visual boundary. The legacy free library and its verified per-word clips remain unchanged.

## Readiness limits

Source validation is not scholar approval of internal recitation stops. Long-ayah study windows are visual workspaces; reviewed phrase games require approved boundaries. The AI/tajweed limitations and FSRS recall eligibility rules are unchanged. Public paid launch and payment activation remain separate work.

The hidden short-ayah developer prototypes (Vanishing/Jigsaw/Match/Broken Chain/Continue/Detective) route oversized ayahs to Passage Studio instead of awarding full-ayah success for a partial puzzle. Public arcade games preserve the whole canonical word sequence; Serpent caps only long-preview tail occupancy at 15 cells, while short/free-ayah tail growth is unchanged.

Local automated checks do not establish that the hosted Supabase project has been updated. After deployment, verify the confirmed owner session and a separate learner account on the live site before considering the preview activated.

## Release verification

- Full Playwright regression suite: **275 passed** (including Memory Maze and existing free modes).
- Backend suites: **23 passed** (billing 7, content/security 6, recitation 5, coach 5).
- Production Vite build and Deno checks for `quran-content` / `billing-passages`: passed.
- Live provider check: all 637 requested ayahs matched canonical fingerprints. All 206 Al-A‘raf MP3s decoded during preparation; all 431 Juz 29 text/audio files matched their existing release digests.
- Sample long private verses were absent from static JavaScript output.
- An unauthenticated probe of the hosted Supabase `quran-content` endpoint returned **404 NOT_FOUND**: the function was not deployed at the time of this check. No hosted migration or function deployment was performed in this workspace.

## SQL syntax error at a row such as `('7:91',...)`

That fragment is a data row, not a complete SQL statement. It means the editor executed an excerpt or selected text without the preceding `INSERT INTO ... VALUES` statement. In Supabase, selected text runs instead of the entire editor contents.

Open a new query, copy the **entire raw file**, clear any text selection and click Run. Use `supabase/SETUP_DEVELOPER_LIBRARY.sql` for the complete setup. If prerequisites are already installed, `supabase/REPAIR_AL_ARAF_SOURCES.sql` registers all 206 Al-A‘raf sources and reports a count of 206. The repair refuses to create an incomplete schema when prerequisites are missing.

Al-A‘raf source files now give every row its own complete `INSERT` statement. Re-running them preserves existing heads and approvals through `ON CONFLICT DO NOTHING`; no memorization progress is reset.
