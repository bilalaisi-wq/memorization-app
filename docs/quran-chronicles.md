# QUR'AN CHRONICLES — Comprehension Lab pilot

## Release scope and content status

QUR'AN CHRONICLES is the adventure in the existing **Comprehension Lab**, alongside Memorization Lab, Puzzle Lab and Revision Lab. It uses vanilla JavaScript/Vite and Supabase. It does not replace Sirat Quest or change its learning goals.

The implementation includes a playable platform adventure, inventory, Knowledge Constellation, Evidence Detective, reviewed application questions, teacher-defined conceptual chapters, source authorization, an editorial desk and an explicit publication pipeline.

**No real religious lesson is seeded as approved.** The repository did not contain a licensed, qualified-reviewer-approved comprehension pilot. The mechanics test fixture is intentionally labeled test-only; its matching labels are not translations, tafsir or historical assertions and must never be published. The public lesson library remains empty until qualified staff supply actual material, verify commercial rights, independently review it and explicitly publish it. No premium pilot is advertised or supplied without the same approval. The authoring scaffold is [the unpublished pilot template](quran-chronicles-pilot-draft.json), not learner content.

This is a functioning technical/editorial pilot awaiting actual lesson approval, not a claim that a reviewed Juz Amma curriculum or production religious-content certification has been delivered.

## Gameplay

- Arrow keys move; Space/Up jumps. Touch controls provide left/right/jump, Enter, safe return and in-field access to Bag, Connect and Evidence.
- Terrain uses Sirat Quest's constants, generated platforms, moving-platform coordinates and the same extracted swept collision helper. Jumping, gravity, ferry riding, camera following and safe motor recovery are actual simulation. Optional elevated platforms create branching exploration.
- Knowledge objects are placed on reachable platforms. Their kinds support canonical ayah crystals, meaning scrolls, vocabulary, tafsir, context/asbab and reflection. A lesson only includes types supported by its reviewed sources; missing history does not cause an invented relic.
- Collection adds IDs to the backpack and earns **zero XP**. Archive rooms and assembly stations open within the game, pausing movement. Backpack/mini-game buttons offer an accessible alternative to exact positioning.
- Knowledge Constellation draws real connection lines between a canonical reference and related collected cards. Pointer drag, native drag/drop, click/tap and keyboard activation are equivalent. One reference can have several approved relationships; wrong links provide source-based feedback.
- Evidence Detective is an investigation board with source cards and accessible classification controls. It distinguishes Quran, translation, tafsir/vocabulary explanation, historical reporting, reflection and unsupported/unestablished claims. Weak reports cannot be presented as established history. Alternative classifications require explicit review notes and citations and cannot blur Quran with other source genres.
- Application questions use reviewed, explicit accepted choices. Free speech, personal virtue and spiritual outcomes are not automatically graded. Applications require the section's knowledge to be collected.
- All required connections, analysis and application objectives must be complete before the explorer enters the far chapter gate. Subsequent conceptual chapters retain the backpack. Finishing a lesson does not certify memorization or spoken recitation.

## Content contract

The server and browser share `supabase/functions/_shared/chronicles/model.js`:

- Canonical `refs`, never regenerated Quran text.
- Cards with a distinct `kind`, exact references, source IDs and precise source locators.
- Quran cards have `text: null`; actual Arabic comes from the existing verified source loader.
- Vocabulary and optional Quran study excerpts use explicit, consecutive, one-based word positions. Excerpts use exact source slices, preserving spelling and stopping symbols. A long-ayah crystal requires a teacher-selected excerpt (up to 24 words); automatic visual word groups never become tafsir or waqf units.
- Translation, tafsir, historical context and reflection remain labeled separate material.
- Asbab status is either `not-specified` or `reports-reviewed`; no occasion is assumed for every ayah. Reports explicitly carry established/disputed/weak/unestablished reliability.
- Relationships and evidence answers include reviewed explanations and citations. One-to-many relations and documented alternative interpretations are supported.
- Sections contain 3–8 reviewed knowledge objects and contained objectives. A lesson can have several constellations within one long ayah or across its referenced surah passage.
- Sources require HTTPS citations, attribution, a license name/link and a commercial-use declaration. These declarations alone do not publish anything: independent qualified review requires source-by-source rights evidence.
- Optional reviewed application questions specify choices, accepted answers, explanation and citations.

The lesson digest canonicalizes object keys so PostgreSQL JSONB ordering cannot invalidate it. Separate canonical Quran fingerprints bind every publication to verified Arabic/word positions. Backpack identity combines both lesson and source hashes. Editing content invalidates review; a source change blocks reading/republication until review is renewed.

## Editorial workflow and licensing

See [Supabase/editorial setup](../supabase/CHRONICLES_SETUP.md).

Assigned editors can create and modify drafts. A separate qualified reviewer approves sources, reliability, conceptual sections, answer keys and commercial-rights evidence. An assigned publisher then explicitly publishes the current reviewed revision. Reviewer identity, qualification, timestamps and source revision are visible on published lessons. Audit rows record every successful mutation. Stale revision writes fail without replacing another editor's work. Reject/request-corrections and withdraw actions are available.

Licensing is a **human verification gate**, not an automated legal opinion. A citation or pre-existing memorization translation does not itself establish commercial permission. Staff must inspect the actual license, scope, redistribution/adaptation rules and required attribution, or document permission. Private clearance evidence is not returned to learners; public credits and license links are accessible before collecting anything. The app does not generate tafsir or asbab.

Editorial preview is labeled unpublished and earns no XP. It uses the same real mechanics but is not a route for learners to retrieve drafts. Roles are assigned in the database, not by local developer toggles or an email in browser storage.

## Authorization and account safety

`chronicles-content` is the only lesson delivery/editorial endpoint. Tables have RLS and no anon/authenticated direct access; only the Edge Function's service client can read or mutate them. Staff RPCs are service-role-only, independently role-checked and revision-locked. The Edge Function derives actor identity with `auth.getUser`; client-supplied user/plan/role/path fields are rejected.

Public requests can retrieve published free lessons. Private lessons require current server-derived content entitlements (including existing developer-only source restrictions). Canonical private Arabic/audio still goes through existing authorized content infrastructure. Private lesson text is never included in the frontend bundle or a public storage object.

The reader rechecks publication and canonical fingerprints. Focus, periodic validation, account changes and entitlement events dispose stale/unauthorized views and media. Full-ayah recitation is optional, pausable and volume-controlled; it pauses physics and never splices recordings at conceptual boundaries.

Accounts remain isolated. Staff foreign keys use `ON DELETE SET NULL`/cascade so the new tables do not prevent existing account deletion. A lesson whose reviewer account is removed is unavailable pending renewed review. Published reviewer display identity requires the reviewer's consent before role assignment.

## Persistence and rewards

`ayah-chronicles-v1` uses existing account-scoped browser storage and device exports. It stores source-bound IDs, inventory, objectives, chapter progress and motor/learning counters, never private teaching text, Quran text or audio. Invalid/future records remain intact for recovery. Inventory and completed chapters survive reload; unfinished movement restarts at a safe chapter landing. This initial dataset does not add cross-device backpack sync.

Only correct approved relationships, source analysis, applications and objectives request rewards. Receipts bind to content/source hash and objective ID, and the existing daily/rate caps remain authoritative. Capped objectives are marked handled to prevent later replay farming. Rewards use the existing `lab` ledger with `chronicles-comprehension` action; no reward database whitelist is weakened. Comprehension progress lives separately from memorization history. There are no FSRS calls, native recall grades or mastery writes.

## Implementation map

- `src/chronicles/entry.js`: lazy-loaded lab lifecycle.
- `src/chronicles/ui.js`, `ui.css`: adventure, in-field controls, backpack and both mini-games.
- `src/chronicles/engine.js`: deterministic platform navigation and reviewed objective rules.
- `src/chronicles/progress.js`: source-bound metadata, capped receipts and export compatibility.
- `src/chronicles/editor.js`, `client.js`: editorial desk and authenticated content calls.
- `supabase/functions/_shared/chronicles/`: shared lesson validation and server handler.
- `supabase/functions/chronicles-content/index.ts`: Edge Function.
- `supabase/migrations/20261108_chronicles.sql`: private editorial tables, approval/publish RPC and audit.
- `src/puzzles/arcade/sirat/engine.js`: extracted shared collision helper; original Sirat learning logic retained.

## Validation and remaining launch work

Tests cover actual movement and full chapter completion, jumping, reachable terrain, backpack reload, zero discovery XP, one-to-many connections, evidence/reliability, applications, preview/no-XP, licensing and publication gates, SQL RLS/CAS/audit, private entitlements, account isolation, withdrawal/audio cleanup, touch, keyboard, reduced motion and rewards/FSRS separation. Existing Sirat and all other labs require full regression coverage before release.

Screenshots exercise **test-only mechanics material**, not approved religious teaching: [desktop](screenshots/quran-chronicles/desktop.png), [390px mobile](screenshots/quran-chronicles/mobile-390.png).

Remaining launch dependencies: install the migration, deploy the Edge Function, assign qualified staff, obtain and review actual licensed pilot material, explicitly publish it, and check live RLS/entitlement/audio behavior. Browser/source-policy tests do not certify deployed service configuration or religious review.

## Owner-supplied pilot preferences

The pilot contact is **Bilal Ahmad**; reviewer qualifications/completed review remain pending while reviewers are sought. The preferred research references are Ibn Kathir, Al-Jalalayn and Al-Muyassar. See [the pilot editorial record](quran-chronicles-pilot-review.md) for the distinction between citation/original writing and edition-specific text reuse, the blocked source-term verification attempts, and the named account setup.

## Final test evidence

- Complete regression command: `npx playwright test --workers=3 --config=playwright.regression.config.js` — **884 passed**, 14.8 minutes, no failures or retries.
- The subsequent owner-specific setup test also passed (**1 additional test**), verifying Bilal Ahmad's author/publisher identity without reviewer permission, approval events or seeded lessons.
- Backend suites: billing 7, content authorization 6, recitation 5, coach 5, QUR'AN CHRONICLES 5 — **28 passed**.
- `npm run check:chronicles`: Edge Function type check passes.
- `npm run build`: production build passes.
- Real browser chapter completion exercised movement, ferry jumps, collection, one-to-many matching (including drag), classification of weak reports, application and physical gate entry. These results establish technical gameplay, not religious-content approval.
- Inspected additional test-fixture captures: [actual platform gameplay](screenshots/quran-chronicles/gameplay-desktop.png), [illuminated one-to-many constellation](screenshots/quran-chronicles/constellation-desktop.png).

No copied tafsir text, verified edition license or completed scholarly review is claimed. Bilal Ahmad is the current editorial/provisional review contact. The exact three source URLs are recorded; proxy restrictions prevented reading them here. Actual publication and live Supabase/audio checks remain deployment/editorial work.
