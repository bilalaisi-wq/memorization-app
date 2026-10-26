# Accounts, goals, and deployment

## What works without a server

Guest learning, goal plans, confidence-based next steps, activity days/streaks, badges, month-by-month history, puzzles, audio, and recording remain available offline after assets are loaded. My plan & achievements opens the expanded Daily Quests dashboard. Goals are self-reported, never proofs of memorization. Minutes are a planning intention, not a measured time-on-task claim. Explicit puzzle/audio interactions count as study; mere visits do not. Study sessions are deduplicated by ayah/mode/day; recorded puzzle and recall histories give actual completion counts. Legacy game history contributes only when dated history exists. No fabricated historical days are backfilled.

Streaks use the saved learning timezone. Yesterday's streak remains current until today ends, giving learners the whole day to practice. Missing days reset the current run, not XP or best streak. Badges use recorded game completions, independent self-assessments, or retained FSRS stages as stated. An “already know” checkbox cannot earn a retained-surah badge. Spaced reviews and audio assistance rules remain authoritative.

## Enable accounts

The supplied Supabase project and Railway site are wired through public client configuration. Follow [the project-specific activation checklist](activate-accounts.md) to install the database and enable real email/Google authentication. Public keys cannot change these administrative settings. No fake accounts or competitors are shown.

1. Create a Supabase project in an appropriate region and review its data-processing terms, subprocessors, backups, and retention. Keep your database password and service-role/secret keys out of frontend code.
2. Execute `supabase/SETUP_ACCOUNTS.sql` in the project's SQL editor. It creates owner-only progress storage, private leaderboard preferences, capped weekly submissions, redacted ranking access, and self-deletion. Do not disable row-level security.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and the **publishable** key. An older anon public key is also supported; never use a service-role key. Rebuild Vite; these are build-time public settings.
4. Configure your HTTPS site URL and exact allowed redirect URLs in Supabase Auth. Configure an email provider with rate limiting/CAPTCHA as appropriate. The email OTP template must include `{{ .Token }}` so users receive the sign-in code. Email verification and authentication are handled by Supabase, not homemade password storage.
5. Optionally enable Google in Supabase and configure its OAuth client in Google Cloud. Request only email/openid; review Google's actual returned identity data and notices. If Google is not configured, use email OTP.
6. Test real sign-in, reload, sign-out, account A/B isolation, OTP expiry and throttling, Google redirects, private save/restore, opt-in/out, export, and deletion in a staging project. The included PostgreSQL tests validate database policy/function behavior; they do not substitute for live email/OAuth or provider configuration tests.

Accounts are presented as adults/parents only; children can learn as guests with a parent. A checkbox is a declaration, not verified age assurance or a complete child-consent system. Do not market or enable child account registration without a legally reviewed parental consent and age-appropriate design process. This is a significant product/deployment constraint, not a claim of universal compliance.

## Account data and boundaries

Guest keys stay unchanged. Authenticated profiles use `ayah-user:<authenticated UUID>:` namespaced keys. A verified account is selected before constructing stores; switching identity reloads the app so a previous account's in-memory state cannot leak into the next account. Supabase tokens use localStorage (persistent until sign-out/expiry/revocation), not handwritten auth logic. No secrets are embedded. Browser storage is not encrypted; someone with access to the browser/devtools can read local site data. Shared-device users should back up, sign out, and clear site data.

Guest progress is **not automatically uploaded or claimed** by a signed-in user. The copy action is explicit and only available for accounts without recorded progress. Manual cloud backups remain available. Optional automatic sync is off by default and uploads changes only after the learner enables it. Login restores the private cloud copy on empty or unchanged devices. Diverging copies require an explicit choice; no automatic history merging is performed. Restore warns before replacing local account data. Export downloads that account's local progress, goals, and activity; no microphone blobs are included. Versioned saves reject stale-device writes. Explicitly replacing the cloud copy requires a conflict warning and confirmation.

Authentication providers process email, sign-in/security logs and any provider identity data. Supabase privately stores only the snapshot explicitly backed up or synced after opt-in, consent preferences, and weekly submitted aggregates. The application does not upload recordings, email addresses, or per-ayah details to the leaderboard. Progress and goals may reveal religious practice and require appropriate sensitive-data protections under applicable law. Consent to public ranking is separate from sign-in and off by default.

Only aliases and capped aggregate XP, stars, and independent recall-attempt counts are returned publicly. Scores are self-reported browser histories, not trusted anti-cheat evidence or automatic speech verification. Limits apply on the server: 1000 XP, 50 stars, 50 independent attempts per UTC day; 7000/350/350 per week. Resubmitting replaces a user's current week instead of adding points. Opt-out removes all their ranking rows and public alias immediately. No ayah counts are labeled verified memorization.

Delete my account invokes an authenticated function restricted to `auth.uid()` and cascades private backups/preferences/rankings. It then clears that account's local records on the current browser. Browser data on other devices and provider backup retention need separate handling. Supabase/Google security logs and backup retention are governed by their documented services; do not promise instantaneous deletion of those.

## Required before public registration

The app is **not certified compliant with every privacy law**. The operator must determine applicable laws (including GDPR/UK GDPR, regional privacy rules, and child privacy rules where relevant), document lawful bases and sensitive-data consent requirements, and provide a reviewed privacy notice, controller identity, privacy contact, retention periods, access/deletion process, processor agreements, breach response, appropriate security controls, and cross-border transfer arrangements. Replace the generic in-app notice with operator-specific information before enabling real accounts. No advertising analytics are included.

Run a retention task, for example with Supabase Cron, deleting `public.weekly_activity` rows where `week_start < (current_date - interval '90 days')::date`. Describe and enforce the chosen private-backup inactivity retention as well; deletion should include expired auth accounts only under the published policy. Audit logs/backups need their own retention review. This repository cannot configure hosted cron, email, OAuth, agreements or legal notices without a real project and operator details.

## Billing data and account closure

Subscriptions use Stripe-hosted Checkout and Customer Portal; the app does not collect card numbers. Stripe receives payment/customer information, while Supabase stores per-account customer/subscription IDs, plan/status, paid access dates and minimal webhook receipts. Saved passage references are private account data. No recordings are uploaded by billing. Cancellation or subscription expiry never deletes learning progress. Account deletion is blocked while billing is unclosed, including pending checkouts; the owner must cancel and close billing through the verified flow first to prevent orphaned recurring charges. Stripe can retain invoice/payment records under its legal obligations even after customer closure. The operator must update the published privacy/retention/support policy and Stripe terms for the actual deployment; this is not a legal compliance certification. See [billing documentation](billing.md).

## Optional experimental adult AI pilot

Local recording remains the default. Explicitly approved adult accounts can opt in per recording to server-mediated OpenAI transcription; child uploads are unsupported. No app-side audio/transcript storage is added. Private model/evaluation metadata, usage ledgers and optional feedback categories are separate from learning history and leaderboards. The AI panel can delete analysis metadata; account deletion cascades AI records. Provider processing/retention needs separate operator review and cannot be reversed by local deletion. See [experimental comparison privacy and deployment requirements](experimental-recitation.md).
