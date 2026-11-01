// Local QA evidence only. No demo learner data is included in production modules.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { enableDeveloperLab } from "../tests/developer-lab-helper.js";
import { menu } from "../tests/menu-helper.js";
mkdirSync("docs/repair-previews", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1100],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: name === "mobile",
      reducedMotion: "reduce",
    });
    await page.goto(process.env.REPAIR_PREVIEW_URL || "http://127.0.0.1:5195");
    await page.evaluate(async () => {
      const { createPuzzleStore } =
          await import("/src/puzzles/puzzle-store.js"),
        { surahs } = await import("/src/data.js");
      const lab = createPuzzleStore(localStorage, surahs);
      for (const [key, game, category] of [
        ["1:1", "asteroids", "word-selection"],
        ["1:2", "snake", "word-order"],
        ["1:3", "maze", "phrase-transition"],
      ])
        lab.record({
          key,
          game,
          sessionId: `qa:${key}`,
          mistakes: 1,
          hinted: key === "1:3",
          xp: 0,
          arcade: {
            mistakes: [
              {
                key,
                kind: "sequence",
                category,
                expected: [`${key}:0`],
                selected: ["112:1:0"],
                event: 1,
              },
            ],
            motorErrors: [],
            assistance: [],
          },
        });
      lab.record({
        key: "1:7",
        game: "detective",
        sessionId: "qa:similar",
        mistakes: 1,
        hinted: false,
        xp: 0,
      });
    });
    await enableDeveloperLab(page);
    await menu(page);
    await page
      .getByRole("button", { name: "Memory Repair Workshop", exact: true })
      .click();
    await page.locator(".repair-node").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/repair-previews/${name}-map.png` });
    await page
      .locator(".repair-node")
      .filter({ hasText: "Word selection" })
      .click();
    await page.screenshot({
      path: `docs/repair-previews/${name}-evidence.png`,
    });
    if (name === "mobile") {
      await page.locator("[data-repair-launch]").tap();
      await page.locator(".astro-stage").waitFor();
      await page.locator(".astro-controls").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "docs/repair-previews/mobile-mission.png",
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
