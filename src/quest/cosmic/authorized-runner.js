import {
  catalog,
  freeReference,
  loadAudio,
  loadBundle,
  sha256,
} from "../../content/library.js";
import { activeProfileId } from "../../learner/profile-storage.js";
import { fingerprints, validateRefs } from "../../passage-context/model.js";
import { createFlowUnits, flowChoices, flowTransliteration } from "./flow-content.js";
import { createFlowRunner } from "../../puzzles/arcade/cosmic/flow-runner.js";
const trusted = new WeakSet();
export function assertRunnerContent(source) {
  if (!trusted.has(source)) {
    throw Error("Authorize runner content through the shared loader.");
  }
  source.assertCurrent();
  return source;
}
// Each stage owns at most five ayahs. Source text is never placed in campaign storage.
export async function prepareRunnerContent(
  refs,
  client,
  {
    isCurrent = () => true,
    verifyBundle = () => {},
    loader = loadBundle,
    audioLoader = loadAudio,
  } = {},
) {
  validateRefs(refs);
  if (refs.length > 5) throw Error("Runner stages support up to five ayahs.");
  const owner = activeProfileId(),
    bundles = new Map(),
    resources = new Map(),
    pins = {};
  let disposed = false;
  const assertCurrent = () => {
    if (disposed || owner !== activeProfileId() || !isCurrent()) {
      throw Error("Runner content authorization changed.");
    }
  };
  try {
    for (const key of refs) {
      const b = await loader(key, client);
      assertCurrent();
      await verifyBundle(b);
      pins[key] = await fingerprints(b);
      assertCurrent();
      bundles.set(key, b);
    }
  } catch (error) {
    bundles.clear();
    throw error;
  }
  const source = {
    refs: [...refs],
    pins,
    private: refs.some((k) => !freeReference(k)),
    assertCurrent,
    ayah(ref) {
      assertCurrent();
      const b = bundles.get(ref);
      if (!b) throw Error("Reference outside the authorized stage.");
      return {
        ref,
        name: catalog.chapters.find((c) => c.id === b.surah).name,
        text: b.textUthmani,
        surah: b.surah,
        ayah: b.ayah,
      };
    },
    words(ref) {
      assertCurrent();
      const b = bundles.get(ref);
      if (!b) throw Error("Word reference outside the authorized stage.");
      return b.words.map((w) => ({
        id: `${ref}:${w.position - 1}`,
        key: ref,
        index: w.position - 1,
        text: w.text,
        sourcePositions: [w.position],
      }));
    },
    transliteration(unit) {
      assertCurrent();
      if (freeReference(unit.key) && !bundles.has(unit.key)) return flowTransliteration(unit);
      const b = bundles.get(unit.key);
      if (!b) return "";
      const first = unit.kind === "ayah" ? 0 : unit.index,
        last = unit.kind === "ayah"
          ? b.words.length
          : unit.kind === "chunk"
          ? unit.endIndex
          : first + 1;
      return b.words.slice(first, last).map((w) => w.transliteration || "")
        .join(" ");
    },
    async audio(ref) {
      assertCurrent();
      const b = bundles.get(ref);
      if (!b) throw Error("Audio outside the authorized stage.");
      if (!resources.has(ref)) {
        const lease = await audioLoader(b, client);
        try {
          assertCurrent();
        } catch (e) {
          lease.revoke();
          throw e;
        }
        if (resources.has(ref)) lease.revoke();
        else resources.set(ref, lease);
      }
      return resources.get(ref).url;
    },
    async revalidate() {
      for (const ref of refs) {
        const b = await loader(ref, client);
        assertCurrent();
        await verifyBundle(b);
        if (
          JSON.stringify(await fingerprints(b)) !== JSON.stringify(pins[ref])
        ) {
          throw Error(
            "Runner source/review revision changed. Saved checkpoints are preserved.",
          );
        }
      }
    },
    dispose() {
      disposed = true;
      resources.forEach((r) => r.revoke());
      resources.clear();
      bundles.clear();
    },
  };
  trusted.add(source);
  return source;
}
export async function mountAuthorizedRunner(
  root,
  {
    refs,
    client,
    isCurrent = () => true,
    verifyBundle,
    onComplete = null,
    onExit = () => {},
    rounds = 1,
  } = {},
) {
  const content = await prepareRunnerContent(refs, client, {
    isCurrent,
    verifyBundle,
  });
  let owned = null;
  try {
    const sourceHash = await sha256(JSON.stringify(content.pins)),
      id = `cosmic-authorized:${await sha256(
        JSON.stringify([refs, sourceHash]),
      )}`;
    const mission = {
      schema: 2,
      policy: "cosmic-authorized-v1",
      id,
      sourceHash,
      refs: [...refs],
      surah: Number(refs[0].split(":")[0]),
      first: Number(refs[0].split(":")[1]),
      last: Number(refs.at(-1).split(":")[1]),
      stages: [{ id: id + ":stage:1", refs: [...refs] }],
    };
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
      throw Error("Choose one to ten revision rounds.");
    }
    const lifecycle = new AbortController();
    const listeners = new Set();
    let round = 0, disposed = false, engine;
    const emit = (e) =>
      listeners.forEach((fn) =>
        fn({
          ...e,
          targetRef: e.targetRef || refs[0],
          stageIndex: 0,
          roundIndex: round,
          roundCount: rounds,
          missionId: id,
          sourceHash,
        })
      );
    const make = () =>
      createFlowRunner({
        units: createFlowUnits(refs, "mixed", round, content),
        choices: (u, seed) => flowChoices(u, seed, content),
        seed: parseInt(sourceHash.slice(0, 8), 16),
        stageId: mission.stages[0].id,
        roundIndex: round,
        slow: true,
        onEvent: emit,
      });
    engine = make();
    const controller = {
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      getSnapshot() {
        content.assertCurrent();
        return {
          ...engine.getSnapshot(),
          runId: id,
          stageIndex: 0,
          stageCount: 1,
          stageNumber: 1,
          roundIndex: round,
          roundCount: rounds,
          atRouteEnd: round === rounds - 1,
          routeComplete: round === rounds - 1 &&
            engine.getSnapshot().status === "checkpoint",
          gateway: null,
        };
      },
      dispatch(a) {
        content.assertCurrent();
        return engine.dispatch(a);
      },
      pause(reason) {
        return engine.pause(reason);
      },
      nextStage() {
        if (round >= rounds - 1) return false;
        engine.dispose();
        round++;
        engine = make();
        engine.start();
        return true;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        lifecycle?.abort();
        engine.dispose();
        listeners.clear();
        content.dispose();
      },
    };
    owned = controller;
    let checking = false;
    const invalidate = () => {
      lifecycle.abort();
      controller.dispose();
      root.replaceChildren(
        Object.assign(document.createElement("p"), {
          textContent:
            "Passage authorization changed. Reopen the saved mission to reauthorize.",
        }),
      );
    };
    const check = async () => {
      if (checking || disposed || !content.private) return;
      checking = true;
      try {
        await content.revalidate();
      } catch {
        if (!disposed) {
          game.dispose();
          invalidate();
        }
      } finally {
        checking = false;
      }
    };
    const { mountStarRunner } = await import(
      "../../puzzles/arcade/cosmic/ui.js"
    );
    const game = await mountStarRunner(root, mission, {
      controller,
      content,
      isCurrent,
      disposeController: true,
      guidance: true,
      onExit,
      onCheckpoint: !onComplete&&rounds===1?null:(s) => {
        if (round < rounds - 1) {
          controller.nextStage();
          game.dispatch({ type: "resume" });
        } else onComplete?.(s);
      },
    });
    if (!game) {
      controller.dispose();
      return null;
    }
    for (
      const event of [
        "ayahprofilechange",
        "ayah-content-access-changed",
        "ayah-private-content-denied",
      ]
    ) {
      window.addEventListener(event, () => {
        if (content.private) {
          game.dispose();
          invalidate();
        }
      }, { signal: lifecycle.signal });
    }
    window.addEventListener("focus", () => void check(), {
      signal: lifecycle.signal,
    });
    const timer = setInterval(() => void check(), 60000);
    lifecycle.signal.addEventListener("abort", () => clearInterval(timer));
    return {
      ...game,
      dispose() {
        lifecycle.abort();
        game.dispose();
        controller.dispose();
      },
    };
  } catch (e) {
    owned?.dispose();
    content.dispose();
    throw e;
  }
}
