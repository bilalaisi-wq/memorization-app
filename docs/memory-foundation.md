# Phase 1: memory foundation

Ayah remains a Vite application written in vanilla JavaScript. It now contains Al-Fatihah and surahs 114 through 78: 38 surahs, 571 ayahs, and 2,914 locally bundled recordings. The 15 additions are At-Takathur, Al-Qariah, Al-Adiyat, Az-Zalzalah, Al-Bayyinah, Al-Qadr, Al-Alaq, At-Tin, Ash-Sharh, Ad-Duha, Al-Layl, Ash-Shams, Al-Balad, Al-Fajr, and Al-Ghashiyah.

## Modules and responsibilities

- `src/learning-store.js`: versioned persistence, migration, stable identifiers, review sessions, FSRS integration, history, due selection, and reward accounting.
- `src/learning-ui.js`: Daily Quest, independent recitation prompts, comparison, self-grading, history, assistance tracking, and export.
- `src/main.js`: existing puzzle controller plus memory entry points and bounded puzzle rewards. Practice, Puzzle Quest, Active Recall, Ayah Chain, and audio remain supported.
- `src/additional-surahs.json` and `public/additional-quran-source.json`: verified word text, English aids, and recording provenance. Original surah data is preserved.
- `src/sequence.js`: the existing Ayah Chain controller, retained separately from single-ayah recall assessment.

## Learning records and migration

The canonical store is `ayah-learning-v1`, with `schemaVersion: 1`. Stable keys use the Quran chapter and verse identifiers, such as `1:1`, `114:1`, and `88:26`, rather than array indices.

Each record contains separate `game` and `memory` objects:

- Game: completed puzzles, puzzle wins, newly attributable puzzle XP/stars, mistakes, hint uses, and puzzle history.
- Memory: mastery stage, independent and assisted attempts, successful review dates, mistakes, lapses, serialized FSRS card, next review, assisted-study reminder, and assessment history.

The wallet retains total XP, stars, and the existing clean-round counter. Historical XP is also retained as `legacyXP`; older code did not store per-ayah XP allocation, so the migration does not invent one.

The first migration backs up the exact raw values of `ayah-mastery`, `ayah-quiz`, and `ayah-completed` in `ayah-learning-legacy-v1`. Numeric completed entries are mapped to the original Al-Fatihah ayahs. Existing puzzle wins remain game achievements. They create no FSRS card, independent recall attempt, successful review day, or memorization mastery.

After migration the canonical store is authoritative. Legacy keys are maintained as compatibility mirrors, with known extra legacy properties preserved. Migration is idempotent. Unsupported or malformed canonical data is protected from overwriting and can be exported. A failed canonical write rolls back the proposed change and does not acknowledge an assessment or grant its reward. Unfinished recall flags persist across reloads. Changing ayahs or surahs starts a separate assessment.

## Recall eligibility and scheduling

The interface explicitly labels this as **self-assessed recitation**. Optional microphone capture now supports manual playback comparison with the reciter. There is no speech recognition, automatic pronunciation grading, or teacher verification. Recordings live only in the current tab; audio capture does not submit a grade or certify recall.

The learner first sees a prompt with the text, translation, and word pieces hidden. After reciting, **I've recited — compare** reveals the verified text. This comparison is not a pre-recall hint. The learner then chooses:

- Again: missing or incorrect words / unable to recall.
- Hard: full, correct recall with difficulty.
- Good: full, correct recall with normal effort.
- Easy: full, correct recall with ease.

Revealing text first, listening before declaring the recall, checking the assistance box, or leaving an unfinished assessment to study the same ayah marks the session assisted. These sessions are recorded but cannot increase FSRS memory state or add successful independent review days. They receive a ten-minute study reminder; this is a practice reminder, not a custom forgetting model. Listening by itself never submits an assessment. Listening after recitation for comparison is permitted.

Scheduling uses the maintained [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) library, pinned to **5.4.2**, with default model weights, target retention 0.9, deterministic intervals (`enable_fuzz: false`), and the supported short-term learning steps of one and ten minutes. Relearning uses ten minutes. Card and log dates are serialized as ISO timestamps and hydrated into `Date` objects before library calls.

A first independent assessment or an independent review that is due feeds its rating to FSRS. Positive early practice is recorded without inflating the card's future schedule, distinct-day successes, or recall reward. An actual independently assessed **Again** is evidence of a lapse even if early, and updates FSRS. Correct early practice clears an assisted-study reminder while leaving the future FSRS date intact.

Successful days are unique calendar days, in the learner's saved timezone, on which eligible independent Hard/Good/Easy reviews occurred. Repeated same-day success cannot manufacture multiple successful days. Mastery stages are:

- New: no independent card or completed assisted assessment.
- Studying: assisted study has been recorded but there is no independent card.
- Recalling: FSRS learning/relearning.
- Reviewing: FSRS review state, with fewer than three successful review days.
- Retained: FSRS review state and at least three successful review days.

These stages are product markers derived from self-reports, not scientifically validated certificates of long-term memorization. FSRS's default calibration was not fitted specifically to full Quran recitation. A due or overdue ayah still needs reassessment even if it previously reached Retained. Taking a break does not remove points or automatically log a lapse.

## Daily Quest and reward rules

Daily Quest shows due-now/due-today items, weak ayahs (recent failure or assisted study), suggested new memorization, upcoming schedules, and separate puzzle and memorization metrics. Suggestions prioritize previously completed puzzle ayahs that still have no independent card. A small Daily Quest summary is also present in the existing learning views.

All reward grants use persisted receipts and a timezone-aware daily ledger:

- Puzzle Quest keeps its original reward formula, but only the first **two solved rounds per ayah, per puzzle level, per day** award points. Later rounds still build puzzle progress. Puzzle activity never records successful independent recall.
- Initial successful independent recall: up to **40 XP and 3 stars**.
- Successful due independent retrieval: up to **60 XP and 4 stars**.
- Again: 5 XP for a new assessment or 10 XP when due, recognizing the attempt without recording success.
- Assisted assessment: up to **5 XP and 1 star per ayah/day**, with no independent recall credit.
- Repeated recall grades on the same ayah/day are capped at the greatest eligible reward. An improvement pays only the difference; the cap is not paid again. Positive early practice awards no additional recall points.

Duplicate submission of the same assessment or puzzle result cannot grant another reward or add another review. No reward is negative. Existing totals remain intact, and assistance or breaks do not reset the clean-round counter. As a browser-only application this prevents ordinary UI farming, not deliberate edits to localStorage or the device clock.

## Evidence and practical limits

The design distinguishes effortful retrieval from exposure to an answer, and distributes eligible reviews over time. Background evidence includes [Karpicke & Roediger, retrieval practice](https://doi.org/10.1126/science.1152408) and [Cepeda et al., distributed practice](https://doi.org/10.1037/0033-2909.132.3.354). These findings motivate the workflow; they do not validate Ayah's stage thresholds, self-reports, or its application of default FSRS weights to Quran recitation.

State is local to one browser origin. There is no account, synchronization, import UI, or trusted anti-cheat service. Export is available from Daily Quest and includes learning data, raw canonical data, and the legacy backup. Browser storage quotas can eventually limit a long history; storage errors are shown and unsaved changes are not acknowledged. Dates use the saved timezone chosen from the browser at first migration. Full multi-tab concurrency and timezone preference editing remain future work. The application needs its static assets available; Phase 1 does not add a service worker or guarantee offline page loading.

## Phase 2 implementation order

1. **Validate learning outcomes before adding more badges.** Add reporting of delayed independent retrieval, lapses, assisted attempts, and review load. Evaluate grade guidance and the stage thresholds with Quran teachers and learners, including long versus short ayahs. Keep speech self-assessed unless an independently validated, consent-based assessment method is introduced.
2. **Personalize with adequate history.** Backtest exported review logs, then adopt supported FSRS weight optimization when a learner has enough data. Retain defaults for sparse histories and add a tested algorithm-version migration. Offer target-retention and daily workload preferences; do not replace FSRS with an invented forgetting curve.
3. **Adapt the daily plan and sequence practice.** Add configurable new-ayah limits and sessions organized around due/weak ayahs. Introduce separately identified Ayah Chain recall assessments and transition-error tracking, with explicit rules for attributing results to individual ayahs.
4. **Make storage more durable and portable.** Add schema-validated import/restore, IndexedDB history storage, transactional cross-tab coordination, and timezone preferences. Consider opt-in synchronization and selected audio caching/PWA support after the local workflow is validated.

## Validation

The Playwright suite covers the retained puzzle and chain workflows plus migration, FSRS grade outcomes, date hydration, distinct-day success, assistance eligibility, early practice and lapses, duplicate reward prevention, daily caps, timezone boundaries, surah changes, reloads, export, and storage failures. The enlarged audio corpus is probed with bounded media-player concurrency so every recording is checked without exhausting Chromium's resources. The production build remains `npm run build`.

Phase 1 verification: all 39 Playwright checks passed (18 retained-workflow checks, 11 learning-store checks, and 10 memory-UI checks), along with the production build. All 1,432 recordings were checked for loadable media metadata; representative real audio playback and sequence ordering were also exercised. Existing additional-surah records were compared with the previous Git version and remained identical.

Juz Amma and recording extension: all 46 Playwright checks pass, including real Chromium MediaRecorder capture with a simulated microphone, playable recorded blobs, separate/simultaneous comparison, assistance tracking through native players, permission denial, retries/reloads, and microphone cleanup after navigation or a late permission grant. The library now includes 2,914 recordings. All original surah records were preserved exactly. Desktop and mobile recording previews were checked, with no mobile horizontal overflow. The production build passes.
