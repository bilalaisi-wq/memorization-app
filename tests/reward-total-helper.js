import { expect } from "@playwright/test";
// Assert preservation of original reward rules AND the new all-mode displayed total.
export async function expectDisplayedLearningXP(page, originalXP) {
  const totals = await page.evaluate(() => ({
    wallet: JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet.xp,
    study: (JSON.parse(localStorage.getItem("ayah-rewards-v1"))?.events || [])
      .reduce((n, e) => n + e.xp, 0),
  }));
  expect(totals.wallet).toBe(originalXP);
  await expect(page.locator(".xp-line")).toContainText(
    `${originalXP + totals.study} XP`,
  );
}
