import {
  createFalling,
  stepFalling,
  cells,
  landing,
} from "./falling-engine.js";
import { wordChoices } from "./lab-choices.js";
import { shuffled, verseAudio } from "../data.js";
import { wordIdentity } from "../distractors.js";
import { esc } from "../ui/dom.js";
import { studyAudioStart, studyAudioStop } from "../ui/encouragement.js";
export function mountFalling(
  area,
  {
    surah,
    verse,
    level,
    muted,
    onFinish,
    onFailure,
    onExit,
    say,
    onChange,
    onScope,
  },
) {
  let config = {
      mode: "single",
      first: verse.id,
      last: Math.min(verse.id + 1, surah.verses.length),
      rules: "classic",
      speed: "relaxed",
      audio: "silent",
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
  const speeds = { relaxed: 0, slow: 1300, normal: 700, fast: 300 };
  let lastTick = 0;
  area.innerHTML = `<div class="tower-heading"><span class="eyebrow">HYBRID STACK + TOWER</span><h3>Falling Words 2.0</h3><p>Drop the next word in recitation order. Set aside words from other ayahs. Speed is optional; puzzle wins do not verify memorization.</p></div><form class="tower-settings"><label>Journey<select name="mode"><option value="single">Single Ayah</option><option value="chain">Ayah Chain</option><option value="marathon">Marathon · Classic</option></select></label><label>First ayah<input name="first" type="number" min="1" max="${surah.verses.length}" value="${config.first}"></label><label>Last ayah<input name="last" type="number" min="1" max="${surah.verses.length}" value="${config.last}"></label><label>Strikes<select name="rules"><option value="classic">Classic · 3 per chain</option><option value="practice">Practice · 3 per ayah</option></select></label><label>Speed<select name="speed"><option value="relaxed">Relaxed · manual descent</option><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label><label>Recitation<select name="audio"><option value="silent">Silent Stack</option><option value="listen">Listen & Build · loop ayah</option><option value="echo">Echo & Build · listen first</option></select></label><button class="primary small">Start journey</button></form><div class="tower-game"></div>`;
  const root = area.querySelector(".tower-game"),
    form = area.querySelector("form");
  function stopAudio() {
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
  function play(url, { loop = false, deliberate = true, before = false } = {}) {
    usedAudio = true;
    stopAudio();
    const token = audioToken;
    listening = deliberate;
    echo = before;
    studyAudioStart("lab");
    audio = new Audio(url);
    audio.muted = muted();
    audio.onended = () => {
      if (token !== audioToken || disposed) return;
      if (loop) {
        play(url, { loop: true, deliberate: false });
        return;
      }
      audio = null;
      listening = false;
      echo = false;
      studyAudioStop("lab");
      paint();
    };
    const error = () => {
      if (token !== audioToken || disposed) return;
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
      play(verseAudio(selected[floor].id, surah.id), {
        loop: true,
        deliberate: false,
      });
    if (config.audio === "echo")
      play(verseAudio(selected[floor].id, surah.id), { before: true });
  }
  function newFloor(strikes = 0) {
    stopAudio();
    failedSaved = false;
    const v = selected[floor],
      pool = wordChoices(surah, v, level >= 2 ? 16 : 3);
    // At higher difficulty prefer source-backed words with similar length/opening sounds.
    const extra = pool
      .slice(v.words.length)
      .sort((a, b) => {
        const score = (e) =>
          Math.min(
            ...v.words.map(
              (w) =>
                Math.abs(wordIdentity(w).length - wordIdentity(e.text).length) -
                (wordIdentity(w)[0] === wordIdentity(e.text)[0] ? 2 : 0),
            ),
          );
        return score(a) - score(b);
      })
      .slice(0, level + 2);
    const entries = [...pool.slice(0, v.words.length), ...extra];
    state = createFalling({
      words: v.words,
      entries,
      order: shuffled(entries.length),
    });
    state.strikes = strikes;
    lastTick = Date.now();
    paint();
    startAudio();
  }
  function start() {
    clearTimeout(transitionTimer);
    floor = 0;
    floors = [];
    runErrors = [];
    usedAudio = false;
    recordedErrors = 0;
    onScope?.(`${surah.id}:${selected[0].id}`);
    newFloor();
  }
  function send(action) {
    if (disposed || listening || echo || state?.status === "transition") return;
    if (action.type === "pause" && state?.paused) stopAudio();
    const previous = state;
    state = stepFalling(state, action);
    if (state === previous) return;
    if (["move", "rotate", "tick", "soft"].includes(action.type)) {
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
            ? "This word is from another ayah. Discard it instead."
            : "That word belongs in another position. Build in recitation order.",
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
      if (floor + 1 < selected.length) {
        const strikes = config.rules === "classic" ? state.strikes : 0;
        state.status = "transition";
        paint();
        transitionTimer = setTimeout(
          () => {
            if (disposed) return;
            floor++;
            animation = "floor";
            newFloor(strikes);
          },
          matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,
        );
        return;
      }
      paint();
      onFinish(metadata(true));
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
    const hidden =
      level >= 3 || (level === 2 && state.accepted.length % 2 === 0);
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
    root.innerHTML = `<div class="tower-hud"><strong>${esc(surah.name)} · Ayah ${v.id}</strong><span>Floor ${floor + 1} / ${selected.length}</span><span>Arcade ${metadata(false).score} · separate from XP</span><span class="tower-strikes" aria-label="${state.strikes} of 3 strikes">Strikes ${[0, 1, 2].map((i) => `<b class="${i < state.strikes ? "used" : ""}">${i < state.strikes ? "✕" : "○"}</b>`).join("")}</span></div><div class="tower-layout ${animation}"><aside class="tower-floors" aria-label="Completed tower floors">${floors.map((f) => `<div><span>✦ ${f.reference}</span><p lang="ar" dir="rtl">${esc(f.words.join(" "))}</p></div>`).join("") || "<p>Your completed ayahs become tower floors.</p>"}<div class="tower-hold"><strong>Hold · C</strong><p lang="ar" dir="rtl">${state.hold ? esc(hidden ? "؟" : state.hold.text) : "—"}</p></div></aside><div class="falling-stage tower-board" tabindex="0" role="region" aria-label="Falling word board" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Space C D Delete P">${locked}${!over && !won && state.status !== "transition" ? drawCells(landing(state), "ghost") + drawCells(state.current, "active") : ""}<div role="status" aria-live="polite" class="falling-block tower-label arabic shape-${e?.shape}" data-index="${e?.index}" data-lane="${state.current.x}" data-shape="${e?.shape}" lang="ar" dir="rtl" style="left:5%;top:${labelY}%" ${over || won || state.status === "transition" ? "hidden" : ""}>${esc(hidden ? "؟" : e?.text || "")}</div>${busy ? '<div class="tower-overlay">Listening · motion paused</div>' : ""}${state.status === "transition" ? '<div class="tower-overlay">✦ Ayah complete · rising to the next floor</div>' : ""}</div></div><div class="falling-controls tower-controls"><button id="fall-left" aria-label="Move block left">←</button><button id="fall-rotate">Rotate ↻</button><button id="fall-right" aria-label="Move block right">→</button><button id="fall-down">↓ Lower</button><button id="fall-place">Drop · Space</button><button id="fall-hold">Hold · C</button><button id="fall-discard">Discard · D</button><button id="fall-pause">${state.paused || busy ? "Resume" : "Pause"}</button><button id="fall-listen">♫ Hear this word</button><button id="fall-ayah">♫ Listen & review ayah</button><button id="fall-stop-listening">Continue / stop listening</button></div><p class="falling-counter" role="status">${state.accepted.length} / ${v.words.length} words placed · ${state.paused || busy ? "Paused" : "Ready"}</p><div class="tower-construction"><h4>Your constructed ayah · right to left</h4><p class="arabic" lang="ar" dir="rtl">${esc(state.accepted.join(" ")) || "—"}</p><div class="falling-slots" dir="rtl">${v.words.map((w, i) => `<button data-slot="${i}" class="${i < state.accepted.length ? "slot-filled" : ""}" aria-label="Place in position ${i + 1} from the right">${i < state.accepted.length ? esc(w) : i + 1}</button>`).join("")}</div></div><p>←/→ move · ↑/X rotate · ↓ lower · Space drop · C hold · D discard · P pause. Say the word aloud after the reciter. Contact with the stack waits for your decision.</p>${over ? `<dialog class="tower-game-over" aria-label="Game Over"><h3>✕ ✕ ✕ · Game Over</h3><p>${config.rules === "practice" ? "Retry this ayah; your completed floors stay." : "Three strikes used. Listen, review, and try a fresh journey."}</p><button id="fall-retry">Retry</button><button id="fall-review">Listen & Review</button><button id="fall-exit">Exit</button></dialog>` : won ? '<section class="tower-victory" role="status"><h3>✦ Tower complete!</h3><p>Every selected ayah is in order. Try independent recall when you feel ready.</p></section>' : ""}`;
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
    bind("fall-discard", () => send({ type: "discard" }));
    bind("fall-pause", () => {
      if (listening || echo) {
        stopAudio();
        if (state.paused) state = stepFalling(state, { type: "pause" });
        paint();
      } else send({ type: "pause" });
    });
    bind("fall-listen", () => play(e.audio));
    bind("fall-ayah", () => play(verseAudio(v.id, surah.id)));
    bind("fall-stop-listening", () => {
      stopAudio();
      paint();
    });
    bind("fall-review", () => play(verseAudio(v.id, surah.id)));
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
    if (over || won)
      root
        .querySelectorAll(".tower-controls button,[data-slot]")
        .forEach((b) => (b.disabled = true));
    root.querySelector(".falling-stage").onkeydown = key;
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
    if (event.target.closest("input,select,textarea")) return;
    const k = event.key.toLowerCase(),
      actions = {
        arrowleft: { type: "move", delta: -1 },
        arrowright: { type: "move", delta: 1 },
        arrowup: { type: "rotate" },
        x: { type: "rotate" },
        arrowdown: { type: "soft" },
        " ": { type: "drop" },
        c: { type: "hold" },
        d: { type: "discard" },
        delete: { type: "discard" },
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
      rules: data.mode === "marathon" ? "classic" : data.rules,
    };
    selected =
      config.mode === "single"
        ? [surah.verses[first - 1]]
        : surah.verses.slice(first - 1, last);
    start();
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
    startAudio();
  };
  form.elements.speed.onchange = () => {
    config.speed = form.elements.speed.value;
    lastTick = Date.now();
  };
  const timer = setInterval(() => {
    if (
      disposed ||
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
  start();
  return {
    pause() {
      if (state?.status === "playing" && !state.paused) {
        state = stepFalling(state, { type: "pause" });
        paint();
      }
    },
    listen() {
      play(verseAudio(selected[floor].id, surah.id));
    },
    mute() {
      if (audio) audio.muted = muted();
    },
    timed(value) {
      config.speed = value ? "slow" : "relaxed";
      form.elements.speed.value = config.speed;
    },
    dispose() {
      disposed = true;
      clearInterval(timer);
      clearTimeout(transitionTimer);
      stopAudio();
    },
    snapshot: () => structuredClone(state),
  };
}
