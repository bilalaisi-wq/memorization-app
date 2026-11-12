# Offline Qur'an and mobile data foundation

## Learner workflow

Open **Menu → Downloads & offline settings**. Choose Al-Fatihah, one Juz Amma surah, or all of Juz Amma. Choose text only or text plus the existing verified full-ayah and word recordings. **Check download size** shows content bytes and the offline app-shell overhead before any download begins. Download validates each asset and reports progress, failed items and a resumable Update / retry action. Pause safely stops after the current bounded request. Remove deletes the selected source/media package, retaining assets still referenced by another package and leaving learning records untouched.

After a completed download, the normal free Memorization Lab and compatible visual puzzles work without a connection. The Download Manager includes a simple offline reader, translation, available transliteration, previous/next ayah navigation and full-ayah playback. Text-only means no promised offline audio. A puzzle's distractor from another surah may lack audio unless that surah is also downloaded; download Juz Amma for broad free coverage. No arbitrary phrase recording is synthesized, cropped or stitched.

Audio uses browser controls, volume, pause/seek and Media Session play/pause/stop/seek commands where supported. Changing the reader's ayah, closing it or changing accounts stops the reader audio and releases its object URL. Headset/background behavior remains subject to browser/OS policy. Nothing in offline study certifies recitation or changes a grade automatically.

## Storage and source integrity

- IndexedDB `ayah-free-offline-v1`, schema 1: `packages`, `texts`, `assets`. Text bundles and MP3 blobs are never placed in localStorage.
- Only Al-Fatihah and surahs 78–114 are accepted. Free canonical bundles come from the same existing `localBundle` source; the code does not import or regenerate Qur'anic Arabic.
- The Vite plugin writes `offline-manifest.json` with exact free reference metadata, SHA-256 and byte sizes of existing MP3 files, canonical text bundles and public app-shell files. It rehashes final emitted files in `writeBundle`, after Vite's dynamic import/preload transformation. Protected operator directories continue to be denied by the existing Vite plugin.
- Each text bundle is matched against its manifest hash and canonical source revision. Every media download checks both bytes and SHA-256 before committing. Stored media is rehashed before reuse; corrupt assets can be replaced on retry. Corrupt text is rejected and preserved until an explicit update/removal.
- Downloads use one bounded audio request at a time, a 45-second request timeout and valid-item reuse across retries. Size checks use Storage Estimate when supported; actual write failures still handle exhausted quota. A package is marked ready only after its requested items succeed.
- Service worker `/ayah-offline-sw.js` installs without secretly downloading the app. Only an explicit download prepares a complete hash-validated public shell. A new shell becomes active only after all files validate; a failed update leaves the previous usable shell available.
- The worker never caches Supabase, authentication, Stripe, private content endpoints, bearer-authorized requests or recordings. It serves only explicitly stored free MP3 paths from IndexedDB, including valid byte-range requests needed by mobile media players. App-shell requests are network-first, with an offline fallback to the validated public build.
- Source text/audio selection is immutable with respect to learning history. No FSRS API or parameters were changed.

## Accounts, progress and synchronization

Free downloads are device-wide public material and intentionally reusable by guest and signed-in profiles. They contain no private profile data. Existing progress remains in its original account-scoped stores. Guest progress is never silently copied into an account.

`CloudProgress` reuses `learner_progress`, existing revision compare-and-set writes and the established export/recovery process. Optional `pendingSync` and `needsRefresh` booleans extend the existing `ayah-cloud-sync-v1` metadata compatibly. An explicitly offline boot preserves the last base/revision rather than falsely declaring a conflict. Opted-in changes remain durably in the original local records and are marked pending. Reconnection checks the remote revision before retrying. Two devices with changed copies require a learner choice in My Account; neither copy is silently merged or discarded. Successful repeated initialization does not duplicate history. Disabled automatic sync still requires a manual save; this feature does not bypass consent.

No queue includes microphone recordings. Existing recordings remain tab/device-local according to the recording interface; offline downloads do not upload or persist them. Existing Cosmic/passage sync uses its own established account controls rather than a second scheduler or newly invented all-progress sync.

## Premium policy and native boundaries

**No offline premium license is issued in this phase.** Premium text/audio and comprehension materials require the existing online authenticated server authorization, including when returning from an offline session. The offline database rejects premium references. Thus there is no perpetual locally inferred premium entitlement, and no premium cache that could leak across accounts or survive a subscription downgrade. A future premium offline release must first implement signed, server-issued owner/device/source-scoped licenses, expiration/revocation behavior and an audited native encrypted-storage strategy. A client subscription flag is insufficient.

This is a browser/PWA foundation, not an App Store/Play Store binary or a claim of native at-rest encryption. Browser IndexedDB and caches are origin-scoped and may be evicted by the browser, private browsing or device cleanup. Keep account backups or exported progress where desired. App-shell storage is retained for offline startup even after removing content packages; clearing the site's browser data removes it, along with other device data.

## Deployment

No Supabase migration or new secret is required. Deploy the normal `npm run build` output using the existing static server. The build must include `offline-manifest.json` and the public worker. HTTPS (or localhost in QA), Service Workers, Cache Storage and IndexedDB are required for offline reload. Existing private content/billing RLS rules are unchanged.

Check that `/offline-manifest.json` returns JSON, `/ayah-offline-sw.js` returns JavaScript and the worker scope is `/`. Never configure a CDN rule to cache authenticated function responses. Native packaging should retain equivalent origin isolation and evaluate storage/media policies separately.

## Verification

- `node --test scripts/offline-manifest.test.mjs`: source/free-only allowlist, exact size planning, all 571 free ayahs, missing audio, source mismatch and low-space rejection.
- `node --test scripts/offline-sync.test.mjs`: durable offline queue across reload, reconnect through existing CAS, repeated sync without duplicate history, explicit two-device conflict, disabled-sync consent.
- `npx playwright test --config=playwright.offline-model.config.js --workers=1`: real IndexedDB interruption/resume, corrupted MP3 retry, overlap-safe removal, immutable original learning history, corrupt text preservation and account isolation. Uses a separate 5186 server with service workers blocked.
- `npm run build`, then `npx playwright test --config=playwright.offline.config.js --workers=1`: production 5185 server, real source MP3 download, service worker and airplane-mode reload, byte-range playback, compatible free practice, 390px reader/removal and private endpoint exclusion.
- Screenshots inspected: `/workspace/artifacts/offline-manager-desktop.png` and `/workspace/artifacts/offline-manager-mobile.png`.

Local fixture/browser tests do not replace physical iOS/Android, headset, background/resume, storage eviction and deployed-origin checks. Real Supabase authentication/network recovery and paid-account downgrade staging remain operator validation gates. Downloaded free assets have no premium expiration; protected material remains online-only.

Latest scoped results: **9 Node checks passed**, **14 isolated IndexedDB/cloud-recovery browser checks passed**, **2 production offline browser checks passed**, and production build passed. The production-only tests intentionally skip in the ordinary Vite-dev suite; run their dedicated config to exercise an actual built app/service worker. Both dedicated production cases passed, rather than being counted as a skip. The ordinary full regression run is performed after integrating the other tasks.

Additional hardening: size estimation now freezes its controls and rejects stale selection changes, preventing a surah/type switch from downloading an older plan. If browser IndexedDB is unavailable, the worker falls back to existing online audio instead of intercepting it with a failed request. A corrupt downloaded recording still produces an integrity failure rather than playing unchecked bytes. All **four** production offline cases passed after these fixes, including a deferred-quota race and simulated storage failure; build passed again.

### Verified device namespace while offline

After successful online `getUser()` verification, a device marker stores only the project origin and canonical account UUID. On an offline boot it must match the locally persisted session UUID before the existing account-scoped progress namespace is selected. This marker is **not authentication**: the public account client/user and developer identity remain null, premium content and server wardrobe actions stay unavailable, and no cached token/email grants access. The SDK is not asked to refresh expired sessions while offline. A reconnect reload performs actual server authentication before synchronization or private services resume. Explicit sign-out clears the marker; the offline My Account panel offers an export and device sign-out without deleting learning history. Devices lacking a matching verified marker/session safely use guest mode.

Regression tests cover a signed-in device reloading offline, preserving its namespace/queued changes, unchanged guest data, disabled developer/premium services, mismatched project/session rejection and reconnection through the established sync path. The default regression suite uses a simulated offline navigator for these imported-source tests; dedicated production tests additionally exercise real airplane-mode app-shell/media behavior.
