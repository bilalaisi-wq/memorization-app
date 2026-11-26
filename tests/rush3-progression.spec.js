// Actual activity host + exact ignored operator sources. Authorization transport is mocked.
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { revisionUnits } from "../src/revision/adventures/content.js";
import { mountRush, driveRush } from "./rush3-ui-helper.js";
test("actual Surah Rush host covers Al-Araf 7:1–206 with every physical decision, 25-ayah choice, replay, save and resume", async ({
  page,
}) => {
  test.setTimeout(1800000);
  test.skip(
    !existsSync(".quran-private/7/206/bundle.json"),
    "Ignored operator source files required; not hosted-account verification"
  );
  const refs = Array.from({ length: 206 }, (_, i) => `7:${i + 1}`),
    units = {};
  for (const ref of refs)
    units[ref] = revisionUnits(
      JSON.parse(
        readFileSync(`.quran-private/${ref.replace(":", "/")}/bundle.json`)
      )
    ).map((u) => ({ id: u.id, text: u.text }));
  await page.route("https://rush-source.test/**", (r) => {
    const key = new URL(r.request().url()).searchParams.get("key");
    return r.fulfill({
      json: JSON.parse(
        readFileSync(`.quran-private/${key.replace(":", "/")}/bundle.json`)
      ),
    });
  });
  await mountRush(page, { refs, client: true, renderIntervalMs: 1000 });
  for (const at of [5, 10, 25, 50, 75, 100, 125, 150, 175, 200, 206]) {
    await driveRush(page, { goal: at, maxFrames: 170000, units });
    await expect(page.locator(".flow-battlefield")).toHaveAttribute(
      "data-covered",
      String(at)
    );
    console.log("physical-host milestone", at);
    if (at === 5 || at === 10) {
      await expect(page.locator(".rush-checkpoint")).toBeHidden();
      continue;
    }
    if (at < 206) {
      await expect(page.locator(".rush-checkpoint")).toContainText(`${at}/206`);
      await expect(page.locator(".flow-ribbon")).not.toContainText(
        "Passage complete"
      );
      if (at === 25) {
        await page.locator("[data-rush-checkpoint=replay]").click();
        await expect(
          page.locator(".rush-replay-shell [data-flow-start]")
        ).toBeEnabled();
        await page
          .locator(
            ".rush-replay-shell .gameplay-toolbar [data-game-command=exit]"
          )
          .click();
        await expect(page.locator(".rush-checkpoint")).toContainText("25/206");
      }
      if (at === 50) {
        await page.locator("[data-rush-checkpoint=exit]").click();
        await page.reload();
        await mountRush(page, { refs, client: true, renderIntervalMs: 1000 });
        await expect(page.locator(".rush-checkpoint")).toContainText("50/206");
      }
      await page.locator("[data-rush-checkpoint=continue]").click();
      expect(
        (await page.evaluate(() => window.rushActivity.getSnapshot())).refs
      ).toEqual(refs);
    }
  }
  expect(
    await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
        ).find((r) => r.refs.length === 206).finished
    )
  ).toBe(false);
  await page.evaluate(() => {
    const field = document.querySelector(".flow-battlefield");
    field.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, code: "ArrowRight" })
    );
    for (let i = 0; i < 1500; i++) {
      window.rushClock += 1000 / 60;
      for (const [id, fn] of [...window.rushFrames]) {
        window.rushFrames.delete(id);
        fn(window.rushClock);
      }
      if (window.rushActivity.getSnapshot().engine.status === "won") break;
    }
  });
  await expect(page.locator(".flow-ribbon")).toContainText(
    "Passage complete · 206/206"
  );
  const saved = await page.evaluate(() =>
    Object.values(
      JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
    ).find((r) => r.refs.length === 206)
  );
  expect(saved.completed).toBe(206);
  expect(saved.finished).toBe(true);
  expect(saved.rushCheckpoint.continued).toEqual([
    25, 50, 75, 100, 125, 150, 175, 200,
  ]);
  expect(JSON.stringify(saved)).not.toMatch(/[\u0600-\u06ff]/);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
  await expect(page.locator(".rush-route-signs")).toBeHidden();
  await page.locator(".flow-ribbon").screenshot({
    path: "docs/surah-rush3/al-araf-complete-no-private-text.png",
  });
});
