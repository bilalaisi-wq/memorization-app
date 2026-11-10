# Ayah Quest: Stripe sandbox checks, step by step

Use this with [Stripe setup](stripe-quick-start.md). These are instructions to run on hosted test services; local automated tests do not process payments. Use a separate staging deployment/Supabase project when possible. Never paste API secrets, webhook secrets, passwords or sign-in tokens into chat or GitHub.

## 1. Open the dashboards and choose test mode

1. Open Stripe Dashboard and choose your **Sandbox / test environment**. Confirm the test indicator before creating anything.
2. Open Supabase Dashboard → your project → SQL Editor and Edge Functions.
3. Have two controlled learner accounts, A and B. Use different browser profiles (or a normal window and private window). Do not use actual customer accounts or real cards.
4. Your current app hides unreleased paid tools from ordinary learners. Perform checkout through the existing pricing interface in a controlled staging preview/developer session; do not make the public menu available just to run these checks. Use a regular test account for entitlement tests: the developer's unrestricted preview is not proof of paid authorization.

## 2. Install existing billing prerequisites

From a local checkout, open Terminal in the repository folder (the folder containing `package.json` and `supabase`). On Windows PowerShell:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref ycgyuatjgdbhiakqourg
npx.cmd supabase migration list
```

That project ref is the existing project. Substitute your staging project's ref if using staging. Review the listed migrations before applying anything. Follow [the existing setup guide](stripe-quick-start.md#1-prepare-supabase) for missing billing prerequisites; never reset an existing learner database. SQL Editor takes the actual SQL file contents, without Markdown fences or filenames.

## 3. Create sandbox prices and Portal configuration

Stripe → Product catalog: create **Explorer** ($3.99/month and $35.99/year) and **Pathfinder** ($6.99/month and $59.99/year), USD recurring prices. Copy all four `price_…` IDs. Keep Guardian disabled.

Stripe → Settings → Billing → Customer portal: enable payment-method updates, invoices and cancellation at the paid period's end. Allow changes only between the supported Explorer/Pathfinder prices. Initially schedule downgrades at renewal. Save its `bpc_…` configuration ID.

## 4. Enter server secrets and deploy

Supabase → Edge Functions → Secrets: enter `STRIPE_MODE=test`, `STRIPE_SECRET_KEY` (sandbox `sk_test_…`), the four `STRIPE_*_PRICE_ID` values, `STRIPE_PORTAL_CONFIGURATION_ID`, and `BILLING_SITE_URL` for the tested website. Exact variable names are in [the setup table](stripe-quick-start.md#4-add-backend-secrets). Add the staging origin to `BILLING_ALLOWED_ORIGINS` if needed. None of these Stripe secrets go into Vite/Railway frontend variables.

From the checkout (Windows):

```powershell
npx.cmd supabase functions deploy billing-checkout
npx.cmd supabase functions deploy billing-portal
npx.cmd supabase functions deploy billing-refresh
npx.cmd supabase functions deploy billing-passages
npx.cmd supabase functions deploy billing-close
npx.cmd supabase functions deploy billing-webhook
```

Use the repository's Supabase configuration. Do not enable a JWT requirement on the Stripe webhook: it verifies Stripe's signature itself. User billing functions verify the signed-in user internally.

## 5. Add the signed webhook destination

Stripe → Developers/Workbench → Webhooks (or Event destinations) → Add destination → select your sandbox account events. URL for the current project:

`https://ycgyuatjgdbhiakqourg.supabase.co/functions/v1/billing-webhook`

Use the pinned API version and full event list in [step 6 of the setup guide](stripe-quick-start.md#6-connect-the-webhook). Copy this destination's `whsec_…` signing secret to Supabase as `STRIPE_WEBHOOK_SECRET`. Do not use a Stripe CLI forwarding secret for this hosted destination.

In Supabase SQL Editor, enable **test** checkout using only this configuration update:

```sql
update public.billing_config
set stripe_mode = 'test', checkout_enabled = true
where id = 1;
```

Redeploy the tested frontend manually in Railway. Confirm Supabase Auth redirect URLs and the billing return URL match that deployment.

## 6. Test successful Checkout

1. Sign in as test account A and open the staging pricing interface. Buy Explorer monthly.
2. Check Stripe-hosted Checkout shows **USD 3.99 monthly** and test mode.
3. Use `4242 4242 4242 4242`, any future expiry and a test CVC. Never use a real card.
4. Return to the app. Stripe → the webhook destination → event deliveries: confirm successful delivery (HTTP 2xx). Supabase → Edge Functions → `billing-webhook` → Logs: check for errors without copying sensitive payloads into chat.
5. Open account billing / Refresh billing. Verify Explorer and its paid-through date. A success return URL alone must not grant access.
6. Repeat with Explorer annual ($35.99), Pathfinder monthly ($6.99) and annual ($59.99), using separate controlled sandbox subscriptions and canceling test subscriptions after use.
7. Free Al-Fatihah/Juz Amma must remain accessible. Selecting a paid juz does not release unpublished/developer-only content: Surah Al-A'raf and Juz 29 remain developer previews under the current content policy. Test premium access with a released authorized pilot rather than assuming every juz is live.

## 7. Failures and renewals

- **Initial decline:** Stripe's documented test decline card `4000 0000 0000 0002`; checkout must not grant a paid period. Retry with a successful test method. Consult Stripe's current [testing documentation](https://docs.stripe.com/testing) for authentication and other failure methods.
- **Successful renewal:** use a dedicated sandbox customer/subscription attached to a Stripe Test Clock. Advance the clock past renewal, wait for invoice payment and webhook delivery, then Refresh billing. Verify `access_until` advances from a genuinely paid recurring invoice period.
- **Failed renewal:** on a separate Test Clock customer, configure a documented failing payment method before advancing. Inspect the failed invoice and webhook. A failed renewal must not invent another paid period; verify Free after the last paid access expires.
- A normal Checkout-created subscription is not automatically attached to a Test Clock. Create the dedicated clock customer in Stripe's test tools/API and follow Stripe's Test Clock workflow. Do not hand-edit Supabase subscription status to simulate a real renewal. A clock customer must also be linked to the controlled app account through a prepared staging fixture/server workflow; merely giving it the same email does not link it. If that fixture is unavailable, mark accelerated renewal/expiration pending (or wait for a real sandbox billing cycle), rather than treating synthetic invoice events as proof.

## 8. Cancellation, upgrade and downgrade

1. In the app, open Stripe Customer Portal and cancel at period end. Verify Portal confirmation and the app's cancellation date. Access stays until the paid-through date; all learning records survive.
2. Test resuming before that date. Verify the cancellation flag clears after reconciliation.
3. With a Test Clock subscription, advance beyond effective cancellation. Refresh billing: it should become Free without losing progress.
4. Upgrade Explorer → Pathfinder through Portal; verify a paid upgrade invoice before expecting higher access. Repeat with a failed upgrade payment; unpaid changes must not grant the higher plan.
5. Schedule Pathfinder → Explorer for renewal. Verify the existing paid period and the later effective entitlement/selected-juz behavior. Confirm the current Portal configuration supports the intended change timing; do not assume every proration setting behaves alike.

## 9. Isolation, duplicate deliveries and delays

- Sign in as B: A's subscription, customer, saved passages and private progress must not appear. Use browser developer tools only in controlled staging to attempt an A-owned row/API request as B; it must return no private rows or a denial. Never put a service-role key in the browser.
- Sign out during private audio/loading; it must stop/dispose, while free content remains usable.
- Stripe → webhook deliveries → select an already delivered event → **Resend** twice. Check `billing_events` retains one processed event receipt and no duplicate subscription/progress/XP changes occur.
- After a real later subscription change, resend an older event. The handler must reconcile current Stripe subscription state rather than restoring the older event payload.
- Test a temporarily failed webhook delivery on staging, then restore its configuration and resend. Use Refresh billing to reconcile. Do not break production webhook secrets for this test.
- Direct anonymous Checkout/Portal/private content requests must fail; a client-supplied plan or success query string must never unlock content.

## 10. Record evidence and stop before live activation

For each check record: test account alias (no password), sandbox subscription/event IDs, action, expected/actual plan, paid-through date, webhook delivery result and whether progress survived. Keep sensitive dashboard screenshots private. Supabase Table Editor → `billing_subscriptions` shows `mode`, `plan`, `status`, `period_end`, `access_until` and `cancel_at_period_end`; inspect rather than editing those authority fields. `billing_events` is the idempotency ledger.

Do not call billing production-ready based on these instructions or local tests. Resolve every failed hosted check first. Live mode needs separate live prices, API key, Portal config and webhook secret, followed by separately authorized live payment/cancellation validation. Keep test and live environments isolated.
