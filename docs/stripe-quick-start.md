# Stripe setup: Ayah Quest

Use a Stripe **test sandbox first**. This guide prepares payments; it does not certify live billing. No Stripe key belongs in Railway/Vite, GitHub, or chat.

## 1. Prepare Supabase

Open [your SQL Editor](https://supabase.com/dashboard/project/ycgyuatjgdbhiakqourg/sql/new).

If billing is already installed (`public.billing_config` exists), skip this SQL step. If accounts work but billing has not been installed, paste and run the entire [billing migration](../supabase/migrations/20261022_billing.sql). Do not reset the database. On a fresh project only, use [SETUP_ACCOUNTS.sql](../supabase/SETUP_ACCOUNTS.sql) instead. If you rerun an older billing setup after enabling developer preview, rerun [20261029_developer_access.sql](../supabase/migrations/20261029_developer_access.sql) afterward to restore the newer entitlement function.

## 2. Create Stripe products and prices

Open Stripe Dashboard, select a **test sandbox**, and open Product catalog → Add product. Create these recurring USD prices (quantity one, ordinary licensed recurring prices, no trials):

| Product | Monthly | Annual |
|---|---:|---:|
| Explorer | $3.99/month | $35.99/year |
| Pathfinder | $6.99/month | $59.99/year |

Copy each `price_...` ID. Guardian remains disabled; do not offer it yet. Configure your business/support details, terms, privacy and tax policy before charging customers.

## 3. Configure Customer Portal

In the same Stripe sandbox, open Settings → Billing → Customer portal. Enable payment method updates, invoices, and cancellation **at period end**. Permit subscription changes only between your Explorer and Pathfinder prices. Initially schedule downgrades at renewal. Save and copy the portal configuration ID (`bpc_...`).

## 4. Add backend secrets

Supabase → Edge Functions → Secrets. Enter each name separately:

| Name | Value |
|---|---|
| STRIPE_MODE | `test` |
| STRIPE_SECRET_KEY | Your sandbox `sk_test_...` key |
| STRIPE_EXPLORER_MONTHLY_PRICE_ID | Explorer monthly `price_...` |
| STRIPE_EXPLORER_ANNUAL_PRICE_ID | Explorer annual `price_...` |
| STRIPE_PATHFINDER_MONTHLY_PRICE_ID | Pathfinder monthly `price_...` |
| STRIPE_PATHFINDER_ANNUAL_PRICE_ID | Pathfinder annual `price_...` |
| STRIPE_PORTAL_CONFIGURATION_ID | Saved `bpc_...` |
| BILLING_SITE_URL | `https://ayah-a-day.up.railway.app` |

Supabase supplies its backend URL and service-role key itself. No Stripe browser key is needed. Leave Guardian and AI disabled.

## 5. Deploy Edge Functions

Install the Supabase CLI, authenticate with `supabase login`, then run from this repository:

```sh
supabase functions deploy billing-checkout --project-ref ycgyuatjgdbhiakqourg
supabase functions deploy billing-portal --project-ref ycgyuatjgdbhiakqourg
supabase functions deploy billing-refresh --project-ref ycgyuatjgdbhiakqourg
supabase functions deploy billing-passages --project-ref ycgyuatjgdbhiakqourg
supabase functions deploy billing-close --project-ref ycgyuatjgdbhiakqourg
supabase functions deploy billing-webhook --project-ref ycgyuatjgdbhiakqourg
```

Use the repository's `supabase/config.toml`. User endpoints authenticate internally; the webhook authenticates Stripe signatures.

## 6. Connect the webhook

Stripe → Developers/Workbench → Webhooks → Add destination. Choose:

```
https://ycgyuatjgdbhiakqourg.supabase.co/functions/v1/billing-webhook
```

Use API version `2026-09-30.endive`, matching the pinned SDK. Select these events:

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
invoice.payment_action_required
invoice.marked_uncollectible
invoice.voided
```

Copy this destination's signing secret into Supabase Secrets as `STRIPE_WEBHOOK_SECRET`. It starts `whsec_...`; it is not your Stripe API key.

## 7. Enable test purchases

Run in Supabase SQL Editor:

```sql
update public.billing_config
set stripe_mode='test', checkout_enabled=true
where id=1;
```

Refresh the app. Sign into a regular test learner account, open Menu → Plans & pricing, and purchase Explorer using Stripe's test card `4242 4242 4242 4242`, future expiry, any test CVC. No real card. A success URL alone grants nothing: verify the signed webhook succeeds and Subscription & billing shows the plan. Explorer must select Juz 29 before its content is accessible.

## 8. Verify before live activation

Use two accounts. Check both billing cadences, failed initial payment, failed/successful renewals, plan changes, cancellation at period end, expiration, duplicate webhooks, and isolation between accounts. Check Juz Amma remains free and progress survives cancellation. The full acceptance checklist is in [billing.md](billing.md#test-mode-acceptance-run-must-still-be-performed-on-the-hosted-services).

Live billing is separate: create live prices/portal/webhook, configure matching live secrets and SQL mode in a separate deployment where possible, and test an actual live payment and cancellation before describing payments as production-ready. Do not mix sandbox prices with live keys.
