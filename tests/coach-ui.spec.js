import {enableDeveloperLab} from "./developer-lab-helper.js";
import { expect, test } from "@playwright/test";
import { menu } from "./menu-helper.js";
import { billingUser, mockBilling } from "./billing-fixtures.js";
const open = async (page) => {
  await enableDeveloperLab(page);
  await menu(page);
  await page.getByRole("button", { name: "Hifz Coach", exact: true }).click();
  await expect(page.locator("[data-coach]")).toBeVisible();
};
test("Coach fits beginner time, persists edits, displays a weekly plan and safely falls back when AI is unavailable", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  let calls = 0;
  await page.route("**/functions/v1/hifz-coach", (r) => {
    calls++;
    return r.fulfill({
      status: 503,
      json: { error: "AI is unavailable. Use your local plan." },
    });
  });
  await page.goto("/");
  await open(page);
  await expect(page.locator("[data-coach]")).toContainText(
    "0 recorded retained units",
  );
  await expect(page.locator(".coach-week article")).toHaveCount(7);
  await page.locator("[data-minutes]").fill("5");
  await page.locator("[data-days]").fill("3");
  await page.getByRole("button", { name: "Update my plan", exact: true })
    .click();
  await expect(page.locator("[data-coach-status]")).toContainText(
    "FSRS dates and existing goals are unchanged",
  );
  const before = await page.evaluate(
    (id) => localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`),
    billingUser.id,
  );
  await page.getByText("Optional AI planning · adult pilot", { exact: true })
    .click();
  await page.locator("[data-ai-plan]").click();
  expect(calls).toBe(0);
  await page.locator("[data-coach-consent]").check();
  await page.locator("[data-ai-plan]").click();
  await expect(page.locator("[data-coach-status]")).toContainText(
    "AI is unavailable",
  );
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`),
      billingUser.id,
    ),
  ).toBe(before);
  await page.locator("[data-close]").click();
  await page.reload();
  await open(page);
  await expect(page.locator("[data-minutes]")).toHaveValue("5");
  await expect(page.locator("[data-days]")).toHaveValue("3");
});
test("AI suggestions are labeled separately, use only minimized aggregates, and changing the plan discards them", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  await page.route("**/functions/v1/hifz-coach", (r) => {
    const b = r.request().postDataJSON();
    expect(Object.keys(b).sort()).toEqual(["consent", "summary"]);
    expect(b.summary).not.toHaveProperty("records");
    expect(JSON.stringify(b)).not.toContain(billingUser.id);
    return r.fulfill({
      json: {
        advice: {
          focus: "weak",
          newCap: 0,
          goalAdvice: "reduce",
          breakStyle: "spaced",
        },
        metadata: { model: "gpt-4o-mini-fixture" },
        cached: true,
        usage: { used: 1, allowance: 20 },
      },
    });
  });
  await page.goto("/");
  await open(page);
  await page.getByText("Optional AI planning · adult pilot", { exact: true })
    .click();
  await page.locator("[data-coach-consent]").check();
  await page.locator("[data-ai-plan]").click();
  await expect(page.locator(".coach-source")).toContainText("AI-selected");
  await expect(page.locator(".coach-source")).toContainText("cached");
  await page.locator("[data-minutes]").fill("15");
  await page.getByRole("button", { name: "Update my plan", exact: true })
    .click();
  await expect(page.locator(".coach-source")).toContainText("Rules-based");
});

test("A due passage recommendation opens the correct existing recall unit without changing its FSRS date", async ({ page }) => {
  const { recallUnit } = await import("../src/passage/model.js");
  const unit = await recallUnit([{ key: "1:1" }, { key: "1:2" }]);
  const due = "2026-01-01T10:00:00Z";
  await mockBilling(page, { plan: "pathfinder" });
  await page.addInitScript(
    ({ id, unit, due }) =>
      localStorage.setItem(
        `ayah-user:${id}:ayah-passage-recall-v1`,
        JSON.stringify({
          version: 1,
          timeZone: "UTC",
          records: {
            [unit.id]: {
              unit,
              card: { state: 2, stability: 5, difficulty: 5, due },
              history: [],
              successfulDays: [],
            },
          },
          active: null,
        }),
      ),
    { id: billingUser.id, unit, due },
  );
  await page.goto("/");
  await open(page);
  await page.locator('[data-start="0"]').click();
  await expect(page.locator("[data-studio]")).toContainText(
    "Independent passage recall",
  );
  await expect(page.locator("[data-studio]")).toContainText("1:1, 1:2");
  const saved = await page.evaluate(
    (id) =>
      JSON.parse(
        localStorage.getItem(`ayah-user:${id}:ayah-passage-recall-v1`),
      ),
    billingUser.id,
  );
  expect(saved.records[unit.id].card.due).toBe(due);
  expect(saved.active.unitId).toBe(unit.id);
});

test("Deleting coach data cancels pending suggestions and retains learning and quota state", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  let deleted = 0;
  await page.route("**/rest/v1/rpc/delete_my_hifz_coach_cache", (r) => {
    deleted++;
    return r.fulfill({ json: null });
  });
  await page.goto("/");
  await open(page);
  await page.locator("[data-minutes]").fill("20");
  await page.getByRole("button", { name: "Update my plan", exact: true })
    .click();
  const before = await page.evaluate(
    (id) => localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`),
    billingUser.id,
  );
  await page.locator("[data-delete-coach]").click();
  await expect(page.locator("[data-coach-status]")).toContainText(
    "Usage counters and learning records remain",
  );
  expect(deleted).toBe(1);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`ayah-user:${id}:ayah-coach-settings-v1`),
      billingUser.id,
    ),
  ).toBe(null);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`),
      billingUser.id,
    ),
  ).toBe(before);
});
