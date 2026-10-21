// Explicitly mocked test accounts, entitlements and prices for visual QA only.
import { chromium } from "@playwright/test";
import { billingUser, mockBilling } from "../tests/billing-fixtures.js";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:5174",
  out = "docs/billing-previews";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const theme of ["simple", "night-sky"]) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    await mockBilling(page, { plan: "explorer", cancel: true });
    await page.addInitScript(
      ({ theme, id }) =>
        localStorage.setItem(
          `ayah-user:${id}:ayah-appearance-v1`,
          JSON.stringify({
            version: 1,
            theme,
            reduceEffects: true,
            updatedAt: new Date().toISOString(),
          }),
        ),
      { theme, id: billingUser.id },
    );
    await page.goto(base);
    await page.locator("#site-menu-toggle").click();
    await page.getByRole("button", { name: "Plans & pricing", exact: true })
      .click();
    await page.locator(".pricing-grid").waitFor();
    await page.locator(".pricing-dialog").screenshot({
      path: `${out}/${theme}-pricing.jpg`,
      type: "jpeg",
      quality: 88,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${out}/${theme}-phone.jpg`,
      type: "jpeg",
      quality: 88,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1000, height: 1100 });
    await page.locator("#site-menu-toggle").click();
    await page.getByRole("button", {
      name: "Subscription & billing",
      exact: true,
    }).click();
    await page.locator(".billing-summary").waitFor();
    await page.locator(".billing-dialog").screenshot({
      path: `${out}/${theme}-account.jpg`,
      type: "jpeg",
      quality: 88,
    });
    await context.close();
  }
  await writeFile(
    `${out}/README.md`,
    "# Billing UI previews\n\nAll screenshots use mocked test accounts and server entitlements for visual QA. They do not show a real purchase or prove hosted Stripe billing works.\n\n- [Simple pricing](simple-pricing.jpg)\n- [Night Sky pricing](night-sky-pricing.jpg)\n- [Simple phone](simple-phone.jpg)\n- [Night Sky phone](night-sky-phone.jpg)\n- [Simple billing account](simple-account.jpg)\n- [Night Sky billing account](night-sky-account.jpg)\n\nRegenerate using `node scripts/billing-screenshots.mjs` against an internal development server. See [setup and acceptance checklist](../billing.md).\n",
  );
} finally {
  await browser.close();
}
