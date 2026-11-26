// Test driver uses movement commands and observed geometry; never dispatches a correctness outcome.
export function steerRush(g, route) {
  const s = g.getSnapshot(),
    x = s.x - s.plan.start;
  g.dispatch({ type: "move", direction: 1 });
  if (s.detour) {
    if (s.grounded && s.x > s.plan.detour.gap[0] - 70)
      g.dispatch({ type: "jump" });
    return;
  }
  if (s.resolved) return;
  if (route === 0 && s.wall) g.dispatch({ type: "jump" });
  if (
    route === 0 &&
    s.grounded &&
    x > (s.plan.metrics?.jumpStart ?? 440) &&
    s.x < s.plan.commits[0].x - 20 &&
    s.y + 18 > s.plan.upper + 8
  )
    g.dispatch({ type: "jump" });
  if (
    route === 2 &&
    s.grounded &&
    x > (s.plan.metrics?.dropStart ?? 580) &&
    s.x < s.plan.commits[0].x - 170 &&
    s.y + 18 < s.plan.lower - 20
  )
    g.dispatch({ type: "drop" });
  const firstGap = s.plan.platforms.find((p) => p.route === 1)?.gaps?.[0];
  if (
    route === 1 &&
    s.plan.layouts?.middle === "slide-tunnel" &&
    s.x > s.plan.barriers[0].x - 60
  )
    g.dispatch({ type: "slide", active: true });
  if (
    route === 1 &&
    firstGap &&
    s.grounded &&
    s.plan.platforms
      .find((p) => p.route === 1)
      .gaps.some((g) => s.x > g[0] - 22 && s.x < g[0])
  )
    g.dispatch({ type: "jump" });
  if (
    ["obstacles", "multi-junction"].includes(s.plan.kind) &&
    x > 870 &&
    s.x < s.plan.commits[0].x - 170 &&
    s.grounded
  )
    g.dispatch({ type: "jump" });
}
export function crossRush(
  g,
  route,
  { until = () => false, limit = 7000 } = {}
) {
  for (let n = 0; n < limit; n++) {
    steerRush(g, route);
    g.dispatch({ type: "tick", dt: 1 / 60 });
    if (until(g.getSnapshot())) return;
  }
  throw Error(`Physical route not reached: ${JSON.stringify(g.getSnapshot())}`);
}
