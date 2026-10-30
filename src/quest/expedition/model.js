import {
  sha256,
  loadBundle,
  referenceOptions,
  reference,
} from "../../content/library.js";
import { contentRevision, segmentationRevision } from "../checkpoints.js";
import { wordWindow, recallUnit } from "../../passage/model.js";
export const stageNames = {
  discovery: "Discovery Gate",
  forge: "Word Forge",
  link: "Passage Link",
  trial: "Arcade Trial",
  recall: "Independent Memory Challenge",
  chain: "Passage Chain",
  final: "Independent Passage Challenge",
};
export async function createExpeditionMap({ bundles, game = "maze" }) {
  if (
    !Array.isArray(bundles) ||
    !bundles.length ||
    bundles.length > 10 ||
    new Set(bundles.map((b) => b.key)).size !== bundles.length
  )
    throw Error("Choose one to ten distinct supported ayahs.");
  bundles = [...bundles].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  const pins = await Promise.all(
    bundles.map(async (b) => ({
      key: b.key,
      sourceHash: await contentRevision(b),
      segmentHash: await segmentationRevision(b),
    })),
  );
  const checkpoints = [];
  async function add(b, stage, extra = {}) {
    const pin = pins.find((p) => p.key === b.key),
      definition = {
        version: 1,
        campaignId: "passage-expedition",
        edition: 2,
        ...pin,
        type:
          stage === "trial"
            ? "arcade"
            : ["recall", "final"].includes(stage)
              ? "recall"
              : "study",
        stage,
        game: stage === "trial" ? game : null,
        workspace: null,
        recall: null,
        ...extra,
      };
    checkpoints.push({
      ...definition,
      id: `quest:${await sha256(JSON.stringify(definition))}`,
    });
  }
  for (const b of bundles) {
    await add(b, "discovery");
    const count = wordWindow(b, 0).count;
    for (let page = 0; page < count; page++) {
      const w = wordWindow(b, page);
      await add(b, "forge", {
        workspace: { page, firstWord: w.first, lastWord: w.last },
      });
      // Reconnect every studied part, without putting hundreds of words on screen.
      await add(b, "link", { through: page });
    }
    const w = wordWindow(b, 0);
    await add(b, "trial", {
      workspace: { page: 0, firstWord: w.first, lastWord: w.last },
    });
    await add(b, "recall", { recall: await recallUnit([b]) });
  }
  if (bundles.length > 1) {
    await add(bundles[0], "chain", {
      refs: bundles.map((b) => b.key),
      passagePins: pins,
    });
    await add(bundles[0], "final", {
      recall: await recallUnit(bundles),
      passagePins: pins,
    });
  }
  return {
    version: 1,
    routeVersion: 2,
    id: `campaign:${await sha256(JSON.stringify(checkpoints.map((c) => c.id)))}`,
    campaignId: "passage-expedition",
    game,
    units: {},
    checkpoints,
  };
}
export async function resumeExpedition({ store, runId, client }) {
  const old = store.snapshot().runs[runId];
  if (!old || old.routeVersion !== 2)
    throw Error(
      "This is an older study route. It remains saved in the classic framework.",
    );
  const bundles = await Promise.all(
    old.refs.map((key) => loadBundle(key, client)),
  );
  const map = await createExpeditionMap({ bundles, game: old.game });
  return { map, bundles, changed: map.id !== runId };
}
export function expeditionOptions({ signed = false, developer = false } = {}) {
  return referenceOptions().filter((o) => {
    const r = reference(o.key);
    return (
      r.surah === 1 ||
      r.juz === 30 ||
      (signed &&
        (![7, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77].includes(r.surah) ||
          developer))
    );
  });
}
export function validDraft(d, checkpoint, bundle) {
  if (!d) return true;
  if (
    !Number.isInteger(d.round) ||
    d.round < 0 ||
    d.round > 2 ||
    !Array.isArray(d.order) ||
    new Set(d.order).size !== d.order.length ||
    !Number.isInteger(d.mistakes) ||
    d.mistakes < 0 ||
    !Number.isInteger(d.assistance) ||
    d.assistance < 0 ||
    typeof d.revealed !== "boolean"
  )
    return false;
  if (checkpoint.stage === "forge")
    return d.order.every(
      (id) =>
        Number.isInteger(id) &&
        id >= checkpoint.workspace.firstWord &&
        id <= checkpoint.workspace.lastWord,
    );
  const count =
    checkpoint.stage === "chain"
      ? checkpoint.refs.length
      : checkpoint.through + 1;
  return d.order.every((i) => Number.isInteger(i) && i >= 0 && i < count);
}
