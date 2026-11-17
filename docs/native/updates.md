# Website-linked mobile releases

Ayah A Day shares one frontend and Supabase backend. Every `main` push runs the browser regression suite and Vite build in `.github/workflows/mobile-updates.yml`. The validated frontend artifact is also the mobile update artifact. Railway remains manually deployed: this workflow does not change that setting or claim the website is already deployed.

## What is prepared

Capgo updater 8.54.2 and CLI 8.106.2 are pinned. Automatic checking is **off until configured**. Enabled binaries download signed/encrypted V2 updates in `onlyDownload` mode. Download completion never reloads a running lesson, recording or game. Mobile settings shows the ready update and lets the learner explicitly apply it after pausing study. Existing persisted drafts/history remain in their original stores; unsaved runs may restart under their existing recovery rules. There is no remote `server.url`.

`notifyAppReady` runs after application initialization. A broken frontend that never reaches readiness is subject to Capgo's native rollback watchdog (30 seconds). This is crash recovery, not evidence that gameplay or accessibility passed. Update statistics reporting is disabled (`statsUrl: ''`); Capgo still receives operational update requests/device identifiers, which must be included in the privacy disclosure.

Only the **public** verification key goes into the native configuration. Capgo's V2 private key authenticates/encrypts bundles and checksums. This does not conceal premium material from someone who has the app: premium text/audio must continue to load through authenticated backend entitlements and must never enter these bundles.

## First setup (operator)

1. Create a Capgo account and register **com.ayahaday.app**. Create the `mobile` channel; restrict it to compatible native versions/metadata and disable downgrade below the native bundle. Use separate test devices/channel or a separate staging app for initial verification. Do not enable production distribution yet.
2. In the checkout run `npm.cmd ci` (PowerShell), then `npx.cmd --no-install @capgo/cli key create --help` and `npx.cmd --no-install @capgo/cli key create`. Follow the pinned CLI instructions for a V2 keypair. Keep the private key in your password manager/CI secrets, outside the repo; do not send it in chat. Never commit `.capgo_key*`. Preserve the public key too; key rotation needs a new native binary.
3. Set environment variables **for native builds**: `AYAH_CAPGO_ENABLED=true`, `AYAH_CAPGO_PUBLIC_KEY` to the complete public PEM. Real new binaries must contain that same public key and updater plugin. Run `npm.cmd run native:sync`, then build/install using [README.md](README.md). A previous Phase 6 binary cannot gain this plugin or secure storage via JavaScript alone.
4. Device-test the new signed iOS and Android binaries, including secure-session migration, reminders, downloads, real microphone/audio interruptions, touch, VoiceOver/TalkBack, large text and reduced motion. Complete the store release prerequisites. No physical-device tests have been run in this workspace.
5. Only after verifying those binaries, set `AYAH_CONFIRM_NATIVE_RELEASE=yes` and the same `AYAH_CAPGO_PUBLIC_KEY`; run `npm.cmd run native:updates:record`. Commit the generated `native-release.json`. It contains a compatibility fingerprint and public-key hash, no private key. Never record a new baseline simply to bypass a blocked OTA release.
6. GitHub repository → **Settings → Environments → New environment → mobile-release**. Restrict deployment branches to `main`; add required reviewers for the first releases. Add environment secrets `CAPGO_API_KEY` (scoped to this app/channel), `CAPGO_PRIVATE_KEY` (complete private PEM), `AYAH_CAPGO_PUBLIC_KEY` (matching public PEM). Use a restricted API key, never Supabase/Stripe keys here.
7. GitHub **Settings → Secrets and variables → Actions → Variables**: set repository variable `AYAH_CAPGO_ENABLED=true`. A successful `main` workflow now sends the **same tested artifact** to the channel using `--key-v2`, delta transfer and `--fail-on-incompatible`. The private key is written only to a temporary restricted file and deleted afterward. CI version names use `1.0.<GitHub run number>`; rerunning an already uploaded version must not overwrite it—use a new workflow run/version.
8. Push a small CSS-only change, approve the environment deployment, and confirm download/apply on the physical staging devices. Verify invalid-signature rejection, offline retry, failed-readiness rollback and persistence before widening rollout. Upload/channel changes have not been executed from this workspace.

PowerShell environment example (public key only):

```powershell
$env:AYAH_CAPGO_ENABLED = "true"
$env:AYAH_CAPGO_PUBLIC_KEY = Get-Content -Raw C:\safe-location\capgo-public.pem
npm.cmd run native:sync
```

## Mobile accessibility is a release requirement

Shared website changes are reviewed for a native layout as well: safe areas, 44px-or-larger controls, Arabic/translation legibility, 390px phones, tablets, text zoom, reduced motion, focus after dialogs, touch alternatives to drag, keyboard operation and paused/background lifecycle. The CI suite includes native-bridge and mobile browser checks. Browser simulations do not replace VoiceOver, TalkBack, real audio permissions or physical-device verification. Test significant interaction changes on both platforms before promotion. Do not blindly copy desktop-only hover/precision controls into mobile.

## Native changes and rollback

`native:updates:check` hashes tracked native project files, Capacitor configuration and native dependency versions. Any change requires a store build and a new approved baseline. Changes to plugins, microphone/notification permissions, native code, SDKs, icons, signing, deep links or the verification key are not OTA updates. Keep old runtime releases on their compatible channel; when supporting multiple simultaneous native generations, create separate runtime channels/baselines rather than replacing the baseline for incompatible installed devices.

To halt releases, set repository variable `AYAH_CAPGO_ENABLED=false` and disable the channel in Capgo. To recover from a bad frontend, repoint the compatible channel to the last verified signed bundle and test rollback; the readiness watchdog can also roll back an unready launch. Never delete learner storage or FSRS records as a rollback technique. Store policies can limit permissible live-update changes; do not use OTA to bypass review or change the app's approved purpose.

## Current release gates

No Capgo account/API key/public key/native release baseline is present; no update was uploaded and no production channel was activated. Native SDK compilation, signed archives and physical-device tests remain operator actions. This is a prepared integration, not an assertion that installed apps are already updating.
