// Controlled local QA: canonical data + actual self-assessment APIs, no production demo records.
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  auditModes,
  openAuditMode,
  seedAuditRecords,
  chartAudit,
} from "../tests/release-helpers.js";
import { mockBilling } from "../tests/billing-fixtures.js";
const dir = "docs/release-audit";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const report = {
  environment: {
    browser: browser.version(),
    source: "local Vite; mocked account endpoints; QA records only",
    mobileCpuSlowdown: 4,
    network: "loopback, no network throttling",
    budgets: { modalSceneMs: 2500, maxHorizontalOverflowPx: 2, minTouchPx: 44 },
  },
  cases: [],
  inventory: null,
};
try {
  for (const [width, height] of [
    [320, 780],
    [390, 844],
    [768, 1024],
    [1440, 1100],
  ])
    for (const theme of ["simple", "night-sky"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: width < 800,
        reducedMotion: "reduce",
        timezoneId: "America/Chicago",
      });
      await mockBilling(page, { signed: false });
      await page.goto(process.env.RELEASE_AUDIT_URL || "http://127.0.0.1:5197");
      await seedAuditRecords(page);
      await page.evaluate(async (theme) => {
        const { profileStorage } =
            await import("/src/learner/profile-storage.js"),
          { initializeAppearance } = await import("/src/themes/appearance.js");
        profileStorage.setItem(
          "ayah-appearance-v1",
          JSON.stringify({
            version: 1,
            theme,
            reduceEffects: true,
            updatedAt: new Date().toISOString(),
          }),
        );
        initializeAppearance();
        const { buildRevisionPlan, selectSurvival } =
            await import("/src/quest/advanced/model.js"),
          { createRevisionStore } =
            await import("/src/quest/advanced/store.js"),
          { createPassageMemory } = await import("/src/passage/memory.js");
        const memory = createPassageMemory(localStorage),
          store = createRevisionStore({
            storage: localStorage,
            owner: null,
            getOwner: () => null,
          });
        let { plan } = await buildRevisionPlan({
          mode: "boss",
          preset: "standard",
          refs: ["1:5", "1:6", "1:7"],
        });
        const r = store.create(plan);
        for (let i = 0; i < 2; i++) {
          store.begin(r.id);
          const a = memory.begin(plan.checkpoints[i].unit);
          memory.update("declared");
          memory.update("compared");
          memory.grade(a.id, "Good", { assessmentSource: "self-assessed" });
          store.apply(r.id, memory.snapshot());
        }
        const units = selectSurvival(
          memory.snapshot(),
          Object.keys(memory.snapshot().records),
          { length: "extended" },
        );
        ({ plan } = await buildRevisionPlan({
          mode: "survival",
          units,
          length: "extended",
        }));
        store.create(plan);
      }, theme);
      const cdp = await page.context().newCDPSession(page);
      if (width <= 390)
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.evaluate(() => document.fonts.ready);
      for (const mode of Object.keys(auditModes)) {
        const samples = [];
        let measurements;
        for (let n = 0; n < 2; n++) {
          await page.evaluate(() => {
            window.auditLong = [];
            window.auditObserver?.disconnect();
            window.auditObserver = new PerformanceObserver((list) =>
              window.auditLong.push(
                ...list.getEntries().map((e) => e.duration),
              ),
            );
            window.auditObserver.observe({ type: "longtask", buffered: false });
          });
          const before = await page.evaluate(() =>
              localStorage.getItem("ayah-passage-recall-v1"),
            ),
            start = performance.now();
          await openAuditMode(page, mode);
          if (mode === "expedition") await chartAudit(page);
          if (mode === "boss") {
            await page.locator("[data-rv-resume]").first().click();
            await page.locator("[data-rv-choices]").click();
            await page.locator("[data-rv-choice]").first().waitFor();
          }
          if (mode === "survival")
            await page.locator("[data-rv-resume]").first().click();
          await page.evaluate(
            () =>
              new Promise((r) =>
                requestAnimationFrame(() => requestAnimationFrame(r)),
              ),
          );
          samples.push(Math.round(performance.now() - start));
          measurements = await page
            .locator(auditModes[mode].root)
            .evaluate((root) => {
              const visible = (e) =>
                e.getClientRects().length &&
                !e.closest("[hidden]") &&
                getComputedStyle(e).visibility !== "hidden";
              const controls = [
                ...root.querySelectorAll("button:not(:disabled),input,select"),
              ].filter(visible);
              const smallControls = controls
                .map((e) => {
                  const hit = e.matches("input[type=checkbox]")
                    ? e.closest("label") || e
                    : e;
                  const r = hit.getBoundingClientRect();
                  return {
                    label: (
                      e.getAttribute("aria-label") ||
                      e.textContent ||
                      e.name ||
                      e.id ||
                      e.type
                    )
                      .trim()
                      .slice(0, 90),
                    width: Math.round(r.width),
                    height: Math.round(r.height),
                  };
                })
                .filter((r) => r.width < 43 || r.height < 43);
              const arabic = [...root.querySelectorAll(".arabic")].filter(
                visible,
              );
              return {
                overflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
                smallControls,
                arabicElements: arabic.length,
                minArabicFontPx: arabic.length
                  ? Math.min(
                      ...arabic.map((e) =>
                        parseFloat(getComputedStyle(e).fontSize),
                      ),
                    )
                  : null,
                clippedArabic: arabic.filter(
                  (e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2,
                ).length,
                maxLongTaskMs: Math.round(Math.max(0, ...window.auditLong)),
              };
            });
          if (theme === "night-sky" && [390, 1440].includes(width) && n === 1) {
            if (width === 390 && mode === "expedition")
              await page.locator(".ex-stage").scrollIntoViewIfNeeded();
            if (width === 390 && mode === "boss")
              await page.locator(".rv-challenge").scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `${dir}/${width < 800 ? "mobile" : "desktop"}-${mode}.png`,
            });
          }
          await page.locator(auditModes[mode].close).click();
          if (
            (await page.evaluate(() =>
              localStorage.getItem("ayah-passage-recall-v1"),
            )) !== before
          )
            throw Error(`${mode} changed FSRS on render`);
        }
        report.cases.push({
          width,
          height,
          theme,
          mode,
          samplesMs: samples,
          warmSceneMs: samples.at(-1),
          ...measurements,
        });
      }
      if (!report.inventory)
        report.inventory = await page.evaluate(async () => {
          const { surahs } = await import("/src/data.js"),
            { availability } = await import("/src/content/library.js");
          return {
            freeSurahs: surahs.length,
            freeAyahs: surahs.reduce((n, s) => n + s.verses.length, 0),
            privateAyahs: availability.premium.length,
          };
        });
      await page.close();
    }
  report.summary = {
    cases: report.cases.length,
    overflowCases: report.cases.filter((c) => c.overflowPx > 2).length,
    clippedArabicCases: report.cases.filter((c) => c.clippedArabic).length,
    smallControlCases: report.cases.filter((c) => c.smallControls.length)
      .length,
    slowWarmCases: report.cases.filter((c) => c.warmSceneMs > 2500).length,
    maxWarmMs: Math.max(...report.cases.map((c) => c.warmSceneMs)),
  };
  writeFileSync(`${dir}/metrics.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary));
} finally {
  await browser.close();
}
