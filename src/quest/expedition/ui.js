import { esc } from "../../ui/dom.js";
import { surahs } from "../../data.js";
import {
  catalog,
  availability,
  loadBundle,
  loadAudio,
  reference,
} from "../../content/library.js";
import {
  activeProfileId,
  profileStorage,
} from "../../learner/profile-storage.js";
import { createPassageMemory } from "../../passage/memory.js";
import { createLearningStore } from "../../learning-store.js";
import { createPuzzleStore } from "../../puzzles/puzzle-store.js";
import { createQuestStore } from "../store.js";
import { nextCheckpoint } from "../map.js";
import { createQuestHost, questArcadeRegistry } from "../host.js";
import { createQuestRewards } from "../rewards.js";
import { createAudioManager } from "../../puzzles/arcade/services.js";
import { readLabVolume } from "../../puzzles/audio-level.js";
import { successCue, stopEncouragement } from "../../ui/encouragement.js";
import { isDeveloperMode } from "../../developer/access.js";
import { contentRevision, segmentationRevision } from "../checkpoints.js";
import {
  createExpeditionMap,
  resumeExpedition,
  expeditionOptions,
  stageNames,
} from "./model.js";
import { mountStudy } from "./activities.js";
import { blocksRegistration } from "./blocks.js";
import "../../puzzles/falling.css";
import "./expedition.css";

let activeExpedition = null;
export function openExpedition(ctx = {}) {
  activeExpedition?.close();
  const owner = ctx.user?.id || null,
    getOwner = activeProfileId;
  let disposed = false,
    paused = false;
  if (getOwner() !== owner)
    throw Error("Account changed. Reopen Passage Expedition.");
  const storage = {
    getItem: (k) => {
      guard();
      return profileStorage.getItem(k);
    },
    setItem: (k, v) => {
      guard();
      profileStorage.setItem(k, v);
    },
    removeItem: (k) => {
      guard();
      profileStorage.removeItem(k);
    },
  };
  const sourceRefs = [
    ...surahs.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
    ...availability.premium.map((p) => p.key),
  ];
  const validationLibrary = catalog.chapters.map((c) => ({
    id: c.id,
    verses: sourceRefs
      .filter((k) => reference(k).surah === c.id)
      .map((k) => ({ id: reference(k).ayah })),
  }));
  const learning = createLearningStore(storage, validationLibrary),
    lab = createPuzzleStore(storage, validationLibrary),
    store = createQuestStore({ owner, getOwner, storage }),
    rewards = createQuestRewards({ storage, learning, lab, owner, getOwner });
  const registry = questArcadeRegistry();
  registry.register(blocksRegistration);
  const games = () =>
    registry
      .list()
      .filter((g) => ["maze", "snake", "asteroids", "falling"].includes(g.id));
  const shell = document.createElement("section");
  shell.className = "passage-expedition";
  shell.dataset.theme = "night-sky";
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  shell.setAttribute("aria-label", "Passage Expedition");
  shell.tabIndex = -1;
  const focusBefore = document.activeElement,
    blocked = [...document.body.children]
      .filter((el) => el.tagName !== "SCRIPT")
      .map((el) => [el, el.inert]);
  blocked.forEach(([el]) => (el.inert = true));
  document.body.append(shell);
  let request = 0,
    map = null,
    bundles = [],
    host = null,
    activity = null,
    audioResource = null,
    audioPaused = false,
    current = null,
    skip = false,
    timer = null;
  const scope = new AbortController(),
    audio = createAudioManager({
      owner: "expedition",
      initialVolume: readLabVolume(localStorage),
    }),
    media = matchMedia("(prefers-reduced-motion: reduce)");
  function guard() {
    if (getOwner() !== owner || disposed)
      throw Error("Account changed or expedition closed.");
  }
  function stop() {
    audio.stop();
    audioResource?.revoke();
    audioResource = null;
    audioPaused = false;
  }
  function clear() {
    request++;
    host?.dispose();
    host = null;
    activity?.dispose();
    activity = null;
    stop();
    clearTimeout(timer);
  }
  function close() {
    if (disposed) return;
    clear();
    disposed = true;
    audio.dispose();
    scope.abort();
    celebrations.disconnect();
    stopEncouragement();
    media.removeEventListener("change", motion);
    shell.remove();
    if (activeExpedition?.close === close) activeExpedition = null;
    blocked.forEach(([el, inert]) => {
      if (el.isConnected) el.inert = inert;
    });
    focusBefore?.focus?.();
  }
  const celebrations = new MutationObserver((records) => {
    if (disposed || document.querySelector("dialog[open]")) return;
    for (const record of records)
      for (const node of record.addedNodes) {
        if (
          node.classList?.contains("success-celebration") &&
          node.parentElement !== shell
        )
          shell.append(node);
      }
  });
  celebrations.observe(document.body, { childList: true, subtree: true });
  function motion() {
    shell.dataset.motionOff = String(skip || media.matches);
    if (skip || media.matches)
      shell.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  }
  media.addEventListener("change", motion);
  shell.innerHTML = `<header class="ex-header"><button data-ex-exit aria-label="Close Passage Expedition">← Your space</button><a class="ex-brand" href="#" aria-label="Passage Expedition home">✦ <span>AYAH QUEST <small>PASSAGE EXPEDITION</small></span></a><button data-ex-skip aria-pressed="false">Skip animations</button></header><div class="ex-global" role="status" aria-live="polite"></div><div data-ex-view></div>`;
  const view = shell.querySelector("[data-ex-view]"),
    status = shell.querySelector(".ex-global");
  const note = (text, error = false) => {
    if (disposed) return;
    status.textContent = text;
    status.dataset.error = String(error);
  };
  shell.querySelector("[data-ex-exit]").onclick = close;
  shell.querySelector(".ex-brand").onclick = (e) => {
    e.preventDefault();
    selection();
  };
  shell.querySelector("[data-ex-skip]").onclick = (e) => {
    skip = !skip;
    shell.querySelector(".success-celebration")?.remove();
    e.currentTarget.setAttribute("aria-pressed", String(skip));
    e.currentTarget.textContent = skip ? "Animations off" : "Skip animations";
    motion();
  };
  motion();
  window.addEventListener(
    "ayahprofilechange",
    () => {
      if (getOwner() !== owner) close();
    },
    { signal: scope.signal },
  );
  window.addEventListener("ayah-developer-mode", close, {
    signal: scope.signal,
  });
  window.addEventListener("pagehide", close, { signal: scope.signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        audio.pause();
        audioPaused = true;
        host?.pause();
      }
    },
    { signal: scope.signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        const controls = [
          ...shell.querySelectorAll(
            "button:not(:disabled),select,input,a[href]",
          ),
        ].filter((el) => el.getClientRects().length && !el.closest("[hidden]"));
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    { signal: scope.signal },
  );
  function assistanceFor(keys) {
    const memory = createPassageMemory(storage),
      data = memory.snapshot(),
      active = data.active;
    if (
      active &&
      !active.graded &&
      !active.declared &&
      data.records[active.unitId]?.unit.refs.some((key) => keys.includes(key))
    )
      memory.update("assisted");
  }
  async function listen(bundle) {
    guard();
    assistanceFor([bundle.key]);
    stop();
    const token = request;
    try {
      const resource = await loadAudio(bundle, ctx.client);
      if (disposed || token !== request) {
        resource.revoke();
        return;
      }
      guard();
      audioResource = resource;
      const ok = await audio.play(resource.url);
      if (!ok && token === request)
        note(
          "Recitation could not play. Read the verified text and continue without penalty.",
          true,
        );
    } catch (e) {
      if (!disposed && token === request)
        note(e.message + " You can continue with text.", true);
    }
  }
  async function classic() {
    clear();
    const { openPassageStudio } = await import("../../passage/ui.js");
    if (!disposed)
      openPassageStudio({
        ...ctx,
        initialReference: current?.key || ctx.initialReference || "1:1",
      });
  }
  function exportData() {
    try {
      const raw = store.exportRaw(),
        url = URL.createObjectURL(
          new Blob([raw || "{}"], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "ayah-expedition-recovery.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      note(e.message, true);
    }
  }
  function selection() {
    clear();
    current = null;
    map = null;
    bundles = [];
    let runs = [],
      warning = "";
    try {
      runs = Object.values(store.snapshot().runs)
        .filter((r) => r.routeVersion === 2)
        .reverse();
    } catch (e) {
      warning = e.message;
    }
    const options = expeditionOptions({
        signed: !!ctx.user,
        developer: isDeveloperMode(),
      }),
      juzs = [...new Set(options.map((o) => reference(o.key).juz))].sort(
        (a, b) => a - b,
      );
    view.innerHTML = `<section class="ex-selection"><div class="ex-orbit" aria-hidden="true">✧<span>✦</span>✧</div><p class="ex-kicker">A LITTLE EACH DAY. A CONSTELLATION OVER TIME.</p><h1>Give your memory<br>a sky to grow.</h1><p class="ex-intro">Listen. Forge the words. Connect the passage.<br>Then recite it from memory, at your own pace.</p>${warning ? `<p class="ex-warning">${esc(warning)}</p>` : ""}${runs.length ? `<section class="ex-saved"><h2>Your expeditions</h2>${runs.map((r) => `<button data-ex-resume="${r.id}"><span>✦ ${esc(r.refs.join(" · "))}</span><small>${Object.keys(r.completed).length} / ${r.checkpointIds.length} stars connected · Resume</small></button>`).join("")}</section>` : ""}<form class="ex-chart"><h2>Chart an expedition</h2><div class="ex-select-grid"><label>Juz<select name="juz">${juzs.map((n) => `<option value="${n}">Juz ${n}${n === 30 ? " · Free" : ""}</option>`).join("")}</select></label><label>Surah<select name="surah"></select></label><label>Start at<select name="first"></select></label><label>Selected ayahs<select name="count">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1 === 1 ? "Single ayah" : `${i + 1} ayah chain`}</option>`).join("")}</select></label><label>Arcade trial<select name="game">${games()
      .map((g) => `<option value="${g.id}">${esc(g.title)}</option>`)
      .join(
        "",
      )}</select></label></div><p data-ex-refs></p><p class="ex-fine">Only listed, source-validated references are used. Private references require a fresh server authorization check; a listed pilot does not guarantee access.</p><button class="ex-primary" type="submit">Chart my constellation →</button></form><div class="ex-recovery"><button data-ex-export>Export recovery copy</button><label class="ex-file">Restore an expedition export<input type="file" data-ex-import accept="application/json,.json"></label><button data-ex-classic>Classic Passage Builder</button><div data-ex-restore></div></div><p class="ex-boundary">Puzzles build familiarity. Only your independent self-assessment records recall. Visual study boundaries are never waqf guidance.</p></section>`;
    const form = view.querySelector("form"),
      parts = form.elements;
    function refs() {
      const available = options.filter(
          (o) =>
            reference(o.key).juz === Number(parts.juz.value) &&
            reference(o.key).surah === Number(parts.surah.value),
        ),
        index = available.findIndex((o) => o.key === parts.first.value);
      return available
        .slice(
          Math.max(0, index),
          Math.max(0, index) + Number(parts.count.value),
        )
        .map((o) => o.key);
    }
    function showRefs() {
      const available = options.filter(
        (o) =>
          reference(o.key).juz === Number(parts.juz.value) &&
          reference(o.key).surah === Number(parts.surah.value),
      );
      const remaining =
        available.length -
        Math.max(
          0,
          available.findIndex((o) => o.key === parts.first.value),
        );
      for (const option of parts.count.options)
        option.disabled = Number(option.value) > remaining;
      if (Number(parts.count.value) > remaining)
        parts.count.value = String(Math.max(1, Math.min(10, remaining)));
      view.querySelector("[data-ex-refs]").textContent =
        "Selected supported references: " +
        refs().join(" → ") +
        ". Gaps, if any, remain explicit.";
    }
    function ayahs() {
      const available = options.filter(
        (o) =>
          reference(o.key).juz === Number(parts.juz.value) &&
          reference(o.key).surah === Number(parts.surah.value),
      );
      parts.first.innerHTML = available
        .map((o) => `<option value="${o.key}">${esc(o.label)}</option>`)
        .join("");
      showRefs();
    }
    function chapters() {
      const ids = [
        ...new Set(
          options
            .filter((o) => reference(o.key).juz === Number(parts.juz.value))
            .map((o) => reference(o.key).surah),
        ),
      ];
      parts.surah.innerHTML = ids
        .map(
          (id) =>
            `<option value="${id}">${esc(catalog.chapters.find((c) => c.id === id).name)}</option>`,
        )
        .join("");
      ayahs();
    }
    chapters();
    if (
      ctx.initialReference &&
      options.some((o) => o.key === ctx.initialReference)
    ) {
      const r = reference(ctx.initialReference);
      parts.juz.value = String(r.juz);
      chapters();
      parts.surah.value = String(r.surah);
      ayahs();
      parts.first.value = r.key;
      showRefs();
    }
    parts.juz.onchange = chapters;
    parts.surah.onchange = ayahs;
    parts.first.onchange = showRefs;
    parts.count.onchange = showRefs;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const keys = refs(),
        preferred = parts.game.value;
      clear();
      const token = request;
      note("Checking access and reading the verified sources…");
      const button = form.querySelector("[type=submit]");
      button.disabled = true;
      try {
        const loaded = await Promise.all(
          keys.map((key) => loadBundle(key, ctx.client)),
        );
        if (disposed || token !== request) return;
        guard();
        const chosen =
          games().find((g) => g.id === preferred)?.id || games()[0]?.id || null;
        const route = await createExpeditionMap({
          bundles: loaded,
          game: chosen,
        });
        if (disposed || token !== request) return;
        store.open(route);
        map = route;
        bundles = loaded;
        drawCampaign();
        note("Your route is ready. Start with supported learning.");
      } catch (e) {
        note(
          e.message + " Free Al-Fatihah and Juz Amma remain available.",
          true,
        );
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    };
    view.querySelectorAll("[data-ex-resume]").forEach(
      (b) =>
        (b.onclick = async () => {
          clear();
          const token = request;
          note("Rechecking the sources for your saved expedition…");
          try {
            const restored = await resumeExpedition({
              store,
              runId: b.dataset.exResume,
              client: ctx.client,
            });
            if (disposed || token !== request) return;
            guard();
            if (restored.changed) {
              view.querySelector("[data-ex-restore]").innerHTML =
                "<p>Source or reviewed boundaries changed. Your previous expedition is preserved.</p><button data-ex-updated>Start updated verified route</button>";
              view.querySelector("[data-ex-updated]").onclick = () => {
                store.open(restored.map);
                map = restored.map;
                bundles = restored.bundles;
                drawCampaign();
              };
              return;
            }
            map = restored.map;
            bundles = restored.bundles;
            drawCampaign();
            note("Saved checkpoints and unfinished study drafts restored.");
          } catch (e) {
            note(e.message, true);
          }
        }),
    );
    view.querySelector("[data-ex-export]").onclick = exportData;
    view.querySelector("[data-ex-classic]").onclick = classic;
    view.querySelector("[data-ex-import]").onchange = async (e) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024)
          throw Error("Choose an expedition export smaller than 2 MB.");
        const raw = await file.text(),
          data = JSON.parse(raw);
        if (data.version !== 1 || data.owner !== owner || !data.runs)
          throw Error(
            "This backup does not belong to the current account/version.",
          );
        view.querySelector("[data-ex-restore]").innerHTML =
          `<p>Backup contains ${Object.keys(data.runs).length} routes. Current quest data will be kept in a recovery backup first. Learning/FSRS history is not part of this restore.</p><button data-ex-restore-confirm>Restore checked backup</button>`;
        view.querySelector("[data-ex-restore-confirm]").onclick = () => {
          try {
            store.restoreRaw(raw);
            selection();
            note(
              "Expedition backup restored. Your previous quest document was preserved.",
            );
          } catch (e) {
            note(e.message, true);
          }
        };
      } catch (e) {
        note(e.message, true);
      }
    };
    if (warning) note(warning, true);
    else note("Choose a supported passage, or resume your saved stars.");
  }
  function run() {
    return store.snapshot().runs[map.id];
  }
  function drawMap() {
    const r = run(),
      next = nextCheckpoint(map, r),
      area = view.querySelector("[data-ex-map]");
    const total = map.checkpoints.length,
      completed = Object.keys(r.completed).length;
    area.innerHTML = `<p class="ex-kicker">YOUR CONSTELLATION</p><h2>${map.checkpoints[0].key}${bundles.length > 1 ? " → " + bundles.at(-1).key : ""}</h2><p>${completed} / ${total} stars connected</p><div class="ex-progress" role="progressbar" aria-label="Expedition activities completed" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${(completed / total) * 100}%"></span></div><p class="ex-fine">Gold = completed activity.<br>Recitation remains self-assessed.</p><nav class="ex-map-scroll" aria-label="Constellation checkpoints"><svg class="ex-connection" viewBox="0 0 240 ${total * 76}" preserveAspectRatio="none" aria-hidden="true"><path d="${map.checkpoints.map((_, i) => `${i ? "L" : "M"} ${i % 2 ? 165 : 75} ${i * 76 + 38}`).join(" ")}"/><path class="ex-lit-path" d="${map.checkpoints
      .slice(0, Math.max(1, completed + 1))
      .map((_, i) => `${i ? "L" : "M"} ${i % 2 ? 165 : 75} ${i * 76 + 38}`)
      .join(
        " ",
      )}"/></svg><ol>${map.checkpoints.map((c, i) => `<li class="${i % 2 ? "ex-node-right" : "ex-node-left"}"><button data-ex-node="${c.id}" ${!r.completed[c.id] && c.id !== next?.id ? "disabled" : ""} class="${r.completed[c.id] ? "is-complete" : c.id === next?.id ? "is-current" : ""}" aria-current="${c.id === next?.id ? "step" : "false"}"><span aria-hidden="true">${r.completed[c.id] ? "✦" : c.id === next?.id ? "✧" : "·"}</span><span><b>${stageNames[c.stage]}</b><small>${c.key}${c.workspace ? ` · words ${c.workspace.firstWord}–${c.workspace.lastWord}` : c.stage === "link" ? ` · connect ${c.through + 1}` : ""}</small></span></button></li>`).join("")}</ol></nav>`;
    const navigation = area.querySelector("nav"),
      svg = area.querySelector("svg");
    svg.style.height = `${total * 76}px`;
    const navRect = navigation.getBoundingClientRect();
    const points = [
      ...area.querySelectorAll("[data-ex-node] > span:first-child"),
    ].map((el) => {
      const r = el.getBoundingClientRect();
      return [
        r.left - navRect.left + r.width / 2,
        r.top - navRect.top + navigation.scrollTop + r.height / 2,
      ];
    });
    svg.setAttribute("viewBox", `0 0 ${navigation.clientWidth} ${total * 76}`);
    svg.querySelectorAll("path").forEach((p, index) =>
      p.setAttribute(
        "d",
        points
          .slice(0, index ? Math.min(total, completed + 1) : total)
          .map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`)
          .join(" "),
      ),
    );
    navigation.scrollTop = Math.max(
      0,
      completed * 76 - navigation.clientHeight / 2,
    );
    area.querySelectorAll("[data-ex-node]").forEach(
      (b) =>
        (b.onclick = () => {
          const c = map.checkpoints.find((c) => c.id === b.dataset.exNode);
          if (r.completed[c.id]) preview(c);
          else launch(c);
        }),
    );
    area.querySelector("nav").onkeydown = (e) => {
      if (
        !["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) ||
        !e.target.closest("[data-ex-node]")
      )
        return;
      e.preventDefault();
      const nodes = [...area.querySelectorAll("[data-ex-node]:not(:disabled)")],
        i = nodes.indexOf(document.activeElement);
      nodes[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? nodes.length - 1
            : Math.max(
                0,
                Math.min(nodes.length - 1, i + (e.key === "ArrowUp" ? -1 : 1)),
              )
      ]?.focus();
    };
  }
  function drawCampaign() {
    clear();
    view.innerHTML = `<div class="ex-campaign"><aside data-ex-map></aside><main class="ex-stage"><div class="ex-stage-tools"><button data-ex-routes>← Expeditions</button><button data-ex-pause>Pause activity</button><button data-ex-audio-pause>Pause / resume audio</button><button data-ex-silent>Stop audio</button><label>Volume<input data-ex-volume type="range" min="0" max="1" step=".05" value="${readLabVolume(localStorage)}"></label></div><div data-ex-scope></div><div data-ex-activity></div><footer data-ex-footer></footer><div class="ex-helper"><button data-ex-export>Export recovery copy</button><button data-ex-classic>Open Classic Passage Builder</button></div></main></div>`;
    view.querySelector("[data-ex-routes]").onclick = selection;
    view.querySelector("[data-ex-export]").onclick = exportData;
    view.querySelector("[data-ex-classic]").onclick = classic;
    paused = false;
    view.querySelector("[data-ex-pause]").onclick = (e) => {
      paused = !paused;
      if (paused) {
        host?.pause();
        audio.pause();
      } else {
        host?.resume();
        audio.resume();
      }
      e.currentTarget.textContent = paused
        ? "Resume activity"
        : "Pause activity";
    };
    view.querySelector("[data-ex-audio-pause]").onclick = () => {
      if (host) {
        host.pause();
        paused = true;
        view.querySelector("[data-ex-pause]").textContent = "Resume activity";
        note("Arcade paused. Use Resume activity to continue.");
        return;
      }
      audioPaused = !audioPaused;
      if (audioPaused) audio.pause();
      else audio.resume();
    };
    view.querySelector("[data-ex-silent]").onclick = () => {
      stop();
      host?.pause();
    };
    view.querySelector("[data-ex-volume]").oninput = (e) => {
      const value = Number(e.target.value);
      audio.setVolume(value);
      host?.setVolume(value);
      try {
        localStorage.setItem("ayah-lab-volume", String(value));
      } catch {}
      const game = host?.getSnapshot();
      if (game) note("Volume saved; new recitation uses this level.");
    };
    drawMap();
    const next = nextCheckpoint(map, run());
    if (next) launch(next);
    else reveal();
  }
  function footer(done = false) {
    const area = view.querySelector("[data-ex-footer]");
    if (!area) return;
    const next = nextCheckpoint(map, run());
    area.innerHTML = done
      ? `<p class="ex-saved-note">✦ Checkpoint saved. ${current?.type === "recall" ? "Independent self-assessment recorded." : "Study progress is separate from independent recall."}</p><button class="ex-primary" data-ex-next>${next ? "Continue to " + stageNames[next.stage] + " →" : "Reveal my constellation ✦"}</button>`
      : `<p class="ex-fine">Finish this checkpoint to connect the next star. Hints and breaks are welcome.</p>${current?.stage === "trial" ? "<button data-ex-fallback>Use guided word practice instead</button>" : ""}`;
    area
      .querySelector("[data-ex-next]")
      ?.addEventListener("click", () => (next ? launch(next) : reveal()));
    area
      .querySelector("[data-ex-fallback]")
      ?.addEventListener("click", () => study(current, true));
  }
  function celebrate() {
    shell.classList.remove("ex-gold-flash");
    void shell.offsetWidth;
    shell.classList.add("ex-gold-flash");
    clearTimeout(timer);
    timer = setTimeout(() => shell.classList.remove("ex-gold-flash"), 700);
    if (
      current.type !== "arcade" ||
      run().completed[current.id]?.evidence !== "arcade"
    )
      successCue(
        `expedition:${current.id}`,
        "Another star connected. Keep growing.",
      );
  }
  function completed(result) {
    stop();
    drawMap();
    footer(true);
    celebrate();
    note(
      "Checkpoint saved. Your constellation reflects actual completed activities.",
    );
  }
  function finish(cp, result) {
    guard();
    const previous = run().completed[cp.id];
    if (previous) {
      footer(true);
      return;
    }
    const xp =
      ["forge", "link", "chain"].includes(cp.stage) || result.assistance > 1
        ? rewards.practice(cp)
        : 0;
    const saved = store.complete(map, cp, { ...result, xp });
    completed(saved);
  }
  async function verify(cp, token) {
    const keys = cp.passagePins?.map((p) => p.key) || [cp.key],
      loaded = await Promise.all(
        keys.map((key) => loadBundle(key, ctx.client)),
      );
    if (disposed || token !== request) return null;
    guard();
    for (const b of loaded) {
      const pin = cp.passagePins?.find((p) => p.key === b.key) || cp;
      if (
        (await contentRevision(b)) !== pin.sourceHash ||
        (await segmentationRevision(b)) !== pin.segmentHash
      )
        throw Error(
          "Source or reviewed segmentation changed. Return to expeditions to chart the updated route. Saved progress is preserved.",
        );
    }
    return loaded;
  }
  async function launch(cp) {
    clear();
    paused = false;
    view.querySelector("[data-ex-pause]").textContent = "Pause activity";
    current = cp;
    const scopeLabel = view.querySelector("[data-ex-scope]");
    scopeLabel.textContent = "";
    scopeLabel.className = "";
    const token = request;
    const root = view.querySelector("[data-ex-activity]");
    if (!root) return;
    root.innerHTML = '<p class="ex-loading">✧ Loading verified checkpoint…</p>';
    footer();
    try {
      store.start(map, cp);
      const loaded = await verify(cp, token);
      if (!loaded || disposed || token !== request) return;
      const bundle = loaded.find((b) => b.key === cp.key);
      if (cp.type !== "recall") assistanceFor(loaded.map((b) => b.key));
      note(`${stageNames[cp.stage]} · ${cp.key}`);
      if (cp.stage === "trial") {
        scopeLabel.className = "ex-boundary";
        scopeLabel.textContent = `Source-word trial · ${cp.key} · words ${cp.workspace.firstWord}–${cp.workspace.lastWord} only. This is a visual study excerpt, not an approved recitation stop or an independent memory assessment. Recitation remains the full ayah.`;
      }
      if (cp.stage === "discovery") {
        root.innerHTML = `<section class="ex-discovery"><div class="ex-gate" aria-hidden="true">☾<span>✦</span></div><p class="ex-kicker">DISCOVERY GATE · ${bundle.key}</p><h1>Meet your ayah.</h1><p>Listen to the complete recitation, follow the verified text, and repeat aloud.</p><p class="arabic" dir="rtl" lang="ar">${esc(bundle.textUthmani)}</p><p>${esc(bundle.translation)}</p><div class="ex-actions"><button class="ex-primary" data-ex-play>♫ Listen to full ayah</button><button data-ex-discover>I've listened or read · Begin Word Forge →</button></div><details><summary>Verified sources &amp; study boundaries</summary><p>Pages are manageable visual workspaces, not approved recitation stops. Reading or listening does not certify memorization.</p>${bundle.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Source reference ↗</a>`).join(" · ")}</details></section>`;
        root.querySelector("[data-ex-play]").onclick = () => listen(bundle);
        root.querySelector("[data-ex-discover]").onclick = () => {
          try {
            finish(cp, { evidence: "practice", assistance: 1 });
          } catch (e) {
            note(e.message, true);
          }
        };
      } else if (["forge", "link", "chain"].includes(cp.stage)) {
        study(cp, false, bundle);
      } else {
        const available = games();
        if (cp.stage === "trial" && !available.length) {
          study(cp, true, bundle);
          note(
            "The requested game is not currently registered. Guided practice keeps the route playable.",
          );
          return;
        }
        host = createQuestHost({
          root,
          map,
          store,
          owner,
          getOwner,
          storage,
          learning,
          lab,
          client: ctx.client,
          registry,
          onProgress: completed,
          volume: () => Number(view.querySelector("[data-ex-volume]").value),
        });
        await host.launch(cp.id);
      }
      if (!disposed && token === request) {
        drawMap();
        view
          .querySelector(".ex-stage")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
      }
    } catch (e) {
      if (!disposed && token === request) {
        note(e.message, true);
        root.innerHTML =
          '<p class="ex-warning">This checkpoint could not load or restore. Earlier records remain saved. Export a recovery copy or return to supported free study.</p>';
      }
    }
  }
  function study(
    cp,
    fallback = false,
    bundle = bundles.find((b) => b.key === cp.key),
  ) {
    host?.dispose();
    host = null;
    activity?.dispose();
    stop();
    const root = view.querySelector("[data-ex-activity]");
    const effective = fallback ? { ...cp, stage: "forge" } : cp;
    activity = mountStudy({
      root,
      checkpoint: effective,
      bundle,
      bundles,
      draft: run().drafts?.[cp.id],
      onDraft: (d) => store.saveDraft(map, cp, d),
      onComplete: (r) => finish(cp, r),
      onListen: () => listen(bundle),
    });
    footer();
  }
  function preview(cp) {
    view.querySelector("[data-ex-scope]").textContent = "";
    view.querySelector("[data-ex-scope]").className = "";
    assistanceFor([cp.key]);
    clear();
    current = cp;
    const b = bundles.find((b) => b.key === cp.key);
    view.querySelector("[data-ex-activity]").innerHTML =
      `<section class="ex-discovery"><p class="ex-kicker">CONNECTED STAR</p><h1>${stageNames[cp.stage]}</h1><p>${cp.key} · ${run().completed[cp.id].evidence === "self-assessed" ? "Successful independent self-assessment recorded." : "Completed study activity. This is not proof of spoken memorization."}</p><p class="arabic" dir="rtl" lang="ar">${esc(b.textUthmani)}</p></section>`;
    footer(true);
  }
  function reveal() {
    view.querySelector("[data-ex-scope]").textContent = "";
    view.querySelector("[data-ex-scope]").className = "";
    clear();
    current = null;
    const r = run(),
      independent = Object.values(r.completed).filter(
        (c) => c.evidence === "self-assessed",
      ).length;
    view.querySelector("[data-ex-activity]").innerHTML =
      `<section class="ex-reveal"><div class="ex-reveal-star" aria-hidden="true">✦</div><p class="ex-kicker">CONSTELLATION REVEALED</p><h1>You connected<br>this passage.</h1><p>${Object.keys(r.completed).length} real checkpoints · ${independent} successful independent self-assessments</p>${bundles.map((b) => `<section><h3>${b.key}</h3><p class="arabic" dir="rtl" lang="ar">${esc(b.textUthmani)}</p></section>`).join("")}<p>Your self-assessment records what you recalled today. Lasting retention grows through scheduled revision; the existing FSRS schedule stays in charge.</p><div class="ex-actions"><button class="ex-primary" data-ex-more>Chart another expedition →</button><button data-ex-revision>Return to classic revision</button></div></section>`;
    view.querySelector("[data-ex-more]").onclick = selection;
    view.querySelector("[data-ex-revision]").onclick = classic;
    view.querySelector("[data-ex-footer]").innerHTML = "";
    drawMap();
    note("Expedition complete. Return for your scheduled reviews.");
  }
  selection();
  shell.querySelector("[data-ex-exit]").focus();
  return (activeExpedition = {
    close,
    getSnapshot: () =>
      map ? { mapId: map.id, run: run(), checkpoint: current?.id } : null,
  });
}
