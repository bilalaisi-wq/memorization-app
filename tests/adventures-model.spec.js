import { crossRush } from "./rush3-helper.js";
import { legalPositions } from "../src/revision/adventures/defense-maps.js";
import { test, expect } from "@playwright/test";
import {
  createAyahDefense,
  TOWERS,
  SITES,
  pointOnPath,
} from "../src/revision/adventures/defense.js";
import { createSurahRush, terrain } from "../src/revision/adventures/rush.js";
import {
  revisionUnits,
  revisionChoices,
} from "../src/revision/adventures/content.js";
import { localBundle } from "../src/content/library.js";
import {
  adventureStore,
  newAdventure,
} from "../src/revision/adventures/store.js";
import { createSession } from "../src/puzzles/arcade/session.js";
import { readFileSync } from "node:fs";
test("adaptive source plans preserve original positions, repeated words and balanced distinct authentic choices", () => {
  for (const bundle of [
    localBundle("1:1"),
    localBundle("98:5"),
    JSON.parse(readFileSync(new URL("./fixtures/2-282.json", import.meta.url))),
  ])
    for (const memory of ["guided", "standard", "expert"]) {
      const units = revisionUnits(bundle, memory);
      expect(
        units.filter((u) => !u.review).flatMap((u) => u.positions)
      ).toEqual(bundle.words.map((w) => w.position));
      expect(
        units.every((u) => u.positions.length <= 10 || u.kind === "ayah")
      ).toBe(true);
      for (let n = 0; n < 9; n++) {
        const c = revisionChoices(units[0], { turn: n, memory, seed: 4 });
        expect(new Set(c.map((v) => v.text)).size).toBe(c.length);
        expect(c.filter((v) => v.id === units[0].id)).toHaveLength(1);
        expect(c.findIndex((v) => v.id === units[0].id)).toBeGreaterThanOrEqual(
          0
        );
      }
    }
});
test("six distinct earned towers retain damage, support, upgrades and lifecycle", () => {
  const g = createAyahDefense();
  g.start();
  for (let a = 1; a <= 40; a++)
    for (const u of revisionUnits(localBundle(`78:${a}`)))
      g.dispatch({ type: "revision", id: u.id, points: 20 });
  for (const kind of Object.keys(TOWERS))
    g.dispatch({
      type: "place",
      kind,
      position: legalPositions(0, g.getSnapshot().towers)[0],
    });
  expect(g.getSnapshot().towers).toHaveLength(6);
  const energy = g.getSnapshot().energy;
  g.dispatch({
    type: "revision",
    id: revisionUnits(localBundle("78:1"))[0].id,
    points: 20,
  });
  expect(g.getSnapshot().energy).toBe(energy);
  g.dispatch({ type: "ability", name: "shield" });
  const shield = g.getSnapshot().shield;
  g.dispatch({ type: "ability", name: "shield" });
  expect(g.getSnapshot().shield).toBe(shield);
  for (let i = 0; i < 2400; i++) g.dispatch({ type: "tick", dt: 0.1 });
  expect(g.getSnapshot().kills).toBeGreaterThan(0);
  g.dispatch({ type: "upgrade", id: g.getSnapshot().towers[0].id });
  expect(g.getSnapshot().towers[0].level).toBeGreaterThan(1);
  g.pause();
  const time = g.getSnapshot().time;
  g.dispatch({ type: "tick", dt: 0.2 });
  expect(g.getSnapshot().time).toBe(time);
  g.dispose();
  expect(g.getSnapshot().status).toBe("disposed");
});
test("surah rush retains acceleration, jumping, dash, physical route commitment and recoverable traversal", () => {
  const events = [],
    g = createSurahRush({ seed: 1, onEvent: (e) => events.push(e) });
  g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
  g.start();
  g.dispatch({ type: "move", direction: 1 });
  for (let i = 0; i < 12; i++) g.dispatch({ type: "tick", dt: 0.05 });
  expect(g.getSnapshot().vx).toBeGreaterThan(0);
  g.dispatch({ type: "jump" });
  g.dispatch({ type: "tick", dt: 0.03 });
  expect(g.getSnapshot().vy).toBeLessThan(0);
  g.dispatch({ type: "dash" });
  expect(g.getSnapshot().dash).toBeGreaterThan(0);
  g.dispatch({ type: "slide", active: true });
  expect(g.getSnapshot().slide).toBe(true);
  g.dispatch({ type: "slide", active: false });
  crossRush(g, 1, { until: (s) => s.committed });
  expect(
    events.some((e) => e.type === "route-committed" && e.choice === 1)
  ).toBe(true);
  g.dispatch({ type: "wrong" });
  expect(g.getSnapshot().detour).toBe(true);
  crossRush(g, 2, { until: (s) => !s.detour });
  crossRush(g, 2, { until: (s) => s.committed });
  g.dispatch({ type: "correct", index: 2 });
  g.dispatch({ type: "final" });
  crossRush(g, 2, { until: (s) => s.status === "won" });
  expect(g.getSnapshot().flow).toBe(1);
  expect(Number.isFinite(terrain(380))).toBe(true);
});

test("additive adventure storage keeps malformed bytes and old arcade restart keeps earlier checkpoints", () => {
  const map = new Map(),
    db = {
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, v),
    };
  const store = adventureStore(db);
  store.transact(
    (d) =>
      (d.runs["a".repeat(64)] = newAdventure("ayah-defense", ["1:1", "1:2"], {
        memory: "guided",
        motor: "relaxed",
      }))
  );
  expect(adventureStore(db).warning).toBe("");
  const saved = map.get("ayah-flow-adventures-v1");
  expect(() =>
    store.transact((d) => {
      d.runs["a".repeat(64)].settings.motor = "invalid";
    })
  ).toThrow(/preserved/);
  expect(map.get("ayah-flow-adventures-v1")).toBe(saved);
  expect(() =>
    newAdventure("unknown", ["1:1"], { memory: "guided", motor: "relaxed" })
  ).toThrow(/Unsupported/);
  const session = createSession({
    id: "restart",
    game: "snake",
    config: {
      keys: ["1:1", "1:2", "1:3"],
      chainMode: "practice",
      resumeCheckpoint: 2,
    },
  });
  expect(session.completed).toEqual(["1:1", "1:2"]);
  expect(session.checkpoint).toBe(2);
  map.set("ayah-flow-adventures-v1", "invalid");
  expect(adventureStore(db).warning).toMatch(/recovery/);
  expect(map.get("ayah-flow-adventures-v1")).toBe("invalid");
});
test("all 206 locally prepared Al-Araf sources retain full coverage; Baqarah 286 is metadata-only when source is missing", async () => {
  const { existsSync } = await import("node:fs");
  test.skip(
    !existsSync(".quran-private/7/1/bundle.json"),
    "Private operator fixtures are not published in the repository"
  );
  const { validateBundle } = await import("../src/content/library.js");
  let complete = 0;
  const defense = createAyahDefense();
  for (let i = 0; i < 6; i++)
    defense.dispatch({ type: "place", kind: Object.keys(TOWERS)[i], site: i });
  defense.start();
  for (let ayah = 1; ayah <= 206; ayah++) {
    const key = `7:${ayah}`,
      b = JSON.parse(readFileSync(`.quran-private/7/${ayah}/bundle.json`));
    validateBundle(b, key);
    const units = revisionUnits(b, "expert");
    expect(units.filter((u) => !u.review).flatMap((u) => u.positions)).toEqual(
      b.words.map((w) => w.position)
    );
    for (const unit of units) {
      const answers = revisionChoices(unit, {
        turn: ayah,
        seed: 16,
        memory: "expert",
      });
      expect(answers.filter((c) => c.id === unit.id)).toHaveLength(1);
      defense.dispatch({ type: "revision", id: unit.id });
      defense.dispatch({ type: "tick", dt: 0.03 });
    }
    complete++;
    if (ayah % 5 === 0)
      defense.dispatch({ type: "region", index: Math.floor(ayah / 5) });
    if (ayah < 206) expect(defense.getSnapshot().status).not.toBe("won");
  }
  expect(complete).toBe(206);
  expect(defense.getSnapshot().accepted.length).toBeGreaterThan(206);
  const refs = Array.from({ length: 286 }, (_, i) => `2:${i + 1}`);
  const record = newAdventure("surah-rush", refs, {
    memory: "guided",
    motor: "relaxed",
  });
  expect(record.refs.at(-1)).toBe("2:286");
  expect(record.completed).toBe(0);
});
test("balanced candidate blocks, independent motor profiles and recoverable malformed battle saves", async () => {
  const { validArcade } = await import("../src/revision/adventures/store.js");
  const unit = revisionUnits(localBundle("1:1"))[0];
  for (const count of [2, 3]) {
    const slots = Array.from({ length: count * 4 }, (_, turn) =>
      revisionChoices(unit, {
        turn,
        seed: 19,
        memory: count === 2 ? "guided" : "expert",
      }).findIndex((c) => c.id === unit.id)
    );
    for (let i = 0; i < slots.length; i += count)
      expect(slots.slice(i, i + count).sort()).toEqual(
        Array.from({ length: count }, (_, n) => n)
      );
  }
  expect(validArcade("ayah-defense", { towers: [{ kind: "<script>" }] })).toBe(
    false
  );
  const relaxed = createAyahDefense({ motor: "relaxed" }),
    fast = createAyahDefense({ motor: "arcade" });
  for (const g of [relaxed, fast]) {
    g.start();
    for (let i = 0; i < 30; i++) g.dispatch({ type: "tick", dt: 0.02 });
  }
  expect(fast.getSnapshot().enemies[0].d).toBeGreaterThan(
    relaxed.getSnapshot().enemies[0].d
  );
  const rush = createSurahRush({ motor: "normal" });
  rush.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
  rush.start();
  rush.dispatch({ type: "move", direction: 1 });
  for (let i = 0; i < 100; i++) rush.dispatch({ type: "tick", dt: 0.03 });
  expect(rush.getSnapshot().x).toBeGreaterThan(265);
  const errors = rush.getSnapshot().motorErrors;
  rush.dispatch({ type: "slide", active: true });
  for (let i = 0; i < 25; i++) rush.dispatch({ type: "tick", dt: 0.03 });
  expect(rush.getSnapshot().slide).toBe(true);
  expect(rush.getSnapshot().motorErrors).toBe(errors);
});
test("supplied source candidates stay request-local and do not contaminate the cached free-source pool", () => {
  const unit = revisionUnits(localBundle("1:1"))[0];
  const supplied = [localBundle("112:2")];
  const custom = revisionChoices(unit, { bundles: supplied });
  expect(custom.find((c) => c.id !== unit.id).key).toBe("112:2");
  const fresh = revisionChoices(unit, { memory: "standard" });
  expect(fresh).toHaveLength(3);
  expect(
    fresh.every((c) => c.key === "1:1" || Number(c.key.split(":")[0]) >= 78)
  ).toBe(true);
  expect(supplied).toHaveLength(1);
});
