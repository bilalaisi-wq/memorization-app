import {resolvePlaybackSource} from "../content/private-audio.js";
import {createAudioLevel} from "./audio-level.js";
import {
  createFalling,
  stepFalling,
  cells,
  landing,
} from "./falling-engine.js";
import { wordChoices } from "./lab-choices.js";
import { shuffled, verseAudio } from "../data.js";
import { esc } from "../ui/dom.js";
import { studyAudioStart, studyAudioStop } from "../ui/encouragement.js";
export function mountFalling(
  area,
  { surah, verse, muted, volume=()=>1, onFinish, onFailure, onExit, say, onChange, onScope, questOptions = null },
) {
  let config = {
      mode: "single",
      first: verse.id,
      last: Math.min(verse.id + 1, surah.verses.length),
      rules: "classic",
      speed: "slow",
      audio: "listen",
    },
    selected = [verse],
    floor = 0,
    floors = [],
    state = null,
    disposed = false,
    audio = null,
    audioToken = 0,
    listening = false,
    echo = false,
    failedSaved = false,
    transitionTimer = null,
    runErrors = [],
    animation = "",
    usedAudio = false,
    recordedErrors = 0;
  const speeds = { slow: 1300, normal: 700, fast: 300 };
  let started = false,
    awaitingChoice = false,
    saved = false;
  let lastTick = 0;
  area.innerHTML = `<div class="tower-heading"><span class="eyebrow">HYBRID STACK + TOWER</span><h3>Ayah Blocks</h3><p>Build the ayah in the emerald middle lane. Park extra words in either side lane. Press Start to begin falling blocks and looping recitation.</p></div><form class="tower-settings"><label>Journey<select name="mode"><option value="single">Single Ayah</option><option value="chain">Ayah Chain</option><option value="marathon">Marathon · Classic</option></select></label><label>First ayah<input name="first" type="number" min="1" max="${surah.verses.length}" value="${config.first}"></label><label>Last ayah<input name="last" type="number" min="1" max="${surah.verses.length}" value="${config.last}"></label><label>Strikes<select name="rules"><option value="classic">Classic · 3 per chain</option><option value="practice">Practice · 3 per ayah</option></select></label><label>Speed<select name="speed"><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label><label>Recitation<select name="audio"><option value="listen">Listen & Build · loop ayah</option><option value="silent">Silent Stack</option><option value="echo">Echo & Build · listen first</option></select></label><button class="primary small">Start</button></form><div class="tower-game"></div>`;
  const root = area.querySelector(".tower-game"),
    form = area.querySelector("form");
  const audioLevel=createAudioLevel({initialVolume:volume()});
  function stopAudio() {
    audioLevel.detach();
    audioToken++;
    listening = false;
    echo = false;
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    studyAudioStop("lab");
  }
  async function play(url, { loop = false, deliberate = true, before = false } = {}) {
    usedAudio = true;
    stopAudio();
    const token = audioToken;
    listening = deliberate;
    echo = before;
    studyAudioStart("lab");
    let source;try{source=await resolvePlaybackSource(url);}catch{if(token===audioToken&&!disposed){listening=false;echo=false;studyAudioStop('lab');say('Verified audio unavailable. Continue without a strike.');paint();}return;}
    if(token!==audioToken||disposed)return;
    audio = new Audio(source);
    audioLevel.attach(audio);
    audio.muted = muted();
    audio.onended = () => {
      if (token !== audioToken || disposed) return;
      if (loop) {
        play(url, { loop: true, deliberate: false });
        return;
      }
      audioLevel.detach();
      audio = null;
      listening = false;
      echo = false;
      studyAudioStop("lab");
      paint();
    };
    const error = () => {
      if (token !== audioToken || disposed) return;
      audioLevel.detach();
      audio = null;
      listening = false;
      echo = false;
      studyAudioStop("lab");
      say(
        "Audio is unavailable. You can listen again or continue without audio.",
      );
      paint();
    };
    audio.onerror = error;
    Promise.resolve(audio.play()).catch(error);
    paint();
  }
  function startAudio() {
    if (config.audio === "listen")
      play(questOptions?.audioSource ?? verseAudio(selected[floor].id, surah.id), {
        loop: true,
        deliberate: false,
      });
    if (config.audio === "echo")
      play(questOptions?.audioSource ?? verseAudio(selected[floor].id, surah.id), { before: true });
  }
  function newFloor(strikes = 0) {
    stopAudio();
    failedSaved = false;
    const v = selected[floor];
    const entries = questOptions?.entries || wordChoices(surah, v, 3);
    state = createFalling({
      words: v.words,
      entries,
      order: questOptions?.order || shuffled(entries.length),
    });
    state.strikes = strikes;
    lastTick = Date.now();
    paint();
    if (started) startAudio();
  }
  function start() {
    clearTimeout(transitionTimer);
    started = true;
    awaitingChoice = false;
    saved = false;
    floor = 0;
    floors = [];
    runErrors = [];
    usedAudio = false;
    recordedErrors = 0;
    onScope?.(`${surah.id}:${selected[0].id}`);
    newFloor();
    root.querySelector(".falling-stage")?.focus({ preventScroll: true });
  }
  function send(action) {
    if (
      disposed ||
      !started ||
      awaitingChoice ||
      listening ||
      echo ||
      state?.status === "transition"
    )
      return;
    const previous = state;
    state = stepFalling(state, action);
    if (state === previous) return;
    if (
      ["move", "rotate", "tick", "soft"].includes(action.type) &&
      !state.event
    ) {
      paintMotion();
      return;
    }
    if (state.event === "mistake") {
      const e = state.errors.at(-1);
      runErrors.push({
        ...e,
        reference: `${surah.id}:${selected[floor].id}`,
        floor,
      });
      animation = "mistake";
      say(
        e.kind === "required-rejected"
          ? "This word belongs to the ayah. It will return."
          : e.kind === "distractor-placed"
            ? "That word does not belong in the middle sequence. Park it in a side lane."
            : "That word belongs in another position. Build in recitation order.",
      );
    } else if (state.event === "parked") {
      say(
        "Parked safely to the side. Required words return so you can build the sequence.",
      );
    } else if (state.event === "correct") {
      animation = "correct";
      say("That word fits!");
    }
    if (state.status === "lost") {
      stopAudio();
      if (!failedSaved) {
        failedSaved = true;
        if (onFailure?.(metadata(false)) !== false)
          recordedErrors = runErrors.length;
      }
      paint();
      return;
    }
    if (state.status === "won") {
      stopAudio();
      floors.push({
        reference: `${surah.id}:${selected[floor].id}`,
        words: [...state.accepted],
      });
      awaitingChoice = true;
      if (floor + 1 === selected.length && !saved) {
        saved = true;
        onFinish(metadata(true));
      }
      paint();
      return;
    }
    paint();
    onChange?.();
  }
  function metadata(success) {
    return {
      schemaVersion: 2,
      success,
      usedAudio,
      newErrors: runErrors.length - recordedErrors,
      mode: config.mode,
      rules: config.rules,
      speed: config.speed,
      audio: config.audio,
      references: selected.map((v) => `${surah.id}:${v.id}`),
      floors: floors.map((f) => f.reference),
      wordVisibility: "always",
      score: floor * 1000 + (state?.score || 0),
      errors: [...runErrors],
    };
  }
  function labelPosition() {
    const rows = cells(state.current).map(([, y]) => y);
    const lowest = Math.max(...rows),
      highest = Math.min(...rows);
    return Math.max(
      1,
      Math.min(
        86,
        lowest < 15
          ? ((lowest + 1) * 100) / 18 + 1
          : ((highest - 2.5) * 100) / 18,
      ),
    );
  }
  function paintMotion() {
    // Keep the same four cells mounted so CSS can animate movement/rotation.
    // This also preserves keyboard focus during automatic descent.
    for (const [kind, piece] of [
      ["active", state.current],
      ["ghost", landing(state)],
    ]) {
      const nodes = root.querySelectorAll(`.tetromino-cell.${kind}`);
      cells(piece).forEach(([x, y], i) => {
        nodes[i]?.style.setProperty("--x", String(x));
        nodes[i]?.style.setProperty("--y", String(y));
      });
    }
    const label = root.querySelector(".falling-block");
    if (label) {
      label.dataset.lane = String(state.current.x);
      label.style.top = `${labelPosition()}%`;
    }
  }
  function paint() {
    if (disposed || !state) return;
    const keepFocus =
      root.querySelector(".falling-stage") === document.activeElement;
    const e = state.current?.entry,
      v = selected[floor],
      over = state.status === "lost",
      won = state.status === "won",
      busy = listening || echo;
    const labelY = labelPosition();
    const drawCells = (p, kind) =>
      cells(p)
        .map(
          ([x, y]) =>
            `<span class="tetromino-cell ${kind} shape-${p.shape}" style="--x:${x};--y:${y}"></span>`,
        )
        .join("");
    const locked = state.board
      .flatMap((row, y) =>
        row.map((shape, x) =>
          shape
            ? `<span class="tetromino-cell locked shape-${shape}" style="--x:${x};--y:${y}"></span>`
            : "",
        ),
      )
      .join("");
    const settled = state.placements
      .filter((p) => p.epoch === state.boardEpoch)
      .map((p) => {
        const points = cells(p.piece),
          xs = points.map(([x]) => x),
          ys = points.map(([, y]) => y);
        return `<span class="tower-settled-word" lang="ar" dir="rtl" style="left:${Math.min(40, Math.max(1, Math.min(...xs) * 10))}%;top:${Math.min(92, (Math.min(...ys) * 100) / 18)}%">${esc(p.entry.text)}</span>`;
      })
      .join("");
    const parkedWords = state.placements
      .filter((p) => p.kind === "side")
      .map((p) => `<span lang="ar" dir="rtl">${esc(p.entry.text)}</span>`)
      .join("");
    root.innerHTML = `<div class="tower-hud"><strong>${esc(surah.name)} · Ayah ${v.id}</strong><span>Floor ${floor + 1} / ${selected.length}</span><span>Arcade ${metadata(false).score} · separate from XP</span><span class="tower-strikes" aria-label="${state.strikes} of 3 strikes">Strikes ${[0, 1, 2].map((i) => `<b class="${i < state.strikes ? "used" : ""}">${i < state.strikes ? "✕" : "○"}</b>`).join("")}</span></div><div class="tower-layout ${animation}"><aside class="tower-floors" aria-label="Completed tower floors">${floors.map((f) => `<div><span>✦ ${f.reference}</span><p lang="ar" dir="rtl">${esc(f.words.join(" "))}</p></div>`).join("") || "<p>Your completed ayahs become tower floors.</p>"}<div class="tower-parking-words"><strong>Side parking · words kept visible</strong>${parkedWords || "<p>No words parked yet.</p>"}</div><div class="tower-hold"><strong>Hold · C</strong><p lang="ar" dir="rtl">${state.hold ? esc(state.hold.text) : "—"}</p></div></aside><div class="falling-stage tower-board" tabindex="0" role="region" aria-label="Falling word board" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown B N X Space C P">${locked}${settled}${!over && !won && state.status !== "transition" ? drawCells(landing(state), "ghost") + drawCells(state.current, "active") : ""}<div role="status" aria-live="polite" class="falling-block tower-label arabic shape-${e?.shape}" data-index="${e?.index}" data-lane="${state.current.x}" data-shape="${e?.shape}" lang="ar" dir="rtl" style="left:5%;top:${labelY}%" ${over || won || state.status === "transition" ? "hidden" : ""}>${esc(e?.text || "")}</div>${!started ? '<div class="tower-overlay">Press Start above to begin</div>' : busy ? '<div class="tower-overlay">Listening · motion paused</div>' : ""}${state.status === "transition" ? '<div class="tower-overlay">✦ Ayah complete · rising to the next floor</div>' : ""}</div></div><div class="falling-controls tower-controls"><div class="blocks-touch-pad" role="group" aria-label="Ayah Blocks movement controls"><button id="fall-left" aria-label="Move block left"><span aria-hidden="true">←</span><small>Left</small></button><button id="fall-rotate" aria-label="Rotate block · B or N" aria-keyshortcuts="B N ArrowUp X"><span aria-hidden="true">↻</span><small>Rotate · B/N</small></button><button id="fall-right" aria-label="Move block right"><span aria-hidden="true">→</span><small>Right</small></button><button id="fall-down" aria-label="Lower block"><span aria-hidden="true">↓</span><small>Lower</small></button><button id="fall-place" aria-label="Drop block · Space"><span aria-hidden="true">⇩</span><small>Drop · Space</small></button></div><div class="blocks-support-controls"><button id="fall-hold">Hold · C</button><button id="fall-pause">${state.paused || busy ? "Resume" : "Pause"}</button><button id="fall-listen">${questOptions ? "♫ Hear full ayah" : "♫ Hear this word"}</button><button id="fall-ayah">♫ Listen & review ayah</button><button id="fall-stop-listening">Continue / stop listening</button></div></div><p class="falling-counter" role="status">${state.accepted.length} / ${v.words.length} words placed · ${state.paused || busy ? "Paused" : "Ready"}</p><div class="tower-construction"><h4>${questOptions ? "Your source workspace · right to left" : "Your constructed ayah · right to left"}</h4><p class="arabic" lang="ar" dir="rtl">${esc(state.accepted.join(" ")) || "—"}</p><div class="falling-slots" dir="rtl">${v.words.map((w,i)=>({w,i})).filter(({i})=>!surah.developerOnly||v.words.length<=24||i>=Math.floor(state.accepted.length/12)*12&&i<Math.floor(state.accepted.length/12)*12+12).map(({w,i}) => `<button data-slot="${i}" class="${i < state.accepted.length ? "slot-filled" : ""}" aria-label="Place in position ${i + 1} from the right">${i < state.accepted.length ? esc(w) : i + 1}</button>`).join("")}</div></div><p>←/→ move · B/N or ↑/X rotate · ↓ lower · Space drop · C hold · P pause. Say the word aloud after the reciter. The emerald middle builds your ayah; side lanes are safe parking. Blocks lock automatically on landing.</p>${over ? `<dialog class="tower-game-over" aria-label="Game Over"><h3>✕ ✕ ✕ · Game Over</h3><p>${config.rules === "practice" ? "Retry this ayah; your completed floors stay." : "Three strikes used. Listen, review, and try a fresh journey."}</p><button id="fall-retry">Retry</button><button id="fall-review">Listen & Review</button><button id="fall-exit">Exit</button></dialog>` : won && floor + 1 === selected.length ? `<section class="tower-victory" role="status"><h3>✦ Tower complete!</h3><p>${questOptions ? 'This source-word study workspace is connected. It is not an approved recitation stop or independent recall.' : 'Every selected ayah is in order. Try independent recall when you feel ready.'}</p></section>` : ""}`;
    animation = "";
    const bind = (id, fn) => {
      const b = root.querySelector("#" + id);
      if (b) b.onclick = fn;
    };
    bind("fall-left", () => send({ type: "move", delta: -1 }));
    bind("fall-right", () => send({ type: "move", delta: 1 }));
    bind("fall-rotate", () => send({ type: "rotate" }));
    bind("fall-down", () => send({ type: "soft" }));
    bind("fall-place", () => send({ type: "drop" }));
    bind("fall-hold", () => send({ type: "hold" }));
    bind("fall-pause", () => {
      if (listening || echo) {
        stopAudio();
        if (state.paused) state = stepFalling(state, { type: "pause" });
        paint();
      } else send({ type: "pause" });
    });
    bind("fall-listen", () => play(questOptions?.audioSource ?? e.audio));
    bind("fall-ayah", () => play(questOptions?.audioSource ?? verseAudio(v.id, surah.id)));
    bind("fall-stop-listening", () => {
      stopAudio();
      paint();
    });
    bind("fall-review", () => play(questOptions?.audioSource ?? verseAudio(v.id, surah.id)));
    bind("fall-exit", () => {
      stopAudio();
      onExit();
    });
    bind("fall-retry", () => {
      if (config.rules === "practice") {
        animation = "floor";
        newFloor();
      } else start();
    });
    root
      .querySelectorAll("[data-slot]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            send({ type: "drop", slot: Number(b.dataset.slot) })),
      );
    if (awaitingChoice) {
      const panel = document.createElement("section");
      panel.className = "tower-next-step";
      panel.setAttribute("aria-label", "After this ayah");
      panel.innerHTML = `<h3>Ayah complete. What next?</h3><p>All words stay visible. Repeat at the next descent speed, or continue. You can lower the speed whenever you need more time.</p><button data-repeat>Keep practicing this ayah · ${config.speed === "fast" ? "Fast speed" : "faster descent"}</button>${selected[floor].id < surah.verses.length ? "<button data-next>Move to ayah " + (selected[floor].id + 1) + "</button>" : "<p>You reached the final ayah of this surah.</p>"}`;
      root.append(panel);
      panel.querySelector("[data-repeat]").onclick = () => {
        const order = ["slow", "normal", "fast"];
        config.speed = order[Math.min(2, order.indexOf(config.speed) + 1)];
        form.elements.speed.value = config.speed;
        awaitingChoice = false;
        if (saved) {
          onScope?.(`${surah.id}:${selected[floor].id}`);
          saved = false;
          runErrors = [];
          recordedErrors = 0;
          usedAudio = false;
        }
        floors.pop();
        newFloor(config.rules === "classic" ? state.strikes : 0);
        root.querySelector(".falling-stage")?.focus({ preventScroll: true });
      };
      panel.querySelector("[data-next]")?.addEventListener("click", () => {
        awaitingChoice = false;
        if (floor + 1 === selected.length) {
          selected.push(surah.verses[selected[floor].id]);
          onScope?.(`${surah.id}:${selected[floor + 1].id}`);
          saved = false;
        }
        const strikes = config.rules === "classic" ? state.strikes : 0;
        floor++;
        animation = "floor";
        newFloor(strikes);
        root.querySelector(".falling-stage")?.focus({ preventScroll: true });
      });
    }
    if (over || won || !started)
      root
        .querySelectorAll(".tower-controls button,[data-slot]")
        .forEach((b) => (b.disabled = true));

    if (keepFocus)
      root.querySelector(".falling-stage").focus({ preventScroll: true });
    if (over) {
      const dialog = root.querySelector(".tower-game-over");
      dialog.showModal();
      dialog.oncancel = (event) => {
        event.preventDefault();
        stopAudio();
        onExit();
      };
      root.querySelector("#fall-retry")?.focus({ preventScroll: true });
    }
  }
  function key(event) {
    if (
      !area.isConnected ||
      !started ||
      event.target.closest(
        "input,select,textarea,[contenteditable=true],dialog,a",
      ) ||
      (event.target.closest("button") &&
        (!area.contains(event.target) ||
          event.target.closest(".tower-next-step,form")))
    )
      return;
    const k = event.key.toLowerCase(),
      actions = {
        arrowleft: { type: "move", delta: -1 },
        arrowright: { type: "move", delta: 1 },
        arrowup: { type: "rotate" },
        x: { type: "rotate" },
        b: { type: "rotate" },
        n: { type: "rotate" },
        arrowdown: { type: "soft" },
        " ": { type: "drop" },
        c: { type: "hold" },
        p: { type: "pause" },
      };
    if (!actions[k]) return;
    event.preventDefault();
    if (k === "p" && (listening || echo)) {
      root.querySelector("#fall-pause")?.click();
      return;
    }
    send(actions[k]);
    root.querySelector(".falling-stage")?.focus();
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const first = Number(data.first),
      last = data.mode === "single" ? first : Number(data.last);
    if (
      !Number.isInteger(first) ||
      !Number.isInteger(last) ||
      first < 1 ||
      last < first ||
      last > surah.verses.length
    ) {
      say("Choose a consecutive ayah range within this surah.");
      return;
    }
    config = {
      ...data,
      first,
      last,
      rules: data.mode === "chain" ? data.rules : "classic",
    };
    selected =
      config.mode === "single"
        ? [surah.verses[first - 1]]
        : surah.verses.slice(first - 1, last);
    start();
    if(globalThis.matchMedia?.("(max-width: 600px)").matches)root.querySelector(".falling-stage")?.scrollIntoView({block:"start"});
  };
  const syncRangeUI = () => {
    form.elements.last.closest("label").hidden =
      form.elements.mode.value === "single";
    form.elements.rules.closest("label").hidden =
      form.elements.mode.value !== "chain";
  };
  syncRangeUI();
  form.elements.mode.onchange = () => {
    if (form.elements.mode.value === "marathon") {
      form.elements.first.value = "1";
      form.elements.last.value = String(surah.verses.length);
      form.elements.rules.value = "classic";
    }
    syncRangeUI();
  };
  form.elements.audio.onchange = () => {
    config.audio = form.elements.audio.value;
    stopAudio();
    if (started) startAudio();
    paint();
  };
  form.elements.speed.onchange = () => {
    config.speed = form.elements.speed.value;
    lastTick = Date.now();
  };
  const timer = setInterval(() => {
    if (
      disposed ||
      !started ||
      awaitingChoice ||
      !state ||
      state.status !== "playing" ||
      state.paused ||
      listening ||
      echo
    )
      return;
    const delay = speeds[config.speed];
    if (delay && Date.now() - lastTick >= delay) {
      lastTick = Date.now();
      send({ type: "tick" });
    }
  }, 100);
  if(questOptions){config={...config,first:verse.id,last:verse.id,rules:'practice',audio:'silent'};form.hidden=true;}
  newFloor();
  document.addEventListener("keydown", key);
  return {
    start(){if(!started)start();},
    resume(){if(state?.paused){state=stepFalling(state,{type:'pause'});paint();}},
    dispatch:send,
    getSnapshot:()=>structuredClone(state),
    pause() {
      if (state?.status === "playing" && !state.paused) {
        state = stepFalling(state, { type: "pause" });
        paint();
      }
    },
    listen() {
      play(questOptions?.audioSource ?? verseAudio(selected[floor].id, surah.id));
    },
    mute() {
      if (audio) audio.muted = muted();
    },
    setVolume(value) {audioLevel.setVolume(value);},
    dispose() {
      disposed = true;
      audioLevel.dispose();
      document.removeEventListener("keydown", key);
      clearInterval(timer);
      clearTimeout(transitionTimer);
      stopAudio();
    },
    snapshot: () => structuredClone(state),
  };
}
