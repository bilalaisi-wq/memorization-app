import {enableDeveloperLab} from "./developer-lab-helper.js";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { menu } from "./menu-helper.js";
import { mockBilling } from "./billing-fixtures.js";
const long = JSON.parse(
  readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
);
async function open(page) {
  await enableDeveloperLab(page);
  await menu(page);
  await page.getByRole("button", { name: "Passage memorization", exact: true })
    .click();
  await page.getByRole("button", { name: "Start with Al-Fatihah" }).click();
  await expect(page.locator("[data-reference]")).toBeVisible();
}
test("128-word ayah uses bounded workspaces, progressive hints, and no unapproved segment audio", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  await page.route(
    "**/functions/v1/quran-content",
    (r) => r.fulfill({ json: long }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await open(page);
  await page.locator("[data-reference]").selectOption("2:282");
  await expect(page.locator("[data-studio]")).toContainText("128 words");
  await expect(page.locator(".passage-studio [data-word]")).toHaveCount(10);
  await expect(page.locator("[data-segment] option")).toHaveCount(1);
  await expect(page.locator("[data-segment-audio]")).toHaveCount(0);
  await page.locator("[data-hints]").selectOption("2");
  await expect(page.locator('[data-place="bank"]')).not.toContainText(
    long.words[0].text,
  );
  await page.locator("[data-reveal]").click();
  await expect(page.locator('[data-place="bank"]')).toContainText(
    long.words[0].text,
  );
  await page.locator("[data-next]").click();
  await expect(page.locator(".passage-studio [data-word]")).toHaveCount(4);
  await expect(page.locator("[data-studio]")).toContainText("workspace 2 / 20");
  expect(
    await page.locator(".passage-studio").evaluate((el) =>
      el.scrollWidth <= el.clientWidth + 1
    ),
  ).toBe(true);
  await page.locator("[data-close]").click();
  await open(page);
  await page.locator("[data-reference]").selectOption("2:282");
  await expect(page.locator("[data-studio]")).toContainText("workspace 2 / 20");
});
test("independent full-ayah recall hides Arabic, schedules FSRS, and persists without changing old progress", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await open(page);
  const old = await page.evaluate(() =>
    localStorage.getItem("ayah-learning-v1")
  );
  await page.locator("[data-recall]").click();
  await expect(page.locator("[data-studio] [data-word]")).toHaveCount(0);
  await expect(page.locator("[data-studio]")).not.toContainText("بِسْمِ");
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await expect(page.locator("[data-comparison]")).toContainText("بِسْمِ");
  await page.locator('[data-grade="Good"]').click();
  await expect(page.locator("[data-studio-status]")).toContainText(
    "Independent self-assessment saved",
  );
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1")
  );
  expect(JSON.parse(raw).records["ayah:1:1"].card).not.toBe(null);
  expect(await page.evaluate(() => localStorage.getItem("ayah-learning-v1")))
    .toBe(old);
  await page.reload();
  await open(page);
  await expect(page.locator("[data-studio]")).toContainText("Next review");
});
test("server denial does not render or cache private text; free practice remains available", async ({ page }) => {
  await mockBilling(page, { plan: "free" });
  await page.route(
    "**/functions/v1/quran-content",
    (r) =>
      r.fulfill({
        status: 403,
        json: { error: "Your subscription does not include this juz" },
      }),
  );
  await page.goto("/");
  await open(page);
  await page.locator("[data-reference]").selectOption("2:282");
  await expect(page.locator("[data-studio-status]")).toContainText(
    "does not include",
  );
  await expect(page.locator("[data-studio]")).not.toContainText(
    long.words[0].text,
  );
  await expect(page.locator(".passage-studio [data-word]")).toHaveCount(4);
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((x) => x.includes("تَدَايَنتُم"))
    ),
  ).toBe(false);
});
test("Passage Chain uses chosen ayahs and independent passage recall is a distinct unit", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await open(page);
  await page.locator("[data-reference]").selectOption("1:2");
  await page.locator("[data-add-ref]").click();
  await page.locator("[data-chain]").click();
  await expect(page.locator("[data-chain-cards] [data-chain-move]"))
    .toHaveCount(4);
  await page.locator("[data-passage-recall]").click();
  await expect(page.locator("[data-studio]")).toContainText(
    "Independent passage recall",
  );
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await expect(page.locator("[data-comparison] section")).toHaveCount(2);
  await page.locator('[data-grade="Good"]').click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-passage-recall-v1"))
  );
  expect(Object.values(data.records)[0].unit.type).toBe("passage");
  expect(data.records["ayah:1:1"]).toBeUndefined();
});
