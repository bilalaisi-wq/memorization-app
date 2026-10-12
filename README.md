# Ayah — Quran memorization, piece by piece

A Quran memorization app covering Al-Fatihah, An-Nas, Al-Falaq, and Al-Ikhlas (22 ayahs), right-to-left word puzzle pieces, partial-word practice, full-ayah recitation, repetition and speed controls, scrambled-order quizzes, and hidden-word recall. Progress is saved in the current browser. No account or backend is required.

## Run

Use Node.js 24 and npm. From `/workspace/memorization-app`:

```sh
npm ci
npm run dev -- --port 5173
```

`npm run build` produces `dist/`. `npm test` runs browser tests using `/usr/bin/chromium` in this cloud environment. If using another machine, install Chromium and adjust `playwright.config.js` to its executable path.

## Sources

Arabic text and word boundaries were verified against Quran.com's v4 API. `public/quran-source.json` records the Arabic words and source URLs. The locally bundled Uthmanic Hafs font is the font distributed in [Quran.com's frontend](https://github.com/quran/quran.com-frontend-next/blob/master/src/styles/fonts.scss), downloaded from `public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2` in that repository. Quran.com supports multiple fonts; this app uses its Unicode Uthmanic Hafs option.

Full-ayah recitation: Mishary Rashid Alafasy, from `https://verses.quran.com/Alafasy/mp3/`. Individual word recordings: Quran.com's word-by-word recordings from `https://audio.qurancdn.com/wbw/`. Partial practice sequences individual recordings in the selected order; these are separate word recordings rather than a continuous cut from full recitation. Both font and all 109 audio files are bundled, so learning does not require external API calls.

Active recall hides alternating words and the full reference. Reveal controls let learners self-check their spoken recall. The app checks word order; it does not recognize or grade spoken Arabic. English meanings and transliteration are learning aids.

## Puzzle pieces

Practice starts with scrambled pieces. Puzzle Quest mixes four to six words from Al-Baqarah and Ar-Rahman into every ayah's shuffled bank. Arabic distractor spellings include their Quranic prefixes and were checked against Quran.com's API for 2:2, 2:164, 55:5, and 55:6. Their references are recorded in `src/data.js`. Choose only the ayah's words, in order. Duplicate identical words are interchangeable when checking the result.

Piece profiles use matched tabs and sockets along the right-to-left sequence. The final ayah's repeated words have separate pieces. Simple locally drawn SVG graphics offer memory associations for concrete and abstract meanings; they do not depict Allah. Divine names, attributes, and references use decorative gold accents instead. Active recall also hides the meaning and illustration to avoid giving away the missing word. The quiz checks word selection and order, not spoken recitation.

## Four-surah library and repeatable levels

Choose any surah from the sidebar selector (also available on mobile). All 22 ayahs include verified Uthmanic text, English meanings and transliteration, word-by-word and full-ayah audio, puzzle practice, active recall, and Puzzle Quest. The additional 15 ayahs use Quran.com's v4 API, Saheeh International verse translations (resource 20), and Quran.com's word translations/transliteration. Their word/audio provenance is saved in `public/additional-quran-source.json`.

Difficulty grows through three levels:

- Level 1: four extra words, visible word pieces.
- Level 2: five extra words, approximately one third of pieces blank.
- Level 3: six extra words, approximately two thirds blank; repeat for ongoing mastery.

Two correct rounds without text reveals unlock the next difficulty for that particular ayah. Wrong checks reduce rewards but do not block practice. Every fresh solved round earns stars and XP; solved arrangements are locked so rechecking or removing a piece cannot award points again. Use **Play again** for a new shuffled round on the same ayah, or **Next ayah** to move on. Each 100 XP increases the overall learner level. The app tracks consecutive rounds without mistakes or reveals.

An optional eight-second peek exposes all pieces temporarily, without flashing or rapid animation. Peeks and reference reveals award five XP and one star and do not advance the difficulty; learners can repeat without reveals when ready. Full-ayah audio remains available as a listening aid. Progress, levels, stars, and XP are stored locally in the browser. Previous Al-Fatihah completion data and star totals are preserved. There is no speech recognition or account synchronization.
