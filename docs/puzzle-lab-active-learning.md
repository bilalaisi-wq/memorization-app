# Puzzle Lab: active learning, in-frame gateways and navigation

## Learner defaults

The released Puzzle Lab games—Ayah Blocks, Ayah Space, Ayah Serpent, Memory Maze, Ayah Bubble Burst and Sirat Quest—start with **continuous full-ayah recitation** when the learner starts the game. Passage Builder/Expedition arcade launches use the same active default instead of forcing a silent game.

- **Continuous ayah recitation:** the current verified ayah repeats during gameplay. A change of ayah stops the old recording and starts the correct new one.
- **Listen before playing:** the Echo/listening-first option lets the learner listen before moving, constructing or launching. Sirat and Maze freeze their navigation/physics while in this mode; Resume is learner-controlled. There is no timed recitation requirement.
- **Pause recitation · this ayah:** the former permanent “Silent”/“Silent Stack” label is replaced by an explicit temporary pause. A new ayah, retry or replay returns to active recitation unless the learner deliberately selected listening-first. Audio pause is not carried into a new Puzzle Lab journey as a silent default.
- Existing volume and mute controls remain available. A website cannot guarantee that a device is audible; the controls remain usable for accessibility and quiet settings. Missing recordings, blocked autoplay or network errors invite a Replay retry without charging a memory strike or blocking navigation.
- Full-ayah playback always uses the existing source recording. Word/phrase previews use the established verified files; Bubble previews return to the full-ayah loop afterwards. No Arabic, audio timing, recitation stop approval or synthesized wording is introduced.

Listening remains study assistance. Games do not submit an independent recall grade or change FSRS parameters. Existing supported-study XP/caps remain in effect; a successful audio-assisted game may have a different existing reward than unassisted recognition. Saved progress and receipts are retained.

## Door guidance stays in the playfield

**Memory Maze:** canonical Arabic door signs, the matching door numbers, current chamber HUD, location feedback, large movement pad, Space/Open door, Pause and Replay controls are inside the map frame. The scrollable map remains available for exploration; its Arabic legend is no longer a separate section below the game. Space and Enter both open the door at the learner's current position. Travel portals are explicitly labeled as travel to the next ayah and show its verified opening, rather than retaining misleading previous-door distractor labels. Either travel portal advances; this movement is not another memory test.

**Sirat Quest:** Arabic continuation cards and their gateway numbers sit inside the scene. The highlighted card follows the nearest physical arch. At a reachable arch, **Space enters that gateway**; away from the arches Space jumps. **Up/W and the Jump button always jump**—a jump is never silently converted into a memory mistake. Keys 1–3 and direct card selection remain available, and touch users have an Enter button. Movement, Pause, Replay and the strike HUD are in the scene. The ordinary fictional garden and its geometry remain separate from Quran correctness and spiritual judgment.

Other games already display the Arabic choices on their actual objects: incoming Space objects, Serpent collectibles, Bubble targets and falling Blocks. Their source-backed labels and existing gameplay remain intact. Optional help/detail sections can still be expanded outside the arena; essential door meanings no longer require a separate below-game lookup.

## Bridge Builder rollout

Bridge Builder is **developer-only**. It is hidden/disabled in the learner launcher and learner recommendations. Its registry entry requires the existing developer-mode access and is omitted from ordinary registry lists, so other activity launchers cannot quietly expose it. Turning developer mode off replaces an active Bridge activity with a supported learner game.

Its permanent game identifier, old Puzzle Lab history, XP receipts and exports remain valid. Bridge has since been redesigned as [Bridge Builder 2.0 · Ayah Link](bridge-builder.md), with a demonstration, right-to-left islands and adjacent-ayah opening challenges. It remains developer-only for owner review. Its Advanced preset deliberately offers Silent Challenge; the active-audio defaults above apply to released learner games.

## One passage entry

The menu now has one **Passage Builder** entry. It opens the memorization studio directly. Within it:

- **Saved passages** opens the existing named-passage library and authenticated save/delete workflow.
- **Explore Passage Expedition** opens the distinct guided constellation campaign.
- Existing revision/recall entry points remain available.

The separate menu entries “Passage memorization” and “Passage Expedition” are removed. Named passages, campaign checkpoints, workspace arrangements and native FSRS history are not migrated, reset or combined. Existing developer/premium visibility and server-side content authorization remain unchanged. The existing menu-order configuration simply ignores labels that no longer exist; no database migration is necessary.

## Files and verification

Changes cover the six arcade renderers plus Blocks, shared registry/Quest host defaults, Puzzle Lab launch guards, consolidated billing/studio navigation, in-frame Maze/Sirat CSS, Sirat's geometric gateway selector and the corresponding fixtures/tests. No new package, content import, database migration or secret is required.

New browser checks exercise continuous audio defaults and cleanup, explicit pauses, listening-first, next-ayah narration, Maze Space entry, Sirat positional Space entry with Up still jumping, learner/developer Bridge visibility, named-passage access and the single menu entry. Existing gameplay, supported audio, billing, source protection, passage recall and campaign tests are run separately; final results follow after validation.

Live Railway deployment, physical iOS/Android autoplay/volume behavior and live Supabase checks require the normal deployment smoke test. Test media fixtures verify lifecycle and source selection, not the loudness of a real device or every external recording.

### Validation evidence

- Broad targeted regression: 160 of 162 cases passed initially. The two follow-ups passed separately: Space's intentional active-audio reset expectation and the full 128-word expedition (20 workspaces, 43 checkpoints). The latter retains all assertions with a larger journey timeout.
- Final audio/repair follow-up: 29 passed; Space victory/save/replay follow-up: 1 passed; full 128-word expedition follow-up: 1 passed.
- Mobile Maze now keeps its complete frame within the 390×844 test viewport, while preserving 68px touch buttons and at least 28px Arabic signs.
- Production build passes with the existing large-chunk advisory. This is targeted regression evidence, not a claim that every repository test or live deployment has been certified.
- Inspection screenshots: `/workspace/artifacts/active-maze-mobile.png` and `/workspace/artifacts/active-sirat-gateway.png`.
- Final compact-controls regression: **26 passed**, covering Maze/Sirat gameplay, chain recovery, Space entry, mobile controls, audio defaults and listening-first. Final CSS also corrects playfield feedback contrast.
