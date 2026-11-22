# QUR’AN CHRONICLES — Explorer’s Chronicle implementation report

## Scope and release status

The existing QUR’AN CHRONICLES platform engine, inventory, source validation, Knowledge Constellation, Evidence Detective, editorial publishing pipeline and reward contracts were retained. This change extends that engine instead of replacing Sirat Quest or introducing a competing lesson system.

The developer preview now has a playable **mechanics-only fictional archive adventure**. Its records contain no Qur’anic text, translations, tafsir, asbab or historical religious claims. It is labeled throughout and earns **no XP, comprehension mastery or FSRS grades**. Ordinary learner access remains Coming Soon until approved lessons are published. No reviewed religious curriculum was added or published.

The hosted `chronicles-content` function returned 404 during the audit. The developer demo performs a fresh call to the existing authenticated billing entitlement RPC, requires its server-derived active developer role and verifies the account has not changed. It can therefore launch without the missing lesson service. A paid plan, browser flag or editorial draft alone cannot authorize it. Reviewed lesson loading and editorial tools still need their real function/database deployment.

## Implemented gameplay

- Existing running, jumping, gravity, swept platform collisions, moving ferry, camera following and safe checkpoints remain active.
- Bounded connected archive regions include archive/observatory/guardian chambers, a switch-operated elevated route, secret overlook, return travel and discovered-room map.
- Field Journal retains collected card IDs, categories, fictional/source attribution and discovered relationships. Discovery alone grants no XP.
- Knowledge Constellation uses actual SVG connection lines and click, drag, touch and keyboard-compatible endpoint selection. One-to-many approved lesson relationships continue to use the existing validator.
- Evidence Detective distinguishes supported source categories. Incorrect choices give corrective feedback and do not convert motor mistakes into comprehension outcomes.
- Guardian gates combine actual collection, supported relationships, evidence classification and an application decision. Applying the records opens the next region; merely walking to a gate cannot complete it.
- Deterministic optional Light Dash, Double Jump, Constellation Bridge, Star Compass and Evidence Lens are fictional traversal aids derived from completed learning objectives. No theological or spoken-mastery claims are made.
- Living Knowledge Map records actual discovery and completion and permits safe revisits/fast travel only to discovered, available rooms.
- Relaxed navigation offers a continuous safe path without bypassing knowledge gates. Movement errors have safe recovery.
- Start/resume, pause, map, journal, puzzles, settings and exit are in the adventure container. Keyboard: arrows move, Space/Up jumps, Shift dashes, E operates switches, M/J opens map/journal. Equivalent touch buttons are provided.
- System reduced motion is honored. The fictional demo intentionally has no Qur’an recitation or transliteration; the existing reviewed-lesson UI retains verified full-ayah audio and does not invent phrase stops.

## State and safety

`ayah-chronicles-demo-v1` is separate, versioned and account-scoped. Its checkpoint stores IDs and mechanics state, never religious source bodies. It is included in existing account export. Invalid saved records are retained for recovery rather than silently repaired. Existing real lesson checkpoints gain additive validated exploration metadata; old checkpoint IDs and source/revision checks remain intact.

Account changes, developer-mode exit, route changes and disposal stop the demo engine and listeners. Account ownership is checked before persistence, preventing cleanup from writing a previous account’s checkpoint into the next profile. Server authorization is refreshed on focus/visibility and periodically; online authorization failure stops the preview. No offline premium entitlement is invented.

The trusted fictional factory is recognized internally, cannot be substituted with arbitrary cloned lesson JSON, fails real lesson publication validation, and is explicitly rejected by comprehension reward creation. The optional backend `developer-demo` capability action returns authorization metadata only and does not read/return religious drafts or grant editor permissions.

## Files changed

- `src/chronicles/engine.js`, `exploration.js`: additive traversal, chambers, abilities, safe map, restore validation and guardian objectives.
- `src/chronicles/mechanics-content.js`, `demo-access.js`, `demo-ui.js`: original fictional mechanics records, fresh server authorization and interactive developer adventure.
- `src/chronicles/ui.js`, `entry.js`, `ui.css`, `src/main.js`: immediate developer entry, independent demo launch, reviewed-lesson map controls and responsive styling.
- `src/chronicles/progress.js`: explicit no-reward mechanics exclusion.
- `src/learner/profile-storage.js`: additive demo export key.
- `supabase/functions/_shared/chronicles/handler.ts` and `handler_test.ts`: optional authenticated developer capability and security regression.
- `tests/chronicles-exploration.spec.js`, `chronicles-demo-ui.spec.js`: platform/exploration, matching, evidence, recovery, isolation and no-XP tests.
- Library changes and operational blockers are documented separately in [the full Qur’an repair report](../prelaunch/full-quran-repair.md).

No new SQL migration is required for the mechanics preview. Existing Chronicles editorial tables/RLS come from `20261108_chronicles.sql`; existing developer role and entitlement functions remain authoritative. Do not publish unreviewed lesson fixtures.

## Screenshots and observed testing

These images capture genuine local browser gameplay using a **mocked server-authorized developer session**, with the lesson function deliberately returning 404. They do not certify a hosted account or physical device.

| View | Desktop | 390px phone |
|---|---|---|
| Exploration and collection | [Desktop](desktop-exploration.png) | [Phone](mobile-exploration.png) |
| Field Journal | [Desktop](desktop-journal.png) | [Phone](mobile-journal.png) |
| Guardian relationship/evidence/application | [Desktop](desktop-guardian.png) | [Phone](mobile-guardian.png) |
| Living Knowledge Map | [Desktop](desktop-map.png) | [Phone](mobile-map.png) |

The mobile exploration and desktop guardian images were visually inspected. The mobile toolbar wraps above the field and overlays have internal scrolling; this is a functional developer preview, not a polished full-screen native release.

The browser journeys physically navigate the engine, collect shards, complete matching/classification/application, open a gate, enter the next region, return to an earlier checkpoint, leave/reopen the lab and restore the journal. They assert no reward/recall records were created. Separate cases reject forged presentation authorization and dispose on account switch.

Final validation: **238 browser/model/policy checks passed**, plus **4 additional real-source workspace/entry screenshot journeys passed**. The suites cover existing Memorization/Puzzle/Revision routes, all seven arcade engine contracts, legacy storage, entitlement changes, import/release policy, FSRS separation and Chronicles editorial/gameplay behavior. **23 backend tests passed** (content 8, Chronicles 7, billing 8). Deno type checks for `quran-content`, `billing-passages` and `chronicles-content` passed. Production Vite build, Capacitor asset synchronization and bundled frontend/configuration checks passed. The existing audit reports 1,210 locally validated references and zero integrity issues. `git diff --check` passed.

[Machine-readable results](evidence/results.json), [regression log](evidence/regression.log), [visual tests](evidence/visual-tests.log), [backend log](evidence/backend.log), [build/native sync](evidence/build-native-sync.log), and [content audit](evidence/content-audit.log) retain the actual outcomes. The initial selector ambiguity was corrected and the affected suites rerun successfully. A screenshot transport fixture initially returned the wrong requested pilot; it was corrected to use each exact requested local bundle and all four visual tests reran successfully.

Reproduce from the repository with installed Chromium/dependencies:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/ayah-playwright NO_PROXY=127.0.0.1,localhost,::1 npx playwright test tests/chronicles-*.spec.js tests/full-library-repair.spec.js tests/developer-library.spec.js tests/full-quran-labs.spec.js tests/passage-*.spec.js tests/private-content-boundary.spec.js tests/quran-*.spec.js tests/memorization3-*.spec.js tests/revision6*.spec.js tests/arcade-framework.spec.js tests/gameplay-storage.spec.js tests/falling-engine.spec.js tests/sirat2-model.spec.js tests/maze2-engine.spec.js tests/snake-engine.spec.js tests/bubble-engine.spec.js tests/bridge-engine.spec.js tests/cosmic-defense.spec.js tests/cosmic-mission.spec.js tests/account-policies.spec.js --config=playwright.regression.config.js --workers=2
npx playwright test tests/library-visual-evidence.spec.js --config=playwright.regression.config.js --workers=1
node_modules/.bin/deno test --allow-env --allow-read supabase/functions/_shared/quran_test.ts supabase/functions/_shared/chronicles/handler_test.ts supabase/functions/_shared/billing_test.ts
node_modules/.bin/deno check supabase/functions/quran-content/index.ts supabase/functions/billing-passages/index.ts supabase/functions/chronicles-content/index.ts
npm run native:sync
node scripts/audit-quran-manifest.mjs --check
```

The 238 checks are the relevant regression set, not a claim to have rerun every historical repository test. No Android/iOS signed binary compilation, physical-device test, real hosted purchase/account test or deployed-owner walkthrough was performed.

## Remaining limitations and operator work

- Reviewed/published lessons, qualified editorial approvals, commercial source permissions and any authorized premium pilot remain pending. No mass-generated tafsir was added.
- The mechanics demo reuses a small original archive environment and three regions; it is not a fully illustrated commercial Metroidvania campaign.
- Hosted developer/premium/free A/B testing and deployment require Supabase operator access and disposable QA accounts. No authenticated hosted pass is claimed.
- Mobile screenshots and browser touch/reduced-motion checks are not physical iPhone/Android, VoiceOver or TalkBack certification.
- No new artwork/audio license clearance, full-Qur’an release, live billing activation or store submission occurred.

[Developer entry screenshot](developer-entry.png) shows the three requested launch/review/publication actions even while the lesson service is unavailable.
