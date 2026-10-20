# Night Sky — Option 2: Codex implementation brief

## Mission
Implement an **optional**, site-wide **Night Sky / Galaxy** visual theme for the existing Qur'an memorization app, inspired by **the purple-indigo, moonlit, nebula-rich Option 2 concept** shown in our design conversation. The app's **current visual appearance must remain the default `simple` theme** and its behavior must not change. Users can opt into `night-sky` from Settings and switch back at any time. The theme must extend to every existing page, game, quiz, puzzle, review screen, modal, empty state, toast, loading state, success state, and authenticated/unauthenticated page where theming applies. Keep the memorization exercises functional and at least as usable as before.

## Visual source of truth — IMPORTANT
**Primary design reference:** the image titled **Night Sky Template**, **Option 2** in the ChatGPT conversation. It is the concept with **deep violet / indigo space colors, soft glowing cyan/lavender constellations, a moon, nebula glow, dark translucent glass panels, and scenic mosque/mountain horizon details**. Use this specific version, **not** Option 1 (navy-and-gold minimal), Option 3 (observatory blue), or Option 4 (warm gold). Before implementation, place the actual image in the repository as:

`design-references/night-sky-option-2.png`

If that image is not supplied, **do not pretend to have inspected it**. Implement from this written brief, and flag visual signoff as blocked until the image is provided. Codex should inspect the reference image if it can receive images as inputs.

The reference is **a style and composition reference**, not a literal screenshot of production behavior. It may contain invented routes, numbers, surah names, Arabic text, labels, and controls. Keep actual site data, ayah text, authenticated state, established flows, and existing content as authoritative. Never copy mockup Arabic into the app.

## Design north star
**"Every ayah a star; every completed surah a constellation."**

- Space palette: background `#070A20`, elevated background `#0F1433`, nebula indigo `#252167`, violet `#6F5AE8`, moonlit periwinkle `#A6A6FF`, starlight blue `#7DE2FF`, text `#F7F8FF`, muted text `#BCC6E4`; adjust for WCAG contrast and visual fidelity during implementation.
- Background: deep-gradient night sky; a sparse field of small, subtly twinkling stars; restrained nebula/radial highlights. Use layered CSS/SVG assets and optional static optimized image layers where tasteful. Decorative celestial elements go **behind** content, do not obscure Arabic or controls.
- Surfaces: translucent navy/indigo cards, hairline cool-violet borders, subtle backdrop blur, restrained glows, 12–20px rounded corners. Unify forms, inputs, buttons, dialogs, dropdowns, progress bars and feedback states.
- Primary action: moonlit violet/periwinkle gradient. Success: a brief glowing cyan/lavender star pulse; errors: clear legible red/coral plus text. Avoid relying on color alone.
- Typography: preserve the current site's Arabic Qur'an font and verse layout exactly; do not use decorative Latin display font for Qur'anic script. Typography must retain readability, diacritics, RTL order, and verse numerals.
- Scenic silhouette motifs are subtle and localized, e.g. dashboard hero/footer, never behind key memorization text.
- Make the design coherent on mobile, tablet, and desktop; the concept poster is desktop inspiration, not a 1:1 mobile layout specification.

## First action: repository audit and scoped plan
1. Identify framework, routing, design system, theme method, storage/auth, game registry, memorization/revision flow, success events, progress model, tests, CI and existing animations.
2. Inventory **all** routes and user-visible states. Produce `docs/night-sky-route-coverage.md`: route/screen, main components, completion state, theme impact, verification check, and status.
3. Identify a single trusted progress source; distinguish **mastered**, **in-progress**, **needs review**, and **not begun**, and check whether progress is per-user and persists across sessions.
4. Before changes, run available build/test/lint commands and note baseline failures. Do not change app state structures without need.
5. Produce a short proposed file-change list, then implement in small checkable stages. Preserve existing app structure and features.

## Architectural contract
- Theme IDs: `simple` (default and unchanged) and `night-sky` (new). Support future themes without rewriting components. Define typed theme IDs/tokens and a theme registry for future additions.
- Apply theme using a root data attribute or equivalent design-system theme provider: e.g. `<html data-theme="night-sky">`. Use CSS custom properties / token aliases (`--app-bg`, `--surface`, `--text`, `--muted`, `--accent`, `--border`, `--focus`, `--success`) and theme-aware component variants. Avoid scattered pathname-specific color overrides.
- For first-time users default to `simple`, unless product requirements or existing settings clearly dictate otherwise. Persist a preference per user with the repo's existing account/settings mechanism when available, with local fallback for guests. Sync after login, handle logout/account switching properly. Prevent incorrect-theme flash on initial render if feasible.
- Do not make themes alter routing, content, problem generation, memorization grading, spacing algorithms, audio behavior, server authorization, entitlements, or scores. Keep domain data separate from presentation.
- Loading and third-party canvas/WebGL games need theme-aware wrappers and in-game palette adaptation. If a component is unthemeable without risking functionality, document the gap and provide at least a coherent themed container.
- Respect `prefers-reduced-motion`, `prefers-contrast`, keyboard navigation, screen-reader semantics and high-zoom layouts. Background stars are `aria-hidden` and must not intercept pointer events.

## Site-wide screen specification
1. **Theme chooser**: Settings > Appearance > Theme, with preview thumbnails/cards for **Simple** and **Night Sky**. Preview, Apply, Cancel where appropriate; clearly mark active mode. Theme preference persists on refresh, login, and device if existing settings support cross-device. Future gallery-friendly structure.
2. **Navigation and app shell**: nav/sidebar/header/footer, mobile menu, breadcrumbs, dialogs, popovers, scrollbars and page transition backgrounds use the selected theme. The starfield remains behind content rather than restarting aggressively during route changes.
3. **Dashboard**: a 'Your Qur'an Sky' / star-map section driven by real progress, with gently glowing active constellations, completed constellations bright and connected, locked/not-started stars dim, and a calm resume-memorization CTA. Do not remove current dashboard functionality.
4. **Surah catalog**: every surah card gets a little constellation thumbnail and accurate progress treatment. Filters/search/sorting work unchanged.
5. **Memorization modes and every game**: retain each mode's interaction and grading logic. Use star-like counters/paths, theme-aware answer selections, hint/reveal surfaces, timer/progress elements, shuffled-word tiles, puzzle pieces, audio controls, match cards, game-over/retry states, correct/incorrect feedback, and scoring results. **Success animation must not slow answering or advance automatically unless existing flow already does.**
6. **Ayah player / individual surah view**: a navigable constellation track of ayah nodes that reflects live stored status. Current node gently pulses, mastered nodes glow, unmastered nodes remain dim, needs-review nodes have distinct accessible visual treatment. For long surahs, virtualize or paginate, do not render thousands of expensive interactive objects. Keep ayah text large and unobstructed.
7. **Revision / spaced repetition**: themed revision queue and review status, due markers, missed/weak spots, completion and scheduling states; maintain exact review logic. Stars may shimmer after a correct review but do not convert revision success into new memorization mastery.
8. **Progress / profile / achievements**: Galaxy of Progress map, completed-surah constellation gallery, stars earned and stats based on real data. Existing charts should take CSS tokens; do not fabricate points or achievements.
9. **All remaining routes/states**: onboarding, sign-in, settings, help, loading, error/404, upgrade/paywall where present, popups, toasts, confirmation prompts, empty states, mobile nav. No unthemed white panels in Night Sky.

## Progress-to-star data semantics (critical)
- One **ayah** maps to one **stable star node** `surahId + ayahNumber` in its own surah constellation. Decorative background stars are NOT ayahs and do not affect progress counts.
- Each surah gets a **stable, deterministic, distinct constellation layout**. For short surahs, use a graceful, recognizable shape. For very long surahs, use a spiral/arc/cluster with zoom or chunking, not a forced polygon of hundreds of segments. Seed layout deterministically by surah number, don't randomize every render.
- Show real statuses: `notStarted`, `inProgress`, `mastered`, optionally `reviewDue` as an overlay. Source from existing mastery records; if only completion flags exist, map conservatively and do not invent mastery.
- An individual node lights up **only on a confirmed persisted mastery transition**, or as a clearly provisional UI effect while save is pending. On save failure revert/indicate retry. Repeated practice of an already-mastered ayah must not add another star or duplicate an achievement.
- Connecting lines slowly draw in as mastery progresses; **full constellation celebration** only when all required ayahs are mastered. Store or derive completion idempotently. If user resets/revokes mastery, UI updates truthfully.
- Surah thumbnails and the Galaxy view use the same data and layout generator so visual state stays consistent site-wide.

## Animation language and triggers
Implement lightweight animation primitives, not a continuous CPU-heavy canvas loop. Prefer CSS transforms/opacities and SVG stroke animation. Use requestAnimationFrame only as needed; suspend when document hidden. Cap particle counts and use one shared decorative effect layer.

| Trigger | Animation | Duration / behavior |
|---|---|---|
| Page enter | content fades/slides 4–8px while stationary background remains | 180–300 ms |
| Hover/focus | nearby star glows or card subtly lifts; focus ring remains visible | 120–200 ms |
| Confirmed answer correct | one tiny starlight pulse near feedback control, optionally 2–4 sparkle motes | 350–550 ms; no blocking |
| Confirmed newly mastered ayah | its constellation node ignites, halo expands, adjoining stroke lights | 650–1000 ms |
| First complete surah | constellation lines connect / brighten, one shooting star passes overhead, reveal 'Surah complete' card | 1.5–2.5 s, dismissible, nonblocking |
| Review complete | soft twinkle on review badge, no new ayah star unless independently mastered | <700 ms |
| Dashboard return | already-earned stars ease to their steady lit state, no fake re-earning | <500 ms |
| Idle | 1–3 slowly twinkling stars in each viewport; very rare subtle shooting star | low activity, avoid distracting study |

**Reduced motion:** no shooting stars, camera movement, ambient rotation or particles; use instant updates/simple opacity if needed. Also provide a user option 'Reduce celestial effects' if doing so fits existing settings. Do not animate directly behind Arabic text, critical answer options, or time-limited puzzles. If adding sound, default off and do not replace existing completion ding.

## Components / suggested boundaries (adapt to current repo)
- `ThemeProvider` / theme registry / CSS token files
- `ThemePicker` and `ThemePreviewCard`
- `NightSkyBackdrop` (decorative, fixed, pointer-events none)
- `Star`, `Starfield`, `ConstellationMap`, `ConstellationThumbnail`, `AyahStarNode`
- `CelestialTransition`, `MasteryStarBurst`, `SurahCompletionSequence`
- `useTheme`, `useMotionPreference`, `useSurahConstellation`, `useProgressForTheme`
These are **suggestions**; use idioms of the actual stack and reuse extant components.

## Implementation phases
**Phase 1 — Foundation:** Audit, route inventory, theme registry, site-wide tokens, preference persistence, Theme Picker, backdrop, accessibility hooks, feature flag. Gate: toggling themes doesn't change app functionality and Simple still matches original screenshots.

**Phase 2 — All screens:** Theme wrappers and tokens across app shell, shared components, all routes, games, quizzes, dialogs, mobile views and paywalls. Gate: no bright/unthemed leftovers; route matrix checked.

**Phase 3 — Star progress:** Implement stable constellation generation, data adapters and UI integration into dashboards, surah pages, game completion, revision and profile. Gate: count/status parity with actual progress; no duplicated stars or fake successes.

**Phase 4 — Motion and transitions:** Trigger-driven success, mastery and surah completion effects; route transitions; subtle ambient twinkle; reduced motion. Gate: no input-blocking animations and no visual interference with Arabic.

**Phase 5 — QA / polishing:** Tests, screenshot comparisons (desktop/tablet/mobile), memory/performance pass, keyboard/contrast checks, persistence, browser tests, feature flag rollout. Gate: signoff checklist passes.

## Acceptance tests (write automated tests where architecture allows)
- New/anonymous users see Simple by default and can switch to Night Sky and back; preferences work after refresh. Account switches do not leak appearance preferences.
- The **existing Simple theme pixel appearance** and all game behavior remain intact apart from explicitly approved changes.
- Night Sky covers **every inventory route and game**, including overlays and success/error paths.
- On correct answer without mastery, show correct feedback but don't prematurely mark ayah mastered. On actual mastered transition, exactly one correct star lights.
- Finishing the last mastered ayah in a surah creates exactly one completed constellation; duplicate event/retry cannot duplicate the celebration/reward. Revision-only practice cannot give new mastery credit.
- Delayed/failed persistence doesn't permanently light incorrect stars; offline/online transitions reconcile.
- A surah with 3 ayahs and a long surah with 200+ ayahs are both readable and efficient on mobile.
- Arabic verses and diacritics render correctly, never beneath a star glow or moving decoration; recitation/audio and selection work unchanged.
- `prefers-reduced-motion` disables all optional moving celestial animations, and keyboard, touch, 200% zoom and screen readers remain usable.
- No excessive browser main-thread load, memory usage or battery drain from constantly animating stars; decorative canvas paused offscreen if used.
- Analytics/billing/entitlements/security flows remain unaffected.

## Performance & content safety guardrails
- Aim for lightweight ambient starfield built with CSS/SVG and optimized assets; particle count conservatively low on mobile. Respect browser battery saver if detectable without invasive APIs.
- Lazy-load large decorative backdrops/animations; prioritize Qur'an text, buttons, game response and first input latency.
- Avoid unnecessary paid animation dependencies and giant image bundles. No WebGL requirement unless existing tech stack already supports it reliably.
- Don't insert faux translations, Qur'anic Arabic, tafsir, new narrations or ayah numbers from the mockups into the app. Keep precise Arabic text sourced from the app's existing canonical data.
- Do not depict Allah or any Prophet in graphical scenes. Use night sky, silhouettes of architecture, landscape and abstract sacred geometry only.

## Deliverables from Codex
1. Working theme toggle + persistence + first-run default behavior.
2. Complete themed coverage of existing routes and games, with tracked checklist.
3. Data-accurate star + constellation components; coherent desktop and mobile layouts.
4. Lightweight animations tied to *actual* progress, with reduced-motion fallback.
5. Tests and before/after screenshots for dashboard, sample short surah, long surah, each game/mode, revision, achievements, settings, and mobile.
6. Documentation explaining how to add a **third theme** later without changing memorization logic.
7. A final summary listing touched files, tests run/results, unfinished limitations, and the exact steps to preview the theme locally.

## Codex prompt — copy/paste to start
> Implement the attached `NIGHT_SKY_OPTION_2_CODEX_PLAN.md` in this repository, using `design-references/night-sky-option-2.png` as the visual source of truth. It is the **purple-indigo, nebula, moonlit Option 2**, not any other Night Sky option. Start by auditing all routes, game modes, existing theme/state architecture and progression events. First write `docs/night-sky-route-coverage.md` and identify a safe staged implementation plan. Then implement a complete optional site-wide Night Sky theme while **preserving the current Simple mode exactly as default**. Use genuine progress data for one-star-per-ayah constellations, subtle event-driven animations, lightweight shared CSS/SVG effects, and `prefers-reduced-motion`. Apply theme to every game, review mode, dashboard, settings, dialogs, and mobile screens; do not change memorization/scoring business logic or Qur'an content. Add tests and screenshot evidence. If the reference image is absent, report that limitation rather than claiming you saw it. Continue stage by stage, with a build/test check at each stage, and report results.
