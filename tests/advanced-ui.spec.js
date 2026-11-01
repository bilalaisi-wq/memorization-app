import { test, expect } from "@playwright/test";
import { enableDeveloperLab } from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
import { seedRescue, gradeRescue } from "./rescue-helper.js";
import { mockBilling } from "./billing-fixtures.js";
import { readFileSync } from "node:fs";
test.use({ hasTouch: true });
async function open(page, mode = "boss") {
  await enableDeveloperLab(page);
  await menu(page);
  await page
    .getByRole("button", {
      name: mode === "boss" ? "Muraja’ah Boss Rush" : "Hifz Survival",
      exact: true,
    })
    .click();
  await expect(page.locator(".advanced-revision")).toBeVisible();
}
async function startBoss(
  page,
  { preset = "beginner", rules = "practice", last = 2 } = {},
) {
  await open(page);
  // The two isolated Baqarah pilot ayahs are not an available consecutive Boss passage.
  await expect(page.locator('[name=surah] option[value="2"]')).toHaveCount(0);
  await page.locator("[name=preset]").selectOption(preset);
  await page.locator("[name=rules]").selectOption(rules);
  await page.locator("[name=last]").fill(String(last));
  await page.locator("[data-rv-form] button[type=submit]").click();
  await expect(page.locator("[data-rv-recall]")).toBeVisible();
}
async function grade(page, value = "Good", declare = true) {
  await page.locator("[data-rv-recall]").click();
  await expect(page.locator("[data-declare]")).toBeVisible();
  await gradeRescue(page, value, { declare });
}
async function runState(page) {
  return page.evaluate(async () => {
    const { profileStorage } = await import("/src/learner/profile-storage.js");
    return Object.values(
      JSON.parse(profileStorage.getItem("ayah-quest-revision-v1")).runs,
    ).at(-1);
  });
}
test("Boss Rush completes five real gates, discrimination never writes recall, and assisted final recall must be retried independently", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await startBoss(page);
  await grade(page);
  await grade(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  await page.locator("[data-rv-choices]").click();
  await expect(page.locator("[data-rv-choice]")).toHaveCount(2);
  await page.locator('[data-rv-choice="1:2"]').click();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(before);
  await grade(page);
  await expect(page.locator(".rv-challenge h3")).toHaveText(
    "Full independent passage recall",
  );
  await page.locator("[data-rv-support]").click();
  await expect(page.locator(".rv-support .arabic")).toBeVisible();
  await grade(page);
  expect((await runState(page)).cursor).toBe(4);
  expect((await runState(page)).results.at(-1).independent).toBe(false);
  await page.locator("[data-rv-fresh]").click();
  await grade(page);
  await expect(page.locator(".rv-summary")).toContainText(
    "Five gates complete",
  );
  expect((await runState(page)).status).toBe("won");
  await page.locator("summary").click();
  await expect(page.locator(".rv-summary")).toContainText("not a recall grade");
});
test("three Again self-grades produce game over and Practice retries preserve the cleared opening gate", async ({
  page,
}) => {
  await page.goto("/");
  await startBoss(page);
  await grade(page);
  for (let i = 0; i < 3; i++) await grade(page, "Again");
  await expect(page.locator(".rv-summary")).toContainText("Time to recover");
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  await page.locator("[data-rv-retry]").click();
  await expect(page.locator(".rv-challenge h3")).toHaveText(
    "Continuation recall",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(raw);
});
test("Survival covers selected due material, camps restore Practice lanterns, rest resumes after reload and summary reports actual outcomes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await seedRescue(page, {
    keys: ["1:1", "1:2", "1:3", "1:4", "1:5"],
    ages: [3],
  });
  await open(page, "survival");
  await page.locator("[name=length]").selectOption("extended");
  await page.locator("[data-rv-due]").click();
  await expect(page.locator("[name=length]")).toHaveValue("extended");
  await expect(page.locator("[data-rv-selected]")).toHaveText("5");
  await page.locator("[data-rv-form] button[type=submit]").click();
  await expect(page.locator(".rv-trail")).toBeVisible();
  await grade(page, "Again");
  await grade(page);
  await grade(page);
  await expect(page.locator(".rv-station")).toContainText("Campsite");
  expect((await runState(page)).charges).toBe(2);
  await page.locator("[data-rv-pause]").click();
  await page.locator("[data-rv-close]").click();
  await page.reload();
  await open(page, "survival");
  await page.locator("[data-rv-resume]").first().click();
  await expect(page.locator("[data-rv-camp]")).toBeVisible();
  await page.locator("[data-rv-camp]").click();
  expect((await runState(page)).charges).toBe(3);
  await grade(page);
  await grade(page, "Hard");
  await expect(page.locator(".rv-summary")).toContainText(
    "Expedition complete",
  );
  await expect(page.locator(".rv-summary-stats")).toContainText(
    "5 distinct recall units covered",
  );
  expect((await runState(page)).results.map((r) => r.grade)).toEqual([
    "Again",
    "Good",
    "Good",
    "Good",
    "Hard",
  ]);
});
test("an unrelated unfinished assessment resumes without clearing a gate or overwriting it", async ({
  page,
}) => {
  await page.goto("/");
  const attempt = await page.evaluate(async () => {
    const { createPassageMemory } = await import("/src/passage/memory.js");
    return createPassageMemory(localStorage).begin({
      id: "ayah:1:3",
      type: "ayah",
      refs: ["1:3"],
    }).id;
  });
  await startBoss(page);
  await page.locator("[data-rv-recall]").click();
  await expect(page.locator("[data-declare]")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).active.id,
    ),
  ).toBe(attempt);
  await gradeRescue(page);
  expect((await runState(page)).cursor).toBe(0);
  expect((await runState(page)).results).toHaveLength(0);
});
test("a failed revision receipt save recovers the persisted native assessment without another grade or duplicate game result", async ({
  page,
}) => {
  await page.goto("/");
  await startBoss(page);
  await page.locator("[data-rv-recall]").click();
  await expect(page.locator("[data-declare]")).toBeVisible();
  await page.evaluate(() => {
    window.realStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "ayah-quest-revision-v1") throw Error("Simulated disk full");
      return window.realStorageSet.call(this, k, v);
    };
  });
  await gradeRescue(page);
  await expect(page.locator("[data-rv-apply]")).toBeVisible();
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  await page.evaluate(
    () => (Storage.prototype.setItem = window.realStorageSet),
  );
  await page.reload();
  await open(page);
  await page.locator("[data-rv-resume]").first().click();
  await expect(page.locator("[data-rv-recall]")).toHaveText(
    "Apply saved self-assessment",
  );
  await page.locator("[data-rv-recall]").click();
  await expect(page.locator(".rv-challenge h3")).toHaveText(
    "Continuation recall",
  );
  expect((await runState(page)).cursor).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(raw);
  expect((await runState(page)).results).toHaveLength(1);
});
test("mobile touch layouts, large controls, focus restoration, reduced motion and account changes preserve old records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await seedRescue(page);
  await open(page, "survival");
  await page.locator("[data-rv-unit]").first().tap();
  await expect(page.locator("[data-rv-selected]")).toHaveText("1");
  await page.locator("[data-rv-form] button[type=submit]").tap();
  await expect(page.locator(".rv-trail")).toBeVisible();
  expect(
    await page
      .locator(".advanced-revision")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.locator("[data-rv-support]").tap();
  await expect(page.locator(".rv-support")).toBeVisible();
  await page.locator("[data-rv-close]").focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      document
        .querySelector(".advanced-revision")
        .contains(document.activeElement),
    ),
  ).toBe(true);
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-quest-revision-v1"),
  );
  await page.evaluate(async () =>
    (await import("/src/learner/profile-storage.js")).selectProfile(
      "different-user",
    ),
  );
  await expect(page.locator(".advanced-revision")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ayah-user:different-user:ayah-quest-revision-v1"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-quest-revision-v1")),
  ).toBe(raw);
});
test("private sources are authorized before plan creation, and late responses cannot mount into a closed route", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  await mockBilling(page, { plan: "free" });
  await page.goto("/");
  await seedRescue(page, {
    keys: ["2:282"],
    signed: true,
    privateBundle: fixture,
  });
  await page.route("**/functions/v1/quran-content", (r) =>
    r.fulfill({ status: 403, json: { error: "Private content denied" } }),
  );
  await open(page, "survival");
  await page.locator("[data-rv-unit]").first().check();
  await page.locator("[data-rv-form] button[type=submit]").click();
  await expect(page.locator("[data-rv-status]")).toContainText(
    "Private content denied",
  );
  expect(
    await page.evaluate(async () =>
      (await import("/src/learner/profile-storage.js")).profileStorage.getItem(
        "ayah-quest-revision-v1",
      ),
    ),
  ).toBeNull();
  await page.unroute("**/functions/v1/quran-content");
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/functions/v1/quran-content", async (r) => {
    await gate;
    await r.fulfill({ json: fixture });
  });
  await page.locator("[data-rv-form] button[type=submit]").click();
  await page.locator("[data-rv-close]").click();
  release();
  await page.waitForTimeout(200);
  await expect(page.locator(".advanced-revision")).toHaveCount(0);
  expect(
    await page.evaluate(async () =>
      (await import("/src/learner/profile-storage.js")).profileStorage.getItem(
        "ayah-quest-revision-v1",
      ),
    ),
  ).toBeNull();
});
test("empty Survival and corrupt advanced data preserve existing free study and show recovery instead of invented routes", async ({
  page,
}) => {
  await page.goto("/");
  await open(page, "survival");
  await expect(page.locator(".rv-unit-list")).toContainText(
    "No eligible memorized units",
  );
  await page.locator("[data-rv-close]").click();
  await page.evaluate(() =>
    localStorage.setItem("ayah-quest-revision-v1", '{"version":999}'),
  );
  await open(page);
  await expect(page.locator("[data-rv-status]")).toContainText(
    "not been overwritten",
  );
  await expect(page.locator("[data-rv-export]")).toBeVisible();
  await page.locator("[data-rv-close]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-quest-revision-v1")),
  ).toBe('{"version":999}');
  await page.locator("#nav-puzzle-lab").click();
  await expect(page.locator("[data-game=falling]")).toBeVisible();
});

test("support recitation volume works, stops on exit, and failed playback never consumes lantern charges", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.revisionClips = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        window.revisionClips.push(this);
      }
      play() {
        if (window.failRevisionAudio) {
          this.failed = true;
          return Promise.reject(Error("playback failed"));
        }
        this.played = true;
        return this.src
          ? Promise.resolve()
          : Promise.reject(Error("unavailable"));
      }
      pause() {
        this.stopped = true;
      }
      removeAttribute() {}
      load() {}
    };
  });
  await page.goto("/");
  await startBoss(page);
  await page.locator("[data-rv-support]").click();
  await page.locator("[data-rv-volume]").fill("0.25");
  await page.locator("[data-rv-volume]").dispatchEvent("input");
  await page.locator("[data-rv-listen]").click();
  await expect
    .poll(() =>
      page.evaluate(() => window.revisionClips.filter((a) => a.played).length),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => window.revisionClips.filter((a) => a.played).at(-1).volume,
    ),
  ).toBe(0.25);
  await page.evaluate(() => (window.failRevisionAudio = true));
  await page.locator("[data-rv-listen]").click();
  await expect(page.locator("[data-rv-status]")).toContainText(
    "no game charge was used",
  );
  expect((await runState(page)).charges).toBe(3);
  await page.locator("[data-rv-close]").click();
  expect(
    await page.evaluate(() =>
      window.revisionClips.filter((a) => a.played).every((a) => a.stopped),
    ),
  ).toBe(true);
});

test("Boss mobile gate tower and discrimination choices remain readable and keyboard-operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await startBoss(page, { preset: "expert", last: 3 });
  await grade(page);
  await grade(page);
  await page.locator("[data-rv-choices]").tap();
  await expect(page.locator("[data-rv-choice]")).toHaveCount(4);
  expect(
    await page
      .locator(".advanced-revision")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.locator('[data-rv-choice="1:2"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".rv-challenge h3")).toHaveText(
    "Consecutive ayah recall",
  );
  await expect(page.locator("[data-rv-recall]")).toBeFocused();
});

test("stopping recitation does not cancel a pending authorized content build", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  await mockBilling(page, { plan: "pathfinder" });
  await page.goto("/");
  await seedRescue(page, {
    keys: ["2:282"],
    signed: true,
    privateBundle: fixture,
  });
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/functions/v1/quran-content", async (r) => {
    await gate;
    await r.fulfill({ json: fixture });
  });
  await open(page, "survival");
  await page.locator("[data-rv-unit]").first().check();
  await page.locator("[data-rv-form] button[type=submit]").click();
  await page.locator("[data-rv-stop]").click();
  release();
  await expect(page.locator("[data-rv-recall]")).toBeVisible();
  expect((await runState(page)).charges).toBe(3);
});

test("support revealed after a declared unfinished attempt is saved as assistance before text appears", async ({
  page,
}) => {
  await page.goto("/");
  await startBoss(page);
  await page.locator("[data-rv-recall]").click();
  await page.locator("[data-declare]").click();
  await page.locator(".passage-studio [data-close]").click();
  await page.locator("[data-rv-support]").click();
  await expect(page.locator(".rv-support")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).active
          .assisted,
    ),
  ).toBe(true);
  await page.locator("[data-rv-recall]").click();
  await page.locator("[data-compare]").click();
  await page.locator("[data-grade=Good]").click();
  await page.locator(".passage-studio [data-close]").click();
  await expect(page.locator('[data-rv-gate="0"]')).toContainText(
    "Assisted self-grade",
  );
  expect((await runState(page)).results[0]).toMatchObject({
    independent: false,
    scheduled: false,
  });
});

test("delayed source preparation cannot replace the first reveal click on a resumed assessment", async ({
  page,
}) => {
  await mockBilling(page, { plan: "free" });
  let slow = false,
    count = 0,
    release;
  const gate = new Promise((r) => (release = r));
  await page.route(
    "**/rest/v1/rpc/published_segmentation_review",
    async (r) => {
      if (slow && ++count >= 2) await gate;
      await r.fulfill({ json: null });
    },
  );
  await page.goto("/");
  await seedRescue(page, { signed: true, keys: ["1:1"], ages: [3] });
  await startBoss(page);
  await page.evaluate(async () => {
    const { profileStorage } = await import("/src/learner/profile-storage.js"),
      { createPassageMemory } = await import("/src/passage/memory.js");
    const m = createPassageMemory(profileStorage);
    m.begin({ id: "ayah:1:1", type: "ayah", refs: ["1:1"] });
    m.update("declared");
  });
  slow = true;
  await page.locator("[data-rv-recall]").click();
  await expect(page.locator(".passage-studio")).toContainText(
    "Preparing verified self-assessment",
  );
  await expect(page.locator("[data-compare]")).toHaveCount(0);
  release();
  await expect(page.locator("[data-compare]")).toBeVisible();
  await page.locator("[data-compare]").click();
  await expect(page.locator("[data-grade=Good]")).toBeVisible();
  await page.locator("[data-grade=Good]").click();
  await page.locator(".passage-studio [data-close]").click();
  await expect(page.locator(".rv-challenge h3")).toHaveText(
    "Continuation recall",
  );
});
