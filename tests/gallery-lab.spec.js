import {startFalling,parkExtra} from "./falling-helper.js";
import { menu } from "./menu-helper.js";
import { test, expect } from "@playwright/test";
import { surahs } from "../src/data.js";
import { createLearningStore, LEARNING_KEY } from "../src/learning-store.js";
import {
  createMasteryStore,
  GALLERY_KEY,
  qualifyingDays,
} from "../src/mastery/mastery-store.js";
import { createPuzzleStore, LAB_KEY } from "../src/puzzles/puzzle-store.js";
import { masteryStories } from "../src/mastery/masteryStories.js";
import { mosaic } from "../src/mastery/gallery-ui.js";
import { checkedDetectivePairs } from "../src/puzzles/puzzle-lab.js";
class Storage {
  constructor() {
    this.values = new Map();
  }
  getItem(k) {
    return this.values.get(k) ?? null;
  }
  setItem(k, v) {
    this.values.set(k, String(v));
  }
}
function reviewed(keys, days = 2) {
  const storage = new Storage(),
    learning = createLearningStore(storage, surahs, {
      timeZone: "America/Chicago",
    });
  for (let d = 0; d < days; d++)
    for (const key of keys) {
      const date = new Date(
        `2026-09-${String(1 + d * 7).padStart(2, "0")}T15:00:00Z`,
      );
      const due = learning.getRecord(key).memory.nextReview;
      if (due && Date.parse(due) > date.getTime())
        date.setTime(Date.parse(due));
      const a = learning.beginRecall(key, date);
      learning.updateRecall(a.id, "compare");
      learning.gradeRecall(a.id, "Good", date);
    }
  return { storage, learning };
}
async function seed(page, storage) {
  await page.addInitScript(
    (entries) => entries.forEach(([k, v]) => localStorage.setItem(k, v)),
    [...storage.values],
  );
}
const openLab = async (page) => {
  await page.goto("/");
  await (await menu(page)).locator("#nav-lab").click();
  await startFalling(page);
};
const finishFalling = async (page, keyboard = false) => {
  const n = await page.locator("[data-slot]").count();
  for (let step = 0; step < n + 10; step++) {
    if (await page.locator(".falling-block").isHidden()) break;
    const index = Number(
      await page.locator(".falling-block").getAttribute("data-index"),
    );
    if (index >= n) {
      if (keyboard) {
        await page.locator(".falling-stage").focus();
        await parkExtra(page);
      } else await parkExtra(page);
      continue;
    }
    if (keyboard) {
      await page.locator(".falling-stage").focus();
      await page.keyboard.press("Space");
    } else await page.locator(`[data-slot="${index}"]`).click();
  }
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
};

test("mosaic mapping is balanced, stable and nonoverlapping for every supported surah", () => {
  for (const chapter of surahs) {
    const ids = chapter.verses.map((v) => v.id),
      regions = mosaic(ids);
    expect(regions).toEqual(mosaic(ids));
    expect(regions.map((r) => r.ayahId)).toEqual(ids);
    for (const r of regions)
      expect(r.w * r.h).toBeCloseTo(10000 / ids.length, 5);
    for (let i = 0; i < regions.length; i++)
      for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i],
          b = regions[j];
        expect(
          Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
            Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)),
        ).toBeCloseTo(0, 5);
      }
  }
});

test("art unlocks require two independent scheduled days and survive a later lapse", () => {
  const { storage, learning } = reviewed(["1:1"]);
  const gallery = createMasteryStore(storage, surahs);
  expect(gallery.sync(learning).unlocks).toEqual(["1:1"]);
  expect(gallery.sync(learning).unlocks).toEqual([]);
  const date = new Date("2026-10-10T15:00:00Z"),
    a = learning.beginRecall("1:1", date);
  learning.updateRecall(a.id, "compare");
  learning.gradeRecall(a.id, "Again", date);
  gallery.sync(learning);
  expect(gallery.snapshot().unlocks["1:1"]).toBeTruthy();
  expect(gallery.snapshot().unlocks["1:2"]).toBeUndefined();
  const assisted = learning.beginRecall("1:2", date);
  learning.updateRecall(assisted.id, "hint");
  learning.gradeRecall(assisted.id, "Easy", date);
  expect(qualifyingDays(learning.getRecord("1:2"))).toEqual([]);
});

test("same-day recall, early practice and legacy puzzle achievements do not unlock art", () => {
  const storage = new Storage();
  storage.setItem("ayah-mastery", '{"1:1":99}');
  storage.setItem("ayah-completed", "[0]");
  storage.setItem("ayah-quiz", '{"xp":123,"stars":4}');
  const learning = createLearningStore(storage, surahs),
    gallery = createMasteryStore(storage, surahs);
  const now = new Date("2026-09-01T15:00:00Z");
  for (let i = 0; i < 3; i++) {
    const a = learning.beginRecall("1:1", now);
    learning.updateRecall(a.id, "compare");
    learning.gradeRecall(a.id, "Good", now);
  }
  gallery.sync(learning);
  expect(gallery.snapshot().unlocks).toEqual({});
  expect(learning.snapshot().wallet.legacyXP).toBe(123);
  expect(learning.getRecord("1:1").game.puzzleWins).toBe(99);
});

test("full collectible and Maintained have separate requirements; corruption is preserved", () => {
  const keys = ["108:1", "108:2", "108:3"],
    two = reviewed(keys),
    gallery = createMasteryStore(two.storage, surahs);
  gallery.sync(two.learning);
  expect(gallery.snapshot().collectibles[108].maintainedAt).toBeNull();
  const three = reviewed(keys, 3),
    maintained = createMasteryStore(three.storage, surahs);
  maintained.sync(three.learning);
  expect(maintained.snapshot().collectibles[108].maintainedAt).toBeTruthy();
  two.storage.setItem(GALLERY_KEY, '{"schemaVersion":999}');
  const broken = createMasteryStore(two.storage, surahs);
  expect(() => broken.markSeen(keys)).toThrow();
  expect(two.storage.getItem(GALLERY_KEY)).toBe('{"schemaVersion":999}');
});

test("lab rewards are bounded and cannot alter memory or quest levels; recommendations reflect measured mistakes", () => {
  const storage = new Storage(),
    learning = createLearningStore(storage, surahs),
    lab = createPuzzleStore(storage, surahs),
    before = learning.getRecord("1:1").memory;
  const date = new Date("2026-09-01T15:00:00Z");
  for (let i = 0; i < 3; i++) {
    const result = {
      key: "1:1",
      game: "falling",
      sessionId: `lab-${i}`,
      mistakes: 2,
    };
    const reward = learning.recordLabPuzzle({ ...result, now: date });
    expect(reward.xp).toBe(i === 0 ? 8 : 0);
    lab.record(result);
  }
  expect(learning.snapshot().wallet.xp).toBe(8);
  expect(learning.getRecord("1:1").memory).toEqual(before);
  expect(learning.getRecord("1:1").game.puzzleWins).toBe(0);
  expect(lab.recommend("1:1", learning).game).toBe("falling");
  expect(
    learning.recordLabPuzzle({
      key: "1:1",
      game: "falling",
      sessionId: "lab-0",
      now: date,
    }).duplicate,
  ).toBe(true);
  const a = learning.beginRecall("1:1", date);
  learning.updateRecall(a.id, "compare");
  learning.gradeRecall(a.id, "Good", date);
  expect(
    lab.recommend("1:1", learning, new Date("2026-09-03T15:00:00Z")).game,
  ).toBe("recall");
});

test("stories expose canonical source links but never claim unverified content; detective pairs use exact verified words", () => {
  expect(masteryStories).toHaveLength(13);
  for (const story of masteryStories) {
    expect(story.editorialStatus).toBe("needs-review");
    expect(story.narrative).toBe("");
    expect(story.illustration).toMatch(/\/mastery-art\/\d{3}\.webp$/);
    expect(story.sources[0].url).toBe("https://www.qtafsir.com/#surahs");
    expect(story.sources[1].url).toContain("tafsir-al-jalalain-Eng-PDF.pdf");
  }
  for (const pair of checkedDetectivePairs(surahs)) {
    expect(pair.first.words.slice(pair.cue)).not.toEqual(
      pair.second.words.slice(pair.cue),
    );
    expect(pair.surah.verses).toContain(pair.first);
    expect(pair.surah.verses).toContain(pair.second);
  }
});

test("Gallery shows stable ayah unlocks, missing-image fallback and persisted full reveal", async ({
  page,
}) => {
  const fixture = reviewed(["108:1", "108:2", "108:3"]);
  await seed(page, fixture.storage);
  await page.goto("/");
  await (await menu(page)).locator("#nav-gallery").click();
  await expect(page.locator("[data-gallery-surah]")).toHaveCount(13);
  const card = page.locator('[data-gallery-surah="108"]');
  await expect(card).toContainText("3 / 3 sections revealed");
  await expect(card.locator(".mastery-mosaic")).toHaveAttribute(
    "data-fallback",
    "true",
  );
  await card.locator("[data-artwork]").click();
  await page.locator("#skip-reveal").click();
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator("dialog")).toContainText(
    "Keep building your memory",
  );
  await expect(page.locator("dialog a")).toHaveCount(2);
  await page.getByRole("button", { name: "Close story" }).click();
  await expect(page.locator(".art-region.art-open")).toHaveCount(3);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).seen.length,
      GALLERY_KEY,
    ),
  ).toBe(3);
  await page.reload();
  await (await menu(page)).locator("#nav-gallery").click();
  await expect(
    page.locator('[data-gallery-surah="108"] .art-complete'),
  ).toBeVisible();
});

test("reduced motion disables reveal animations and reviews preserve FSRS dates", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = reviewed(["1:2"]);
  const before = fixture.learning.getRecord("1:2").memory.nextReview;
  await seed(page, fixture.storage);
  await page.goto("/");
  await (await menu(page)).locator("#nav-gallery").click();
  await page.locator('[data-artwork="1"]').click();
  await expect(page.locator('[data-art-ayah="2"]')).toHaveClass(/art-open/);
  await expect(page.locator("[data-status]")).toContainText("Ayah 2");
  expect(
    await page
      .locator('[data-art-ayah="2"]')
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      (k) =>
        JSON.parse(localStorage.getItem(k)).records["1:2"].memory.nextReview,
      LEARNING_KEY,
    ),
  ).toBe(before);
});

test("Falling Words supports RTL keyboard placement, retry feedback and daily XP cap", async ({
  page,
}) => {
  await openLab(page);
  await page.locator("#fall-left").click();
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-lane",
    "2",
  );
  await page.locator("#fall-right").click();
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-lane",
    "3",
  );
  while (
    Number(await page.locator(".falling-block").getAttribute("data-index")) >= 4
  )
    await parkExtra(page);
  const index = Number(
    await page.locator(".falling-block").getAttribute("data-index"),
  );
  await page.locator(`[data-slot="${(index + 1) % 4}"]`).click();
  await expect(page.locator("[data-status]")).toContainText("another position");
  await page.locator(`[data-slot="${(index + 1) % 4}"]`).click();
  await finishFalling(page, true);
  await expect(page.locator("[data-status]")).toContainText("+8 game XP");
  await page.locator("#lab-restart").click();
  await startFalling(page);
  await finishFalling(page);
  await expect(page.locator("[data-status]")).toContainText("+0 game XP");
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)),
    LEARNING_KEY,
  );
  expect(state.wallet.xp).toBe(8);
  expect(state.records["1:1"].memory.history).toEqual([]);
  expect(state.records["1:1"].game.puzzleWins).toBe(0);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).history.length,
      LAB_KEY,
    ),
  ).toBe(2);
  await page.reload();
  await (await menu(page)).locator("#nav-lab").click();
  await expect(page.locator(".lab-recommendation")).toContainText(
    "order practice mistakes",
  );
});

test("timed descent pauses for recitation and resumes only after stopping audio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.audioStops = 0;
    window.Audio = class {
      play() {
        return Promise.resolve();
      }
      pause() {
        window.audioStops++;
      }
    };
  });
  await openLab(page);
  await page.locator("[name=speed]").selectOption("slow");
  const initialTop = await page.locator(".falling-block").getAttribute("style");
  await expect.poll(() => page.locator(".falling-block").getAttribute("style")).not.toBe(initialTop);
  await page.locator("#lab-replay").click();
  await expect(page.locator(".falling-counter")).toContainText("Paused");
  const top = await page.locator(".falling-block").getAttribute("style");
  await page.waitForTimeout(250);
  expect(await page.locator(".falling-block").getAttribute("style")).toBe(top);
  await page.locator("#fall-pause").click();
  expect(await page.evaluate(() => window.audioStops)).toBeGreaterThan(0);
  await expect(page.locator(".falling-counter")).toContainText("Ready");
});

test("all other puzzle types are playable with verified text", async ({
  page,
}) => {
  await openLab(page);
  await page.locator('[data-game="vanishing"]').click();
  await page.locator("#lab-level").selectOption("4");
  for (let i = 0; i < 4; i++)
    await page.locator(`[data-choice="${i}"]`).click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  await page.locator('[data-game="jigsaw"]').click();
  await page.locator("#lab-level").selectOption("1");
  for (let i = 0; i < 2; i++) await page.locator(`[data-group="${i}"]`).click();
  await page.locator("#jigsaw-check").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  await page.locator('[data-game="match"]').click();
  for (let i = 0; i < 4; i++) {
    const cards = page.locator(`[data-pair="${i}"]`);
    await cards.nth(0).click();
    await cards.nth(1).click();
  }
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  await page.locator('[data-game="chain"]').click();
  for (let i = 0; i < 5; i++) await page.locator(`[data-chain="${i}"]`).click();
  await page.locator("#chain-check").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  await page.locator('[data-game="continue"]').click();
  await expect(page.locator(".continue-answer")).toBeHidden();
  await page.locator("#continue-compare").click();
  for (let i = 0; i < 3; i++)
    await page.locator(`[data-choice="${i}"]`).click();
  await page.locator("#continue-check").click();
  await page.locator("#continue-good").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  await page.locator('[data-game="detective"]').click();
  await page.locator('[data-choice="1"]').click();
  await expect(page.locator("[data-status]")).toContainText("other ayah");
  await page.locator('[data-choice="0"]').click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
});

test.describe("touch layout", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("touch placement and mobile gallery remain usable without overflow", async ({
    page,
  }) => {
    await openLab(page);
    const n = 4;
    for (let i = 0; i < n + 3; i++) {
      if(await page.locator(".tower-victory").count()) break;
      const index = await page
        .locator(".falling-block")
        .getAttribute("data-index");
      if (Number(index) >= n) await parkExtra(page);
      else await page.locator(`[data-slot="${index}"]`).tap();
    }
    await expect(page.locator("[data-status]")).toContainText(
      "Challenge complete",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#surah-picker").selectOption("37");
    await expect(page.locator(".lab-intro")).toContainText("An-Naba");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await (await menu(page)).locator("#nav-gallery").tap();
    await expect(page.locator("[data-gallery-surah]")).toHaveCount(13);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

test("a saved qualifying recall unlocks the correct artwork section through the live assessment flow", async ({
  page,
}) => {
  const fixture = reviewed(["1:2"], 1);
  await seed(page, fixture.storage);
  await page.goto("/");
  await page.locator('[data-ayah="1"]').click();
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.locator("#recited-compare").click();
  await page.locator('[data-recall-grade="Good"]').click();
  await expect(page.locator(".mastery-notice")).toContainText(
    "1 artwork section",
  );
  await page.getByRole("button", { name: "See my Mastery Gallery" }).click();
  await expect(page.locator('[data-art-ayah="2"]')).toHaveClass(/art-open/);
  await expect(page.locator('[data-art-ayah="1"]')).toHaveClass(/art-locked/);
});

test("Vanishing Ayah advances from a quarter hidden to half without farming XP", async ({
  page,
}) => {
  await openLab(page);
  await page.locator('[data-game="vanishing"]').click();
  await expect(page.locator(".lab-game h3")).toContainText("25% hidden");
  const target = await page
    .locator("[data-choice]")
    .evaluateAll(
      (bs) => bs.find((b) => Number(b.dataset.choice) < 4).dataset.choice,
    );
  await page.locator(`[data-choice="${target}"]`).click();
  await expect(page.locator("[data-status]")).toContainText("+8 game XP");
  await page.locator("#lab-next-level").click();
  await expect(page.locator(".lab-game h3")).toContainText("50% hidden");
  const choices = await page.locator("[data-choice]").evaluateAll((buttons) =>
    buttons
      .map((b) => Number(b.dataset.choice))
      .filter((i) => i < 4)
      .sort((a, b) => a - b),
  );
  for (const i of choices) await page.locator(`[data-choice="${i}"]`).click();
  await expect(page.locator("[data-status]")).toContainText("+0 game XP");
});

test("a failed Lab history write can be retried without awarding XP twice", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    window.blockLabSave = true;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && window.blockLabSave)
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, LAB_KEY);
  await openLab(page);
  for (let i = 0; i < 7; i++) {
    if(await page.locator(".tower-victory").count()) break;
    const index = await page
      .locator(".falling-block")
      .getAttribute("data-index");
    if (Number(index) >= 4) await parkExtra(page);
    else await page.locator(`[data-slot="${index}"]`).click();
  }
  await expect(page.locator("#lab-retry-save")).toBeVisible();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).wallet.xp,
      LEARNING_KEY,
    ),
  ).toBe(8);
  await page.evaluate(() => (window.blockLabSave = false));
  await page.locator("#lab-retry-save").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).wallet.xp,
      LEARNING_KEY,
    ),
  ).toBe(8);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).history.length,
      LAB_KEY,
    ),
  ).toBe(1);
});

test("leaving a timed Quest peek does not reset an in-progress Lab round", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("ayah-mastery", '{"1:1":2}'),
  );
  await page.clock.install();
  await page.goto("/");
  await page.locator('[data-mode="quiz"]').click();
  await page.locator("#peek-words").click();
  await (await menu(page)).locator("#nav-lab").click();
  await startFalling(page);
  while (
    Number(await page.locator(".falling-block").getAttribute("data-index")) >= 4
  )
    await parkExtra(page);
  const index = await page.locator(".falling-block").getAttribute("data-index");
  await page.locator(`[data-slot="${index}"]`).click();
  await expect(page.locator(".slot-filled")).toHaveCount(1);
  await page.clock.runFor(8500);
  await expect(page.locator(".slot-filled")).toHaveCount(1);
});
