# Hifz Coach: grounded planning with optional AI

Open **Menu → Hifz Coach**. The dashboard provides a daily session, seven-day workload outline, weak-memory/transition practice, Puzzle Lab suggestions, explanations, and gentle goal-adjustment advice. Edit available minutes (5–60) and study days (1–7) to reshape the plan. Checklists are planning aids only. Local rules work without a provider, backend or paid subscription, preserving existing free functionality. **External AI requests require verified server entitlements**, reviewed privacy controls, adult pilot membership and explicit per-request consent.

## Source of truth and honest progress

- Existing `learning.snapshot()` supplies per-ayah FSRS next-review dates, recorded stages and self-assessment history. Recent attempts/mistakes use a 14-day window. Puzzle achievements do not become independent recall evidence.
- Existing `ayah-passage-recall-v1` supplies whole-ayah, reviewed-segment and passage FSRS cards/history. Overlapping records in the two existing recall stores are shown as separate **recall units**, not added together as unique memorized ayahs. Neither schedule is deleted or silently merged. Starting a passage review opens that exact existing unit; an unfinished studio assessment is resumed first. Changed segment revisions require current reviewed boundaries.
- Existing goals provide intention, target surahs, confidence, available time and study frequency. A self-reported “already known” surah can be excluded from suggested new work but never earns recorded retention. The dashboard does not claim a number of verified memorized juz.
- Puzzle Lab transition weaknesses and recent game mistakes suggest corrective work; source-available targets remain local. The coach reads, but never rewrites, these records. Corrupt/uninterpretable passage history and impossible/future dates raise warnings and suppress new work. Original records are retained for recovery.
- Inputs are browser-recorded/self-assessed data, not independently verified memorization. The server validates bounded aggregates; it does not certify that a maliciously edited browser history is true. AI suggestions award no XP, stars, completion, mastery or leaderboard credit.

## Documented rules and FSRS boundaries

1. Due selection mirrors the existing daily dashboard's calendar-day policy in the learner's saved timezone. The existing recall screens still enforce their own exact-time/assistance/early-practice grading rules. The coach makes **zero scheduler writes** and never moves a due date to accommodate a plan.
2. Due retrieval comes first. A conservative per-unit study budget uses source word counts where available (roughly one minute per 20 words, minimum 2, maximum 15; unknown text length uses a conservative 15). The longest known unit sets the planning budget; a shorter available session is a **timebox**, not a promise of completing a long unit. Whole-unit recall must be finished before assigning a whole-unit grade.
3. Then allocate bounded repair, transition practice, or a corrective Lab game. AI focus can choose more weak-memory repair or highlight transitions. Spoken retrieval, comparison with the verified reciter and corrective practice remain separate steps.
4. New memorization is capped at one source-available ayah per session, only when time permits. It is suppressed for review-only goals, overload, inconsistent history, repeatedly failed units, a model reduction recommendation, or a zero AI new-work cap. Learners remain free to choose other existing learning modes; this is a conservative suggestion, not content access enforcement.
5. Weekly figures distribute currently known due counts and backlog across the suggested first N days of the next seven days. Later days are rest/optional light revision. It does not simulate future FSRS grades, promise catch-up, or predict future mastery. New grades can add due work; recalculate by reopening the dashboard. These are session estimates, not measured learner speed or exhaustive optimization.
6. Plan edits are device-local overrides, leaving existing saved goals intact. Local preferences use account-scoped `ayah-coach-settings-v1`; they are excluded from existing cloud progress payloads and removed by the coach deletion control/account deletion on this device. Checklists reset when the plan redraws; they never mark an ayah complete. Changing preferences discards AI options and cancels pending client requests. Already sent provider processing cannot be recalled.

## AI: constrained options, not invented explanations

The server calls OpenAI Chat Completions, initial baseline **`gpt-4o-mini`**, with a strict JSON schema, temperature 0 and at most 200 output tokens. It can return only:

```json
{"focus":"steady|weak|transitions","newCap":0,"goalAdvice":"maintain|reduce","breakStyle":"short|spaced"}
```

`newCap` is an integer 0–2; the local safety rule still caps new study at 1. All keys/enums/bounds are independently checked after the provider responds; unexpected fields, freeform religious explanations, malformed JSON and refusals fail closed to the local plan. Explanations and activities come from the versioned application rules using actual counts, not model-written progress stories.

No Quran text, tafsir, hadith, legal rulings or religious interpretations are requested or displayed from the model. The coach currently provides **no tafsir-based explanations**. Any future tafsir content must be separately curated, cited and reviewed; adding unrestricted generated claims to this schema is not permitted.

Before upload, the expanded AI panel shows the exact minimized summary: time/frequency, goal/confidence enums, recorded/due/weak/repeated/transition counts, recent independent/assisted attempts, recent puzzle mistake total, available-new count, conservative review cost, seven due-count buckets and an inconsistency flag. **No names, email, account UUID, surah preferences, specific ayah references, exact review timestamps, Quran text, recordings or full histories are sent to OpenAI.** Counts still reveal religious practice; treat them as sensitive. A separate adult consent declaration applies to coach aggregate processing. Existing operator-approved adult pilot membership is reused for adult eligibility, not as substitute for this new consent. Child accounts/uploads are unsupported until a separate reviewed design exists.

## Entitlements, allowance, cache and failure behavior

`hifz-coach` manually verifies bearer JWTs with `auth.getUser`, rejects anonymous/unconfirmed identities, and calls server-only access/reservation RPCs. The billing RPC derives the current paid subscription and `features.ai`; expired/free/Explorer or disabled AI cannot get paid AI suggestions. A client plan, identity, raw prompt or feature flag is never accepted. Allowed request fields are only `summary` and the exact consent version.

Default independent coach allowances: **Pathfinder 20, Guardian 40 successful reservations per UTC calendar month** (including provider failures). Guardian billing remains separately disabled until ready. Coach usage is separate from recitation transcription usage. A per-user transaction lock serializes subscription checks, cache lookup and quota increment, including month boundaries. One active request per user (90-second lease), minimum 10-second spacing and 10 reservations per one-hour window anchored at its first request are enforced server-side. Deleting cache cannot refill usage or clear the active lease early.

Identical canonical aggregate summaries + rules/model version + UTC request day share a private per-account cache for up to 24 hours. Valid cache hits bypass provider calls and do not increment usage, including after the monthly allowance is exhausted; **current entitlements are checked before serving a cache hit**. A changed learning summary or version produces a different fingerprint. Cache response metadata records requested/returned model, rules version, creation time, input basis, absence of religious content and `schedulerWrites:false`. Raw summaries/prompts/provider outputs are not stored in the app database.

Provider calls time out at 25 seconds, body reads at 10 seconds, and Supabase network calls at 10 seconds. Uploads are capped at 8 KB; provider responses at 32 KB. There are **no automatic provider retries**. API failures, quota/rate denial, malformed model responses and missing configuration leave the rules-based plan available and all learning data unchanged. A reservation after which the provider fails remains consumed because processing may have incurred cost. The app does not promise that generated options are expert coaching or better than the local baseline.

## Privacy and deletion

Supabase stores private per-account cache options/metadata/fingerprint and minimal monthly usage/rate/lease data, with RLS enabled and no direct browser table access. Explicit own-user deletion removes cache and invalidates in-flight cache-write tokens; eventual provider completion cannot recreate a deleted cache. Monthly usage persists to prevent reset abuse. Account deletion cascades these tables, subject to the existing billing closure flow. Cache purge removes expired entries; minimal usage aggregates persist until account deletion unless the operator adopts a shorter reviewed retention policy. Other devices' local overrides need local clearing.

The provider receives only the summarized input and service instructions, but its own API processing/security retention and infrastructure logs remain subject to actual terms. Do not enable request-body/session-replay logging or store the summaries in analytics. Local deletion is not a guarantee of erasure from provider processing or backups. The operator must publish contact, purposes, legal basis, provider/region/subprocessor terms, retention and rights procedures, and review adult access before activation. This is not a declaration of legal compliance.

## Setup and activation

1. Apply existing account/billing and experimental recitation migrations, then `supabase/migrations/20261027_hifz_coach.sql`. The adult eligibility table comes from `20261026_recitation_ai.sql`; coach enablement is independent of the audio feature's enable flag.
2. Configure `OPENAI_API_KEY` only in Supabase Edge secrets. Never use `VITE_*`, a frontend file, chat or Git for a secret. Use a separate staging provider project/key/budget. Existing `SUPABASE_URL`/service-role credentials remain server-only. Set exact `BILLING_SITE_URL` and optional allowlisted staging origins.
3. Deploy `supabase functions deploy hifz-coach --project-ref YOUR_PROJECT_REF`. `verify_jwt=false` is intentional because the handler verifies the identity and authoritative access itself.
4. Complete/publish the privacy and adult-access review. Approve only verified adults using the operator-reviewed pilot process (see [recitation setup](experimental-recitation.md)). Then:
   ```sql
   update public.billing_config set ai_enabled=true where id=1;
   update public.hifz_coach_config set enabled=true,privacy_reviewed=true where id=1;
   ```
   The defaults are off. Do not fabricate subscriptions or grant browser table/RPC write privileges. Operator emergency stop: set coach `enabled=false`. Revoke an individual's pilot row when needed. The per-request coach consent is additional.
5. Schedule `select public.purge_hifz_coach_cache()` in a daily trusted job. Verify cache isolation/deletion, entitlement expiry, concurrent quota exhaustion, budget alerts, and a real consenting adult staging request. Publish the cost and provider retention information for the actual deployment.

## Model choice, costs and launch limits

The baseline uses a small general model only for selecting a handful of safe planning options. It is **not** a Quran scholar, medical adviser, trained hifz teacher or validated optimization engine. Versioned rules continue to enforce due review and time budgets. Compare usefulness against the deterministic baseline with qualified Quran teachers and adult learners before broad activation.

Planning cost estimate at historical GPT-4o-mini rates ($0.15/million input tokens and $0.60/million output tokens): about **$0.0001–$0.00025 per uncached request** for roughly 400–800 input and 50–200 output tokens, excluding infrastructure, taxes and price changes. Cached app responses make no provider call. Verify current model availability, strict schema support, token billing and retention in the provider console before enabling. No live provider request or pricing revalidation is claimed here.

Automated tests cover empty/beginner histories, large overdue queues, thousands of recorded units across many juz, inconsistent/future dates, repeated failures, transition signals, no scheduler writes, exact passage review navigation, local plan editing/reloads, minimized transmission, cache hits, disabled/expired subscriptions, concurrent allowance bounds, A/B isolation, deletion races, unavailable APIs and rejected invented fields. These tests do not establish real coaching effectiveness, religious expertise or production privacy compliance. Hosted migration/function activation and live provider testing remain operator setup steps.

Commands: `npm run check:coach`, `npm run test:coach`, `npm test -- --workers=2`, `npm run build`; retain the existing billing/content/recitation backend checks as regression coverage.
