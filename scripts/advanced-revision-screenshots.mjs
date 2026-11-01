// Local QA uses actual native assessment APIs; no fixture learning history ships in src/.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { enableDeveloperLab } from "../tests/developer-lab-helper.js";
import { menu } from "../tests/menu-helper.js";
import { seedRescue, gradeRescue } from "../tests/rescue-helper.js";
mkdirSync("docs/advanced-revision-previews", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
async function open(page, mode) {
  await enableDeveloperLab(page);
  await menu(page);
  await page
    .getByRole("button", {
      name: mode === "boss" ? "Muraja’ah Boss Rush" : "Hifz Survival",
      exact: true,
    })
    .click();
  await page.locator("[data-rv-form]").waitFor();
}
async function grade(page, value = "Good") {
  await page.locator("[data-rv-recall]").click();
  await gradeRescue(page, value);
}
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1250],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: name === "mobile",
      reducedMotion: "reduce",
    });
    await page.goto(
      process.env.ADVANCED_PREVIEW_URL || "http://127.0.0.1:5196",
    );
    await open(page, "boss");
    await page.locator("[name=preset]").selectOption("standard");
    await page.locator("[name=last]").fill("3");
    await page.locator("[data-rv-form] button[type=submit]").click();
    await page.locator(".rv-tower").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/advanced-revision-previews/${name}-boss-gates.png`,
    });
    await grade(page);
    await grade(page);
    await page.locator("[data-rv-choices]").click();
    await page.locator("[data-rv-choice]").first().waitFor();
    if (name === "mobile")
      await page.locator(".rv-challenge").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `docs/advanced-revision-previews/${name}-boss-discrimination.png`,
    });
    await page.locator("[data-rv-close]").click();
    // Separate controlled Survival fixture from the earlier Boss assessments.
    await page.evaluate(() =>
      localStorage.removeItem("ayah-passage-recall-v1"),
    );
    await seedRescue(page, {
      keys: ["1:1", "1:2", "1:3", "1:4", "1:5"],
      ages: [3],
    });
    await open(page, "survival");
    await page.locator("[name=length]").selectOption("extended");
    await page.locator("[data-rv-due]").click();
    await page.locator("[data-rv-form] button[type=submit]").click();
    await page.locator(".rv-trail").waitFor();
    if (name === "mobile")
      await page.locator(".rv-hud").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `docs/advanced-revision-previews/${name}-survival-trail.png`,
    });
    await grade(page, "Again");
    await grade(page);
    await grade(page);
    await page.locator("[data-rv-camp]").waitFor();
    if (name === "mobile")
      await page.locator(".rv-station").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `docs/advanced-revision-previews/${name}-survival-camp.png`,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
