# Ayah Quest — Complete Qur'an Expansion and Mobile App Launch Plan

Codex implementation package · iOS App Store + Google Play · November 2026

My recommendation is to keep one Ayah Quest codebase and expand it in two directions: first, deliver all 30 juzʾ through your existing four labs; second, package that same application as genuine iOS and Android apps with mobile-specific features and compliant billing.

You do not need to rebuild Ayah Quest in Swift and Kotlin from scratch.

Complete Qur'an

30 juzʾ, 114 sūrahs, canonical text, translation, audio, and authorized study content.

iOS + Android

Native app packages built from the existing Vite project.

Protected progress

Maintain FSRS, learning records, accounts, entitlements and existing achievements.

All four labs

Memorization, Puzzle, Revision, and Qur'an Chronicles.

## 1. What I found in your current repository

The application has a substantial starting point. In addition to the features you listed, its repository already contains a private Qur'an content preparation workflow, source validation, entitlement-aware Edge Functions, and developer-only content previews.

The most significant findings are:

| Component                   | Current condition                                                             | Next action                                               |
| --------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Al-Fātiḥah + Juzʾ 30        | Existing public free library                                                  | Preserve                                                  |
| Juzʾ 29                     | Source-prepared developer-preview pipeline                                    | Validate, review and publish                              |
| Al-Aʿrāf (7)                | Developer-preview content                                                     | Preserve, validate and release according to juzʾ coverage |
| Al-Baqarah 2:255 and 2:282  | Long-āyah study pilots                                                        | Preserve                                                  |
| Juzʾ 1–28 overall           | Not yet fully delivered as public content                                     | Complete systematic import                                |
| Puzzle/Revision integration | Multiple working game engines, some free-content-specific adapters            | Extend safely                                             |
| Qur'an Chronicles           | Technical adventure/editorial pilot, no approved public religious lessons yet | Publish reviewed curriculum                               |
| Stripe                      | Implemented integration, live payment readiness unverified                    | Perform real staging validation                           |
| Native iOS/Android          | No Capacitor project or native build scripts in the checked `package.json`    | Add mobile packaging                                      |

Your prelaunch audit also flags actual Supabase authorization testing, hosted payments, privacy review, and physical-device testing as unresolved launch gates.

Do not instruct Codex to mark the complete Qur'an as available merely because a metadata entry or source file exists. Every juzʾ needs its full content, validation and release checks completed.

## 2. Recommended Qur'an expansion strategy

I would release content by juzʾ, but treat sūrahs and āyāt as the canonical content units.

This matters because juzʾ boundaries frequently occur inside sūrahs. For example, Juzʾ 1 includes part of Al-Baqarah, while the next juzʾ continues the same sūrah.

The importer should therefore avoid storing two incompatible copies of an āyah when working with neighboring juzʾ.

### Source coverage goal

Qur'an content coverage

Release objective

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

25

26

27

28

29

30

Free: Juzʾ 30

Developer-prepared: Juzʾ 29

Remaining content pipeline

Al-Fātiḥah is separately available for free. Existing individual pilots and Al-Aʿrāf are not represented as fully released juzʾ.

### Recommended order

| Release  | Juzʾ               | Why                                                   |
| -------- | ------------------ | ----------------------------------------------------- |
| Existing | 30                 | Keep completely free                                  |
| Batch 1  | 29                 | Already has a developer-preview preparation workflow  |
| Batch 2  | 28, 27, 26         | Logical continuation of late-Qur'an memorization      |
| Batch 3  | 25, 24, 23, 22, 21 | Expand longer sūrahs and cross-juzʾ support           |
| Batch 4  | 20–11              | Broaden complete-sūrah and full-passage coverage      |
| Batch 5  | 10–1               | Complete the remaining corpus and Al-Baqarah coverage |

This is a release sequence, not a requirement that the Qur'an be learned in reverse juzʾ order.

The application must allow learners to choose any authorized juzʾ, sūrah or contiguous āyah range.

### What each āyah needs

Every published āyah should have verified references and text, source word identities, a reviewed translation, permitted transliteration and word meanings, a working full-āyah recitation, and appropriate source/version metadata.

Optional word audio and phrase segmentation should be enabled only when valid corresponding assets and reviews exist.

If a licensed word-meaning resource is missing, the importer must not invent one.

## 3. Mobile app strategy: use Capacitor

For Ayah Quest, I recommend Capacitor.

Capacitor is specifically designed to take an existing web application and give it native iOS and Android projects, while retaining the web frontend. It supports adding native features through plugins.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://capacitorjs.com\&sz=32)

Capacitor Documentation



Your architecture would look like this:

One shared Vite application

All four labs · Qur'anic content · Games · FSRS · Supabase

iOS

Capacitor + Xcode + App Store

Android

Capacitor + Android Studio + Google Play

Shared Supabase backend

Auth · Content authorization · Sync · Subscription entitlements

### Native features worth including

These should be integrated into the existing app rather than creating separate mobile-only labs:

- Offline downloaded Qur'anic text and selected audio.
- Scheduled local murājaʿah reminders.
- Reliable microphone recording and playback.
- Background audio controls and interruption handling.
- Native share actions for achievements or learning summaries.
- Haptic feedback for puzzle interactions, with a disable option.
- Secure local storage for appropriate session credentials.
- Native subscription purchasing and restoration.
- Android back navigation, iPhone safe areas and tablet layouts.

The app should remain useful offline, with guest study and downloaded free material, even if Supabase is temporarily unreachable.

### Three current store requirements that matter

Apple App Store

Apple's current minimum upload requirement is Xcode 26 with the iOS 26 SDK or later. Apple also requires apps to provide more functionality than a merely repackaged website. Ayah Quest's interactive games, offline study and native mobile integrations are particularly important here.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.apple.com\&sz=32)

Apple Developer+1



Google Play

New standard Android apps submitted since August 31, 2026, must target Android 16 / API 36 or later. New personal developer accounts created after November 13, 2023 also generally need a closed test with at least 12 testers continuously opted in for 14 days before applying for production access.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.android.com\&sz=32)

developer.android.com+1



Mobile subscriptions

The current Stripe integration should remain available for the website, but it cannot simply be copied into mobile checkout screens. Apple and Google have their own digital-purchase rules, with regional exceptions and special programs. The safest initial architecture is StoreKit and Google Play Billing for in-app purchases, with Stripe retained for web purchases and a unified server entitlement system.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.apple.com\&sz=32)

Apple Developer+1



# 4. Codex implementation sequence

I recommend these ten phases, with the content expansion and native-mobile work developed on independent branches where practical.

01

Full Qur'an library audit and content manifest

02

Generalize the content importer and validator

03

Import, validate and stage the remaining juzʾ

04

Enable all labs for authorized full-Qur'an content

05

Complete reading/audio, offline and progress systems

06

Create native iOS and Android projects

07

Integrate native features and mobile UX

08

Implement native billing and subscription reconciliation

09

Complete launch-critical features and privacy

10

Build, beta-test and prepare store submissions

Send the following prompts to Codex in order, reviewing each phase before merging. Each prompt requires working code and tests, not merely an implementation proposal.

# Phase 1 — Full Qur'an library audit and manifest

# CODEX — AYAH QUEST FULL-QUR'AN EXPANSION

## PHASE 1: AUDIT AND BUILD THE CANONICAL CONTENT MANIFEST

Repository: bilalaisi-wq/memorization-app

### Objective

Prepare Ayah Quest to support the complete Qur'an: 114 surahs, all 30 juz, all canonical ayah references in the selected Hafs numbering/source edition.

Preserve the existing free Al-Fatihah and Juz Amma library, existing progress, all game engines, and existing premium/developer-preview assets.

Do not import content or change premium availability before the audit is complete.

### Inspect

- src/data.js
- src/content/library.js
- scripts/prepare-quran-content.py
- scripts/validate-private-juz.mjs
- docs/juz-29-setup.md
- docs/developer-library-preview\.md
- supabase/functions/quran-content/
- supabase/functions/\_shared/content-policy.js
- supabase/functions/\_shared/segmentation.js
- existing Quran source registries and migrations
- audio source and licensing documentation

### Tasks

1. Create a machine-readable canonical manifest for all 114 surahs and 30 juz.
2. Represent juz boundaries at exact ayah references, including mid-surah boundaries.
3. Use the project's verified source edition and riwayah consistently.
4. Audit which ayahs already exist publicly, privately or in developer preview.
5. Detect overlapping imports and inconsistent hashes.
6. Inventory Arabic source text, translation, transliteration, word meanings, recitation audio and optional word audio.
7. Record source provider, edition, rights/attribution, version, checksum and review status.
8. Identify missing assets and unavailable licenses explicitly.
9. Produce a release-status report for each juz.
10. Preserve existing developer-preview and private-content fingerprints.

### Non-negotiable

Do not reconstruct the Qur'an using an LLM.

Do not invent translations, word meanings, audio recordings or verse boundaries.

Do not equate verified source text with scholarly approval of recitation stops.

Do not expose premium assets in Vite's public directory.

Do not change the free Juz Amma data or existing progress IDs.

### Deliverables

- Complete coverage manifest
- Per-juz audit report
- Missing-content report
- License/provenance report
- No-data-loss tests
- Passing existing build and test suite

The audit must distinguish 'cataloged', 'downloaded', 'validated', 'reviewed', 'deployed' and 'publicly available'.

# Phase 2 — Reusable full-Qur'an importer

# CODEX — AYAH QUEST FULL-QUR'AN EXPANSION

## PHASE 2: GENERALIZE THE QUR'AN IMPORT PIPELINE

### Objective

Extend the existing Juz 29/private-content preparation workflow so the application can securely prepare any selected juz, surah or contiguous range.

Do not build a new competing Qur'an content system.

### Tasks

1. Generalize existing preparation scripts to accept:\
   \--juz N\
   \--surahs IDs\
   \--range SURAH:START-SURAH\
   \--all
2. Fetch only from approved, documented source providers.
3. Preserve exact canonical Uthmanic text, diacritics, verse metadata and displayed punctuation.
4. Verify every ayah reference and juz membership against an independent source manifest.
5. Prepare:
   - Arabic text
   - selected licensed translation
   - licensed transliteration
   - licensed word meanings
   - full-ayah recitation audio
   - available source-verified word audio
6. Record asset SHA-256 and content-source metadata.
7. Validate word alignment and full-ayah audio coverage.
8. Detect duplicate assets and mismatched source versions.
9. Support resumable imports and bounded concurrency.
10. Keep all protected content outside the public Vite bundle.
11. Generate upload manifests and idempotent Supabase deployment procedures.
12. Add dry-run, validation-only and recovery modes.

### Safety requirements

Never overwrite an existing validated asset without an explicit source-version migration.

Never fabricate missing word meanings.

If required licensed content is unavailable, fail that release gate with an actionable missing-assets report.

Keep service-role credentials entirely server-side or in secure operator environments.

### Tests

Cover all 30 juz boundaries, mid-surah transitions, source mismatches, repeated Arabic words, missing recordings, malformed imports, interrupted uploads, idempotent reruns and legacy data compatibility.

### Deliverables

A working reusable importer, independent validator, deployment manifest, source-provenance documentation and comprehensive tests.

# Phase 3 — Complete all 30 juz

# CODEX — AYAH QUEST FULL-QUR'AN EXPANSION

## PHASE 3: PREPARE, VALIDATE AND STAGE THE REMAINING QUR'AN

### Objective

Use the new importer to prepare all missing Qur'anic content, completing coverage of all 30 juz and 114 surahs.

Continue to preserve free Al-Fatihah and Juz Amma.

### Release order

Batch A: Finalize Juz 29.\
Batch B: Juz 28, 27 and 26.\
Batch C: Juz 25 through 21.\
Batch D: Juz 20 through 11.\
Batch E: Juz 10 through 1.

Preserve previously validated Al-A'raf, Al-Baqarah pilot and developer-preview assets when their source hashes remain valid.

### Per-juz workflow

For EACH juz:

1. Read its exact canonical first and last ayah references.
2. Prepare all missing source assets.
3. Verify text, translations, word metadata and audio.
4. Run independent checksum and coverage validation.
5. Generate a content-provenance report.
6. Verify commercial-use rights and attribution.
7. Confirm required source-review status.
8. Prepare private Supabase Storage assets.
9. Apply any required additive migrations in staging.
10. Deploy to staging through authorized Edge Functions.
11. Verify direct and unauthorized content requests.
12. Test on desktop and mobile.
13. Publish only after the required gates pass.
14. Record the released source revision and any outstanding limitations.

### Coverage checks

The content catalog must cover exactly 114 distinct surahs and all 30 juz.

Count canonical ayah references using the project's chosen numbering system and verify the expected total; do not guess or silently adjust counts.

Ensure every juz contains the correct partial-surah boundaries.

Ensure a single ayah has one canonical ID even if multiple juz-based workflows refer to its surah.

### Automation

Create a scripted coverage audit that can report:

- Missing ayahs
- Duplicate ayahs
- Inconsistent word counts
- Missing translations
- Missing word meanings
- Missing audio
- Incomplete rights metadata
- Unvalidated source revisions
- Failed staged deployments

### Important

Do not mark the entire Qur'an live before all validations and deployments pass.

If a network operation or live deployment cannot be executed, stop at the verified local/staging state and report the exact operator action required.

Do not fabricate successful external uploads or source approvals.

### Deliverables

Validated per-juz manifests, staged content, test reports, deployment instructions and an accurate release-status dashboard.

# Phase 4 — Make every lab support the complete Qur'an

The most important objective is that a paid learner opening Sūrat Al-Baqarah should find the same Memorization, Puzzle, and Revision Labs as someone learning Al-Ikhlāṣ.

Only the selected content and the appropriate word-grouping behavior should change.

# CODEX — AYAH QUEST

## PHASE 4: FULL-QUR'AN INTEGRATION ACROSS ALL LABS

### Objective

Extend the existing shared PassageContext, source adapters and lab interfaces to support every published and authorized ayah.

Do not build a separate paid learning interface.

### Memorization Lab

Preserve Practice, Puzzle Quest, Active Recall and Ayah Chain.

Use existing adaptive grouping:

1–12 words: 1 word per tile.\
13–24: 2 words.\
25–36: 3 words.\
37+: up to 5 words.

Maximum 12 visible pieces per active workspace.

Support very long ayahs with multiple pages and cumulative reconstruction.

Preserve complete-ayah recitation and independent recall.

### Puzzle Lab

Support all seven existing engines using verified content adapters.

Each game must declare supported content types and length limits.

Use smaller bounded workspaces for long ayahs.

Bridge Builder should focus on actual adjacent-ayah transitions.

Do not create arbitrary phrase recitation stops.

### Revision Lab

Extend the currently free-content-specific Cosmic Rush architecture to use the shared authorized content loader.

Support:

- selected juz
- selected surah
- custom consecutive ayahs
- long-surah campaigns
- multi-juz revision plans where supported
- FSRS-aware review recommendations
- Ayah Link transitions across legitimate adjacent references

Break large missions into bounded, resumable stages.

### Qur'an Chronicles

Make the comprehension-content registry capable of recognizing all 114 surahs, but publish only lessons that have independently approved source material.

Do not interpret an imported Arabic ayah as proof that a tafsir lesson exists.

### Shared progress

All labs must preserve the same source IDs, learning history, account scope and content revisions.

Only authorized independent-recall assessments can change FSRS scheduling.

Comprehension and arcade results remain separate.

### Entitlements

Continue using existing server-authoritative checks.

New paid content must be available through the same lab navigation after authorization.

Existing free users must retain their current features.

### Tests

Test:

- Al-Fatihah
- Juz Amma
- Juz 29
- several early and middle juz
- short and long ayahs
- long chains
- mid-surah juz transitions
- repeated-word handling
- account switching
- free-versus-premium enforcement
- source-revision changes
- XP idempotency
- FSRS non-interference

### Definition of Done

A learner can choose any available authorized ayah from the completed catalog and access compatible activities in the same four labs, without separate premium-mode navigation.

Do not claim universal gameplay compatibility where a particular engine has a documented legitimate limitation.

# Phase 5 — Offline learning and mobile-ready data

This is one of the strongest additions I would make before submitting to mobile stores.

Users should be able to download a sūrah or juzʾ for offline memorization and revision.

# CODEX — AYAH QUEST

## PHASE 5: OFFLINE QUR'AN AND MOBILE DATA FOUNDATION

### Objective

Add a robust offline study system while preserving online Supabase synchronization, current guest progress and existing learning records.

### Features

1. Download a selected free surah or juz for offline access.
2. Show download size before downloading.
3. Allow users to select text only or text plus audio.
4. Display download progress, failed items and retry controls.
5. Add a Download Manager in Settings.
6. Allow users to remove local downloads.
7. Support offline free memorization and compatible puzzles.
8. Queue eligible progress changes for later synchronization.
9. Resolve sync conflicts without silently discarding progress.
10. Preserve existing FSRS schedules.
11. Keep microphone recordings device-local by default.
12. Clearly indicate which premium material requires online authorization.

### Storage design

Use IndexedDB or an appropriate native storage abstraction for source content and media.

Do not fill localStorage with audio files or complete Quran bundles.

Keep account-specific premium caches isolated.

Encrypt appropriately protected native data when required.

Do not assume offline premium rights remain valid indefinitely; define an explicit server-issued offline entitlement policy and expiration behavior.

### Audio

Reuse verified audio.

Support proper interruption, headset controls and resume where platform policies permit.

Never synthesize verse audio by stitching arbitrary unapproved fragments.

### Tests

Test interrupted downloads, low storage, airplane mode, changing accounts, offline guest sessions, queued progress, repeated synchronization, corrupt assets, source updates and entitlement expiry.

### Deliverables

Working Download Manager, offline content reader/practice, synchronization recovery, mobile-safe media storage and tests.

No old progress may be overwritten or lost.

# Phase 6 — Build the native mobile applications

## Capacitor installation approach

The existing repository has Vite 7 and no listed Capacitor dependency. Codex should add Capacitor without replacing Vite.

A typical setup begins with:

```
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/ios @capacitor/android

npx cap init
npm run build

npx cap add ios
npx cap add android

npx cap sync
```

The exact commands and compatible versions should be checked against the current Capacitor documentation and package requirements before execution.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://capacitorjs.com\&sz=32)

Capacitor Documentation



The website remains the source of truth for UI and game behavior. Native platform projects are maintained alongside it.

# CODEX — AYAH QUEST MOBILE

## PHASE 6: CREATE REAL iOS AND ANDROID APPS

### Objective

Convert the existing Vite Ayah Quest application into distributable native iOS and Android applications using Capacitor.

Keep the same frontend and Supabase backend.

Do not rewrite the app in Swift, Kotlin, React Native or Flutter.

### Audit

Inspect package.json, Vite configuration, routing, asset paths, Supabase auth callbacks, theme system, mobile UI, audio, microphone recording, service workers and installed plugins.

Use current supported Capacitor packages.

### Implementation

1. Add Capacitor Core, CLI, iOS and Android packages.
2. Create capacitor.config.ts.
3. Configure webDir for the current Vite output.
4. Use an operator-approved application name and permanent bundle/package identifiers.
5. Generate ios/ and android/ native projects.
6. Preserve the current website's build and deployment path.
7. Configure app icons and launch/splash assets.
8. Support iPhone, iPad and Android layouts.
9. Handle status bars, notches, safe areas and orientation appropriately.
10. Implement hardware-back behavior on Android.
11. Configure secure deep links and authentication return routes.
12. Ensure email-code sign-in and Google sign-in work in native apps.
13. Ensure authorized content and paid-user sessions work.
14. Test all four labs inside the native applications.
15. Ensure browser-only assumptions do not break inside the Capacitor WebView.

### Important

Do not load the production website as a bare remote WebView and call it a finished native app.

Bundle the actual frontend and integrate appropriate native features.

Keep authentication secrets out of the app bundle.

Do not include Supabase service-role credentials.

Do not change the existing source content or learning storage semantics.

### Build targets

iOS:\
Use a currently compliant Xcode/iOS SDK combination. For November 2026, Apple's published minimum is Xcode 26 with iOS 26 SDK or later.

Android:\
Target Android 16 / API level 36 or later, subject to current Google Play requirements.

### Native projects

Create reproducible development and release build scripts.

Document signing prerequisites without inventing credentials.

Do not commit signing keys, provisioning profiles containing secrets or keystore passwords.

### Validation

Build the Vite web application.

Synchronize native assets.

Run Android Gradle compilation when the necessary toolchain is available.

Build the iOS target on a properly configured macOS/Xcode environment.

Test at least one physical iPhone and one physical Android device before declaring mobile readiness.

### Deliverables

- Capacitor configuration
- ios/ native project
- android/ native project
- reproducible build instructions
- platform environment configuration
- mobile build/test documentation
- successful builds where the toolchains are actually available

# Phase 7 — Native mobile experience

# CODEX — AYAH QUEST MOBILE

## PHASE 7: NATIVE MOBILE FEATURES AND ACCESSIBILITY

### Objective

Make Ayah Quest feel like a high-quality mobile learning application, not simply a small-screen website.

### Implement

1. Native local notification scheduling for due reviews, with user permission and quiet-hour preferences.
2. Download Manager integration.
3. Microphone permissions and stable local recording.
4. Audio focus, interruption and playback recovery.
5. Secure storage of appropriate session credentials.
6. Optional haptic feedback for games and achievements.
7. Native sharing for approved non-private achievements.
8. Correct Android back gestures/buttons.
9. Safe-area-aware navigation and bottom controls.
10. Tablet responsive layouts.
11. System accessibility settings and screen-reader support.
12. System reduced motion and user-controlled effects.
13. Network/offline state display.
14. User-friendly app update and version information.
15. Native app lifecycle cleanup for physics loops and audio.

### Game-specific QA

Verify:

- Ayah Blocks touch/rotation
- Ayah Space tractor beam
- Ayah Serpent movement
- Memory Maze navigation
- Bubble Burst aiming
- Sirat Quest two-thumb controls
- Bridge Builder connectors
- Meteor Defense dual-tool controls
- Ayah Link drag-to-connect
- Qur'an Chronicles adventure and Knowledge Constellation

### Privacy

Microphone access must be requested only when recording is initiated.

Do not automatically upload recordings.

Local notifications should avoid displaying private account or memorization data unnecessarily.

Support account deletion, export and sign-out.

### Accessibility

Verify Arabic text legibility, VoiceOver, TalkBack, touch targets, zoom, screen-reader labels and accessible alternatives to drag operations.

### Deliverables

Working native mobile features and device test report.

Do not claim physical-device verification based solely on emulators or Playwright browser tests.

# Phase 8 — Native subscription billing

This is a release-critical phase because your existing Stripe setup does not automatically satisfy App Store and Play Store digital-purchase rules.

I recommend one subscription entitlement backend with multiple purchase providers:

| Platform                | Purchase system                                       |
| ----------------------- | ----------------------------------------------------- |
| Website                 | Existing Stripe Checkout and Customer Portal          |
| iPhone/iPad             | Apple StoreKit                                        |
| Google Play Android app | Google Play Billing                                   |
| Backend                 | Supabase entitlement reconciliation for all providers |

Users should be able to sign into their existing Ayah Quest account and receive the appropriate entitlements from verified purchases, without creating duplicate unrelated learning accounts.

Apple's multiplatform provisions allow access to purchases made on other platforms subject to its applicable purchasing rules. Google Play similarly has billing and alternative-billing programs that must be evaluated for your specific distribution and regions.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.apple.com\&sz=32)

Apple Developer+1



# CODEX — AYAH QUEST MOBILE

## PHASE 8: APPLE AND GOOGLE PLAY BILLING

### Objective

Integrate native in-app subscriptions without replacing the existing Stripe website billing system.

### Architecture

Web: Stripe\
iOS: StoreKit\
Android: Google Play Billing\
Backend: Supabase server-authoritative entitlement service

### Tasks

1. Audit existing plan IDs, prices and entitlement rules.
2. Design a platform-neutral internal subscription entitlement representation.
3. Create an iOS StoreKit purchasing adapter.
4. Create a Google Play Billing purchasing adapter.
5. Integrate native subscriptions with the existing account and entitlement UI.
6. Support purchase restoration.
7. Verify purchase transactions server-side.
8. Process App Store Server Notifications.
9. Process Google Play Real-time Developer Notifications where applicable.
10. Handle renewals, grace periods, billing failures, refunds, cancellations, revocations and expiration.
11. Prevent duplicate purchases and duplicate entitlement extensions.
12. Reconcile web and native entitlements under the correct authenticated user.
13. Ensure server-side content access uses only verified effective entitlements.
14. Show the appropriate subscription-management screen for the purchase provider.
15. Prevent accidental platform-inappropriate Stripe checkout inside mobile apps.

### Security

Never grant premium access solely because a client says a payment succeeded.

Verify transactions using official store services.

Persist transaction identifiers idempotently.

Protect webhook/server notification endpoints.

Do not embed Apple, Google or Stripe server credentials in the app.

Use appropriate product IDs and signed transaction validation.

### Regional compliance

Review current Apple and Google purchase policies for every intended storefront.

Implement permitted alternate purchase options only where an applicable program or policy authorizes them.

Do not assume US storefront rules apply globally.

### Subscription plans

Preserve current effective entitlements while adapting product presentation to each store.

Do not advertise unavailable juz, AI services or comprehension lessons as delivered premium features.

### Testing

Test:

- initial purchase
- restoration
- renewal
- canceled subscription
- expiration
- billing retry/grace period
- refund and revocation
- duplicate notifications
- account changes
- cross-device sign-in
- web/native account entitlement convergence
- offline behavior
- server-side content authorization
- failed payment
- sandbox/test purchases

### Deliverables

Native billing adapters, secure backend entitlement handling, provider-specific account management UI and test results.

Do not enable live mobile purchases before real Apple/Google sandbox testing and applicable store policy review.

# Phase 9 — Complete launch-critical features

Based on your feature inventory and prelaunch audit, I would explicitly include a launch-hardening stage before uploading anything to a store.

# CODEX — AYAH QUEST

## PHASE 9: PRELAUNCH FEATURE COMPLETION AND SAFETY

### Objective

Resolve the remaining launch-critical gaps while preserving existing free content and progress.

### Required audits and improvements

1. Verify every published ayah, translation, word meaning and audio source.
2. Complete missing Mastery Gallery artwork for the initial advertised content.
3. Remove or clearly label incomplete features from public navigation.
4. Keep Qur'an Chronicles preview-only until reviewed comprehension lessons are published.
5. Verify developer-only features cannot accidentally become learner-accessible.
6. Ensure all purchased features actually exist.
7. Complete account deletion and export flows.
8. Publish accurate privacy, data-retention and support information.
9. Review child/minor data requirements and family-related store policies.
10. Verify account isolation in a real staging Supabase project.
11. Validate subscription authorization and expiration.
12. Check current AI features for explicit consent and accurate limitations.
13. Validate mobile notification permission behavior.
14. Add appropriate offline error and retry handling.
15. Test mobile audio, microphone permissions and game controls.
16. Verify no premium content is bundled into public assets.
17. Confirm all source licenses and commercial-use permissions.
18. Add appropriate diagnostic logging without collecting raw recitations unnecessarily.
19. Test profile backup/recovery and restore.
20. Review store age ratings, data disclosures and account support paths.

### Release policy

Do not unlock an unfinished feature merely to fill the app menu.

Do not advertise spoken tajweed certification or AI assessment accuracy that has not been established.

Do not publish religious content without source and editorial review.

Do not enable paid features that rely on missing hosted configurations.

### Deliverables

A ranked launch-blocker list, fixes for code-level blockers, actual test evidence and a clear list of operator/legal/editorial actions still required.

# Phase 10 — App Store and Google Play release preparation

# CODEX — AYAH QUEST MOBILE

## PHASE 10: APP STORE AND GOOGLE PLAY RELEASE CANDIDATES

### Objective

Prepare genuine production release candidates for the Apple App Store and Google Play Store.

Do not claim that an app has been submitted, approved or published without actual store confirmation.

### Apple iOS tasks

1. Confirm the final bundle identifier.
2. Configure app version and build numbers.
3. Set up the native app icon and launch screen.
4. Verify supported devices and minimum OS.
5. Build using an SDK acceptable to App Store Connect.
6. Configure required signing and provisioning.
7. Produce an archive in Xcode.
8. Validate the archive.
9. Upload a build to App Store Connect using authorized developer credentials.
10. Configure TestFlight distribution.
11. Test real login, premium purchases and restoration.
12. Prepare screenshots for supported device classes.
13. Prepare store description, keywords, support URL and privacy policy URL.
14. Complete age rating and privacy disclosures.
15. Supply a review/demo account or fully functional demo mode.
16. Configure account deletion and subscription-management paths.
17. Submit only after review readiness is confirmed.

### Android tasks

1. Confirm permanent application ID.
2. Configure versionCode and versionName.
3. Target the current required Android API level.
4. Configure adaptive icons.
5. Set up secure Play App Signing and release signing.
6. Produce a release Android App Bundle (.aab).
7. Upload to a Play Console internal testing track.
8. Test real devices, login, billing and restore.
9. Complete Data Safety and account-deletion disclosures.
10. Complete target audience, content rating and privacy forms.
11. Prepare screenshots, short/full descriptions and feature graphic.
12. Conduct required closed testing for the account type.
13. Resolve pre-launch report findings.
14. Apply for production access where necessary.
15. Promote the release only after policy and functional checks pass.

### CI and versioning

Create repeatable release builds.

Run automated web and native checks before building.

Separate staging and production environment configuration.

Generate signed builds only in authorized environments.

Never commit passwords, keystores or provisioning secrets.

Maintain release notes and rollback instructions.

### Final acceptance

- Full free Qur'an content works.
- Advertised premium content works.
- All public labs launch successfully.
- Offline free study works.
- Account and entitlement security passes real staging tests.
- Purchases and restoration work.
- Recording and audio function on real devices.
- No critical crashes.
- No data loss.
- Store listing accurately describes functionality.

### Deliverables

iOS and Android release candidates, TestFlight/Play testing procedures, store metadata checklist, validation reports and precise remaining manual steps.

Where store credentials, signing access or physical devices are unavailable, clearly identify the blocker instead of reporting completion.

# 5. Additional features I recommend before launching

You already have plenty of games. I would prioritize reliability, learning continuity, offline access and a polished first-time experience rather than adding several more arcade modes.

Here are the features I believe would make the biggest difference.

## Highest-priority additions

1\. Download Qur'an for offline learning

Let learners download specific sūrahs or juzʾ, including selected recitations. This is particularly valuable for daily review, commuting and travel.

Priority: Essential for mobile

2\. Smart murājaʿah reminders

Give learners optional reminders based on their existing FSRS review schedule, with customizable timing and quiet hours. No new scheduler is necessary.

Priority: Essential for retention

3\. Complete cross-device continuation

Your core progress sync already exists, but several drafts, expedition records and inventories remain device-local. Allow a learner to begin on a laptop and continue on their phone without losing their place.

Priority: Very high

4\. Personalized memorization planner

Ask learners how much they want to memorize each week, then recommend a balance of new memorization and revision. The planner should adapt to their actual recall history rather than simply counting XP.

Priority: Very high

5\. Complete Qur'an reading mode

Provide a distraction-free Mushaf reading experience with bookmarks, juzʾ navigation, verse tapping, translation toggles, recitation replay and a quick button to practice the selected passage.

This lets the app function as a daily Qur'an companion, not only a collection of memorization games.

Priority: High

6\. Parent and student privacy controls

Because Ayah Quest appeals to children, review account age requirements, parental consent, leaderboards, profile images, voice recording and AI features. Build age-appropriate defaults rather than exposing minors to social features automatically.

Google Play has specific Families requirements when children are among the target audience.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://support.google.com\&sz=32)

Play Console Help



Priority: Launch-critical if targeting children

## Useful additions after initial launch

| Feature                               | Why it would improve Ayah Quest                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Teacher/parent dashboard              | Track assignments, actual review completion and weak transitions                 |
| Multiple reciters                     | Let learners practice with a preferred verified reciter                          |
| Adjustable recitation repetition      | Repeat selected āyāt without manually restarting playback                        |
| Memorization heatmap                  | Visualize reviewed material and specific difficult boundaries                    |
| Companion evolution                   | Give existing nature companions cosmetic progression tied to consistent learning |
| Arabic/English interface localization | Make the platform easier to adopt internationally                                |
| Reviewed Qur'an Chronicles lessons    | Add genuine comprehension value once editorial approval is complete              |
| Shareable achievements                | Encourage progress without exposing private learner information                  |

I would not make AI pronunciation grading, public competitive leaderboards for children, or a large companion marketplace prerequisites for the first mobile release.

# 6. A realistic launch strategy

You have two reasonable release options.

Option A — Launch the mobile app first

Recommended

Publish a polished mobile experience with free Al-Fātiḥah and Juzʾ 30, existing working labs, offline study, accounts and review scheduling.

Add the remaining juzʾ incrementally as verified content becomes available.

Premium purchasing should remain disabled until the actual subscribed offering is delivered and payment systems are validated.

Advantage: You can test the real mobile experience with learners without making full-Qur'an publication a dependency for the first launch.

Option B — Complete the Qur'an before launch

Prepare and validate every juzʾ, expand all relevant game content loaders, complete native subscriptions, and launch the website and mobile apps with the full catalog.

Advantage: A much stronger complete-Qur'an launch proposition.

Tradeoff: More content validation, licensing, hosting, quality assurance and billing work must pass before publication.

For Option A, the store descriptions must accurately say which juzʾ are presently available. Content planned for future releases must not be advertised as already unlocked.

## 7. Store-launch checklist

Ayah Quest release readiness

0/10 verified

All advertised Qur'anic content is deployed and validated

Free users retain Al-Fātiḥah and complete Juzʾ 30

Every public lab works on real iOS and Android devices

Offline downloads and recovery work correctly

Login, sign-out, deletion and account isolation pass

Native purchases and restoration are tested, if enabled

Privacy policy, support and data disclosures are complete

Children's privacy and age-rating review is complete

Store screenshots and descriptions are accurate

Release builds pass automated and manual testing

&#x20;Copy checklistThis checklist is for your own tracking; checking an item does not perform or certify its test.

## 8. What requires your direct involvement

Codex can implement the code, prepare native projects, run available automated tests and create release documentation.

Some steps need access to external accounts or a qualified reviewer:

| Requirement                                  | Where to complete it                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Apple Developer enrollment and signing       | [Apple Developer Program](https://developer.apple.com/programs/?utm_source=chatgpt.com) |
| App Store listing, TestFlight and submission | [App Store Connect](https://appstoreconnect.apple.com/?utm_source=chatgpt.com)          |
| Google Play developer account and releases   | [Google Play Console](https://play.google.com/console/?utm_source=chatgpt.com)          |
| Native Apple builds                          | macOS computer with Xcode                                                               |
| Android native builds                        | Android Studio and appropriate SDK                                                      |
| Real subscription testing                    | Store sandboxes and your Supabase staging environment                                   |
| Qur'anic source publication                  | Approved sources, usage rights and relevant scholarly review                            |
| Children's privacy and store disclosures     | Operator review and appropriate legal guidance                                          |

Also verify account deletion carefully: Google Play requires an in-app deletion path and an external web resource for deletion requests when the app supports account creation; Apple has its own in-app account-deletion requirements.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://support.google.com\&sz=32)

Play Console Help+1



## My recommended order for Codex

Start with Phases 1–4 to create a complete, verified and game-compatible Qur'an library. In parallel, develop Phases 6–7 on a separate mobile branch so that the native application can be tested using the existing free content.

Then complete the offline/sync work, native billing, hosted security checks and store submission gates.

The most important distinction is this: completing the Qur'an library, finishing the subscription system, and publishing a mobile app are three separate deliverables. Codex should verify each independently rather than reporting the entire project finished when only the code has been written.

With this approach, Ayah Quest can become a complete Qur'an memorization and revision platform available on the web, iPhone, iPad and Android—without sacrificing the working games, the free Juzʾ ʿAmma experience, or learners' existing memorization records.