# Pre-launch bugs, verification and launch gates

Prepared November 10, 2026. Starting code: `d4597e4`. Read with [the GPT-ready feature inventory](FEATURES-FOR-GPT.md). Passing local tests does not establish that Railway/Supabase configuration, real authentication, payment processing, content rights or physical-device accessibility are ready.

## Reproduced bugs fixed during this review

### P1 — invalid legacy progress could be lost during recovery/mirroring

**Reproduction used synthetic in-memory records, never a real learner account.** Put unreadable bytes in `ayah-mastery` and an existing empty string in `ayah-learning-legacy-v1`. Create the learning store and complete a puzzle. Previously, the empty backup was preserved but assumed usable, the older unreadable mastery value was replaced by a compatibility mirror, and no store retained its original bytes. The warning incorrectly said that the original was preserved in the migration backup.

A related case: corrupt a legacy mirror after canonical migration. Later legitimate canonical progress could overwrite that unreadable mirror without preserving its new raw contents.

**Repair:** validate an existing migration backup's supported raw-key envelope before migrating; block migration writes on an empty/malformed/unsupported backup. Preflight all three legacy mirrors before any mirror write. If a mirror is unreadable or the wrong JSON shape, canonical learning can still save, but the original legacy bytes stay untouched and the UI warns about recovery. Existing valid backups are not rewritten. No schema, Quran text, FSRS parameter or normal reward rule changed.

Evidence: [before](recovery-probe-before.json), [after](recovery-probe-after.json), `tests/prelaunch-recovery.spec.js` (seven cases), plus the retained memory/migration suites. The focused recovery/model/compatibility command passed **32 tests**. The final complete-run result is recorded below.

### QA tooling — responsive audit assumed Chronicles was public

The four-lab responsive audit script still tried to click the now hidden learner Chronicles entry and had no explicit action deadline. That made it unsuitable for the current coming-soon rollout. It now verifies that the learner entry is hidden, tests the three actual public labs and sets a finite action timeout. New output goes into `docs/prelaunch/ui/`, leaving the dated Phase 8 evidence intact.

Result: **24 checks** = 18 public-lab layouts (3 labs × 3 widths × 2 themes) + 6 coming-soon visibility checks. Zero document-level horizontal overflow. This does not mean every word in every live physics state, every text-zoom factor or every nested scroll panel was exhaustively measured.

## Open launch gates — not reproduced application bugs

| Priority | Gate | What needs to happen |
| --- | --- | --- |
| P0 for public subscriptions | Actual paid content does not yet fulfill a broad five-juz/full-Quran launch promise | Keep sales gated, or narrow published promises to what is actually released. Current Al-A'raf/Juz 29 are developer-only and the other private inventory is two long-ayah pilots. A Quran-wide metadata catalog is not delivered content |
| P0 for account/security claims | Real Supabase A/B authorization and deployed configuration | Two controlled real accounts; test direct table/function/storage access, account switches during loads/audio, sign-out, expiration/downgrade, cloud conflicts and restore. Local PGlite/mocks alone are insufficient |
| P0 for enabling payments | Real Stripe sandbox acceptance | Configure prices/secrets/Portal/webhook; exercise successful/failed checkout, renewal, cancellation, effective expiration, paid/unpaid plan changes and duplicate/out-of-order delivery. Live transactions require separate approval/validation |
| P0 for public child/cloud/voice use | Operator-specific privacy/age/consent/retention review | Identify operator/contact, applicable jurisdictions, sensitive-data handling, processor agreements, actual deletion/log/backup retention, child-use restrictions and reviewed adult AI-pilot controls. Do not claim universal legal compliance |
| P0 for publishing comprehension | Reviewed lesson material and deployed function | Keep QUR'AN CHRONICLES coming soon. Supply licensed/attributed source material, actual independent review, explicit publication and source pins; software fixtures are not lessons |
| P1 | Physical mobile and assistive technology | Test iOS Safari/Android Chrome, mic permission/codecs, autoplay/audio focus, two-thumb controls, VoiceOver/TalkBack, keyboard-only flows, 200–400% zoom and an actual slower device |
| P1 | Honest cross-device promises | Core, passage and selected Cosmic records sync through different flows; many drafts/campaigns/backpacks remain device-local plus export. Explain this before sign-up and test source/account conflict recovery |
| P1 | Free launch content/asset review | Confirm commercial conditions/attribution for actual Quran editions, translations, audio, font and artwork; review semantic mnemonic cues with teachers. Final Gallery artwork and poetic tafsir are not complete |
| P2 | Mobile flow and menu complexity | Reduce above-arena scrolling, duplicate dashboard routes, overlapping “recall” labels and competing progress currencies; validate with new learners rather than adding more modes first |

These priorities are conditional on what is being launched: a deliberately narrow free/guest release does not require enabling Stripe or AI, but still needs appropriate content, UX and privacy checks. They are not permission to bypass any account/content policy.

## Read-only hosted probes

[Probe results](hosted-probes.json):

- Public Railway home: HTTP **200**.
- Anonymous private Quran bundle request: HTTP **401**, “Sign in required.”
- `chronicles-content` URL: HTTP **404**, “Requested function was not found.” The new default server coming-soon gate cannot be validated there until the function is deployed.

These establish reachability/one anonymous denial, not complete authorization. No real Google/email login session, paid account, A/B private row, payment, bucket policy, microphone upload or personal record was exercised. The probes do not establish which GitHub commit Railway currently serves; deployment is manual.

## Automated evidence for this review

Final complete-run results on the repaired candidate:

- **916 passed, zero failures**, full Playwright unit/browser/policy suite (14.5 minutes, four workers).
- **29 backend tests passed**: billing 7, content 6, recitation comparison 5, coach 5, Chronicles 6.
- All five Edge Function type-check scripts passed.
- Production build passed (7.49 seconds).
- Focused recovery/model/compatibility suite: 32 passed before the full run.
- Responsive audit: 24 checks, zero document overflow, maximum local entry 1,317ms. Six Night Sky mobile/desktop screenshots were inspected. This is a local mock-guest/reduced-motion check, not production cold-load or physical-device benchmarking.
- `git diff --check`: passed.

No remaining local test failure is being waived. The hosted/content/privacy/device gates above remain unresolved; **production readiness is not claimed**.

Commands:

```sh
npx playwright test --config=playwright.regression.config.js --workers=4
npm run test:billing
npm run test:content
npm run test:recitation
npm run test:coach
npm run test:chronicles
npm run check:billing
npm run check:content
npm run check:recitation
npm run check:coach
npm run check:chronicles
npm run build
# While local Vite is running:
node scripts/audit-3.0-ui.mjs
git diff --check
```

The initial full run was intentionally stopped after reproducing the recovery defect. It is not counted as a full passing run. Do not run separate Playwright processes against a shared automatically managed Vite server: one process can close it while the other is still testing.

## Practical next verification steps

1. Deploy the tested frontend manually in Railway and verify asset/module loading and the regular/developer navigation split.
2. Use [Chronicles setup](../../supabase/CHRONICLES_SETUP.md) only when its existing migration and developer preview are needed; keep `CHRONICLES_LEARNER_ENABLED=false` and do not seed mechanics fixtures.
3. Run [the hosted Stripe checklist](../stripe-test-checklist.md) on controlled staging. Test Clock renewal scenarios need a genuinely linked staging customer fixture; synthetic invoice events alone are not renewal evidence.
4. Run the real A/B/private-content/downgrade matrix and retain redacted evidence. Never put service-role/Stripe secrets into browser tools or chat.
5. Have teachers and novice learners test one complete study → supported game → unassisted recitation → next-day review journey. Measure assistance and retention, not just enjoyment/points.
6. Review the [mobile/desktop screenshots](ui/README.md) and then test the same flows on physical devices and assistive technology.
7. Preserve device exports and database backups before rollout; use [the existing rollback plan](../release-3.0/deployment-and-rollback.md). Do not clear learner storage or run destructive down migrations to hide a recovery warning.

**Release decision remains conditional.** Local green tests are necessary evidence, not a production certificate.
