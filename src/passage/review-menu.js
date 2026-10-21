import { isDeveloper } from "../developer/access.js";
const roleRequests = new Map();
export function mountSegmentReview(nav, ctx) {
  if (!ctx.user || !ctx.client) return;
  const append = (role) => {
    if (!nav.isConnected || nav.querySelector("[data-segment-review-menu]")) {
      return;
    }
    const b = document.createElement("button");
    b.className = "text-button";
    b.dataset.segmentReviewMenu = "true";
    b.textContent = "Teacher segment review";
    b.onclick = () =>
      import("./review-ui.js").then((m) => m.openReview(ctx, role));
    nav.append(b);
  };
  if (isDeveloper()) append(null);
  if (!roleRequests.has(ctx.user.id)) {
    roleRequests.set(
      ctx.user.id,
      Promise.resolve(ctx.client.rpc("my_quran_review_role")).then((
        { data, error },
      ) => error ? null : data).catch(() => null),
    );
  }
  roleRequests.get(ctx.user.id).then((role) => {
    if (role) append(role);
  });
}
