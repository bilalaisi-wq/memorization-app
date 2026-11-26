import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { mountRush, driveRush } from "./rush3-ui-helper.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
test("a delayed private access check cannot compare its old source with a newly loaded ayah; real current denial still disposes", async ({
  page,
}) => {
  test.setTimeout(180000);
  test.skip(
    !existsSync(".quran-private/7/2/bundle.json"),
    "Exact local operator sources required"
  );
  const one = JSON.parse(readFileSync(".quran-private/7/1/bundle.json")),
    two = JSON.parse(readFileSync(".quran-private/7/2/bundle.json"));
  let hold = false,
    held = null,
    deny = false;
  await page.route("https://rush-source.test/**", async (r) => {
    const key = new URL(r.request().url()).searchParams.get("key");
    if (hold && key === "7:1") {
      hold = false;
      held = r;
      return;
    }
    if (deny && key === "7:2")
      return r.fulfill({ status: 403, json: { error: "Forbidden" } });
    return r.fulfill({ json: key === "7:1" ? one : two });
  });
  await mountRush(page, { refs: ["7:1", "7:2"], client: true });
  hold = true;
  await page.evaluate(() => {
    window.pendingAccessCheck = window.rushActivity.revalidateAccess();
  });
  await expect.poll(() => !!held).toBe(true);
  await driveRush(page, {
    goal: 1,
    units: { "7:1": revisionUnits(one), "7:2": revisionUnits(two) },
  });
  await expect(page.locator(".flow-ribbon")).toContainText("7:2");
  await held.fulfill({ json: one });
  await page.evaluate(async () => await window.pendingAccessCheck);
  await expect(page.locator(".flow-battlefield")).toBeVisible();
  expect(
    (await page.evaluate(() => window.rushActivity.getSnapshot())).engine.status
  ).not.toBe("disposed");
  const before = await page.evaluate(() =>
    localStorage.getItem("ayah-flow-adventures-v1")
  );
  deny = true;
  await page.evaluate(async () => await window.rushActivity.revalidateAccess());
  await expect(page.locator(".flow-battlefield")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-flow-adventures-v1"))
  ).toBe(before);
});
