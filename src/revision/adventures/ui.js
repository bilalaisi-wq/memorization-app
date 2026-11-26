import { authorizeRegion, revisionChoices } from "./content.js";
import { adventureStore, newAdventure, validAdventure } from "./store.js";
import {
  createAyahDefense,
  migrateDefenseCheckpoint,
  TOWERS,
  SITES,
  REGIONS,
  defensePath,
  pointOnPath,
} from "./defense.js";
import {
  DEFENSE_MAPS,
  mapFor,
  placementCheck,
  legalPositions,
  pointerOnMap,
} from "./defense-maps.js";
import { renderDefenseScene } from "./defense-art.js";
import { createSurahRush, terrain } from "./rush.js";
import {
  profileStorage,
  activeProfileId,
} from "../../learner/profile-storage.js";
import {
  sha256,
  loadAudio,
  loadBundle,
  freeReference,
} from "../../content/library.js";
import { validateRefs, fingerprints } from "../../passage-context/model.js";
import { createAudioManager } from "../../puzzles/arcade/services.js";
import { readLabVolume } from "../../puzzles/audio-level.js";
import { mountReadingSetting, readingHTML } from "../../ui/reading-aids.js";
import { mountGameplayFrame } from "../../ui/gameplay-frame.js";
import { focusGameplay } from "../../ui/gameplay-focus.js";
import { createRewardStore } from "../../rewards/store.js";
import { reportStudyExposure } from "../../study-exposure.js";
import { openPassageStudio } from "../../passage/ui.js";
import { nextBatch } from "../../ui/next-batch.js";
import { esc } from "../../ui/dom.js";
import { experiencePreferences } from "../../ui/encouragement.js";
import "./ui.css";
export const ADVENTURES = {
  "ayah-defense": {
    title: "Ayah Defense",
    subtitle:
      "Celestial Fortress · Earn your defenses through Qur’an revision.",
  },
  "surah-rush": {
    title: "Surah Rush",
    subtitle: "Run, jump, choose the right path, and keep your ayahs flowing.",
  },
};
export async function mountAdventure(
  root,
  {
    game,
    refs,
    client,
    settings = { memory: "guided", motor: "relaxed" },
    isCurrent = () => true,
    onExit = () => {},
    onNext = () => {},
    restart = false,
    verifyBundle = async () => {},
    frameScheduler = null,
  } = {}
) {
  validateRefs(refs);
  if (!ADVENTURES[game]) throw Error("Game unavailable");
  const owner = activeProfileId(),
    id = await sha256(JSON.stringify([1, game, refs])),
    abort = new AbortController(),
    store = adventureStore(profileStorage);
  if (store.warning) throw Error(store.warning);
  let disposed = false,
    epoch = 0,
    raf = 0,
    last = 0,
    busy = false,
    region = null,
    choices = [],
    readyRecall = false,
    engine = null,
    frame = null,
    audioLease = null,
    audioEpoch = 0,
    pauseEpoch = 0,
    studio = null,
    started = false,
    selectedTower = "arrow",
    selectedSite = 0,
    audioMode = "continuous",
    listeningBefore = false,
    muted = false,
    message = "",
    pendingSection = false,
    retrySourceControl = null,
    placement = null,
    selectedTowerId = null,
    zoom = null,
    pendingMap = 0,
    pendingTours = false,
    pendingSave = false,
    mapChanged = false,
    promptGeneration = 0,
    shopView = "buy",
    lastTransfer = "",
    pendingReset = false;
  const requestFrame = (fn) =>
    frameScheduler ? frameScheduler.request(fn) : requestAnimationFrame(fn);
  const cancelFrame = (id) =>
    frameScheduler ? frameScheduler.cancel(id) : cancelAnimationFrame(id);
  const currentFrame = () =>
    engine?.getFrame ? engine.getFrame() : engine?.getSnapshot();
  const heldAnswers = new Set();
  const alive = () =>
    !disposed && owner === activeProfileId() && root.isConnected && isCurrent();
  if (!alive()) throw Error("Account changed");
  let record = store.snapshot().runs[id];
  if (!record || restart) {
    store.transact((d) => (d.runs[id] = newAdventure(game, refs, settings)));
    record = store.snapshot().runs[id];
  }
  if (record.refs.join("|") !== refs.join("|"))
    throw Error("Saved passage needs recovery; export existing progress");
  if (game === "ayah-defense" && record.arcade && record.arcade.version !== 2) {
    store.transact((d) => {
      const r = d.runs[id];
      r.legacyArcade ??= structuredClone(r.arcade);
      r.arcade = migrateDefenseCheckpoint(r.arcade);
    });
    record = store.snapshot().runs[id];
  }
  settings = { ...record.settings };
  pendingMap = settings.map ?? record.arcade?.map ?? 0;
  pendingTours = settings.tourMaps ?? false;
  const audio = createAudioManager({
    owner: "revision-adventure",
    initialVolume: readLabVolume(profileStorage),
  });
  function persistRecord() {
    store.transact((d) => {
      const old = d.runs[id];
      if (
        !pendingReset &&
        ((old?.completed || 0) > record.completed ||
          (old?.completed === record.completed &&
            old.unit > record.unit &&
            old.accepted.some((k) => !record.accepted.includes(k))))
      )
        throw Error(
          "Another window has newer progress. Export this attempt before recovery."
        );
      d.runs[id] = structuredClone(record);
    });
    pendingSave = false;
    pendingReset = false;
  }
  function save(fn, reset = false) {
    if (!alive()) throw Error("Learning account changed");
    const next = structuredClone(record);
    fn(next);
    if (!validAdventure(next))
      throw Error("Invalid checkpoint; previous data retained.");
    record = next;
    pendingReset ||= reset;
    try {
      persistRecord();
    } catch (e) {
      pendingSave = true;
      throw Error(
        e.message +
          " Completed progress is held in this window. Retry saving before leaving."
      );
    }
  }
  const snapshot = () => {
    const s = currentFrame();
    return {
      session: {
        id,
        config: {
          keys: refs,
          memoryDifficulty: settings.memory,
          motorDifficulty: settings.motor,
        },
        status:
          s?.status === "won"
            ? "won"
            : s?.status === "playing"
            ? "playing"
            : s?.status === "ready"
            ? "ready"
            : "paused",
        checkpoint: Math.min(refs.length - 1, record.completed),
        mistakes: record.evidence.filter((e) => e.kind === "memory"),
      },
      cursor: record.completed * 1000 + record.unit,
    };
  };
  async function flushRewards() {
    for (const key of record.pendingRewards || []) {
      const receiptId =
        "quest:" +
        (await sha256(JSON.stringify([game, key, record.pins[key]])));
      if (!alive()) return;
      createRewardStore(profileStorage).award({
        mode: "lab",
        unit: key,
        action: game,
        xp: 2,
        receiptId,
      });
      save(
        (r) => (r.pendingRewards = r.pendingRewards.filter((k) => k !== key))
      );
    }
  }
  function buildEngine(restore = record.arcade) {
    engine?.dispose();
    if (restore) {
      restore = structuredClone(restore);
      if (game === "surah-rush")
        Object.assign(restore, {
          x: 60,
          y: 310,
          vx: 0,
          vy: 0,
          gateOpen: record.completed === refs.length,
          choice: null,
          holding: false,
          route: null,
          loop: null,
        });
      else if (restore.final) restore.finalSpawns = 0;
    }
    engine = (game === "ayah-defense" ? createAyahDefense : createSurahRush)({
      motor: settings.motor,
      map: settings.map ?? 0,
      tourMaps: settings.tourMaps ?? false,
      restore,
      onEvent: (event) => {
        if (event.type === "map-transfer")
          message =
            lastTransfer = `Map transfer: ${event.points} Construction Points and ${event.coins} Upgrade Coins refunded for displaced towers.`;
        if (event.type === "route-committed") void answer(event.choice);
        if (event.type === "section-finished") {
          pendingSection = false;
          void load();
        }
        if (event.type === "motor-error") {
          try {
            save((r) => {
              r.evidence.push({
                kind: "motor",
                ref: refs[Math.min(record.completed, refs.length - 1)],
              });
              r.evidence = r.evidence.slice(-300);
            });
          } catch (e) {
            fail(e);
          }
        }
        if (event.type === "victory") {
          try {
            save((r) => {
              r.finished = true;
              r.arcade = engine.checkpoint();
            });
            paintRibbon();
          } catch (e) {
            fail(e);
          }
        }
      },
    });
  }
  root.innerHTML = `<section class="flow-adventure ${game}" aria-label="${
    ADVENTURES[game].title
  }"><h3>${ADVENTURES[game].title}</h3><p>${
    ADVENTURES[game].subtitle
  }</p><div class="flow-toolbar"><label>Recitation<select data-adventure-audio><option value="continuous">Continuous full ayah</option><option value="before">Listen before play</option><option value="paused">Pause recitation</option></select></label><button data-flow-mute>Mute recitation</button></div><div class="flow-battlefield" tabindex="0" role="region" aria-label="${
    game === "ayah-defense"
      ? "Fortress battlefield. Digit or Numpad 1–3 answers. Earn points, choose a tower and place it on land."
      : "Momentum course. Arrows move, Space jumps, S slides, Shift dashes. Number keys choose a route."
  }"><div class="flow-hud" role=status></div><div class="flow-scene"><svg viewBox="0 0 900 400" aria-label="${
    game === "ayah-defense" ? "Tower-defense battlefield" : "Platform course"
  }"></svg></div><div class="flow-ribbon" aria-label="Quran revision ribbon"></div><div class="flow-actions"></div><div class="flow-pad"></div><p data-flow-message role=status></p><button data-flow-start disabled>Preparing verified passage…</button><small class="flow-integrity">Pieces are study groups, not recitation stops. Game recognition is separate from independent recitation.</small></div></section>`;
  const field = root.querySelector(".flow-battlefield"),
    svg = root.querySelector("svg"),
    ribbon = root.querySelector(".flow-ribbon"),
    hud = root.querySelector(".flow-hud"),
    actions = root.querySelector(".flow-actions"),
    pad = root.querySelector(".flow-pad");
  if (game === "ayah-defense") {
    const tools = document.createElement("div");
    tools.className = "defense-map-tools";
    tools.innerHTML =
      '<button data-defense-zoom aria-label="Zoom battlefield">Zoom map</button><button data-defense-cancel hidden>Cancel placement</button>';
    root.querySelector(".flow-scene").append(tools);
  }
  mountReadingSetting(root);
  const dispatch = (a) => {
    if (!alive()) return;
    if (a.type === "listen") {
      void recite(true);
      return;
    }
    if (a.type === "resume" && (pendingSave || retrySourceControl)) {
      message = "Retry saving / loading the verified source before resuming.";
      paintAll();
      return;
    }
    engine?.dispatch(a);
    if (a.type === "pause") {
      pauseEpoch++;
      audio.pause();
      cancelFrame(raf);
      raf = 0;
    }
    if (a.type === "resume") {
      wake();
      if (audioMode !== "paused") void audio.resume();
      focusGameplay(field, { force: true });
    }
    paintAll();
  };
  root.__ayahRestartChallenge = async (next) => {
    settings = {
      ...settings,
      memory: next.memory,
      motor: next.motor,
      ...(game === "ayah-defense"
        ? { map: pendingMap, tourMaps: pendingTours }
        : {}),
    };
    placement = null;
    if (
      game === "ayah-defense" &&
      mapChanged &&
      currentFrame().map !== pendingMap
    )
      engine.dispatch({ type: "map", value: pendingMap });
    save((r) => {
      r.settings = settings;
      r.unit = 0;
      r.arcade = engine.checkpoint();
    });
    buildEngine(record.arcade);
    mapChanged = false;
    await load();
    started = true;
    engine.start();
    wake();
    if (audioMode !== "paused") void recite();
    focusGameplay(field, { force: true });
    paint();
  };
  root.addEventListener(
    "keydown",
    (e) => {
      if (
        game !== "ayah-defense" ||
        !placement ||
        e.target.closest("input,select,textarea") ||
        e.isComposing
      )
        return;
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        placement = null;
        paint();
        return;
      }
      const d = {
        ArrowLeft: [-16, 0],
        ArrowRight: [16, 0],
        ArrowUp: [0, -16],
        ArrowDown: [0, 16],
      }[e.code];
      if (d) {
        e.preventDefault();
        e.stopImmediatePropagation();
        placement.x += d[0];
        placement.y += d[1];
        paint();
      }
      if (e.code === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        placeDefense(placement);
      }
    },
    { capture: true, signal: abort.signal }
  );
  frame = mountGameplayFrame({
    root: root.querySelector(".flow-adventure"),
    surface: () => field,
    getState: snapshot,
    dispatch,
    onExit: () => {
      try {
        save((r) => (r.arcade = engine.checkpoint()));
      } catch (e) {
        fail(e);
        return;
      }
      dispose();
      onExit();
    },
    sequence: () => ribbon,
    volume: {
      get: () => audio.getVolume(),
      set: (v) => {
        audio.setVolume(v);
        profileStorage.setItem("ayah-lab-volume", String(v));
      },
    },
  });
  function fail(error) {
    audioEpoch++;
    audioLease?.revoke();
    audioLease = null;
    region = null;
    choices = [];
    message = error.message;
    engine?.pause();
    audio.stop();
    root.querySelector(".gameplay-settings").hidden = true;
    paint();
    const retry = document.createElement("button");
    retry.textContent = "Retry source / save";
    retry.onclick = () => {
      void (async () => {
        const restartPending = pendingReset;
        if (pendingSave) persistRecord();
        if (restartPending) prepareFreshAttempt();
        await flushRewards();
        await load();
      })()
        .then(() => {
          if (!region && record.completed < refs.length) return;
          if (started) {
            engine.resume();
            wake();
          }
          paintAll();
          focusGameplay(field, { force: true });
        })
        .catch((e) => fail(e));
    };
    const recovery = document.createElement("div"),
      detail = document.createElement("p");
    detail.setAttribute("role", "alert");
    detail.textContent = error.message;
    recovery.append(detail, retry);
    retrySourceControl = recovery;
    ribbon.replaceChildren(recovery);
    if (pendingSave) {
      const exportButton = document.createElement("button");
      exportButton.textContent = "Export pending checkpoint";
      exportButton.onclick = () => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify({ version: 1, id, record }, null, 2)], {
            type: "application/json",
          })
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "ayah-defense-pending-recovery.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      recovery.append(exportButton);
    }
  }
  function invalidate() {
    dispose();
    root.textContent =
      "Content access or learning account changed. Saved checkpoints remain; reopen to reauthorize.";
  }
  async function recite(force = false) {
    if (!region || (audioMode === "paused" && !force)) return;
    const wasPlaying = currentFrame()?.status === "playing" || listeningBefore;
    if (!force && !wasPlaying) return;
    const ticket = ++audioEpoch,
      pauseTicket = pauseEpoch;
    const mayResume = () =>
      alive() &&
      ticket === audioEpoch &&
      pauseTicket === pauseEpoch &&
      wasPlaying &&
      started &&
      !pendingSave &&
      !retrySourceControl &&
      root.querySelector(".gameplay-settings").hidden;
    audio.stop();
    audioLease?.revoke();
    audioLease = null;
    try {
      const lease = await loadAudio(region.bundle, client);
      if (!alive() || ticket !== audioEpoch || pauseTicket !== pauseEpoch) {
        lease.revoke();
        return;
      }
      audioLease = lease;
      reportStudyExposure([region.bundle.key]);
      if (audioMode === "before" && wasPlaying) {
        listeningBefore = true;
        engine.pause();
        paintAll();
      }
      const ok = await audio.play(lease.url, {
        loop: audioMode === "continuous",
        muted,
        onEnded: () => {
          if (alive() && ticket === audioEpoch && audioMode === "before") {
            listeningBefore = false;
            if (mayResume()) {
              engine.resume();
              wake();
            }
            paintAll();
          }
        },
      });
      if (ok) save((r) => r.assistance++);
      if (!ok) {
        listeningBefore = false;
        message =
          "Audio unavailable. Replay when ready; your progress remains safe.";
        if (mayResume()) {
          engine.resume();
          wake();
        }
      }
      paint();
    } catch (e) {
      if (alive() && ticket === audioEpoch) {
        if (pendingSave) {
          fail(e);
          return;
        }
        message = e.message;
        if (mayResume()) {
          engine.resume();
          wake();
        }
        paint();
      }
    }
  }
  async function load() {
    retrySourceControl = null;
    readyRecall = settings.memory !== "expert";
    if (region && region.bundle.key === refs[record.completed]) {
      choices = revisionChoices(region.units[record.unit], {
        seed: parseInt(id.slice(0, 8), 16),
        turn: record.completed * 17 + record.unit,
        memory: settings.memory,
      });
      promptGeneration++;
      reportStudyExposure([...new Set(choices.map((c) => c.key))]);
      if (game === "surah-rush") engine.dispatch({ type: "next" });
      paintAll();
      return;
    }
    if (record.completed >= refs.length) {
      if (game === "ayah-defense") engine.dispatch({ type: "final" });
      paintAll();
      return;
    }
    const previousLoaded = region?.bundle;
    const ticket = ++epoch;
    audioEpoch++;
    audio.stop();
    audioLease?.revoke();
    audioLease = null;
    region = null;
    choices = [];
    readyRecall = settings.memory !== "expert";
    if (record.completed >= refs.length) {
      if (game === "ayah-defense") engine.dispatch({ type: "final" });
      else if (!currentFrame().final) engine.dispatch({ type: "final" });
      paint();
      return;
    }
    try {
      const loaded = await authorizeRegion(refs, record.completed, client, {
        memory: settings.memory,
        isCurrent: alive,
        pin: record.pins[refs[record.completed]],
        verifyBundle,
      });
      if (!alive() || ticket !== epoch) return;
      if (record.unit >= loaded.units.length)
        throw Error(
          "Saved word position needs recovery; existing record retained"
        );
      if (record.completed > 0) {
        const previousKey = refs[record.completed - 1],
          previous =
            previousLoaded?.key === previousKey
              ? previousLoaded
              : await loadBundle(previousKey, client);
        await verifyBundle(previous);
        if (!alive() || ticket !== epoch) return;
        if (
          record.pins[previousKey] &&
          JSON.stringify(await fingerprints(previous)) !==
            JSON.stringify(record.pins[previousKey])
        )
          throw Error("Previous source revision changed; progress retained");
        loaded.transitionCue = previous.words
          .slice(-3)
          .map((w) => w.text)
          .join(" ");
      }
      region = loaded;
      save((r) => (r.pins[loaded.bundle.key] = loaded.fingerprint));
      choices = revisionChoices(loaded.units[record.unit], {
        seed: parseInt(id.slice(0, 8), 16),
        turn: record.completed * 17 + record.unit,
        memory: settings.memory,
      });
      promptGeneration++;
      reportStudyExposure([...new Set(choices.map((c) => c.key))]);
      if (game === "surah-rush") engine.dispatch({ type: "next" });
      if (started) void recite();
      paintAll();
    } catch (e) {
      if (alive() && ticket === epoch) fail(e);
    }
  }
  async function answer(index, generation = promptGeneration) {
    if (
      !alive() ||
      generation !== promptGeneration ||
      busy ||
      !region ||
      !readyRecall ||
      currentFrame().status !== "playing"
    )
      return;
    const choice = choices[index],
      unit = region.units[record.unit];
    if (!choice) return;
    busy = true;
    try {
      if (choice.id !== unit.id) {
        save((r) => {
          r.evidence.push({
            kind: "memory",
            category:
              unit.positions[0] === 1 && record.completed > 0
                ? "adjacent-ayah-continuation"
                : unit.review
                ? "phrase-transition"
                : "word-selection",
            ref: unit.key,
            unit: unit.id,
            selected: choice.id,
          });
          r.evidence = r.evidence.slice(-300);
          r.strikes = (r.strikes || 0) + 1;
        });
        message = "Not this continuation. Compare the full ayah and try again.";
        if (game === "surah-rush") engine.dispatch({ type: "wrong" });
        if ((record.strikes || 0) >= 3) {
          engine.pause();
          message =
            "Three recognition mistakes. Replay the verified ayah, then use Retry current challenge. Earlier coverage stays saved.";
        }
        paintRibbon();
        return;
      }
      // Commit source coverage before construction energy or opening a route.
      const acceptedId = unit.id,
        already = record.accepted.includes(acceptedId),
        ayahFinished = record.unit === region.units.length - 1,
        key = unit.key;
      if (game === "ayah-defense" && !already) {
        const n = region.units.length,
          budget = Math.min(80, Math.max(20, n * 10)),
          points = Math.floor(budget / n) + (record.unit < budget % n ? 1 : 0);
        engine.dispatch({
          type: "revision",
          id: acceptedId,
          points,
          lastSource: ayahFinished && record.completed === refs.length - 1,
        });
      }
      if (
        game === "ayah-defense" &&
        ayahFinished &&
        (record.completed + 1) % 5 === 0
      )
        engine.dispatch({
          type: "region",
          index: Math.floor((record.completed + 1) / 5),
        });
      save((r) => {
        if (!r.accepted.includes(acceptedId)) r.accepted.push(acceptedId);
        r.unit++;
        if (ayahFinished) {
          r.completed++;
          r.unit = 0;
          r.accepted = [];
          r.strikes = 0;
          r.pendingRewards ??= [];
          if (!r.pendingRewards.includes(key)) r.pendingRewards.push(key);
        }
        r.arcade = engine.checkpoint();
      });
      if (game === "ayah-defense") {
        // Coverage, construction receipts and region changes are already in one checkpoint.
      } else {
        engine.dispatch({ type: "correct", index });
        pendingSection = true;
        if (record.completed === refs.length)
          engine.dispatch({ type: "final" });
      }
      message =
        lastTransfer ||
        (ayahFinished
          ? "Ayah covered in supported revision. Continue your journey."
          : "Verified continuation connected.");
      lastTransfer = "";
      await flushRewards();
      if (!alive()) return;
      save((r) => (r.arcade = engine.checkpoint()));
      if (game === "ayah-defense") await load();
      else {
        choices = [];
        paintRibbon();
      }
    } catch (e) {
      if (alive()) fail(e);
    } finally {
      busy = false;
      if (
        alive() &&
        document.activeElement === document.body &&
        currentFrame().status === "playing"
      )
        focusGameplay(field, { force: true });
    }
  }
  function paintRibbon() {
    if (!alive()) return;
    if (retrySourceControl) {
      ribbon.replaceChildren(retrySourceControl);
      return;
    }
    const s = currentFrame();
    if (record.finished || s.status === "won") {
      ribbon.innerHTML = `<h4>Passage complete · ${refs.length}/${refs.length} ayahs</h4><p>Supported recognition, not certified spoken mastery.</p><button data-flow-end="replay">Replay</button><button data-flow-end="harder">Harder memory</button><button data-flow-end="faster">Faster game speed</button><button data-flow-end="next">Next ayah batch</button><button data-flow-end="recall">Independent self-assessment</button><button data-flow-end="exit">Other revision games</button>`;
      return;
    }
    if (pendingSection) {
      ribbon.innerHTML =
        "<p>Correct route open. Run right to reach the next section.</p>";
      return;
    }
    if (record.completed >= refs.length) {
      ribbon.innerHTML =
        "<p>Selected Arabic coverage complete. Finish the final crossing / neutral defense wave.</p>";
      return;
    }
    if (!region) {
      ribbon.innerHTML =
        record.completed >= refs.length
          ? "<p>Revision covered. Finish the crossing / defend the final neutral wave.</p>"
          : pendingSection
          ? "<p>Route open! Run to the next section.</p>"
          : "<p>Authorizing the next source region…</p>";
      return;
    }
    const unit = region.units[record.unit];
    ribbon.innerHTML = `<p>${unit.key} · words ${
      unit.positions[0]
    }–${unit.positions.at(-1)} · ${record.completed}/${refs.length} ayahs${
      unit.cumulative ? " · cumulative connection" : ""
    }</p>${
      record.unit === 0 && region.transitionCue && settings.memory !== "expert"
        ? `<p>Previous ayah ending · visual cue</p><p class="arabic" dir=rtl lang=ar>${esc(
            region.transitionCue
          )}</p>`
        : ""
    }${
      unit.cue ? `<p class="arabic" dir=rtl lang=ar>${esc(unit.cue)}</p>` : ""
    }${
      !readyRecall
        ? "<p>Try saying the next wording from memory.</p><button data-flow-ready>Ready · show routes</button>"
        : `<div class="flow-choices" dir=rtl>${choices
            .map(
              (c, i) =>
                `<button data-flow-choice="${i}" data-flow-generation="${promptGeneration}" data-flow-prompt="${
                  unit.id
                }" ${s.status !== "playing" ? "disabled" : ""}><small>${
                  i + 1
                }</small><span class="arabic" dir=rtl lang=ar>${esc(
                  c.text
                )}</span>${readingHTML(c)}</button>`
            )
            .join("")}</div>`
    }<button data-flow-hint>Inspect full verified ayah · assistance</button>${
      (record.strikes || 0) >= 3
        ? "<button data-flow-retry>Retry current challenge</button>"
        : ""
    }`;
  }
  function paint() {
    if (!alive() || !engine) return;
    const s = currentFrame();
    const narrowCourse = game === "surah-rush" && svg.clientWidth < 600;
    if (game !== "ayah-defense")
      svg.setAttribute(
        "viewBox",
        narrowCourse ? "0 110 480 290" : "0 0 900 400"
      );
    const renderCamera = narrowCourse
      ? Math.max(0, Math.min(810, s.x - 160))
      : s.camera;
    const minimalMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      experiencePreferences().effects !== "full";
    field.dataset.adventureState = s.status;
    field.dataset.reference = refs[Math.min(refs.length - 1, record.completed)];
    field.dataset.covered = String(record.completed);
    if (game === "surah-rush") {
      field.dataset.playerX = String(s.x);
      field.dataset.playerY = String(s.y);
      field.dataset.flow = String(s.flow);
    }
    hud.textContent =
      game === "ayah-defense"
        ? `${mapFor(s.map).name} · ${
            !s.towers.some((t) => TOWERS[t.kind].damage > 0)
              ? "Grace wave · earn and place your first defense"
              : "wave " + s.wave
          } · fortress ${Math.ceil(s.core)} · shield ${Math.ceil(
            s.shield
          )} · ◇ Upgrade Coins ${s.coins} · ✦ Construction Points ${s.energy}`
        : `Region ${
            Math.floor(record.completed / 5) + 1
          } · momentum ${Math.round(Math.abs(s.vx))} · flow ${s.flow} · ${
            s.motorErrors
          } motor recoveries`;
    root.querySelector("[data-flow-message]").textContent = message;
    const startButton = root.querySelector("[data-flow-start]");
    startButton.hidden = started || record.finished;
    startButton.disabled =
      pendingSave ||
      !!retrySourceControl ||
      (!region && record.completed < refs.length);
    startButton.textContent = startButton.disabled
      ? "Preparing verified passage…"
      : "Start journey";
    if (game === "ayah-defense") {
      renderDefenseScene(svg, s, {
        placement,
        selected: selectedTowerId,
        zoom,
        minimal: minimalMotion,
        effects: experiencePreferences().effects,
      });
      paintDefenseShop(s);
    } else {
      let ground = "";
      for (let x = 0; x <= 1320; x += 10) {
        const y = terrain(x, s.course);
        if (y !== null)
          ground += `<rect x="${x}" y="${y}" width=12 height="${
            500 - y
          }" fill="#34576d"/>`;
      }
      drawScene(
        `<rect width=900 height=400 fill="#152342"/><g transform="translate(${-renderCamera},0)">${ground}<path d="M185 ${
          settings.motor === "relaxed" ? 282 : terrain(220, s.course) - 40
        } H265" stroke="#c3cfe0" stroke-width=12/><text x=190 y=260 fill=white font-size=12>Slide / jump</text><path d="M940 310 C930 170 1110 160 1080 310" stroke="#89dce4" stroke-width=8 fill=none/><path d="M${
          [525, 585, 520][s.course % 3] - 5
        } ${terrain(
          [525, 585, 520][s.course % 3],
          s.course
        )} l12 -12 12 12 12 -12 12 12" stroke=gold stroke-width=5 fill=none/>${[
          0, 1, 2,
        ]
          .map(
            (n) =>
              `<path d="M730 300 Q840 ${140 + n * 75} 960 ${
                200 + n * 55
              }" stroke="${
                s.gateOpen && s.route === n ? "#ffdb6f" : "#5e929d"
              }" stroke-width=7 fill=none/>`
          )
          .join("")}<path d="M760 170 V320" stroke="${
          s.gateOpen ? "#f5ce63" : "#9cd7d7"
        }" stroke-width=5/><g data-flow-runner transform="translate(${s.x},${
          s.y
        })"><ellipse rx="${s.slide ? 22 : 16}" ry="${
          s.slide ? 10 : 19
        }" fill="#7bd9cd"/><path d="M-4 -16 Q-20 -36 8 -25" stroke="#f6ce68" stroke-width=6 fill=none/><circle cx=7 cy=-5 r=3 fill="#152342"/>${
          s.dash > 0 ? '<path d="M-18 0 H-70" stroke=gold stroke-width=8/>' : ""
        }</g><path d="M1260 200 V355" stroke=gold stroke-width=6/></g>`
      );
    }
    if (
      game === "ayah-defense" &&
      s.status === "recovery" &&
      !actions.querySelector("[data-flow-recover]")
    ) {
      const b = document.createElement("button");
      b.dataset.flowRecover = "";
      b.textContent = "Repair fortress · motor recovery";
      actions.prepend(b);
    }
    if (game === "surah-rush" && !pad.children.length)
      pad.innerHTML =
        '<button data-flow-move="-1">←</button><button data-flow-control="jump">Jump</button><button data-flow-move="1">→</button><button data-flow-control="dash">Dash</button><button data-flow-slide>Slide</button>';
    frame.update(snapshot());
  }
  window.addEventListener("resize", () => paint(), { signal: abort.signal });
  function drawScene(markup) {
    // HTML foreign-content parsing treats a slash after an unquoted value as part
    // of that value. Separate self-closing tokens so sibling SVG objects remain siblings.
    svg.innerHTML = markup.replace(/\/>/g, " />");
  }
  function prepareFreshAttempt() {
    buildEngine(null);
    placement = null;
    selectedTowerId = null;
    started = false;
    region = null;
    choices = [];
    audioEpoch++;
    audio.stop();
    audioLease?.revoke();
    audioLease = null;
    root.querySelector(".gameplay-settings").hidden = true;
  }
  function restartEntire() {
    try {
      save((r) => {
        const old = structuredClone(r);
        Object.assign(r, newAdventure(game, refs, settings), {
          evidence: old.evidence,
          history: [
            ...(old.history || []),
            {
              completed: old.completed,
              unit: old.unit,
              accepted: old.accepted,
              pins: old.pins,
              arcade: old.arcade,
              assistance: old.assistance,
              finished: old.finished,
              settings: old.settings,
            },
          ].slice(-50),
        });
      }, true);
      prepareFreshAttempt();
      void load();
      focusGameplay(field, { force: true });
    } catch (e) {
      fail(e);
    }
  }
  function persistDefense() {
    try {
      save((r) => (r.arcade = engine.checkpoint()));
      paint();
    } catch (e) {
      fail(e);
    }
  }
  function selectPlacement(kind) {
    const s = currentFrame();
    if (pendingSave || retrySourceControl) return;
    if (!Object.hasOwn(TOWERS, kind) || s.energy < TOWERS[kind].cost) {
      message = "Earn more Construction Points from the revision ribbon.";
      paint();
      return;
    }
    placement = {
      kind,
      ...(legalPositions(s.map, s.towers)[0] || { x: 450, y: 250 }),
    };
    paint();
    svg.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    focusGameplay(field, { force: true });
  }
  function placeDefense(position) {
    if (!placement || pendingSave || retrySourceControl) return;
    const s = currentFrame(),
      check = placementCheck(s.map, position, s.towers);
    if (!check.valid) {
      message = check.reason;
      placement = { ...placement, ...position };
      paint();
      return;
    }
    const before = s.towers.length;
    engine.dispatch({ type: "place", kind: placement.kind, position });
    const after = currentFrame();
    if (after.towers.length > before) {
      selectedTowerId = after.towers.at(-1).id;
      placement = null;
      actions.scrollTop = 0;
      message = "Tower constructed. Its foundation is permanent.";
      persistDefense();
    } else {
      message = "Purchase not made. Check your Construction Points.";
      paint();
    }
    focusGameplay(field, { force: true });
  }
  function paintDefenseShop(s) {
    if (!actions.dataset.defenseShop) {
      actions.dataset.defenseShop = "true";
      actions.innerHTML = `<div class="defense-shop-head"><strong>Tower shop</strong><button data-defense-shop-view>Upgrades & targeting</button></div><div class="defense-shop" aria-label="Tower shop">${Object.entries(
        TOWERS
      )
        .map(
          ([kind, t]) =>
            `<button draggable="true" data-defense-buy="${kind}" aria-label="Buy ${
              t.name
            } Tower, ${
              t.cost
            } Construction Points"><span class="defense-shop-icon" aria-hidden="true">${
              {
                arrow: "➶",
                frost: "❄",
                beam: "✧",
                pulse: "◎",
                guardian: "♜",
                observatory: "☾",
              }[kind]
            }</span><strong>${t.name}</strong><small>✦ ${
              t.cost
            }</small></button>`
        )
        .join(
          ""
        )}</div><p data-defense-placement-status role="status"></p><div class="defense-placement-controls"><button data-defense-cancel hidden>Cancel placement · Esc</button><button data-defense-confirm hidden>Build here · Enter</button><button data-defense-zoom>Zoom map</button></div><div class="defense-tower-controls"><label>Your tower<select data-defense-selected><option value="">Select a tower</option></select></label><label>Target<select data-defense-targeting><option value="first">First</option><option value="last">Last</option><option value="strongest">Strongest</option><option value="nearest">Nearest</option></select></label><button data-flow-upgrade>Upgrade selected tower</button></div><details class="defense-help"><summary>How to play & commander abilities</summary><p>Start with zero points. Answer 1–3 or Numpad 1–3, then buy a tower and tap land beside the path. Dragging also works. Arrows move a selected preview; Enter builds; Esc cancels. Opening balloons wait safely while you learn.</p>${[
        "shield",
        "overcharge",
        "frost",
      ]
        .map((n) => `<button data-flow-ability="${n}">${n}</button>`)
        .join("")}</details>`;
    }
    for (const b of actions.querySelectorAll("[data-defense-buy]")) {
      const t = TOWERS[b.dataset.defenseBuy];
      const supportBlocked =
        t.damage === 0 && !s.towers.some((k) => TOWERS[k.kind].damage > 0);
      b.disabled =
        s.energy < t.cost ||
        s.towers.length >= 24 ||
        supportBlocked ||
        pendingSave ||
        !!retrySourceControl;
      b.title = supportBlocked
        ? "Build an attacking tower before support towers."
        : `${t.cost} Construction Points`;
      b.setAttribute(
        "aria-pressed",
        String(placement?.kind === b.dataset.defenseBuy)
      );
    }
    actions.querySelector(".defense-shop").hidden = shopView !== "buy";
    actions.querySelector(".defense-tower-controls").hidden =
      shopView !== "controls";
    actions.querySelector("[data-defense-shop-view]").textContent =
      shopView === "buy" ? "Upgrades & targeting" : "Buy towers";
    actions.querySelector("[data-defense-placement-status]").hidden =
      !placement && s.firstBuiltAt !== null;
    const select = actions.querySelector("[data-defense-selected]"),
      signature = s.towers.map((t) => t.id + ":" + t.level).join("|");
    if (select.dataset.signature !== signature) {
      select.dataset.signature = signature;
      select.innerHTML =
        '<option value="">Select a tower</option>' +
        s.towers
          .map(
            (t) =>
              `<option value="${t.id}">${TOWERS[t.kind].name} · level ${
                t.level
              }</option>`
          )
          .join("");
    }
    select.value = selectedTowerId ? String(selectedTowerId) : "";
    const t = s.towers.find((t) => t.id === selectedTowerId),
      up = actions.querySelector("[data-flow-upgrade]");
    up.disabled = !t || t.level >= 3 || s.coins < t.level * 18;
    up.textContent = t
      ? t.level >= 3
        ? "Fully upgraded"
        : `Upgrade · ◇ ${t.level * 18}`
      : "Select a tower to upgrade";
    actions.querySelector("[data-defense-targeting]").disabled = !t;
    if (t)
      actions.querySelector("[data-defense-targeting]").value = t.targeting;
    for (const b of actions.querySelectorAll("[data-flow-ability]")) {
      b.disabled =
        s.status !== "playing" || s.cooldowns[b.dataset.flowAbility] > 0;
      b.textContent =
        b.dataset.flowAbility +
        (s.cooldowns[b.dataset.flowAbility] > 0
          ? " · " + Math.ceil(s.cooldowns[b.dataset.flowAbility]) + "s"
          : " · ready");
    }
    for (const b of root.querySelectorAll("[data-defense-cancel]"))
      b.hidden = !placement;
    actions.querySelector("[data-defense-confirm]").hidden = !placement;
    actions.querySelector("[data-defense-placement-status]").textContent =
      placement
        ? `${placementCheck(s.map, placement, s.towers).valid ? "✓" : "×"} ${
            placementCheck(s.map, placement, s.towers).reason
          } · ✦ ${TOWERS[placement.kind].cost}`
        : !s.towers.some((t) => TOWERS[t.kind].damage > 0)
        ? "Grace Wave: earn ✦ 50, choose Arrow, then tap land. A short completed passage earns a bounded first-defense bonus."
        : "Choose a tower to inspect its range. Towers stay where you build them.";
  }
  if (game === "ayah-defense") {
    root
      .querySelector(".gameplay-settings")
      .querySelector('[data-game-command="exit"]').textContent = "Save & Exit";
    const options = root
      .querySelector(".gameplay-settings")
      .querySelector("[data-game-options]");
    const mapLabel = document.createElement("label");
    mapLabel.textContent = "Map · applies on Restart with New Settings";
    const mapSelect = document.createElement("select");
    mapSelect.dataset.defenseMapSetting = "";
    mapSelect.innerHTML = DEFENSE_MAPS.map(
      (m, i) => `<option value="${i}">${m.name}</option>`
    ).join("");
    mapSelect.value = String(pendingMap);
    mapSelect.onchange = () => {
      pendingMap = Number(mapSelect.value);
      mapChanged = true;
    };
    mapLabel.append(mapSelect);
    options.append(mapLabel);
    const note = document.createElement("p");
    note.textContent =
      "Map changes keep valid towers. Displaced towers refund exactly their paid Construction Points and spent Upgrade Coins. No free resources are granted.";
    options.append(note);
    const restart = document.createElement("details");
    restart.innerHTML =
      "<summary>Restart entire selected range</summary><p>Completed evidence is archived; the new attempt starts at the beginning with zero currencies.</p><button data-defense-entire-confirm>Restart entire range · keep previous history</button>";
    options.append(restart);
    restart.querySelector("button").onclick = restartEntire;
    svg.addEventListener(
      "pointerdown",
      (e) => {
        if (!placement) {
          const t = e.target.closest("[data-defense-tower]");
          if (t) {
            selectedTowerId = Number(t.dataset.defenseTower);
            paint();
          }
        }
      },
      { signal: abort.signal }
    );
    svg.addEventListener(
      "pointermove",
      (e) => {
        if (!placement) return;
        const p = pointerOnMap(svg, e.clientX, e.clientY);
        if (p) {
          placement = { ...placement, ...p };
          paint();
        }
      },
      { signal: abort.signal }
    );
    svg.addEventListener(
      "click",
      (e) => {
        if (placement) {
          const p = pointerOnMap(svg, e.clientX, e.clientY);
          if (p) placeDefense(p);
        } else {
          const t = e.target.closest("[data-defense-tower]");
          if (t) {
            selectedTowerId = Number(t.dataset.defenseTower);
            paint();
          }
        }
      },
      { signal: abort.signal }
    );
    actions.addEventListener(
      "dragstart",
      (e) => {
        const b = e.target.closest("[data-defense-buy]");
        if (!b || b.disabled) return;
        selectPlacement(b.dataset.defenseBuy);
        e.dataTransfer.setData("text/plain", b.dataset.defenseBuy);
        e.dataTransfer.effectAllowed = "copy";
      },
      { signal: abort.signal }
    );
    svg.addEventListener(
      "dragover",
      (e) => {
        if (placement) {
          e.preventDefault();
          const p = pointerOnMap(svg, e.clientX, e.clientY);
          if (p) {
            placement = { ...placement, ...p };
            paint();
          }
        }
      },
      { signal: abort.signal }
    );
    svg.addEventListener(
      "drop",
      (e) => {
        e.preventDefault();
        const p = pointerOnMap(svg, e.clientX, e.clientY);
        if (placement && p) placeDefense(p);
      },
      { signal: abort.signal }
    );
    actions.addEventListener(
      "change",
      (e) => {
        if (e.target.matches("[data-defense-selected]")) {
          selectedTowerId = Number(e.target.value) || null;
          paint();
        }
        if (e.target.matches("[data-defense-targeting]")) {
          engine.dispatch({
            type: "targeting",
            id: selectedTowerId,
            value: e.target.value,
          });
          persistDefense();
        }
      },
      { signal: abort.signal }
    );
  }
  function paintAll() {
    paint();
    paintRibbon();
  }
  field.addEventListener(
    "change",
    (e) => {
      if (e.target.matches("[data-flow-site-select]")) {
        selectedSite = Number(e.target.value);
        paint();
      }
    },
    { signal: abort.signal }
  );
  field.addEventListener(
    "pointerdown",
    (e) => {
      const site = e.target.closest("[data-flow-site]");
      if (site) {
        selectedSite = Number(site.dataset.flowSite);
        const select = root.querySelector("[data-flow-site-select]");
        if (select) select.value = String(selectedSite);
      }
    },
    { signal: abort.signal }
  );
  field.addEventListener("click", (e) => {
    const b = e.target.closest("button,[data-flow-site]");
    if (!b) return;
    if (b.dataset.flowSite !== undefined) {
      selectedSite = Number(b.dataset.flowSite);
      const select = root.querySelector("[data-flow-site-select]");
      if (select) select.value = String(selectedSite);
      paint();
    }
    if (b.hasAttribute("data-flow-start")) {
      if (!region && record.completed < refs.length) {
        message = "Verified source is not ready. Use Retry source / save.";
        paint();
        return;
      }
      started = true;
      engine.start();
      wake();
      void recite();
      paintAll();
      focusGameplay(field, { force: true });
    }
    if (b.dataset.flowChoice !== undefined) {
      if (game === "surah-rush") {
        engine.dispatch({ type: "route", index: Number(b.dataset.flowChoice) });
        message = "Route selected. Move right into the gateway.";
        paint();
        focusGameplay(field, { force: true });
      } else
        void answer(
          Number(b.dataset.flowChoice),
          Number(b.dataset.flowGeneration)
        ).then(paintAll);
    }
    if (e.detail === 0 && b.dataset.flowControl)
      engine.dispatch({ type: b.dataset.flowControl });
    if (e.detail === 0 && b.dataset.flowMove) move(Number(b.dataset.flowMove));
    if (e.detail === 0 && b.hasAttribute("data-flow-slide"))
      engine.dispatch({ type: "slide", active: !currentFrame().slide });
    if (b.hasAttribute("data-flow-ready")) {
      readyRecall = true;
      paintRibbon();
    }
    if (b.hasAttribute("data-defense-shop-view")) {
      shopView = shopView === "buy" ? "controls" : "buy";
      paint();
      actions.scrollTop = 0;
      return;
    }
    if (b.dataset.defenseBuy) {
      selectPlacement(b.dataset.defenseBuy);
      return;
    }
    if (b.hasAttribute("data-defense-cancel")) {
      placement = null;
      paint();
      focusGameplay(field, { force: true });
      return;
    }
    if (b.hasAttribute("data-defense-confirm")) {
      if (placement) placeDefense(placement);
      return;
    }
    if (b.hasAttribute("data-defense-zoom")) {
      const center = placement ||
        currentFrame().towers.find((t) => t.id === selectedTowerId) || {
          x: 450,
          y: 250,
        };
      zoom = zoom
        ? null
        : {
            x: Math.max(0, Math.min(340, center.x - 280)),
            y: Math.max(0, Math.min(150, center.y - 175)),
          };
      paint();
      return;
    }
    if (b.hasAttribute("data-flow-upgrade")) {
      engine.dispatch({ type: "upgrade", id: selectedTowerId });
      persistDefense();
      return;
    }
    if (b.dataset.flowAbility) {
      engine.dispatch({ type: "ability", name: b.dataset.flowAbility });
      persistDefense();
      return;
    }
    if (b.hasAttribute("data-flow-recover")) {
      if (pendingSave || retrySourceControl) return;
      engine.dispatch({ type: "recover" });
      wake();
      actions.dataset.initialized = "";
      actions.innerHTML = "";
      paint();
    }
    if (b.hasAttribute("data-flow-hint") && region) {
      save((r) => r.assistance++);
      message = region.bundle.textUthmani;
      const hint = document.createElement("p");
      hint.className = "arabic";
      hint.dir = "rtl";
      hint.lang = "ar";
      hint.textContent = region.bundle.textUthmani;
      ribbon.append(hint);
    }
    if (b.hasAttribute("data-flow-retry")) {
      save((r) => (r.strikes = 0));
      engine.resume();
      wake();
      paintAll();
    }
    if (b.dataset.flowAssess !== undefined) {
      const section = refs.slice(
        Number(b.dataset.flowAssess) * 10,
        Number(b.dataset.flowAssess) * 10 + 10
      );
      studio?.dispose();
      root.hidden = true;
      studio = openPassageStudio({
        onClose: () => {
          if (alive()) {
            root.hidden = false;
            focusGameplay(field, { force: true });
          }
        },
        client,
        user: owner ? { id: owner } : null,
        initialReference: section[0],
        initialRefs: section,
        coachAction: "review",
        coachTarget: { refs: section },
      });
    }
    if (b.dataset.flowEnd) {
      const type = b.dataset.flowEnd;
      if (type === "exit") {
        dispose();
        onExit();
      } else if (type === "recall") {
        audio.stop();
        ribbon.innerHTML =
          "<h4>Independent self-assessment · choose a section</h4>" +
          Array.from(
            { length: Math.ceil(refs.length / 10) },
            (_, i) =>
              `<button data-flow-assess="${i}">${refs[i * 10]}–${
                refs[Math.min(refs.length - 1, i * 10 + 9)]
              }</button>`
          ).join("");
      } else if (type === "next") {
        const last = Number(refs.at(-1).split(":")[1]),
          chapter = refs.at(-1).split(":")[0];
        onNext({ surah: Number(chapter), first: last + 1, size: refs.length });
      } else {
        if (type === "harder")
          settings.memory = {
            guided: "standard",
            standard: "expert",
            expert: "expert",
          }[settings.memory];
        if (type === "faster")
          settings.motor = {
            relaxed: "normal",
            normal: "arcade",
            arcade: "arcade",
          }[settings.motor];
        restartEntire();
      }
    }
  });
  const pointers = new Map();
  const move = (direction) => {
    engine.dispatch({ type: "move", direction });
    focusGameplay(field, { force: true });
  };
  pad.addEventListener(
    "pointerdown",
    (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, {
        direction: Number(b.dataset.flowMove) || 0,
        slide: b.hasAttribute("data-flow-slide"),
      });
      if (b.dataset.flowMove) move(Number(b.dataset.flowMove));
      if (b.dataset.flowControl)
        engine.dispatch({ type: b.dataset.flowControl });
      if (b.hasAttribute("data-flow-slide"))
        engine.dispatch({ type: "slide", active: true });
    },
    { signal: abort.signal }
  );
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    pad.addEventListener(
      name,
      (e) => {
        pointers.delete(e.pointerId);
        engine.dispatch({
          type: "move",
          direction:
            [...pointers.values()].find((p) => p.direction)?.direction || 0,
        });
        engine.dispatch({
          type: "slide",
          active: [...pointers.values()].some((p) => p.slide),
        });
      },
      { signal: abort.signal }
    );
  field.addEventListener(
    "keydown",
    (e) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.target.closest(
          "input,select,textarea,button,[contenteditable=true]"
        ) ||
        root.querySelector(".gameplay-settings:not([hidden])")
      )
        return;
      const key = e.code;
      if (
        e.repeat &&
        (/(?:Digit|Numpad)[1-3]/.test(key) ||
          ["Space", "ShiftLeft", "ShiftRight"].includes(key))
      )
        return;
      if (/^(?:Digit|Numpad)[1-3]$/.test(key)) {
        if (heldAnswers.has(key)) return;
        heldAnswers.add(key);
        e.preventDefault();
        const index = Number(key.at(-1)) - 1;
        if (game === "ayah-defense") void answer(index).then(paintAll);
        else engine.dispatch({ type: "route", index });
        return;
      }
      const command = {
        ArrowLeft: ["move", -1],
        KeyA: ["move", -1],
        ArrowRight: ["move", 1],
        KeyD: ["move", 1],
        Space: ["jump"],
        ArrowDown: ["slide"],
        KeyS: ["slide"],
        ShiftLeft: ["dash"],
        ShiftRight: ["dash"],
      }[key];
      if (command && game === "surah-rush") {
        e.preventDefault();
        engine.dispatch({
          type: command[0],
          direction: command[1],
          active: true,
        });
      }
    },
    { signal: abort.signal }
  );
  field.addEventListener(
    "keyup",
    (e) => {
      heldAnswers.delete(e.code);
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code))
        engine.dispatch({ type: "move", direction: 0 });
      if (["KeyS", "ArrowDown"].includes(e.code))
        engine.dispatch({ type: "slide", active: false });
    },
    { signal: abort.signal }
  );
  root.querySelector("[data-adventure-audio]").onchange = (e) => {
    audioMode = e.target.value;
    audio.stop();
    if (listeningBefore && audioMode === "paused") {
      listeningBefore = false;
      if (started) {
        engine.resume();
        wake();
      }
    }
    if (audioMode !== "paused" && started) void recite();
  };
  root.querySelector("[data-flow-mute]").onclick = (e) => {
    muted = !muted;
    audio.mute(muted);
    e.target.textContent = muted ? "Unmute recitation" : "Mute recitation";
  };
  root.addEventListener("keyup", (e) => heldAnswers.delete(e.code), {
    capture: true,
    signal: abort.signal,
  });
  const background = () => {
    pauseEpoch++;
    heldAnswers.clear();
    message = "Paused safely. Resume when ready.";
    engine?.pause();
    audio.pause();
    cancelFrame(raf);
    raf = 0;
    paintAll();
  };
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) background();
    },
    { signal: abort.signal }
  );
  window.addEventListener("blur", background, { signal: abort.signal });
  window.addEventListener("ayahprofilechange", invalidate, {
    signal: abort.signal,
  });
  for (const event of [
    "ayah-content-access-changed",
    "ayah-private-content-denied",
    "ayah-developer-mode",
  ])
    window.addEventListener(
      event,
      () => {
        if (refs.some((r) => !freeReference(r))) invalidate();
      },
      { signal: abort.signal }
    );
  const timer = setInterval(async () => {
    if (!alive() || !region || freeReference(region.bundle.key)) return;
    try {
      const current = await loadBundle(region.bundle.key, client);
      if (!alive()) return;
      if (
        JSON.stringify(await fingerprints(current)) !==
        JSON.stringify(region.fingerprint)
      )
        invalidate();
    } catch {
      if (alive()) invalidate();
    }
  }, 60000);
  function dispose() {
    if (disposed) return;
    disposed = true;
    epoch++;
    audioEpoch++;
    clearInterval(timer);
    abort.abort();
    cancelFrame(raf);
    frame?.dispose();
    engine?.dispose();
    audio.dispose();
    audioLease?.revoke();
    studio?.dispose();
    delete root.__ayahRestartChallenge;
    region = null;
    choices = [];
    message = "";
    root.hidden = false;
    root.replaceChildren();
  }
  function wake() {
    if (!raf && alive()) {
      last = 0;
      raf = requestFrame(loop);
    }
  }
  function loop(t) {
    raf = 0;
    if (!alive()) {
      if (!disposed) dispose();
      return;
    }
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    if (dt > 0.5) {
      background();
    } else engine.dispatch({ type: "tick", dt });
    paint();
    if (currentFrame().status === "playing") raf = requestFrame(loop);
  }
  buildEngine();
  await flushRewards();
  await load();
  paintAll();
  raf = requestFrame(loop);
  return {
    start() {
      started = true;
      engine.start();
      wake();
      void recite();
      paintAll();
      focusGameplay(field, { force: true });
    },
    pause: background,
    resume: () => dispatch({ type: "resume" }),
    getSnapshot: () => ({
      game,
      refs: [...refs],
      completed: record.completed,
      unit: record.unit,
      pendingSave,
      answerPending: busy,
      promptGeneration,
      engine: engine.getSnapshot(),
    }),
    dispose,
  };
}
