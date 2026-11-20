# iRDA prelaunch validation

## Results

| Check | Observed result |
| --- | --- |
| Complete browser regression run (`irda-full-final.log`) | **1,040 passed, 2 failed, 4 skipped** across 1,046 cases; six browser workers |
| Follow-up for the two failures | **Both passed**: Practice next-step navigation fixed and verified with two related XP checks (**3 passed**); the complete 128-word expedition passed alone in **1.3 minutes** |
| Focused regression-fix batch | **86 passed**: source-backed games, passage navigation, recall, authorization denial, sign-out cleanup, XP/history and responsive screens |
| Final independent-recall / reward safeguards | **5 passed**, including delayed quiz/recall loading, no study-text flash, retryable failed reward writes, no repeated-check XP, unchanged 16-earned-XP prompt |
| Final grouped-counter/engine checks | **8 passed**; an additional registered PassageContext counter case was added after the full run |
| Backend suites | **34 passed, 0 failed**: billing 8, content 7, recitation 5, coach 5, comprehension 6, native transaction verification 3 |
| Production offline suite against the final built frontend | **4 passed**, covering verified downloads, airplane-mode reload, mobile text-only storage, retry/removal and verified audio fallback |
| Final production Vite build | **Passed** (`npm run native:sync` invokes `npm run build`); build completed in 9.75 seconds |
| Capacitor iOS/Android asset sync | **Passed**, with final bundled frontend/configuration checks |
| Explicit `npm run native:check` | **Passed** |
| Signed OTA compatibility guard | **Blocked as designed**: no approved native release baseline exists; no approval or signing credentials were invented |
| Whitespace/conflict check | `git diff --check` passed |

The full parallel command was **not a single clean green run**. It exposed a repeat-check navigation regression, which was fixed, and the CPU-heavy 128-word expedition hit its five-minute budget under six concurrent browser workers. Both cases subsequently passed their follow-up checks. No observed functional failures remain in the executed follow-ups. Keep the long expedition isolated or use lower CI concurrency; do not treat its parallel timeout as successful validation.

The four production-worker cases intentionally skip against the Vite dev server; all four were subsequently executed successfully against the built server. The new registered-adapter counter case passed separately and is included in future complete-suite collection.

## What was verified

- All seven public Puzzle Lab scenes at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×667 and 844×390, with transliteration on/off.
- Separate running-world tests for every public engine: preference changes, phone rotation and text-size changes preserve captured world geometry. Existing keyboard/touch gameplay tests exercise actual movement, collision, collection, construction and completion.
- Prominent correct/incorrect feedback, preservation of wrong arrangements, next-step choices, duplicate-check reward prevention and recovery after a failed reward write.
- A bounded 10×18 tower completes a 500-token **non-Quran structural fixture**. Real free ayahs retain original source-word/transliteration positions. The existing canonical 2:282 fixture exercises 128 original words in visual groups, archived floors and bounded interaction windows.
- Untimed continuation gates, strikes versus motor actions, ghost preview, archive inspection, resize handling and paused checkpoint restoration. Source drift preserves old checkpoint metadata for export.
- Existing source-backed Roman formatting, complete-group mapping, missing-data refusal, persistent account-scoped settings, no game restart/audio stop on toggle, and no transliteration leak into text-hidden independent recall.
- Exact copyable Arabic assembled lines with separate Latin reading strips; authorized content, source/review restrictions, existing history and FSRS non-interference remain covered by the regression/policy suites.

## Evidence and reproduction

[Desktop/mobile screenshots](screenshots.md) are real browser captures outside the public frontend bundle. Inspected feedback, long-label wrapping, Arabic/Latin separation, counters, live games, transition choices, Night Sky contrast and reachable controls. The 2:282 component captures use the existing test fixture; they do not prove live content publication.

Durable logs are under `/workspace/artifacts/`:

- `irda-full-final.log`
- `irda-regression-fixes.log`, `irda-final-safeguards.log`
- `irda-final-navigation.log`, `irda-final-expedition.log`, `irda-final-grouping.log`
- `irda-backend.log`, `irda-final-offline.log`
- `irda-final-native-sync.log`, `irda-final-native-check.log`, `irda-final-update-guard.log`

Use local proxy bypasses in environments that proxy loopback requests:

```sh
NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 npx playwright test --config=playwright.regression.config.js --workers=3
# Isolate the particularly heavy source-completeness journey if CI is constrained:
NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 npx playwright test tests/expedition-ui.spec.js --grep '128-word pilot completes' --config=playwright.regression.config.js --workers=1
npm run native:sync
npm run native:check
NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 npx playwright test --config=playwright.offline.config.js --workers=1
```

## Limitations and release gates

- These are Chromium and local policy tests, not physical iPhone/Android, VoiceOver/TalkBack, real headset-interruption or low-end-device certification.
- The direct single-surah Tower supports the adaptive 1/2/3/up-to-5 baseline. Registered PassageContext activities retain their existing declared per-engine limits, including Blocks' two-word-group limit, to avoid silently changing saved stage plans. Their counters now distinguish pieces from original source words.
- Tower checkpoints restore the active ayah's last completed section, not a full prior multi-ayah run configuration. Invalid/stale data remains recoverable; historical learning records and IDs are unchanged.
- Live Supabase account/RLS/entitlement transitions and store subscription sandboxes require authorized staging/device environments. Local mocks and policy tests do not establish those external results.
- Native assets are synchronized, but no signed store binary, physical-device release test or approved Capgo baseline was created. OTA publication remains blocked; follow `docs/native/updates.md` after an actual native release.
- No website, store, Supabase migration or external deployment was performed. These four improvements require **no new Supabase migration**; separate pending native-billing setup retains its own deployment gates.

This report does **not** declare production readiness.
