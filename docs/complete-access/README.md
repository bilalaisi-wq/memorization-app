# Continuous revision, long-passage games and Chronicles adventure

Read [BASELINE.md](BASELINE.md) for the diagnosed five-ayah cutoff and fresh hosted reconciliation. This is a coordinated frontend implementation, not a claim that missing Quran assets or religious lessons have been approved.

## Implementation and status

| Workstream | Implementation | Verification boundary |
|---|---|---|
| Continuous revision | The original range is retained. Authorized Star Runner streams five-ayah windows, saves a source-pinned prefix before advancing, reauthorizes each window, and resumes the last completed checkpoint. Basic free runner/defense/link use guarded automatic stage advancement and persistent prefixes. | Local real-source physics covers Al-A‘raf 7:1–206. Browser interaction passes 78:1–10 beyond ayah 5 and reloads at 6–10. Al-Baqarah 286-reference traversal is a metadata/controller test, **not** hosted full-surah gameplay. |
| Constellation Atlas | Virtualized 20-node regions, reachable primary route, opening/boundary recognition, actual hidden-group word construction with distractors, completion constellation and optional cumulative boundary review. | Genuine browser decisions and saved coverage; source-backed plans. A completed map means supported practice, not recitation mastery. |
| Ayah Forge | At most 12 grouped source tiles, drag/tap construction, supported and cumulative A/B/A+B rounds, illuminated components, repeated/earlier workspaces, limited optional hints, approved anchors only, existing independent assessment/typed recall. | Actual 2:282 fixture reconstruction through every cumulative round, original word positions and bounded pieces. Fixture auth is not a hosted entitlement test. |
| Memory Command | Tactical region choice, actual prior recognition/ordering/transition evidence and existing rescue/review signals; transparent balanced review without evidence; optional inspection resources and cumulative connections. | Source-backed responses, persisted regions, no invented weakness or motor-as-memory grading. Resources affect assistance/cosmetics only. |
| Full Qur’an developer catalog | All 114 chapters inspectable as metadata; actual prepared counts and source-capability indicators, surah/juz browsing and limited verified pilots; missing full chapters fail with a useful explanation. | **Partially implemented / blocked by rights, review and missing validated content.** Only 1,210 local references technically validate. 5,026 required asset sets are still missing. |
| Qur’an Chronicles | Existing physics, source validator, editorial backend and journal retained. Adds Deep Reading/bookmarks, explicit relation-based card combinations, real Sokoban-style Knowledge Forge with undo/reset, branch light platforms, seeded optional route variation, wall jump/recovery and environmental machinery activated by evidence. | Mechanics-only server-authorized developer demo is playable. New demo final guardian requires reading, supported cards and Forge seals; older saves preserve legacy gate rules. Real religious publication remains **blocked by source/editorial review**; production has zero published lessons. |

## Persistence, learning and authorization

- New account-scoped keys: `ayah-continuous-revision-v1` and `ayah-long-games-v1`. They store references, fingerprints, progress, mistakes/assistance and bounded evidence, never private Quran bodies/audio. Included in profile export/recovery. They are device-local under the existing extended-store policy; do not claim cross-device cloud sync for these new keys.
- Existing game IDs, Bridge/Link/Bubble records, XP, subscriptions and FSRS are unchanged. New long-game recognition uses the existing bounded reward ledger with deterministic `quest:` receipts. Cumulative repetition cannot duplicate its completion award.
- Source exposure marks applicable active assessments assisted through the established helper. Independent assessment is an explicit separate workflow. Maps, decks, engineering and movement never submit Good/Easy grades.
- A private source is loaded through the authenticated content client, not developer presentation state. Profile/access changes dispose active private resources. Purely free study is not revoked by a billing-access event.
- New runs revalidate source/review fingerprints. A changed catalog/source identity does not reuse old-source progress. Old records remain available for export; malformed data is not silently replaced.
- No migration or new secret is needed for the frontend features. No source pin, RLS policy, developer database role, payment flag or editorial permission is relaxed.
- Save/exit resumes a bounded checkpoint, not an exact in-flight ship coordinate. Interrupted partial windows repeat safely. Existing expedition scheduling/mandatory recall tasks remain distinct from ordinary ayah boundaries.

## Content and hosted evidence

[coverage-summary.md](coverage-summary.md) is the readable 114-surah readiness table. [coverage.json](coverage.json) contains all 114 surahs, all 30 juz, asset coverage/fingerprints and per-reference source status. Fresh management reads confirmed 639 private references with bundle/audio object presence (1,278 objects) in production. Object presence is not authenticated delivery or a fresh byte-integrity certification. Production functions remain quran-content v5, billing-passages v5 and chronicles-content v1 at reconciliation. Staging has different versions and eight private objects.

[compatibility.json](compatibility.json) checks 1,210 validated local references against six bounded arcade **plan initializers**, with zero failed plans. Bridge correctly requires an adjacent pair; Chronicles requires published reviewed lessons. This report does not pretend to mount 1,210 live user sessions or certify server authorization.

No new source assets were imported/uploaded. No unreviewed tafsir, historical statement, translation or AI-generated Quran was published. Actual owner-browser sign-in and end-to-end full Al-Baqarah remain unverified; database developer-role presence is reported separately from a user session.

## Operator actions for the blocked corpus

1. Supply the existing importer with a genuinely independent canonical/juz manifest and its SHA-256, and documented commercial-use source policy/edition/reviewer evidence. Do not merely flip example approval booleans.
2. Run the isolated pipeline, for example `python3 scripts/prepare-quran-content.py --juz 28 --prepare --policy /secure/source-policy.json --reference-manifest /secure/references.json --reference-sha256 ACTUAL_DIGEST`. Existing candidates resume through the established importer; `--recover` handles interrupted candidates. See [the importer guide](../quran-import-pipeline.md).
3. Independently validate each candidate and rights/review evidence before private upload. Preserve existing pins; source changes require an explicit migration policy. Use the established uploader/deployment procedure, not a broad legacy import.
4. Verify a real developer and under-entitled account against each staged source. Only then update availability/pins through the controlled release process. The frontend catalog is not an entitlement grant.
5. Obtain qualified approval of Chronicles materials, rights, categories and explicit relationships before publication. Developer mechanics access does not approve religious curriculum.

## Validation

The full clean-snapshot suite ran 1,162 cases: 1,141 passed, 13 failed initially and eight were intentionally skipped. The initial failures exposed the continuous-save guard and authorized-wrapper initialization defects, outdated card/catalog/start expectations, gameplay-helper timing and native test-server dependency-cache interference. After corrections, a separate final clean snapshot passed all 75 confirmation cases, including every initially failing case, both runner handoffs, complete desktop/phone Chronicles journeys and private-source revocation. A stricter Bubble geometry/helper rerun passed all eight cases. The production service-worker suite passed all four offline cases. Relevant tests include `continuous-passage`, `continuous-runner-ui`, `araf-continuous-physics`, `long-games`, `long-games-ui`, `complete-access-ui`, existing Cosmic/boundary/Chronicles/entitlement suites. All screenshots are actual browser output. Physical iOS/Android, VoiceOver/TalkBack and store certification are not inferred from Playwright or Capacitor sync.

## Changed modules

- Continuous range/model: `src/revision/continuous/model.js`, `src/quest/cosmic/authorized-runner.js`, existing director, shared Cosmic toolbar, passage-context launch and Revision Lab.
- Long games: `src/revision/long-games/{model,ui}.js`, `ui.css`; existing reviewed anchors, audio, source adapters and reward/recall stores are reused.
- Developer readiness: `src/content/{coverage,developer-library}.js`, sidebar metadata labels and the existing full library panel.
- Chronicles: `adventure.js`, `adventure-ui.js`, existing engine/demo/published UI and CSS; editorial backend unchanged.
- Audit: `scripts/complete-access-audit.mjs`, `scripts/complete-access-compatibility.mjs`; generated metadata reports and regression tests.


### Additional evidence and limits

- All 206 original prepared Al-A‘raf ayahs passed the real runner physics in a separate local operator-source test. The eight skips in the general run were that private-source case, three private screenshot cases and four production-worker cases; the source-physics and production-worker checks were run separately. Missing private screenshot assets in a clean public checkout were not fabricated.
- Backend policy suites: 36 passed, zero failed. Local coverage audit: 1,210 validated references, zero integrity issues. Compatibility: 1,210 source references, zero failed bounded game-plan initializations.
- Fresh unauthenticated production requests for 7:1, 7:206, 2:255 and 2:282 returned 401; unavailable 2:1 returned 404. No protected text was returned. These probes do not substitute for real authenticated account A/B, developer or subscription testing.
- Final clean-snapshot `npm run build` and `npm run native:sync` passed. Both native projects received bundled frontend assets and passed configuration checks. No signed IPA/AAB, physical-device validation, app-store submission or Capgo OTA publication is claimed.
- The final private-access test caught an empty-screen recovery issue: revoked material was cleared, but its explanation was lost. The game now clears private resources and explains reauthorization without changing the saved checkpoint.
- Mobile screenshot inspection caught the Chronicles toolbar covering a block board. Its sticky height is now bounded; long-game navigation maps are also bounded so they do not consume the complete phone screen.

### Screenshots

Actual interactive browser output, including desktop and 390px phone layouts:

| Activity | Desktop | Phone |
|---|---|---|
| Constellation Atlas, 15-ayah map | [View](atlas-passage-desktop.png) | [View](atlas-passage-phone.png) |
| Ayah Forge, grouped longer ayah | [View](forge-passage-desktop.png) | [View](forge-passage-phone.png) |
| Memory Command, tactical regions | [View](command-passage-desktop.png) | [View](command-passage-phone.png) |
| Chronicles Deep Reading | [View](chronicles-reading-desktop.png) | [View](chronicles-reading-phone.png) |
| Chronicles evidence cards | [View](chronicles-deck-desktop.png) | [View](chronicles-deck-phone.png) |
| Chronicles movable Knowledge Forge | [View](chronicles-forge-desktop.png) | [View](chronicles-forge-phone.png) |

### Remaining release gates

1. **Blocked by missing validated content / source rights and review:** 5,026 remaining source asset sets, including most of Al-Baqarah. No new imports, hosted uploads or source approvals are claimed. Prepared source does not establish edition reuse rights.
2. **Partially verified hosted access:** production object/function/developer-role reconciliation and unauthenticated denials were checked. A real owner-browser session and authenticated full-surah delivery must still be tested by the operator; no disposable signed-in test accounts were used.
3. **Blocked by editorial review:** real Chronicles curriculum remains unpublished. The working developer adventure uses explicitly fictional museum evidence, earns no learning XP and makes no religious claims.
4. **Device-local new campaign records:** both new stores are account-scoped and exportable; their new keys have not been added to cloud sync. Exact in-flight state is not restored; completed bounded checkpoints are.
5. **Native/manual QA outstanding:** physical iPhone/Android, screen readers and long-duration low-memory testing remain operator checks. Website deployment does not certify native distribution readiness.

No Supabase migration is required for this frontend release. Existing RLS, subscriptions, source pins, authenticated content functions and FSRS history are unchanged. To roll back the interface, redeploy the preceding Railway/Git commit; retain the two additive local stores for export rather than deleting them.
