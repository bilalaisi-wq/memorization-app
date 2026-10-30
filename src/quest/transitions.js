// Own every animation; changing activity or reducing motion cancels it immediately.
export function createTransitions(root) {
  const media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  let animation = null;
  const cancel = () => {
    animation?.cancel();
    animation = null;
  };
  media?.addEventListener("change", cancel);
  return {
    cancel,
    enter() {
      cancel();
      if (!media?.matches && root.animate)
        animation = root.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 160,
        });
    },
    dispose() {
      cancel();
      media?.removeEventListener("change", cancel);
    },
  };
}
