import { authorizeRegion, revisionChoices } from "./content.js";
import { adventureStore, newAdventure } from "./store.js";
import {
  createAyahDefense,
  TOWERS,
  SITES,
  REGIONS,
  defensePath,
  pointOnPath,
} from "./defense.js";
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
      "Build your defenses. Protect your fortress. Keep your Qur’an revision flowing.",
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
    studio = null,
    started = false,
    selectedTower = "arrow",
    selectedSite = 0,
    audioMode = "continuous",
    listeningBefore = false,
    muted = false,
    message = "",
    pendingSection = false,
    retrySourceControl = null;
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
  settings = { ...record.settings };
  const audio = createAudioManager({
    owner: "revision-adventure",
    initialVolume: readLabVolume(profileStorage),
  });
  function save(fn) {
    if (!alive()) throw Error("Learning account changed");
    store.transact((d) => fn(d.runs[id]));
    record = store.snapshot().runs[id];
  }
  const snapshot = () => {
    const s = engine?.getSnapshot();
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
      restore,
      onEvent: (event) => {
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
      ? "Fortress battlefield. Number keys choose wording. Select a tower then a construction site."
      : "Momentum course. Arrows move, Space jumps, S slides, Shift dashes. Number keys choose a route."
  }"><div class="flow-hud" role=status></div><div class="flow-scene"><svg viewBox="0 0 900 400" aria-label="${
    game === "ayah-defense" ? "Tower-defense battlefield" : "Platform course"
  }"></svg></div><div class="flow-ribbon" aria-label="Quran revision ribbon"></div><div class="flow-actions"></div><div class="flow-pad"></div><p data-flow-message role=status></p><button data-flow-start>Start journey</button><small class="flow-integrity">Pieces are study groups, not recitation stops. Game recognition is separate from independent recitation.</small></div></section>`;
  const field = root.querySelector(".flow-battlefield"),
    svg = root.querySelector("svg"),
    ribbon = root.querySelector(".flow-ribbon"),
    hud = root.querySelector(".flow-hud"),
    actions = root.querySelector(".flow-actions"),
    pad = root.querySelector(".flow-pad");
  mountReadingSetting(root);
  const dispatch = (a) => {
    if (!alive()) return;
    if (a.type === "listen") {
      void recite(true);
      return;
    }
    engine?.dispatch(a);
    if (a.type === "pause") {
      audio.pause();
      cancelAnimationFrame(raf);
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
    settings = { memory: next.memory, motor: next.motor };
    save((r) => {
      r.settings = settings;
      r.unit = 0;
      r.arcade = engine.checkpoint();
    });
    buildEngine(record.arcade);
    await load();
    started = true;
    engine.start();
    wake();
    if (audioMode !== "paused") void recite();
    focusGameplay(field, { force: true });
    paint();
  };
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
    region = null;
    choices = [];
    message = error.message;
    engine?.pause();
    audio.stop();
    paint();
    const retry = document.createElement("button");
    retry.textContent = "Retry source / save";
    retry.onclick = () => {
      void load().then(() => {
        if (!region && record.completed < refs.length) return;
        if (started) {
          engine.resume();
          wake();
        }
        paintAll();
        focusGameplay(field, {force:true});
      });
    };
    retrySourceControl = retry;
    ribbon.replaceChildren(retry);
  }
  function invalidate() {
    dispose();
    root.textContent =
      "Content access or learning account changed. Saved checkpoints remain; reopen to reauthorize.";
  }
  async function recite(force = false) {
    if (!region || (audioMode === "paused" && !force)) return;
    const ticket = ++audioEpoch;
    audio.stop();
    audioLease?.revoke();
    audioLease = null;
    try {
      const lease = await loadAudio(region.bundle, client);
      if (!alive() || ticket !== audioEpoch) {
        lease.revoke();
        return;
      }
      audioLease = lease;
      reportStudyExposure([region.bundle.key]);
      if (audioMode === "before") {
        listeningBefore = true;
        engine.pause();
      }
      const ok = await audio.play(lease.url, {
        loop: audioMode === "continuous",
        muted,
        onEnded: () => {
          if (alive() && started && audioMode === "before") {
            listeningBefore = false;
            engine.resume();
            wake();
          }
        },
      });
      if (ok) save((r) => r.assistance++);
      if (!ok) {
        listeningBefore = false;
        message =
          "Audio unavailable. Replay when ready; your progress remains safe.";
        if (started) {
          engine.resume();
          wake();
        }
      }
      paint();
    } catch (e) {
      if (alive() && ticket === audioEpoch) {
        message = e.message;
        if (started) {
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
      else if (!engine.getSnapshot().final) engine.dispatch({ type: "final" });
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
          previous = await loadBundle(previousKey, client);
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
      reportStudyExposure([...new Set(choices.map((c) => c.key))]);
      if (game === "surah-rush") engine.dispatch({ type: "next" });
      if (started) void recite();
      paintAll();
    } catch (e) {
      if (alive() && ticket === epoch) fail(e);
    }
  }
  async function answer(index) {
    if (
      !alive() ||
      busy ||
      !region ||
      !readyRecall ||
      engine.getSnapshot().status !== "playing"
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
        if (!already) engine.dispatch({ type: "revision", id: acceptedId });
        if (ayahFinished && record.completed % 5 === 0)
          engine.dispatch({
            type: "region",
            index: Math.floor(record.completed / 5),
          });
      } else {
        engine.dispatch({ type: "correct", index });
        pendingSection = true;
        if (record.completed === refs.length)
          engine.dispatch({ type: "final" });
      }
      message = ayahFinished
        ? "Ayah covered in supported revision. Continue your journey."
        : "Verified continuation connected.";
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
        engine.getSnapshot().status === "playing"
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
    const s = engine.getSnapshot();
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
                `<button data-flow-choice="${i}" ${
                  s.status !== "playing" ? "disabled" : ""
                }><small>${
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
    const s = engine.getSnapshot();
    const narrowCourse = game === "surah-rush" && svg.clientWidth < 600;
    svg.setAttribute("viewBox", narrowCourse ? "0 110 480 290" : "0 0 900 400");
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
        ? `${REGIONS[s.region]} · wave ${s.wave} · fortress ${Math.ceil(
            s.core
          )} · shield ${Math.ceil(s.shield)} · coins ${
            s.coins
          } · construction ${s.energy}`
        : `Region ${
            Math.floor(record.completed / 5) + 1
          } · momentum ${Math.round(Math.abs(s.vx))} · flow ${s.flow} · ${
            s.motorErrors
          } motor recoveries`;
    root.querySelector("[data-flow-message]").textContent = message;
    root.querySelector("[data-flow-start]").hidden = started || record.finished;
    if (game === "ayah-defense") {
      const path = defensePath(s.region)
        .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
        .join(" ");
      drawScene(
        `<rect width=900 height=400 fill="${
          ["#14223d", "#182e42", "#292341", "#10333c", "#2a2549"][s.region]
        }"/><path d="${path}" stroke="#557685" stroke-width=38 fill=none/><path d="${path}" stroke="#b6d2d633" stroke-width=2 stroke-dasharray="8 12" fill=none/><g transform="translate(865,175)"><rect width=32 height=65 fill="#dfc16d"/><path d="M-8 0 L16 -24 L40 0" fill="#5bc7ce"/></g>${SITES.map(
          (p, i) =>
            `<g data-flow-site="${i}" role=button tabindex=0 aria-label="Construction site ${
              i + 1
            }" transform="translate(${p.x},${
              p.y
            })"><circle r=25 fill="#1f4056" stroke="${
              selectedSite === i ? "#ffd868" : "#7dbbbb"
            }" stroke-width=3/><text text-anchor=middle y=6 fill=white>${
              i + 1
            }</text></g>`
        ).join("")}${s.towers
          .map(
            (t) =>
              `<g data-flow-tower-entity="${t.kind}" transform="translate(${
                t.x
              },${t.y})"><circle r="${
                selectedSite === t.site ? TOWERS[t.kind].range : 25
              }" fill="none" stroke="#d4c67855" stroke-dasharray="5 8"/><rect x=-16 y=-22 width=32 height=32 rx=6 fill="${
                t.active ? "#e2c26b" : "#567484"
              }" opacity="${t.active ? 1 : 0.6}" transform="translate(0,${
                !minimalMotion && t.active
                  ? 20 *
                    (1 -
                      Math.min(
                        1,
                        Math.max(0, s.time - (t.builtAt ?? -1)) / 0.45
                      ))
                  : 0
              })"/>${towerIcon(
                t.kind
              )}<text text-anchor=middle y=38 fill=white font-size=12>${
                t.active
                  ? "L" + t.level
                  : t.charge + "/" + TOWERS[t.kind].energy
              }</text></g>`
          )
          .join("")}${s.enemies
          .map((e) => {
            const p = pointOnPath(e.d, s.region);
            return `<g transform="translate(${p.x},${p.y})"><${
              e.kind === "armored" ? "rect" : "ellipse"
            } ${
              e.kind === "armored"
                ? "x=-13 y=-13 width=26 height=26"
                : "rx=13 ry=11"
            } fill="${
              e.kind === "frost"
                ? "#85e2ed"
                : e.kind === "siege"
                ? "#b079ae"
                : "#cf8c65"
            }"/><text y=-18 text-anchor=middle fill=white font-size=11>${
              e.kind
            } ${Math.ceil(e.hp)}</text>${
              e.shield ? '<circle r=18 fill=none stroke="#9de5fa"/>' : ""
            }</g>`;
          })
          .join("")}${s.effects
          .filter(
            (e) =>
              experiencePreferences().effects !== "off" ||
              !["build", "construction"].includes(e.kind)
          )
          .map((e) =>
            e.kind === "build"
              ? `<circle cx="${e.x}" cy="${e.y}" r="${
                  minimalMotion ? 29 : 25 + (0.55 - e.life) * 55
                }" fill="none" stroke="#ffe48b" stroke-width="3" opacity="${
                  e.life / 0.55
                }" />`
              : `<path d="M${e.x},${e.y} L${e.tx},${e.ty}" stroke="${
                  e.kind === "frost" ? "#99eaff" : "#ffe48b"
                }" stroke-width="${e.kind === "beam" ? 5 : 2}"/>`
          )
          .join("")}`
      );
      for (const b of actions.querySelectorAll("[data-flow-ability]")) {
        const remaining = s.cooldowns[b.dataset.flowAbility];
        b.disabled = s.status !== "playing" || remaining > 0;
        b.textContent =
          b.dataset.flowAbility +
          (remaining > 0 ? " · " + Math.ceil(remaining) + "s" : " · ready");
      }
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
    if (s.status === "recovery")
      actions.innerHTML =
        "<button data-flow-recover>Repair fortress · motor recovery</button>";
    else if (game === "ayah-defense" && !actions.dataset.initialized) {
      actions.dataset.initialized = "true";
      actions.innerHTML = `<label>Tower class<select data-flow-tower>${Object.entries(
        TOWERS
      )
        .map(
          ([k, v]) =>
            `<option value="${k}">${v.name} · ${v.cost} coins</option>`
        )
        .join(
          ""
        )}</select></label><label>Site<select data-flow-site-select>${SITES.map(
        (_, i) => `<option value=${i}>${i + 1}</option>`
      ).join(
        ""
      )}</select></label><button data-flow-place>Queue blueprint</button><button data-flow-priority>Build selected first</button><button data-flow-upgrade>Upgrade selected tower</button>${[
        "shield",
        "overcharge",
        "frost",
      ]
        .map((n) => `<button data-flow-ability="${n}">${n}</button>`)
        .join("")}`;
    }
    if (game === "ayah-defense") {
      const tower = s.towers.find((t) => t.site === selectedSite);
      const upgrade = actions.querySelector("[data-flow-upgrade]");
      if (upgrade) {
        upgrade.disabled =
          !tower?.active || tower.level >= 3 || s.coins < tower.level * 18;
        upgrade.textContent = !tower?.active
          ? "Activate this tower to upgrade"
          : tower.level >= 3
          ? "Tower fully upgraded"
          : `Upgrade selected tower · ${tower.level * 18} coins`;
      }
    }
    if (game === "surah-rush" && !pad.children.length)
      pad.innerHTML =
        '<button data-flow-move="-1">←</button><button data-flow-control="jump">Jump</button><button data-flow-move="1">→</button><button data-flow-control="dash">Dash</button><button data-flow-slide>Slide</button>';
    frame.update(snapshot());
  }
  function towerIcon(kind) {
    const shapes = {
      arrow: '<path d="M-10 9 L10 -11 M0 -11 H10 V0"/>',
      frost: '<path d="M0 -13 V13 M-11 -7 L11 7 M-11 7 L11 -7"/>',
      beam: '<path d="M-9 11 L9 -11 M-10 0 H10"/><circle r="4"/>',
      pulse: '<circle r="5"/><circle r="11"/>',
      guardian: '<path d="M-10 -10 H10 V1 Q10 9 0 14 Q-10 9 -10 1 Z"/>',
      observatory: '<path d="M-12 0 Q0 -18 12 0 Z M0 0 V12 M-7 12 H7"/>',
    };
    return `<g stroke="#142c42" stroke-width="2" fill="none" aria-label="${TOWERS[kind].name}">${shapes[kind]}</g>`;
  }
  window.addEventListener("resize", () => paint(), { signal: abort.signal });
  function drawScene(markup) {
    // HTML foreign-content parsing treats a slash after an unquoted value as part
    // of that value. Separate self-closing tokens so sibling SVG objects remain siblings.
    svg.innerHTML = markup.replace(/\/>/g, " />");
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
      if (game === "ayah-defense" && !engine.getSnapshot().towers.length) {
        message = "Choose a tower and queue its blueprint before starting.";
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
      } else void answer(Number(b.dataset.flowChoice)).then(paintAll);
    }
    if (e.detail === 0 && b.dataset.flowControl)
      engine.dispatch({ type: b.dataset.flowControl });
    if (e.detail === 0 && b.dataset.flowMove) move(Number(b.dataset.flowMove));
    if (e.detail === 0 && b.hasAttribute("data-flow-slide"))
      engine.dispatch({ type: "slide", active: !engine.getSnapshot().slide });
    if (b.hasAttribute("data-flow-ready")) {
      readyRecall = true;
      paintRibbon();
    }
    if (b.hasAttribute("data-flow-place")) {
      selectedTower = root.querySelector("[data-flow-tower]").value;
      selectedSite = Number(
        root.querySelector("[data-flow-site-select]").value
      );
      engine.dispatch({
        type: "place",
        kind: selectedTower,
        site: selectedSite,
      });
      paint();
    }
    if (b.hasAttribute("data-flow-priority"))
      engine.dispatch({
        type: "priority",
        site: Number(root.querySelector("[data-flow-site-select]").value),
      });
    if (b.hasAttribute("data-flow-upgrade")) {
      engine.dispatch({
        type: "upgrade",
        site: Number(root.querySelector("[data-flow-site-select]").value),
      });
      paint();
    }
    if (b.dataset.flowAbility) {
      engine.dispatch({ type: "ability", name: b.dataset.flowAbility });
      paint();
    }
    if (b.hasAttribute("data-flow-recover")) {
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
        save((r) => {
          const evidence = r.evidence,
            history = [
              ...(r.history || []),
              {
                completed: r.completed,
                assistance: r.assistance,
                finished: r.finished,
                settings: r.settings,
              },
            ].slice(-50);
          Object.assign(r, newAdventure(game, refs, settings), {
            evidence,
            history,
          });
        });
        buildEngine(null);
        started = false;
        void load();
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
        (/Digit[1-3]/.test(key) ||
          ["Space", "ShiftLeft", "ShiftRight"].includes(key))
      )
        return;
      if (/^Digit[1-3]$/.test(key)) {
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
  const background = () => {
    message = "Paused safely. Resume when ready.";
    engine?.pause();
    audio.pause();
    cancelAnimationFrame(raf);
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
    cancelAnimationFrame(raf);
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
      raf = requestAnimationFrame(loop);
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
    if (engine.getSnapshot().status === "playing")
      raf = requestAnimationFrame(loop);
  }
  buildEngine();
  await flushRewards();
  await load();
  paintAll();
  raf = requestAnimationFrame(loop);
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
      engine: engine.getSnapshot(),
    }),
    dispose,
  };
}
