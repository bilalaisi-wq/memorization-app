import { wordWindow } from "../passage/model.js";
import { esc } from "../ui/dom.js";
import { canonicalSlice } from "../../supabase/functions/_shared/segmentation.js";
import { seededShuffle } from "../puzzles/arcade/content.js";
import { createAudioManager } from "../puzzles/arcade/services.js";
// Small, functional fallback, with the same lifecycle contract as an arcade engine.
export function mountQuestPractice({
  root,
  bundle,
  workspace = null,
  id,
  audioUrl = "",
  volume = () => 0.5,
  muted = () => false,
  onComplete = () => {},
}) {
  const first = workspace?.firstWord || 1,
    last = workspace?.lastWord || bundle.words.length;
  if (last - first >= 12) throw Error("A bounded visual workspace is required");
  const words = bundle.words.slice(first - 1, last),
    bank = seededShuffle(
      words.map((w) => w.position),
      parseInt(id.slice(-8), 16),
    );
  const audio = createAudioManager({
    owner: "quest-practice",
    initialVolume: volume(),
  });
  let order = [],
    status = "ready",
    mistakes = 0,
    assistance = 1,
    disposed = false;
  const snapshot = () => ({
    id,
    status,
    order: [...order],
    mistakes,
    assistance,
  });
  function paint(message = "") {
    if (disposed) return;
    const focused = document.activeElement;
    const wordFocus = focused?.dataset.questWord;
    const actionFocus = ["data-quest-check", "data-quest-clear"].find((name) =>
      focused?.hasAttribute(name),
    );
    root.innerHTML = `<section class="quest-practice" aria-label="Quest fallback practice"><h3>Connect the workspace · ${esc(bundle.key)}</h3><p>Visual study workspace, not an approved recitation stop. Listen to the full ayah and repeat aloud.</p><p class="arabic" dir="rtl" lang="ar">${esc(canonicalSlice(bundle, first, last))}</p><div data-quest-built dir="rtl" aria-label="Your arrangement">${order.map((n) => piece(n, "Return word")).join("")}</div><div data-quest-bank dir="rtl" aria-label="Word bank">${bank
      .filter((n) => !order.includes(n))
      .map((n) => piece(n, "Add word"))
      .join(
        "",
      )}</div><button data-quest-check>Check workspace</button><button data-quest-clear>Clear workspace</button><button data-quest-audio>Listen to full ayah</button><button data-quest-stop>Stop audio</button><p data-quest-status role="status">${esc(message)}</p></section>`;
    root
      .querySelectorAll("[data-quest-word]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            dispatch({ type: "word", position: Number(b.dataset.questWord) })),
      );
    root.querySelector("[data-quest-check]").onclick = () =>
      dispatch({ type: "check" });
    root.querySelector("[data-quest-clear]").onclick = () =>
      dispatch({ type: "clear" });
    root.querySelector("[data-quest-audio]").onclick = () => {
      assistance++;
      audio.play(audioUrl, { muted: muted() });
    };
    root.querySelector("[data-quest-stop]").onclick = () => audio.stop();
    if (wordFocus)
      root
        .querySelector(`[data-quest-word="${Number(wordFocus)}"]`)
        ?.focus({ preventScroll: true });
    if (actionFocus)
      root.querySelector(`[${actionFocus}]`)?.focus({ preventScroll: true });
  }
  function piece(n, label) {
    return `<button data-quest-word="${n}" aria-label="${label} ${n}" lang="ar">${esc(words.find((w) => w.position === n).text)}</button>`;
  }
  function dispatch(action) {
    if (disposed || status !== "playing") return snapshot();
    if (action.type === "word" && bank.includes(action.position)) {
      order = order.includes(action.position)
        ? order.filter((n) => n !== action.position)
        : [...order, action.position];
      paint();
    }
    if (action.type === "clear") {
      order = [];
      paint();
    }
    if (action.type === "check") {
      if (
        order.length === words.length &&
        order.every((n, i) => n === words[i].position)
      ) {
        try {
          onComplete({ ...snapshot(), status: "won" });
          status = "won";
          paint(
            "Workspace saved. This is study progress, not independent recall.",
          );
        } catch (e) {
          paint(`Could not save: ${e.message}. Check again to retry.`);
        }
      } else {
        mistakes++;
        paint("Try the sequence again. Say each word aloud.");
      }
    }
    return snapshot();
  }
  paint();
  return {
    start() {
      status = "playing";
      paint();
    },
    pause() {
      if (status === "playing") {
        status = "paused";
        audio.pause();
      }
    },
    resume() {
      if (status === "paused") {
        status = "playing";
        audio.resume();
      }
    },
    dispatch,
    getSnapshot: snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      status = "disposed";
      audio.dispose();
      root.replaceChildren();
    },
  };
}

// If an arcade is unavailable, finish every visual page before completing its checkpoint.
export function mountQuestFallback(options) {
  const ranges = options.workspace
    ? [options.workspace]
    : Array.from({ length: wordWindow(options.bundle, 0).count }, (_, page) => {
        const w = wordWindow(options.bundle, page);
        return { firstWord: w.first, lastWord: w.last };
      });
  let page = 0,
    current = null,
    status = "ready",
    disposed = false,
    mistakes = 0,
    assistance = 0;
  function mount() {
    current = mountQuestPractice({
      ...options,
      workspace: ranges[page],
      onComplete: (result) => {
        if (page + 1 < ranges.length) {
          mistakes += result.mistakes;
          assistance += result.assistance;
          current.dispose();
          page++;
          mount();
          current.start();
        } else {
          options.onComplete({
            ...result,
            mistakes: mistakes + result.mistakes,
            assistance: assistance + result.assistance,
          });
          status = "won";
        }
      },
    });
  }
  mount();
  return {
    start() {
      if (!disposed) {
        status = "playing";
        current.start();
      }
    },
    pause() {
      if (!disposed) {
        status = "paused";
        current.pause();
      }
    },
    resume() {
      if (!disposed) {
        status = "playing";
        current.resume();
      }
    },
    dispatch: (a) => !disposed && current.dispatch(a),
    getSnapshot: () => ({ status, page, ...current.getSnapshot() }),
    dispose() {
      if (disposed) return;
      disposed = true;
      status = "disposed";
      current.dispose();
    },
  };
}
