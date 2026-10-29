import { expect, test } from "@playwright/test";
import { menu } from "./menu-helper.js";
import { billingUser, mockBilling } from "./billing-fixtures.js";
const records = async (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-rewards-v1"))?.events || []
  );
test("Practice, Puzzle Quest, recall and Lab participation earn visible XP without granting memory mastery", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await page.locator(".word-bank .piece").first().click();
  expect((await records(page)).some((e) => e.mode === "practice")).toBe(true);
  await expect(page.locator("[data-learning-xp]")).toContainText("1 XP");
  await page.getByRole("tab", { name: "Puzzle quest", exact: true }).click();
  await page.locator(".word-bank .piece").first().click();
  expect((await records(page)).some((e) => e.mode === "quest")).toBe(true);
  await page.getByRole("tab", { name: "Active recall", exact: true }).click();
  await page.locator(".word-bank .piece").first().click();
  expect((await records(page)).some((e) => e.mode === "recall-puzzle")).toBe(
    true,
  );
  await (await menu(page)).locator("#nav-lab").click();
  await page.locator(
    ".lab-game [data-choice],.lab-game [data-token],.lab-game button",
  ).first().click();
  expect((await records(page)).some((e) => e.mode === "lab")).toBe(true);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-learning-v1"))
  );
  expect(
    Object.values(state.records).some((r) => r.memory.independentAttempts > 0),
  ).toBe(false);
});
test("Opted-in accounts automatically send all-mode receipts and opening leaderboard refreshes them", async ({ page }) => {
  await mockBilling(page, { plan: "free" });
  const batches = [];
  await page.route(
    "**/rest/v1/leaderboard_preferences?*",
    (r) => r.fulfill({ json: { enabled: true, alias: "Cedar42" } }),
  );
  await page.route(
    "**/rest/v1/rpc/my_nature_profile",
    (r) =>
      r.fulfill({
        json: {
          owned: ["sprout", "garden"],
          creature: "sprout",
          scene: "garden",
          balance: 0,
          lifetimeXp: 0,
          lifetimeStars: 0,
        },
      }),
  );
  await page.route("**/rest/v1/rpc/sync_learning_rewards", (r) => {
    batches.push(r.request().postDataJSON());
    return r.fulfill({
      json: {
        owned: ["sprout", "garden"],
        creature: "sprout",
        scene: "garden",
        balance: 1,
        lifetimeXp: 1,
        lifetimeStars: 0,
      },
    });
  });
  await page.route(
    "**/rest/v1/rpc/get_weekly_leaderboard",
    (r) =>
      r.fulfill({
        json: [{
          alias: "Cedar42",
          xp: 1,
          stars: 0,
          recalls: 0,
          avatar: { creature: "sprout", scene: "garden" },
        }],
      }),
  );
  await page.goto("/");
  await page.locator(".word-bank .piece").first().click();
  await expect.poll(() =>
    batches.some((b) => b.events.some((e) => e.mode === "practice"))
  ).toBe(true);
  await menu(page);
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(page.locator(".podium-1")).toContainText("Cedar42");
  await expect(page.locator(".rank-companion")).toHaveCount(1);
  expect(JSON.stringify(batches)).not.toContain("1:1");
  expect(JSON.stringify(batches)).not.toContain("بِسْمِ");
});
test("Guest shop purchases persist without reducing XP, and photo input is safely resized and removable", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.addInitScript(() =>
    localStorage.setItem(
      "ayah-quiz",
      JSON.stringify({ xp: 250, stars: 10, streak: 0 }),
    )
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await menu(page);
  await page.getByRole("button", { name: "My companion & shop", exact: true })
    .click();
  await expect(page.locator(".seed-balance")).toContainText("300");
  await page.locator('[data-shop-item="fox"]').click();
  await expect(page.locator(".seed-balance")).toContainText("180");
  await expect(page.locator('[data-shop-item="fox"]')).toHaveText("Equipped");
  const xp = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet.xp
  );
  expect(xp).toBe(250);
  await page.locator('[data-shop-item="scarf-lilac"]').click();
  await expect(page.locator(".seed-balance")).toContainText("145");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 10;
    c.getContext("2d").fillRect(0, 0, 10, 10);
    return c.toDataURL().split(",")[1];
  });
  await expect(page.locator('.nature-shop [data-photo]')).toHaveCount(0);
  await page.locator('.nature-shop [data-close]').click();await menu(page);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator("[data-photo]").setInputFiles({
    name: "garden.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.locator(".profile-photo")).toBeVisible();
  await expect(page.locator(".profile-photo")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
  await page.locator("[data-remove-photo]").click();
  await expect(page.locator(".profile-photo")).toHaveCount(0);
  expect(
    await page.locator(".account-dialog").evaluate((e) =>
      e.scrollWidth <= e.clientWidth + 1
    ),
  ).toBe(true);
  await page.locator("[data-close]").click();
  await page.reload();
  await menu(page);
  await page.getByRole("button", { name: "My companion & shop", exact: true })
    .click();
  await expect(page.locator('[data-shop-item="fox"]')).toHaveText("Equipped");
  await expect(page.locator(".seed-balance")).toContainText("145");
});

test("Account shop uses server inventory and displayed prices, keeps photos private and restores customization", async ({ page }) => {
  const { items } = await import("../src/rewards/catalog.js");
  await mockBilling(page, { plan: "free" });
  let p = {
      owned: ["sprout", "garden"],
      creature: "sprout",
      outfit: null,
      scene: "garden",
      photo: null,
      balance: 200,
      lifetimeXp: 200,
      lifetimeStars: 0,
    },
    purchases = 0;
  await page.route(
    "**/rest/v1/rpc/my_nature_profile",
    (r) => r.fulfill({ json: p }),
  );
  await page.route(
    "**/rest/v1/avatar_catalog?*",
    (r) => r.fulfill({ json: items.map((i) => ({ ...i, active: true })) }),
  );
  await page.route("**/rest/v1/rpc/buy_nature_item", (r) => {
    const b = r.request().postDataJSON();
    expect(b.expected_price).toBe(80);
    p = { ...p, owned: [...p.owned, b.item_id], balance: p.balance - 80 };
    purchases++;
    return r.fulfill({ json: p });
  });
  await page.route("**/rest/v1/rpc/equip_nature_item", (r) => {
    p = { ...p, creature: r.request().postDataJSON().item_id };
    return r.fulfill({ json: p });
  });
  await page.goto("/");
  await menu(page);
  await page.getByRole("button", { name: "My companion & shop", exact: true })
    .click();
  await page.locator('[data-shop-item="owl"]').click();
  await expect(page.locator(".seed-balance")).toContainText("120");
  await expect(page.locator('[data-shop-item="owl"]')).toHaveText("Equipped");
  expect(purchases).toBe(1);
  await page.locator("[data-close]").click();
  await page.reload();
  await menu(page);
  await page.getByRole("button", { name: "My companion & shop", exact: true })
    .click();
  await expect(page.locator('[data-shop-item="owl"]')).toHaveText("Equipped");
  await expect(page.locator('[data-shop-item="owl"]')).toBeDisabled();
});
