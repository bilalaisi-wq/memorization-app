# Ayah A Day — Capacitor iOS and Android

## Identity and architecture

Operator-approved display name: **Ayah A Day**. Approved permanent iOS bundle ID / Android application ID: **`com.ayahaday.app`**. Approval is not a store reservation: register these identifiers in your own Apple/Google accounts before release.

This is the existing Vite/vanilla-JavaScript app bundled from `dist`, with the same Supabase project and canonical content loaders. Neither project uses `server.url` or loads the Railway website as its application. The normal website commands (`npm run build`, `npm start`) remain intact. Native startup adds system-browser auth, app lifecycle/Back controls, safe areas, keyboard handling, launch artwork and explicit JSON export through the system share sheet. No second learning store, scheduler, premium catalog or frontend framework was introduced.

Capacitor Core/CLI/iOS/Android are pinned to **8.6.2** in the lockfile, with current compatible 8.x App, Browser, Filesystem, Keyboard, Share and Splash Screen plugins. System bar styling/insets use Capacitor 8 Core's `SystemBars`, avoiding a second status-bar implementation.

## Audit findings and resulting integration

- Vite emits `dist`; absolute `/assets`, `/audio` and `/fonts` paths resolve against the bundled local app origin. Private operator source directories remain excluded by the existing Vite policy.
- Navigation uses existing DOM/JavaScript state rather than a URL router. Android Back first closes the top dialog/menu, then returns to Memorization Lab, then asks before exiting. It does not navigate the WebView to an external page.
- Supabase already uses PKCE and persistent local sessions. Native Google uses `skipBrowserRedirect`, opens Supabase authorization in the OS browser and accepts an exact callback with a single authorization code. Existing email code input/verification remains. No access/refresh tokens are accepted from deep-link fragments. Backend `getUser()` verification and account-isolated storage remain authoritative.
- Web service workers are intentionally disabled in Capacitor. The frontend, fonts and existing free recitation are already shipped with the binary. Download Manager still provides verified managed copies using IndexedDB; it excludes web-shell download overhead in native builds. Removing a managed copy cannot remove signed bundled files.
- Theme changes update native system bars. CSS uses Capacitor's Android inset variables and WebKit safe-area values; portrait, landscape, iPhone and iPad are supported by project configuration. Minimum iOS deployment target is 16 for modern WebKit features; this is separate from the required **build SDK**.
- Microphone capture remains `getUserMedia`/`MediaRecorder` inside the WebView with explicit OS permission and existing consent/self-assessment. App backgrounding pauses games/media, releases recordings using existing cleanup, and invalidates private passage views for reauthorization. It never awards a grade.
- Detached JSON download anchors now use a native-only adapter and the OS share sheet. Temporary export files live in app cache and have cleanup attempted after the share operation; existing serialized data and browser downloads are unchanged. Raw microphone audio is not exported/uploaded by this adapter.
- Existing paid accounts retain server-authorized content. Native **new purchases and Stripe portal links are disabled** pending a store-specific purchase/payment policy implementation. Website billing remains unchanged. This is not an IAP implementation.

## Required operator setup — do this before real sign-in testing

### Supabase and Google

1. Keep the existing project URL and **public publishable key**. Never add service-role, Stripe secret, AI API or Google client-secret values to `VITE_*`, `capacitor.config.ts`, native sources or assets.
2. Supabase → Authentication → URL Configuration → Redirect URLs: add exactly **`com.ayahaday.app://auth/callback`**. Retain the existing Railway URL. If enabling verified HTTPS links, also allow **`https://ayah-a-day.up.railway.app/native/auth/callback`**.
3. Google remains a **Web OAuth client managed through Supabase**. Its authorized redirect URI remains **`https://ycgyuatjgdbhiakqourg.supabase.co/auth/v1/callback`**. Do not replace this Google-side URI with a custom mobile scheme. Enable the Google provider in Supabase, with credentials stored only there.
4. Email-code sign-in uses the existing adult/parent confirmation and OTP form. Configure email delivery/templates in Supabase; test both new-account and returning-account codes on each device. If providing a magic link, it must return the PKCE code to the allowed native callback.
5. Edge Functions already support `BILLING_ALLOWED_ORIGINS`. **Append** `capacitor://localhost,https://localhost` to its existing server-side value for the native WebView origins; retain existing web/staging origins and the web `BILLING_SITE_URL`. Do not use `*` or `null`. Content, AI and billing wrappers all reuse this setting. Allowing an origin does not authorize a user or plan; JWT, RLS, server entitlements and source/review checks remain mandatory. The new content policy test proves native preflight cannot bypass authentication.

These dashboard/secret configuration actions have not been performed from this workspace. No database migration or new service-role key is required.

### Verified HTTPS app links

The unique custom-scheme PKCE return works for development once allowlisted. iOS Associated Domains and Android auto-verified HTTPS intents are prepared for the real Railway origin and exact `/native/auth/callback` path, but **domain verification is not claimed until real association files are published**.

Set public signing identity metadata (not secrets):

- `AYAH_APPLE_TEAM_ID`: your actual 10-character Apple team/app identifier prefix.
- `AYAH_ANDROID_CERT_SHA256`: your actual colon-separated SHA-256 release app signing certificate fingerprint. For Play App Signing, use the **app signing** certificate, not just your upload key.

Run `npm run native:links`, then build/deploy the website. This writes `public/.well-known/apple-app-site-association` and `assetlinks.json` only when real-shaped inputs are supplied; generated files are ignored by Git. Validate actual values and ownership before publication. The existing static server serves AASA as JSON. Verify both HTTPS endpoints return their exact JSON without login, HTML fallback or redirects. Enable Associated Domains on the registered Apple App ID/provisioning profile. Debug custom-scheme sign-in does not require inventing production fingerprints.

## Local prerequisites

- Node **22+** (this workspace uses 24), npm and the committed lockfile.
- Android: Android Studio with SDK platform **36**, Build Tools 36.0.0 or a currently supported compatible version, Platform Tools, and **JDK 21**. Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`). Accept SDK licenses yourself with Android Studio/`sdkmanager --licenses`.
- iOS: a properly configured **macOS** machine, full **Xcode 26+ and iOS SDK 26+**, selected with `xcode-select`. Build scripts enforce the requested floors; check current Apple submission requirements before upload. Swift Package Manager resolves pinned Capacitor and plugin dependencies; CocoaPods is not used.
- Distribution: your own Apple Developer/App Store Connect and Google Play accounts, registered IDs, signing material and physical devices. No signing identity is fabricated or committed.

On Windows PowerShell with script execution disabled, use **`npm.cmd` / `npx.cmd`**, not `npm.ps1` or `npx.ps1`. Example SDK setting:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm.cmd ci
npm.cmd run native:doctor
npm.cmd run native:sync
npm.cmd run native:android:debug
npx.cmd cap open android
```

Use Terminal on macOS/Linux with `npm` / `npx` for equivalent commands. `native:sync` runs the existing production build, synchronizes both projects and checks that copied native assets match `dist`. Copied web bundles are ignored by Git; a fresh checkout must sync before building.

## Development builds

```sh
npm ci
npm run native:doctor
npm run native:sync
npm run native:android:debug
npm run native:ios:debug   # macOS only, unsigned simulator build
npx cap open android
npx cap open ios
```

After installing a debug build on an authorized emulator/device, `cd android` and run `./gradlew connectedDebugAndroidTest` (Windows: `gradlew.bat connectedDebugAndroidTest`) to check the installed package, bundled frontend and backup policy. This instrumented test has not run in the Linux workspace.

Android debug output: `android/app/build/outputs/apk/debug/app-debug.apk`. Install/run using Android Studio or `adb install -r` with an authorized connected device. iOS simulator builds use the shared `App` scheme. For a physical iPhone/iPad, open the Xcode project, select your real Team and device, resolve SPM, and use Run with valid provisioning. iOS min deployment 16 and Android min SDK 24 do not mean these OS versions have been physically tested.

Artwork is original local vector art in `assets/native/icon.svg`. `npm run native:icons` deterministically regenerates the PNG masters and native icon/splash sets. Review the displayed artwork/name before store submission. iOS's 1024px app icon has no alpha channel. No Qur'anic wording is used in the icon.

## Release builds and signing

Android: create/manage a keystore through Android Studio or your secure signing process **outside Git**. Supply secrets via your local secure environment/CI secret manager:

- `AYAH_ANDROID_KEYSTORE` — absolute path
- `AYAH_ANDROID_KEYSTORE_PASSWORD`
- `AYAH_ANDROID_KEY_ALIAS`
- `AYAH_ANDROID_KEY_PASSWORD`

Run `npm run native:android:release`. Missing credentials fail before producing a claimed signed release. Output: `android/app/build/outputs/bundle/release/app-release.aab`. Use Play App Signing and increment `versionCode` for every upload. Debug signing is not production signing.

iOS: configure the real Team, bundle ID capabilities, certificates/profiles and App Store Connect access in Xcode. Provide `AYAH_APPLE_TEAM_ID` and an operator-owned **`AYAH_IOS_EXPORT_OPTIONS`** plist path. Run `npm run native:ios:release` on macOS; it archives and exports under ignored `native-output/`. Keep passwords, `.p8`, `.p12`, profiles and keystores out of Git. `ExportOptions.local.plist`/signing paths are ignored. Increment `CURRENT_PROJECT_VERSION` before each upload.

The bundled existing free audio is approximately **182 MB** before packaging. Measure final APK/AAB/IPA and store delivery constraints on a real build; no artifact-size compliance is asserted without compiling it. Existing free content is not removed to shrink a demo.

## Data and website compatibility

Native WebViews have their own origin/app container; Safari/Chrome website guest storage is not silently copied. To carry progress, sign into the website, save the existing private cloud backup (and separate passage/Cosmic sync where applicable), then sign into the same account in the app. Preserve browser data and use existing recovery/export controls for records that are device-only. App updates keep the same IDs/origins and storage keys. Uninstall/site-data clearing can remove local data, as expected; this work never resets records.

Android backup is disabled to avoid automatically copying sessions/private app data to generic device backups. No premium offline cache/license is introduced. Existing premium fetches are authenticated and rechecked after background/resume. No new custom native at-rest encryption or Keychain migration is claimed; the app retains the existing WebView storage semantics and OS sandbox. Native protected offline content would need a separately audited storage/license design.

## Submission and physical-device release gates

This repository is **not mobile-ready/production-certified** until these checks pass:

- Compile Android with the required SDK and iOS on the required macOS/Xcode environment, then install on **at least one physical iPhone and one physical Android**. Include an iPad layout check and landscape/notch/gesture navigation.
- Test email signup/code login, Google system-browser login, cancelled/expired callback, cold-start return, relaunch, sign-out, account switching and paid entitlement downgrade with real Supabase staging accounts. Verify HTTPS associations and no private source caching.
- Test Practice/Quest/independent recall/Chain, the existing Puzzle games, Revision/Cosmic gameplay and the **developer-only** QUR'AN CHRONICLES preview with genuinely approved content. Do not publish unreviewed lessons or expose the preview to learners to satisfy a screenshot.
- Test microphone permission grant/deny/revoke, actual recorded playback, reciter comparison, interruptions/headsets, background/resume, lock screen and no microphone continuing after exit. Audio/recognition never certify Tajweed or automatically submit FSRS grades.
- Test Android Back with dialogs/keyboard/game/root, touch controls, text zoom, screen readers, reduced motion and safe areas. Test native JSON export/share/cancel, offline cold launch and retained account progress after update.
- Confirm existing text, font, translation and recitation redistribution/attribution rights for native packaging; website availability is not itself proof of native distribution permission.
- Complete App Store privacy labels and Play Data Safety based on actual email, optional private photo/progress and explicitly consented AI audio processing. The included required-reason API manifest is not a complete privacy/legal attestation.
- Review Apple sign-in equivalence requirements if offering Google, and the applicable store digital-purchase/account-deletion rules (including actively billed accounts). Native IAP/Apple Sign In are not implemented here; payment links are gated rather than presumed store-compliant. Existing paid access works through server entitlements after setup.

Physical checks, live OAuth/CORS setup, store review/signing and real-device builds have not been completed in the Linux workspace. See `validation.md` for measured evidence.
