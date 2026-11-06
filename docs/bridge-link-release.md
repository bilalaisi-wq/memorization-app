# Revision Lab loading and Ayah Link release notes

## Audit and scope

The old Bridge engine combined word-by-word canonical selection with deck engineering and load testing. It was developer-only, used `bridge` reward receipts and the shared account-bound result recorder, and did not submit FSRS recall grades. The redesign keeps that identifier, access restriction, history and reward path while replacing active mechanics with adjacent-ayah transitions. The retired structural module is not part of active gameplay.

The public URL reported in the bug (`/assets/ui-vF1hcjy9.js`) returned **HTTP 200 with `text/html` and the app HTML**, not a JavaScript module, during read-only diagnosis. This is consistent with an old open page requesting a hashed asset absent from a newer deployment and the static host falling back to the SPA document. No production settings or learner records were edited during diagnosis.

## Deployment and update recovery

- Revision Lab now opens the Cosmic Rush mission planner immediately. The optional saved-route overview remains available through its Back/Revision Lab control. Standalone Runner, Defense, Link and Expedition mechanics are unchanged.
- `public/module-recovery.js`, loaded before the app module, handles Vite preload failures and uncaught dynamic-import failures. It offers **Reload latest version** and **Later**, without reload loops or silent loss of an in-flight activity. The reload uses a fresh URL and returns to the Revision Lab planner when appropriate. Local saved records are not cleared.
- `npm start` runs the new small Node static server, using Railway's `PORT`. HTML/bootstrap responses use `no-cache, no-store, must-revalidate`. Hashed assets have immutable caching; missing assets return a genuine non-cacheable 404, never HTML. A stale tab can then use the update recovery prompt.
- `railway.json` specifies `npm run build` and `npm start`. In Railway, inspect service Settings → Build/Deploy for dashboard overrides; remove an old custom start command if it overrides the repository command. Manually deploy the latest `main`, then refresh any already-open old tab once. Old documents predating the recovery script cannot retroactively receive its handler.
- After deployment, check `/` is HTML with no-store headers, the JS asset named in its script tag is JavaScript, and `/assets/does-not-exist.js` returns 404. Open Revision Lab → choose passage → launch Star Runner, leave, then return; it should open directly to the mission planner. Real microphone/audio permissions, mobile hardware, live subscriptions and RLS remain part of deployment smoke testing.

No database migration, key, new rendering engine or package dependency is needed. `structure.js` remains inactive for historical reference. Bridge Builder remains developer-only pending owner review; learner games retain their previous availability.

## Evidence

Targeted tests include module recovery, actual server headers/404 handling, Bridge gameplay and existing Cosmic/Lab behavior. The results below distinguish the complete parallel run from serial follow-ups; they are not presented as a clean single-run total.

The committed shared-CI profile is `playwright.regression.config.js`: 120-second default test budget and 15-second assertions, with existing explicit long-journey budgets and action waiting retained. Run `npm test -- --config=playwright.regression.config.js --workers=1` for isolated performance measurements and long virtual-frame journeys. No assertions, surahs, words or checkpoints are skipped. The exhaustive all-free-surah test now has a ten-minute budget for visiting every ayah and mode; it previously exhausted its three-minute budget mid-traversal.

Built deployment smoke test: `npm run build && node scripts/check-revision-build.mjs`. This starts the actual static server against `dist`, checks direct Revision Lab entry and real lazy Runner loading, steers the ship, fires a blaster, leaves/reopens the lab, checks missing assets return 404 and HTML is not cached. The local production smoke passed with no JavaScript page errors. It uses a local guest fixture and does not certify live Railway or Supabase configuration.

The direct planner also includes saved expeditions and weak-link repair actions. Cloud restore updates those actions without resetting entered mission fields. The existing rollout flag still governs expedition availability.


## Final validation results

- Focused Bridge/Revision/module regression: **29 passed**. Additional planner cloud-restore/form-retention coverage passed in the complete suite.
- Complete Playwright traversal, all **633 cases**, three workers: **626 passed, 7 failed** in 28.3 minutes. The failures were three long virtual-frame flight journeys, a mobile reordering action, a reload/menu action, a Sirat save/recovery action and the scale benchmark under concurrent load. This was **not a clean parallel run**.
- All seven failed cases passed serially, with **the same assertions and no intervening application changes**: six passed in 5.8 minutes, then the Sirat case passed in 28.8 seconds. Serial replay retained the original per-test action waiting rather than the temporary 15-second action cap used for the parallel diagnostic run. The unchanged repair benchmark measured **215 ms** against its **2,000 ms** limit. The full-surah Cosmic journey and multi-stage Runner journey completed in 2.4 and 2.8 minutes respectively.
- The all-38-free-surah traversal passed in 2.9 minutes with every ayah, word count and learning-mode assertion intact. Its explicit CI budget is now ten minutes.
- `npm run build`: passed; existing large-chunk advisory remains. `git diff --check`: passed.
- Actual `dist`/static-server smoke: passed direct planner entry, hashed lazy Runner loading, ship steering, blaster, exit/reopen, non-cacheable HTML and retired-chunk 404. **No JavaScript page errors** were observed.
- Desktop/mobile Bridge screenshots were captured during actual interactive tests and refreshed in `docs/bridge-builder/`.

Evidence logs in this execution workspace: `/workspace/artifacts/bridge-final-suite.log`, `bridge-isolated.log`, `bridge-sirat-final.log`, `bridge-final-core.log`, `bridge-final-build.log` and `bridge-production-smoke.json`.

## Remaining limits

Bridge remains developer-only pending owner review. Its new checkpoints are account-scoped browser-local records, not newly synchronized backend rows; completed history/XP continue through existing storage and sync paths. No SQL migration is required. The public Railway deployment and physical-device smoke test still require manual deployment/review. Performance-sensitive virtual-frame journeys should be measured serially; the parallel run above is not proof of production readiness or certified device performance. No scholar-approved stopping boundaries, Qur'anic source text or FSRS parameters were changed.
