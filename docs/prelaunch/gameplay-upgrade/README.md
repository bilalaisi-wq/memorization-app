# Gameplay, revision and Smart Arabic Input upgrade

## Architecture audit and implementation

The existing Vite/vanilla JavaScript engines, shared game toolbar, automatic chain continuation, source adapters, server-authorized content loading, reward receipts and passage recall scheduler remain authoritative. No new renderer, mastery database, Qur’anic source import, AI service or SQL migration is introduced.

| Area | Existing behavior | Change |
|---|---|---|
| Shared game screen | Start/pause/settings and bounded playfield | Visible More Ways to Practice button; safe paused activity tray; desktop companion panel; automatic field focus with typing/dialog guards |
| Continuation | Next stage within a mission; puzzle recommendations shortened batches | Source-bounded next batch retaining original size; partial final batches and explicitly labeled overlap for two-ayah games; settings preserved through the same mission controller |
| Ayah Link | Side-by-side canonical pair, markers, selected endpoints | Direct candidate-to-blank drops, neutral white drag tether, committed gold/red feedback, independent balanced endpoint lengths and retry shuffling |
| Bridge Builder | Structural spans, trusses, support/strength model, optional reinforcement and Grand Crossing | Both endings and openings in new Expedition Crossing; independently varied source groups; optional motor-pressure bonus windows; legacy opening-only resume option |
| Bubble Burst | Aim, wall ricochets, physical circles, semantic clusters and neutral release | Staggered Crystal Cascade formations, neutral blocking crystals, geometric reachability checks and safe fallback; actual bank shots and neutral cascades |
| Recall | Explicit oral declaration, reveal/compare, Again/Hard/Good/Easy | Optional Arabic/Latin written recall, built-in keyboard, source-backed assisted suggestions, metadata-only written evidence within existing attempts |

## More Ways to Practice and focus

The shared toolbar keeps the practice entry in the gameplay container. Opening it pauses the current game and explains that switching leaves the current attempt while retaining saved checkpoints. Compatible available game buttons use existing lab launch paths; the selected passage and applicable configuration are passed to the next setup. Revision alternatives use the same mission and existing controller. Unavailable/developer-only buttons are not promoted into public choices. A separate desktop panel appears only where the viewport supports it; phone/tablet users use the bounded paused tray.

Fields receive focus once when mounted and on explicit start/resume. Routine animation renders do not refocus inputs. Text inputs, selects, composition and unrelated dialogs retain normal keyboard behavior. No text input is auto-focused when opening a game.

## Next batches and persistence

`src/ui/next-batch.js` computes `end + 1` through `min(surahEnd, end + originalBatchSize)`. No batch is offered after the surah ends. A two-ayah game with one new ayah left offers an explicitly labeled boundary review including the previous ayah; it is not mislabeled as a new nonoverlapping set.

The host still authorizes and validates source content before launch. Ordinary chain boundaries continue automatically; mission checkpoints remain intentional. The Revision Lab completion controls retain the current activity, memory/motor settings, audio cues and reading preferences. `ayah-revision-batch-v1` stores only validated, account-scoped selection/settings metadata and the original batch size. It is included in profile export. Invalid data remains recoverable. Existing expedition checkpoints are unchanged. An unfinished **standalone flight** still restarts its selected batch on reopening; the resume label makes that limitation explicit rather than claiming exact frame restoration.

## Ayah Link

Desktop ayah cards remain beside one another in RTL source order; narrow screens stack readable cards. A balanced nine-combination cycle varies ending/opening lengths independently between one and three words, capped by actual source length. Candidate ordering remains seeded with fresh presentation entropy. Distinct authentic distractors are selected by the existing source adapter.

Drag a candidate into its matching side’s blank, or use tap/keyboard selection. A white tether follows the uncommitted gesture. There is no correctness-dependent hover color. Correct committed endpoints lock and illuminate gold; a wrong committed endpoint produces a red correction and one memory strike. Canceled/missed drops do not consume memory strikes. Existing marker restoration, whole-ayah recitation, assistance/evidence history, Classic/Practice rules and cumulative chain progression remain intact. These groups are visual study excerpts, not waqf rulings.

The familiar three boundary levels are now the regular Revision Lab defaults. Earlier guided/recognition modes remain available through the advanced mission planner; old mode IDs and ledger history are retained.

## Expedition Crossing

New Bridge Builder runs test both source-backed endpoints before constructing a structural span. Correct spans still receive two supports and trusses; basic load testing, optional heavier loads, weak-span reinforcement and RTL traveler crossing use the existing deterministic structure model. Ordinary boundaries advance without a Next button.

Relaxed pace has no countdown. Adventure and Challenge offer optional 35/18-second arcade bonus windows. Expiry stops the bonus and leaves the traveler safe; it records a motor event, never a memorization strike. These are optional navigation/scoring settings, not claims about Qur’an mastery or recitation speed. Pressure controls are in in-game settings.

Both-endpoint checkpoint keys use an additive suffix. Legacy opening-only drafts remain in the original keys and can be reopened using **Endpoint challenge → Opening only · resume legacy crossing**. Existing tutorial and result IDs remain unchanged. Incorrect source choices use normal memory strikes; a dropped connector or structural overload does not alter recall quality.

## Crystal Cascade

The existing physics engine remains active. New formations stagger clusters in both axes, progress through five geometry patterns, and introduce neutral crystal obstacles. A ray/circle and wall-reflection check verifies routes to every semantic choice, independent of correctness. Unsafe generated formations remove blockers or fall back to the existing open geometry. Required Arabic is never removed by a neutral cascade.

Neutral obstacle hits safely release neutral geometry and small bounded arcade points. Only a committed collision with an incorrect Arabic target consumes a memory strike. The geometric trajectory preview does not know which answer is correct. Existing recitation, transliteration, Classic/Practice rules, daily XP caps and automatic chain transitions remain unchanged.

## Smart Arabic Input policy

This is **written practice comparison**, not pronunciation, speech recognition, tajwid certification or qualified editorial approval of stopping rules. Final oral self-assessment remains a separate explicit workflow.

- Independent mode is the default. There are no expected-word predictions and no partial correctness feedback before submission.
- Arabic can be entered through native/hardware keyboards or the touch keyboard. Hamzah/alif variants, tāʾ marbūṭah, alif maqṣūrah, vowels, shaddah, sukūn and selected Uthmanic characters are available. Editing uses grapheme boundaries, selection replacement, clear and bounded undo.
- Latin answers can be entered and compared to the existing verified transliteration. Guided Typing is explicit; candidate activation permanently marks the current attempt assisted, even if hidden afterward or enabled after oral declaration.
- Candidates come from existing free source word records plus currently authorized passage bundles. Ranking uses the typed query only: exact transliteration, orthographic/search approximations, long vowels, doubling and partial forms. Expected-next-word identities are not a ranking input. No Arabic forms or meanings are generated.
- Candidates display the existing source-backed word meaning when present; no missing meanings are generated. Candidate selection inserts the exact source spelling. The textarea supports replacing, removing and rearranging text without exposing hidden expected-answer IDs in DOM attributes.
- Comparison copies normalize Unicode presentation forms/NFC, whitespace, tatweel and specified ornamental stop marks. The standard practice comparison permits omission of basic vowel signs and dagger alif; shaddah remains distinct; the strict comparison API retains these. Hamzah/alif variants, ayn, ordinary letters and small waw/ya remain distinct. These matching choices are documented software practice rules and are **not** a scholarly certification; formal instructional-policy review remains an operator/editorial action.
- Latin comparison preserves long vowels, doubled consonants, hamzah/ayn and emphatic distinctions in its exact form. Search-only approximate aliases rank lower and never silently substitute a submitted answer.
- Final submission reports possible omissions, additions and substitutions/order differences using bounded sequence alignment. It never changes canonical text or submits an FSRS grade. Written comparison is limited to 512 words and 20,000 input characters; full oral recall remains available for larger selections.
- Only metadata (`mode`, assisted/exact flags, mismatch count and comparison-policy version) joins the existing recall attempt/history. No typed answer, private source body or new mastery record is persisted. Revealing written comparison before oral declaration marks the oral attempt supported. The existing explicit declaration/comparison/grade remains the only recall scheduling route.
- Private candidate maps are transient and disposed on account/access changes. No premium vocabulary index is bundled or written to localStorage.

The keyboard honors composition, selection, screen-reader labels, system reduced motion and visual viewport resizing. Browser viewport tests are not physical iOS/Android, VoiceOver or TalkBack certification. Native SDK/device checks are reported separately below.

## Changed modules

Shared UX: `src/ui/gameplay-frame.js`, `gameplay-frame.css`, `gameplay-focus.js`, `cosmic-gameplay-frame.js`, `answer-drag.js`, `next-batch.js`.

Revision: `src/revision/ui.js`, `batch-store.js`, `src/puzzles/arcade/next-steps.js`, `src/learner/profile-storage.js`, and the Star Runner HUD in `cosmic/ui.js`.

Boundary/structural games: `src/quest/cosmic/boundary-content.js`, `src/puzzles/arcade/cosmic/link-boundary.js`, `link-boundary-ui.js`, `link.css`, and `src/puzzles/arcade/bridge/{engine,ui,checkpoints}.js`, `bridge.css`, plus existing Puzzle Lab setup.

Bubble physics: `src/puzzles/arcade/bubble/{engine,ui,cascade}.js`, `bubble.css`.

Written recall: `src/ui/smart-arabic/{model,ui}.js`, `ui.css`, `src/passage/{ui,memory}.js`, `src/learning-ui.js`, and `src/learning-store.js`.

Tests include new shared-practice, Smart Arabic, Expedition/Cascade model and browser suites. Existing Bridge/Bubble helpers now solve the visible two-sided/geometry challenges rather than assuming a fixed supplied ending or unobstructed direct shots.

## Validation and release evidence

The complete suite was run: **1,139 passed, 11 failed, five skipped**. Failures were inspected rather than counted as successful checks. They included stale labels/batch expectations, an obsolete Bridge fixture, missing video tooling, a clipped runner recovery panel, an off-screen Bubble test gesture, and unrelated unfinished account/gallery edits in the working directory.

Release validation uses an archived Git-index snapshot containing only this task. The unfinished Phase 9/10 files remain intact in the original working directory and are excluded from deployment.

- **43 release browser checks passed**: full Bubble chains/save/replay, the three Star Runner viewport journeys, activity switches, real authorization-denial/sign-out cleanup, accounts, gallery and learning regressions.
- A second contract run passed **105 of 106**. Its remaining old endpoint-drag fixture attempted to drop onto an answer outside its independently scrollable bank. The fixture now brings both endpoints into view; its corrected real pointer gesture passed. This preserves the gesture rather than forcing clicks through hidden elements.
- **34 final checks passed** after the layout polish, including all three viewport journeys, direct blank/legacy endpoint dragging, all six motor-game touch toolbars, recorded Ayah Blocks controls, Smart Arabic models, desktop/phone writing, assistance and profile revocation.
- **36 backend policy tests passed** (billing, content, recitation, coach, Chronicles and native purchase policies).
- Production build and Capacitor asset synchronization/configuration checks passed. SDK signing, native binary compilation and physical-device testing are not implied.
- The operator-source audit passed with zero integrity issues: 6,236 canonical references, 571 free ayahs and 639 registered private ayahs; 5,026 remain unavailable locally. This is not a complete-Qur’an publication or source-rights approval. The clean public release snapshot deliberately excludes private operator assets.
- No SQL migration, new secret, FSRS parameter change or new external AI service is required.

The initial full-run failures are not presented as a fresh all-green full-suite run. Every identified failure was either fixed and exercised in the clean release checks or traced to excluded unfinished work. Five intentionally skipped checks remain skipped.

Screenshots are stored beside this report: desktop/phone written recall, neutral drag tether, completed Link, and desktop/portrait/landscape next-batch panels. Structural Bridge screenshots are in `docs/bridge-builder/`. Browser recordings are in the workspace artifacts. Screenshots were inspected; they supplement actual interaction tests.

## Remaining limits and deployment

- Standalone flight resume restores the selected batch/settings, not exact in-flight positions. Existing expedition checkpoints retain their own recovery semantics.
- Written comparison is software practice feedback; qualified instructional review of the normalization policy remains appropriate. It does not certify recitation or tajwid.
- Hardware keyboard/IME, VoiceOver/TalkBack, interruptions and installed iOS/Android behavior still need physical-device validation. Capacitor synchronization alone is not store readiness or proof that an installed app received a Capgo update.
- Existing source/editorial, full-library publication, store signing and billing release gates remain unchanged.
- Deployment uses the tested GitHub commit through the existing Railway service. Roll back by redeploying the preceding commit, `5395194`; new optional metadata does not replace old learning records. Keep a profile export before an intentional downgrade to older software.

Useful entry points: **More Ways to Practice** in game; next-batch buttons at completion; **Endpoint challenge → Both endings and openings** in Bridge setup; **Try written recall · Arabic or transliteration** in the existing self-assessment screen.
