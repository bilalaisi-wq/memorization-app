import { scopedStorage } from "../learner/profile-storage.js";
import { nextCheckpoint } from "./map.js";
import { readLabVolume } from "../puzzles/audio-level.js";
import { surahs } from "../data.js";
import { loadBundle, loadAudio } from "../content/library.js";
import { createRegistry, createLauncher } from "../puzzles/arcade/registry.js";
import { createContentAdapter } from "../puzzles/arcade/content.js";
import { mazeRegistration } from "../puzzles/arcade/maze/ui.js";
import { snakeRegistration } from "../puzzles/arcade/snake/ui.js";
import { asteroidsRegistration } from "../puzzles/arcade/asteroids/ui.js";
import {
  contentRevision,
  segmentationRevision,
  playableGame,
} from "./checkpoints.js";
import { createActivityScope } from "./accessibility.js";
import { createTransitions } from "./transitions.js";
import { mountQuestFallback } from "./practice.js";
import { createQuestRewards } from "./rewards.js";
import { recallEvidence } from "./revision.js";
import { createPassageMemory } from "../passage/memory.js";
import "../puzzles/arcade/maze/maze.css";
import "../puzzles/arcade/snake/snake.css";
import "../puzzles/arcade/asteroids/asteroids.css";
import "./quest.css";
export function questArcadeRegistry() {
  const registry = createRegistry();
  [mazeRegistration, snakeRegistration, asteroidsRegistration].forEach((g) =>
    registry.register(g),
  );
  return registry;
}
export function createQuestHost({
  root,
  map,
  store,
  owner = null,
  getOwner,
  storage = owner ? scopedStorage(owner) : localStorage,
  learning,
  lab,
  client = null,
  onRecall,
  volume = () => readLabVolume(),
  muted = () => false,
  // Dependency injection is for evaluated fixtures; production uses authenticated library loaders.
  bundleLoader = (key) => loadBundle(key, client),
  audioLoader = (b) => loadAudio(b, client),
  registry = questArcadeRegistry(),
}) {
  if (
    typeof getOwner !== "function" ||
    !root ||
    !learning?.snapshot ||
    !lab?.record
  )
    throw Error(
      "Root, account guard and existing learning/lab stores are required",
    );
  const launcher = createLauncher(registry),
    transitions = createTransitions(root);
  const rewards = createQuestRewards({
    storage,
    learning,
    lab,
    owner,
    getOwner,
  });
  let disposed = false,
    generation = 0,
    current = null,
    resource = null,
    active = null;
  const scope = createActivityScope(root, {
    owner,
    getOwner,
    onIdentityChange: () => dispose(),
  });
  function clear() {
    generation++;
    transitions.cancel();
    launcher.dispose();
    current?.dispose();
    current = null;
    resource?.revoke();
    resource = null;
    active = null;
    root.replaceChildren();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
    scope.dispose();
    transitions.dispose();
  }
  const guard = () => {
    if (disposed) throw Error("Quest host disposed");
    scope.guard();
  };
  scope.listen(window, "ayah-developer-mode", dispose);
  scope.listen(window, "pagehide", dispose);
  scope.listen(document, "visibilitychange", () => {
    if (document.hidden) current?.pause();
  });
  function result(checkpoint, data) {
    guard();
    if (active?.id !== checkpoint.id) throw Error("Activity changed");
    // Commit only safe result metadata. XP writes have stable receipts before the final quest write.
    const previous = store.snapshot().runs[map.id].completed[checkpoint.id];
    if (previous) return { ...previous, duplicate: true };
    let xp = 0,
      evidence = "practice";
    if (data.game) {
      if (
        data.id !== checkpoint.id ||
        data.game !== checkpoint.game ||
        data.config.keys.join("|") !== checkpoint.key
      )
        throw Error("Unexpected arcade result");
      xp = rewards.arcade(data);
      evidence = "arcade";
    } else {
      if (data.status !== "won") throw Error("Complete practice first");
      xp = rewards.practice(checkpoint);
    }
    return store.complete(map, checkpoint, {
      xp,
      evidence,
      mistakes: Array.isArray(data.mistakes)
        ? data.mistakes.length
        : data.mistakes || 0,
      assistance: Array.isArray(data.assistance)
        ? data.assistance.length
        : data.assistance || 0,
      motorErrors: data.motorErrors?.length || 0,
    });
  }
  async function launch(checkpointId) {
    guard();
    clear();
    const token = generation;
    const checkpoint = map.checkpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) throw Error("Unknown checkpoint");
    if (!store.snapshot().runs[map.id]?.completed[checkpoint.id])
      store.start(map, checkpoint);
    scope.announce("Loading verified activity…");
    try {
      const bundle = await bundleLoader(checkpoint.key);
      if (disposed || token !== generation) return null;
      guard();
      if (
        (await contentRevision(bundle)) !== checkpoint.sourceHash ||
        (await segmentationRevision(bundle)) !== checkpoint.segmentHash
      )
        throw Error(
          "Source or reviewed segmentation changed. Generate a new map; previous progress is preserved.",
        );
      if (disposed || token !== generation) return null;
      guard();
      active = checkpoint;
      if (checkpoint.type === "recall") {
        root.innerHTML =
          '<section aria-label="Independent recall handoff"><p>Use the existing self-assessed recitation workflow. Quest victories never verify memorization.</p><button data-quest-recall>Open independent recall</button><button data-quest-confirm>Check saved self-assessment</button></section>';
        root.querySelector("[data-quest-recall]").onclick = () => {
          guard();
          if (onRecall) onRecall(structuredClone(checkpoint.recall));
          else
            import("../passage/ui.js").then(({ openPassageStudio }) => {
              if (!disposed && token === generation)
                openPassageStudio({
                  client,
                  user: owner ? { id: owner } : null,
                  coachTarget: {
                    refs: checkpoint.recall.refs,
                    unit: checkpoint.recall,
                  },
                  coachAction: "review",
                });
            });
        };
        root.querySelector("[data-quest-confirm]").onclick = () => {
          try {
            confirmRecall();
          } catch (e) {
            scope.announce(e.message);
          }
        };
        transitions.enter();
        return null;
      }
      let loaded = null;
      try {
        loaded = await audioLoader(bundle);
      } catch {
        /* Failed media is assistance availability, never a memory strike. */
      }
      if (disposed || token !== generation) {
        loaded?.revoke();
        return null;
      }
      try {
        guard();
      } catch (e) {
        loaded?.revoke();
        throw e;
      }
      resource = loaded;
      const fallback = () =>
        mountQuestFallback({
          root,
          bundle,
          workspace: checkpoint.workspace,
          id: checkpoint.id,
          audioUrl: resource?.url || "",
          volume,
          muted,
          onComplete: (data) => result(checkpoint, data),
        });
      const registered = registry.list().some((g) => g.id === checkpoint.game);
      if (
        checkpoint.type === "arcade" &&
        playableGame(checkpoint.game) &&
        registered
      ) {
        const library = surahs.map((s) => ({
          ...s,
          verses: s.verses.filter((v) => `${s.id}:${v.id}` !== bundle.key),
        }));
        let chapter = library.find((s) => s.id === bundle.surah);
        if (!chapter) {
          chapter = { id: bundle.surah, verses: [], developerOnly: true };
          library.push(chapter);
        }
        chapter.verses.push({
          id: bundle.ayah,
          words: bundle.words.map((w) => w.text),
        });
        const base = createContentAdapter(library);
        const adapter = {
          ...base,
          audio: (key) =>
            key === bundle.key ? resource?.url || "" : base.audio(key),
        };
        const config = {
          keys: [bundle.key],
          mode: "single",
          chainMode: "practice",
          profile: "gentle",
          seed: parseInt(checkpoint.id.slice(-8), 16),
          visualWindows: true,
        };
        try {
          current = launcher.launch(checkpoint.game, {
            root,
            adapter,
            config,
            library,
            id: checkpoint.id,
            difficulty: "beginner",
            volume,
            muted,
            initialAudio: "silent",
            initialAudioMode: "silent",
            onComplete: (data) => result(checkpoint, data),
            onExit: () => {
              clear();
              scope.announce(
                "Activity closed. Your completed checkpoints remain saved.",
              );
            },
            onPractice: () => handoff(checkpoint, false),
            onRecall: () => handoff(checkpoint, true),
            onJourney: async ({ kind }) => {
              if (kind === "replay") return launch(checkpoint.id);
              const next = nextCheckpoint(map, store.snapshot().runs[map.id]);
              if (next) return launch(next.id);
              scope.announce(
                "All checkpoints are complete. Your campaign progress is saved.",
              );
            },
          });
        } catch {
          launcher.dispose();
          root.replaceChildren();
          current = fallback();
          scope.announce(
            "This activity is unavailable. Complete the practice workspace instead.",
          );
        }
      } else current = fallback();
      current.start();
      transitions.enter();
      return current;
    } catch (e) {
      if (!disposed && token === generation) {
        clear();
        scope.announce(e.message);
      }
      throw e;
    }
  }
  async function handoff(checkpoint, recall) {
    guard();
    clear();
    const token = generation;
    const { openPassageStudio } = await import("../passage/ui.js");
    if (disposed || token !== generation) return;
    guard();
    const unit = map.checkpoints.find(
      (c) => c.key === checkpoint.key && c.type === "recall",
    )?.recall || {
      id: `ayah:${checkpoint.key}`,
      type: "ayah",
      refs: [checkpoint.key],
    };
    openPassageStudio({
      client,
      user: owner ? { id: owner } : null,
      ...(recall
        ? { coachTarget: { refs: unit.refs, unit }, coachAction: "review" }
        : { initialReference: checkpoint.key }),
    });
    scope.announce("Study opened. Completed quest checkpoints remain saved.");
  }
  function confirmRecall() {
    guard();
    const checkpoint = active;
    if (checkpoint?.type !== "recall")
      throw Error("Open a recall checkpoint first");
    const run = store.snapshot().runs[map.id];
    const evidence = recallEvidence(checkpoint.recall, {
      learning: learning.snapshot(),
      passageMemory: createPassageMemory(storage).snapshot(),
      startedAt: run.started[checkpoint.id],
    });
    if (!evidence)
      throw Error(
        "No successful independent self-assessment saved since this checkpoint started. Continue in the existing recall workflow.",
      );
    const saved = store.complete(map, checkpoint, {
      evidence: "self-assessed",
    });
    scope.announce(
      "Self-assessed recall checkpoint saved. Your existing scheduler remains authoritative.",
    );
    return saved;
  }
  return {
    launch,
    confirmRecall,
    pause() {
      guard();
      current?.pause();
    },
    resume() {
      guard();
      current?.resume();
    },
    dispatch(action) {
      guard();
      return current?.dispatch(action);
    },
    getSnapshot() {
      guard();
      return current?.getSnapshot() || null;
    },
    dispose,
  };
}
