import { test, expect } from "@playwright/test";
import { mountRush } from "./rush3-ui-helper.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
import { localBundle } from "../src/content/library.js";
test("a legacy context-only final review earns no points and cannot block the first-defense allowance", async ({
  page,
}) => {
  await mountRush(page, { game: "ayah-defense", refs: ["98:1"] });
  await page.evaluate(() => {
    window.rushActivity.dispose();
    const data = JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")),
      r = Object.values(data.runs)[0];
    delete r.plannerVersion;
    r.arcade = null;
    localStorage.setItem("ayah-flow-adventures-v1", JSON.stringify(data));
  });
  await mountRush(page, { game: "ayah-defense", refs: ["98:1"] });
  const units = revisionUnits(localBundle("98:1"), "guided", { version: 3 });
  expect(units.at(-1).review).toBe(true);
  for (const u of units.slice(0, -1))
    await page
      .locator("[data-flow-choice]")
      .filter({ hasText: u.text })
      .click();
  let s = await page.evaluate(() => window.rushActivity.getSnapshot());
  expect(s.engine.energy).toBe(50);
  const prior = s.engine.energy;
  await page
    .locator("[data-flow-choice]")
    .filter({ hasText: units.at(-1).text })
    .click();
  s = await page.evaluate(() => window.rushActivity.getSnapshot());
  expect(s.completed).toBe(1);
  expect(s.engine.energy).toBe(prior);
  await page.locator("[data-defense-buy=arrow]").click();
  await page.locator("[data-defense-confirm]").click();
  await expect(page.locator("[data-flow-tower-entity=arrow]")).toHaveCount(1);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
});

test("backgrounding saves the current neutral wave and currency, not just the last Arabic answer", async ({
  page,
}) => {
  await mountRush(page, { game: "ayah-defense", refs: ["1:1", "1:2"] });
  await page.evaluate(() => {
    for (let n = 0; n < 300; n++) {
      window.rushClock += 1000 / 60;
      for (const [id, fn] of [...window.rushFrames]) {
        window.rushFrames.delete(id);
        fn(window.rushClock);
      }
    }
  });
  const before = await page.evaluate(
    () => window.rushActivity.getSnapshot().engine
  );
  expect(before.waveState.spawned).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const saved = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0].arcade
  );
  expect(saved.time).toBe(before.time);
  expect(saved.waveState).toEqual(before.waveState);
  expect(saved.enemies).toEqual(before.enemies);
  expect(saved.coins).toBe(before.coins);
  await mountRush(page, { game: "ayah-defense", refs: ["1:1", "1:2"] });
  const after = await page.evaluate(
    () => window.rushActivity.getSnapshot().engine
  );
  expect(after.waveState).toEqual(before.waveState);
  expect(after.enemies).toEqual(before.enemies);
  expect(after.coins).toBe(before.coins);
});

test("upgrading a genuine legacy run forks a versioned key and leaves the older-client record unchanged", async ({
  page,
}) => {
  await mountRush(page, { game: "ayah-defense", refs: ["98:1"] });
  const original = await page.evaluate(async () => {
    window.rushActivity.dispose();
    const { sha256 } = await import("/src/content/library.js");
    const data = JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")),
      entries = Object.entries(data.runs),
      [modern, r] = entries[0];
    delete data.runs[modern];
    delete r.plannerVersion;
    r.arcade = null;
    const legacy = await sha256(JSON.stringify([1, "ayah-defense", ["98:1"]]));
    data.runs[legacy] = r;
    localStorage.setItem("ayah-flow-adventures-v1", JSON.stringify(data));
    return { legacy, record: r };
  });
  await mountRush(page, { game: "ayah-defense", refs: ["98:1"] });
  await expect(page.locator(".saved-plan-offer")).toBeVisible();
  const before = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs[key],
    original.legacy
  );
  await page.locator("[data-flow-new-plan]").click();
  await expect(page.locator("[data-flow-start]")).toBeEnabled();
  const runs = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
  );
  expect(Object.keys(runs)).toHaveLength(2);
  expect(runs[original.legacy]).toEqual(before);
  const modern = Object.entries(runs).find(([id]) => id !== original.legacy)[1];
  expect(modern.plannerVersion).toBe(4);
  expect(modern.history.at(-1).plannerVersion).toBe(3);
});
