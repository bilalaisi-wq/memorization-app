// Test driver uses movement commands and observed geometry; never dispatches a correctness outcome.
export function steerRush(g, route) {
  const s = g.getSnapshot(),
    x = s.x - s.plan.start;
  g.dispatch({ type: "move", direction: 1 });
  if (s.detour) {
    if (s.grounded && x > 1230) g.dispatch({ type: "jump" });
    return;
  }
  if (
    route === 0 &&
    s.grounded &&
    x > 440 &&
    x < 1080 &&
    s.y + 18 > s.plan.upper + 8
  )
    g.dispatch({ type: "jump" });
  if (
    route === 2 &&
    s.grounded &&
    x > 580 &&
    x < 930 &&
    s.y + 18 < s.plan.lower - 20
  )
    g.dispatch({ type: "drop" });
  if (
    ["obstacles", "multi-junction"].includes(s.plan.kind) &&
    x > 870 &&
    x < 930 &&
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
