# Activate Ayah accounts

The application is wired to the browser-public configuration for:

- Website: **https://ayah-a-day.up.railway.app/**
- Supabase: **https://ycgyuatjgdbhiakqourg.supabase.co**

`src/learner/account-config.js` contains the public project URL/key and Railway return URL. These are intended to be visible in browser code. No secret, service-role key or Google client secret belongs there. `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_AUTH_REDIRECT_URL` can override defaults for another deployment. Railway must rebuild/redeploy the GitHub commit before it serves this update.

## One-time steps in Supabase

The publishable key cannot perform database administration or configure OAuth providers. Complete these steps in your project dashboard:

1. Open [SQL Editor](https://supabase.com/dashboard/project/ycgyuatjgdbhiakqourg/sql/new). Paste and run the entire contents of [`supabase/SETUP_ACCOUNTS.sql`](../supabase/SETUP_ACCOUNTS.sql). This creates/updates private progress tables, account deletion, optional leaderboards, and versioned progress sync. It is safe to rerun and preserves existing learner rows. No manual disabling of row-level security is needed.
2. Open **Authentication → URL Configuration**. Set **Site URL** to `https://ayah-a-day.up.railway.app/`. Add that exact URL to **Redirect URLs**.
3. Under **Authentication → Sign In / Providers**, enable **Email** and allow new users to sign up. Configure production SMTP/delivery and rate limits. In **Email Templates → Magic Link**, include `{{ .Token }}` so the email contains the code the app requests. The same email OTP flow creates an account from **Create account**, or signs in an existing account from **Sign in**. No password is stored by the app.
4. For Google, create a **Web application** OAuth client in [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials). Configure the OAuth consent screen. Add the authorized origin `https://ayah-a-day.up.railway.app` and this exact authorized redirect URI:
   ```text
   https://ycgyuatjgdbhiakqourg.supabase.co/auth/v1/callback
   ```
   Copy that client's ID and secret **directly into Supabase → Authentication → Providers → Google** and enable Google. Do not put the secret in Railway's frontend variables, GitHub, or chat. If Google consent is in testing, add your own Google account as a test user, or publish the consent app as appropriate.
5. Deploy/redeploy the latest commit on Railway. Test creating a real adult account, receiving an email code, Google sign-in, closing/reopening the browser, and signing in separately on another device.

## Staying signed in and using multiple devices

Supabase sessions persist in **localStorage** and refresh through the maintained SDK until sign-out, expiry/revocation, or browser-data clearing. Each device signs in independently; tokens are not shared between devices. Existing valid tab-only sessions migrate to persistent storage. **Sign out on this device** leaves other devices signed in. **Sign out on all devices** revokes refresh sessions; an already-issued access token on another device may remain usable until it expires.

In **My account**, turn on **Automatically sync my learning progress across devices** on the devices you want to sync. It is optional and off by default. Private saved progress loads at login on an empty/new device, or when its local copy has not changed since the last cloud save. Guest progress remains separate and is only copied through the explicit copy action.

Autosync saves goals, puzzle progress, memory reviews, awards, and activity after changes. Recording blobs and success-audio uploads are not included. Two devices that change progress independently get a conflict rather than a silent overwrite. In My account, download your data if you want to keep both copies, then choose **Save private cloud backup** (keep device copy) or **Restore cloud backup** (keep cloud copy). Offline progress remains local until a successful save. Simultaneous live editing/automatic history merging is not supported.

## Verification limits

Automated tests exercise the real Supabase client against mocked provider responses, persistent sessions, OTP signup/sign-in errors, Google PKCE/redirect construction, token refresh, device sync and conflicts. PostgreSQL tests execute the complete setup script and verify owner isolation and atomic revision checks. These do not establish that hosted email delivery, Google credentials, or your project's dashboard settings work.

The cloud execution environment's proxy initially denied requests to the Supabase and Railway hosts. Their domains were added to the saved environment draft; review/save and **publish the environment settings** to apply that configuration before retrying live checks. Saving a draft alone does not enable current-instance networking.

See [privacy/deployment requirements](accounts-and-privacy.md) for adult/parent account restrictions, sensitive learning data, retention and operator-specific notices.
