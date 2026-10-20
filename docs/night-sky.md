# Night Sky appearance

Night Sky is an optional presentation layer. Simple remains the default. Open **Encouragement settings → Appearance → Choose theme**, preview Night Sky, then Apply. Cancel or Escape restores the saved appearance. The Reduce celestial effects checkbox, existing motion preference, and browser reduced-motion setting all suppress decorative movement.

## Development and validation

Use Node.js 24, run `npm ci`, then `npm run dev`. Existing checkouts can be reused; no worktree is required. Run `npm run build` and `npm test -- --workers=2`. Chromium is configured at `/usr/bin/chromium` in this cloud environment. No new dependencies or external art requests are required. Setting `VITE_NIGHT_SKY_ENABLED=false` disables Night Sky and safely falls back to Simple.

The baseline build and 112 tests passed before implementation. The final production build and 127 tests passed, including model, browser, profile isolation, failed persistence, exact Simple screenshot equality after theme cancellation/restoration, and owner-only appearance SQL policies. There is no lint script. [Screenshot index](night-sky-screenshots/README.md) contains 43 captured states. Account and leaderboard captures use mocked service responses, not real accounts. The automated bright-surface audit reported no unexpected bright panels. See [coverage matrix](night-sky-route-coverage.md).

To regenerate screenshots, start the development server, then run `node scripts/night-sky-screenshots.mjs` with its internal server address as the argument. The script seeds actual FSRS review fixtures and mocks authentication requests; it does not send real sign-in emails.

## Persistence and cloud setup

`ayah-appearance-v1` stores a versioned theme ID, reduced-effects preference and timestamp. Guest storage stays separate from verified account storage. Preview never writes preferences. Local persistence failure leaves Apply available for retry; remote failure retains the local selection without blocking learning sync. Stale remote responses after an account switch are ignored.

For cross-device appearance, apply `supabase/migrations/20261020_appearance.sql` in the Supabase SQL editor. New installations can use the regenerated `supabase/SETUP_ACCOUNTS.sql`. This independent owner-only table does not modify the learning-progress RPC or whitelist. This migration has been validated locally with PGlite; it has not been applied to the live project from this environment. Without it, the theme remains device-local and learning synchronization continues normally.

## Progress semantics and effects

Constellations read canonical `ayah-learning-v1` records. Only `memory.stage === retained` lights a mastered star. Puzzle wins and old completions indicate in-progress at most. Due review is a separate visual ring and never removes mastery by itself. Existing Arabic, fonts, RTL ordering, audio, FSRS, grading, rewards and gallery artwork unlock rules are unchanged.

Layouts are deterministic by surah and ayah identifiers. Interactive maps render at most 24 stars per page; the Galaxy catalogue renders six surahs per page. Longer catalogue thumbnails label the first-24 preview. A star opens the existing self-assessed recall flow with its text hidden. Decorative backgrounds have no hit targets, and no canvas or animation loop is used.

Success feedback stays inline, uses existing sound settings, and does not cover the answer controls. Surah completion uses an independently persisted presentation receipt (`ayah-sky-celebrations-v1`), confirmed before showing the effect; it never grants XP. Existing completed surahs are silently acknowledged on first observation. Receipts are local per profile: a completion effect can recur on another device if that device first observes the surah while lapsed and later sees it retained again. Memory and rewards remain canonical and synced independently.

## Adding another theme

Add its stable ID and metadata in `src/themes/registry.js`, extend the ThemeId documentation, and add a preview-card style. Load a new stylesheet scoped to `:root[data-theme="your-id"]`, using shared surface/text/accent tokens. Keep Simple selectors untouched. Extend the appearance SQL theme allowlist before enabling remote persistence for the new ID. Add preference validation, preview/cancel, profile-isolation and screen coverage tests. Celestial maps are Night Sky-specific; another theme does not need to change any learning model or implement them.

## Reference boundary

The supplied visible image guided the purple-indigo sky, crescent, distant landscape and constellation treatment. The original PNG bytes were not attached as an accessible file, so no original PNG is archived. The Markdown brief is preserved in `design-references/`. Runtime SVG decorations are original lightweight implementation assets; no reference-image Arabic, fictitious progress or scores were copied.
