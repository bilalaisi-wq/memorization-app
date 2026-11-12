import { expect, test } from "@playwright/test";
// Dev intentionally does not install a production worker or emit an offline manifest.
test.beforeEach(({baseURL})=>{test.skip(!baseURL?.includes(':5185'),'Run production worker cases with playwright.offline.config.js.');});
async function manager(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.locator("[data-download-manager]").click();
  await expect(page.locator(".offline-manager")).toBeVisible();
}
test("real production downloads have preview, verified storage, airplane-mode reload and playable free study", async ({ page, context }) => {
  await manager(page);
  await page.locator("[data-offline-selection]").selectOption("surah:112");
  await page.locator("[data-offline-audio]").selectOption("audio");
  await page.locator("[data-offline-estimate]").click();
  await expect(page.locator("[data-offline-size]")).toContainText(
    "offline app files",
  );
  await expect(page.locator("[data-offline-start]")).toBeEnabled();
  await page.locator("[data-offline-start]").click();
  await expect(page.locator('[data-package="surah:112"]')).toContainText(
    "ready",
  );
  await page.locator('[data-offline-read="surah:112"]').click();
  await expect(page.locator(".offline-reading")).toContainText("قُلْ");
  await expect(page.locator("[data-reader-audio] audio")).toBeVisible();
  const audio = await page.request.get("/audio/112001.mp3");
  expect(audio.ok()).toBe(true);
  const expectedBytes = (await audio.body()).length;
  await page.locator("[data-offline-close]").click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#nav-learn")).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.locator("[data-download-manager]").click();
  await expect(page.locator('[data-package="surah:112"]')).toContainText(
    "ready",
  );
  await page.locator('[data-offline-read="surah:112"]').click();
  await expect(page.locator(".offline-reading")).toContainText("قُلْ");
  await page.locator("[data-reader-next]").click();
  await expect(page.locator(".offline-reading")).toContainText("ٱلصَّمَدُ");
  const cached = await page.evaluate(async () => {
    const response = await fetch("/audio/112001.mp3");
    return {
      status: response.status,
      bytes: (await response.arrayBuffer()).byteLength,
    };
  });
  expect(cached).toEqual({ status: 200, bytes: expectedBytes });
  const range = await page.evaluate(async () => {
    const r = await fetch("/audio/112001.mp3", {
      headers: { Range: "bytes=0-99" },
    });
    return {
      status: r.status,
      size: (await r.arrayBuffer()).byteLength,
      range: r.headers.get("content-range"),
    };
  });
  expect(range.status).toBe(206);
  expect(range.size).toBe(100);
  expect(range.range).toMatch(/^bytes 0-99\//);
  await page.screenshot({
    path: "/workspace/artifacts/offline-manager-desktop.png",
    fullPage: true,
  });
  await page.locator("[data-offline-close]").click();
  await page.locator("#nav-learn").click();
  await expect(
    page.locator(".builder,.passage-studio,.workspace,.building-zone").first(),
  ).toBeVisible();
});
test("text-only mobile download, account-safe removal, retry controls and private endpoint exclusion", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await manager(page);
  await page.locator("[data-offline-selection]").selectOption("surah:112");
  await page.locator("[data-offline-estimate]").click();
  await expect(page.locator("[data-offline-start]")).toBeEnabled();
  await page.locator("[data-offline-start]").click();
  await expect(page.locator('[data-package="surah:112"]')).toContainText(
    "ready",
  );
  await page.locator('[data-offline-read="surah:112"]').click();
  await expect(page.locator("[data-reader-audio]")).toContainText(
    "No downloaded audio",
  );
  expect(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth + 1
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/workspace/artifacts/offline-manager-mobile.png",
    fullPage: true,
  });
  const cached = await page.evaluate(async () => {
    const found = [];
    for (const name of await caches.keys()) {
      for (const r of await (await caches.open(name)).keys()) {
        found.push(r.url);
      }
    }
    return found;
  });
  expect(
    cached.some((p) =>
      /supabase|quran-content|auth\/|stripe|ayah-user|recording/.test(p)
    ),
  ).toBe(false);
  await page.locator('[data-offline-remove="surah:112"]').click();
  await expect(page.locator("[data-offline-library]")).toContainText(
    "No offline downloads",
  );
  await expect(page.locator("[data-offline-status]")).toContainText(
    "FSRS schedules are unchanged",
  );
  await page.locator("[data-offline-close]").click();
  await context.setOffline(true);
  const denied = await page.evaluate(async () => {
    try {
      await fetch("/functions/v1/quran-content", {
        method: "POST",
        body: JSON.stringify({ key: "2:255" }),
      });
      return false;
    } catch {
      return true;
    }
  });
  expect(denied).toBe(true);
});
test("size estimation locks selection and rejects stale programmatic changes before allowing Download", async ({ page }) => {
  await manager(page);
  await page.locator("[data-offline-selection]").selectOption("surah:112");
  await page.evaluate(() =>
    Object.defineProperty(navigator.storage, "estimate", {
      configurable: true,
      value: () =>
        new Promise((resolve) => {
          window.finishOfflineQuota = resolve;
        }),
    })
  );
  await page.locator("[data-offline-estimate]").click();
  await page.waitForFunction(() =>
    typeof window.finishOfflineQuota === "function"
  );
  await expect(page.locator("[data-offline-selection]")).toBeDisabled();
  await expect(page.locator("[data-offline-audio]")).toBeDisabled();
  await expect(page.locator("[data-offline-start]")).toBeDisabled();
  await page.evaluate(() => {
    const select = document.querySelector("[data-offline-selection]");
    select.value = "surah:114";
    select.dispatchEvent(new Event("change"));
    window.finishOfflineQuota({ quota: 1e9, usage: 0 });
  });
  await expect(page.locator("[data-offline-status]")).toContainText(
    "Selection changed",
  );
  await expect(page.locator("[data-offline-start]")).toBeDisabled();
  await expect(page.locator("[data-offline-selection]")).toBeEnabled();
  await expect(page.locator("[data-offline-audio]")).toBeEnabled();
  await page.evaluate(() => {
    window.finishOfflineQuota = null;
  });
  await page.locator("[data-offline-estimate]").click();
  await page.waitForFunction(() =>
    typeof window.finishOfflineQuota === "function"
  );
  await page.evaluate(() =>
    window.finishOfflineQuota({ quota: 1e9, usage: 0 })
  );
  await expect(page.locator("[data-offline-start]")).toBeEnabled();
  await expect(page.locator("[data-offline-size]")).toContainText("6 ayahs");
  await page.locator("[data-offline-start]").click();
  await expect(page.locator('[data-package="surah:114"]')).toContainText(
    "ready",
  );
  await expect(page.locator('[data-package="surah:112"]')).toHaveCount(0);
});
test("online recitation falls back to verified network audio when IndexedDB is unavailable", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const before = await page.evaluate(async () => {
    const r = await fetch("/audio/112001.mp3");
    return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
  });
  expect(before.status).toBe(200);
  expect(before.bytes).toBeGreaterThan(0);
  const worker = context.serviceWorkers()[0];
  await worker.evaluate(() => {
    indexedDB.open = () => {
      throw Error("TEST ONLY IndexedDB unavailable");
    };
  });
  const after = await page.evaluate(async () => {
    const r = await fetch("/audio/112001.mp3");
    return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
  });
  expect(after).toEqual(before);
});
