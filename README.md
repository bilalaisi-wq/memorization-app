# Ayah — Quran memorization, piece by piece

An Al-Fatihah web app with all seven ayahs, right-to-left word puzzle pieces, partial-word practice, full-ayah recitation, repetition and speed controls, scrambled-order quizzes, and hidden-word recall. Progress is saved in the current browser. No account or backend is required.

## Run

Use Node.js 24 and npm. From `/workspace/memorization-app`:

```sh
npm ci
npm run dev -- --port 5173
```

`npm run build` produces `dist/`. `npm test` runs five browser tests using `/usr/bin/chromium` in this cloud environment. If using another machine, install Chromium and adjust `playwright.config.js` to its executable path.

## Sources

Arabic text and word boundaries were verified against Quran.com's v4 API. `public/quran-source.json` records the Arabic words and source URLs. The locally bundled Uthmanic Hafs font is the font distributed in [Quran.com's frontend](https://github.com/quran/quran.com-frontend-next/blob/master/src/styles/fonts.scss), downloaded from `public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2` in that repository. Quran.com supports multiple fonts; this app uses its Unicode Uthmanic Hafs option.

Full-ayah recitation: Mishary Rashid Alafasy, from `https://verses.quran.com/Alafasy/mp3/`. Individual word recordings: Quran.com's word-by-word recordings from `https://audio.qurancdn.com/wbw/`. Partial practice sequences individual recordings in the selected order; these are separate word recordings rather than a continuous cut from full recitation. Both font and all 36 audio files are bundled, so learning does not require external API calls.

Active recall hides alternating words and the full reference. Reveal controls let learners self-check their spoken recall. The app checks word order; it does not recognize or grade spoken Arabic. English meanings and transliteration are learning aids.
