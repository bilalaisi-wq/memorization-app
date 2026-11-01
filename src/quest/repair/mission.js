import { surahs } from "../../data.js";
import { loadBundle, loadAudio, sha256 } from "../../content/library.js";
import { contentRevision, segmentationRevision } from "../checkpoints.js";
import { wordWindow } from "../../passage/model.js";
import { createContentAdapter } from "../../puzzles/arcade/content.js";
import { createLauncher } from "../../puzzles/arcade/registry.js";
import { questArcadeRegistry } from "../host.js";
import { createQuestRewards } from "../rewards.js";
import { mountQuestFallback } from "../practice.js";
import { chooseRepairGame } from "./model.js";
import { readLabVolume } from "../../puzzles/audio-level.js";
// A bounded visual repair workspace; never a newly approved phrase or recitation stop.
export async function prepareRepairMission({
  recommendation,
  client,
  registry = questArcadeRegistry(),
  bundleLoader = loadBundle,
}) {
  const bundle = await bundleLoader(recommendation.key, client);
  const event = recommendation.evidence.find((e) =>
    e.expected?.some((id) => id.startsWith(`${bundle.key}:`)),
  );
  const index =
    event?.expected
      ?.map((id) => Number(id.split(":")[2]))
      .find((n) => Number.isInteger(n) && n >= 0 && n < bundle.words.length) ??
    0;
  const count = wordWindow(bundle, 0).count;
  const window = Array.from({ length: count }, (_, p) =>
    wordWindow(bundle, p),
  ).find((w) => index + 1 >= w.first && index + 1 <= w.last);
  const workspace = { firstWord: window.first, lastWord: window.last };
  const id = `quest:${await sha256(JSON.stringify(["memory-repair", recommendation.id, recommendation.evidence.map((e) => e.id).sort(), await contentRevision(bundle), await segmentationRevision(bundle), workspace]))}`;
  return {
    id,
    bundle,
    workspace,
    game: chooseRepairGame(recommendation, registry.list()),
    registry,
  };
}
export async function launchRepairMission({
  prepared,
  root,
  storage,
  learning,
  lab,
  owner,
  getOwner,
  client,
  onComplete,
  onExit,
  onRecall,
  onPractice,
  signal,
}) {
  const guard = () => {
    if (signal?.aborted || getOwner() !== owner)
      throw Error("Account or activity changed.");
  };
  guard();
  const { bundle, workspace, id, registry } = prepared;
  let resource = null,
    activity = null,
    disposed = false;
  const launcher = createLauncher(registry),
    rewards = createQuestRewards({ storage, learning, lab, owner, getOwner });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    launcher.dispose();
    activity?.dispose();
    resource?.revoke();
    root.replaceChildren();
  };
  signal?.addEventListener("abort", dispose, { once: true });
  try {
    resource = await loadAudio(bundle, client);
  } catch {
    /* Audio availability is never a memory mistake. */
  }
  try {
    guard();
  } catch (e) {
    resource?.revoke();
    throw e;
  }
  if (disposed) {
    resource?.revoke();
    return { dispose };
  }
  const finish = (data) => {
    guard();
    if (disposed) throw Error("Activity closed.");
    const xp = data.game
      ? rewards.arcade({ ...data, studyScope: workspace })
      : rewards.practice({ id, key: bundle.key });
    // Defer disposal until the game's save handler finishes rendering its receipt.
    queueMicrotask(() => {
      if (!disposed) {
        dispose();
        onComplete({
          game: data.game || "supported practice",
          xp,
          mistakes: Array.isArray(data.mistakes)
            ? data.mistakes.length
            : data.mistakes || 0,
          motorErrors: data.motorErrors?.length || 0,
          assistance: Array.isArray(data.assistance)
            ? data.assistance.length
            : data.assistance || 0,
          workspace,
          key: bundle.key,
        });
      }
    });
    return { xp };
  };
  const fallback = () =>
    mountQuestFallback({
      root,
      bundle,
      workspace,
      id,
      audioUrl: resource?.url || "",
      volume: () => readLabVolume(localStorage),
      onComplete: finish,
    });
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
  const base = createContentAdapter(library),
    target = base
      .words(bundle.key)
      .filter(
        (w) =>
          w.index >= workspace.firstWord - 1 && w.index < workspace.lastWord,
      );
  const adapter = {
    ...base,
    words: (key) => (key === bundle.key ? target : base.words(key)),
    audio: (key) =>
      key === bundle.key ? resource?.url || "" : base.audio(key),
    choices: (key, options) =>
      base
        .choices(key, options)
        .filter((w) => !w.target || target.some((t) => t.id === w.id)),
  };
  const config = {
    keys: [bundle.key],
    mode: "single",
    chainMode: "practice",
    profile: "gentle",
    seed: parseInt(id.slice(-8), 16),
    visualWindows: true,
  };
  if (prepared.game)
    try {
      activity = launcher.launch(prepared.game, {
        root,
        adapter,
        library,
        config,
        id,
        difficulty: "beginner",
        initialAudio: "silent",
        initialAudioMode: "silent",
        volume: () => readLabVolume(localStorage),
        onComplete: finish,
        onExit,
        onRecall,
        onPractice,
        onJourney: () => onExit(),
      });
    } catch {
      launcher.dispose();
      root.replaceChildren();
      activity = fallback();
    }
  else activity = fallback();
  activity.start();
  return {
    dispose,
    pause: () => activity?.pause(),
    getSnapshot: () => activity?.getSnapshot(),
  };
}
