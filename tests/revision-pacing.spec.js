import { expect, test } from "@playwright/test";
import { createMission } from "../src/quest/cosmic/mission.js";
import { createFlightController } from "../src/quest/cosmic/controller.js";
import {
  activeExpeditionTasks,
  createExpeditionStore,
  expeditionTasks,
} from "../src/quest/cosmic/expedition/store.js";
import { prepareBoundaryContent } from "../src/quest/cosmic/boundary-content.js";
import { createBoundaryLink } from "../src/puzzles/arcade/cosmic/link-boundary.js";
import { sourceRoman } from "../src/quest/cosmic/transliteration.js";
function pilot(g) {
  for (let i = 0; i < 100000; i++) {
    const s = g.getSnapshot();
    if (s.status === "checkpoint") return s;
    if (s.status === "recovery") {
      g.dispatch({ type: "retry" });
      continue;
    }
    const danger = s.objects.find((o) =>
        o.kind === "asteroid" && o.y > 400 && o.y < 670
      ),
      target = s.objects.find((o) =>
        o.kind === "pickup" && o.unit.id === s.unit.id
      ),
      lane = danger ? (danger.lane + 1) % 3 : target?.lane;
    if (lane !== undefined) {
      for (let d = lane - s.lane; d; d -= Math.sign(d)) {
        g.dispatch({ type: "lane", direction: Math.sign(d) });
      }
      g.dispatch({ type: "confirm-lane" });
    }
    g.dispatch({ type: "tick", dt: 1 / 60 });
  }
  throw Error("Stage could not finish");
}
test("15 ayahs advance through all three sets after one pass; optional repetitions can be skipped without fake completions", async () => {
  const m = await createMission({ surahId: 91, selection: "15" }),
    events = [],
    g = await createFlightController(m, {
      pickupMode: "ayahs",
      onEvent: (e) => events.push(e),
    });
  g.start();
  for (let stage = 0; stage < 3; stage++) {
    expect(g.getSnapshot().stageIndex).toBe(stage);
    expect(g.getSnapshot().roundCount).toBe(1);
    pilot(g);
    expect(g.nextStage()).toBe(stage < 2);
  }
  expect(g.getSnapshot().routeComplete).toBe(true);
  expect(
    new Set(
      events.filter((e) => e.type === "runner:pickup-correct").map((e) =>
        e.targetRef
      ),
    ).size,
  ).toBe(15);
  g.dispose();
  const repeats = await createFlightController(m, {
    pickupMode: "ayahs",
    rounds: 3,
  });
  repeats.start();
  for (let stage = 0; stage < 3; stage++) {
    pilot(repeats);
    repeats.nextStage({ skipRounds: true });
  }
  expect(repeats.getSnapshot()).toMatchObject({
    routeComplete: true,
    skippedOptionalRounds: 6,
    activityCompletedCount: 3,
    activityRequiredCount: 3,
  });
  repeats.dispose();
});
test("saved three-round routes can reduce future repetitions while retaining genuine completions and old IDs", async () => {
  const m = await createMission({ surahId: 91, selection: "15" }),
    data = new Map(),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
    },
    store = createExpeditionStore({ storage, getOwner: () => null });
  await store.open(m, 3);
  const old = expeditionTasks(m, 3);
  store.complete(m, old[0].id);
  await store.open(m, 1);
  const run = store.snapshot().runs[m.id];
  expect(run.completed).toEqual([old[0].id]);
  expect(run.rounds).toBe(3);
  expect(run.skippedRounds).toHaveLength(6);
  expect(activeExpeditionTasks(m, run)[1].activity).toBe("defense");
  store.complete(m, activeExpeditionTasks(m, run)[1].id);
  expect(store.snapshot().runs[m.id].completed).toHaveLength(2);
});
test("endpoint answer positions vary across runs and source transliteration never fabricates missing private text", async () => {
  const content = await prepareBoundaryContent(["1:1", "1:2", "1:3"]),
    slots = new Set();
  for (let seed = 1; seed < 90; seed++) {
    const game = createBoundaryLink({
      refs: content.refs,
      content,
      stageId: "positions",
      mode: "boundary",
      seed,
    });
    game.start();
    const s = game.getSnapshot();
    slots.add(s.openings.findIndex((e) => e.ref === "1:2"));
    expect(s.openings.every((e) => sourceRoman(e).length > 0)).toBe(true);
    game.dispose();
  }
  expect([...slots].sort()).toEqual([0, 1, 2]);
  expect(sourceRoman({ ref: "2:282", text: "not-a-source" })).toBe("");
  content.dispose();
  const short = await prepareBoundaryContent(["112:1", "112:2"]),
    single = createBoundaryLink({
      refs: short.refs,
      content: short,
      stageId: "short-chain",
      mode: "constellation",
      reducedMotion: true,
    });
  single.start();
  single.dispatch({ type: "hide-opening" });
  single.dispatch({ type: "choices" });
  let s = single.getSnapshot();
  single.dispatch({
    type: "select-endpoint",
    side: "ending",
    id: s.endings.find((e) => e.ref === "112:1").id,
  });
  single.dispatch({
    type: "select-endpoint",
    side: "opening",
    id: s.openings.find((e) => e.ref === "112:2").id,
  });
  single.dispatch({ type: "commit-link" });
  single.dispatch({ type: "tick", dt: .1 });
  single.dispatch({ type: "continue" });
  expect(single.getSnapshot().status).toBe("checkpoint");
  single.dispose();
  short.dispose();
});
test("briefing launches the selected later set and defaults to one revision round", async ({ page }) => {
  await page.goto("/");
  await page.locator("#nav-revision-lab").click();
  await page.locator("[name=surah]").selectOption("91");
  await page.locator("[name=selection]").selectOption("15");
  await page.getByRole("button", { name: "View mission briefing →" }).click();
  await page.locator('[data-stage="1"]').click();
  await expect(page.locator("[data-flight-rounds]")).toHaveValue("1");
  await page.locator("[data-launch-runner]").click();
  await expect(page.locator("[data-flight-stage]")).toContainText("2 / 3");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await expect(page.locator("[data-flow-prompt]")).toContainText("Ayah 6");
});
