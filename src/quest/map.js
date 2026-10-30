import { loadBundle, sha256 } from "../content/library.js";
import { generateCheckpoints } from "./checkpoints.js";
export async function createCampaignMap(options) {
  const checkpoints = await generateCheckpoints(options);
  const id = `campaign:${await sha256(JSON.stringify(checkpoints.map((c) => c.id)))}`;
  return {
    version: 1,
    id,
    campaignId: options.campaignId,
    game: checkpoints.find((c) => c.game)?.game || null,
    units: Object.fromEntries(
      checkpoints
        .filter((c) => c.recall?.type === "segment")
        .map((c) => [c.key, c.recall.segment]),
    ),
    checkpoints,
  };
}
export function nextCheckpoint(map, run) {
  return map.checkpoints.find((c) => !run?.completed?.[c.id]) || null;
}
export function mapNodes(map, run) {
  const next = nextCheckpoint(map, run)?.id;
  return map.checkpoints.map((c, index) => ({
    id: c.id,
    index,
    key: c.key,
    type: c.type,
    state: run?.completed?.[c.id]
      ? "complete"
      : c.id === next
        ? "available"
        : "locked",
  }));
}

// Re-authorize downloads on every new browser session; revisions create a new map,
// while old records remain available for recovery/export.
export async function resumeCampaignMap({
  store,
  runId,
  client,
  bundleLoader = (key) => loadBundle(key, client),
}) {
  const old = store.snapshot().runs[runId];
  if (!old) throw Error("Unknown saved campaign");
  const bundles = await Promise.all(old.refs.map(bundleLoader));
  const map = await createCampaignMap({
    campaignId: old.campaignId,
    bundles,
    game: old.game,
    units: old.units || {},
  });
  const run = store.open(map);
  return {
    map,
    run,
    changed: map.id !== runId,
    next: nextCheckpoint(map, run),
  };
}
