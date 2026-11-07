# Puzzle Lab 3.0: passage content and independent difficulty

## Entry and compatibility

Choose a passage using the shared passage selector, then open Puzzle Lab and choose an available game. The existing Passage Studio's game launcher also opens the context-aware runner for its selected workspace. The classic short-ayah forms remain available with their historical presets and saved checkpoints; the new **Passage games** button opens the shared selection interface.

The seven registered engines retain their own controls and mechanics. `src/puzzles/arcade/passage/contracts.js` declares the following limits:

| Game / persistent ID | Source units | Words per visual piece | Pieces per stage |
|---|---|---:|---:|
| Ayah Blocks / falling | Words, visual groups, reviewed study segments | 2 | 12 |
| Ayah Space / asteroids | Same | 3 | 12 |
| Ayah Serpent / snake | Same | 2 | 12 |
| Memory Maze / maze | Same | 3 | 12 |
| Bubble Burst / bubble | Same | 2 | 12 |
| Sirat Quest / sirat | Same | 3 | 12 |
| Bridge Builder / bridge | Adjacent ayah transitions only | Opening cue up to 3 | One boundary at a time |

A run supports at most 50 contiguous ayahs. Longer runs must be split explicitly. Bridge needs at least two adjacent ayahs in one surah and creates N−1 boundaries. A single ayah or cross-surah Bridge request is rejected with a word-practice alternative. Long source ayahs become additional stages, retaining their actual surah:ayah reference and original zero-based word IDs. No synthetic ayah identifiers or regenerated Quran text are used.

Adaptive sizing starts from the shared 1/2/3/5 baseline but caps group size to each game's readable physical footprint. Guided retrieval caps groups at two words; Expert can use longer supported groups. Stages contain at most 12 movable units; larger ayahs are paged. Reviewed-study mode requires complete source-matched reviewed coverage that fits the engine's limits. If absent, it offers an explicit visual-group fallback, never a fabricated review approval.

**Visual grouping and study approval do not certify waqf/ibtida.** Original Uthmani words, diacritics and positional identity are retained. Full verified ayah audio is used; no unreviewed cropping or stitched phrase recitations are introduced.

## Independent difficulty contracts

`difficultySchema: 1` activates two independent fields:

- `memoryDifficulty`: guided, standard, expert. Controls automatic/manual cues, source-backed distractor similarity, opening/phrase length and recognition assistance.
- `motorDifficulty`: relaxed, normal, arcade. Controls physical speeds, density, layout sizes, platform routes and connector movement. Snake's in-game speed changes update this field in results.

Legacy configs without this schema preserve their old behavior and checkpoint keys. Memory presets never certify mastery. Motor collisions, empty shots, failed drags and audio failures do not consume memory strikes. New context Blocks automatically recovers an unattended floor landing as a motor event; a deliberate wrong center-stack placement remains a memory selection error. Classic preserves three memory strikes across stages; Practice preserves the budget within an ayah and resets at the next ayah, not each visual page.

## Modules and persistence

- `passage/plan.js`: validates source coverage, calculates deterministic bounded stages, source/review fingerprints and stage IDs.
- `passage/adapter.js`: source-position-preserving grouped engine tokens and authentic distinct distractors.
- `passage/host.js`: authorizes source loads, hosts existing registered engines, full-ayah audio, lifecycle cleanup, stage advancement and capped result aggregation.
- `passage/store.js`: `ayah-arcade-passages-v1`, profile-scoped metadata only. No Quran text/audio in this store. Invalid/future data remains untouched for recovery.
- `difficulty.js`: separate memory/motor resolution with backward-compatible legacy fallbacks.

Run IDs persist so engine waves and pending stages can resume. Completed stages survive reload. Native checkpoint stores remain authoritative for games that support in-stage checkpoints; others restart the pending bounded stage. Changing settings intentionally prepares a separate route. Results aggregate pages once per completed source ayah through existing `recordLabPuzzle` caps and stable receipts; no XP for merely changing pages. The shared framework never grades FSRS. Outcome callbacks reuse the existing Passage Studio 16-earned-XP self-assessment prompt.

New result metadata includes memory/motor settings, original content units, per-stage settings, assistance, motor events and source-position error evidence. Historic game history is preserved. The new route key is included in local profile exports; it does not add a cloud-sync dataset or a database migration.

## Authorization and cleanup

Private bundles/audio still use authenticated `quran-content` requests and server entitlement checks. No premium text is added to public assets. Source/review fingerprints are checked before starting each stage; private access is rechecked on focus and periodically. Profile changes, denied access, explicit entitlement changes and exit dispose engines/media/listeners and clear active private objects. A private audio error never falls back to a public URL.

## Validation and limits

`tests/puzzle3-content.spec.js` covers the seven-game content matrix (short, medium, long verified pilots, chains), independent axes, insufficient approved coverage, provenance, real engine completion, persistence recovery, capped rewards and FSRS non-interference. `tests/puzzle3-ui.spec.js` launches each real engine across the same matrix, checks 390px overflow, independent controls, reduced motion, lifecycle/account cleanup, unsupported-source fallback and stage restoration.

Fixture 73:19–20 is byte-matched to the existing verified private-source manifest; it supports the long adjacent-ayah Bridge test. Fixtures are test-only and not public content distribution. Browser tests use mocked entitlement responses and simulated audio; they do not establish deployed Supabase policy correctness or mobile speaker playback. Existing backend authorization regression tests must also pass. No new claim of oral recitation certification is made.

## Completed validation

- Full Playwright regression suite: **810 passed**, 3 workers, `playwright.regression.config.js` (12.4 minutes).
- Focused content, seven-game browser matrix, Passage Studio and shared-context suite: **104 passed**.
- Supabase billing unit tests: **7 passed**; content-policy unit tests: **6 passed**.
- Billing and Quran-content Edge Function type checks passed.
- `npm run build` and `git diff --check` passed.

The full run caught and resolved Studio auto-start compatibility, source-scope reward metadata, disposed snapshot references, and a screenshot-clock race. Manual cue use now persists across reloads, including when revealed before starting. Access revocation clears game snapshots as well as visible content. Studio game rewards continue notifying the existing progress/cloud observers.

Representative launcher screenshots, captured from actual mounted engines and inspected:

- [Bridge desktop](screenshots/puzzle-lab-3/bridge-desktop.png)
- [Space, grouped words at 390px](screenshots/puzzle-lab-3/space-mobile.png)
- [Maze at 390px](screenshots/puzzle-lab-3/maze-mobile.png)

These are isolated launcher captures; the site retains its normal navigation and theme controls. Additional desktop/mobile captures for all seven engines are generated by `tests/puzzle3-ui.spec.js` into `/workspace/artifacts/` in this workspace. Live deployment, deployed Supabase RLS and physical-device speaker playback were not revalidated by these local automated checks. Railway deployment remains manual.
