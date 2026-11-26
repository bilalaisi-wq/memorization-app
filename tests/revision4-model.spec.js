import { test, expect } from "@playwright/test";
import {
  revisionGroupSizes,
  revisionUnits,
  revisionChoices,
} from "../src/revision/adventures/content.js";
import { localBundle } from "../src/content/library.js";
import {
  wavePlan,
  ENEMY_ROSTER,
} from "../src/revision/adventures/defense-waves.js";
import {
  createAyahDefense,
  TOWERS,
} from "../src/revision/adventures/defense.js";
import { createSurahRush } from "../src/revision/adventures/rush.js";
import {
  coursePlan,
  routeLayouts,
  validateCourse,
  UPPER_ROUTES,
  MIDDLE_ROUTES,
} from "../src/revision/adventures/rush-course.js";
import {
  validAdventure,
  newAdventure,
} from "../src/revision/adventures/store.js";
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 17, 25, 50, 128, 300])
  test(`v4 canonical group partition ${n}`, () => {
    for (let seed = 1; seed <= 100; seed++) {
      const sizes = revisionGroupSizes(n, seed);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
      expect(sizes.every((v) => v >= Math.min(n, 3))).toBe(true);
    }
  });
test("weighted groups favor four/five words without counting context as coverage", () => {
  const counts = {};
  for (let seed = 1; seed <= 1000; seed++)
    for (const n of revisionGroupSizes(100, seed))
      counts[n] = (counts[n] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  expect((counts[4] + counts[5]) / total).toBeGreaterThan(0.55);
  console.log("group distribution", JSON.stringify(counts));
  for (let verse = 1; verse <= 40; verse++) {
    const b = localBundle(`78:${verse}`),
      u = revisionUnits(b);
    expect(u.flatMap((x) => x.targetPositions)).toEqual(
      b.words.map((w) => w.position)
    );
    for (const unit of u) {
      expect(unit.contextPositions.every((p) => p < unit.positions[0])).toBe(
        true
      );
      expect(unit.positions).toEqual(unit.targetPositions);
      expect(unit.text).toBe(
        b.words
          .slice(unit.positions[0] - 1, unit.positions.at(-1))
          .map((w) => w.text)
          .join(" ")
      );
      expect(revisionChoices(unit).some((c) => c.id === unit.id)).toBe(true);
    }
  }
});
test("historical planner, IDs and saves remain explicit and valid", () => {
  const r = newAdventure("surah-rush", ["1:1"], {
    memory: "guided",
    motor: "normal",
  });
  expect(r.plannerVersion).toBe(4);
  expect(validAdventure(r)).toBe(true);
  delete r.plannerVersion;
  expect(validAdventure(r)).toBe(true);
  const b = localBundle("78:38");
  expect(
    revisionUnits(b, "guided", { version: 3 }).map((u) => u.id)
  ).not.toEqual(revisionUnits(b).map((u) => u.id));
  const old = createSurahRush({
    restore: { ...createSurahRush().checkpoint(), generatorVersion: 3 },
  });
  expect(old.getSnapshot().plan.layouts).toBeUndefined();
});
test("true wave budgets escalate after three forgiving waves and unlock all seven distinct enemy variants", () => {
  for (const motor of ["relaxed", "normal", "arcade"])
    for (let map = 0; map < 4; map++) {
      let prior = 0;
      const seen = new Set();
      for (let w = 1; w <= 60; w++) {
        const p = wavePlan(w, { motor, map });
        expect(p.threat).toBeGreaterThan(prior);
        prior = p.threat;
        p.enemies.forEach((e) => seen.add(e.kind));
        expect(p.count).toBeLessThanOrEqual(24);
      }
      expect([...seen].sort()).toEqual(Object.keys(ENEMY_ROSTER).sort());
      expect(wavePlan(4).threat / wavePlan(3).threat).toBeGreaterThan(1.5);
    }
  expect(ENEMY_ROSTER.boulder.armor).toBeGreaterThan(ENEMY_ROSTER.walker.armor);
  expect(ENEMY_ROSTER.rover.escort).toBe(true);
  expect(ENEMY_ROSTER.tank.hp).toBeGreaterThan(ENEMY_ROSTER.boulder.hp);
});
test("zero-point contextual review cannot create construction currency or duplicate reward receipts", () => {
  const g = createAyahDefense();
  g.start();
  g.dispatch({
    type: "revision",
    id: "1:1:1-4:review",
    points: 0,
    lastSource: true,
  });
  expect(g.getSnapshot().energy).toBe(0);
  g.dispatch({ type: "revision", id: "1:1:1-4", points: 20 });
  g.dispatch({ type: "revision", id: "1:1:1-4", points: 20 });
  expect(g.getSnapshot().energy).toBe(20);
});
test("thousands of seeded plans use every route without a fixed five-step cycle or consecutive full-junction copies", () => {
  const upper = new Set(),
    middle = new Set(),
    pairs = new Set();
  let repeats = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let prior = null;
    for (let index = 0; index < 100; index++) {
      const opts = {
          generatorVersion: 4,
          seed,
          motor: ["relaxed", "normal", "arcade"][seed % 3],
        },
        p = coursePlan(index, opts);
      expect(validateCourse(p)).toBe(true);
      expect(coursePlan(index, opts)).toEqual(p);
      upper.add(p.layouts.upper);
      middle.add(p.layouts.middle);
      const id = JSON.stringify(p.layouts);
      pairs.add(id);
      if (id === prior) repeats++;
      prior = id;
    }
  }
  expect(upper.size).toBe(5);
  expect(middle.size).toBe(5);
  expect(pairs.size).toBe(25);
  expect(repeats).toBeLessThan(15);
  console.log(
    "route distribution",
    JSON.stringify({
      upper: [...upper],
      middle: [...middle],
      pairs: pairs.size,
      repeats,
    })
  );
});

import { steerRush } from "./rush3-helper.js";
import { legalPositions } from "../src/revision/adventures/defense-maps.js";
test("720 physical paths remain reachable with Express, long-label pacing and all movement profiles", () => {
  for (const express of [false, true])
    for (const length of [4, 80])
      for (const motor of ["relaxed", "normal", "arcade"])
        for (let course = 0; course < 20; course++)
          for (let route = 0; route < 3; route++) {
            let choice = null;
            const base = createSurahRush({ express, seed: 12 }).checkpoint(),
              g = createSurahRush({
                motor,
                restore: {
                  ...base,
                  course,
                  junction: null,
                  x: course * (express ? 1315 : 1640) + 60,
                  y: 400,
                },
                onEvent: (e) => {
                  if (e.type === "route-committed") choice = e.choice;
                },
              });
            g.dispatch({
              type: "challenge",
              id: "1:1:1-4",
              count: 3,
              length,
              wordCount: length > 4 ? 6 : 1,
            });
            g.start();
            for (let n = 0; n < 5000 && choice === null; n++) {
              steerRush(g, route);
              g.dispatch({ type: "tick", dt: 1 / 60 });
            }
            expect(
              choice,
              JSON.stringify({
                express,
                length,
                motor,
                course,
                route,
                plan: g.getSnapshot().plan.layouts,
              })
            ).toBe(route);
          }
});
function travel(express, motor) {
  const units = ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7"].flatMap(
    (key) => revisionUnits(localBundle(key))
  );
  let accepted = 0,
    wrong = 0;
  const g = createSurahRush({
    express,
    motor,
    seed: 17,
    onEvent: (e) => {
      if (e.type === "route-committed") {
        if (e.choice !== accepted % 3) {
          wrong++;
          return;
        }
        g.dispatch({ type: "correct" });
        accepted++;
        if (accepted === units.length) g.dispatch({ type: "final" });
        else
          g.dispatch({
            type: "challenge",
            id: units[accepted].id,
            count: 3,
            length: units[accepted].text.length,
            wordCount: units[accepted].positions.length,
          });
      }
    },
  });
  g.dispatch({
    type: "challenge",
    id: units[0].id,
    count: 3,
    length: units[0].text.length,
  });
  g.start();
  for (let n = 0; n < 40000 && g.getSnapshot().status !== "won"; n++) {
    steerRush(g, accepted % 3);
    g.dispatch({ type: "tick", dt: 1 / 60 });
  }
  const s = g.getSnapshot();
  expect(
    s.status,
    JSON.stringify({
      express,
      motor,
      accepted,
      wrong,
      x: s.x,
      y: s.y,
      course: s.course,
      layout: s.plan.layouts,
      challenge: s.challenge,
      resolved: s.resolved,
      motorErrors: s.motorErrors,
    })
  ).toBe("won");
  return {
    seconds: s.time,
    distance: s.distance,
    accepted,
    words: units.flatMap((u) => u.targetPositions).length,
    wrong,
  };
}
test("Express improves measured revision throughput without dropping a source decision or word", () => {
  for (const motor of ["relaxed", "normal", "arcade"]) {
    const standard = travel(false, motor),
      express = travel(true, motor);
    expect(express.accepted).toBe(standard.accepted);
    expect(express.words).toBe(standard.words);
    expect(express.wrong).toBe(0);
    expect(express.seconds).toBeLessThan(standard.seconds * 0.92);
    expect(express.distance).toBeLessThan(standard.distance);
    console.log(
      "Express benchmark",
      motor,
      JSON.stringify({ standard, express })
    );
  }
});
test("Auto-Sprint is opt-in, pauses, waits for a deliberate route gesture and restores its exact seeded route", () => {
  for (const motor of ["relaxed", "normal", "arcade"]) {
    const idle = createSurahRush({ motor });
    idle.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
    idle.start();
    for (let i = 0; i < 300; i++) idle.dispatch({ type: "tick", dt: 1 / 60 });
    expect(idle.getSnapshot().autoSprint).toBe(false);
    expect(idle.getSnapshot().x).toBeLessThan(100);
    let decisions = 0;
    const g = createSurahRush({
      motor,
      autoSprint: true,
      seed: 44,
      onEvent: (e) => {
        if (e.type === "route-committed") decisions++;
      },
    });
    g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3, length: 60 });
    g.start();
    for (let i = 0; i < 2400; i++) g.dispatch({ type: "tick", dt: 1 / 60 });
    expect(decisions).toBe(0);
    expect(g.getSnapshot().x).toBeLessThan(g.getSnapshot().plan.commits[0].x);
    g.pause();
    const x = g.getSnapshot().x;
    for (let i = 0; i < 300; i++) g.dispatch({ type: "tick", dt: 1 / 60 });
    expect(g.getSnapshot().x).toBe(x);
    const saved = g.checkpoint(),
      resumed = createSurahRush({ restore: saved, seed: 999 });
    expect(resumed.getSnapshot().plan.layouts).toEqual(
      g.getSnapshot().plan.layouts
    );
    expect(resumed.getSnapshot().challenge).toEqual(g.getSnapshot().challenge);
    g.resume();
    for (let i = 0; i < 5000 && decisions === 0; i++) {
      steerRush(g, 0);
      g.dispatch({ type: "tick", dt: 1 / 60 });
    }
    expect(decisions).toBe(1);
  }
});
function balancedRun(kinds, level, poor = false) {
  const towers = [],
    base = createAyahDefense().checkpoint();
  for (const kind of kinds) {
    const ps = legalPositions(0, towers).sort((a, b) =>
      poor
        ? a.y - b.y
        : Math.abs(a.x - 450) +
          Math.abs(a.y - 250) -
          (Math.abs(b.x - 450) + Math.abs(b.y - 250))
    );
    towers.push({
      ...ps[0],
      id: towers.length + 1,
      kind,
      level,
      active: true,
      paidCost: TOWERS[kind].cost,
      upgradeSpend: level > 1 ? 54 : 0,
      targeting: "first",
      builtAt: 0,
    });
  }
  const ids = [
    ...Array.from({ length: 40 }, (_, i) => `78:${i + 1}`),
    ...Array.from({ length: 46 }, (_, i) => `79:${i + 1}`),
  ].flatMap((k) => revisionUnits(localBundle(k)).map((u) => u.id));
  const g = createAyahDefense({
    restore: {
      ...base,
      time: 90,
      firstBuiltAt: 0,
      towers,
      wave: 1,
      waveState: { number: 1, spawned: 0, elapsed: 0 },
    },
  });
  g.start();
  for (let n = 0; n < 4800; n++) {
    if (n % 80 === 0)
      g.dispatch({ type: "revision", id: ids[n / 80], points: 0 });
    g.dispatch({ type: "tick", dt: 0.1 });
    if (g.getFrame().status === "recovery") break;
  }
  return g.getSnapshot();
}
test("real combat rewards upgraded, varied and well-placed defenses; basic towers cannot trivially clear late waves", () => {
  const basic = balancedRun(["arrow", "arrow", "arrow"], 1),
    upgraded = balancedRun(["arrow", "arrow", "arrow"], 3),
    mixed = balancedRun(["arrow", "beam", "frost"], 3),
    poor = balancedRun(["arrow", "arrow", "arrow"], 1, true);
  expect(basic.wave).toBeGreaterThan(3);
  expect(basic.wave).toBeLessThan(10);
  expect(upgraded.kills).toBeGreaterThan(basic.kills);
  expect(upgraded.wave).toBeGreaterThan(basic.wave);
  expect(mixed.wave).toBeGreaterThanOrEqual(upgraded.wave);
  expect(mixed.kills).toBeGreaterThan(upgraded.kills);
  expect(poor.core + poor.shield).toBeLessThan(basic.core + basic.shield);
  console.log(
    "Combat benchmark",
    JSON.stringify(
      Object.fromEntries(
        Object.entries({ basic, upgraded, mixed, poor }).map(([k, s]) => [
          k,
          { wave: s.wave, kills: s.kills, core: s.core, shield: s.shield },
        ])
      )
    )
  );
});

test("route objects actually move the runner: rail transport, lifted support, wall jumps and slide ceilings", () => {
  const observed = new Set();
  for (const upper of ["sky-rail", "lift-climb", "wall-jump"]) {
    const base = createSurahRush().checkpoint(),
      g = createSurahRush({
        restore: {
          ...base,
          junction: { index: 0, layouts: { upper, middle: "rolling-hills" } },
        },
        onEvent: (e) => observed.add(e.type),
      });
    g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
    g.start();
    for (let i = 0; i < 1500; i++) {
      const s = g.getSnapshot();
      steerRush(g, 0);
      if (s.wall) g.dispatch({ type: "jump" });
      if (s.support?.endsWith(":lift")) observed.add("lift-ridden");
      g.dispatch({ type: "tick", dt: 1 / 60 });
      if (g.getSnapshot().committed) break;
    }
  }
  expect(observed.has("rail-entered")).toBe(true);
  expect(observed.has("rail-finished")).toBe(true);
  expect(observed.has("lift-ridden")).toBe(true);
  expect(observed.has("wall-boost")).toBe(true);
  const base = createSurahRush().checkpoint(),
    g = createSurahRush({
      restore: {
        ...base,
        junction: {
          index: 0,
          layouts: { upper: "sky-rail", middle: "slide-tunnel" },
        },
      },
    });
  g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
  g.start();
  g.dispatch({ type: "move", direction: 1 });
  for (let i = 0; i < 600; i++) g.dispatch({ type: "tick", dt: 1 / 60 });
  expect(g.getSnapshot().x).toBeLessThan(865);
  expect(g.getSnapshot().committed).toBe(false);
  g.dispatch({ type: "slide", active: true });
  for (let i = 0; i < 300; i++) g.dispatch({ type: "tick", dt: 1 / 60 });
  expect(g.getSnapshot().route).toBe(1);
});
test("a saved v4 final wave resumes without respawning defeated enemies or duplicating coins", () => {
  const base = createAyahDefense().checkpoint(),
    state = {
      ...base,
      final: true,
      finalSpawns: 2,
      waveState: { number: 1, spawned: 2, elapsed: 4 },
      coins: 12,
      enemies: [],
    };
  const g = createAyahDefense({ restore: state });
  g.start();
  g.dispatch({ type: "tick", dt: 0.1 });
  expect(g.getSnapshot().status).toBe("won");
  expect(g.getSnapshot().coins).toBe(12);
  expect(g.getSnapshot().nextEnemyId).toBe(0);
});
