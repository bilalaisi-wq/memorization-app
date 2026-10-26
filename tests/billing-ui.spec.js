import { expect, test } from "@playwright/test";
import { menu } from "./menu-helper.js";
import { mockBilling } from "./billing-fixtures.js";
const open = async (page, name) => {
  await menu(page);
  await page.getByRole("button", { name, exact: true }).click();
};
test("responsive pricing shows exact amounts, annual billing, honest content availability and disabled Guardian", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await open(page, "Plans & pricing");
  await expect(page.locator(".pricing-card")).toHaveCount(4);
  await expect(page.locator(".pricing-card").nth(1)).toContainText("$3.99");
  await expect(page.locator(".pricing-card").nth(2)).toContainText("$6.99");
  await page.getByRole("button", { name: "Annual", exact: true }).click();
  await expect(page.locator(".pricing-card").nth(1)).toContainText("$35.99");
  await expect(page.locator(".pricing-card").nth(2)).toContainText("$59.99");
  await expect(page.locator(".pricing-card").nth(3)).toContainText("$99.99");
  await expect(page.locator('[data-plan="guardian"]')).toBeDisabled();
  await expect(page.locator(".billing-library-note")).toContainText(
    "Juz 29 (11 surahs, 431 ayahs) is prepared",
  );
  expect(
    await page.locator(".pricing-dialog").evaluate((el) =>
      el.scrollWidth <= el.clientWidth + 1
    ),
  ).toBe(true);
  await page.locator('[data-plan="explorer"]').click();
  await expect(page.locator(".account-dialog h2")).toHaveText(
    "Sign in to Ayah",
  );
});
test("checkout failures are retryable and only a plan/cadence goes to the authenticated endpoint", async ({ page }) => {
  const state = await mockBilling(page);
  await page.goto("/");
  await open(page, "Plans & pricing");
  state.failCheckout = true;
  await page.locator('[data-plan="explorer"]').click();
  await expect(page.locator("[data-billing-status]")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.locator('[data-plan="explorer"]')).toBeEnabled();
  expect(state.calls.find((c) => c.path.endsWith("billing-checkout")).body)
    .toEqual({ plan: "explorer", cadence: "monthly" });
  state.failCheckout = false;
  await page.route(
    "https://checkout.stripe.com/**",
    (r) => r.fulfill({ body: "Stripe-hosted test checkout" }),
  );
  await page.locator('[data-plan="explorer"]').click();
  await expect(page).toHaveURL(
    "https://checkout.stripe.com/c/pay/test_fixture",
  );
});
test("billing cancellation/expiry preserve free access, ignore forged local plans and never grant from return URL", async ({ page }) => {
  const state = await mockBilling(page, { plan: "explorer", cancel: true });
  await page.goto("/?billing=success");
  await expect(page.locator("[data-billing-return]")).toContainText(
    "only after payment is confirmed",
  );
  await open(page, "Subscription & billing");
  await expect(page.locator(".billing-summary")).toContainText(
    "Cancellation scheduled",
  );
  await expect(page.locator(".billing-summary")).toContainText("2099");
  const progress = await page.evaluate(() =>
    localStorage.getItem(
      "ayah-user:00000000-0000-0000-0000-000000000001:ayah-learning-v1",
    )
  );
  state.ent = {
    ...state.ent,
    plan: "free",
    features: { ...state.ent.features, passageBuilder: false },
    accessUntil: null,
  };
  await page.getByRole("button", { name: "Refresh billing status" }).click();
  await expect(page.locator(".billing-summary h3")).toHaveText("Free");
  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    localStorage.setItem(
      "subscription",
      JSON.stringify({ plan: "guardian", active: true }),
    )
  );
  await page.reload();
  await open(page, "Passage Builder");
  await expect(page.locator(".billing-dialog")).toContainText(
    "required to save new passages",
  );
  await expect(page.locator("[data-passage-form]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "ayah-user:00000000-0000-0000-0000-000000000001:ayah-learning-v1",
      )
    ),
  ).toBe(progress);
  await expect(page.locator(".reference-card")).toBeVisible();
  await page.locator("#build-all").click();
  await expect(page.locator(".build-zone .piece")).toHaveCount(4);
});
test("Explorer saves five choices and builds a named passage through existing free chain mechanics", async ({ page }) => {
  await mockBilling(page, { plan: "explorer" });
  await page.goto("/");
  await open(page, "Subscription & billing");
  for (const value of [1, 2, 3, 4, 5]) {
    await page.locator(`.juz-choices input[value="${value}"]`).check();
  }
  await page.getByRole("button", { name: "Save my five choices" }).click();
  await expect(page.locator("[data-billing-status]")).toContainText("saved");
  await page.keyboard.press("Escape");
  await open(page, "Passage Builder");
  await page.locator('[name="title"]').fill("My Fatiha passage");
  await page.locator('[name="first"]').fill("3");
  await page.locator('[name="last"]').fill("5");
  await page.getByRole("button", { name: "Save passage", exact: true }).click();
  await expect(page.locator(".saved-passages")).toContainText(
    "My Fatiha passage",
  );
  await page.getByRole("button", { name: "Practice passage", exact: true })
    .click();
  await expect(page.locator(".chain-choices input:checked")).toHaveCount(3);
  expect(
    await page.locator(".chain-choices input:checked").evaluateAll((els) =>
      els.map((el) => Number(el.dataset.chainChoice))
    ),
  ).toEqual([3, 4, 5]);
  await page.locator("#chain-start").click();
  await expect(page.locator(".chain-puzzles .piece")).not.toHaveCount(0);
});
test("Pathfinder analytics respect Night Sky and never change memory schedules", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  await page.addInitScript(() =>
    localStorage.setItem(
      "ayah-user:00000000-0000-0000-0000-000000000001:ayah-appearance-v1",
      JSON.stringify({
        version: 1,
        theme: "night-sky",
        reduceEffects: true,
        updatedAt: new Date().toISOString(),
      }),
    )
  );
  await page.goto("/");
  await expect(page.locator(".reference-card")).toBeVisible();
  const before = await page.evaluate(() =>
    localStorage.getItem(
      "ayah-user:00000000-0000-0000-0000-000000000001:ayah-learning-v1",
    )
  );
  await open(page, "Advanced revision & analytics");
  await expect(page.locator(".billing-metrics")).toBeVisible();
  await expect(page.locator(".revision-week p")).toHaveCount(7);
  await expect(page.locator(".billing-dialog")).toContainText(
    "AI assistance is disabled",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "ayah-user:00000000-0000-0000-0000-000000000001:ayah-learning-v1",
      )
    ),
  ).toBe(before);
});
