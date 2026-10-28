import { startFalling, parkExtra } from "./falling-helper.js";
import { test, expect } from "@playwright/test";
import { LAB_KEY } from "../src/puzzles/puzzle-store.js";
import { LEARNING_KEY } from "../src/learning-store.js";
async function open(page) {
  await page.addInitScript(() => {
    window.audioLog = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        window.audioLog.push(["new", src]);
      }
      play() {
        window.audioLog.push(["play", this.src]);
        return Promise.resolve();
      }
      pause() {
        window.audioLog.push(["stop", this.src]);
      }
    };
  });
  await page.goto("/");
  await page.locator("#nav-puzzle-lab").click();
  await startFalling(page);
}
async function solve(page) {
  for (let i = 0; i < 200; i++) {
    if (
      (await page.locator("[data-next]").count()) &&
      !(await page.locator(".tower-victory").count())
    ) {
      await page.locator("[data-next]").click();
      continue;
    }
    if (await page.locator(".tower-victory").count()) return;
    if (
      await page.locator(".tower-overlay").filter({ hasText: "rising" }).count()
    ) {
      await expect(
        page.locator(".tower-overlay").filter({ hasText: "rising" }),
      ).toHaveCount(0);
      continue;
    }
    const n = await page.locator("[data-slot]").count(),
      block = page.locator(".falling-block");
    const index = Number(await block.getAttribute("data-index"));
    if (index >= n) await parkExtra(page);
    else await page.locator("#fall-place").click();
  }
  throw Error("Unsolved falling journey");
}
test("tetromino controls, three strikes, required recovery and frozen game-over", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".tetromino-cell.active")).toHaveCount(4);
  await expect(page.locator(".tetromino-cell.ghost")).toHaveCount(4);
  const source = await page
    .locator(".falling-block")
    .getAttribute("data-index");
  await page.locator("#fall-hold").click();
  await expect(page.locator(".tower-hold")).not.toContainText("—");
  await page.locator("#fall-hold").click();
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-index",
    source,
  );
  for (let i = 0; i < 3; i++) await page.locator('[data-slot="3"]').click();
  await expect(page.getByRole("dialog", { name: "Game Over" })).toBeVisible();
  await expect(page.locator(".tower-strikes .used")).toHaveCount(3);
  await expect(page.locator("#fall-place")).toBeDisabled();
  const history = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).history,
    LAB_KEY,
  );
  expect(history.at(-1).arcade.errors).toHaveLength(3);
  expect(history.at(-1).xp).toBe(0);
  await page.locator("#fall-retry").click();
  await expect(page.locator(".tower-strikes .used")).toHaveCount(0);
  await solve(page);
  const m = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).records["1:1"].memory,
    LEARNING_KEY,
  );
  expect(m.card).toBeNull();
});
test("Classic and Practice chains retain floors and apply their strike budgets", async ({
  page,
}) => {
  await open(page);
  const form = page.locator(".tower-settings");
  await form.locator("[name=mode]").selectOption("chain");
  await form.locator("[name=last]").fill("2");
  await form.locator("[name=rules]").selectOption("practice");
  await form.getByRole("button", { name: "Start", exact: true }).click();
  while (!(await page.locator(".tower-hud").textContent()).includes("Ayah 2")) {
    if (await page.locator("[data-next]").count()) {
      await page.locator("[data-next]").click();
      continue;
    }
    if (await page.locator(".tower-overlay").count()) {
      await expect(page.locator(".tower-overlay")).toHaveCount(0);
      continue;
    }
    const n = await page.locator("[data-slot]").count(),
      i = Number(
        await page.locator(".falling-block").getAttribute("data-index"),
      );
    if (i >= n) await parkExtra(page);
    else await page.locator("#fall-place").click();
  }
  await expect(page.locator(".tower-floors")).toContainText("1:1");
  for (let i = 0; i < 3; i++) await page.locator('[data-slot="3"]').click();
  await page.locator("#fall-retry").click();
  await expect(page.locator(".tower-hud")).toContainText("Ayah 2");
  await expect(page.locator(".tower-floors")).toContainText("1:1");
  await solve(page);
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  const h = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).history.at(-1),
    LAB_KEY,
  );
  expect(h.arcade.references).toEqual(["1:1", "1:2"]);
  expect(h.arcade.floors).toEqual(["1:1", "1:2"]);
  await page.locator("#lab-restart").click();
  await startFalling(page);
  await form.locator("[name=mode]").selectOption("chain");
  await form.locator("[name=last]").fill("2");
  await form.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator('[data-slot="3"]').click();
  while (!(await page.locator(".tower-hud").textContent()).includes("Ayah 2")) {
    if (await page.locator("[data-next]").count()) {
      await page.locator("[data-next]").click();
      continue;
    }
    if (await page.locator(".tower-overlay").count()) {
      await expect(page.locator(".tower-overlay")).toHaveCount(0);
      continue;
    }
    const n = await page.locator("[data-slot]").count(),
      i = Number(
        await page.locator(".falling-block").getAttribute("data-index"),
      );
    if (i >= n) await parkExtra(page);
    else await page.locator("#fall-place").click();
  }
  await expect(page.locator(".tower-strikes .used")).toHaveCount(1);
});
test("manual audio pauses gravity, switches safely, and touch/RTL/reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.locator("[name=speed]").selectOption("fast");
  await page.locator("#fall-listen").click();
  await expect(page.locator(".falling-counter")).toContainText("Paused");
  const top = await page.locator(".falling-block").getAttribute("style");
  await page.waitForTimeout(450);
  expect(await page.locator(".falling-block").getAttribute("style")).toBe(top);
  await page.locator("#fall-ayah").click();
  expect(
    await page.evaluate(
      () => window.audioLog.filter((x) => x[0] === "stop").length,
    ),
  ).toBeGreaterThan(0);
  await page.locator("#fall-stop-listening").click();
  await page.locator("#fall-rotate").click();
  await expect(page.locator(".tower-construction [lang=ar]")).toHaveAttribute(
    "dir",
    "rtl",
  );
  expect(
    await page
      .locator(".tetromino-cell")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#nav-learn").click();
  expect(await page.evaluate(() => window.audioLog.at(-1)[0])).toBe("stop");
});
test("Echo gates the opening, Listen loops safely and chain transitions stop prior audio", async ({
  page,
}) => {
  await open(page);
  // Install a controlled media fixture that can finish the current recitation.
  await page.evaluate(() => {
    window.Audio = class {
      constructor(src) {
        this.src = src;
        window.currentRecitation = this;
        window.audioLog.push(["new", src]);
      }
      play() {
        window.audioLog.push(["play", this.src]);
        return Promise.resolve();
      }
      pause() {
        window.audioLog.push(["stop", this.src]);
      }
    };
  });
  const form = page.locator(".tower-settings");
  await form.locator("[name=audio]").selectOption("echo");
  await expect(page.locator(".tower-overlay")).toContainText("Listening");
  const before = await page
    .locator(".falling-block")
    .getAttribute("data-index");
  await page.locator("#fall-place").click();
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-index",
    before,
  );
  await page.evaluate(() => window.currentRecitation.onended());
  await expect(page.locator(".tower-overlay")).toHaveCount(0);
  await form.locator("[name=audio]").selectOption("listen");
  await page.evaluate(() => window.currentRecitation.onended());
  expect(
    await page.evaluate(
      () => window.audioLog.filter((e) => e[0] === "play").length,
    ),
  ).toBeGreaterThanOrEqual(3);
  await form.locator("[name=mode]").selectOption("chain");
  await form.locator("[name=last]").fill("2");
  await form.getByRole("button", { name: "Start", exact: true }).click();
  await solve(page);
  const logs = await page.evaluate(() => window.audioLog);
  const next = logs.findIndex(
    (e) => e[0] === "play" && e[1].includes("001002"),
  );
  expect(next).toBeGreaterThan(0);
  expect(
    logs.slice(0, next).some((e) => e[0] === "stop" && e[1].includes("001001")),
  ).toBe(true);
});
test("Single Ayah can select a later ayah without a chain end and uses its verified audio", async ({
  page,
}) => {
  await open(page);
  const form = page.locator(".tower-settings");
  await expect(form.locator("[name=last]")).toBeHidden();
  await form.locator("[name=first]").fill("5");
  await form.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".tower-hud")).toContainText("Ayah 5");
  await page.locator("#fall-ayah").click();
  expect(await page.evaluate(() => window.audioLog.at(-1)[1])).toContain(
    "001005",
  );
});
