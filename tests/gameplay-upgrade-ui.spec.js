import { test, expect } from "@playwright/test";
for (const [id, field] of [
  ["snake", ".snake-board"],
  ["sirat", ".sirat-stage"],
  ["maze", ".maze-scroll"],
  ["bubble", ".bubble-arena"],
  ["asteroids", ".astro-stage"],
  ["bridge", ".bridge-stage"],
])
  test(`${id} applies independent pause difficulty and restarts only the active checkpoint`, async ({
    page,
  }) => {
    await page.addInitScript(
      () =>
        (window.Audio = class {
          play() {
            return Promise.resolve();
          }
          pause() {}
          load() {}
          removeAttribute() {}
        })
    );
    await page.goto("/");
    await page.locator("#nav-puzzle-lab").click();
    await page.locator(`[data-game=${id}]`).click();
    if (await page.locator(".bridge-tutorial-dialog").isVisible())
      await page.locator("[data-tutorial-skip]").first().click();
    await page.locator("[data-game-start]").click();
    await expect(page.locator(field)).toBeFocused();
    await page.locator(".lab-game [data-game-command=settings]").click();
    await expect(page.locator("[data-game-memory]")).toBeVisible();
    await page.locator("[data-game-memory]").selectOption("standard");
    await page.locator("[data-game-motor]").selectOption("relaxed");
    await page.locator("[data-game-command=restart-challenge]").click();
    await expect(page.locator(field)).toBeFocused();
    await expect(page.locator(".gameplay-settings")).toBeHidden();
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
  test(`expanded Blocks preserves state and readable controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#nav-puzzle-lab").click();
    await page.locator("[name=audio]").selectOption("silent");
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.locator("[data-blocks-start]").click();
    await expect(page.locator(".falling-stage")).toBeFocused();
    await page.locator("[data-game-command=settings]").click();
    await page.locator("[data-game-motor]").selectOption("relaxed");
    await page.locator("[data-game-command=restart-challenge]").click();
    await expect(page.locator(".falling-stage")).toBeFocused();
    const box = await page.locator(".falling-stage").boundingBox();
    expect(box.height).toBeGreaterThan(165);
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    });
    await expect(page.locator(".falling-stage")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    if (viewport.width === 390 || viewport.width === 1440) {
      await page.locator("[data-game-command=settings]").click();
      await page.locator(".gameplay-viewport").screenshot({
        path: `docs/gameplay-overhaul/blocks-${viewport.width}.png`,
        animations: "disabled",
      });
    }
  });
