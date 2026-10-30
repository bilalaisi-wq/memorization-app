import { esc } from "../../ui/dom.js";
import { canonicalSlice } from "../../../supabase/functions/_shared/segmentation.js";
import { wordWindow, hiddenWord } from "../../passage/model.js";
import { seededShuffle } from "../../puzzles/arcade/content.js";
import { validDraft } from "./model.js";
// No history/scheduler writes. Only safe draft positions are persisted by the caller.
export function mountStudy({
  root,
  checkpoint: cp,
  bundle,
  bundles,
  draft,
  onDraft,
  onComplete,
  onListen,
}) {
  let state = draft
      ? structuredClone(draft)
      : { round: 0, order: [], mistakes: 0, assistance: 1, revealed: false },
    disposed = false;
  if (!validDraft(state, cp, bundle))
    throw Error(
      "Saved workspace needs recovery. Export the expedition; the original draft has not been overwritten.",
    );
  const forge = cp.stage === "forge",
    chain = cp.stage === "chain";
  const words = forge
    ? bundle.words.slice(cp.workspace.firstWord - 1, cp.workspace.lastWord)
    : [];
  const cards = chain
    ? cp.refs.map((key) => ({
        label: key,
        text: bundles.find((b) => b.key === key).textUthmani,
      }))
    : forge
      ? []
      : Array.from({ length: cp.through + 1 }, (_, page) => {
          const w = wordWindow(bundle, page);
          return {
            label: `${bundle.key} · source words ${w.first}–${w.last}`,
            text: canonicalSlice(bundle, w.first, w.last),
          };
        });
  const ids = forge ? words.map((w) => w.position) : cards.map((_, i) => i),
    bank = seededShuffle(ids, parseInt(cp.id.slice(-8), 16));
  function paint(message = "") {
    if (disposed) return;
    const focused = document.activeElement?.dataset.exPiece;
    const moveFocus = document.activeElement?.dataset.exMove;
    const actionFocus = [
      "data-ex-check",
      "data-ex-reveal",
      "data-ex-clear",
    ].find((k) => document.activeElement?.hasAttribute(k));
    const hidden = forge && !state.revealed;
    const piece = (id) =>
      forge
        ? hidden && hiddenWord(id, state.round)
          ? "✧"
          : esc(words.find((w) => w.position === id).text)
        : state.revealed
          ? esc(cards[id].text)
          : esc(cards[id].text.split(/\s+/).slice(0, 2).join(" ")) + " …";
    const renderPiece = (id, built) =>
      `<button class="ex-piece ${forge ? "" : "ex-fragment"}" draggable="true" data-ex-piece="${id}" aria-label="${built ? "Return" : "Add"} ${esc(forge ? (hidden && hiddenWord(id, state.round) ? `hidden word piece ${bank.indexOf(id) + 1}` : words.find((w) => w.position === id).text) : cards[id].label)}" lang="ar" style="--piece-hue:${forge && /اللَّه|ٱللَّه|لِلَّه/.test(words.find((w) => w.position === id)?.text || "") ? 45 : (160 + id * 47) % 360};--piece-radius:${10 + (id % 3) * 5}px">${piece(id)}${!forge ? `<small class="ex-source-ref" lang="en" dir="ltr">${esc(cards[id].label)}</small>` : ""}</button>`;
    root.innerHTML = `<section class="ex-work"><p class="ex-kicker">${forge ? `FORGE · ROUND ${state.round + 1} OF 3` : chain ? "CONNECT THE AYAH SEQUENCE" : "CONNECT EVERY STUDIED WORKSPACE"}</p><h2>${forge ? "Word Forge" : chain ? "Passage Chain" : "Passage Link"}</h2><p>${forge ? ["Read and say every word as you move it.", "Some words are hidden. Say each word before you place it.", "Recall the hidden words. Reveal freely when you need support."][state.round] : "Arrange these studied excerpts in their original order. Read the connected passage aloud."}</p><p class="ex-boundary">Visual study excerpts are not approved recitation stops. Audio always plays the full ayah.</p>${forge && state.round === 0 ? `<p class="arabic" dir="rtl" lang="ar">${esc(canonicalSlice(bundle, cp.workspace.firstWord, cp.workspace.lastWord))}</p>` : ""}<p>${forge ? `Source ${bundle.key} · words ${cp.workspace.firstWord}–${cp.workspace.lastWord}` : `${cards.length} connected ${chain ? "ayahs" : "workspaces"}`}</p><div class="ex-build" data-ex-built dir="rtl" aria-label="Your construction">${state.order.map((id) => `<span class="ex-selected">${renderPiece(id, true)}<button data-ex-move="${id}:-1" aria-label="Move piece earlier">→</button><button data-ex-move="${id}:1" aria-label="Move piece later">←</button></span>`).join("") || '<span class="ex-empty">Choose pieces below to build the sequence →</span>'}</div><div class="ex-bank" data-ex-bank dir="rtl" aria-label="Shuffled pieces">${bank
      .filter((id) => !state.order.includes(id))
      .map((id) => renderPiece(id, false))
      .join(
        "",
      )}</div><div class="ex-actions"><button class="ex-primary" data-ex-check>Check ${forge ? "words" : "connection"}</button><button data-ex-reveal>Reveal study hints</button><button data-ex-clear>Rebuild this round</button><button data-ex-listen>♫ Full ayah</button></div><p data-ex-feedback role="status">${esc(message)}</p></section>`;
    root.querySelectorAll("[data-ex-piece]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = Number(b.dataset.exPiece);
          const next = structuredClone(state);
          next.order = state.order.includes(id)
            ? state.order.filter((x) => x !== id)
            : [...state.order, id];
          mutate(next);
        }),
    );
    root.querySelectorAll("[data-ex-move]").forEach(
      (b) =>
        (b.onclick = () => {
          const [id, delta] = b.dataset.exMove.split(":").map(Number),
            order = [...state.order],
            i = order.indexOf(id),
            j = i + delta;
          if (j < 0 || j >= order.length) return;
          [order[i], order[j]] = [order[j], order[i]];
          mutate({ ...state, order });
        }),
    );
    const dragged = (e) => {
      const value = e.dataTransfer.getData("text/plain"),
        prefix = cp.id + "|";
      if (!value.startsWith(prefix)) return null;
      const id = Number(value.slice(prefix.length));
      return ids.includes(id) ? id : null;
    };
    root.querySelectorAll("[data-ex-piece]").forEach((b) => {
      b.ondragstart = (e) =>
        e.dataTransfer.setData("text/plain", cp.id + "|" + b.dataset.exPiece);
      b.ondragover = (e) => e.preventDefault();
      b.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = dragged(e);
        if (id === null) return;
        if (b.closest("[data-ex-bank]")) {
          mutate({ ...state, order: state.order.filter((n) => n !== id) });
          return;
        }
        const target = Number(b.dataset.exPiece);
        if (target === id) return;
        const order = state.order.filter((n) => n !== id);
        order.splice(Math.max(0, order.indexOf(target)), 0, id);
        mutate({ ...state, order });
      };
    });
    root.querySelectorAll("[data-ex-built],[data-ex-bank]").forEach((zone) => {
      zone.ondragover = (e) => e.preventDefault();
      zone.ondrop = (e) => {
        e.preventDefault();
        const id = dragged(e);
        if (id === null) return;
        const order = state.order.filter((n) => n !== id);
        if (zone.hasAttribute("data-ex-built")) order.push(id);
        mutate({ ...state, order });
      };
    });
    root.querySelector("[data-ex-check]").onclick = () => {
      const correct =
        state.order.length === ids.length &&
        state.order.every((id, i) => id === ids[i]);
      if (!correct) {
        mutate(
          { ...state, mistakes: state.mistakes + 1 },
          "Try the sequence again. Say the words aloud.",
        );
        return;
      }
      if (forge && state.round < 2) {
        mutate(
          { ...state, round: state.round + 1, order: [], revealed: false },
          "Connected! Now try with fewer hints.",
        );
        return;
      }
      try {
        onComplete({
          evidence: "practice",
          mistakes: state.mistakes,
          assistance: state.assistance,
        });
        root.querySelectorAll("button").forEach((b) => (b.disabled = true));
      } catch (e) {
        root.querySelector("[data-ex-feedback]").textContent =
          `Not saved: ${e.message}. Check again to retry.`;
      }
    };
    root.querySelector("[data-ex-reveal]").onclick = () =>
      mutate(
        { ...state, revealed: true, assistance: state.assistance + 1 },
        "Hints are study support, not independent recall.",
      );
    root.querySelector("[data-ex-clear]").onclick = () =>
      mutate({ ...state, order: [] });
    root.querySelector("[data-ex-listen]").onclick = onListen;
    if (actionFocus)
      root.querySelector(`[${actionFocus}]`)?.focus({ preventScroll: true });
    if (moveFocus && /^\d+:-?1$/.test(moveFocus))
      root
        .querySelector(`[data-ex-move="${moveFocus}"]`)
        ?.focus({ preventScroll: true });
    if (focused)
      root
        .querySelector(`[data-ex-piece="${Number(focused)}"]`)
        ?.focus({ preventScroll: true });
  }
  function mutate(next, message) {
    if (disposed) return;
    try {
      onDraft(structuredClone(next));
      state = next;
      paint(message);
    } catch (e) {
      root.querySelector("[data-ex-feedback]").textContent =
        `Draft not saved: ${e.message}. Your earlier saved draft is preserved.`;
    }
  }
  paint();
  return {
    dispose() {
      disposed = true;
      root.replaceChildren();
    },
    getSnapshot: () => structuredClone(state),
  };
}
