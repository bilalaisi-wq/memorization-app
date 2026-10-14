let cancelDrag = () => {};
export function stopPieceDrag() {
  cancelDrag();
  cancelDrag = () => {};
}
export function movePiece(selection, id, anchor = null, after = false) {
  if (anchor === id) return [...selection];
  const next = selection.filter((value) => value !== id);
  const index = anchor === null ? next.length : next.indexOf(anchor);
  next.splice(index < 0 ? next.length : index + Number(after), 0, id);
  return next;
}
export function bindPieceDrag(root, { selection, count, locked, change }) {
  const valid = (id) => Number.isInteger(id) && id >= 0 && id < count;
  const destination = (target, x, y) => {
    let piece =
      target.closest("[data-word]") ||
      target.closest(".piece-wrap")?.querySelector("[data-word]");
    if (!piece && target.closest("[data-drop]")?.dataset.drop === "build") {
      const candidates = [
        ...root.querySelectorAll('[data-zone="selected"][data-word]'),
      ];
      if (
        candidates.length &&
        Number.isFinite(y) &&
        y <=
          Math.max(...candidates.map((p) => p.getBoundingClientRect().bottom))
      ) {
        piece = candidates.sort((a, b) => {
          const distance = (p) => {
            const r = p.getBoundingClientRect();
            return Math.hypot(
              Math.max(r.left - x, 0, x - r.right),
              Math.max(r.top - y, 0, y - r.bottom),
            );
          };
          return distance(a) - distance(b);
        })[0];
      }
    }
    if (!piece || piece.dataset.zone !== "selected")
      return { anchor: null, after: false };
    return {
      anchor: Number(piece.dataset.word),
      after:
        x <
        piece.getBoundingClientRect().left +
          piece.getBoundingClientRect().width / 2 -
          1,
    };
  };
  const update = (id, zone, target, x, y) => {
    if (locked() || !valid(id)) return;
    if (zone === "bank")
      change(
        selection().filter((value) => value !== id),
        id,
      );
    else {
      const { anchor, after } = destination(target, x, y);
      change(movePiece(selection(), id, anchor, after), id);
    }
  };
  root.querySelectorAll("[data-word]").forEach((piece) => {
    piece.ondragstart = (event) => {
      if (locked()) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", piece.dataset.word);
      event.dataTransfer.effectAllowed = "move";
      piece.classList.add("dragging-piece");
    };
    piece.ondragend = () => {
      piece.classList.remove("dragging-piece");
      root
        .querySelectorAll(".drop-before,.drop-after")
        .forEach((el) => el.classList.remove("drop-before", "drop-after"));
    };
    if (piece.dataset.zone !== "selected") return;
    piece.setAttribute("aria-keyshortcuts", "Alt+ArrowRight Alt+ArrowLeft");
    const wrap = piece.closest(".piece-wrap");
    const controls = document.createElement("div");
    controls.className = "piece-arrange-controls";
    controls.innerHTML = `<button class="piece-grab" data-grab="${piece.dataset.word}" aria-label="Drag to move this piece">⠿</button><button data-earlier aria-label="Move this piece earlier">→</button><button data-later aria-label="Move this piece later">←</button>`;
    wrap.append(controls);
    const shift = (delta) => {
      if (locked()) return;
      const id = Number(piece.dataset.word),
        list = selection(),
        from = list.indexOf(id),
        to = Math.max(0, Math.min(list.length - 1, from + delta));
      const next = [...list];
      next.splice(from, 1);
      next.splice(to, 0, id);
      change(next, id);
    };
    controls.querySelector("[data-earlier]").onclick = () => shift(-1);
    controls.querySelector("[data-later]").onclick = () => shift(1);
    controls.querySelector("[data-earlier]").disabled =
      locked() || selection().indexOf(Number(piece.dataset.word)) === 0;
    controls.querySelector("[data-later]").disabled =
      locked() ||
      selection().indexOf(Number(piece.dataset.word)) ===
        selection().length - 1;
    piece.addEventListener("keydown", (event) => {
      if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        shift(event.key === "ArrowRight" ? -1 : 1);
      }
    });
    const handle = controls.querySelector("[data-grab]");
    handle.disabled = locked();
    let active = false,
      ghost = null;
    const clear = () => {
      active = false;
      ghost?.remove();
      ghost = null;
    };
    handle.onpointerdown = (event) => {
      if (locked()) return;
      stopPieceDrag();
      cancelDrag = clear;
      event.preventDefault();
      active = true;
      handle.setPointerCapture(event.pointerId);
      ghost = piece.cloneNode(true);
      ghost.className += " piece-drag-ghost";
      ghost.removeAttribute("data-word");
      ghost.style.width = piece.getBoundingClientRect().width + "px";
      document.body.append(ghost);
      ghost.style.left = event.clientX + "px";
      ghost.style.top = event.clientY + "px";
    };
    handle.onpointermove = (event) => {
      if (active) {
        event.preventDefault();
        ghost.style.left = event.clientX + "px";
        ghost.style.top = event.clientY + "px";
      }
    };
    handle.onpointercancel = clear;
    handle.onpointerup = (event) => {
      if (!active) return;
      const target = document.elementFromPoint(event.clientX, event.clientY),
        zone = target?.closest("[data-drop]");
      clear();
      if (zone)
        update(
          Number(piece.dataset.word),
          zone.dataset.drop,
          target,
          event.clientX,
          event.clientY,
        );
    };
  });
  root.querySelectorAll("[data-drop]").forEach((zone) => {
    zone.ondragover = (event) => {
      if (locked()) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      root
        .querySelectorAll(".drop-before,.drop-after")
        .forEach((el) => el.classList.remove("drop-before", "drop-after"));
      const { anchor, after } = destination(
        event.target,
        event.clientX,
        event.clientY,
      );
      if (anchor !== null)
        root
          .querySelector(`[data-zone="selected"][data-word="${anchor}"]`)
          ?.classList.add(after ? "drop-after" : "drop-before");
    };
    zone.ondrop = (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("text/plain");
      if (raw === "") return;
      const target = event.target,
        x = event.clientX,
        y = event.clientY;
      // Let the browser finish its native drag before replacing the source DOM.
      setTimeout(() => {
        if (zone.isConnected)
          update(Number(raw), zone.dataset.drop, target, x, y);
      }, 0);
    };
  });
}
