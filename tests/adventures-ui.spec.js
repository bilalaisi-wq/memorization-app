import { test, expect } from "@playwright/test";
import { localBundle } from "../src/content/library.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
async function open(page, game, { last = 3 } = {}) {
  await page.addInitScript(() => {
    window.recordings = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        window.recordings.push(this);
      }
      play() {
        this.playing = true;
        return Promise.resolve();
      }
      pause() {
        this.playing = false;
      }
      load() {}
      removeAttribute() {}
    };
  });
  await page.goto("/");
  await page.locator("#nav-revision-lab").click();
  await page.locator(`[data-revision-game=${game}]`).click();
  await page.locator("[name=selection]").selectOption("custom");
  await page.locator("[name=last]").fill(String(last));
  await page.getByRole("button", { name: "Prepare game", exact: true }).click();
  await expect(page.locator(".flow-ribbon")).toContainText("1:1");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.locator("[data-flow-start]").click();
  await expect(page.locator(".flow-battlefield")).toBeFocused();
  // SVG shapes must not swallow later siblings through unquoted closing attributes.
  const entity =
    game === "ayah-defense" ? "[data-flow-tower-entity]" : "[data-flow-runner]";
  if (game === "ayah-defense")
    await expect(page.locator(entity)).toHaveCount(0);
  else await expect(page.locator(entity)).toBeVisible();
  expect(
    await page
      .locator(".flow-scene svg")
      .evaluate((svg) =>
        [...svg.querySelectorAll("path,rect,circle,ellipse")].every(
          (n) => !n.children.length
        )
      )
  ).toBe(true);
}
async function choose(page, ref, index = 0) {
  const text = revisionUnits(localBundle(ref))[index].text;
  await page.locator("[data-flow-choice]").filter({ hasText: text }).click();
}
test("Ayah Defense earns and places real towers, fights waves and keeps source coverage/FSRS separate", async ({
  page,
}) => {
  await open(page, "ayah-defense");
  await choose(page, "1:1");
  await expect(page.locator(".flow-battlefield")).toBeFocused();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "1"
  );
  await expect(page.locator(".flow-hud")).toContainText("Construction Points");
  await choose(page, "1:2");
  await choose(page, "1:3");
  await page.locator("[data-defense-buy=arrow]").click();
  await page.locator("[data-defense-confirm]").click();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "3"
  );
  await expect(page.locator(".flow-ribbon")).toContainText(
    "Selected Arabic coverage complete"
  );
  await page.clock.runFor(120000);
  if (await page.locator("[data-flow-recover]").count()) {
    await page.locator("[data-flow-recover]").click();
    await page.clock.runFor(120000);
  }
  await expect(page.locator(".flow-ribbon")).toContainText("Passage complete");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
  await page
    .locator(".flow-adventure")
    .screenshot({ path: "docs/gameplay-overhaul/defense-desktop.png" });
});
test("Surah Rush requires actual traversal, number route choice, no Space answer submission and continues through successive ayahs", async ({
  page,
}) => {
  test.setTimeout(120000);
  await open(page, "surah-rush", { last: 2 });
  await page.keyboard.press("Space");
  await page.clock.runFor(150);
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "0"
  );
  for (const ref of ["1:1", "1:2"]) {
    await choose(page, ref);
    await page.locator(".flow-battlefield").focus();
    await page.keyboard.down("ArrowRight");
    for (let n = 0; n < 250; n++) {
      await page.clock.runFor(100);
      const covered = Number(
        await page.locator(".flow-battlefield").getAttribute("data-covered")
      );
      if (covered >= Number(ref.split(":")[1])) break;
    }
    await page.keyboard.up("ArrowRight");
    await expect(page.locator(".flow-battlefield")).toHaveAttribute(
      "data-covered",
      ref.split(":")[1]
    );
    if (ref === "1:1") {
      await page.keyboard.down("ArrowRight");
      for (let n = 0; n < 100; n++) {
        await page.clock.runFor(100);
        if (await page.locator("[data-flow-choice]").count()) break;
      }
      await page.keyboard.up("ArrowRight");
    }
  }
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(10000);
  await page.keyboard.up("ArrowRight");
  await expect(page.locator(".flow-ribbon")).toContainText("Passage complete");
  await page
    .locator(".flow-adventure")
    .screenshot({ path: "docs/gameplay-overhaul/rush-desktop.png" });
  await page.locator('[data-flow-end="replay"]').click();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "0"
  );
  await expect(page.locator("[data-flow-start]")).toBeVisible();
  const replayed = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(replayed.history.at(-1).completed).toBe(2);
  expect(replayed.history.at(-1).finished).toBe(true);
});
test("new game pause applies independent settings to the current challenge, restores focus and preserves earlier ayah coverage", async ({
  page,
}) => {
  await open(page, "ayah-defense");
  await choose(page, "1:1");
  await page.locator("[data-game-command=settings]").click();
  await page.locator("[data-game-memory]").selectOption("expert");
  await page.locator("[data-game-motor]").selectOption("relaxed");
  await page.locator("[data-game-command=restart-challenge]").click();
  await expect(page.locator(".flow-battlefield")).toBeFocused();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "1"
  );
  await expect(page.locator(".flow-ribbon")).toContainText("Try saying");
  await page.locator("[data-flow-ready]").click();
  await page.locator("[data-game-command=expand]").click();
  await expect(page.locator(".gameplay-viewport")).toHaveClass(
    /gameplay-expanded/
  );
});
test("ten-ayah fortress passage crosses five without a menu and restores the completed prefix after reload", async ({
  page,
}) => {
  await page.addInitScript(
    () =>
      (window.Audio = class {
        play() {
          return Promise.resolve();
        }
        pause() {}
        load() {}
        removeAttribute() {}
      })
  );
  await page.route("**/rpc/published_segmentation_review", (r) =>
    r.fulfill({ json: null })
  );
  async function select() {
    await page.goto("/");
    await page.locator("#nav-revision-lab").click();
    await page.locator("[data-revision-game=ayah-defense]").click();
    await page.locator("[name=surah]").selectOption("78");
    await page.locator("[name=selection]").selectOption("10");
    await page
      .getByRole("button", { name: "Prepare game", exact: true })
      .click();
  }
  await select();
  await page.locator("[data-flow-start]").click();
  for (let ayah = 1; ayah <= 6; ayah++)
    for (const unit of revisionUnits(localBundle(`78:${ayah}`))) {
      await page
        .locator("[data-flow-choice]")
        .filter({ hasText: unit.text })
        .click();
    }
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "6"
  );
  await expect(page.locator(".flow-ribbon")).toContainText("78:7");
  const xp = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet.xp
  );
  await select();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "6"
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ayah-learning-v1")).wallet.xp
    )
  ).toBe(xp);
  await page
    .locator(".flow-adventure")
    .screenshot({ path: "docs/gameplay-overhaul/defense-construction.png" });
});
for (const game of ["ayah-defense", "surah-rush"])
  test(`${game} phone controls, Arabic and account disposal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, game);
    if (game === "surah-rush")
      expect(
        (await page.locator("[data-flow-runner]").boundingBox()).width
      ).toBeGreaterThan(14);
    const arabic = await page
      .locator(".flow-choices .arabic")
      .first()
      .evaluate((n) => Number.parseFloat(getComputedStyle(n).fontSize));
    expect(arabic).toBeGreaterThanOrEqual(24);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    expect(
      (await page.locator(".flow-adventure .gameplay-viewport").boundingBox())
        .height
    ).toBeLessThanOrEqual(844);
    await page.locator("[data-game-command=expand]").click();
    await expect(page.locator(".gameplay-viewport")).toHaveCSS(
      "background-color",
      "rgb(20, 34, 61)"
    );
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/gameplay-overhaul/${game}-phone.png` });
    await page.evaluate(() =>
      window.dispatchEvent(new Event("ayahprofilechange"))
    );
    await expect(page.locator(".flow-battlefield")).toHaveCount(0);
    expect(
      await page.evaluate(() => window.recordings.every((a) => !a.playing))
    ).toBe(true);
  });
test("actual long pilot groups and cumulative checks preserve exact source coverage; private revocation disposes the game", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  const bundle = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url))
  );
  await page.goto("/");
  await page.evaluate(async (b) => {
    window.deny = false;
    window.Audio = class {
      play() {
        return Promise.resolve();
      }
      pause() {}
      load() {}
      removeAttribute() {}
    };
    const host = document.createElement("section");
    host.id = "long-adventure";
    document.body.replaceChildren(host);
    window.longDefense = await (
      await import("/src/revision/adventures/ui.js")
    ).mountAdventure(host, {
      game: "ayah-defense",
      refs: ["2:282"],
      client: {
        functions: {
          invoke: async (_, { body }) =>
            window.deny
              ? { error: { status: 403 } }
              : body.asset === "audio"
              ? { error: Error("Audio unavailable") }
              : { data: b },
        },
      },
    });
  }, bundle);
  await page.locator("[data-flow-start]").click();
  for (const unit of revisionUnits(bundle)) {
    await page
      .locator("[data-flow-choice]")
      .filter({ hasText: unit.text })
      .click();
  }
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "1"
  );
  const saved = await page.evaluate(() =>
    localStorage.getItem("ayah-flow-adventures-v1")
  );
  expect(saved).not.toMatch(/بِسْمِ|textUthmani/);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("ayah-content-access-changed"))
  );
  await expect(page.locator(".flow-battlefield")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-flow-adventures-v1"))
  ).toBe(saved);
});

test("defense combat keeps moving while the next verified source is loading", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    window.Audio = class {
      play() {
        return Promise.resolve();
      }
      pause() {}
      load() {}
      removeAttribute() {}
    };
    const root = document.createElement("section");
    document.body.append(root);
    const { mountAdventure } = await import("/src/revision/adventures/ui.js");
    window.failNextSource = true;
    const pending = new Promise((resolve) => (window.releaseSource = resolve));
    window.flowTest = await mountAdventure(root, {
      game: "ayah-defense",
      refs: ["1:1", "1:2"],
      verifyBundle: async (b) => {
        if (b.key === "1:2") {
          await pending;
          if (window.failNextSource)
            throw Error("Source temporarily unavailable");
        }
      },
    });
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.locator("[data-flow-start]").click();
  await choose(page, "1:1");
  const before = await page.evaluate(
    () => window.flowTest.getSnapshot().engine.time
  );
  await page.clock.runFor(1000);
  expect(
    await page.evaluate(() => window.flowTest.getSnapshot().engine.time)
  ).toBeGreaterThan(before + 0.5);
  await page.evaluate(() => window.releaseSource());
  await expect(page.locator(".flow-ribbon")).toContainText(
    "Retry source / save"
  );
  await page.getByRole("button", { name: "Retry source / save" }).click();
  expect(
    await page.evaluate(() => window.flowTest.getSnapshot().engine.status)
  ).toBe("paused");
  await page.evaluate(() => (window.failNextSource = false));
  await page.getByRole("button", { name: "Retry source / save" }).click();
  await expect(page.locator(".flow-ribbon")).toContainText("1:2");
  await expect(page.locator(".flow-battlefield")).toBeFocused();
  await page.evaluate(() => window.flowTest.dispose());
});
