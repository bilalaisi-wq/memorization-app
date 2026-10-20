import { menu } from "./menu-helper.js";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { surahs } from "../src/data.js";
import { createLearningStore } from "../src/learning-store.js";
import {
  saveGoals,
  readGoals,
  trackStudy,
  summarizeActivity,
  nextStep,
  achievements,
  preserveAchievements,
} from "../src/learner/insights.js";
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};
const fixture = () => {
  const saved = storage();
  const store = createLearningStore(saved, surahs, {
    timeZone: "America/Chicago",
  });
  return { saved, store };
};
test("goals are separate, filtered and persistent; already-known never earns retained mastery", () => {
  const { saved, store } = fixture();
  const before = store.snapshot();
  saveGoals(
    saved,
    {
      aim: "surahs",
      minutes: 10,
      days: 4,
      targets: [114, 114, 999],
      known: [1],
      confidence: "ready",
    },
    surahs,
  );
  expect(readGoals(saved).targets).toEqual([114]);
  expect(store.snapshot()).toEqual(before);
  const awards = achievements(before, surahs, summarizeActivity(before, saved));
  expect(awards.find((a) => a.id === "surah").value).toBe(0);
  expect(
    nextStep(before, store.daily(), readGoals(saved), surahs),
  ).toMatchObject({ mode: "review", key: "114:1" });
});
test("recommendations honor due recall, confidence and study progress", () => {
  const { store } = fixture(),
    state = store.snapshot(),
    goals = { targets: [112], known: [], confidence: "new" };
  expect(
    nextStep(state, { dueNow: [], suggested: [] }, goals, surahs).mode,
  ).toBe("practice");
  expect(
    nextStep(
      state,
      { dueNow: [], suggested: [] },
      { ...goals, confidence: "shaky" },
      surahs,
    ).mode,
  ).toBe("quiz");
  expect(
    nextStep(state, { dueNow: [{ key: "1:2" }], suggested: [] }, goals, surahs)
      .key,
  ).toBe("1:2");
  state.records["112:1"] = {
    game: { completed: true },
    memory: { stage: "studying", history: [] },
  };
  expect(
    nextStep(state, { dueNow: [], suggested: [] }, goals, surahs).mode,
  ).toBe("quiz");
});
test("activity is deduplicated and day streaks respect timezone boundaries, breaks and best run", () => {
  const { saved, store } = fixture();
  for (const date of [
    "2026-10-12T18:00Z",
    "2026-10-13T18:00Z",
    "2026-10-14T18:00Z",
  ]) {
    trackStudy(saved, "1:1", "practice", new Date(date), "America/Chicago");
    trackStudy(saved, "1:1", "practice", new Date(date), "America/Chicago");
  }
  expect(
    summarizeActivity(store.snapshot(), saved, new Date("2026-10-15T03:00Z")),
  ).toMatchObject({ today: "2026-10-14", current: 3, best: 3 });
  expect(
    summarizeActivity(store.snapshot(), saved, new Date("2026-10-16T18:00Z")),
  ).toMatchObject({ current: 0, best: 3 });
  expect(
    JSON.parse(saved.getItem("ayah-activity-v1")).days["2026-10-14"].sessions,
  ).toHaveLength(1);
});
test("legacy dated histories populate activity without inventing old days or changing XP", () => {
  const { store, saved } = fixture(),
    state = store.snapshot();
  state.records["1:1"] = {
    game: {
      completed: true,
      history: [{ at: "2026-10-14T18:00:00Z", xp: 8, stars: 2 }],
    },
    memory: { stage: "new", history: [] },
  };
  const activity = summarizeActivity(
    state,
    saved,
    new Date("2026-10-14T20:00Z"),
  );
  expect(activity.days["2026-10-14"]).toMatchObject({
    puzzles: 1,
    xp: 8,
    stars: 2,
  });
  expect(Object.keys(activity.days)).toHaveLength(1);
});
test("unrecognized activity data is preserved rather than reset", () => {
  const { saved } = fixture();
  saved.setItem("ayah-activity-v1", '{"version":99}');
  expect(() => trackStudy(saved, "1:1", "practice")).toThrow(/recovery/);
  expect(saved.getItem("ayah-activity-v1")).toBe('{"version":99}');
});
test("account namespaces never inherit guest or other users and switching restores each profile", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { selectProfile, profileStorage } =
      await import("/src/learner/profile-storage.js");
    profileStorage.setItem("privacy-test", "guest");
    selectProfile("user-a");
    const initial = profileStorage.getItem("privacy-test");
    profileStorage.setItem("privacy-test", "A");
    selectProfile("user-b");
    const b = profileStorage.getItem("privacy-test");
    profileStorage.setItem("privacy-test", "B");
    selectProfile("user-a");
    const a = profileStorage.getItem("privacy-test");
    selectProfile(null);
    return { initial, b, a, guest: profileStorage.getItem("privacy-test") };
  });
  expect(result).toEqual({ initial: null, b: null, a: "A", guest: "guest" });
});
test("goal form and recommendations persist through reload and navigation to the target surah", async ({
  page,
}) => {
  await page.goto("/");
  await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
  await page.getByRole("button", { name: "Set my goals", exact: true }).click();
  await page.locator('[name="aim"]').selectOption("surahs");
  await page.locator('[name="target"][value="114"]').check();
  await page.locator('[name="known"][value="1"]').check();
  await page.locator('[name="confidence"]').selectOption("shaky");
  await page.getByRole("button", { name: "Save my plan" }).click();
  await expect(page.locator(".recommendation-card")).toContainText(
    "Puzzle Quest",
  );
  await page.reload();
  await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
  await expect(page.locator(".recommendation-card")).toContainText("An-Nas");
  await page.locator("[data-next-step]").click();
  await expect(page.locator('[data-mode="quiz"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".surah-heading")).toContainText("An-Nas");
});
test("study history, graphics, and monthly activity survive reload without farming XP", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".word-bank [data-word]").first().click();
  await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
  await expect(page.locator(".streak-grid")).toContainText("1 day active");
  await expect(page.locator(".achievement-badge")).toHaveCount(6);
  await expect(page.locator(".activity-day.active")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
  await expect(page.locator(".activity-day.active")).toHaveCount(1);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-learning-v1")),
  );
  expect(state.wallet.xp).toBe(0);
});
test("configured account entry offers signup and Google without sending email automatically", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/auth/v1/otp", (route) => {
    requests++;
    return route.fulfill({ json: {} });
  });
  await page.goto("/");
  await (await menu(page)).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator('[data-auth-mode="signup"]')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  expect(requests).toBe(0);
});

test("earned badges survive later lapses while current memory remains separate", () => {
  const saved = storage();
  const before = preserveAchievements(saved, [
    { id: "surah", value: 1, target: 1 },
  ]);
  const after = preserveAchievements(saved, [
    { id: "surah", value: 0, target: 1 },
  ]);
  expect(after[0].value).toBe(1);
  expect(after[0].earnedAt).toBe(before[0].earnedAt);
});

test("malformed goal fields are not rendered or silently repaired", () => {
  const saved = storage();
  const raw = JSON.stringify({
    version: 1,
    aim: "daily",
    minutes: "<img src=x onerror=alert(1)>",
    days: 5,
    targets: [1],
    known: [],
    confidence: "new",
  });
  saved.setItem("ayah-goals-v1", raw);
  expect(readGoals(saved)).toBe(null);
  expect(saved.getItem("ayah-goals-v1")).toBe(raw);
});

test("learning export includes goals and activity without recording blobs", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".word-bank [data-word]").first().click();
  await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
  await page.locator('[data-confidence="shaky"]').click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-learning").click();
  const download = await downloadEvent;
  const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(exported.learning).toBeTruthy();
  expect(exported.profile["ayah-goals-v1"]).toBeTruthy();
  expect(exported.profile["ayah-activity-v1"]).toBeTruthy();
  expect(
    Object.keys(exported.profile).some((key) => key.includes("recording")),
  ).toBe(false);
});
