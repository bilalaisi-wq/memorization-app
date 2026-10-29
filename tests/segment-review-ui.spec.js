import {enableDeveloperLab} from "./developer-lab-helper.js";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { menu } from "./menu-helper.js";
import { billingUser, mockBilling } from "./billing-fixtures.js";
import availability from "../supabase/functions/_shared/content-availability.json" with {
  type: "json",
};
const fixtures = Object.fromEntries(
  ["2:255", "2:282"].map(
    (key) => [
      key,
      JSON.parse(
        readFileSync(
          new URL(
            "./fixtures/" + key.replace(":", "-") + ".json",
            import.meta.url,
          ),
        ),
      ),
    ],
  ),
);
for (const night of [false, true]) {
  test(`teacher review separates study/waqf/restart decisions and shows exact symbols (${night ? "night" : "simple"})`, async ({ page }) => {
    await mockBilling(page, { plan: "pathfinder" });
    const calls = [];
    await page.route(
      "**/rest/v1/rpc/my_quran_review_role",
      (r) =>
        r.fulfill({
          json: {
            name: "Review fixture teacher",
            credentials: "TEST QUALIFICATION",
            role: "teacher",
          },
        }),
    );
    await page.route("**/rest/v1/rpc/get_segmentation_review", (r) => {
      const { reference } = r.request().postDataJSON();
      return r.fulfill({
        json: {
          head: {
            revision: 0,
            source_hash: availability.premium.find((p) =>
              p.key === reference
            ).sha256,
          },
          history: [],
        },
      });
    });
    await page.route("**/rest/v1/rpc/submit_segmentation_review", (r) => {
      calls.push(r.request().postDataJSON());
      return r.fulfill({ json: 1 });
    });
    await page.route(
      "**/functions/v1/quran-content",
      (r) => r.fulfill({ json: fixtures[r.request().postDataJSON().key] }),
    );
    if (night) {
      await page.addInitScript((id) =>
        localStorage.setItem(
          `ayah-user:${id}:ayah-appearance-v1`,
          JSON.stringify({
            version: 1,
            theme: "night-sky",
            reduceEffects: true,
            updatedAt: new Date().toISOString(),
          }),
        ), billingUser.id);
    }
    await page.goto("/");
    await enableDeveloperLab(page);
    await menu(page);
    await page.getByRole("button", {
      name: "Teacher segment review",
      exact: true,
    }).click();
    await expect(page.locator("[data-review-row]")).toHaveCount(9);
    await page.locator("[data-review-ref]").selectOption("2:282");
    await expect(page.locator("[data-review-row]")).toHaveCount(19);
    await expect(page.locator(".review-segments")).toContainText(
      "Symbol mismatch",
    );
    await expect(page.locator('[data-field="stopStatus"]').first()).toHaveValue(
      "pending_review",
    );
    const row = page.locator('[data-review-row="0"]');
    await row.locator('[data-field="endWord"]').fill("9");
    await row.locator('[data-field="endWord"]').press("Tab");
    await expect(page.locator('[data-review-row="1"] legend')).toContainText(
      "10–14",
    );
    await page.locator("[data-edition]").fill(
      "Test edition (not a real approval)",
    );
    await row.locator('[data-field="displayStatus"]').selectOption("approved");
    await page.locator("[data-save-review]").click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].segments[0].displayStatus).toBe("approved");
    expect(calls[0].segments[0].stopStatus).toBe("pending_review");
    expect(calls[0].segments[0].endWord).toBe(9);
    expect(calls[0].segments[1].startWord).toBe(10);
    expect(calls[0]).not.toHaveProperty("reviewerId");
  });
}
