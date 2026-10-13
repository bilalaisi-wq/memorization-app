import { test, expect } from "@playwright/test";
import { createLearningStore, LEARNING_KEY } from "../src/learning-store.js";
import { surahs } from "../src/data.js";
class Storage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.get(key) ?? null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
}
async function memory(page, key = "1:1") {
  return page.evaluate(
    ({ storageKey, key }) =>
      JSON.parse(localStorage.getItem(storageKey)).records[key]?.memory,
    { storageKey: LEARNING_KEY, key },
  );
}

test("Daily Quest preserves imported puzzle achievements and exposes separate memory progress", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("legacy-test-seeded")) {
      localStorage.setItem("ayah-quiz", '{"xp":123,"stars":18,"streak":4}');
      localStorage.setItem("ayah-mastery", '{"1:1":8}');
      localStorage.setItem("ayah-completed", "[0,1]");
      localStorage.setItem("legacy-test-seeded", "yes");
    }
  });
  await page.goto("/");
  await expect(page.locator(".memory-summary")).toContainText(
    "Puzzles: 2 completed",
  );
  await expect(page.locator(".memory-summary")).toContainText("0 retained");
  await page.locator("#nav-daily").click();
  await expect(page.locator(".daily-intro")).toContainText("123 XP");
  await expect(page.locator(".daily-intro")).toContainText("18 stars");
  await expect(page.locator(".memory-metrics")).toContainText("2 / 571");
  await expect(page.locator(".memory-metrics")).toContainText("0 retained");
  expect((await memory(page)).card).toBeNull();
  await page.reload();
  await expect(page.locator(".progress-summary")).toContainText("2 / 7");
  await page.locator('[data-mode="quiz"]').click();
  await expect(page.locator(".quest-banner")).toContainText("Level 3 / 3");
});

test("self-assessed recitation hides text, saves a future review and persists on reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await expect(page.locator(".self-assessment")).toContainText(
    "does not automatically verify your speech",
  );
  await expect(page.locator(".verified-text")).toHaveCount(0);
  await expect(page.locator("[data-recall-grade]")).toHaveCount(0);
  await expect(page.locator(".word-bank")).toHaveCount(0);
  await page.locator("#recited-compare").click();
  await expect(page.locator(".verified-text .arabic")).toContainText(
    surahs[0].verses[0].text,
  );
  await page.locator('[data-recall-grade="Good"]').click();
  await expect(page.locator(".recall-result")).toContainText(
    "Assessment saved",
  );
  await expect(page.locator(".recall-result")).toContainText("Next review:");
  const m = await memory(page);
  expect(m.independentAttempts).toBe(1);
  expect(m.successfulDays).toHaveLength(1);
  expect(new Date(m.nextReview).getTime()).toBeGreaterThan(Date.now());
  expect(m.history[0].comparisonRevealed).toBe(true);
  await expect(page.locator("[data-recall-grade]")).toHaveCount(0);
  await page.reload();
  expect((await memory(page)).nextReview).toBe(m.nextReview);
  await page.locator("#nav-daily").click();
  await expect(page.locator(".daily-intro")).toContainText("40 XP");
  await expect(page.locator(".upcoming-reviews")).toContainText("Al-Fatihah");
  await expect(page.locator(".memory-metrics")).toContainText("1 ayahs");
});

test("hint-assisted attempts resume with their flags and never create independent mastery", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.locator("#recall-hint").click();
  await page.reload();
  await expect(page.locator(".assistance-note")).toContainText(
    "Assisted study",
  );
  await expect(page.locator(".verified-text")).toHaveCount(1);
  await page.locator('[data-recall-grade="Easy"]').click();
  const m = await memory(page);
  expect(m.card).toBeNull();
  expect(m.successfulDays).toHaveLength(0);
  expect(m.assistedAttempts).toBe(1);
  expect(m.independentAttempts).toBe(0);
  expect(m.history[0].usedHint).toBe(true);
  await expect(page.locator(".recall-result")).toContainText("+5 XP");
  await page.locator("#recall-retry").click();
  await page.locator("#recall-hint").click();
  await page.locator('[data-recall-grade="Good"]').click();
  await expect(page.locator(".recall-result")).toContainText("+0 XP");
  await page.reload();
  expect((await memory(page)).history).toHaveLength(2);
  await page.locator("#nav-daily").click();
  await expect(page.locator(".daily-intro")).toContainText("5 XP");
});

test("listening first is assistance; listening alone never submits an assessment", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Audio = class {
      play() {
        return Promise.resolve();
      }
      pause() {}
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.locator("#recall-audio").click();
  await expect(page.locator(".assistance-note")).toContainText(
    "Assisted study",
  );
  await expect(page.locator("[data-recall-grade]")).toHaveCount(0);
  expect((await memory(page)).history).toHaveLength(0);
  await page.locator("#recited-compare").click();
  await page.locator('[data-recall-grade="Good"]').click();
  const m = await memory(page);
  expect(m.independentAttempts).toBe(0);
  expect(m.history[0].audioBeforeRecall).toBe(true);
  expect(m.successfulDays).toHaveLength(0);
});

test("due review starts the correct surah, grades with FSRS and returns to the dashboard", async ({
  page,
}) => {
  const storage = new Storage(),
    past = new Date(Date.now() - 86400000),
    store = createLearningStore(storage, surahs, {
      timeZone: "UTC",
      clock: () => past,
    });
  const a = store.beginRecall("114:1", past);
  store.updateRecall(a.id, "compare");
  store.gradeRecall(a.id, "Again", past);
  const seed = storage.getItem(LEARNING_KEY);
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, seed);
    },
    { key: LEARNING_KEY, seed },
  );
  await page.goto("/");
  await expect(page.locator(".memory-summary")).toContainText("1 due now");
  await page.locator("#nav-daily").click();
  await expect(
    page.locator(".daily-columns:not(.upcoming-reviews)"),
  ).toContainText("An-Nas");
  await page.locator("#start-due-review").click();
  await expect(page.locator(".recall-intro h2")).toContainText("An-Nas");
  await page.locator("#recited-compare").click();
  await page.locator('[data-recall-grade="Good"]').click();
  await expect(page.locator(".recall-result")).toContainText("+60 XP");
  const m = await memory(page, "114:1");
  expect(m.history).toHaveLength(2);
  expect(m.history[1].wasDue).toBe(true);
  expect(m.card.reps).toBe(2);
  await page.locator(".recall-result [data-daily]").click();
  await expect(page.locator(".daily-intro")).toContainText("65 XP");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/ayah-daily-quest-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/ayah-daily-quest-mobile.png",
    fullPage: true,
  });
  await page.reload();
  expect((await memory(page, "114:1")).nextReview).toBe(m.nextReview);
});

test("surah changes reset assessment flags and pending recall survives a browser reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#surah-picker").selectOption("1");
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.locator("#recall-hint").click();
  await page.locator("#surah-picker").selectOption("3");
  await expect(page.locator(".recall-intro h2")).toContainText("Al-Ikhlas");
  await expect(page.locator(".verified-text")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".recall-intro h2")).toContainText("Al-Ikhlas");
  await expect(page.locator(".verified-text")).toHaveCount(0);
  await page.locator("#recited-compare").click();
  await page.locator('[data-recall-grade="Easy"]').click();
  expect((await memory(page, "112:1")).independentAttempts).toBe(1);
  expect((await memory(page, "114:1")).independentAttempts).toBe(0);
});

test("puzzle reward caps preserve levels and progress without creating recall credit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ayah-mastery", '{"1:1":4}');
  });
  await page.goto("/");
  await page.locator('[data-mode="quiz"]').click();
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 4; i++)
      await page.locator(`.word-bank [data-word="${i}"]`).click();
    await page.locator("#next").click();
    if (round < 2) await page.locator("#next").click();
  }
  await expect(page.locator(".xp-line")).toContainText("70 XP");
  await expect(page.locator(".feedback")).toContainText("reward limit");
  const m = await memory(page);
  expect(m.independentAttempts).toBe(0);
  expect(m.successfulDays).toHaveLength(0);
  expect(m.card).toBeNull();
  await page.reload();
  await expect(page.locator(".memory-summary")).toContainText("0 retained");
});

test("malformed saved learning data is not overwritten and presents recovery guidance", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ayah-learning-v1", '{"schemaVersion":999}');
    localStorage.setItem("ayah-quiz", '{"xp":71,"stars":4}');
  });
  await page.goto("/");
  await expect(page.locator(".storage-warning")).toContainText(
    "will not be overwritten",
  );
  await page.locator("#nav-daily").click();
  await expect(page.locator(".daily-intro")).toContainText("71 XP");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-learning-v1")),
  ).toBe('{"schemaVersion":999}');
  const download = page.waitForEvent("download");
  await page.locator("#export-learning").click();
  expect((await download).suggestedFilename()).toBe(
    "ayah-learning-backup.json",
  );
});

test("leaving an unfinished recall to study marks assistance before resuming", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.locator("#nav-learn").click();
  await expect(page.locator(".full-verse")).toBeVisible();
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await expect(page.locator(".assistance-note")).toContainText(
    "Assisted study",
  );
  await page.locator("#recited-compare").click();
  await page.locator('[data-recall-grade="Good"]').click();
  expect((await memory(page)).independentAttempts).toBe(0);
});

test("recitation comparison and grading support keyboard interaction with managed focus", async ({
  page,
}) => {
  await page.goto("/");
  const enter = page.getByRole("button", {
    name: "Assess this ayah",
    exact: true,
  });
  await enter.focus();
  await enter.press("Enter");
  await expect(page.locator("#recited-compare")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-recall-grade="Again"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-recall-grade="Good"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".recall-result")).toBeFocused();
  expect((await memory(page)).history.at(-1).grade).toBe("Good");
});
