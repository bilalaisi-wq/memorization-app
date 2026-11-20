# Phase 8 — StoreKit, Google Play and Stripe

Status: native adapters, server verification, notifications and additive entitlement reconciliation are implemented. **No live mobile purchases are enabled.** No Apple/Google sandbox purchase, native SDK build, storefront approval or production payment has been performed in this workspace.

## Architecture and preserved behavior

- Website: existing Stripe Checkout/Customer Portal and prices remain unchanged: Explorer $3.99/month or $35.99/year; Pathfinder $6.99/month or $59.99/year; Guardian $11.99/month or $99.99/year, disabled until released.
- iOS: `@capgo/native-purchases` 8.9.16 wraps StoreKit 2. Android: the same maintained Capacitor 8 plugin wraps Play Billing. Separate adapters share a provider-neutral contract. Store prices come from the SDK in the current currency, not from hard-coded Stripe prices.
- Supabase authenticates the existing account and creates an opaque account-binding UUID. Apple appAccountToken / Google obfuscated account ID carry that binding. No duplicate learning account is created.
- Verification uses Apple's official server library 3.1.0 with operator-pinned Apple root certificates, online certificate checks and signed transaction/renewal/notification verification. Google purchases use the Android Publisher subscriptionsv2 API; RTDN push identity uses Google's signed OIDC JWT, official Google JWKS, exact audience and publisher email.
- `billing_entitlements_for` wraps the existing Stripe/developer implementation. The highest verified eligible tier wins; paid periods are not added together. Absolute store expiry dates, grace/cancellation state and provider environment determine access. Sandbox records cannot grant live-environment access. Developer access, free Al-Fatihah/Juz Amma, learning histories, XP and FSRS are preserved.
- Native transactions are finished only after server verification and persistence. Google acknowledgment is server-side. Client claims never write premium state. Purchase references/tokens remain service-only; no raw signed payloads, purchase tokens, keys or customer credentials enter public entitlement results.
- Per-user locks serialize verification against Stripe operations. Notifications trigger a fresh canonical store query under the lock; arrival order does not apply stale event payloads. Unique event/transaction keys make receipts idempotent. Account changes invalidate in-flight adapters.

## Database installation

Apply existing billing/developer migrations first, then paste the complete **SQL contents** of `supabase/migrations/20261119_native_billing.sql` into Supabase SQL Editor and run it. Do not paste Markdown fences or the filename itself. The migration preserves old tables and wraps the current entitlement implementation rather than replacing Stripe rules. It adds store config/product/binding/subscription/transaction/event/rate-limit/reservation tables with RLS and service-only writes. Explorer selections lock an account row even without a Stripe customer.

All new purchase and verification flags default false. Deploy the updated Stripe Checkout function alongside the native migration: it uses the shared native checkout guard to reject accidental overlapping subscriptions. Apply this migration **after** any older bundled setup SQL that recreates `billing_entitlements_for`; rerunning an older definition afterward could bypass the wrapper. Back up your schema and use staging first.

## Supabase secrets

Dashboard → **Edge Functions → Secrets**. Never use `VITE_` names for server credentials. Never put secrets in source, client configuration, chat, native projects, app bundles or public CI artifacts.

Existing web settings: `STRIPE_SECRET_KEY` (`sk_test_…` for testing), `STRIPE_MODE=test`, `STRIPE_WEBHOOK_SECRET`, existing six Stripe Price IDs and `BILLING_SITE_URL`. The supplied Stripe publishable key is public and is not needed by hosted Checkout; no unused key was added. Existing Supabase URL/service-role secrets stay server-side. `BILLING_ALLOWED_ORIGINS` must include the existing site, `capacitor://localhost` and `https://localhost` for native requests.

Apple:

- `APPLE_ENVIRONMENT=sandbox` (later `production`, separately configured)
- `APPLE_PRIVATE_KEY`: complete App Store Connect in-app purchase/server API P8 signing key
- `APPLE_KEY_ID`, `APPLE_ISSUER_ID`
- `APPLE_APP_ID`: numeric App Store Connect Apple ID, required in production
- `APPLE_ROOT_CERTIFICATES_BASE64`: JSON array of base64 DER Apple root certificates obtained from Apple's official PKI page, independently checked by the operator. Never trust roots supplied inside an incoming notification. Apple G2/G3 roots as applicable to the official library/documentation should be reviewed; do not guess certificate fingerprints.

Google:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: server-only service-account JSON, with Android Publisher access scoped to this app
- `GOOGLE_RTDN_AUDIENCE`: exact HTTPS URL configured as the Pub/Sub authenticated push audience
- `GOOGLE_RTDN_SERVICE_EMAIL`: the exact service-account email used to authenticate Pub/Sub pushes; grant only required publish/push permissions

Deploy:

```sh
supabase functions deploy billing-native --no-verify-jwt
supabase functions deploy billing-apple-notifications --no-verify-jwt
supabase functions deploy billing-google-notifications --no-verify-jwt
supabase functions deploy billing-checkout --no-verify-jwt
```

Gateway JWT verification is disabled because the handlers perform their own auth: `auth.getUser()` plus confirmed email for user routes, Apple JWS verification for Apple notifications, and Google OIDC verification for RTDN. Do not remove those checks. Billing requests are bounded/rate-limited; provider HTTP calls use 12-second timeouts, Google JWKS uses 10 seconds, and Apple's official online certificate checks use its bounded transport. Provider failures leave access unchanged rather than guessing payment.

## Apple operator setup

1. Enroll/configure the Apple Developer/App Store Connect account. Use the existing bundle **com.ayahaday.app** and app name **Ayah A Day**; do not rename signing identity.
2. Create auto-renewable subscriptions in **one subscription group** for the tiers/cadences actually being released. Store prices are set in App Store Connect and may differ by storefront/currency. Guardian stays unavailable. Do not publish products promising unavailable content/AI/Chronicles lessons.
3. Copy the actual product IDs into `billing_store_products`. Example names such as `com.ayahaday.app.explorer.monthly` are naming suggestions only, not registered products. There are no fabricated IDs seeded into the migration.
4. Configure App Store Server Notifications **V2** sandbox endpoint as `https://YOUR_PROJECT.supabase.co/functions/v1/billing-apple-notifications`; configure production separately only after approval. Exercise Apple's test notification and Notification History recovery procedures.
5. Create a sandbox tester; build/sign/install a new binary containing NativePurchases. `autoFinishTransactions:false` is set in native config before the native transaction listener starts. Test interrupted purchases and unfinished restoration. Restoration processes bounded batches of ten current/unfinished records; repeat Restore if the app reports additional unfinished records.
6. Use non-developer learning accounts for purchase tests: developer entitlements intentionally already provide access and the duplicate-purchase guard rejects new purchases on an entitled account.

## Google operator setup

1. Configure the existing **com.ayahaday.app** listing in Play Console, including payments profile, licenses/testers, internal testing track and signed artifacts.
2. Create the actual subscriptions and auto-renewing monthly/annual base plans. Map both **product ID and base-plan ID** into Supabase. This implementation does not guess between prepaid, installment or mixed-line subscriptions; those configurations are rejected. Initially use standard recurring offers, without introductory/commitment pricing. SDK entries requiring extra unimplemented offer disclosure are not presented for purchase.
3. Give the server service account the minimum necessary Play Developer permissions for this application, including subscription lookup and acknowledgment. Keep its JSON key exclusively in Supabase secrets.
4. Configure RTDN to a Pub/Sub topic and an authenticated push subscription targeting `billing-google-notifications`. Use the exact audience and service-account email configured above. Follow Google's documented publisher permissions. Never expose an unauthenticated push route.
5. Upload an internal-test build and buy with license testers. Test pending payments, cancellation, grace, account hold, replacement tokens, refunds/revocations and server-side acknowledgment. Test duplicate RTDN and late notifications; do not use client purchaseState as entitlement proof.

## Product mapping and rollout

Use actual registered IDs. For example, after replacing placeholder values in a private operator script:

```sql
insert into public.billing_store_products(provider,product_id,base_plan_id,plan,cadence,enabled)
values ('apple','YOUR_REAL_APPLE_EXPLORER_MONTHLY_ID','','explorer','monthly',true),
       ('google','YOUR_REAL_GOOGLE_EXPLORER_PRODUCT_ID','YOUR_REAL_MONTHLY_BASE_PLAN_ID','explorer','monthly',true)
on conflict(provider,product_id,base_plan_id) do update
set plan=excluded.plan,cadence=excluded.cadence,enabled=excluded.enabled;
-- Staging/test project ONLY, with matching Stripe test configuration:
update public.billing_store_config set environment='sandbox',verification_enabled=true,purchase_enabled=true
where provider in ('apple','google');
```

Sandbox purchases do not require pretending the final sandbox/policy review has passed. Live purchases require `environment='production'`, matching live backend billing mode, `verification_enabled`, `purchase_enabled`, `sandbox_approved`, `policy_reviewed`, and published HTTPS `privacy_url` / `terms_url`. Set approval flags only after documenting actual tests/review. Guardian additionally requires its existing global flag. Native UI renders the verified legal URLs and localized recurring price. Never switch a staging database with mixed test histories directly into production without reviewing environment separation and credentials.

## State and account behavior

- Cancellation: native store management; paid access continues through the provider's eligible paid period. Expiration/revocation removes premium entitlements without deleting progress. Grace uses provider-confirmed expiry; on-hold/paused/pending purchases do not unlock access.
- Refunds: canonical provider entitlement/revocation state determines access. A refund without revocation must not be guessed to be an automatic cancellation. RTDN/App Store notifications re-fetch current state.
- Restore: sign into the original store **and** original learning account. Only bound, server-verified receipts are restored. Purchases lacking the supported account binding, Family Sharing, ownership transfers or deleted-account receipts require support; no silent reassignment is implemented.
- Existing subscriptions: purchase reservations and the backend guard prevent normal duplicate flows; pre-existing overlapping providers converge to the highest eligible tier and remain visible for management. A store sheet completed after an external purchase can still create overlapping charges; there is no atomic transaction across independent stores. Detect/review those cases and cancel/refund with the original provider rather than inventing an automatic transfer.
- Native UI never opens Stripe checkout/portal as a fallback. It uses the current platform's management sheet and names other purchase providers. Website-native purchases link to official store management; web Stripe customers retain their portal.
- Native Explorer accounts retain the five-juz selection UI and server validation. Store purchase success never modifies memorization/FSRS.
- Offline: no new purchase/restore or premium entitlement grant; existing free offline study remains available. Reconnect for authoritative verification. This phase does not introduce indefinite offline premium licenses.
- Deletion: native subscriptions do not add a new deletion block. The UI warns that account deletion does not cancel store billing. Existing Stripe deletion safeguards still require legal/store-policy review before submission; their presence is not a certification of compliance.

## Regional policy review — not completed

No alternative billing, external purchase link, regional steering or special-program assumption is enabled. The ordinary native-store purchase path is used everywhere. The operator must review **each intended storefront and distribution channel** immediately before release, including applicable Apple multiplatform/reader rules, Google payments/alternative-billing programs, privacy/disclosure, account deletion, sign-in requirements, subscription terms and refund obligations. US rules are not applied globally. Intended storefronts have not been specified and the official policy pages were unreachable from this workspace (DNS failure), so the policy approval flag stays false.

Official references for the review:
- https://developer.apple.com/app-store/review/guidelines/ (sections 3.1.1, 3.1.2 and applicable 3.1.3 provisions)
- https://developer.apple.com/documentation/appstoreserverapi
- https://developer.apple.com/documentation/appstoreservernotifications
- https://www.apple.com/certificateauthority/
- https://support.google.com/googleplay/android-developer/answer/9858738
- https://developer.android.com/google/play/billing/security
- https://developer.android.com/google/play/billing/lifecycle/subscriptions
- https://developer.android.com/google/play/billing/rtdn-reference

## Validation and release checklist

Automated tests cover provider-state normalization, signed Google identity verification with a test JWKS, rejection of forged Apple payloads by the official verifier, HTTP auth, native delivery ordering/manual finish, duplicate restoration, account switching, SQL RLS/isolation, idempotent transactions/events, Stripe/native convergence, expiration, five-juz selection and native UI with mocked store APIs. They are **not store sandbox purchases**.

Required external gates: real Apple/Google sandbox initial purchase, restore on second device, interrupted/pending/failed payment, renewal, cancellation, expiry, grace/retry/hold, refund/revocation, plan change, duplicate/out-of-order notifications, account A/B, web/native convergence, physical devices, store legal review and native SDK builds. Exercise store notification recovery/history and operational monitoring. Notifications can be delayed/lost; absolute expiry prevents indefinite access, but renewal/revocation recovery requires successful notification retry or explicit authenticated refresh. A scheduled reconciliation worker and mass notification-history replay are not included.

Rollback: set `purchase_enabled=false` to halt new sales while keeping `verification_enabled=true` so paid subscriptions continue to verify. Do not delete subscriptions/learning records or disable verification merely to hide a paywall. Preserve store notification handlers during frontend rollback. Native plugin changes require new store binaries; the existing signed OTA compatibility guard blocks incompatible runtime updates.

### Recorded automated results

- Targeted Playwright/browser/model/database regression run: **33 passed**. Final native-only follow-up: **8 passed**, followed by the final migration/OID-preservation test: **1 passed**. Follow-ups recheck overlapping cases; these counts must not be summed as unique tests.
- Provider cryptographic/transport tests: **3 passed** (including late notification canonical re-fetch and account isolation).
- Existing Stripe HTTP tests plus native authentication boundary: **8 passed**.
- Existing protected Quran-content HTTP tests: **7 passed**.
- `npm run check:native-billing`: passed for all three Edge Functions.
- Production Vite build, Capacitor sync (12 plugins per native platform), native bundle guards and whitespace checks: passed.
- Android/iOS SDK compilation: not performed; preflight reports missing Android SDK 36 and missing macOS/Xcode. Real Apple/Google sandbox purchases and live storefront compliance: **not performed**.
- Browser-only mobile screenshot inspected: `/workspace/artifacts/native-billing-disabled-mobile.png`; it is not a physical-device screenshot.

### Changed components

`src/billing/native/` contains Apple/Google adapters and native account UI. `src/billing/ui.js` preserves Stripe web behavior and uses provider-specific management. `supabase/functions/_shared/native-billing/` contains state normalization, official provider verification, reconciliation and notification handlers. Three Edge Functions expose authenticated native billing, signed Apple notifications and authenticated Google RTDN. The additive migration carries ownership, RLS, product/rollout configuration, reservations, transaction/event idempotence, replacement-token tombstones and effective entitlement aggregation while preserving the public function identity. Existing Stripe Checkout gains a native duplicate-purchase guard. Native dependencies/configuration/projects, tests and this setup guide complete the integration.

## Allow Codex to perform the operator steps

Saving `STRIPE_SECRET_KEY` in Supabase does not give this workspace Supabase management access. The Stripe secret should remain there; it does not need to be copied into chat or the frontend.

To authorize deployment from this cloud workspace:

1. Create a Supabase personal access token at https://supabase.com/dashboard/account/tokens using the account that manages project `ycgyuatjgdbhiakqourg`.
2. Add it to the **Codex cloud environment Secrets** as `SUPABASE_ACCESS_TOKEN`. This is a workspace deployment credential, not another Supabase Edge Function secret.
3. If the environment exposes secrets only during setup, add `set +x; npx --cache /tmp/ayah-supabase-cli --yes supabase@3.2.0 login --token "$SUPABASE_ACCESS_TOKEN"` to the environment setup script. The equivalent repository helper is `scripts/supabase-operator-login.sh` once that file is available in the checkout. Save and rebuild the environment. The helper uses the standard Supabase CLI login and disables shell tracing; it does not apply migrations, change plans or enable purchases.
4. Ask Codex to continue the Supabase billing setup. It can then verify secret names without displaying values, inspect schema prerequisites, apply the reviewed additive migration and deploy the functions.

The helper is prepared but has not authenticated: this workspace currently has no management token or saved Supabase login. The saved Stripe key has not been remotely checked. Apple Developer/App Store Connect and Google Play Console access, their real product IDs and server credentials are separate prerequisites; a Stripe key cannot create or authenticate those accounts. Keep live purchase flags disabled until actual store testing and review.
