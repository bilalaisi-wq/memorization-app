# Phase 7 — native mobile experience

Status: implementation is present; **native compilation and physical-device acceptance are still release gates**. Browser/native-bridge simulation is never reported as an iPhone, iPad, VoiceOver or TalkBack pass.

## Feature inventory

| Requirement | Implementation | Verification boundary |
|---|---|---|
| Due-review notifications | `src/native/reminders.js`: existing saved review dates, generic text, up to seven inexact reminders, one per local day, overnight/day quiet-hour handling | Unit/bridge tests; real OS delivery, reboot, timezone and battery restrictions pending |
| Permission and account scope | Explicit reminder opt-in, permission only on Save; account-change cancellation and scope/revision guards | Automated permission and owner-change tests |
| Downloads | Existing IndexedDB Download Manager exposed in native settings; bundled frontend and existing free content retained | Existing offline tests; physical airplane-mode/low-storage checks pending |
| Microphone | Existing `getUserMedia` / MediaRecorder flow requests access only on recording; stream/URLs released on exit; no default upload | Fake-device browser recording tests; real codec/permission/headset checks pending |
| Audio interruptions | Local `AyahAudioFocus` plugin: Android focus loss/headset disconnect, iOS AVAudioSession interruption/route loss; JS pauses study/media; learner explicitly replays | Injected interruption/lifecycle tests; native code has not compiled in this environment |
| Secure credentials | Native-only OS secure-storage adapter for Supabase sessions/PKCE; verified copy-before-removal migration | Migration/failure and signed-in bridge tests; OS Keychain/Keystore tests pending |
| Haptics | Optional, throttled native success feedback; respects existing effects/system reduced motion; suppressed while study audio/recording is busy | Native calls simulated; actual vibration pending |
| Sharing | Public app link plus a preview-and-share whitelist of earned First steps, Recall explorer and A week of practice messages | No account IDs, names, passage refs, private counts, recordings or arbitrary ledger messages enter the share payload |
| Android Back | Hides keyboard first, then closes active dialog/menu, then existing study navigation, then asks before exit | Bridge tests; physical gesture testing pending |
| Layout/accessibility | Native safe areas, 44px minimum buttons, visible focus, responsive/tablet layouts, existing labelled Arabic/touch/keyboard alternatives and system reduced motion | 390px/tablet screenshots inspected; VoiceOver/TalkBack and OS text scaling pending |
| Connectivity/version | Native Network status, app version/build, update-ready status and settings | Bridge tests |
| Updates | Signed Capgo integration is prepared and defaults off; download does not reload an active lesson; explicit safe application; readiness watchdog | API mocks only; account/onboarding/signature/rollback tests on devices pending |
| Lifecycle | Existing study-overlay pause/disposal plus frame-queue suspension for Space, Serpent, Sirat and Bubble while hidden/backgrounded | Queue lifecycle unit test and game regressions; physical background/audio checks pending |

No SQL migration is required. Native plugins and local bridge code require **new native binaries**, not an OTA-only web update.

## Storage and privacy

Only the Supabase session and PKCE verifier move to OS secure storage. Each legacy copy is removed only after secure write/read verification. Failed writes retain the original. Conflicting copies are retained for recovery instead of guessing account ownership. Native auth does not fall back to plaintext if secure storage fails. iOS uses non-synchronizing `whenUnlockedThisDeviceOnly`; Android uses the secure-storage plugin's platform storage. Existing learning keys/history remain unchanged. The offline remembered profile remains only a namespace, never authentication or a premium entitlement.

Mobile preferences are account-scoped and included in existing device export. They do not invent review records or call FSRS. Notifications contain generic text and no selected passages/account details. Quiet hours govern requested schedule times; OS inexact delivery may be delayed. Sign-out/account changes cancel the app's reminder IDs; a replacement scheduling pass uses only the new scope. Recordings remain in the existing tab-local memory by default. Explicit AI submission retains the existing consent and entitlement controls.

Sharing requires an explicit selection and preview. Curated achievement messages are public product copy, not a claim of certified memorization. Private backup export is a separate, intentional action. Existing deletion/export/sign-out controls remain available through My account; native billing links remain gated under existing store-policy rules.

## Automated evidence

Test output is recorded during implementation in `/tmp/ayah-phase7-full-suite-final.log`, `/tmp/ayah-phase7-build-final.log`, `/tmp/ayah-phase7-sync-final.log` and `/tmp/ayah-phase7-bundle-final.log`. Final counts are appended after completion. Native-specific coverage is in `tests/native-contract.spec.js`, `tests/native-mobile-features.spec.js`, `tests/native-ui.spec.js` and the reusable native bridge fixture. These simulate APIs; they are not native SDK or hardware results.

Screenshots inspected: `/workspace/artifacts/native-phase7-390px.png` and `/workspace/artifacts/native-phase7-tablet.png`. The 390px settings dialog scrolls internally; its controls remain keyboard reachable. Device screen readers still require manual testing.

## Device report

| Target | Build/install | Device/OS | Result |
|---|---|---|---|
| Physical iPhone | Not performed | Not available | Pending |
| Physical Android | Not performed | Not available | Pending |
| iPad/tablet hardware | Not performed | Not available | Pending |
| Android SDK compilation | Preflight attempted | JDK 21 present; SDK 36 absent | Blocked before Gradle compilation |
| iOS SDK compilation | Preflight attempted | Linux; no macOS/Xcode | Blocked before compilation |

For each physical device record model, OS, app build/version and tester. Exercise login/code/Google callback, secure-storage migration and relaunch, account switch/sign-out/delete/export, real microphone grant/deny/revoke, incoming call, navigation audio/headset disconnect, quiet hours, offline downloads and interrupted sync. Verify no automatic recitation restarts and no microphone capture after exit/background.

Game checklist: Blocks touch/rotation; Space tractor beam; Serpent movement/boost; Maze navigation/doors; Bubble aiming; Sirat two-thumb controls; Bridge connectors; Defense blaster/tractor tools; Link drag/click/keyboard; developer-only QUR'AN CHRONICLES movement/Knowledge Constellation using approved/test-fixture content. Verify pause/resume, large Arabic, landscape, notch/gesture safe areas, text scaling, VoiceOver/TalkBack and reduced motion. Existing public/developer/entitlement restrictions must remain intact.

## Operator steps

1. On your checkout run `npm.cmd ci` then `npm.cmd run native:sync` (PowerShell uses `.cmd`; macOS uses `npm`).
2. Android: install Android Studio, SDK/build tools 36 and JDK 21; set `ANDROID_HOME`. Run `npm.cmd run native:android:debug`, open `android/` in Android Studio, install on a physical Android and complete the checklist. Configure your own release keystore before `native:android:release`.
3. iOS: use macOS with currently compliant Xcode 26+/iOS SDK 26+, run `npm run native:sync`, open `ios/App/App.xcodeproj`, select your real team/signing and physical iPhone, then build/run. Archive/export requires your own provisioning and export options as described in README.md.
4. Configure real Supabase native redirects/verified links/CORS as documented in README.md and test with staging accounts.
5. Complete store privacy declarations, redistribution rights, purchase/sign-in policy requirements and device checks before submitting. Capgo Builder onboarding must continue through connected MCP when available; no successful Builder setup or Live Updates activation is asserted here.

## Changed modules

- `src/native/experience.js`, `reminders.js`, `sharing.js`: account-scoped settings, reminder scheduling, haptics, connectivity/version display and curated sharing.
- `src/native/credentials.js`, `src/learner/accounts.js`, `profile-storage.js`: secure session migration and exported device preferences without moving learning histories.
- `src/native/audio-focus.js`, `runtime.js`, Android `AyahAudioFocusPlugin.java`/MainActivity and iOS `AyahAudioFocusPlugin.swift`/bridge storyboard/project: native interruption events, headset handling, keyboard-first Back and lifecycle pause.
- `src/native/frames.js` and Space/Serpent/Sirat/Bubble UIs: disposable background frame queues.
- Native dependencies/configuration/generated plugin wiring, `src/main.js`, native CSS and encouragement events: feature integration, safe areas and optional feedback.
- Ayah Link UI/engine and shared `src/ui/answer-drag.js`: pointer/touch/native drag plus existing click/keyboard alternatives; abandoned drags do not cost strikes.
- Native tests/helper, mobile CI and release scripts/documentation: regression evidence and disabled-by-default signed-update preparation.

### Final automated results

- Full regression configuration: **994 passed, 4 skipped, 0 failed** in 12.5 minutes. The four skips are production-service-worker cases explicitly excluded from the development-server suite; they are run separately with `playwright.offline.config.js`.
- Production Vite build: passed.
- Capacitor synchronization: passed for Android and iOS, with all 11 installed plugins discovered. This is asset/plugin synchronization, not SDK compilation.
- Native bundle/configuration checks: passed.
- `git diff --check`: passed.
- Native compilation/physical-device checks remain blocked as listed above.

- Separate production/offline suite: **4 passed, 0 failed** in 8.4 seconds (`/tmp/ayah-phase7-offline-production.log`), including real service-worker airplane-mode reload, interrupted/retry-safe downloads, account-safe removal and unavailable IndexedDB fallback. All 998 collected cases passed across their applicable configurations.
