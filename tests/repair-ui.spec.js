import { test, expect } from "@playwright/test";
import { seedRescue, gradeRescue } from "./rescue-helper.js";
import { enableDeveloperLab } from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
import { surahs } from "../src/data.js";
import { readFileSync } from "node:fs";
import { mockBilling } from "./billing-fixtures.js";
test.use({ hasTouch: true });
async function seed(page) {
  await page.evaluate(async () => {
    const { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js"),
      { surahs } = await import("/src/data.js");
    createPuzzleStore(localStorage, surahs).record({
      key: "1:1",
      sessionId: "repair-fixture",
      game: "asteroids",
      mistakes: 1,
      hinted: false,
      xp: 0,
      arcade: {
        mistakes: [
          {
            key: "1:1",
            kind: "sequence",
            category: "word-selection",
            expected: ["1:1:0"],
            selected: ["112:1:0"],
            event: 1,
          },
        ],
        motorErrors: [{ key: "1:1", event: 2 }],
        assistance: [],
      },
    });
  });
}
async function open(page) {
  await enableDeveloperLab(page);
  await menu(page);
  await page
    .getByRole("button", { name: "Memory Repair Workshop", exact: true })
    .click();
  await expect(page.locator(".memory-repair")).toBeVisible();
}
async function detail(page) {
  await page
    .locator("[data-repair-node]")
    .filter({ hasText: "Word selection" })
    .click();
}
async function solveSpace(page) {
  const assist = page.locator("[data-action=assist]");
  if ((await assist.getAttribute("aria-pressed")) === "false")
    await assist.click();
  for (const w of surahs[0].verses[0].words) {
    const object = page
      .locator(".astro-rock:not(.astro-redirected)")
      .filter({ has: page.locator(".arabic", { hasText: w }) })
      .first();
    await object.click({ force: true });
    await expect(object).toHaveClass(/astro-locked/, { timeout: 15000 });
    await page.locator(".astro-stage").focus();
    await page.keyboard.press("Space");
  }
}
test("workshop shows actual evidence, keeps motor events separate, and reload does not change records", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page);
  await seedRescue(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  await open(page);
  await expect(page.locator(".repair-stats")).toContainText("1 motor events");
  await detail(page);
  await expect(page.locator(".repair-detail")).toContainText("observed-arcade");
  await expect(page.locator(".repair-detail")).toContainText("112:1:0");
  await expect(page.locator(".repair-detail")).not.toContainText(
    "motor-control",
  );
  await page.locator("[data-repair-close]").click();
  await page.reload();
  await open(page);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(before);
  await expect(page.locator("[data-repair-node]")).toHaveCount(1);
});
test("real arcade mission saves a bounded result and offers fresh native recall without auto-scheduling", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await seed(page);
  await seedRescue(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  await open(page);
  await detail(page);
  await page.locator("[data-repair-launch]").click();
  await expect(page.locator(".astro-stage")).toBeVisible();
  await solveSpace(page);
  await expect(page.locator(".repair-summary")).toContainText(
    "Connection practised",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(before);
  await expect(page.locator(".repair-summary")).toContainText(
    "FSRS schedule has not changed",
  );
  await expect(page.locator(".repair-summary")).toContainText("Replays do not add");
  const wallet = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet,
  );
  await page.locator("[data-repair-again]").click();
  await expect(page.locator(".astro-stage")).toBeVisible();
  await solveSpace(page);
  await expect(page.locator(".repair-summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet,
    ),
  ).toEqual(wallet);
  await page.locator("[data-repair-new-recall]").click();
  await expect(page.locator("[data-declare]")).toBeVisible();
  await gradeRescue(page, "Again");
  await expect(page.locator(".memory-repair")).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-passage-recall-v1")),
  );
  expect(after.records["ayah:1:1"].history.at(-1).grade).toBe("Again");
});
test("empty and corrupt saved records remain recoverable and workshop closes cleanly", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await expect(page.locator(".memory-repair")).toContainText(
    "No recorded repair evidence",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".memory-repair")).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem("ayah-puzzle-lab-v1", '{"future":7}'),
  );
  await open(page);
  await expect(page.locator(".memory-repair [role=alert]")).toContainText(
    "not been overwritten",
  );
  await page.locator("[data-repair-close]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-puzzle-lab-v1")),
  ).toBe('{"future":7}');
  expect(await page.locator("#app").evaluate((el) => el.inert)).toBe(false);
});
test("account change and workshop navigation dispose active arcade and remove its listeners", async ({
  page,
}) => {
  await page.goto("/");
  await seed(page);
  await open(page);
  await detail(page);
  await page.locator("[data-repair-launch]").click();
  await expect(page.locator(".astro-stage")).toBeVisible();
  await page.locator("[data-repair-back]").click();
  await expect(page.locator(".astro-stage")).toHaveCount(0);
  await detail(page);
  await page.locator("[data-repair-launch]").click();
  await expect(page.locator(".astro-stage")).toBeVisible();
  await page.evaluate(async () => {
    (await import("/src/learner/profile-storage.js")).selectProfile(
      "other-account",
    );
  });
  await expect(page.locator(".memory-repair")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ayah-user:other-account:ayah-puzzle-lab-v1"),
    ),
  ).toBeNull();
});
test("mobile touch and reduced-motion workshop is readable without horizontal overflow and keyboard focus stays accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await seed(page);
  await open(page);
  const bounds = await page.locator(".memory-repair").evaluate((el) => {
    const h = el.querySelector("header").getBoundingClientRect(),
      n = el.querySelector("nav").getBoundingClientRect();
    return { headerBottom: h.bottom, navTop: n.top };
  });
  expect(bounds.navTop).toBeGreaterThanOrEqual(bounds.headerBottom);
  await page.locator("[data-repair-node]").first().tap();
  await expect(page.locator(".repair-detail")).toBeVisible();
  expect(
    await page
      .locator(".memory-repair")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.locator("[data-repair-launch]").tap();
  await expect(page.locator(".astro-stage")).toBeVisible();
  await expect(page.locator(".astro-controls")).toBeVisible();
  await page.locator("[data-repair-back]").tap();
  await page.locator("[data-repair-close]").focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      document.querySelector(".memory-repair").contains(document.activeElement),
    ),
  ).toBe(true);
});
test("private-content denial and late responses after closing preserve history and cannot mount an activity", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  await mockBilling(page, { plan: "free" });
  await page.goto("/");
  const seeded = await seedRescue(page, {
    keys: ["2:282"],
    signed: true,
    privateBundle: fixture,
  });
  await page.evaluate(async () => {
    const { profileStorage } = await import("/src/learner/profile-storage.js");
    const d = JSON.parse(profileStorage.getItem("ayah-passage-recall-v1"));
    const r = d.records["ayah:2:282"];
    r.history.at(-1).grade = "Hard";
    profileStorage.setItem("ayah-passage-recall-v1", JSON.stringify(d));
  });
  const raw = await page.evaluate(async () =>
    (await import("/src/learner/profile-storage.js")).profileStorage.getItem(
      "ayah-passage-recall-v1",
    ),
  );
  await page.route("**/functions/v1/quran-content", (r) =>
    r.fulfill({ status: 403, json: { error: "Private access unavailable" } }),
  );
  await open(page);
  await page.locator("[data-repair-node]").first().click();
  await page.locator("[data-repair-launch]").click();
  await expect(page.locator("[data-repair-status]")).toContainText(
    "Private access unavailable",
  );
  await expect(page.locator("[data-repair-game]")).toHaveCount(0);
  expect(
    await page.evaluate(async () =>
      (await import("/src/learner/profile-storage.js")).profileStorage.getItem(
        "ayah-passage-recall-v1",
      ),
    ),
  ).toBe(raw);
  await page.unroute("**/functions/v1/quran-content");
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/functions/v1/quran-content", async (r) => {
    await gate;
    await r.fulfill({ json: fixture });
  });
  await page.locator("[data-repair-launch]").click();
  await page.locator("[data-repair-close]").click();
  release();
  await page.waitForTimeout(150);
  await expect(page.locator(".memory-repair")).toHaveCount(0);
  await expect(page.locator(".astro-stage")).toHaveCount(0);
});
test("unsupported arcade falls back to bounded verified practice; replay cannot farm rewards or touch FSRS", async ({
  page,
}) => {
  await page.goto("/");
  await seedRescue(page);
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  async function launch() {
    await page.evaluate(async () => {
      const { prepareRepairMission, launchRepairMission } =
          await import("/src/quest/repair/mission.js"),
        { createRegistry } = await import("/src/puzzles/arcade/registry.js"),
        { createLearningStore } = await import("/src/learning-store.js"),
        { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js"),
        { surahs } = await import("/src/data.js");
      const root = document.createElement("div");
      root.id = "repair-fallback";
      root.style.cssText =
        "position:fixed;inset:0;z-index:9000;overflow:auto;background:#183743;color:white;padding:20px";
      document.body.prepend(root);
      const prepared = await prepareRepairMission({
        recommendation: {
          id: "1:1|word-order",
          key: "1:1",
          game: "sirat",
          evidence: [{ id: "real-receipt" }],
        },
        registry: createRegistry(),
      });
      window.repairFallback = await launchRepairMission({
        prepared,
        root,
        storage: localStorage,
        learning: createLearningStore(localStorage, surahs),
        lab: createPuzzleStore(localStorage, surahs),
        owner: null,
        getOwner: () => null,
        onComplete: (r) => {
          window.repairResult = r;
          root.remove();
        },
      });
    });
  }
  async function fill() {
    for (let n = 1; n <= surahs[0].verses[0].words.length; n++)
      await page
        .locator(`#repair-fallback [data-quest-bank] [data-quest-word="${n}"]`)
        .click();
    await page.locator("#repair-fallback [data-quest-check]").click();
    await expect(page.locator("#repair-fallback")).toHaveCount(0);
  }
  await launch();
  await expect(page.locator("#repair-fallback")).toContainText(
    "not an approved recitation stop",
  );
  await fill();
  const first = await page.evaluate(() => ({
    result: window.repairResult,
    rewards: localStorage.getItem("ayah-rewards-v1"),
  }));
  expect(first.result.xp).toBeGreaterThan(0);
  await launch();
  await fill();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-rewards-v1")),
  ).toBe(first.rewards);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(raw);
});
test("long-ayah mission targets the recorded position within twelve words and pins current source and segmentation", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { prepareRepairMission } =
        await import("/src/quest/repair/mission.js"),
      { surahs } = await import("/src/data.js");
    const [s, v] = surahs
        .flatMap((s) => s.verses.map((v) => [s, v]))
        .sort((a, b) => b[1].words.length - a[1].words.length)[0],
      key = `${s.id}:${v.id}`,
      index = v.words.length - 1;
    const recommendation = {
      id: `${key}|word-order`,
      key,
      game: "snake",
      evidence: [{ id: "position-receipt", expected: [`${key}:${index}`] }],
    };
    const first = await prepareRepairMission({ recommendation });
    const second = await prepareRepairMission({ recommendation });
    return {
      n: v.words.length,
      index,
      workspace: first.workspace,
      same: first.id === second.id,
    };
  });
  expect(result.n).toBeGreaterThan(12);
  expect(
    result.workspace.lastWord - result.workspace.firstWord + 1,
  ).toBeLessThanOrEqual(12);
  expect(result.workspace.lastWord).toBeGreaterThanOrEqual(result.index + 1);
  expect(result.same).toBe(true);
});
