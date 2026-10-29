# Puzzle Lab names, recitation volume and touch controls

The three playable game names are now **Ayah Blocks**, **Ayah Space** and **Ayah Serpent**. Internal identifiers (`falling`, `asteroids`, `snake`), source filenames, reward buckets and saved records are unchanged. Existing XP, stars, receipts, progress and FSRS schedules need no migration.

## Recitation volume

Puzzle Lab's settings include a labeled **Recitation volume** slider (0–100%) beside the existing mute control. The default is 50%. Changes affect the current recording immediately and all subsequent word/ayah clips, including looping recitation, replay, new rounds and mode changes. A zero setting stays silent after reload; mute/unmute retains the chosen volume.

`ayah-lab-volume` is a device-local preference, shared across Lab modes. It is separate from encouragement/chime volume and from progress/account data. Malformed or inaccessible preferences fall back safely; a storage-write failure does not prevent changing the active volume. No Supabase migration is required.

`src/puzzles/audio-level.js` supplies the playback level for legacy Lab audio, Blocks and the shared arcade audio manager. Ordinary browsers use media-element volume. Supported iOS media playback uses an owned Web Audio gain stage because per-element volume follows hardware volume on iOS; unsupported/mock audio falls back safely. Values are clamped to 0–1, with no amplification. Sources disconnect on stop/end and owned gain/context resources close on disposal. Verified MP3s and recitation speed are unchanged.

Browser tests cover live changes in all three games, new clips, mute/unmute, reload, zero, invalid storage, media fallback, and a simulated gain graph's level/cleanup. Real iOS/native WebView audio still belongs in release device QA; tests do not claim App Store certification.

## Ayah Blocks controls

- Left/right arrows move; Down lowers; Space drops; C holds; P pauses.
- **B or N** rotates, with Up and X retained for existing learners.
- Shortcuts leave text fields, sliders, selects, dialogs and other normal controls to the browser.
- A large two-row pad provides Left, Rotate, Right, Lower and a wide Drop button. Primary targets are at least 64 × 68 px (72 px high on phones), with explicit labels and accessible shortcuts.
- Hold, pause and listening controls are separate, with at least 48 px height.
- Starting on a phone scrolls the board into view; the main pad follows immediately below it. Direction/piece rules, always-visible Arabic, side parking, speed difficulty, scoring and completion prompts are unchanged.

These are native DOM controls using keyboard, pointer and touch input, with responsive browser layout and no hover-only actions. A future App Store/Google Play build can reuse this UI. Native packaging, lifecycle integration, authentication redirects, offline assets and real-device QA remain separate release steps.

## Validation and previews

`tests/arcade-controls.spec.js` covers preferences, gain cleanup, all-game playback levels, naming, reload, keyboard rotation, native slider keys and real mobile touch targets. Existing puzzle, Snake, Space, account, FSRS and accessibility tests remain in the full suite.

[Mobile Blocks controls](arcade-controls-previews/blocks-mobile.png) · [Desktop Blocks controls](arcade-controls-previews/blocks-desktop.png) · [Phone volume control](arcade-controls-previews/volume-mobile.png). Real local UI screenshots, with verified Arabic and no mock progress. Reproduce with Vite on port 5190 and `node scripts/arcade-controls-screenshots.mjs`.

Validation: **252 tests passed** in the full Playwright suite, including all existing game, account and FSRS checks. Production Vite build passed. No hosted configuration or database changes were made.
