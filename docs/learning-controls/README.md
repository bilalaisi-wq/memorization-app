# Learning controls and reading pace update

- Ayah Chain word workspaces reuse the existing native drag, pointer/touch grip and keyboard reorder controls. Drag/drop is scoped to its originating surah/ayah; another puzzle cannot silently substitute a word. Existing ayah-card order controls remain available. No stored history or FSRS grade format changes.
- Sirat/Chronicles shared platform collision handling keeps exact standing contact grounded, including zero-duration frames. This prevents the grounded-dependent Sirat door cards from repeatedly hiding/showing. Jumping, gravity, moving platforms, motor recovery and memory strikes remain separate.
- Normal Star Runner simulation runs at 70% of its former speed. Boost runs at 4.851 times the old base rate (50% above its former 3.234 boost), with the existing four-second fuel capacity. Responsive steering and existing bounded XP remain intact. Source transliteration is shown for every candidate, using its original word positions.
- QUR'AN CHRONICLES navigation is developer-mode-only and labeled Coming soon. Leaving developer mode returns to Practice and disposes the activity. Learner list/read endpoints are closed by default; verified server developers retain access. Explicit editorial staff workflows remain private. The server-only `CHRONICLES_LEARNER_ENABLED` flag must remain false/unset until actual release approval. Backend tests also preserve future published-lesson authorization coverage under an explicitly enabled test flag.
- No canonical Quran text, audio recordings, approved stops or learning records were changed or regenerated.

## Validation

The combined regression command exercised app/chain, Star Runner, flow/cues/combat, Sirat and Chronicles: 141 passed; four assertions needed the new slower simulation timings. After correcting those timing expectations, the final affected/new suite passed **24/24** (38.4s), including the newly added sustained-doorway visibility test. The larger suite was not rerun in full after assertion-only changes. Earlier separate concurrent runs shared a Vite server and were abandoned when one runner shut it down; subsequent verification used one runner at a time.

Chronicles backend **6/6** passed, including default guest/free denial and verified-developer access; Edge Function type check passed. Production build passed (3.76s); `git diff --check` passed. Native gameplay and real pointer/keyboard controls are exercised by browser tests. Physical-device and hosted Stripe transactions are not claimed.

[Mobile Arabic + transliteration](runner-reading-mobile.png) · [Stable Sirat gateway](sirat-stable-gate.png). Both screenshots were inspected; they are local test sessions, not live production captures.

## Deploy

1. Deploy the new GitHub main build manually in Railway.
2. Install the existing Chronicles migration if missing, following [Chronicles setup](../../supabase/CHRONICLES_SETUP.md). This change adds no SQL migration.
3. Deploy the updated server gate from the linked local checkout:

   ```powershell
   npx.cmd supabase secrets set CHRONICLES_LEARNER_ENABLED=false --project-ref ycgyuatjgdbhiakqourg
   npx.cmd supabase functions deploy chronicles-content --project-ref ycgyuatjgdbhiakqourg
   ```

   Use `npx` on shells where PowerShell script restrictions do not apply. This flag is not a credential. A local hidden menu alone does not restrict deployed API access; the updated function must be deployed too.
4. Verify regular learners cannot open the lab or fetch published lesson content; verify the authorized developer can enter/leave preview. Unpublished or unreviewed materials remain unavailable.
5. Follow [the step-by-step Stripe sandbox checklist](../stripe-test-checklist.md) for hosted payment checks. No payment secrets or real transactions were configured by this task.
