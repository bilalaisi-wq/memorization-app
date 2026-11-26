import { test, expect } from "@playwright/test";
import { mountRush, driveRush } from "./rush3-ui-helper.js";
test("five-ayah route adventure uses physical input, on-world Arabic signs and continuous camera with final crossing", async ({
  page,
}) => {
  test.setTimeout(180000);
  await mountRush(page);
  await expect(page.locator("[data-flow-choice]")).toHaveCount(0);
  await expect(page.locator("[data-rush-sign]")).toHaveCount(2);
  await driveRush(page, { goal: 5 });
  await page.evaluate(() => {
    const field = document.querySelector(".flow-battlefield");
    field.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, code: "ArrowRight" })
    );
    for (let i = 0; i < 900; i++) {
      window.rushClock += 1000 / 60;
      for (const [id, fn] of [...window.rushFrames]) {
        window.rushFrames.delete(id);
        fn(window.rushClock);
      }
    }
  });
  await expect(page.locator(".flow-ribbon")).toContainText(
    "Passage complete · 5/5"
  );
  await expect(page.locator(".rush-route-signs")).toBeHidden();
  const s = await page.evaluate(() => window.rushActivity.getSnapshot());
  expect(s.engine.x).toBeGreaterThan(5 * 1500);
  expect(s.engine.camera).toBeGreaterThan(5000);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
  await page
    .locator(".gameplay-viewport")
    .screenshot({ path: "docs/surah-rush3/complete-desktop.png" });
});
test("wrong route is recorded once and playable detour returns to the unresolved source without dropping earlier progress", async ({
  page,
}) => {
  test.setTimeout(180000);
  await mountRush(page, { refs: ["1:1", "1:2"] });
  await driveRush(page, { goal: 1, wrong: true });
  const saved = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(saved.completed).toBe(1);
  expect(saved.evidence.filter((e) => e.kind === "memory")).toHaveLength(1);
  expect(saved.evidence.filter((e) => e.kind === "memory")[0].ref).toBe("1:1");
  expect(saved.arcade.x).toBeGreaterThan(1600);
});
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 844, height: 390 },
])
  test(`on-world readable signs and mobile controls ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mountRush(page);
    await page.locator("[data-game-command=expand]").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    await expect(page.locator("[data-flow-control=jump]")).toBeVisible();
    await expect(page.locator("[data-flow-control=drop]")).toBeVisible();
    const box = await page.locator(".gameplay-viewport").boundingBox();
    for (const button of await page.locator(".flow-pad button").all()) {
      const b = await button.boundingBox();
      expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 1);
    }
    const scene = await page.locator(".flow-scene").boundingBox();
    expect(scene.height).toBeGreaterThan(box.height * 0.32);

    for (const el of await page.locator("[data-rush-sign] .arabic").all())
      expect(
        parseFloat(await el.evaluate((e) => getComputedStyle(e).fontSize))
      ).toBeGreaterThanOrEqual(24);
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/surah-rush3/routes-${viewport.width}.png` });
  });
for (const [environment, id] of [
  "emerald",
  "forest",
  "skyways",
  "clockwork",
  "oasis",
].entries())
  test(`original ${id} environment renders and its routes are playable`, async ({
    page,
  }) => {
    await mountRush(page, { refs: ["1:1", "1:2"], environment });
    await expect(page.locator(".flow-scene svg")).toHaveAttribute(
      "data-zone",
      id
    );
    await driveRush(page, { goal: 1 });
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/surah-rush3/zone-${id}.png` });
  });
test("full free surah checkpoints at 25 preserve the original mission through difficulty, section practice, exit and reload", async ({
  page,
}) => {
  test.setTimeout(240000);
  const refs = Array.from({ length: 40 }, (_, i) => `78:${i + 1}`);
  await mountRush(page, { refs });
  await driveRush(page, { goal: 25, maxFrames: 50000 });
  await expect(page.locator(".rush-checkpoint")).toBeVisible();
  await expect(page.locator(".rush-checkpoint")).toContainText("25/40");
  await page.locator("[data-rush-checkpoint=progress]").click();
  await expect(page.locator("[data-rush-section-progress]")).toContainText(
    "78:1–78:40"
  );
  await page.locator("[data-rush-checkpoint=difficulty]").click();
  await page.locator("[data-game-motor]").selectOption("normal");
  await page.locator("[data-game-command=restart-challenge]").click();
  await expect(page.locator(".rush-checkpoint")).toBeVisible();
  await page.locator("[data-rush-checkpoint=replay]").click();
  await expect(
    page.locator(".rush-replay-shell [data-flow-start]")
  ).toBeEnabled();
  await page
    .locator(".rush-replay-shell .gameplay-toolbar [data-game-command=exit]")
    .click();
  await expect(page.locator(".rush-checkpoint")).toBeVisible();
  await page.locator("[data-rush-checkpoint=exit]").click();
  await page.reload();
  await mountRush(page, { refs });
  await expect(page.locator(".rush-checkpoint")).toContainText("25/40");
  await page.locator("[data-rush-checkpoint=continue]").click();
  await expect(page.locator(".rush-checkpoint")).toBeHidden();
  await expect(page.locator(".flow-ribbon")).toContainText("78:26");
  const s = await page.evaluate(() => window.rushActivity.getSnapshot());
  expect(s.completed).toBe(25);
  expect(s.refs).toEqual(refs);
  expect(s.engine.status).toBe("playing");
  await driveRush(page, { goal: 26, maxFrames: 10000 });
  expect(
    (await page.evaluate(() => window.rushActivity.getSnapshot())).completed
  ).toBe(26);
});
