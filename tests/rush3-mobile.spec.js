import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mountRush, driveRush } from "./rush3-ui-helper.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
test("DPR2 two-thumb input holds movement while jumping and disposes media/frames on account change", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  try {
    await mountRush(page);
    const field = page.locator(".flow-battlefield"),
      right = await page.locator('[data-flow-move="1"]').boundingBox(),
      jump = await page.locator("[data-flow-control=jump]").boundingBox(),
      cdp = await context.newCDPSession(page),
      point = (r, id) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2, id });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(right, 1)],
    });
    await page.evaluate(() => {
      for (let n = 0; n < 25; n++) {
        window.rushClock += 1000 / 60;
        for (const [id, fn] of [...window.rushFrames]) {
          window.rushFrames.delete(id);
          fn(window.rushClock);
        }
      }
    });
    expect(
      (await page.evaluate(() => window.rushActivity.getSnapshot())).engine.x
    ).toBeGreaterThan(60);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(right, 1), point(jump, 2)],
    });
    await page.evaluate(() => {
      for (let n = 0; n < 5; n++) {
        window.rushClock += 1000 / 60;
        for (const [id, fn] of [...window.rushFrames]) {
          window.rushFrames.delete(id);
          fn(window.rushClock);
        }
      }
    });
    expect(
      (await page.evaluate(() => window.rushActivity.getSnapshot())).engine.vy
    ).toBeLessThan(0);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.evaluate(() =>
      window.dispatchEvent(new Event("ayahprofilechange"))
    );
    await expect(field).toHaveCount(0);
    expect(await page.evaluate(() => window.rushFrames.size)).toBe(0);
  } finally {
    await context.close();
  }
});
test("source-validated long pilot uses bounded readable physical choices at 375px without inventing phrase audio or grading FSRS", async ({
  page,
}) => {
  test.setTimeout(180000);
  const bundle = JSON.parse(
      readFileSync(new URL("./fixtures/2-282.json", import.meta.url))
    ),
    units = revisionUnits(bundle);
  await page.route("https://rush-source.test/**", (r) =>
    r.fulfill({ json: bundle })
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await mountRush(page, { refs: ["2:282"], client: true });
  await page.locator("[data-game-command=expand]").click();
  await expect(
    page.locator(".rush-route-sign .arabic").filter({ hasText: units[0].text })
  ).toBeVisible();
  for (const el of await page.locator(".rush-route-sign .arabic").all()) {
    expect(await el.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(
      true
    );
    expect(
      parseFloat(await el.evaluate((e) => getComputedStyle(e).fontSize))
    ).toBeGreaterThanOrEqual(24);
  }
  await driveRush(page, {
    goal: 1,
    maxFrames: 35000,
    units: { "2:282": units.map((u) => ({ id: u.id, text: u.text })) },
  });
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
});
test("authorized 2:255 pilot supports expert physical recognition without claiming independent spoken recall", async ({
  page,
}) => {
  test.setTimeout(180000);
  const bundle = JSON.parse(
      readFileSync(new URL("./fixtures/2-255.json", import.meta.url))
    ),
    units = revisionUnits(bundle, "expert");
  await page.route("https://rush-source.test/**", (r) =>
    r.fulfill({ json: bundle })
  );
  await mountRush(page, { refs: ["2:255"], memory: "expert", client: true });
  await expect(page.locator("[data-flow-ready]")).toBeVisible();
  await driveRush(page, {
    goal: 1,
    maxFrames: 30000,
    units: { "2:255": units.map((u) => ({ id: u.id, text: u.text })) },
  });
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
});
