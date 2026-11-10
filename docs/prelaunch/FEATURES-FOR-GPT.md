# Ayah a Day / Ayah Quest — current product brief for pre-launch analysis

Prepared November 10, 2026 from the actual Vite/vanilla-JavaScript repository, starting at commit `d4597e4`. This describes implemented capabilities and current visibility, not a claim that every feature is deployed, approved or production-ready. Suggested improvements below are proposals, not existing functionality.

## 1. Product and intended learning loop

A browser-based Quran memorization and revision application. It combines source-backed Arabic word puzzles, real arcade games, audio repetition, learner self-assessed recitation and FSRS spaced revision. The core idea is making word order, ayah order and adjacent-ayah transitions tangible and visible.

The intended supported-study loop is: choose a goal and passage → listen and assemble → practise recognition with fewer hints → recite without visible text → reveal/compare and honestly self-grade → return when due. Learners can also freely revisit games. The current interface does not enforce one universally simple path through all the available modes.

**Crucial assessment distinctions:**

- A correct puzzle establishes that the displayed arrangement/selection was correct.
- An arcade result also reflects navigation/motor performance; those errors must remain separate from Arabic-choice errors.
- Self-assessed recitation means the learner reports Again/Hard/Good/Easy after attempting and comparing. It is not teacher-verified or automatically speech-verified.
- Comprehension assessment means matching/classifying approved lesson evidence, not memorization mastery.
- Experimental AI transcription is uncertain assistance, never certified tajweed or proof of mastery.
- Only the established eligible independent-recall workflow updates FSRS; winning an arcade game must not do so.

## 2. Content, access and release boundaries

| Area | Implemented scope | Current access/readiness |
| --- | --- | --- |
| Free Quran library | Al-Fatihah and every surah in Juz Amma (78–114): **38 surahs, 571 ayahs** | Core free content works without subscription or account |
| Arabic and learning aids | Verified Uthmani Arabic, original word positions, English translation, word meanings/transliteration; Arabic font and RTL layout | Canonical text is preserved, not generated for challenges |
| Audio | Full-ayah recitation and existing free word clips; 2,914 bundled public clips including a few authentic cross-surah distractor word recordings | Volume/replay/repeat and mute/support options; private long-ayah isolated clips are not assumed available |
| Quran-wide architecture | Canonical references and surah/ayah/juz mappings covering all 6,236 ayahs | This is a catalog, **not complete released Quran text** |
| Private source inventory | 639 staged source-validated ayahs: Al-A'raf, Juz 29 surahs 67–77, plus long-ayah pilots 2:255 and 2:282 | Al-A'raf and Juz 29 remain developer previews under current policy. Other private pilots require applicable authorization. Do not market all Quran content as live |
| Long-ayah segmentation | Visual groupings, source/review fingerprints, teacher review of study boundaries, distinct stop/restart approval metadata | Research-draft grouping is not scholar-approved waqf guidance. Full-ayah audio remains the fallback |
| Tafsir/comprehension | Editorial source/license/reviewer workflow and playable test-fixture mechanics | Actual reviewed/published lesson material is still pending; QUR'AN CHRONICLES is coming soon/developer-only |

Premium bundles/audio are loaded through authenticated Supabase functions, not bundled as private source text in the public frontend. Saved references/local plan names are not entitlement evidence. Source revisions and account changes can invalidate active private content while preserving saved progress metadata.

## 3. Main navigation, onboarding and presentation

- Three regular lab entries: **Memorization Lab, Puzzle Lab, Revision Lab**. Daily Quests and My Progress are also available; some entries lead to overlapping dashboard functionality.
- Surah selector and per-ayah navigation. A shared passage selection can retain canonical references when moving among compatible labs.
- Collapsible Menu for account, gallery, plan/achievement and other tools; advanced/paid preview tools are currently developer-gated.
- Skippable/replayable interactive tutorial for the main learning features. Bridge Builder has its own first-time tutorial.
- **Simple** and **Night Sky** themes; theme control sits near XP/ayah totals. Night Sky adds constellation progress, navy/violet surfaces, teal/gold actions and restrained effects.
- Positive sounds, configurable encouragement audio, cycling celebration artwork/effects, transition animations, reduced-motion support and animation skipping where implemented.
- Responsive layouts, keyboard controls and large touch controls for the arcade engines. Exact coverage varies by mode; browser tests are not a certification of all physical devices/screen readers.

## 4. Memorization Lab

### Practice

The complete source ayah appears above a customizable building zone. Learners tap/drag pieces, reorder them, choose a partial sequence, listen to selected pieces, repeat playback and compare to the full recitation. Word pieces have distinctive color/shape cues, transliteration, meaning aids and simple mnemonic graphics; divine-name styling is special/gold rather than a depiction of Allah. These graphics are learning cues, not authoritative tafsir or literal illustrations of unseen realities.

Successful practice offers choices to continue practising, try Puzzle Quest on the same ayah, or proceed. A practice check is not evidence of long-term retention.

### Puzzle Quest

A three-level word-order challenge with shuffled choices and authentic distractors. Levels gradually reduce visual support; hint/reveal use is tracked. Progression uses recorded clean puzzle wins (two per level before the next level), with XP/stars and daily/repetition caps. Correct sequence checking preserves canonical words. Wrong-word options can be heard rather than silently becoming unplayable choices.

### Active Recall (concealed-word puzzle)

A supported reconstruction mode with hidden words/reveals. It exercises retrieval cues but remains a puzzle. **Do not confuse this with the separate self-assessed recitation assessment.** This naming overlap is an important UX analysis point.

### Self-assessed recall

Hide source text → attempt recitation → optionally record and play back locally → reveal and compare verified text/audio → choose Again/Hard/Good/Easy. Assistance and listening before the attempt are tracked. Learners can return to study without an invented grade. Due dates/history persist through the existing learning store.

### Ayah Chain

Choose multiple ayahs, build their word puzzles, then arrange assembled ayah cards in the intended sequence. Play the learner's chain or compare with surah-order audio. Word workspaces now support native drag, touch/pointer grips and keyboard/arrow reordering; cross-ayah word drops are rejected. Whole-ayah cards retain order controls. This teaches both internal word order and inter-ayah ordering; it is not oral certification.

### Adaptive groups and cumulative learning

The existing passage workspace is integrated into the familiar lab rather than requiring another premium interface:

- 1–12 words: one per piece; 13–24: pairs; 25–36: triples; 37+: up to five per piece.
- At most 12 movable pieces per active workspace; shorter final pieces are allowed.
- Learner-adjustable group size, Previous/Next/Jump controls, separate legacy/grouped drafts and original position IDs.
- Cumulative rounds: A → B → A+B → C → A+B+C, represented by a completed-section rail and bounded interaction window.
- Optional reviewed memory-anchor contracts for vocabulary/meaning/visual/transition cues with attribution and assistance tracking. Do not assume a complete reviewed anchor library exists for every ayah.
- Complete-ayah independent self-assessment remains separate from page completion. Visual grouping creates no approved recitation stop.

## 5. Puzzle Lab — seven distinct learner games

All preserve source-backed choices and actual mechanics; they are not merely multiple-choice cards with different backgrounds. Applicable engines support a single ayah and contiguous chains, Classic (three memory mistakes over a run) and Practice/checkpoint rules. Motor mistakes are separate. Guided/default recitation, replay, adjustable volume and supported listening/silence options vary by game. Shared long-passage adapters bound groups/stages and reject incompatible selections.

| Game | Actual interaction | Memorization purpose |
| --- | --- | --- |
| **Ayah Blocks** | Falling tetromino-like word blocks, horizontal movement, rotation (B/N or Up/X), lower/drop (Space), Hold, side parking, mobile control pad | Collect/build the ayah in order while recognising irrelevant words. Side parking is not a memory error; an incorrect committed sequence is |
| **Ayah Space** | Move a ship, aim a tractor beam, capture the next canonical item, shield/redirect distractors, travel through sectors | Ordered recognition while navigating; required pieces return if missed |
| **Ayah Serpent** | Continuous grid Snake movement, growing tail, walls/collectibles, chain portals and large direction controls | Select the next canonical word in order; wall/navigation problems are motor evidence, not memorization errors |
| **Memory Maze** | Deterministic solvable corridors, fog, exploration, rooms, landmarks, switches, doors and map controls | Recognition/continuation/connection keys, temporary memory crystals, corrective rooms and adjacent-ayah chamber links |
| **Ayah Bubble Burst** | Aim a launcher, fire moving connectors, wall ricochets, circular collisions and cluster clearing | Deliberately hit the right continuation. Empty-space misses are motor errors; color does not identify correctness |
| **Sirat Quest** | Real side-scrolling movement, gravity/jumps, moving platforms, camera and safe checkpoints; in-scene Arabic door cards and Space entry | Memory-powered platforms, Guided Garden/Mountain/optional Star routes, assisted Echo charges, elevators and a final continuation sequence. Fictional architecture, not the eschatological Sirat |
| **Bridge Builder 2.0** | Two islands, next-opening connectors, a physically forming bridge and a lantern/traveler crossing; cumulative chain map | Recall the end-to-next-opening boundary. N consecutive ayahs yield N−1 real transitions; beginner/standard/cold-recall support, optional Bridge Gate and a replayable Al-Ikhlas tutorial |

Shared settings separate **memory difficulty** (guided/standard/expert: hints and distractors) from **motor difficulty** (relaxed/normal/arcade: speed/navigation). Available settings depend on the selected entry/engine; it is not a claim every old setup screen is identical.

Legacy **Vanishing Ayah, Jigsaw, Memory Match, Broken Chain, Continue the Ayah and Similar Ayah Detective** retain their IDs/history but are currently developer-only, not ordinary learner launch features. The older engineering/load-testing version of Bridge Builder has been retired from active gameplay.

## 6. Revision Lab and Cosmic Rush

Opening Revision Lab opens the Cosmic Rush mission planner directly. Original free Cosmic missions remain restricted to Al-Fatihah/Juz Amma. Selections include 5/10/15/20/30 ayahs, custom contiguous ranges and an entire supported surah; short selections clamp appropriately. Missions have approximately five-ayah stages, deterministic ordering, stage summaries and saved checkpoints.

### Cosmic Rush's interconnected activities

1. **Star Runner:** real three-lane ship movement; keyboard/swipe/touch; flowing authentic words/chunks/ayahs mixed at a target ratio of **5 chunks : 1 whole ayah : 4 single words** where the source permits. Minimum three, up to ten revision rounds, with gradually increased movement demands/asteroids. Normal flight is now 30% slower than the earlier baseline; boost is 50% faster than the earlier boost. Space fires at neutral rocks, B/touch boosts, correct boosted captures add a star burst and bounded bonus points. Every Arabic candidate also shows existing source transliteration. Target audio cues slow rather than stop flight.
2. **Memory gateways:** safe, untimed orbit at appropriate checkpoints; attempt the next continuation before choices, then steer/choose a canonical gateway. Incorrect choices lead to recoverable study/repair, not erased progress.
3. **Meteor Defense:** aim/fire at neutral meteor hazards, protect an energy core, shield/repair abilities and waves. Current full-ayah recitation supports revision during waves; in-scene gateways keep choices near gameplay.
4. **Protect and Capture variant:** separate Blaster for neutral hazards and Tractor Beam for protected Arabic carriers. Correct next capture advances the source sequence; wrong committed capture is a memory error. Arabic text is never destroyed; missing objects return. Private contexts use the shared authorized adapter rather than bypassing the free Cosmic manifest.
5. **Ayah Link:** demonstrate consecutive ayah endings/openings, optionally listen to full recitations, visually fade markers, recall/restore both boundary endpoints and connect a constellation chain. Pointer/touch/keyboard alternatives, marker restoration, authentic unambiguous choices and source-pinned pair evidence. Marker removal does not redefine waqf rules.
6. **Phrase repair / Weak-Link Boss:** reconstruct approved phrases where available, otherwise use whole-ayah fallback; disable boss shields through real memory challenges. Prioritise actual recorded difficult transitions; label baseline challenges honestly when no evidence exists. Hints/retries remain available.
7. **Final recitation:** hide the passage, prompt oral recall, reveal/compare and use the existing native rating. Gameplay completion is distinguished from the actual self-assessment and its schedule.

### Memory Rescue and Long-Surah Marathon

A unified revision route selects suitable activity from actual mistakes, transition evidence, self-reported difficult recall and stored due dates. Recommendations explain their evidence and do not diagnose missing data as weakness.

Marathons support bounded approximately five-ayah stages through 5/10/15/20/30/custom/whole-surah ranges. A stage offers study audio → compatible real game → optional reduced-assistance repetition → actual adjacent links (including stage seams) → native self-assessment → summary. Resume rechecks private access/source revisions. Some unfinished physics restart within the retained content stage; saved progress is not a promise of exact frame-perfect restoration.

## 7. Passage Builder and advanced Quest previews

Passage Builder remains a compatibility route/studio alongside integrated lab workspaces. It provides authorized ayah/range selection, bounded grouped practice, saved drafts, reconstruction of the full ayah, passage chaining, continuous full audio and native assessment. Learners can select games by checkbox rather than being forced through every engine. After **16 actually earned practice XP** for the selected scope, another game prompts the native self-assessment; an honest difficult grade may continue supported study. No Good/Easy result is forced.

Advanced direct menu entries are currently developer-gated:

- **Passage Expedition:** constellation campaign map with Discovery/audio, Word Forge, cumulative Passage Link, compatible arcade trials, independent Memory Challenge and genuine-progress reveal. Stage records/source hashes support resume/recovery.
- **Constellation Rescue:** stars projected from existing passage recall units with upcoming/due/overdue states, guided routes into native review and corrective practice. Dimness is not a diagnosis of forgetting or a missed-day penalty.
- **Memory Repair Workshop:** transparent classification of observed selection/order/transition errors, source-backed confusion, assistance and actual recall difficulty; targeted arcade mission and a subsequent recall opportunity. Cosmetic repair does not move FSRS dates.
- **Muraja'ah Boss Rush:** opening, continuation, similar-passage discrimination, consecutive-ayah and final independent-passage gates; progressively demanding memory tasks, Classic/Practice resources and genuine native assessment.
- **Hifz Survival:** coverage/endurance over learner-selected recorded memory units, due-first selection, three lanterns, campsites, assistance/recovery, short/extended routes, pause/resume and a real session summary.

Some of these can also be reached from an authorized studio. Shared source authorization still applies; a menu toggle alone cannot release premium material.

## 8. Personalization, rewards and social features

- **Goals:** daily habit/specific surahs/review aims; minutes/day, days/week, target and self-reported known surahs, confidence (“new/shaky/ready”). Known claims do not automatically create mastery.
- **Daily Quests:** due-now/due-today/weak/upcoming units, suggested new work, start-review actions and next-step guidance. Suggested study responds to confidence and actual records.
- **Progress/achievements:** activity calendar/history across dates, streak tracking, progress summaries, achievement graphics and future targets. Missing a day does not generate a fake recall lapse or negative XP.
- **XP/stars:** supported study actions across modes contribute; stronger independent/due recall rewards, receipt idempotency and daily/repetition caps limit ordinary UI farming. Listening/assistance is not independent success. Local tampering is not magically prevented by those browser caps.
- **Seeds currency:** 1 earned XP = 1 Seed; 1 earned star = 5 Seeds, minus cosmetics already bought. Spending never removes learning XP, stars or mastery.
- **Companion Shop:** curated plants/nature creatures (e.g. sprout, owl, fox, turtle), outfits/colors/scenes, ownership/equipping and server purchase validation. This is an extensible catalog, not an already operating automatic content-update service.
- **My Account customization:** private resized profile image, removal/export; public rankings use curated companions, not uploaded photos.
- **Weekly leaderboard:** opt-in alias, top ten, all-mode dated activity totals, theme-specific podium/comet/star presentation. Weekly score differs from lifetime XP; spent Seeds do not reduce ranking. Public totals are practice activity, not verified recitation or religious merit.
- **Mastery Gallery:** mosaics/artwork checkpoints based on independent self-assessment across distinct days, separate from puzzle XP; permanent earned unlocks with current revision needs still visible. Original thirteen-surah gallery scope, artwork fallback assets/editorial contracts, and a blank poetic-tafsir perk tab. The repository currently has placeholder art assets rather than a complete final supplied artwork library. Do not advertise the blank tab as published tafsir.

## 9. Accounts, persistence, privacy and payment architecture

**Accounts:** guest study; separate passwordless email-code create/sign-in flows, Google OAuth, persistent sessions/refresh, this-device/all-device sign-out and account deletion. Authenticated profiles do not automatically inherit guest data; explicit copy is available where supported. Account UI currently targets adults/parents, not open unsupervised child registration. Self-declaration alone is not a legal age-assurance solution.

**Storage:** stable surah:ayah IDs; separate puzzle/game and memory evidence; versioned browser stores; private cloud backups and conflict/restore recovery. Core learning, passage recall and the Cosmic cloud whitelist have different sync flows. Several newer campaigns, grouped drafts, game checkpoints and Chronicles backpacks remain **account-scoped device-local plus export**, not automatically merged across devices. Custom encouragement audio is separate device-local IndexedDB media and is not included in JSON progress exports; temporary recitation blobs are not a persistent recording archive. Export raw malformed records; do not clear storage to “repair” progress.

**Security architecture:** Supabase verified identities/RLS, owner-bound asynchronous writes, private source functions, server billing entitlements, role-controlled editorial publishing and source hashes. These implementations still require real deployed A/B, storage-policy and downgrade testing; a localhost SQL emulator is not a deployed security audit.

**Billing — prepared, not validated live:** Stripe-hosted Checkout and Customer Portal, authenticated Edge Functions, signature-verified idempotent webhooks, separate test/live modes, paid-through access, no progress deletion on cancellation and server-side juz selection. Pricing:

| Plan | Monthly / annual | Intended entitlement |
| --- | --- | --- |
| Free | $0 | Al-Fatihah/Juz Amma and existing free learning/basic revision |
| Explorer | $3.99 / $35.99 | Five chosen additional eligible juz, Passage Builder |
| Pathfinder | $6.99 / $59.99 | Available all-Quran content, advanced revision/analytics; AI only under flags |
| Guardian | $11.99 / $99.99 | Advanced AI tier, initially disabled |

Paid menus are developer-gated today, and content publication limits still apply. A plan price is not a claim its complete future catalog exists. Real sandbox checkout/failure/renewal/cancellation/change/expiry tests remain necessary; live billing requires separate validation. Use the repository's Stripe setup/checklist, not success-URL simulation.

## 10. AI and comprehension — experimental/non-launch features

**Local recording:** browser microphone permission, record, local playback, compare with original reciter individually or together, delete/replace. It is separate from third-party submission and is not a persistent cross-device recording archive.

**Experimental recitation comparison:** authenticated server-only OpenAI transcription (`whisper-1`), source-backed comparison of possible omissions/substitutions/repetitions/order differences, abstention/uncertainty, correction feedback, metadata/model logging and deletion controls. Adult pilot approval, reviewed privacy flags, paid AI entitlements, explicit per-recording consent, atomic monthly limits, rate/type/size/time bounds. Raw audio is not stored by the app by default. No certified tajweed, pronunciation or mastery claim; teacher-reviewed evaluation/false-positive/false-negative evidence is still needed before release.

**Hifz Coach:** implemented daily/weekly rules-based planning from goals, due workload, recorded mistakes/history, minutes and available days. Optional external AI enriches bounded recommendations using minimized aggregates, entitlement/quota/privacy/consent gates and cache/fallbacks. It does not invent progress or override the scheduler. Its direct menu is currently developer-only.

**QUR'AN CHRONICLES:** coming-soon developer preview. Real side-scrolling exploration, collectibles/backpack, archive/assembly locations, Knowledge Constellation matching with actual lines and one-to-many relations, Evidence Detective classifications and lesson objectives. Discovery alone earns no comprehension XP; bounded assessment receipts remain separate from memorization. Editorial workflow distinguishes Quran/translation/tafsir/history/reflection, exact citations, licensing, source revisions, independent review and explicit publish/withdraw. Real reviewed lesson publication is pending; software fixtures are not religious material. The suggested SafhaJournal English Ibn Kathir repository has CC BY 4.0 conditions and AI/machine-review limitations, not scholarly lesson approval.

**Developer controls:** owner preview toggle with a visible gradient shift, private-library access, advanced previews, menu-order preview/save and editorial/review tools. This is not a general drag-anything website builder. Server role/entitlement checks remain necessary even when the UI looks like developer mode.

Native App Store/Google Play releases, comprehensive offline installation and classroom roster/teacher-student management are not established by this repository/audit. Editorial reviewer tools are not a classroom-management system.

## 11. Main launch risks and improvement opportunities

These are analysis recommendations, not claims that every risk is a reproduced code bug:

1. **Simplify the first learning session.** There are many overlapping labels, dashboards and pathways. Give a new learner one goal, one short passage and one clear next action; introduce extra games later.
2. **Clarify the two “recall” experiences.** Concealed-word recognition is different from independent self-assessed recitation. Consider explicit labels and a single visible step-by-step learning ladder.
3. **Measure retention rather than engagement alone.** Track due-review completion, independent vs assisted attempts, distinct-day retention and transfer from games to recitation. XP, speed and time in a game cannot demonstrate memorization.
4. **Add a focused game layout.** Current pages can place substantial navigation/tutorial/progress content above the actual mobile arena. Consider focus/fullscreen-style presentation, in-arena instructions and one clear exit, without losing accessibility/audio controls.
5. **Explain sync scope before collecting accounts.** Avoid “everything syncs” wording until local-only drafts/campaigns have conflict-safe cloud support.
6. **Launch a narrower public surface.** Keep incomplete premium content, AI and comprehension unavailable rather than mixing preview capabilities with paid promises.
7. **Complete real operator privacy and child-safety work.** Religious learning, profile images, voice and cloud history can be sensitive. Add actual controller/contact/retention/consent policies and review the age approach; no blanket compliance claim.
8. **Validate with Quran teachers and real learners.** Review mnemonic meaning cues, source/audio alignment, repeated openings, comprehension interpretation and genuine transfer to oral recall.
9. **Test physical devices and assistive technology.** iOS/Android audio focus, touch targeting, mic permission/codecs, VoiceOver/TalkBack, text zoom and low-end performance are not established by emulation alone.
10. **Review reward pressure.** Explain weekly vs lifetime scores, XP/stars/Seeds and retained-memory states. Allow noncompetitive learning and assistance without shame. Avoid presenting leaderboard rank as Quran mastery.
11. **Treat transliteration as optional scaffolding.** Consider learner-controlled visibility/fading and teacher review, rather than assuming English phonetics substitute for recitation guidance.
12. **Manage performance and deployment.** Heavy games are lazy-loaded and workspaces bounded, but the free audio artifact is large (~182MiB, not all initially fetched). Test CDN/range/cache behavior and real cold loads. Railway is manually deployed; the deployed frontend/functions can lag GitHub.

## 12. Prompt to paste into GPT with this brief

> Act as a Quran education product reviewer, learning-science reviewer, UX/accessibility reviewer and software QA lead. Treat the implementation/status distinctions in this brief as facts; do not assume previews are launched, AI is accurate, lessons are scholarly approved or payment tests passed. Evaluate the existing product before proposing new features. Identify overlapping/confusing flows, risks to genuine independent recall, excessive cognitive load, mobile friction, accessibility barriers, privacy/content-licensing concerns, monetization mismatches and release blockers. Rank recommendations P0/P1/P2 by learner benefit, severity, confidence and implementation effort. Separate reproduced bugs from hypotheses and external setup tasks. Recommend a minimum viable public launch scope, a simpler first-session journey, teacher/learner usability studies and measurable retention outcomes. Preserve unrestricted free Juz Amma, canonical Arabic/audio integrity, existing records and the established FSRS scheduler. Do not propose unreviewed tafsir, fabricated Quran text or automatic tajweed/mastery certification. Finish with a short actionable launch checklist.

Read [the current bug/test findings](BUGS-AND-LAUNCH-CHECKS.md) alongside this brief. This document is a product inventory, not a release certificate.
