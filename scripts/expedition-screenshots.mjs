// Local visual QA only. The private pilot uses an existing verified fixture and mock authorization.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mockBilling } from "../tests/billing-fixtures.js";
import { enableDeveloperLab } from "../tests/developer-lab-helper.js";
import { menu } from "../tests/menu-helper.js";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const [name, width, height, privatePilot] of [
    ["desktop", 1440, 1040, true],
    ["mobile", 390, 844, false],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    await mockBilling(page, { signed: privatePilot, plan: "pathfinder" });
    if (privatePilot) {
      const fixture = JSON.parse(
        readFileSync(new URL("../tests/fixtures/2-282.json", import.meta.url)),
      );
      await page.route("**/functions/v1/quran-content", (r) =>
        r.fulfill({ json: fixture }),
      );
    }
    await page.goto(
      process.env.EXPEDITION_PREVIEW_URL || "http://127.0.0.1:5193",
    );
    await enableDeveloperLab(page);
    await menu(page);
    await page
      .getByRole("button", { name: "Passage Expedition", exact: true })
      .click();
    await page.evaluate(() => document.fonts.ready);
    if (name === "desktop")
      await page.screenshot({ path: "docs/expedition-previews/selection.png" });
    if (privatePilot) {
      await page.locator("[name=juz]").selectOption("3");
      await page.locator("[name=surah]").selectOption("2");
      await page.locator("[name=first]").selectOption("2:282");
    }
    await page.getByRole("button", { name: "Chart my constellation" }).click();
    await page.locator("[data-ex-discover]").click();
    await page.locator("[data-ex-next]").click();
    await page.locator("[data-ex-bank] [data-ex-piece]").first().waitFor();
    const pieces = await page
      .locator("[data-ex-bank] [data-ex-piece]")
      .evaluateAll((bs) =>
        bs.map((b) => Number(b.dataset.exPiece)).sort((a, b) => a - b),
      );
    for (const id of pieces.slice(0, 2))
      await page.locator(`[data-ex-piece="${id}"]`).click();
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".success-celebration").waitFor({ state: "hidden" });
    await page.screenshot({
      path: `docs/expedition-previews/${name}-forge.png`,
    });
    if (name === "mobile") {
      await page
        .locator(".passage-expedition")
        .evaluate((el) => (el.scrollTop = 0));
      await page.screenshot({
        path: "docs/expedition-previews/mobile-map.png",
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
