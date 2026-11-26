// Original illustrated-world geometry. Rendering and placement share these coordinates.
export const WORLD = {
  width: 900,
  height: 500,
  trackWidth: 30,
  footprint: 22,
  clearance: 7,
};
const points = (a) => a.map(([x, y]) => ({ x, y }));
export const DEFENSE_MAPS = [
  {
    id: "garden",
    name: "Garden Trail",
    description: "Wide garden bends · gentle introduction",
    paths: [
      points([
        [-20, 90],
        [260, 90],
        [340, 165],
        [130, 230],
        [210, 365],
        [580, 365],
        [710, 245],
        [920, 245],
      ]),
    ],
    blocked: [
      { x: 480, y: 170, r: 47, kind: "pond" },
      { x: 75, y: 355, r: 28, kind: "tree" },
      { x: 775, y: 90, r: 26, kind: "tree" },
    ],
    colors: ["#123c43", "#286954", "#95be81", "#dabf89"],
    water: [],
  },
  {
    id: "grove",
    name: "Spiral Grove",
    description: "A moonlit spiral · cover several turns",
    paths: [
      points([
        [-20, 75],
        [765, 75],
        [790, 420],
        [130, 420],
        [130, 175],
        [610, 175],
        [610, 310],
        [350, 310],
        [350, 245],
        [920, 245],
      ]),
    ],
    blocked: [
      { x: 70, y: 250, r: 30, kind: "tree" },
      { x: 680, y: 350, r: 30, kind: "crystal" },
      { x: 480, y: 355, r: 26, kind: "tree" },
    ],
    colors: ["#192e46", "#285951", "#70ad9b", "#bcc0b0"],
    water: [],
  },
  {
    id: "rivers",
    name: "Twin Rivers",
    description: "Two approaches · protect both crossings",
    paths: [
      points([
        [-20, 90],
        [210, 90],
        [310, 190],
        [480, 190],
        [590, 310],
        [750, 310],
        [830, 245],
        [920, 245],
      ]),
      points([
        [-20, 420],
        [230, 420],
        [330, 300],
        [460, 300],
        [570, 130],
        [740, 130],
        [830, 245],
        [920, 245],
      ]),
    ],
    blocked: [
      { x: 350, y: 0, w: 35, h: 500, kind: "water" },
      { x: 650, y: 0, w: 35, h: 500, kind: "water" },
      { x: 100, y: 260, r: 28, kind: "tree" },
      { x: 520, y: 420, r: 30, kind: "rock" },
    ],
    colors: ["#163e4a", "#397463", "#8fcdb3", "#dbcc9b"],
    water: [350, 650],
  },
  {
    id: "crossroads",
    name: "Celestial Crossroads",
    description: "Three winding approaches · combine your towers",
    paths: [
      points([
        [-20, 90],
        [180, 90],
        [260, 210],
        [455, 210],
        [560, 90],
        [740, 90],
        [830, 245],
        [920, 245],
      ]),
      points([
        [-20, 410],
        [220, 410],
        [320, 295],
        [490, 295],
        [600, 390],
        [760, 390],
        [830, 245],
        [920, 245],
      ]),
      points([
        [445, -20],
        [445, 35],
        [610, 35],
        [610, 120],
        [445, 105],
        [330, 160],
        [360, 245],
        [640, 245],
        [730, 185],
        [830, 245],
        [920, 245],
      ]),
    ],
    blocked: [
      { x: 90, y: 250, r: 35, kind: "crystal" },
      { x: 555, y: 175, r: 24, kind: "crystal" },
      { x: 440, y: 405, r: 30, kind: "rock" },
    ],
    colors: ["#242d50", "#3e5665", "#a2bdd0", "#dfc786"],
    water: [],
  },
];
export const mapFor = (id) =>
  DEFENSE_MAPS[
    typeof id === "number" ? id : DEFENSE_MAPS.findIndex((m) => m.id === id)
  ] || DEFENSE_MAPS[0];
export function pathLength(path) {
  return path
    .slice(1)
    .reduce((n, b, i) => n + Math.hypot(b.x - path[i].x, b.y - path[i].y), 0);
}
export function pathPoint(distance, path) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance <= length)
      return {
        x: a.x + ((b.x - a.x) * Math.max(0, distance)) / length,
        y: a.y + ((b.y - a.y) * Math.max(0, distance)) / length,
      };
    distance -= length;
  }
  return path.at(-1);
}
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)
      )
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function placementCheck(mapId, position, towers = [], ignoreId = null) {
  const { x, y } = position || {},
    r = WORLD.footprint,
    map = mapFor(mapId);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x - r < 15 ||
    y - r < 15 ||
    x + r > 885 ||
    y + r > 485
  )
    return {
      valid: false,
      reason: "Keep the whole foundation inside the garden.",
    };
  if (
    Math.hypot(x - 850, y - 245) < r + 55 ||
    map.paths.some((p) => Math.hypot(x - p[0].x, y - p[0].y) < r + 40)
  )
    return { valid: false, reason: "Leave the entry and fortress clear." };
  if (
    map.paths.some((p) =>
      p
        .slice(1)
        .some(
          (b, i) =>
            segmentDistance({ x, y }, p[i], b) <
            r + WORLD.trackWidth / 2 + WORLD.clearance
        )
    )
  )
    return { valid: false, reason: "Move the whole foundation off the path." };
  if (
    towers.some(
      (t) => t.id !== ignoreId && Math.hypot(x - t.x, y - t.y) < r * 2 + 8
    )
  )
    return { valid: false, reason: "Leave room between towers." };
  for (const o of map.blocked) {
    if (
      o.r
        ? Math.hypot(x - o.x, y - o.y) < r + o.r
        : Math.hypot(
            x - Math.max(o.x, Math.min(x, o.x + o.w)),
            y - Math.max(o.y, Math.min(y, o.y + o.h))
          ) < r
    )
      return {
        valid: false,
        reason: "Trees, rocks and water cannot hold a tower.",
      };
  }
  return { valid: true, reason: "Valid land · confirm to build" };
}
export function legalPositions(mapId, towers = []) {
  const result = [];
  for (let y = 45; y < 470; y += 28)
    for (let x = 45; x < 860; x += 28)
      if (placementCheck(mapId, { x, y }, towers).valid) result.push({ x, y });
  return result;
}
export function pointerOnMap(svg, clientX, clientY) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const p = svg.createSVGPoint();
  p.x = clientX;
  p.y = clientY;
  const q = p.matrixTransform(matrix.inverse());
  return { x: Math.round(q.x), y: Math.round(q.y) };
}
