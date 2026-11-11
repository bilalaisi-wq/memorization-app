# Revision pacing and deployment verification

## Learning flow

Revision flights now default to **one round**. Additional rounds (up to ten) are optional. After a completed set, the learner can proceed to the next ayah set, repeat, or choose another activity. Selecting a later stage in the briefing launches that actual stage. A 15-ayah route has three five-ayah sets; completing the first set no longer silently restarts the first stage.

Old expedition saves retain their completed tasks and historical round settings. Selecting fewer rounds skips only remaining optional repeats. Skipped tasks are not recorded as completed practice, and do not award XP or recall credit. Independent self-assessment remains separate from all arcade completion.

Answer positions use seeded random ordering with fresh session entropy. The ordering mixer avoids the old nearby-seed bias that repeatedly put correct endpoints in the third slot. Arabic, canonical identifiers and answer validation are unchanged.

Level 2 restores each adjacent boundary. Level 3 adds a cumulative end-to-end transition pass after the first chain, concealing both ends without repeating demonstrations. This difference matters for **longer chains**, not simply longer ayahs. A two-ayah selection contains only one boundary, so it does not offer a redundant Level 3 pass. Existing mode IDs and evidence remain compatible.

Visible revision wording and choices include existing source-backed transliteration when available. Concealed recall wording also conceals its transliteration. Missing transliteration is not guessed. Arabic remains the authoritative display text.

## Why the website was behind

The public Railway build contained an older Snake without the boost, while the boost and later integration lived on feature branches rather than the deployment branch. The live Runner did contain earlier speed settings, so this was not a single missing speed constant or a browser-cache-only issue.

The tested changes must reach the branch Railway deploys. This service is manually deployed by its owner; pushing GitHub alone does not update the running service.

## Deploy the tested revision

1. Open Railway and select the service serving `ayah-a-day.up.railway.app`.
2. In **Settings → Source**, confirm repository `bilalaisi-wq/memorization-app` and branch `main`.
3. In **Deployments**, use **Deploy Latest Commit**. Do not restart an old deployment or redeploy an old historical build. Build command should run `npm run build`; start command remains `npm start`.
4. Confirm the build log includes Vite's successful production build and the `postbuild` metadata step. Wait for the new deployment to become active.
5. Open `https://ayah-a-day.up.railway.app/build-info.json`. Its `commit` must match the latest tested GitHub commit. The endpoint contains only build identifiers and public game settings, never credentials.
6. Verify Snake reports multiplier `1.6`, duration `5000`, cooldown `2000`; Runner normal flight rate `.7` and boost multiplier `4.851`.
7. Open Revision Lab, select a 15-ayah range, and check the default is one round. Complete a set and choose the next set. Check Space boosts Ayah Serpent and Space fires / B boosts Star Runner. Test the touch buttons too.

If `build-info.json` returns the site's HTML or 404, the old build is still serving or the build command bypassed `npm run build`. If its commit is incorrect, check the selected source branch and deployment commit before clearing browser caches.

No new Supabase migration is required by these pacing and interface changes. Previously documented content/billing setup and publication requirements still apply. This work does not publish missing Qur'an assets or certify live payment/RLS behavior.
