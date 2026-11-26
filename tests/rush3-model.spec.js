import { test, expect } from "@playwright/test";
import {
  createSurahRush,
  migrateRushCheckpoint,
} from "../src/revision/adventures/rush.js";
import {
  STRIDE,
  ROUTE_KINDS,
  ZONES,
  coursePlan,
  validateCourse,
  checkpointDue,
} from "../src/revision/adventures/rush-course.js";
import {
  validArcade,
  adventureStore,
  newAdventure,
} from "../src/revision/adventures/store.js";
import {
  revisionUnits,
  revisionChoices,
} from "../src/revision/adventures/content.js";
import { localBundle } from "../src/content/library.js";
import { readFileSync, existsSync } from "node:fs";
import { steerRush, crossRush } from "./rush3-helper.js";
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
for (const motor of ["relaxed", "normal", "arcade"])
  test(`${motor}: all route elevations in every deterministic layout are physically reachable`, () => {
    const kinds = new Set();
    for (let index = 0; index < 20; index++)
      for (let route = 0; route < 3; route++) {
        let answer = null;
        const g = createSurahRush({
          motor,
          seed: 12,
          restore: {
            ...createSurahRush().checkpoint(),
            course: index,
            x: index * STRIDE + 60,
            y: 400,
            camera: index * STRIDE,
          },
        });
        // Same public event contract as the host; correctness is checked outside physics.
        const events = [];
        const h = createSurahRush({
          motor,
          seed: 12,
          restore: g.checkpoint(),
          onEvent: (e) => {
            events.push(e);
            if (e.type === "route-committed") answer = e.choice;
          },
        });
        h.dispatch({ type: "challenge", id: "1:1:1-4", count: 3, length: 4 });
        h.start();
        kinds.add(h.getSnapshot().plan.kind);
        crossRush(h, route, { until: () => answer !== null });
        expect(answer).toBe(route);
        expect(events.filter((e) => e.type === "route-committed")).toHaveLength(
          1
        );
        for (let i = 0; i < 100; i++) h.dispatch({ type: "tick", dt: 1 / 60 });
        expect(events.filter((e) => e.type === "route-committed")).toHaveLength(
          1
        );
        expect(validArcade("surah-rush", h.checkpoint())).toBe(true);
      }
    expect([...kinds].sort()).toEqual([...ROUTE_KINDS].sort());
  });
test("generated course reachability, original zones and bounded plans stay deterministic across many seeds", () => {
  for (let seed = 0; seed < 100; seed++)
    for (let index = 0; index < 10; index++)
      for (const motor of ["relaxed", "normal", "arcade"]) {
        const p = coursePlan(index, { seed, motor });
        expect(validateCourse(p)).toBe(true);
        expect(p).toEqual(coursePlan(index, { seed, motor }));
        expect(p.platforms.length).toBeLessThan(20);
        if (index)
          expect(p.kind).not.toBe(coursePlan(index - 1, { seed, motor }).kind);
      }
  expect(new Set(ZONES.map((z) => z.id)).size).toBe(5);
});
test("wrong recognition takes a playable detour, motor failures stay separate, and a retry cannot advance a source", () => {
  const events = [],
    g = createSurahRush({
      motor: "normal",
      seed: 3,
      onEvent: (e) => events.push(e),
    });
  g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
  g.start();
  crossRush(g, 1, { until: (s) => s.committed });
  g.dispatch({ type: "wrong" });
  const before = g.getSnapshot();
  expect(before.detour).toBe(true);
  crossRush(g, 1, { until: (s) => s.course > before.course });
  const after = g.getSnapshot();
  expect(after.challenge.id).toBe("1:1:1-4");
  expect(after.resolved).toBe(false);
  expect(after.x).toBeGreaterThan(before.x);
  expect(events.filter((e) => e.type === "route-committed")).toHaveLength(1);
  crossRush(g, 0, { until: (s) => s.committed });
  expect(events.filter((e) => e.type === "route-committed")).toHaveLength(2);
});
test("a correct physical crossing streams into the next junction without x or camera reset; loop and springs use real curved/vertical movement", () => {
  const events = [],
    g = createSurahRush({
      motor: "normal",
      seed: 1,
      onEvent: (e) => events.push(e),
    });
  g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3 });
  g.start();
  crossRush(g, 1, { until: (s) => s.committed });
  const before = g.getSnapshot();
  g.dispatch({ type: "correct", index: 1 });
  g.dispatch({ type: "challenge", id: "1:2:1-4", count: 3 });
  crossRush(g, 1, { until: (s) => s.course === 1 });
  const after = g.getSnapshot();
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.camera).toBeGreaterThan(before.camera);
  expect(after.challenge.id).toBe("1:2:1-4");
  expect(events.some((e) => e.type === "loop-entered")).toBe(true);
  expect(events.some((e) => e.type === "loop-finished")).toBe(true);
  expect(after.residentSections).toBeLessThanOrEqual(6);
});
for (const range of [
  [1, 5],
  [1, 10],
  [1, 15],
  [8, 23],
])
  test(`range ${range.join(
    "–"
  )} finishes only after its true endpoint through physical junctions`, () => {
    const refs = Array.from(
      { length: range[1] - range[0] + 1 },
      (_, i) => `78:${range[0] + i}`
    );
    const g = createSurahRush({ motor: "relaxed", seed: 21 });
    g.start();
    let n = 0;
    for (const ref of refs) {
      g.dispatch({ type: "challenge", id: ref + ":1-4", count: 3 });
      crossRush(g, 1, { until: (s) => s.committed });
      g.dispatch({ type: "correct", index: 1 });
      n++;
      if (n === refs.length) g.dispatch({ type: "final" });
      else {
        g.dispatch({ type: "challenge", id: refs[n] + ":1-4", count: 3 });
        crossRush(g, 1, { until: (s) => !s.resolved });
      }
      expect(g.getSnapshot().status).not.toBe("won");
    }
    crossRush(g, 1, { until: (s) => s.status === "won" });
    expect(n).toBe(refs.length);
  });
test("full-surah controller fixtures keep every 25-ayah checkpoint and final 206/286 endpoints distinct", () => {
  for (const [surah, count] of [
    [7, 206],
    [2, 286],
  ]) {
    const refs = Array.from({ length: count }, (_, i) => `${surah}:${i + 1}`),
      seen = [];
    for (let n = 1; n <= count; n++) {
      const p = checkpointDue(refs, n, { fullSurah: true });
      if (p) seen.push(p);
      expect(checkpointDue(refs, n, { fullSurah: false })).toBe(null);
    }
    expect(seen).toEqual(
      Array.from(
        { length: Math.floor((count - 1) / 25) },
        (_, i) => (i + 1) * 25
      )
    );
  }
  // No Arabic is generated for unavailable full Al-Baqarah: this is a reference/controller fixture.
});
test("legacy adaptation archives source-independent movement and malformed saves remain recoverable", () => {
  const old = {
    x: 60,
    y: 310,
    vx: 0,
    vy: 0,
    time: 1,
    distance: 0,
    flow: 1,
    score: 25,
    course: 9,
    motorErrors: 0,
  };
  const next = migrateRushCheckpoint(old);
  expect(old.x).toBe(60);
  expect(next.x).toBe(9 * STRIDE + 60);
  expect(validArcade("surah-rush", next)).toBe(true);
  const storage = memory(),
    store = adventureStore(storage);
  storage.setItem("ayah-flow-adventures-v1", "{bad");
  expect(store.warning).toBe("");
  store.snapshot();
  expect(store.warning).toContain("recovery");
  expect(storage.getItem("ayah-flow-adventures-v1")).toBe("{bad");
});
test("all exact local Al-Araf sources pass continuous physical decisions and retain canonical groups; pilot long sources stay bounded", () => {
  test.setTimeout(180000);
  test.skip(
    !existsSync(".quran-private/7/206/bundle.json"),
    "Ignored operator source files unavailable"
  );
  const g = createSurahRush({ motor: "relaxed", seed: 12 });
  g.start();
  let decisions = 0;
  let source = null;
  const drive = (target) => {
    crossRush(g, target, { until: (s) => s.committed });
    g.dispatch({ type: "correct", index: target });
    decisions++;
  };
  for (let n = 1; n <= 206; n++) {
    const b = JSON.parse(readFileSync(`.quran-private/7/${n}/bundle.json`)),
      units = revisionUnits(b);
    expect(units.filter((u) => !u.review).flatMap((u) => u.positions)).toEqual(
      b.words.map((w) => w.position)
    );
    for (const unit of units) {
      if (source) {
        g.dispatch({ type: "challenge", id: unit.id, count: 3 });
        crossRush(g, 1, { until: (s) => !s.resolved });
      } else g.dispatch({ type: "challenge", id: unit.id, count: 3 });
      source = unit.id;
      drive(1);
    }
    const at = checkpointDue(
      Array.from({ length: 206 }, (_, i) => `7:${i + 1}`),
      n,
      { fullSurah: true }
    );
    if (at) {
      g.dispatch({ type: "checkpoint" });
      const c = g.checkpoint(),
        r = createSurahRush({ restore: c });
      expect(r.getSnapshot().checkpointPending).toBe(true);
      g.dispatch({ type: "continue-checkpoint" });
    }
  }
  g.dispatch({ type: "final" });
  crossRush(g, 1, { until: (s) => s.status === "won" });
  expect(decisions).toBeGreaterThan(1000);
  expect(g.getSnapshot().residentSections).toBeLessThan(8);
  for (const file of ["2-282.json"]) {
    const b = JSON.parse(
      readFileSync(new URL("./fixtures/" + file, import.meta.url))
    );
    expect(
      revisionUnits(b)
        .filter((u) => !u.review)
        .flatMap((u) => u.positions)
    ).toEqual(b.words.map((w) => w.position));
  }
});
test("all five environments keep all physical routes reachable under every movement profile", () => {
  for (let zone = 0; zone < 5; zone++)
    for (const motor of ["relaxed", "normal", "arcade"])
      for (let course = 0; course < 5; course++)
        for (let route = 0; route < 3; route++) {
          let choice = null;
          const baseline = createSurahRush().checkpoint(),
            g = createSurahRush({
              motor,
              seed: 12,
              restore: { ...baseline, course, x: course * STRIDE + 60, y: 400 },
              onEvent: (e) => {
                if (e.type === "route-committed") choice = e.choice;
              },
            });
          g.dispatch({ type: "challenge", id: "1:1:1-4", count: 3, zone });
          g.start();
          crossRush(g, route, { until: () => choice !== null });
          expect(choice).toBe(route);
        }
});
test('long-label reading slowdown keeps every physical continuation reachable',()=>{
 for(const motor of ['relaxed','normal','arcade'])for(let course=0;course<5;course++)for(let route=0;route<3;route++){
  let choice=null;const baseline=createSurahRush().checkpoint(),g=createSurahRush({motor,seed:12,restore:{...baseline,course,x:course*STRIDE+60,y:400},onEvent:e=>{if(e.type==='route-committed')choice=e.choice;}});g.dispatch({type:'challenge',id:'1:1:1-4',count:3,length:80});g.start();crossRush(g,route,{until:()=>choice!==null});expect(choice).toBe(route);
 }
});
