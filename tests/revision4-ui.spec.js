import { test, expect } from "@playwright/test";
import { mountRush, driveRush } from "./rush3-ui-helper.js";
import { localBundle } from "../src/content/library.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
import { readFileSync, existsSync } from "node:fs";
const audioCount = (page) => page.evaluate(() => window.rushAudio.length);
async function chooseUnit(page, ref, index = 0) {
  const unit = revisionUnits(localBundle(ref))[index];
  await page
    .locator("[data-flow-choice]")
    .filter({ hasText: unit.text })
    .click();
}
for (const game of ["ayah-defense", "surah-rush"])
  test(`${game}: Independent Revision defaults to no playback; manual whole-ayah replay is assistance`, async ({
    page,
  }) => {
    await mountRush(page, { game, refs: ["1:1", "1:2"] });
    await expect(page.locator("[data-adventure-audio]")).toHaveValue("paused");
    expect(await audioCount(page)).toBe(0);
    await page.locator(".gameplay-toolbar [data-game-command=listen]").click();
    await expect.poll(() => audioCount(page)).toBe(1);
    expect(await page.evaluate(() => window.rushAudio[0].src)).toContain(
      "001001.mp3"
    );
    if (game === "ayah-defense") await chooseUnit(page, "1:1");
    else await driveRush(page, { goal: 1 });
    const r = await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
        )[0]
    );
    expect(r.audioAssistedRefs).toContain("1:1");
    expect(r.recognitionHistory[0].kind).toBe("assisted-recognition");
    expect(
      await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
    ).toBeNull();
    await page.locator(".gameplay-toolbar [data-game-command=exit]").click();
    expect(
      await page.evaluate(() => window.rushAudio.every((a) => !a.playing))
    ).toBe(true);
  });
test("Listen & Revise plays an entire ayah once, remains stable across fragments, then switches recordings without overlap", async ({
  page,
}) => {
  await mountRush(page, {
    game: "ayah-defense",
    refs: ["98:5", "98:6"],
    memory: "standard",
    audioMode: "listen",
  });
  await expect.poll(() => audioCount(page)).toBe(1);
  expect(await page.evaluate(() => window.rushAudio[0].src)).toContain(
    "098005.mp3"
  );
  const units = revisionUnits(localBundle("98:5"), "standard");
  expect(units.length).toBeGreaterThan(2);
  for (let n = 0; n < units.length; n++) {
    await chooseUnit(page, "98:5", n);
    if (n < units.length - 1) expect(await audioCount(page)).toBe(1);
  }
  await expect.poll(() => audioCount(page)).toBe(2);
  expect(await page.evaluate(() => window.rushAudio.at(-1).src)).toContain(
    "098006.mp3"
  );
  expect(
    await page.evaluate(() => window.rushAudio.filter((a) => a.playing).length)
  ).toBe(1);
  await page.locator("[data-adventure-audio]").selectOption("continuous");
  await expect.poll(() => audioCount(page)).toBe(3);
  expect(await page.evaluate(() => window.rushAudio.at(-1).loop)).toBe(true);
  await page.locator("[data-flow-audio-pause]").click();
  expect(
    await page.evaluate(() => window.rushAudio.filter((a) => a.playing).length)
  ).toBe(0);
  await page.locator("[data-flow-audio-pause]").click();
  expect(
    await page.evaluate(() => window.rushAudio.filter((a) => a.playing).length)
  ).toBe(1);
  await page.locator("[data-flow-volume]").fill("0.25");
  await expect(page.locator("[data-flow-volume]")).toHaveValue("0.25");
});
test("unassisted recognition is explicitly separate from spoken recall and help is replayable", async ({
  page,
}) => {
  await mountRush(page, { game: "ayah-defense", refs: ["1:1", "1:2"] });
  await chooseUnit(page, "1:1");
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.recognitionHistory[0].kind).toBe("unassisted-recognition");
  expect(r.recognitionHistory[0].targetPositions).toEqual([1, 2, 3, 4]);
  await page.locator("[data-flow-help]").click();
  await expect(page.locator(".revision-instructions")).toContainText(
    "recite each ayah"
  );
  await page.locator("[data-dismiss-instructions]").click();
  await expect(page.locator(".revision-instructions")).toBeHidden();
});
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [375, 667],
  [844, 390],
])
  test(`compact Defense source context and all choices remain readable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await mountRush(page, {
      game: "ayah-defense",
      refs: ["98:5", "98:6"],
      memory: "standard",
    });
    await chooseUnit(page, "98:5");
    await page.locator("[data-game-command=expand]").click();
    await expect(page.locator("[data-flow-choice]")).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    if (width >= 1000) {
      const measurements = await page
        .locator(".flow-ribbon")
        .evaluate((e) => ({
          scroll: e.scrollHeight,
          client: e.clientHeight,
          overflow: getComputedStyle(e).overflowY,
        }));
      expect(measurements.scroll).toBeLessThanOrEqual(measurements.client + 1);
      expect(measurements.overflow).toBe("visible");
      const viewport = await page.locator(".gameplay-viewport").boundingBox();
      for (const button of await page.locator("[data-flow-choice]").all()) {
        const b = await button.boundingBox();
        expect(b.y + b.height).toBeLessThanOrEqual(
          viewport.y + viewport.height + 1
        );
        expect(b.width).toBeGreaterThan(200);
      }
    }
    for (const el of await page.locator("[data-flow-choice] .arabic").all())
      expect(
        await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
      ).toBeGreaterThanOrEqual(23);
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/revision4/defense-${width}.png` });
  });
test("a private Al-Mulk range uses exact sources, three-plus-word groups and real host progression", async ({
  page,
}) => {
  test.skip(
    !existsSync(".quran-private/67/5/bundle.json"),
    "Exact operator sources required; this is not live authorization verification"
  );
  const refs = Array.from({ length: 5 }, (_, i) => `67:${i + 1}`),
    bundles = Object.fromEntries(
      refs.map((ref) => [
        ref,
        JSON.parse(
          readFileSync(`.quran-private/${ref.replace(":", "/")}/bundle.json`)
        ),
      ])
    );
  await page.route("https://rush-source.test/**", (r) =>
    r.fulfill({
      json: bundles[new URL(r.request().url()).searchParams.get("key")],
    })
  );
  await mountRush(page, { game: "ayah-defense", refs, client: true });
  for (const ref of refs)
    for (const unit of revisionUnits(bundles[ref])) {
      expect(unit.targetPositions.length).toBeGreaterThanOrEqual(3);
      await page
        .locator("[data-flow-choice]")
        .filter({ hasText: unit.text })
        .click();
    }
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-covered",
    "5"
  );
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.completed).toBe(5);
  expect(JSON.stringify(r)).not.toMatch(/[\u0600-\u06ff]/);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
});
test("Express and Auto-Sprint configure from the normal Revision Lab and stay in paused settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#nav-revision-lab").click();
  await page.locator("[data-revision-game=surah-rush]").click();
  await page.locator("[name=express]").check();
  await page.locator("[name=autoSprint]").check();
  await page.getByRole("button", { name: "Prepare game", exact: true }).click();
  await page.locator("[data-dismiss-instructions]").click();
  await page.locator("[data-flow-start]").click();
  await page.locator("[data-game-command=settings]").click();
  await expect(page.locator("[data-rush-auto]")).toBeChecked();
  await expect(page.locator(".rush-run-options")).toContainText(
    "Express Revision"
  );
  await page.locator("[data-rush-auto]").uncheck();
  await expect(page.locator(".flow-battlefield")).toHaveAttribute(
    "data-adventure-state",
    "paused"
  );
});

test("new Express setup offers an explicit archived attempt instead of resetting a saved run", async ({
  page,
}) => {
  const refs = ["1:1", "1:2", "1:3"];
  await mountRush(page, { refs });
  await driveRush(page, { goal: 1 });
  await mountRush(page, { refs, express: true });
  await expect(page.locator(".saved-plan-offer")).toContainText("saved setup");
  let snap = await page.evaluate(() => window.rushActivity.getSnapshot());
  expect(snap.completed).toBe(1);
  expect(snap.engine.express).toBe(false);
  await page.locator("[data-flow-new-plan]").click();
  await expect(page.locator("[data-flow-start]")).toBeEnabled();
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.completed).toBe(0);
  expect(r.settings.express).toBe(true);
  expect(r.history.at(-1).completed).toBe(1);
  expect(r.history.at(-1).plannerVersion).toBe(4);
  expect(r.history.at(-1).arcade).not.toBeNull();
});
test("archiving a replay retains old assistance evidence but starts a fresh recognition assessment", async ({
  page,
}) => {
  const refs = ["1:1", "1:2"];
  await mountRush(page, { refs, game: "ayah-defense" });
  await page.locator(".gameplay-toolbar [data-game-command=listen]").click();
  await expect.poll(() => audioCount(page)).toBe(1);
  await chooseUnit(page, "1:1");
  await mountRush(page, { refs, game: "ayah-defense", memory: "standard" });
  await page.locator("[data-flow-new-plan]").click();
  await page.locator("[data-flow-start]").click();
  await chooseUnit(page, "1:1");
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.recognitionHistory[0].kind).toBe("unassisted-recognition");
  expect(r.history.at(-1).audioAssistedRefs).toContain("1:1");
  expect(r.history.at(-1).recognitionHistory[0].kind).toBe(
    "assisted-recognition"
  );
});
test("all seven neutral families spawn through the real saved-wave host and render distinct combat objects", async ({
  page,
}) => {
  for (const kind of [
    "walker",
    "scout",
    "shielded",
    "armored",
    "boulder",
    "rover",
    "tank",
  ]) {
    await mountRush(page, { game: "ayah-defense", refs: ["1:1", "1:2"] });
    await page.evaluate(async (kind) => {
      window.rushActivity.dispose();
      const { createAyahDefense } = await import(
          "/src/revision/adventures/defense.js"
        ),
        { wavePlan } = await import(
          "/src/revision/adventures/defense-waves.js"
        ),
        { legalPositions } = await import(
          "/src/revision/adventures/defense-maps.js"
        ),
        { validAdventure } = await import("/src/revision/adventures/store.js");
      const data = JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")),
        r = Object.values(data.runs).find((r) => r.game === "ayah-defense"),
        a = createAyahDefense().checkpoint();
      a.time = 90;
      a.firstBuiltAt = 0;
      a.wave = 10;
      a.spawn = 0;
      a.waveState = {
        number: 10,
        spawned: wavePlan(10).enemies.findIndex((e) => e.kind === kind),
        elapsed: 0,
      };
      a.towers = [
        {
          ...legalPositions(0)[0],
          id: 1,
          kind: "arrow",
          level: 1,
          active: true,
          paidCost: 50,
          upgradeSpend: 0,
          targeting: "first",
          builtAt: 0,
        },
      ];
      a.nextTowerId = 1;
      r.arcade = a;
      if (!validAdventure(r)) throw Error("Invalid neutral-wave test fixture");
      localStorage.setItem("ayah-flow-adventures-v1", JSON.stringify(data));
    }, kind);
    await mountRush(page, { game: "ayah-defense", refs: ["1:1", "1:2"] });
    await page.evaluate(() => {
      for (let n = 0; n < 20; n++) {
        window.rushClock += 1000 / 60;
        for (const [id, fn] of [...window.rushFrames]) {
          window.rushFrames.delete(id);
          fn(window.rushClock);
        }
      }
    });
    await expect(page.locator(`[data-defense-balloon=${kind}]`)).toBeVisible();
    await page.evaluate(() => window.rushActivity.pause());
    await page
      .locator(".flow-scene")
      .screenshot({ path: `docs/revision4/enemy-${kind}.png` });
  }
});
