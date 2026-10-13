export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function clearLearningView(main) {
  for (const selector of [
    ".reference-card",
    ".mode-row",
    ".memory-summary",
    ".surah-heading",
  ])
    main.querySelector(selector)?.remove();
  let node = main.querySelector(".builder");
  while (node) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
}
export function announce(root, text) {
  root.querySelector("[data-status]").textContent = text;
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
