# Subscription billing setup and verification

## Current delivery status

The repository implements Stripe-hosted subscription Checkout and Customer Portal, authenticated Supabase Edge Functions, signature-verified webhooks, server-authoritative entitlements, pricing/account UI, saved Passage Builder references and revision summaries. Checkout defaults to **disabled**, Stripe defaults to **test**, Guardian defaults to **disabled**, and both AI flags default to **disabled**. No keys or Price IDs have been invented.

Local validation passed: production Vite build, all **145 Playwright/model/database tests**, all **6 Deno Edge tests**, and type checks for all six Edge Functions. [UI previews](billing-previews/README.md) use explicit test fixtures.

The owner confirmed Stripe has not been set up yet. Automated tests use official Stripe/Supabase SDKs with network fixtures, actual Stripe signature verification, and PostgreSQL-compatible database execution. They do **not** establish that a hosted checkout/payment has worked. No Stripe products, hosted functions, dashboard changes, or live charges have been created from this environment. Complete the test-mode dashboard steps and acceptance checks below before enabling purchases. Live billing must be tested separately; this is not a production-readiness claim.

## Plans and availability

| Plan | Monthly USD | Annual USD | Entitlements |
|---|---:|---:|---|
| Free | 0 | 0 | Unlimited Juz Amma, Al-Fatihah, every existing free mode and basic FSRS revision |
| Explorer | 3.99 | 35.99 | Free + saved Passage Builder + five selected additional juz as content is added |
| Pathfinder | 6.99 | 59.99 | Explorer tools + all content when available + advanced revision planner and memory summaries; AI requires a server flag and an implemented service |
| Guardian | 11.99 | 99.99 | Pathfinder + advanced AI when ready; unavailable initially |

The current verified library is **38 surahs / 571 ayahs: Al-Fatihah and all of Juz Amma**. No additional juz are currently bundled. Pricing states this prominently; paid content rights are not a claim that the full Qur’an has been added. Existing Ayah Chain, all current puzzles, Daily Quests, recordings, achievements, activity charts, progress statistics, and basic FSRS scheduling remain free. Passage Builder adds named, account-saved ranges and opens their existing chain/practice mechanics. Pathfinder adds batch selection of the oldest due reviews and seven-day summaries without changing the FSRS formula or schedules. All recitation remains self-assessed. No AI API is connected; enabling a flag alone will not create an AI service.

## One-time Supabase setup

1. Prefer a **separate Supabase staging project and Stripe test account/sandbox** for testing. Do not reuse live secrets in a test deployment. Set Vite's existing public Supabase URL/publishable key and auth return URL to the matching project. Production learning data does not need to be moved or reset.
2. Existing account-enabled projects: run [`20261022_billing.sql`](../supabase/migrations/20261022_billing.sql) in the SQL editor. Fresh projects may run [`SETUP_ACCOUNTS.sql`](../supabase/SETUP_ACCOUNTS.sql), which contains the complete account and billing setup and is safe to rerun. Keep RLS enabled. This migration creates isolated billing tables and never alters learning progress, XP, rewards or FSRS records.
3. Confirm `billing_config` has its default row: mode `test`, checkout/Guardian/AI flags all false. Only the service role/project administrator can modify this table. Browser accounts, including the developer owner, cannot edit subscriptions or flags.
4. The project’s Edge runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is used **only on the backend** and must never be copied into Railway/Vite frontend variables, code, GitHub, or chat. A publishable key cannot deploy functions or run migrations. Use your Supabase dashboard/CLI login for administration.

## Stripe test-mode dashboard setup

1. Switch Stripe to **test mode / your test sandbox**. Create recurring USD prices with quantity 1 and no usage tiers:
   - Explorer: 399 cents every month; 3599 cents every year.
   - Pathfinder: 699 cents every month; 5999 cents every year.
   - Guardian may be created at 1199 cents/month and 9999 cents/year, but keep it disabled and out of the Portal configuration until its services are ready.
2. Use ordinary licensed recurring prices, no trial periods for the initial launch, no tax-inclusive price substitutions, and no adaptive/multi-currency pricing configuration. The backend checks exact USD amounts, interval/count, active recurring status and test/live mode. Monthly and annual Price IDs must be distinct. Do not replace a published Price ID without planning migration for existing subscribers; unknown prices fail closed. Keep the configured legacy prices until subscribers have migrated.
3. Configure **Customer Portal** in the same Stripe test environment. Enable payment-method/invoice management, cancellation **at the end of the billing period**, and subscription updates only among the configured Explorer and Pathfinder prices. For initial deployment, schedule plan downgrades/changes at renewal to avoid ambiguous prorations. If you later enable immediate paid upgrades, test the proration/payment flows explicitly. Never offer Guardian through Portal while its launch flag is false. Copy this Portal configuration ID to the backend settings.
4. Configure the business identity, support contact, terms/privacy URLs and cancellation policy shown in Stripe Checkout/Portal. This implementation does not collect card details in the app. Configure tax obligations and Stripe settings for your jurisdiction before live billing; the checkout total must reflect your actual policy.
5. In **Supabase Edge Function secrets**, enter the values listed in [`supabase/functions/.env.example`](../supabase/functions/.env.example):
   - `STRIPE_MODE=test`
   - `STRIPE_SECRET_KEY` from the same test environment (`sk_test_…`). Never a live key here.
   - Four Explorer/Pathfinder Price IDs; leave Guardian unset initially.
   - `STRIPE_PORTAL_CONFIGURATION_ID`
   - `BILLING_SITE_URL=https://ayah-a-day.up.railway.app` (HTTPS origin, no path/query).
   - Optional exact staging origins in `BILLING_ALLOWED_ORIGINS`; no wildcard.
   The webhook signing secret is added after creating the endpoint below. Use the dashboard secret fields or a gitignored local env file with `supabase secrets set --env-file …`; do not paste secret values into source, CLI history, logs or chat. No Stripe browser key is needed because Checkout and Portal are hosted redirects.

## Deploy functions and webhook

With Supabase CLI installed and authenticated, from the repository root run:

```sh
supabase functions deploy billing-checkout --project-ref YOUR_PROJECT_REF
supabase functions deploy billing-portal --project-ref YOUR_PROJECT_REF
supabase functions deploy billing-refresh --project-ref YOUR_PROJECT_REF
supabase functions deploy billing-passages --project-ref YOUR_PROJECT_REF
supabase functions deploy billing-close --project-ref YOUR_PROJECT_REF
supabase functions deploy billing-webhook --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` disables the gateway JWT check for these routes intentionally. Every user endpoint independently validates the bearer token with Supabase `auth.getUser()`, requires a confirmed non-anonymous account and derives the user ID from that result. Webhooks instead validate the **unmodified raw request body** using the official Stripe SDK, signature header and five-minute timestamp tolerance. Do not remove either validation path.

In Stripe test mode, add a webhook destination for:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/billing-webhook`

For the currently configured project, that is:

`https://ycgyuatjgdbhiakqourg.supabase.co/functions/v1/billing-webhook`

Select API version **2026-09-30.endive**, matching the pinned Stripe 23.0.0 SDK. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.marked_uncollectible`, `invoice.voided`

Copy that destination’s `whsec_…` signing secret directly into `STRIPE_WEBHOOK_SECRET` in Supabase. A Stripe CLI forwarding secret is different from a dashboard destination’s signing secret; use the one matching the sender. Unsupported events return a harmless ignored response; failed processing returns non-2xx for Stripe retry. Do not mark failed deliveries successful manually without reconciling them.

After the functions/secrets/webhook are installed, enable **test checkout only**:

```sql
update public.billing_config
set stripe_mode='test', checkout_enabled=true
where id=1;
```

Leave Guardian and AI flags false. Redeploy the frontend on Railway. No Stripe/Supabase secret belongs in Railway’s Vite build environment. The app obtains the current user’s entitlements directly through `my_billing_entitlements()` and payment links through authenticated Edge Functions.

## Test-mode acceptance run (must still be performed on the hosted services)

Use real test accounts A and B plus Stripe’s documented test payment methods. Never use a real card in test mode. Stripe’s standard successful test card is `4242 4242 4242 4242` with a future expiry and test CVC. Use Stripe’s current documented decline/authentication test methods for failure cases.

1. **Free baseline:** while signed out, complete Juz Amma puzzles, audio, recording, basic recall and chain practice. Repeat with checkout disabled, Edge Functions unavailable, and an expired paid account. Verify XP/history survive and no free control is paywalled.
2. **Checkout:** sign into A, choose Explorer monthly, verify Checkout charges USD 3.99 and the correct interval. Complete the test payment. Returning to `?billing=success` alone must not grant access. Confirm the signed webhook arrives, then open Subscription & billing / Refresh billing and verify Explorer plus a paid access end date. Check annual prices separately.
3. **Repeat clicks/network failure:** repeat Checkout submissions and retry after a lost response. The server stores its idempotency key before the Stripe call and resumes an open checkout; it must not create duplicate subscriptions. Choosing a different plan while a checkout is pending asks the learner to finish/resume or wait for expiry (about one hour).
4. **Payment failure:** decline initial payment; no paid access. In a test-clock renewal scenario, fail the renewal invoice. Paid access must not extend beyond the last paid invoice line period. Updating the item for an unpaid upgrade must not unlock the higher plan.
5. **Renewal:** advance a Stripe test-clock subscription and pay the new invoice. Refresh and verify a later `access_until`, with unchanged learning progress. Test-clock subscriptions may be created via Stripe’s test tools using the app’s mapped test customer and configured prices; browser checkout need not attach clocks itself.
6. **Cancellation:** schedule Portal cancellation at period end. Access remains through that paid period. At expiry the SQL entitlement query automatically returns Free, even if a webhook is delayed; no progress is removed. Immediate effective cancellation returns Free. Resume before effective cancellation and verify the updated state.
7. **Plan/cadence changes:** Explorer → Pathfinder → Explorer and monthly ↔ annual through Portal. Check correct prices, effective dates, paid periods and limits. Guardian cannot be purchased or selected in Portal at this stage.
8. **Explorer limits:** choose five distinct juz 1–29. Try a sixth, duplicates, nulls, Juz 30 and direct REST writes; the server must reject them. Five saved choices do not imply unavailable content exists.
9. **A/B isolation:** B must not see/change A’s subscription, passages or customer. Supplying A’s user/customer/price ID to B’s endpoint must not act on A. Anonymous, invalid, unconfirmed and anonymous-auth users cannot call payment/premium endpoints. Direct browser writes to billing tables and privileged RPCs fail.
10. **Webhook defenses:** send invalid signatures, changed raw bodies and expired signatures. They must fail. Resend an event and deliver older events after newer ones. There is one processed receipt per event/mode; canonical Stripe state wins, not the old event payload. A DB failure must leave no processed receipt so a later retry succeeds. Concurrent delivery receives retryable lock conflicts rather than stale writes.
11. **Expiration and stored work:** expire/cancel A, then open existing saved passages. Reading/removing them remains possible, while creating new passages requires an active entitlement. Free chain and all learning history remain usable. Forging localStorage or a billing return query never unlocks access.
12. **Account deletion:** a mapped billing customer blocks direct account deletion until verified closure. Cancel through Portal and wait for effective cancellation; choose Close billing for account deletion. The server expires known open checkouts, verifies current Stripe state, deletes the Stripe customer/payment methods and records closure. Only then delete the app account. A deleted-Stripe-customer retry is safe if the final DB write failed. Learning progress is not deleted merely by cancellation or billing closure. Stripe may retain invoices/payment records under its legal retention obligations.

Record the test results, Stripe test event/session IDs, build commit and reviewer in your private deployment log. Do not put tokens/card data into test artifacts.

## Security and consistency model

- Client plan/cadence is only a requested selector. Server configuration maps it to a fixed price and checks Stripe’s price before Checkout. Subscription metadata, posted user/customer IDs, localStorage and success URLs never grant entitlements.
- `billing_customers` uniquely binds the verified account to a Stripe customer **per environment**. All premium endpoints use the verified account ID. Browser users can read only their own subscription rows; all billing/selection/passage writes are privileged RPCs or verified functions.
- `billing_events` stores only event ID/type/time, not raw webhook bodies, emails or card details. A per-account distributed five-minute lease serializes reconciliation. Stripe is queried **after acquiring the lease**; committing subscriptions and the event receipt is one transaction. Expired tokens cannot commit; duplicate receipts do not modify state. Event timestamps alone are deliberately not used to replay old snapshots.
- Renewed access derives from paid recurring invoice-line periods. `past_due` does not invent a new paid period. A paid scheduled cancellation stays active until its paid access end; canceled/unpaid/incomplete/paused/expired states do not grant access. Billing failures do not alter learning records.
- Multiple legacy subscriptions are reconciled individually; the entitlement query chooses the highest still-paid valid plan. New Checkout is blocked while a nonterminal subscription exists, so changes use Portal. A pending Checkout has a persisted idempotency key and Stripe-hosted session expiry.
- Saved passage references have a validated current-library range, account binding and database-enforced limit of 100. Existing saved references remain readable after expiry. They do not duplicate or modify authenticated Qur’anic text.
- Browser controls are a convenience, not a security boundary. Passage writes and juz selection enforce entitlements on the server. Existing local-only analytics can be computed from a learner’s own local records; hiding their UI is not DRM. Future paid Qur’an content and AI services **must** check server entitlements before returning protected data or invoking providers. `canAccessJuz` is the tested shared rule for that future content boundary (derive the juz from a verified server manifest, never a caller-supplied juz number); no additional protected Qur’an content service is claimed to exist today.
- AI flags are independent server config. No AI endpoint/provider is deployed by this change. Do not turn on Guardian billing until advanced AI services, privacy terms, quota enforcement and live acceptance tests exist.

## Reproducible local checks

Use Node.js 24 and `npm ci`. Deno 2.9.6 and Stripe 23.0.0 are pinned development dependencies; hosted functions import the same SDK version. Then run:

```sh
npm run build
npm test -- --workers=2
npm run check:billing
npm run test:billing
```

Deno may need to download pinned npm imports on the first check; a writable `DENO_DIR` can be supplied in restricted cloud environments. The Edge tests replace network with explicit fixtures and are run **without network permission**, so they cannot charge cards or contact hosted Supabase. Playwright covers pricing, checkout handoff/errors, return URLs, cancellation/expiry, selection and saved-passage integration. Model tests cover price validation, paid periods, failed upgrades, renewals, mode isolation and webhook ordering. PGlite tests execute migrations and enforce SQL privileges, RLS, ownership, event idempotency, expiration, flags and deletion protection. Local assertions do not replace the hosted acceptance run above.

For optional local Edge serving, use a gitignored `supabase/functions/.env.billing.local` copied from the example, then `supabase functions serve --env-file supabase/functions/.env.billing.local`. Forward Stripe CLI test events to the local webhook using that CLI session’s signing secret. Never test live keys against local fixtures.

## Live activation is a separate milestone

Use separate live Stripe products/prices, live webhook destination/signing secret and preferably a separate Supabase project. Set live mode consistently in the function secret and `billing_config`; the handler rejects cross-mode objects. Configure production Portal prices, terms, tax/support/privacy notices and monitoring/retry procedures. Verify an actual live payment, renewal handling, cancellation and refund/support policy with the owner’s approval before claiming production readiness. Refunds/disputes are not automated entitlement policies in this version; define and implement them before offering a refund-driven revocation policy. Monitor failed webhook deliveries and reconcile through Refresh billing; a scheduled service-role reconciliation job can be added for large deployments.
