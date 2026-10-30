import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mockBilling } from "./billing-fixtures.js";
import {
  RESCUE_TIME,
  seedRescue,
  openRescue,
  gradeRescue,
} from "./rescue-helper.js";
async function setup(page) {
  await mockBilling(page, { signed: false });
  await page.clock.install({ time: new Date(RESCUE_TIME) });
  await page.goto("/");
  return seedRescue(page);
}
async function documentFor(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-passage-recall-v1")),
  );
}

test("map reflects real schedules without mutating them; due route grades and persists through reload", async ({
  page,
}) => {
  const seed = await setup(page);
  await openRescue(page);
  await expect(page.locator("[data-cr-star]")).toHaveCount(3);
  await expect(page.locator(".cr-star.due")).toHaveCount(1);
  await expect(page.locator(".cr-star.overdue")).toHaveCount(1);
  await expect(page.locator(".cr-star.upcoming")).toHaveCount(1);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(seed.raw);
  await page.locator("[data-cr-start]").click();
  await gradeRescue(page, "Good");
  await expect(page.locator(".cr-star.was-reviewed")).toHaveCount(1);
  await expect(page.locator(".cr-review-result")).toContainText(
    "Good self-assessment saved",
  );
  const saved = await documentFor(page),
    due = saved.records["ayah:1:1"].card.due;
  expect(due).not.toBe(seed.snapshot.records["ayah:1:1"].card.due);
  await expect(page.locator("[data-cr-due]")).toContainText("2026");
  expect(saved.records["ayah:1:1"].history).toHaveLength(2);
  await page.getByRole("button", { name: "← Your space", exact: true }).click();
  await page.reload();
  await openRescue(page);
  expect((await documentFor(page)).records["ayah:1:1"].card.due).toBe(due);
  await expect(page.locator(".cr-star.overdue")).toHaveCount(0);
});
for (const grade of ["Again", "Hard"])
  test(`${grade} has a corrective-practice link without inventing additional review history`, async ({
    page,
  }) => {
    await setup(page);
    await openRescue(page);
    await page.locator("[data-cr-review]").click();
    await gradeRescue(page, grade);
    await expect(page.locator("[data-cr-practice]")).toContainText(
      "Corrective practice",
    );
    const saved = await documentFor(page);
    await page.locator("[data-cr-practice]").click();
    await expect(page.locator("[data-reference]")).toHaveValue("1:1");
    expect(await documentFor(page)).toEqual(saved);
  });
test("assisted grading remains due and does not restore a star or complete the guided route", async ({
  page,
}) => {
  const seed = await setup(page);
  await openRescue(page);
  await page.locator("[data-cr-start]").click();
  await gradeRescue(page, "Good", { declare: false });
  await expect(page.locator(".cr-review-result")).toContainText("Assisted");
  await expect(page.locator(".cr-star.overdue")).toHaveCount(1);
  await expect(page.locator(".cr-star.was-reviewed")).toHaveCount(0);
  expect((await documentFor(page)).records["ayah:1:1"].card).toEqual(
    seed.snapshot.records["ayah:1:1"].card,
  );
  await expect(page.locator(".cr-route")).toContainText("0 scheduled reviews");
});
test("empty and corrupt histories do not produce demo stars or get overwritten", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openRescue(page);
  await expect(page.locator("[data-cr-star]")).toHaveCount(0);
  await expect(page.locator(".cr-empty")).toContainText("real recall");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(null);
  await page.getByRole("button", { name: "← Your space", exact: true }).click();
  await page.evaluate(() =>
    localStorage.setItem("ayah-passage-recall-v1", '{"version":99}'),
  );
  await openRescue(page);
  await expect(page.locator(".cr-recovery")).toContainText("recovery");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe('{"version":99}');
});
test("an unfinished assessment resumes without replacement and viewing the map never adds recall attempts", async ({
  page,
}) => {
  await setup(page);
  const id = await page.evaluate(async () => {
    const { createPassageMemory } = await import("/src/passage/memory.js");
    const { recallUnit } = await import("/src/passage/model.js");
    const { localBundle } = await import("/src/content/library.js");
    return createPassageMemory(localStorage).begin(
      await recallUnit([localBundle("1:4")]),
    ).id;
  });
  await openRescue(page);
  await page.locator("[data-cr-review]").click();
  await expect(page.locator("[data-studio]")).toContainText("1:4");
  expect((await documentFor(page)).active.id).toBe(id);
  await page.locator(".passage-studio [data-close]").click();
  expect((await documentFor(page)).active.id).toBe(id);
  await expect(page.locator("[data-cr-star]")).toHaveCount(3);
});
test("private review source denial preserves its schedule and account changes dispose pending source work", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  await mockBilling(page, { plan: "free" });
  await page.clock.install({ time: new Date(RESCUE_TIME) });
  await page.goto("/");
  const seed = await seedRescue(page, {
    keys: ["2:282"],
    ages: [3],
    signed: true,
    privateBundle: fixture,
  });
  await page.route("**/functions/v1/quran-content", (r) =>
    r.fulfill({
      status: 403,
      json: { error: "Private access is unavailable" },
    }),
  );
  await openRescue(page);
  await page.locator("[data-cr-review]").click();
  await expect(page.locator("[data-cr-status]")).toContainText(
    "Private access is unavailable",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "ayah-user:00000000-0000-0000-0000-000000000001:ayah-passage-recall-v1",
      ),
    ),
  ).toBe(seed.raw);
  await expect(page.locator(".passage-studio")).toHaveCount(0);
  await page.evaluate(async () => {
    const { selectProfile } = await import("/src/learner/profile-storage.js");
    selectProfile("another-account");
  });
  await expect(page.locator(".constellation-rescue")).toHaveCount(0);
});
test.describe("mobile rescue", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  test("touch selection, route controls and reduced-motion layout remain readable", async ({
    page,
  }) => {
    await setup(page);
    await openRescue(page);
    await page.locator('[data-cr-star="ayah:1:2"]').tap();
    await expect(page.locator(".cr-refs")).toHaveText("1:2");
    expect(
      await page
        .locator(".constellation-rescue")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await page
        .locator(".constellation-rescue")
        .getAttribute("data-motion-off"),
    ).toBe("true");
    await page.locator('[data-cr-star="ayah:1:2"]').focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-cr-star="ayah:1:3"]')).toBeFocused();
  });
});

test("switching Rescue, Expedition and Classic restores focus and never leaves the page inert", async ({
  page,
}) => {
  await setup(page);
  await openRescue(page);
  await page.locator(".cr-bottom [data-cr-expedition]").click();
  await expect(page.locator(".passage-expedition")).toBeVisible();
  await expect(page.locator(".constellation-rescue")).toHaveCount(0);
  await page.locator("[data-ex-classic]").click();
  await page.locator("[data-open-rescue]").click();
  await expect(page.locator(".constellation-rescue")).toBeVisible();
  await expect(page.locator(".passage-expedition")).toHaveCount(0);
  await expect(page.locator(".passage-studio")).toHaveCount(0);
  await page.getByRole("button", { name: "← Your space", exact: true }).click();
  expect(
    await page
      .locator("body")
      .evaluate((b) =>
        [...b.children]
          .filter((el) => el.tagName !== "SCRIPT")
          .every((el) => !el.inert),
      ),
  ).toBe(true);
});

test("large maps paginate metadata without adding records or changing saved dates", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.clock.install({ time: new Date(RESCUE_TIME) });
  await page.goto("/");
  const keys = await page.evaluate(async () => {
    const { surahs } = await import("/src/data.js");
    return surahs
      .flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`))
      .slice(0, 30);
  });
  const seed = await seedRescue(page, { keys });
  await openRescue(page);
  await expect(page.locator("[data-cr-star]")).toHaveCount(24);
  await page.locator("[data-cr-next]").click();
  await expect(page.locator("[data-cr-star]")).toHaveCount(6);
  await page.locator("[data-cr-prev]").click();
  await expect(page.locator("[data-cr-star]")).toHaveCount(24);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(seed.raw);
});

test("an authorized response arriving after an account switch cannot open a private assessment", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  await mockBilling(page, { plan: "pathfinder" });
  await page.clock.install({ time: new Date(RESCUE_TIME) });
  await page.goto("/");
  const seed = await seedRescue(page, {
    keys: ["2:282"],
    ages: [3],
    signed: true,
    privateBundle: fixture,
  });
  let release,
    started = false;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/functions/v1/quran-content", async (r) => {
    started = true;
    await gate;
    await r.fulfill({ json: fixture });
  });
  await openRescue(page);
  await page.locator("[data-cr-review]").click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(async () => {
    const { selectProfile } = await import("/src/learner/profile-storage.js");
    selectProfile("other-profile");
  });
  const response = page.waitForResponse((r) =>
    r.url().includes("/quran-content"),
  );
  release();
  await response;
  await expect(
    page.locator(".constellation-rescue,.passage-studio"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "ayah-user:00000000-0000-0000-0000-000000000001:ayah-passage-recall-v1",
      ),
    ),
  ).toBe(seed.raw);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ayah-user:other-profile:ayah-passage-recall-v1"),
    ),
  ).toBe(null);
});
