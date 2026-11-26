import { test, expect } from "@playwright/test";
test("earned strategy purchases build six real illustrated tower roles and actual balloon kills fund visible upgrades", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(async () => {
    window.Audio = class {
      play() {
        return Promise.resolve();
      }
      pause() {}
      load() {}
      removeAttribute() {}
    };
    const { mountAdventure } = await import("/src/revision/adventures/ui.js");
    const root = document.createElement("section");
    document.body.replaceChildren(root);
    window.combatFrames = new Map();
    let id = 0;
    window.combat = await mountAdventure(root, {
      game: "ayah-defense",
      refs: Array.from({ length: 40 }, (_, i) => `78:${i + 1}`),
      frameScheduler: {
        request(fn) {
          const key = ++id;
          window.combatFrames.set(key, fn);
          return key;
        },
        cancel(key) {
          window.combatFrames.delete(key);
        },
      },
    });
  });
  await page.locator("[data-adventure-audio]").selectOption("paused");
  await page.locator("[data-flow-start]").click();
  await page.evaluate(async () => {
    const { revisionUnits } = await import(
      "/src/revision/adventures/content.js"
    );
    const { localBundle } = await import("/src/content/library.js");
    while (window.combat.getSnapshot().completed < 39) {
      const s = window.combat.getSnapshot(),
        unit = revisionUnits(localBundle(`78:${s.completed + 1}`))[s.unit];
      const b = [...document.querySelectorAll("[data-flow-choice]")].find(
        (b) =>
          b.dataset.flowPrompt === unit.id &&
          b.querySelector(".arabic").textContent === unit.text
      );
      if (b && !b.disabled && !s.answerPending) b.click();
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  });
  const { legalPositions } = await import(
    "../src/revision/adventures/defense-maps.js"
  );
  for (const kind of [
    "arrow",
    "frost",
    "beam",
    "pulse",
    "guardian",
    "observatory",
  ]) {
    await page.locator(`[data-defense-buy=${kind}]`).click();
    const towers = await page.evaluate(
      () => window.combat.getSnapshot().engine.towers
    );
    const p = legalPositions(0, towers)[0];
    const screen = await page.locator(".flow-scene svg").evaluate((svg, p) => {
      const point = svg.createSVGPoint();
      point.x = p.x;
      point.y = p.y;
      const screen = point.matrixTransform(svg.getScreenCTM());
      return { x: screen.x, y: screen.y };
    }, p);
    await page.mouse.click(screen.x, screen.y);
    await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(
      towers.length + 1
    );
  }
  await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(6);
  await page.evaluate(() => {
    window.combatTime = performance.now();
    for (let n = 0; n < 30; n++) {
      window.combatTime += 1000 / 60;
      for (const [id, fn] of [...window.combatFrames]) {
        window.combatFrames.delete(id);
        fn(window.combatTime);
      }
    }
  });
  await page
    .locator(".gameplay-viewport")
    .screenshot({ path: "docs/defense2/construction-desktop.png" });
  await page.evaluate(() => {
    for (let n = 0; n < 7200; n++) {
      window.combatTime += 1000 / 60;
      for (const [id, fn] of [...window.combatFrames]) {
        window.combatFrames.delete(id);
        fn(window.combatTime);
      }
      if (window.combat.getSnapshot().engine.coins >= 18) break;
    }
  });
  expect(
    await page.evaluate(() => window.combat.getSnapshot().engine.kills)
  ).toBeGreaterThan(0);
  await page.locator("[data-defense-shop-view]").click();
  await page.locator("[data-defense-selected]").selectOption("1");
  await expect(page.locator("[data-flow-upgrade]")).toBeEnabled();
  await page.locator("[data-flow-upgrade]").click();
  expect(
    await page.evaluate(
      () => window.combat.getSnapshot().engine.towers[0].level
    )
  ).toBe(2);
  await page.evaluate(() => {
    for (let n = 0; n < 60; n++) {
      window.combatTime += 1000 / 60;
      for (const [id, fn] of [...window.combatFrames]) {
        window.combatFrames.delete(id);
        fn(window.combatTime);
      }
    }
  });
  await page
    .locator(".gameplay-viewport")
    .screenshot({ path: "docs/defense2/upgrade-and-combat-desktop.png" });
});
