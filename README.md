# Ayah — Quran memorization, piece by piece

A Quran memorization app covering 38 surahs and 571 ayahs (all of Juz Amma plus Al-Fatihah), right-to-left word puzzle pieces, partial-word practice, full-ayah recitation, repetition and speed controls, scrambled-order quizzes, and hidden-word recall. Progress is saved in the current browser. No account or backend is required.

## Run

Use Node.js 24 and npm. From `/workspace/memorization-app`:

```sh
npm ci
npm run dev -- --port 5173
```

`npm run build` produces `dist/`. `npm test` runs browser tests using `/usr/bin/chromium` in this cloud environment. If using another machine, install Chromium and adjust `playwright.config.js` to its executable path.

## Sources

Arabic text and word boundaries were verified against Quran.com's v4 API. `public/quran-source.json` records the Arabic words and source URLs. The locally bundled Uthmanic Hafs font is the font distributed in [Quran.com's frontend](https://github.com/quran/quran.com-frontend-next/blob/master/src/styles/fonts.scss), downloaded from `public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2` in that repository. Quran.com supports multiple fonts; this app uses its Unicode Uthmanic Hafs option.

Full-ayah recitation: Mishary Rashid Alafasy, from `https://verses.quran.com/Alafasy/mp3/`. Individual word recordings: Quran.com's word-by-word recordings from `https://audio.qurancdn.com/wbw/`. Partial practice sequences individual recordings in the selected order; these are separate word recordings rather than a continuous cut from full recitation. Both font and all 2,914 audio files are bundled, so learning does not require external API calls.

Active recall hides alternating words and the full reference. Reveal controls let learners self-check their spoken recall. The app checks word order; it does not recognize or grade spoken Arabic. English meanings and transliteration are learning aids.

## Puzzle pieces

Practice starts with scrambled pieces. Puzzle Quest draws four to six distractor words from other supported surahs into every shuffled bank, excludes target spellings, and avoids recently used distractors. Each piece keeps its verified word recording. Choose only the ayah's words, in order. Duplicate identical words are interchangeable when checking the result.

Piece profiles use matched tabs and sockets along the right-to-left sequence. The final ayah's repeated words have separate pieces. Simple locally drawn SVG graphics offer memory associations for concrete and abstract meanings; they do not depict Allah. Divine names, attributes, and references use decorative gold accents instead. Active recall also hides the meaning and illustration to avoid giving away the missing word. The quiz checks word selection and order, not spoken recitation.

## Surah library and repeatable levels

Choose any surah from the sidebar selector (also available on mobile). All 571 ayahs include verified Uthmanic text, English meanings and transliteration, word-by-word and full-ayah audio, puzzle practice, active recall, and Puzzle Quest. The additional 564 ayahs use Quran.com's v4 API, Saheeh International verse translations (resource 20), and Quran.com's word translations/transliteration. Their word/audio provenance is saved in `public/additional-quran-source.json`.

Difficulty grows through three levels:

- Level 1: four extra words, visible word pieces.
- Level 2: five extra words, approximately one third of pieces blank.
- Level 3: six extra words, approximately two thirds blank; repeat for ongoing mastery.

Two correct rounds without text reveals unlock the next difficulty for that particular ayah. Wrong checks reduce rewards but do not block practice. The first two fresh solved rounds per ayah, per level, per day earn stars and XP; solved arrangements are locked so rechecking or removing a piece cannot award points again. Use **Play again** for a new shuffled round on the same ayah, or **Next ayah** to move on. Each 100 XP increases the overall learner level. The app tracks consecutive rounds without mistakes or reveals.

An optional eight-second peek exposes all pieces temporarily, without flashing or rapid animation. Eligible peek/reference-assisted puzzle rounds award five XP and one star and do not advance the difficulty; learners can repeat without reveals when ready. Full-ayah audio remains available as a listening aid. Progress, levels, stars, and XP are stored locally in the browser. Previous Al-Fatihah completion data and star totals are preserved. There is no speech recognition or account synchronization.

## Surahs and audio on every piece

The library covers Al-Fatihah and surahs 114 through 78. The selector shows each surah’s title and ayah count.

Use the headphones button on a piece to hear that word once without adding or removing it. This works in the word bank, building zone, and hidden-word challenges. **Listen to my pieces** reads the learner's selected sequence exactly as arranged, including incorrect extra words, with the chosen repetition count and speed. It is a learning sequence, not a verified ayah. Remove a wrong piece by clicking its main body.

Quest distractors are drawn from the full supported Quran library, with matching word recordings, meanings, and illustrations. Each round chooses distinct words from other surahs, excludes words in the target ayah (ignoring recitation marks), and avoids the last 40 distractor spellings during the current app session. All three levels receive fresh selections; recent-word history resets on browser reload. The original six recordings remain available as verified audio assets. `src/distractor-audio.json` records each word's verse, position, local file, and original Quran.com CDN URL. No synthetic text-to-speech is needed. Some Quran.com audio links have word-number offsets after pause marks (for example, 110:3 and 104:4); the source manifest preserves the API's original links in `api_audio_url` and records the corrected ordinal filenames in `audio_url`. The app uses those word-order filenames for playback.

## Advanced Ayah Chain mode

Open **Ayah chain**, choose two or more ayahs from the current surah (or **Choose all**), and start a fresh chain. Multiple shuffled word puzzles are available together. Build each ayah from right to left, listen to individual words or partial word sequences, then add the completed ayah to the chain. Incorrect word order must be corrected before adding it.

The finished ayah cards can be moved earlier/later with buttons or reordered by dragging onto another card. Return a card to its puzzle to edit its words. **Check my sequence** checks that every selected ayah is present in its Quranic order. Nonconsecutive selections are supported and explicitly labeled as skipping unselected ayahs.

**Listen to my chain** plays full-ayah recordings in the learner's chosen order; **Listen in surah order** plays the selected ayahs in their canonical order for comparison. Both respect repeat and speed controls. References can be hidden for recall. Changing surahs clears incompatible chain selections. Chain work is held in memory for the current session and does not grant challenge XP or persist through page reloads.


## Phase 1 memory foundation

Open **Daily quests** for due reviews, weak ayahs, suggested new memorization, and future schedules. **Assess this ayah** starts a text-hidden recitation assessment for the current ayah. Recite first, reveal the verified text to compare, then self-grade Again, Hard, Good, or Easy. Listening or revealing before recall is tracked as assistance and does not certify independent memory. No automatic speech verification exists.

A maintained `ts-fsrs` 5.4.2 scheduler manages independent review dates. Historical puzzle achievements, XP, and stars are safely migrated and kept separate from memory stages. Points are bounded, with higher awards for eligible independent/due retrieval than puzzle repetition. All state is local to the browser; unfinished recall sessions and completed reviews survive reloads, and Daily Quest includes an export action.

The newest additions are At-Takathur, Al-Qariah, Al-Adiyat, Az-Zalzalah, Al-Bayyinah, Al-Qadr, Al-Alaq, At-Tin, Ash-Sharh, Ad-Duha, Al-Layl, Ash-Shams, Al-Balad, Al-Fajr, and Al-Ghashiyah. See [Memory foundation and Phase 2 plan](docs/memory-foundation.md) for the data schema, migration, scheduling/eligibility rules, reward limits, evidence, limitations, and recommended next steps.

## Record and compare self-recall

In **Assess this ayah**, choose **Record my recitation**, allow microphone access, and stop when finished. Choose **I’ve recited — compare** to reveal the verified text. Listen to your recording or the Alafasy recitation separately, or **Play both together** to start both tracks from the beginning. Individual audio controls support seeking; separate volume sliders make each voice easier to hear. This is manual comparison, without automatic timing alignment or speech grading. Listening to the reciter before declaring recall still marks the attempt as assisted.

Recording requires microphone access in a supported browser and HTTPS (localhost works for development). Recordings stay in memory in the current tab; they are never uploaded or stored in learning history. Leaving the session, starting another attempt, or reloading clears the recording and releases the microphone. Assessment results and review schedules continue to persist as before. Microphone denial or unsupported recording does not block normal self-assessment. Each recording is limited to five minutes.

The remaining ten Juz Amma surahs (Al-A‘la through An-Naba) were imported with `scripts/complete-juz-amma.py`. The importer preserves existing records, downloads local recordings, and records source word spellings and any API audio-number corrections in `public/additional-quran-source.json`.

## Mastery Gallery and Puzzle Lab

Use the **Mastery Gallery** and **Puzzle Lab** buttons above the learning area. The Gallery initially covers Al-Fatihah and surahs 103–114, matching the brief's original thirteen-surah scope; all 38 surahs remain available in the learning modes and Lab.

Artwork sections unlock after correct independent self-assessed recall on **two distinct scheduled review days**. Text/audio assistance, early successful practice, visible puzzles, and old game achievements do not unlock them. Unlocks survive lapses. A separate **Maintained** award requires the existing retained stage for every ayah. The Gallery shows review dates without changing FSRS scheduling. Reveal animations last 1.2 seconds, support reduced motion, and can be skipped.

The Lab contains Falling Words, Vanishing Ayah, Ayah Jigsaw, Memory Match (meaning/audio/continuations), Broken Chain, Continue the Ayah, and Similar Ayah Detective. Falling Words supports right-to-left slots, keyboard arrows/Space, touch buttons or dragging, pause, untimed play, optional gentle timed descent, and audio. Recitation pauses timed play; resuming stops that audio. Other games use graduated cues and verified word/ayah data. Detective currently uses three manually checked comparisons from Al-Fatihah, Al-Kafirun, and Al-Falaq, and attributes practice to the actual target ayah.

Lab completion awards at most 8 XP per ayah/game/day (2 XP for study-assisted completion, with only the difference available after an unassisted completion). Games remain replayable and do not certify spoken recall or advance Puzzle Quest levels. Recommendations use practice mistakes, with independent recall recommended first when an ayah is overdue.

**Editorial work remains:** the referenced artwork table was missing, and both supplied tafsir sources returned HTTP 403. Thirteen story/asset contracts and source links exist, but final images and tafsir narratives are not published or labeled verified. Missing images show a clearly labeled local geometric placeholder. See [implementation details and remaining work](docs/gallery-puzzle-lab.md) and [artwork publishing contract](public/mastery-art/README.md).

Every playable Puzzle Lab round now includes shuffled distractors. Falling Words mixes in foreign words and provides **Discard word** (D/Delete on the keyboard); correct words must be placed and extra words discarded. Vanishing Ayah and Continue the Ayah include extra words; Jigsaw includes authentic foreign word groups; Broken Chain includes ayahs outside the requested passage. Memory Match includes foreign pairs that must remain unmatched, across its meaning, audio and continuation variants. Detective adds more authentic wrong continuations. Continue the Ayah now requires a correctly built remainder before completion can award game XP.

All options have listen controls, including incorrect pieces in the building zone and face-down cards. Word groups play their exact word recordings in sequence; whole-ayah choices use full recitations. Correct and incorrect choices share the same presentation. Distractors are drawn from the existing Quran library, exclude target-equivalent text, and vary across fresh rounds. No Quran text or recorded audio was fabricated, and game results still do not qualify as independent memorization.

## Reordering, tutorial, and encouragement

In Practice and Puzzle Quest, drag a word from the bank into a specific position, or drag an existing piece earlier or later without clearing the arrangement. On touch screens, use the ⠿ handle beneath a placed piece. Arrow buttons and Alt+Right/Left provide keyboard alternatives. Tapping the main piece still adds or removes it.

New learners receive an optional welcome invitation. **Tutorial** opens ten skippable steps with interactive examples covering the learning modes, Daily Quests, self-assessed recording, Puzzle Lab, Memory Gate, Gallery, and encouragement. Examples do not award XP or change memorization records. Skip or Escape exits immediately; the tutorial can always be reopened.

**Encouragement settings** controls the success sound, volume, and gentle star transitions. Upload an audio clip up to 5 MB and 10 seconds to replace the built-in chime in that browser; it stays in local IndexedDB and is never uploaded. For an app-wide default, see [feedback audio configuration](public/feedback-audio/README.md). Feedback stops when recitation or microphone recording starts. Motion respects the browser's reduced-motion preference, and sounds can be muted independently.

## Animated achievements and spoken-practice tips

Correct answers cycle through three animated achievement styles alongside the configured success sound. Add or replace artwork through [the celebration image manifest](public/celebrations/README.md); three emoji placeholders are used until image files are supplied. Motion preferences apply to these animations too. Study audio takes priority over the success sound, while a correct-answer visual can still appear during piece playback.

Puzzle Lab automatically pronounces selected word, group, card, and ayah pieces (including distractors). Falling Words pronounces each arriving block. Rapid selections queue their recordings. **Mute audio** silences current and future Lab playback and persists in that browser; **Unmute audio** restores it. Explicit replay remains available. Changing games or leaving the Lab clears queued playback. The Falling Words **Pause** button pauses the game board, not an audio track.

All learning areas offer spoken-practice guidance, and study text and controls use larger fonts. Listen, repeat after the reciter, and say each word as you place it; quiz success remains separate from independent memorization assessment.

## Mastery Gallery rewards

Mastery Gallery is the single destination for collectible artwork, per-ayah recall checkpoints, and review dates. Surah Journey has been removed as a separate feature; existing earned sections and memory schedules are preserved. Use **View artwork** to inspect one surah and return with **View My Gallery**.

The Gallery has **Artwork** and **Poetic Tafsir** tabs. Poetic Tafsir content is intentionally blank, with the surah's mastery eligibility shown, ready for future uploads. No poems or tafsir have been fabricated. Requested artwork titles map to Al-Fatihah (**Illuminated Path Through World**), An-Nas (**Golden Sanctuary Against the Shadows**), and Al-Falaq (**Dawn Over the Shadow Valley**). Their exact attached illustrations are still pending receipt; their local asset paths are `public/mastery-art/001.webp`, `114.webp`, and `113.webp` respectively.
