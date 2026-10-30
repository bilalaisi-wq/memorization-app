export function createActivityScope(
  root,
  { getOwner, owner, onIdentityChange = () => {} },
) {
  const controller = new AbortController(),
    media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  const guard = () => {
    if (getOwner() !== owner) throw Error("Account changed; reopen the quest");
  };
  const check = () => {
    if (getOwner() !== owner) onIdentityChange();
  };
  window.addEventListener("ayahprofilechange", check, {
    signal: controller.signal,
  });
  return {
    guard,
    reducedMotion: !!media?.matches,
    listen(target, type, fn) {
      target.addEventListener(type, fn, { signal: controller.signal });
    },
    announce(message) {
      let node = root.querySelector("[data-quest-status]");
      if (!node) {
        node = document.createElement("p");
        node.dataset.questStatus = "";
        node.setAttribute("role", "status");
        node.setAttribute("aria-live", "polite");
        root.append(node);
      }
      node.textContent = message;
    },
    dispose() {
      controller.abort();
    },
  };
}
