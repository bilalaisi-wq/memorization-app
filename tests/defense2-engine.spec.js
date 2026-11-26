import { test, expect } from "@playwright/test";
import {
  createAyahDefense,
  TOWERS,
  migrateDefenseCheckpoint,
  defensePath,
  pointOnPath,
} from "../src/revision/adventures/defense.js";
import {
  DEFENSE_MAPS,
  placementCheck,
  legalPositions,
  pathLength,
} from "../src/revision/adventures/defense-maps.js";
import { localBundle } from "../src/content/library.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
import {
  validArcade,
  adventureStore,
  newAdventure,
} from "../src/revision/adventures/store.js";
const advance = (g, seconds) => {
  for (let i = 0; i < seconds * 5; i++) g.dispatch({ type: "tick", dt: 0.2 });
};
function fund(g, count = 50) {
  let n = 0;
  for (let a = 1; a <= 40; a++)
    for (const u of revisionUnits(localBundle(`78:${a}`))) {
      g.dispatch({ type: "revision", id: u.id, points: 20 });
      if (++n >= count) return;
    }
}
test("zero currencies, protected opening, atomic paid free placement, unique construction receipts and real upgrade coins", () => {
  const g = createAyahDefense();
  expect(g.getSnapshot()).toMatchObject({
    energy: 0,
    coins: 0,
    towers: [],
    firstBuiltAt: null,
  });
  const p = legalPositions(0)[0];
  g.dispatch({ type: "place", kind: "arrow", position: p });
  expect(g.getSnapshot().towers).toHaveLength(0);
  g.start();
  advance(g, 600);
  expect(g.getSnapshot()).toMatchObject({
    core: 100,
    coins: 0,
    status: "playing",
  });
  const ids = ["1:1:1-4", "1:2:1-4", "1:3:1-2"];
  for (const id of ids) g.dispatch({ type: "revision", id, points: 20 });
  expect(g.getSnapshot().energy).toBe(60);
  g.dispatch({ type: "revision", id: ids[0], points: 20 });
  expect(g.getSnapshot().energy).toBe(60);
  g.dispatch({ type: "place", kind: "arrow", position: { x: 200, y: 90 } });
  expect(g.getSnapshot().energy).toBe(60);
  g.dispatch({ type: "place", kind: "arrow", position: p });
  expect(g.getSnapshot()).toMatchObject({ energy: 10, coins: 0 });
  expect(g.getSnapshot().towers).toHaveLength(1);
  g.dispatch({ type: "place", kind: "arrow", position: p });
  expect(g.getSnapshot().energy).toBe(10);
  advance(g, 240);
  expect(g.getSnapshot().kills).toBeGreaterThan(0);
  expect(g.getSnapshot().coins).toBeGreaterThan(0);
  const coins = g.getSnapshot().coins;
  g.dispatch({ type: "upgrade", id: 1 });
  expect(g.getSnapshot().towers[0].level).toBe(coins >= 18 ? 2 : 1);
  expect(validArcade("ayah-defense", g.checkpoint())).toBe(true);
});
test("every map has actual finite exit paths, open terrain and full-foundation exclusions", () => {
  for (let m = 0; m < 4; m++) {
    const map = DEFENSE_MAPS[m],
      land = legalPositions(m);
    expect(land.length).toBeGreaterThan(50);
    for (const path of map.paths) {
      expect(pathLength(path)).toBeGreaterThan(1000);
      expect(
        pointOnPath(pathLength(path) + 1, m, map.paths.indexOf(path))
      ).toEqual(path.at(-1));
      for (const p of path) expect(placementCheck(m, p).valid).toBe(false);
    }
    for (const p of land) {
      expect(placementCheck(m, p).valid).toBe(true);
      expect(placementCheck(m, p, [{ ...p, id: 1 }]).valid).toBe(false);
    }
    for (const o of map.blocked)
      expect(placementCheck(m, { x: o.x, y: o.y }).valid).toBe(false);
    expect(placementCheck(m, { x: 12, y: 250 }).valid).toBe(false);
  }
});
test("six real tower roles, gradual waves, map transfers and stable restart economy", () => {
  const events = [],
    g = createAyahDefense({ onEvent: (e) => events.push(e) });
  g.start();
  fund(g, 100);
  for (const kind of Object.keys(TOWERS)) {
    const p = legalPositions(0, g.getSnapshot().towers)[0];
    g.dispatch({ type: "place", kind, position: p });
  }
  expect(g.getSnapshot().towers).toHaveLength(6);
  for (const t of g.getSnapshot().towers)
    g.dispatch({ type: "targeting", id: t.id, value: "strongest" });
  g.dispatch({ type: "ability", name: "shield" });
  expect(g.getSnapshot().shield).toBe(60);
  advance(g, 180);
  expect(g.getSnapshot().kills).toBeGreaterThan(0);
  expect(events.some((e) => e.type === "tower-built")).toBe(true);
  const before = g.checkpoint(),
    ref = before.accepted[0],
    restored = createAyahDefense({ restore: before });
  restored.start();
  restored.dispatch({ type: "revision", id: ref, points: 20 });
  expect(restored.getSnapshot().energy).toBe(before.energy);
  restored.dispatch({ type: "map", value: 3 });
  const after = restored.getSnapshot(),
    refund = before.towers
      .filter((t) => !after.towers.some((k) => k.id === t.id))
      .reduce((n, t) => n + t.paidCost, 0);
  expect(after.energy).toBe(before.energy + refund);
  expect(
    after.towers.every((t) => placementCheck(3, t, after.towers, t.id).valid)
  ).toBe(true);
});
test("tiny passage earns one bounded first-defense completion bonus and legacy snapshots remain recoverable", () => {
  const g = createAyahDefense();
  g.start();
  g.dispatch({
    type: "revision",
    id: "112:1:1-4",
    points: 20,
    lastSource: true,
  });
  expect(g.getSnapshot().energy).toBe(50);
  g.dispatch({
    type: "revision",
    id: "112:1:1-4",
    points: 20,
    lastSource: true,
  });
  expect(g.getSnapshot().energy).toBe(50);
  const old = {
    time: 0,
    coins: 64,
    energy: 4,
    core: 100,
    shield: 25,
    score: 20,
    towers: [
      {
        kind: "arrow",
        site: 0,
        x: 150,
        y: 115,
        level: 1,
        charge: 2,
        active: false,
      },
    ],
    queue: [0],
    accepted: ["1:1:1-4"],
    region: 0,
    cooldowns: { shield: 0, frost: 0, overcharge: 0 },
  };
  expect(validArcade("ayah-defense", old)).toBe(true);
  const changed = migrateDefenseCheckpoint(old);
  expect(old.towers).toHaveLength(1);
  expect(changed.version).toBe(2);
  expect(changed.coins).toBe(64);
  expect(changed.energy).toBe(14);
  expect(validArcade("ayah-defense", changed)).toBe(true);
});
test("support-only openings and malformed point grants cannot create an economic deadlock", () => {
  const g = createAyahDefense();
  g.start();
  g.dispatch({ type: "revision", id: "1:1:1-4", points: NaN });
  expect(g.getSnapshot().energy).toBe(0);
  fund(g, 25);
  const before = g.getSnapshot().energy;
  g.dispatch({
    type: "place",
    kind: "guardian",
    position: legalPositions(0)[0],
  });
  expect(g.getSnapshot().towers).toHaveLength(0);
  expect(g.getSnapshot().energy).toBe(before);
  g.dispatch({ type: "place", kind: "arrow", position: legalPositions(0)[0] });
  g.dispatch({
    type: "place",
    kind: "guardian",
    position: legalPositions(0, g.getSnapshot().towers)[0],
  });
  expect(g.getSnapshot().towers.map((t) => t.kind)).toEqual([
    "arrow",
    "guardian",
  ]);
});
test("bounded render frames preserve full idempotency receipts in checkpoints", () => {
  const g = createAyahDefense();
  g.start();
  g.dispatch({ type: "revision", id: "1:1:1-4", points: 20 });
  expect(g.getFrame().accepted).toEqual([]);
  expect(g.getFrame().earnedByRef).toEqual({});
  expect(g.getSnapshot().accepted).toEqual(["1:1:1-4"]);
  expect(g.checkpoint().accepted).toEqual(["1:1:1-4"]);
  g.dispatch({ type: "revision", id: "1:1:1-4", points: 20 });
  expect(g.getSnapshot().energy).toBe(20);
});
