import { expect } from "@playwright/test";
import { enableDeveloperLab } from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
export const RESCUE_TIME = "2026-10-29T23:00:00.000Z";
// Actual existing FSRS grading under fixture clocks; never imported by production.
export async function seedRescue(
  page,
  {
    keys = ["1:1", "1:2", "1:3"],
    ages = [3, 15 / 1440, 0],
    signed = false,
    privateBundle = null,
  } = {},
) {
  if (signed)
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await import("/src/learner/profile-storage.js")).activeProfileId(),
        ),
      )
      .not.toBe(null);
  return page.evaluate(
    async ({ keys, ages, signed, privateBundle }) => {
      const { createPassageMemory, PASSAGE_MEMORY_KEY } = await import(
        "/src/passage/memory.js"
      );
      const { scopedStorage, activeProfileId } = await import(
        "/src/learner/profile-storage.js"
      );
      const { localBundle } = await import("/src/content/library.js");
      const { recallUnit } = await import("/src/passage/model.js");
      const storage = signed ? scopedStorage(activeProfileId()) : localStorage;
      let at = Date.now();
      const memory = createPassageMemory(storage, {
        clock: () => new Date(at),
        timeZone: "America/Chicago",
      });
      for (let i = 0; i < keys.length; i++) {
        at = Date.now() - ages[i % ages.length] * 86400000;
        const bundle =
          privateBundle?.key === keys[i] ? privateBundle : localBundle(keys[i]);
        const unit = await recallUnit([bundle]);
        const attempt = memory.begin(unit);
        memory.update("declared");
        memory.update("compared");
        memory.grade(attempt.id, "Good");
      }
      return {
        raw: storage.getItem(PASSAGE_MEMORY_KEY),
        snapshot: memory.snapshot(),
      };
    },
    { keys, ages, signed, privateBundle },
  );
}
export async function openRescue(page) {
  await enableDeveloperLab(page);
  await menu(page);
  await page
    .getByRole("button", { name: "Constellation Rescue", exact: true })
    .click();
  await expect(page.locator(".constellation-rescue")).toBeVisible();
}
export async function gradeRescue(
  page,
  grade = "Good",
  { declare = true } = {},
) {
  await expect(page.locator("[data-declare]")).toBeVisible();
  if (declare) await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await page.locator(`[data-grade="${grade}"]`).click();
  await page.locator(".passage-studio [data-close]").click();
}
