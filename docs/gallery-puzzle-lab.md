# Mastery Gallery and Puzzle Lab

## Existing architecture

Vite and vanilla JavaScript remain intact. `src/main.js` owns surah/ayah selection, the practice/quest/recall/chain modes, playback, and navigation. `src/data.js` contains 38 supported surahs (Al-Fatihah and all of Juz Amma), stable chapter/verse IDs, verified Arabic word boundaries, translations, and local audio helpers. `src/sequence.js` owns Ayah Chain. `src/learning-store.js` owns the canonical `ayah-learning-v1` memory/game records, FSRS scheduling, XP, bounded rewards, and legacy migration for `ayah-mastery`, `ayah-quiz`, and `ayah-completed`. `src/learning-ui.js` renders Daily Quest and self-assessed recitation. Recording is ephemeral and separate from persisted memory. Existing browser tests cover those workflows.

## Scope and editorial limits

The attached brief refers to a 13-surah artwork table but does not include it. Pending clarification, the Gallery covers the original thirteen: Al-Fatihah and surahs 103–114. All 38 surahs remain usable in the existing modes and Puzzle Lab.

No final artwork assets have been supplied or approved. `/mastery-art/NNN.webp` is the permanent asset contract; missing images use a labeled, local geometric placeholder. Placeholders are not final illustrations or representations of religious beings. No Arabic text is embedded in an image; verified titles are rendered as text in the existing Arabic font.

Both primary tafsir references returned HTTP 403 in this environment on source retrieval. Source links and review contracts are provided, but no passage has been verified and no story is marked verified. Draft Quran-text reflections must not be presented as published tafsir. Publishing requires checking both relevant primary passages, recording passage references and editorial approval, and supplying the absent artwork concepts. The UI explicitly withholds unverified stories.

## Recall checkpoints

A section requires correct independent self-assessed recall on two distinct days, using schedule-eligible history entries. Listening/text help, Again, early successful practice, puzzle progress, and legacy achievements do not qualify. Artwork unlocks are permanent, including after a subsequent lapse. Maintained is a separate award requiring every ayah currently to meet the existing retained stage (at least three successful days and an FSRS Review card). Current review needs remain visible after this award. Completion preserves FSRS dates already created by recall; gallery animations do not invent or move review dates.

The versioned Gallery store (`ayah-gallery-v1`) is reconciled against committed learning history. It can recover a missed unlock after reload without mutating the learning record. Stable surah/ayah IDs map to deterministic balanced mosaic regions. Animations occur only on Journey/Gallery screens, where recitation has stopped, and support reduced motion and Skip.

Puzzle Lab uses its own versioned history (`ayah-puzzle-lab-v1`). XP is awarded atomically in the existing learning store, at most 8 XP per ayah/game/day, with idempotent completion receipts. Assisted completions have a lower 2 XP ceiling; a later unassisted completion can earn only the difference. Lab games do not modify spoken recall history, FSRS, quest level, or artwork eligibility. Recommendations use observed placement, reconstruction, matching, sequence, opening, and similar-passage mistakes; overdue ayahs recommend independent assessment first.

## Implementation and validation

The additions are modular: Gallery eligibility and persistence live in `src/mastery/mastery-store.js`; deterministic mosaic rendering, animation and dialogs live in `src/mastery/gallery-ui.js`; editorial contracts live in `src/mastery/masteryStories.js`. `src/puzzles/puzzle-lab.js` implements the seven playable modes, while `src/puzzles/puzzle-store.js` owns Lab history and recommendations. Shared DOM and safe versioned persistence helpers live under `src/ui/`. The existing controller adds navigation and dispatch, and the existing learning store adds atomic capped Lab rewards. No authenticated Quran text, existing audio files, framework or runtime dependency was changed.

All 62 Playwright checks pass: the retained 46 checks plus 16 Gallery/Lab checks. Coverage includes balanced RTL placement and tile mappings, keyboard/touch input, live recall-to-section unlocks, permanence after lapses, distinct-day eligibility, Maintained versus checkpoint completion, missing-image fallbacks, reduced motion, completion dialogs and canonical source links, all seven games, progressive Vanishing Ayah, duplicate/day-capped rewards, failed-history-write recovery, stale Quest peek cleanup, reloads, legacy preservation, and mobile overflow. The production build passes. Desktop and mobile screenshots were inspected; no runtime page errors appeared during preview navigation.

### Remaining editorial work

1. Supply the missing thirteen-surah artwork table and confirm its concepts. The original thirteen-surah scope is implemented; the expanded 38-surah library is retained.
2. Retrieve and check the relevant Ibn Kathir and supplied canonical al-Jalalayn passages. Both source URLs continued to return HTTP 403, including a browser-user-agent retry. No narratives, occasions of revelation, or commentator attributions have been invented.
3. Write and review each narrative under 200 words, add precise checked source references, and publish only after verification.
4. Create and approve the thirteen individual WebP illustrations, following the asset contract and religious depiction restrictions. Until then, the local geometric placeholder is explicitly labeled. No final artwork generation has been claimed.

Similar Ayah Detective deliberately uses a small, checked set of three comparisons. Adding more pairs requires validating authentic openings, continuations and locations. Lab recommendations describe practice-error evidence rather than claiming automatically detected speech errors. All memorization assessment remains self-assessed.
