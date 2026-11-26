import { test, expect } from "@playwright/test";
import { localBundle } from "../src/content/library.js";
import { legalPositions } from "../src/revision/adventures/defense-maps.js";
async function open(page, { map = 0, memory = "guided", last = 7 } = {}) {
  await page.addInitScript(
    () =>
      (window.Audio = class {
        constructor() {
          (window.testRecitations ??= []).push(this);
        }
        play() {
          return Promise.resolve();
        }
        pause() {}
        load() {}
        removeAttribute() {}
      })
  );
  await page.goto("/");
  await page.locator("#nav-revision-lab").click();
  await page.locator("[data-revision-game=ayah-defense]").click();
  await page.locator("[name=selection]").selectOption("custom");
  await page.locator("[name=last]").fill(String(last));
  await page.locator("[name=memory]").selectOption(memory);
  await page.locator("[name=defenseMap]").selectOption(String(map));
  await page.getByRole("button", { name: "Prepare game", exact: true }).click();
  await page.locator("[data-flow-start]").waitFor();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.locator("[data-flow-start]").click();
  await expect(page.locator(".flow-battlefield")).toBeFocused();
}
async function correct(page, key) {
  await page
    .locator("[data-flow-choice]")
    .filter({ hasText: localBundle(key).textUthmani })
    .click();
}
async function screenPoint(page, p) {
  await page.locator(".flow-scene svg").scrollIntoViewIfNeeded();
  return page.locator(".flow-scene svg").evaluate((svg, p) => {
    const q = svg.createSVGPoint();
    q.x = p.x;
    q.y = p.y;
    const v = q.matrixTransform(svg.getScreenCTM());
    return { x: v.x, y: v.y };
  }, p);
}
test("zero-resource opening earns first tower, rejects track placement, buys free terrain exactly once and retains construction across settings", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".flow-hud")).toContainText(
    "Construction Points 0"
  );
  await expect(page.locator("[data-defense-buy=arrow]")).toBeDisabled();
  await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(0);
  for (const k of ["1:1", "1:2", "1:3"]) await correct(page, k);
  await expect(page.locator("[data-defense-buy=arrow]")).toBeEnabled();
  await page.locator("[data-defense-buy=arrow]").click();
  const bad = await screenPoint(page, { x: 200, y: 90 });
  await page.mouse.click(bad.x, bad.y);
  await expect(page.locator("[data-defense-preview]")).toHaveAttribute(
    "data-valid",
    "false"
  );
  await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(0);
  await expect(page.locator(".flow-hud")).toContainText(
    "Construction Points 60"
  );
  await page
    .locator(".gameplay-viewport")
    .screenshot({ path: "docs/defense2/invalid-foundation-desktop.png" });
  const good = await screenPoint(page, legalPositions(0)[0]);
  await page.mouse.click(good.x, good.y);
  await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(1);
  await expect(page.locator(".flow-hud")).toContainText(
    "Construction Points 10"
  );
  await page.locator("[data-game-command=settings]").click();
  await page.locator("[data-game-memory]").selectOption("standard");
  await page.locator("[data-defense-map-setting]").selectOption("1");
  await page.locator("[data-game-command=restart-challenge]").click();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "3"
  );
  await expect(page.locator(".flow-scene svg")).toHaveAttribute(
    "data-map",
    "grove"
  );
});
for (const code of [
  "Digit1",
  "Digit2",
  "Digit3",
  "Numpad1",
  "Numpad2",
  "Numpad3",
])
  test(`${code} commits displayed RTL choice once without confirmation and held keys cannot answer the next prompt`, async ({
    page,
  }) => {
    await open(page, { memory: "standard" });
    const n = Number(code.at(-1)) - 1,
      choice = await page
        .locator("[data-flow-choice]")
        .nth(n)
        .locator(".arabic")
        .textContent(),
      right = choice === localBundle("1:1").textUthmani;
    await page.keyboard.down(code);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const r = Object.values(
            JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
          )[0];
          return (
            r.completed + r.evidence.filter((e) => e.kind === "memory").length
          );
        })
      )
      .toBe(1);
    const projection = () => {
      const r = Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0];
      return [
        r.completed,
        r.unit,
        r.evidence.filter((e) => e.kind === "memory").length,
        r.arcade?.energy ?? 0,
        r.arcade?.accepted ?? [],
      ];
    };
    const before = await page.evaluate(projection);
    await page
      .locator(".flow-battlefield")
      .dispatchEvent("keydown", { code, key: code.at(-1), repeat: true });
    await page
      .locator(".flow-battlefield")
      .dispatchEvent("keydown", { code, key: code.at(-1), repeat: false });
    expect(await page.evaluate(projection)).toEqual(before);
    await page.keyboard.up(code);
    await expect(page.locator(".flow-battlefield")).toHaveAttribute(
      "data-covered",
      right ? "1" : "0"
    );
  });
for (const map of [0, 1, 2, 3])
  test(`map ${map}: original illustrated geometry, tap/keyboard placement and source ribbon at 390px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, { map });
    for (const k of ["1:1", "1:2", "1:3"]) await correct(page, k);
    await page.locator("[data-defense-buy=arrow]").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-defense-preview]")).toHaveCount(0);
    await expect(page.locator(".gameplay-settings")).toBeHidden();
    await page.locator("[data-defense-buy=arrow]").click();
    await page.locator("[data-defense-confirm]").click();
    await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(1);
    await page.locator("[data-game-command=expand]").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    await page.clock.runFor(800);
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/defense2/map-${map}-phone.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/defense2/map-${map}-desktop.png` });
  });
test("actual HTML drag-to-place uses the same paid footprint validation after zoom and resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  for (const k of ["1:1", "1:2", "1:3"]) await correct(page, k);
  const svg = page.locator(".flow-scene svg"),
    p = legalPositions(0)[0];
  await svg.scrollIntoViewIfNeeded();
  const point = await screenPoint(page, p),
    box = await svg.boundingBox();
  await page.locator("[data-defense-buy=arrow]").dragTo(svg, {
    targetPosition: { x: point.x - box.x, y: point.y - box.y },
  });
  await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(1);
  await expect(page.locator(".flow-hud")).toContainText(
    "Construction Points 10"
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator(".defense-map-tools [data-defense-zoom]").click();
  await expect(svg).toHaveAttribute("viewBox", /560 350/);
  await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(1);
});
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 375, height: 667 },
  { width: 844, height: 390 },
])
  test(`battlefield stays visible with ribbon and shop at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await page.locator("[data-game-command=expand]").click();
    const frame = await page.locator(".gameplay-viewport").boundingBox(),
      scene = await page.locator(".flow-scene").boundingBox();
    expect(scene.height).toBeGreaterThan(110);
    expect(scene.y).toBeGreaterThanOrEqual(frame.y);
    expect(scene.y + scene.height).toBeLessThanOrEqual(frame.y + frame.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    await expect(page.locator("[data-defense-buy=arrow]")).toBeVisible();
    if (viewport.width === 1440)
      await page
        .locator(".gameplay-viewport")
        .screenshot({ path: "docs/defense2/zero-opening-desktop.png" });
  });
test("pending source progress is retained and export stays available after repaint and a failed save retry", async ({
  page,
}) => {
  await open(page, { last: 2 });
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.storageBlocked = true;
    Storage.prototype.setItem = function (k, v) {
      if (window.storageBlocked && k === "ayah-flow-adventures-v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await correct(page, "1:1");
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "1"
  );
  await expect(
    page.getByRole("button", { name: "Export pending checkpoint" })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
        )[0].completed
    )
  ).toBe(0);
  await page
    .getByRole("button", { name: "Retry source / save", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export pending checkpoint" })
  ).toBeVisible();
  await page.evaluate(() => (window.storageBlocked = false));
  await page
    .getByRole("button", { name: "Retry source / save", exact: true })
    .click();
  await expect(page.locator(".flow-ribbon")).toContainText("1:2");
  expect(
    await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
        )[0].completed
    )
  ).toBe(1);
});
test("a number key released in Pause does not stay stuck after Resume", async ({
  page,
}) => {
  await open(page, { memory: "standard" });
  const index = await page
      .locator("[data-flow-choice] .arabic")
      .evaluateAll(
        (ns, text) => ns.findIndex((n) => n.textContent === text),
        localBundle("1:1").textUthmani
      ),
    code = "Digit" + (index + 1);
  await page.keyboard.down(code);
  await expect(page.locator(".flow-ribbon")).toContainText("1:2");
  await page.keyboard.press("Escape");
  await page.keyboard.up(code);
  await page
    .locator(".gameplay-settings")
    .getByRole("button", { name: "Resume game", exact: true })
    .click();
  await page.keyboard.press(code);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = Object.values(
          JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
        )[0];
        return (
          r.completed + r.evidence.filter((e) => e.kind === "memory").length
        );
      })
    )
    .toBe(2);
});
test("DPR2 phone touch placement maps the whole foundation correctly after zoom", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await open(page);
    for (const key of ["1:1", "1:2", "1:3"]) await correct(page, key);
    await page.locator("[data-defense-buy=arrow]").tap();
    await page.locator(".defense-map-tools [data-defense-zoom]").tap();
    const p = await screenPoint(page, legalPositions(0)[0]);
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(1);
    await expect(page.locator(".flow-hud")).toContainText(
      "Construction Points 10"
    );
  } finally {
    await context.close();
  }
});
for (const failReset of [false, true])
  test(`whole-range restart retains archived history and starts zero-resource attempt; failed save=${failReset}`, async ({
    page,
  }) => {
    await open(page);
    await correct(page, "1:1");
    if (failReset)
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        let fail = true;
        Storage.prototype.setItem = function (key, value) {
          if (
            fail &&
            key === "ayah-flow-adventures-v1" &&
            Object.values(JSON.parse(value).runs).some(
              (r) => r.history?.length && !r.completed
            )
          ) {
            fail = false;
            throw new DOMException("Full storage", "QuotaExceededError");
          }
          return original.call(this, key, value);
        };
      });
    await page.locator("[data-game-command=settings]").click();
    await page
      .getByText("Restart entire selected range", { exact: true })
      .click();
    await page.locator("[data-defense-entire-confirm]").click();
    if (failReset) {
      await expect(page.locator("[data-flow-message]")).toContainText("Retry");
      await page
        .getByRole("button", { name: "Retry source / save", exact: true })
        .click();
    }
    await expect(page.locator(".flow-battlefield")).toHaveAttribute(
      "data-covered",
      "0"
    );
    await expect(page.locator(".flow-hud")).toContainText(
      "Construction Points 0"
    );
    await expect(page.locator("[data-flow-start]")).toBeVisible();
    const run = await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
        )[0]
    );
    expect(run.history.at(-1).completed).toBe(1);
    expect(run.completed).toBe(0);
  });
test("late listen-before completion cannot resume combat behind an explicitly opened pause menu", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    window.testRecitations = [];
  });
  await page.locator("[data-adventure-audio]").selectOption("before");
  await expect
    .poll(() => page.evaluate(() => window.testRecitations.length))
    .toBeGreaterThan(0);
  await page.locator("[data-game-command=settings]").click();
  await page.evaluate(() => window.testRecitations.at(-1).onended?.());
  await expect(page.locator(".gameplay-settings")).toBeVisible();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-adventure-state",
    "paused"
  );
  await expect(page.locator("[data-flow-choice]").first()).toBeDisabled();
});
for (const game of ["ayah-defense", "surah-rush"])
  test(`${game}: Start remains disabled until the initial verified source is ready`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(async (game) => {
      const { mountAdventure } = await import("/src/revision/adventures/ui.js");
      const root = document.createElement("section");
      document.body.replaceChildren(root);
      const gate = new Promise((resolve) => {
        window.releaseInitialSource = resolve;
      });
      window.pendingInitialMount = mountAdventure(root, {
        game,
        refs: ["1:1", "1:2"],
        verifyBundle: () => gate,
      });
    }, game);
    await expect(page.locator("[data-flow-start]")).toBeDisabled();
    await expect(page.locator("[data-flow-start]")).toContainText(
      "Preparing verified passage"
    );
    await page.evaluate(async () => {
      window.releaseInitialSource();
      window.initialActivity = await window.pendingInitialMount;
    });
    await expect(page.locator("[data-flow-start]")).toBeEnabled();
    await page.locator("[data-adventure-audio]").selectOption("paused");
    await page.locator("[data-flow-start]").click();
    await expect(page.locator(".flow-battlefield")).toHaveAttribute(
      "data-adventure-state",
      "playing"
    );
    await expect(
      page
        .locator(
          game === "surah-rush" ? "[data-rush-sign]" : "[data-flow-choice]"
        )
        .first()
    ).toBeVisible();
    if (game !== "surah-rush")
      await expect(page.locator("[data-flow-choice]").first()).toBeEnabled();
  });
