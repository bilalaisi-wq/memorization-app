import { test, expect } from "@playwright/test";
import { parkExtra } from "./falling-helper.js";
async function open(page) {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.played = [];
    window.stopped = 0;
    window.Audio = class {
      constructor(src) {
        this.src = src;
      }
      play() {
        window.played.push(this.src);
        return Promise.resolve();
      }
      pause() {
        window.stopped++;
      }
    };
  });
  await page.goto("/");
  await page.locator("#nav-puzzle-lab").click();
}
test("Start begins automatic motion and looping audio; keyboard works without clicking board", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("#fall-discard")).toHaveCount(0);
  await expect(page.locator("#lab-timed")).toHaveCount(0);
  await expect(page.locator("[value=relaxed]")).toHaveCount(0);
  const before = await page.locator(".falling-block").getAttribute("style");
  await page.waitForTimeout(350);
  expect(await page.locator(".falling-block").getAttribute("style")).toBe(
    before,
  );
  expect(await page.evaluate(() => window.played.length)).toBe(0);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.played.length))
    .toBeGreaterThan(0);
  await page.locator("h3").first().click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-lane",
    "2",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-lane",
    "3",
  );
  const top = await page.locator(".falling-block").getAttribute("style");
  await expect
    .poll(() => page.locator(".falling-block").getAttribute("style"))
    .not.toBe(top);
  await page.keyboard.press("p");
  await expect(page.locator(".falling-counter")).toContainText("Paused");
  await page.keyboard.press("p");
  await expect(page.locator(".falling-counter")).toContainText("Ready");
  expect(await page.evaluate(() => window.stopped)).toBe(0);
  await page.locator("[name=audio]").selectOption("silent");
  expect(await page.evaluate(() => window.stopped)).toBe(1);
  await page.locator("[name=first]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-lane",
    "3",
  );
});
test("Space parks extra words safely; completion offers harder repetition or the next ayah", async ({
  page,
}) => {
  await open(page);
  await page.locator("[name=audio]").selectOption("silent");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  for (
    let i = 0;
    i < 40 && !(await page.locator(".tower-next-step").count());
    i++
  ) {
    const n = await page.locator("[data-slot]").count(),
      index = Number(
        await page.locator(".falling-block").getAttribute("data-index"),
      );
    if (index >= n) await parkExtra(page);
    else {
      await page.locator(".falling-stage").focus();
      await page.keyboard.press("Space");
    }
  }
  await expect(page.locator(".tower-next-step")).toBeVisible();
  await expect(page.locator(".tower-hud")).toContainText("Ayah 1");
  await page.locator("[data-repeat]").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[name=speed]")).toHaveValue("normal");
  await expect(page.locator("#lab-level")).toBeHidden();
  await expect(page.locator(".tower-next-step")).toHaveCount(0);
  await expect(page.locator(".falling-block")).toBeVisible();
  await page.locator("[name=speed]").selectOption("slow");
  for (
    let i = 0;
    i < 40 && !(await page.locator(".tower-next-step").count());
    i++
  ) {
    const n = await page.locator("[data-slot]").count(),
      index = Number(
        await page.locator(".falling-block").getAttribute("data-index"),
      );
    if (index >= n) await parkExtra(page);
    else await page.locator("#fall-place").click();
  }
  await page.locator("[data-next]").click();
  await expect(page.locator(".tower-hud")).toContainText("Ayah 2");
});

test("Falling words never conceal text, including Hold, parked blocks and fastest speed", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("#lab-level")).toBeHidden();
  await page.locator("[name=audio]").selectOption("silent");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator("[data-game=vanishing]").click();
  await page.locator("#lab-level").selectOption("4");
  await page.locator("[data-game=falling]").click();
  await page.locator("[name=audio]").selectOption("silent");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const word = await page.locator(".falling-block").textContent();
  await page.locator("#fall-hold").click();
  await expect(page.locator(".tower-hold [lang=ar]")).toHaveText(word);
  await page.locator("[name=speed]").selectOption("fast");
  await parkExtra(page);
  await expect(page.locator(".tower-settled-word").first()).not.toHaveText("؟");
  await expect(
    page.locator(".tower-parking-words [lang=ar]").first(),
  ).not.toHaveText("؟");
  await expect(page.locator(".falling-block")).not.toHaveText("؟");
});
