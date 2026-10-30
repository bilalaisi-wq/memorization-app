import { parkExtra } from "./falling-helper.js";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mockBilling } from "./billing-fixtures.js";
import { enableDeveloperLab } from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
import { openMazeChoice } from "./maze-helper.js";
import { surahs } from "../src/data.js";
export async function openExpedition(page) {
  await enableDeveloperLab(page);
  await menu(page);
  await page
    .getByRole("button", { name: "Passage Expedition", exact: true })
    .click();
  await expect(page.locator(".ex-selection")).toBeVisible();
}
export async function chart(
  page,
  { key = "1:1", game = "maze", count = 1 } = {},
) {
  const [surah] = key.split(":"),
    juz = key.startsWith("2:") ? "3" : "1";
  await page.locator("[name=juz]").selectOption(juz);
  await page.locator("[name=surah]").selectOption(surah);
  await page.locator("[name=first]").selectOption(key);
  await page.locator("[name=count]").selectOption(String(count));
  await page.locator("[name=game]").selectOption(game);
  await page.getByRole("button", { name: "Chart my constellation" }).click();
  await expect(page.locator("[data-ex-discover]")).toBeVisible();
}
export async function connect(page) {
  await expect(
    page.locator("[data-ex-bank] [data-ex-piece]").first(),
  ).toBeVisible();
  const ids = await page
    .locator("[data-ex-bank] [data-ex-piece]")
    .evaluateAll((bs) =>
      bs.map((b) => Number(b.dataset.exPiece)).sort((a, b) => a - b),
    );
  for (const id of ids) await page.locator(`[data-ex-piece="${id}"]`).click();
  await page.locator("[data-ex-check]").click();
}
export async function forge(page) {
  for (let i = 0; i < 3; i++) await connect(page);
}
export async function next(page) {
  await page.locator("[data-ex-next]").click();
}
export async function recall(page) {
  await page.locator("[data-quest-recall]").click();
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await page.locator("[data-grade=Good]").click();
  await page.locator(".passage-studio [data-close]").click();
  await expect(page.locator("[data-ex-next]")).toBeVisible();
}

test("free expedition is fully playable through real Maze and independent recall, with genuine constellation reveal", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openExpedition(page);
  await chart(page);
  await page.locator("[data-ex-discover]").click();
  await next(page);
  await forge(page);
  await next(page);
  await connect(page);
  await next(page);
  await expect(page.locator(".memory-maze")).toBeVisible();
  for (const text of surahs[0].verses[0].words)
    await openMazeChoice(page, text);
  await expect(page.locator("[data-ex-next]")).toBeVisible();
  const scope = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ayah-puzzle-lab-v1")).history.at(-1)
        .arcade.studyScope,
  );
  expect(scope).toEqual({
    kind: "visual-study",
    reference: "1:1",
    firstWord: 1,
    lastWord: 4,
  });
  const before = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("ayah-passage-recall-v1") || '{"records":{}}',
    ),
  );
  expect(before.records).toEqual({});
  await next(page);
  await recall(page);
  await next(page);
  await expect(page.locator(".ex-reveal")).toContainText("5 real checkpoints");
  expect(await page.locator(".ex-map-scroll .is-complete").count()).toBe(5);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).records[
          "ayah:1:1"
        ].card,
    ),
  ).not.toBe(null);
});
test("unfinished hidden-word round restores after reload, keyboard navigation and reduced motion remain usable", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await openExpedition(page);
  await chart(page);
  await page.locator("[data-ex-discover]").click();
  await next(page);
  await connect(page);
  await page.locator("[data-ex-bank] [data-ex-piece]").first().focus();
  await page.keyboard.press("Enter");
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-quest-campaigns-v1"),
  );
  await page.reload();
  await openExpedition(page);
  await page.locator("[data-ex-resume]").click();
  await expect(
    page.locator(".ex-kicker").filter({ hasText: "ROUND 2 OF 3" }),
  ).toBeVisible();
  await expect(page.locator("[data-ex-built] [data-ex-piece]")).toHaveCount(1);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-quest-campaigns-v1")),
  ).toBe(raw);
  await page.locator("[data-ex-skip]").click();
  expect(
    await page.locator(".passage-expedition").getAttribute("data-motion-off"),
  ).toBe("true");
  await page.getByRole("button", { name: "Close Passage Expedition" }).click();
  await expect(page.locator(".passage-expedition")).toHaveCount(0);
  expect(
    await page
      .locator("body")
      .evaluate((b) =>
        [...b.children]
          .filter((c) => c.tagName !== "SCRIPT")
          .every((c) => !c.inert),
      ),
  ).toBe(true);
});
for (const key of ["2:255", "2:282"])
  test(`authorized private pilot ${key} builds bounded workspaces without inventing stops`, async ({
    page,
  }) => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(`./fixtures/${key.replace(":", "-")}.json`, import.meta.url),
      ),
    );
    await mockBilling(page, { plan: "pathfinder" });
    await page.route("**/functions/v1/quran-content", (r) =>
      r.fulfill({ json: fixture }),
    );
    await page.goto("/");
    await openExpedition(page);
    await chart(page, { key });
    await expect(page.locator(".ex-discovery .arabic")).toHaveText(
      fixture.textUthmani,
    );
    await page.locator("[data-ex-discover]").click();
    await next(page);
    await expect(page.locator("[data-ex-bank] [data-ex-piece]")).toHaveCount(
      key === "2:282" ? 10 : 7,
    );
    await expect(page.locator(".ex-boundary").last()).toContainText(
      "not approved recitation stops",
    );
    const stored = await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([k]) => k.includes("quest-campaigns"))
        .map(([, v]) => v)
        .join(""),
    );
    expect(stored).not.toMatch(/[\u0600-\u06ff]/);
  });
test("server denial leaves selection usable and never renders premium text", async ({
  page,
}) => {
  await mockBilling(page, { plan: "free" });
  await page.route("**/functions/v1/quran-content", (r) =>
    r.fulfill({
      status: 403,
      json: { error: "Subscription does not grant this pilot" },
    }),
  );
  await page.goto("/");
  await openExpedition(page);
  await page.locator("[name=juz]").selectOption("3");
  await page.locator("[name=surah]").selectOption("2");
  await page.locator("[name=first]").selectOption("2:282");
  await page.getByRole("button", { name: "Chart my constellation" }).click();
  await expect(page.locator(".ex-global")).toContainText("does not grant");
  await expect(page.locator(".ex-discovery")).toHaveCount(0);
  await chart(page);
  await expect(page.locator(".ex-discovery")).toContainText("1:1");
});
test("selected multi-ayah chain has a distinct final passage recall and preserves canonical ordering", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openExpedition(page);
  await chart(page, { count: 2 });
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-quest-campaigns-v1")),
  );
  const run = Object.values(data.runs)[0];
  expect(run.refs).toEqual(["1:1", "1:2"]);
  expect(run.checkpointIds).toHaveLength(12);
  await expect(page.locator("[data-ex-map]")).toContainText(
    "Independent Passage Challenge",
  );
});
for (const game of ["falling", "snake", "asteroids"])
  test(`runtime registered ${game} trial starts with actual mechanics and cleans up`, async ({
    page,
  }) => {
    await mockBilling(page, { signed: false });
    await page.goto("/");
    await openExpedition(page);
    await chart(page, { game });
    await page.locator("[data-ex-discover]").click();
    await next(page);
    await forge(page);
    await next(page);
    await connect(page);
    await next(page);
    await expect(page.locator("[data-ex-scope]")).toContainText(
      "words 1–4 only",
    );
    await expect(
      page.locator(
        game === "falling"
          ? ".falling-stage"
          : game === "snake"
            ? ".snake-board"
            : ".astro-stage",
      ),
    ).toBeVisible();
    if (game === "falling") {
      await expect
        .poll(() => page.locator(".tower-game").textContent())
        .not.toBe("");
      await page.keyboard.press("KeyB");
      await page.keyboard.press("Space");
    }
    await page
      .getByRole("button", { name: "Close Passage Expedition" })
      .click();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".passage-expedition")).toHaveCount(0);
  });

test("two-ayah expedition completes cumulative construction and a separate independent passage review", async ({
  page,
}) => {
  test.setTimeout(90000);
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openExpedition(page);
  await chart(page, { count: 2 });
  for (let i = 0; i < 2; i++) {
    await page.locator("[data-ex-discover]").click();
    await next(page);
    await forge(page);
    await next(page);
    await connect(page);
    await next(page);
    await expect(page.locator("[data-ex-fallback]")).toBeVisible();
    await page.locator("[data-ex-fallback]").click();
    await forge(page);
    await next(page);
    await recall(page);
    await next(page);
  }
  await connect(page);
  await next(page);
  await recall(page);
  await next(page);
  await expect(page.locator(".ex-reveal")).toContainText("12 real checkpoints");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-passage-recall-v1")),
  );
  expect(
    Object.values(saved.records).filter((r) => r.unit.type === "passage")[0]
      .unit.refs,
  ).toEqual(["1:1", "1:2"]);
});

test("128-word pilot completes every bounded forge/link without losing or repeating canonical source words", async ({
  page,
}) => {
  test.setTimeout(150000);
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  await mockBilling(page, { plan: "pathfinder" });
  await page.route("**/functions/v1/quran-content", (r) =>
    r.fulfill({ json: fixture }),
  );
  await page.goto("/");
  await openExpedition(page);
  await chart(page, { key: "2:282" });
  await page.locator("[data-ex-discover]").click();
  await next(page);
  for (let p = 0; p < 20; p++) {
    await forge(page);
    await next(page);
    await connect(page);
    await next(page);
  }
  await expect(page.locator("[data-ex-fallback]")).toBeVisible();
  await page.locator("[data-ex-fallback]").click();
  await forge(page);
  await next(page);
  await recall(page);
  await next(page);
  await expect(page.locator(".ex-reveal")).toContainText("43 real checkpoints");
  await expect(page.locator(".ex-reveal .arabic")).toHaveText(
    fixture.textUthmani,
  );
  const raw = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k]) => k.includes("quest-campaigns"))
      .map(([, v]) => v)
      .join(""),
  );
  expect(raw).not.toMatch(/[\u0600-\u06ff]/);
});

test("full-ayah audio pauses and disposes on exit; corrupted quest data remains exportable without reset", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.addInitScript(() => {
    window.exAudio = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        this.paused = true;
        window.exAudio.push(this);
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
      removeAttribute() {}
      load() {}
    };
  });
  await page.goto("/");
  await openExpedition(page);
  await chart(page);
  await page.locator("[data-ex-play]").click();
  await expect
    .poll(() => page.evaluate(() => window.exAudio.some((a) => !a.paused)))
    .toBe(true);
  await page.locator("[data-ex-audio-pause]").click();
  expect(await page.evaluate(() => window.exAudio.every((a) => a.paused))).toBe(
    true,
  );
  await page.locator("[data-ex-audio-pause]").click();
  await expect
    .poll(() => page.evaluate(() => window.exAudio.some((a) => !a.paused)))
    .toBe(true);
  await page.getByRole("button", { name: "Close Passage Expedition" }).click();
  expect(await page.evaluate(() => window.exAudio.every((a) => a.paused))).toBe(
    true,
  );
  await page.evaluate(() =>
    localStorage.setItem("ayah-quest-campaigns-v1", '{"future":99}'),
  );
  await openExpedition(page);
  await expect(page.locator(".ex-warning")).toContainText("recovery");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-quest-campaigns-v1")),
  ).toBe('{"future":99}');
});

test.describe("mobile expedition", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  test("touch construction fits the viewport and skip animation respects reduced motion", async ({
    page,
  }) => {
    await mockBilling(page, { signed: false });
    await page.goto("/");
    await openExpedition(page);
    await chart(page);
    await page.locator("[data-ex-discover]").tap();
    await next(page);
    await expect(
      page.locator("[data-ex-bank] [data-ex-piece]").first(),
    ).toBeVisible();
    await page.locator("[data-ex-bank] [data-ex-piece]").first().tap();
    await expect(page.locator("[data-ex-built] [data-ex-piece]")).toHaveCount(
      1,
    );
    expect(
      await page
        .locator(".passage-expedition")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await page.locator(".passage-expedition").getAttribute("data-motion-off"),
    ).toBe("true");
    const box = await page.locator("[data-ex-check]").boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(46);
  });
});

test("Word Forge supports reorder controls and bank/self drops without losing draft positions", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openExpedition(page);
  await chart(page);
  await page.locator("[data-ex-discover]").click();
  await next(page);
  await expect(page.locator('[data-ex-piece="2"]')).toBeVisible();
  await page.locator('[data-ex-piece="2"]').click();
  await page.locator('[data-ex-piece="1"]').click();
  await page.locator('[data-ex-move="1:-1"]').click();
  expect(
    await page
      .locator("[data-ex-built] [data-ex-piece]")
      .evaluateAll((bs) => bs.map((b) => Number(b.dataset.exPiece))),
  ).toEqual([1, 2]);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await page
    .locator('[data-ex-piece="1"]')
    .dispatchEvent("dragstart", { dataTransfer: transfer });
  await page
    .locator("[data-ex-bank] [data-ex-piece]")
    .first()
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator("[data-ex-built] [data-ex-piece]")).toHaveCount(1);
  const self = await page.evaluateHandle(() => new DataTransfer());
  await page
    .locator('[data-ex-piece="2"]')
    .dispatchEvent("dragstart", { dataTransfer: self });
  await page
    .locator('[data-ex-piece="2"]')
    .dispatchEvent("drop", { dataTransfer: self });
  await expect(page.locator("[data-ex-built] [data-ex-piece]")).toHaveCount(1);
});

test("viewing study text during an undeclared pending recall cannot earn an independent checkpoint", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openExpedition(page);
  await chart(page);
  await page.locator("[data-ex-discover]").click();
  await next(page);
  await forge(page);
  await next(page);
  await connect(page);
  await next(page);
  await page.locator("[data-ex-fallback]").click();
  await forge(page);
  await next(page);
  await page.locator("[data-quest-recall]").click();
  await page.locator(".passage-studio [data-close]").click();
  await page
    .getByRole("button", { name: "Discovery Gate 1:1", exact: false })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).active
          .assisted,
    ),
  ).toBe(true);
  await next(page);
  await page.locator("[data-quest-recall]").click();
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await page.locator("[data-grade=Good]").click();
  await page.locator(".passage-studio [data-close]").click();
  await expect(page.locator("[data-ex-next]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).records[
          "ayah:1:1"
        ].card,
    ),
  ).toBe(null);
});

test("Blocks trial win has a visible retry when the quest commit fails and retry never doubles XP", async ({
  page,
}) => {
  test.setTimeout(45000);
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await openExpedition(page);
  await chart(page, { game: "falling" });
  await page.locator("[data-ex-discover]").click();
  await next(page);
  await forge(page);
  await next(page);
  await connect(page);
  await next(page);
  await expect(page.locator(".falling-stage")).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.blockCommitFailure = true;
    Storage.prototype.setItem = function (key, value) {
      if (
        window.blockCommitFailure &&
        key === "ayah-quest-campaigns-v1" &&
        Object.values(JSON.parse(value).runs).some((r) =>
          Object.values(r.completed).some((c) => c.evidence === "arcade"),
        )
      ) {
        window.blockCommitFailure = false;
        throw Error("Simulated quest storage quota");
      }
      return original.call(this, key, value);
    };
  });
  for (let i = 0; i < 100; i++) {
    if (await page.locator(".tower-victory").count()) break;
    const index = Number(
      await page.locator(".falling-block").getAttribute("data-index"),
    );
    if (index >= 4) await parkExtra(page);
    else await page.locator("#fall-place").click();
  }
  await expect(page.locator("[data-block-status]")).toContainText("not saved");
  await expect(page.locator("[data-block-save]")).toBeVisible();
  const xp = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet.xp,
  );
  await page.locator("[data-block-save]").click();
  await expect(page.locator("[data-ex-next]")).toBeVisible();
  await expect(page.locator("[data-block-save]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet.xp,
    ),
  ).toBe(xp);
});
