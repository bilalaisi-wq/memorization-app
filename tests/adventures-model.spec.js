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
test("six distinct towers: queue, finite energy, upgrades, support, enemy damage and commander cooldowns", () => {
  const g = createAyahDefense();
  for (let i = 0; i < 6; i++)
    g.dispatch({ type: "place", kind: Object.keys(TOWERS)[i], site: i });
  expect(g.getSnapshot().towers).toHaveLength(6);
  g.start();
  for (let i = 0; i < 8; i++) g.dispatch({ type: "revision", id: "unit-" + i });
  expect(g.getSnapshot().towers.every((t) => t.active)).toBe(true);
  const energy = g.getSnapshot().energy;
  g.dispatch({ type: "revision", id: "unit-0" });
  expect(g.getSnapshot().energy).toBe(energy);
  g.dispatch({ type: "ability", name: "shield" });
  const shield = g.getSnapshot().shield;
  g.dispatch({ type: "ability", name: "shield" });
  expect(g.getSnapshot().shield).toBe(shield);
  for (let i = 0; i < 1000; i++) g.dispatch({ type: "tick", dt: 0.1 });
  expect(g.getSnapshot().kills).toBeGreaterThan(0);
  expect(g.getSnapshot().motorErrors).toBeGreaterThanOrEqual(0);
  expect(g.getSnapshot().towers.find((t) => t.kind === "frost").active).toBe(
    true
  );
  g.dispatch({ type: "upgrade", site: 0 });
  expect(g.getSnapshot().towers[0].level).toBeGreaterThan(1);
  expect(pointOnPath(100, 0).x).toBeGreaterThan(0);
  g.pause();
  const t = g.getSnapshot().time;
  g.dispatch({ type: "tick", dt: 0.2 });
  expect(g.getSnapshot().time).toBe(t);
  g.dispose();
  expect(g.getSnapshot().status).toBe("disposed");
});
test("surah rush has acceleration, coyote/buffer, springs, safe junctions, wrong recovery and actual final crossing", () => {
  const events = [],
    g = createSurahRush({ onEvent: (e) => events.push(e) });
  g.start();
  g.dispatch({ type: "move", direction: 1 });
  for (let i = 0; i < 20; i++) g.dispatch({ type: "tick", dt: 0.05 });
  expect(g.getSnapshot().vx).toBeGreaterThan(0);
  g.dispatch({ type: "jump" });
  g.dispatch({ type: "tick", dt: 0.03 });
  expect(g.getSnapshot().vy).toBeLessThan(0);
  g.dispatch({ type: "dash" });
  expect(g.getSnapshot().dash).toBeGreaterThan(0);
  g.dispatch({ type: "slide", active: true });
  expect(g.getSnapshot().slide).toBe(true);
  for (let i = 0; i < 400; i++) {
    g.dispatch({ type: "move", direction: 1 });
    g.dispatch({ type: "tick", dt: 0.05 });
  }
  expect(g.getSnapshot().x).toBe(730);
  expect(events.some((e) => e.type === "spring")).toBe(true);
  g.dispatch({ type: "route", index: 1 });
  g.dispatch({ type: "tick", dt: 0.02 });
  expect(
    events.some((e) => e.type === "route-committed" && e.choice === 1)
  ).toBe(true);
  g.dispatch({ type: "wrong" });
  expect(g.getSnapshot().x).toBe(620);
  g.dispatch({ type: "correct", index: 2 });
  g.dispatch({ type: "final" });
  for (let i = 0; i < 800 && g.getSnapshot().status !== "won"; i++) {
    g.dispatch({ type: "move", direction: 1 });
    g.dispatch({ type: "tick", dt: 0.05 });
  }
  expect(g.getSnapshot().status).toBe("won");
  expect(terrain(380)).toBeNull();
  expect(g.getSnapshot().flow).toBe(1);
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
  rush.start();
  rush.dispatch({ type: "move", direction: 1 });
  for (let i = 0; i < 100; i++) rush.dispatch({ type: "tick", dt: 0.03 });
  expect(rush.getSnapshot().x).toBeCloseTo(185);
  const errors = rush.getSnapshot().motorErrors;
  rush.dispatch({ type: "slide", active: true });
  for (let i = 0; i < 25; i++) rush.dispatch({ type: "tick", dt: 0.03 });
  expect(rush.getSnapshot().x).toBeGreaterThan(265);
  expect(rush.getSnapshot().motorErrors).toBe(errors);
});
