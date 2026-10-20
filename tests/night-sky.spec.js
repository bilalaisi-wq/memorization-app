import { test, expect } from "@playwright/test";
import { createLearningStore } from "../src/learning-store.js";
import { surahs } from "../src/data.js";
const appearance = {
  version: 1,
  theme: "night-sky",
  reduceEffects: true,
  updatedAt: "2026-10-20T12:00:00Z",
};
const night = (page) =>
  page.addInitScript(
    (value) =>
      localStorage.setItem("ayah-appearance-v1", JSON.stringify(value)),
    appearance,
  );
async function chooser(page) {
  await page
    .getByRole("button", { name: "Encouragement settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Choose theme", exact: true }).click();
}
function retainedFixture() {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
  };
  const store = createLearningStore(storage, surahs, {
    timeZone: "UTC",
    clock: () => new Date("2026-10-01T12:00Z"),
  });
  for (const a of [1, 2, 3])
    for (let day = 0; day < 3; day++) {
      const due = store.getRecord(`108:${a}`).memory.nextReview;
      const now = new Date(
        Math.max(
          Date.parse(`2026-10-${String(day + 1).padStart(2, "0")}T12:00Z`),
          due ? Date.parse(due) : 0,
        ),
      );
      const attempt = store.beginRecall(`108:${a}`, now);
      store.updateRecall(attempt.id, "compare");
      store.gradeRecall(attempt.id, "Good", now);
    }
  return Object.fromEntries(map);
}
test("Simple remains default and preview/cancel/apply/reload preserve games and exact Simple pixels", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.locator(".reference-card")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "simple");
  const canonical = await page.evaluate(() =>
    localStorage.getItem("ayah-learning-v1"),
  );
  const before = await page.screenshot({ fullPage: true });
  await chooser(page);
  await page.locator('[data-theme-choice="night-sky"]').click();
  await expect(page.locator(".sky-view")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".experience-dialog [data-close]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "simple");
  expect((await page.screenshot({ fullPage: true })).equals(before)).toBe(true);
  await chooser(page);
  await page.locator('[data-theme-choice="night-sky"]').click();
  await page.locator("[data-appearance-apply]").click();
  await page.locator(".experience-dialog [data-close]").click();
  await chooser(page);
  await page.locator('[data-theme-choice="simple"]').click();
  await page.locator("[data-appearance-apply]").click();
  await page.locator(".experience-dialog [data-close]").click();
  await expect(page.locator(".sky-view")).toHaveCount(0);
  expect((await page.screenshot({ fullPage: true })).equals(before)).toBe(true);
  await chooser(page);
  await page.locator('[data-theme-choice="night-sky"]').click();
  await page.locator("[data-appearance-apply]").click();
  await page.locator(".experience-dialog [data-close]").click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night-sky");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-learning-v1")),
  ).toBe(canonical);
});
test("failed preference persistence reports retry and cancel restores the saved theme", async ({
  page,
}) => {
  await page.goto("/");
  await chooser(page);
  await page.locator('[data-theme-choice="night-sky"]').click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.endsWith("ayah-appearance-v1")) throw new Error("quota");
      return original.call(this, k, v);
    };
  });
  await page.locator("[data-appearance-apply]").click();
  await expect(page.locator("[data-appearance-status]")).toContainText(
    "could not be saved",
  );
  await page.locator("[data-appearance-cancel]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "simple");
});
test("appearance is isolated per profile and missing optional server settings never change memory data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".reference-card")).toBeVisible();
  const result = await page.evaluate(async () => {
    const { selectProfile } = await import("/src/learner/profile-storage.js");
    const { saveAppearance } = await import("/src/themes/appearance.js");
    const before = localStorage.getItem("ayah-learning-v1");
    await saveAppearance({ theme: "night-sky", reduceEffects: true });
    selectProfile("a");
    const fresh = document.documentElement.dataset.theme;
    await saveAppearance({ theme: "night-sky", reduceEffects: false });
    selectProfile("b");
    const other = document.documentElement.dataset.theme;
    selectProfile(null);
    return {
      fresh,
      other,
      guest: document.documentElement.dataset.theme,
      unchanged: before === localStorage.getItem("ayah-learning-v1"),
    };
  });
  expect(result).toEqual({
    fresh: "simple",
    other: "simple",
    guest: "night-sky",
    unchanged: true,
  });
});
test("real retained records light exactly one star per ayah; puzzle wins do not light stars", async ({
  page,
}) => {
  await night(page);
  await page.addInitScript((values) => {
    for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
  }, retainedFixture());
  await page.goto("/");
  await page.getByRole("button", { name: "My plan & achievements" }).click();
  const card = page.locator('[data-sky-surah="108"]');
  // The catalogue is paginated: search brings the saved surah into view.
  await page.locator("#sky-surah-search").fill("108");
  await expect(card).toContainText("3 / 3 mastered");
  await expect(card.locator(".sky-node.mastered")).toHaveCount(3);
  await expect(page.locator(".celestial-complete")).toHaveCount(0);
  await page.locator("#nav-learn").evaluate((el) => el.click());
  await expect(
    page.locator("[data-active-constellation] .sky-node.mastered"),
  ).toHaveCount(0);
  await page.locator("#build-all").click();
  await page.locator("#next").click();
  await expect(
    page.locator("[data-active-constellation] .sky-node.mastered"),
  ).toHaveCount(0);
});
test("all core modes and all seven Lab games use dark surfaces without changing verified Arabic", async ({
  page,
}) => {
  await night(page);
  await page.goto("/");
  const text = await page
    .locator('.reference-card [lang="ar"]')
    .first()
    .textContent();
  for (const mode of ["practice", "quiz", "recall", "sequence"]) {
    await page.locator(`[data-mode="${mode}"]`).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "night-sky",
    );
    if (mode === "quiz" || mode === "recall") {
      await expect(page.locator(".reference-hidden")).toBeVisible();
      await page.locator("#reference-toggle").click();
    }
    if (mode !== "sequence")
      await expect(
        page.locator('.reference-card [lang="ar"]').first(),
      ).toHaveText(text);
  }
  await page.locator("#nav-lab").click();
  for (const game of [
    "falling",
    "vanishing",
    "jigsaw",
    "match",
    "chain",
    "continue",
    "detective",
  ]) {
    await page.locator(`[data-game="${game}"]`).click();
    expect(
      await page
        .locator(".lab-game")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(16, 22, 48)");
    await expect(page.locator(".lab-game")).toBeVisible();
  }
  await page.locator("#nav-gallery").click();
  await page.getByRole("tab", { name: "Poetic Tafsir", exact: true }).click();
  await expect(page.locator("#gallery-poetry-panel")).toBeVisible();
  await page.locator("#nav-daily").evaluate((el) => el.click());
  await expect(page.locator(".achievement-card").first()).toHaveCSS(
    "background-color",
    "rgb(16, 22, 48)",
  );
});
test("mobile, reduced motion, keyboard star navigation and high zoom remain usable", async ({
  page,
}) => {
  await night(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
  await page.goto("/");
  await expect(page.locator("#sky-backdrop")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(
    await page
      .locator("#sky-backdrop")
      .evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe("none");
  expect(
    await page
      .locator("#sky-backdrop i")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator('[data-star-key="1:1"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".self-assessment")).toBeVisible();
  await expect(page.locator(".verified-text")).toHaveCount(0);
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("long surahs paginate without unbounded interactive SVG nodes", async ({
  page,
}) => {
  await night(page);
  await page.goto("/");
  await page
    .locator("#surah-picker")
    .selectOption(String(surahs.findIndex((s) => s.id === 79)));
  await expect(
    page.locator("[data-active-constellation] [data-star-key]"),
  ).toHaveCount(24);
  await page.locator("[data-star-next]").click();
  await expect(
    page.locator("[data-active-constellation] [data-star-key]"),
  ).toHaveCount(22);
  await expect(page.locator("[data-active-constellation]")).toContainText("46");
});

test("account appearance can restore and save independently, with safe local fallback when the table is missing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".reference-card")).toBeVisible();
  const result = await page.evaluate(async () => {
    const { selectProfile } = await import("/src/learner/profile-storage.js");
    const { initializeAppearance, saveAppearance } =
      await import("/src/themes/appearance.js");
    const original = localStorage.getItem("ayah-learning-v1");
    selectProfile("appearance-account");
    let uploaded;
    const setting = {
      version: 1,
      theme: "night-sky",
      reduceEffects: true,
      updatedAt: new Date().toISOString(),
    };
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { settings: setting } }),
          }),
        }),
        upsert: async (row) => {
          uploaded = row;
          return { error: null };
        },
      }),
    };
    initializeAppearance({ client, userId: "appearance-account" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const restored = document.documentElement.dataset.theme;
    await saveAppearance({ theme: "simple", reduceEffects: true });
    const sent = uploaded.user_id;
    initializeAppearance({
      client: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                error: { message: "table missing" },
              }),
            }),
          }),
          upsert: async () => ({ error: { message: "table missing" } }),
        }),
      },
      userId: "appearance-account",
    });
    const status = await saveAppearance({
      theme: "night-sky",
      reduceEffects: true,
    });
    return {
      restored,
      sent,
      status,
      unchanged: original === localStorage.getItem("ayah-learning-v1"),
    };
  });
  expect(result).toMatchObject({
    restored: "night-sky",
    sent: "appearance-account",
    unchanged: true,
  });
  expect(result.status).toContain("learning sync is unaffected");
});

test("a delayed settings response cannot leak an earlier profile theme after switching accounts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".reference-card")).toBeVisible();
  const result = await page.evaluate(async () => {
    const { selectProfile } = await import("/src/learner/profile-storage.js");
    const { initializeAppearance } = await import("/src/themes/appearance.js");
    selectProfile("old-account");
    let resolve;
    const delayed = new Promise((done) => {
      resolve = done;
    });
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => delayed }) }),
      }),
    };
    initializeAppearance({ client, userId: "old-account" });
    selectProfile("new-account");
    resolve({
      data: {
        settings: {
          version: 1,
          theme: "night-sky",
          reduceEffects: true,
          updatedAt: new Date().toISOString(),
        },
      },
    });
    await new Promise((done) => setTimeout(done, 0));
    return {
      theme: document.documentElement.dataset.theme,
      other: localStorage.getItem("ayah-user:new-account:ayah-appearance-v1"),
    };
  });
  expect(result).toEqual({ theme: "simple", other: null });
});
