# QUR'AN CHRONICLES — editorial setup

1. Install the application's existing Supabase migrations first. In Supabase SQL Editor, open **New query**, paste the raw contents of `supabase/migrations/20261108_chronicles.sql` (no Markdown fences or filenames), and run it. The migration adds private editorial tables; it does not modify memorization progress or FSRS.
2. Deploy `chronicles-content` with the existing Supabase CLI workflow:

   ```bash
   npx supabase link --project-ref ycgyuatjgdbhiakqourg
   npx supabase functions deploy chronicles-content
   ```

   Windows PowerShell users with blocked `.ps1` scripts can use `npx.cmd` instead. Existing Edge Function environment secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` stay server-side. Set `BILLING_SITE_URL=https://ayah-a-day.up.railway.app` and retain any necessary `BILLING_ALLOWED_ORIGINS`. No service-role key belongs in Vite variables or chat.
3. Invite/register the actual authors, qualified reviewers and publishers through normal authentication. Obtain consent for public reviewer display name/qualification. Confirm qualifications and commercial-rights review responsibility separately; being the developer does not automatically make someone a religious reviewer.
4. In SQL Editor, assign staff using their actual Auth user UUIDs. Example structure only; replace every placeholder before running:

   ```sql
   insert into public.chronicles_editors
     (user_id, display_name, qualification, can_review, can_publish)
   values
     ('AUTHOR_AUTH_UUID', 'Consented public author name', 'Verified editorial role description', false, false),
     ('REVIEWER_AUTH_UUID', 'Consented public reviewer name', 'Verified relevant Quran/tafsir qualifications', true, false),
     ('PUBLISHER_AUTH_UUID', 'Consented public publisher name', 'Verified publication responsibility', false, true);
   ```

   Authors and reviewers must be different accounts for a review. Staff editing private source lessons must also have the existing source entitlement/reviewer authorization; a comprehension editor role does not bypass private Quran loading.
5. Deploy the latest frontend on Railway. Sign in as assigned staff, open **Comprehension Lab → QUR'AN CHRONICLES editorial desk**. Ordinary learners do not see that button. The learner catalogue is empty until publication.
6. Use `docs/quran-chronicles-pilot-draft.json` as an **unpublished authoring scaffold**. Fill every missing source, locator, text and rights field with actual material. Do not use `tests/fixtures/chronicles-lesson.js` as a lesson: it contains software-test labels, not translations/tafsir/history. The scaffold intentionally fails validation until commercial-rights and content fields are completed.
7. Begin with a small Juz Amma lesson. Supply exact canonical references; for Quran crystals use `text: null`. For long ayahs, explicitly select consecutive source positions for meaningful study excerpts; keep each conceptual section at 3–8 cards. Do not turn visual puzzle groups into tafsir units or stopping rulings.
8. For every translation/tafsir/report/reflection, provide sources, exact locators, attribution and license details. Check actual commercial-use/redistribution/adaptation conditions. Obtain permission where required. Existing Quran.com/Saheeh International memorization data is not automatic proof of a commercial license for a new comprehension publication.
9. Save the validated draft with expected revision `0` for a new lesson. Existing edits require the current server revision and reset approval. Load the saved lesson before previewing. Preview is explicitly unpublished and awards no XP.
10. Have a different qualified reviewer load the draft, verify Arabic positions against canonical text, check explanations/context/reliability, every relation/classification/application answer, conceptual sections, and rights. Enter a review note and a JSON object mapping **each source ID** to its actual permission/license evidence reference. Private permission records are stored as editorial evidence and not sent to learners. Select **Approve source and rights review**; reject/request corrections when appropriate.
11. A publisher loads the current reviewed lesson and chooses **Publish reviewed lesson**, then confirms the explicit publication prompt. Source drift or concurrent revision changes prevent publication; resave and review a new draft instead.
12. Test a guest published Juz Amma lesson and an authenticated entitled premium lesson separately. Confirm Free cannot retrieve premium text via direct endpoint/table access, and that drafts are inaccessible to learners. Use **Withdraw publication** for corrections. Focus/periodic revalidation removes withdrawn content from running games while preserving source-bound backpacks.
13. Keep former reviewer identity records while their approved publications remain in use, or withdraw/re-review the material. Deleting a reviewer account does not block account deletion, but their publications become unavailable until reviewed again. Follow your privacy/rights retention policy for editorial audit and permission records.

No real lesson is seeded or auto-approved by this migration. Review and licensing approval remain human work. Backpacks are currently local to each account/browser and included in **My account → Download device progress**; existing learning/FSRS cloud synchronization is unchanged.

## Named pilot contact

The owner supplied **Bilal Ahmad** as the current pilot/review contact and is still finding reviewers. See `CHRONICLES_SETUP_BILAL.sql` for a verified-account author/publisher assignment. It deliberately grants **no reviewer permission** and approves no material. Review qualifications and completion remain pending. Source preferences and unresolved edition checks are recorded in `docs/quran-chronicles-pilot-review.md`.

A conventional publisher notice is not mandatory in every situation. Rights evidence may instead document a verified public-domain basis, an author's permission, or original editorial writing that cites source information without reproducing third-party wording. Record the basis actually applicable to the material being published. Do not invent a notice or label an unexamined edition cleared merely because it is freely accessible.
