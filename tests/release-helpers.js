import { expect } from "@playwright/test";
import { enableDeveloperLab } from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
import { seedRescue } from "./rescue-helper.js";
export const auditModes = {
  expedition: {
    label: "Passage Expedition",
    root: ".passage-expedition",
    close: "[data-ex-exit]",
  },
  rescue: {
    label: "Constellation Rescue",
    root: ".constellation-rescue",
    close: "[data-cr-close]",
  },
  repair: {
    label: "Memory Repair Workshop",
    root: ".memory-repair",
    close: "[data-repair-close]",
  },
  boss: {
    label: "Muraja’ah Boss Rush",
    root: ".advanced-revision",
    close: "[data-rv-close]",
  },
  survival: {
    label: "Hifz Survival",
    root: ".advanced-revision",
    close: "[data-rv-close]",
  },
};
export async function openAuditMode(page, mode, { enable = true } = {}) {
  if (enable) await enableDeveloperLab(page);
  await menu(page);
  await page
    .getByRole("button", { name: auditModes[mode].label, exact: true })
    .click();
  await expect(page.locator(auditModes[mode].root)).toBeVisible();
}
export async function seedAuditRecords(page) {
  await seedRescue(page, {
    keys: ["1:1", "1:2", "1:3", "1:4", "1:5"],
    ages: [3],
  });
  await page.evaluate(async () => {
    const { surahs } = await import("/src/data.js"),
      { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js"),
      { createSession, reduceSession } =
        await import("/src/puzzles/arcade/session.js"),
      { selectionEvidence } = await import("/src/puzzles/arcade/evidence.js");
    const lab = createPuzzleStore(localStorage, surahs);
    for (const [key, category] of [
      ["1:1", "selection"],
      ["1:2", "order"],
    ]) {
      const word = (k, i) => ({ id: `${k}:${i}`, key: k, index: i });
      let s = createSession({
        id: `audit:${key}`,
        game: "asteroids",
        config: { keys: [key], chainMode: "practice" },
      });
      s = reduceSession(s, { type: "start" });
      s = reduceSession(s, {
        type: "mistake",
        ...selectionEvidence(
          word(category === "order" ? key : "112:1", 1),
          word(key, 0),
        ),
      });
      lab.record({
        key,
        sessionId: `audit:${key}`,
        game: "asteroids",
        mistakes: s.mistakes.length,
        hinted: key === "1:2",
        xp: 0,
        arcade: { mistakes: s.mistakes, motorErrors: [], assistance: [] },
      });
    }
  });
}
export async function chartAudit(page) {
  await page.locator("[name=juz]").selectOption("1");
  await page.locator("[name=surah]").selectOption("1");
  await page.locator("[name=first]").selectOption("1:1");
  await page.getByRole("button", { name: "Chart my constellation" }).click();
  await expect(page.locator("[data-ex-discover]")).toBeVisible();
}
export async function connectAudit(page) {
  await expect(
    page.locator("[data-ex-bank] [data-ex-piece]").first(),
  ).toBeVisible();
  const ids = await page
    .locator("[data-ex-bank] [data-ex-piece]")
    .evaluateAll((ns) =>
      ns.map((n) => Number(n.dataset.exPiece)).sort((a, b) => a - b),
    );
  for (const id of ids)
    await page.locator(`[data-ex-bank] [data-ex-piece="${id}"]`).click();
  await page.locator("[data-ex-check]").click();
}
