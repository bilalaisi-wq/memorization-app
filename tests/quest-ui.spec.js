import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { mockBilling } from "./billing-fixtures.js";
import { openMazeChoice } from "./maze-helper.js";
import { surahs } from "../src/data.js";
// A test-only consumer mounts the exported framework. No learner campaign UI is shipped.
async function prepare(
  page,
  {
    campaignId = "passage-expedition",
    game = "maze",
    key = "1:1",
    restore = false,
  } = {},
) {
  await page.evaluate(
    async (opts) => {
      const q = await import("/src/quest/index.js");
      const { loadBundle } = await import("/src/content/library.js");
      const { surahs } = await import("/src/data.js");
      const { createLearningStore } = await import("/src/learning-store.js");
      const { createPuzzleStore } = await import(
        "/src/puzzles/puzzle-store.js"
      );
      window.questOwner = null;
      const store = q.createQuestStore({
        owner: null,
        getOwner: () => window.questOwner,
        storage: localStorage,
      });
      let map;
      if (opts.restore) {
        map = (
          await q.resumeCampaignMap({
            store,
            runId: Object.keys(store.snapshot().runs)[0],
          })
        ).map;
      } else
        map = await q.createCampaignMap({
          campaignId: opts.campaignId,
          game: opts.game,
          bundles: [await loadBundle(opts.key)],
        });
      store.open(map);
      const root = document.createElement("section");
      root.id = "quest-harness";
      root.style.cssText =
        "position:fixed;inset:0;z-index:5000;overflow:auto;background:white;color:#274d41";
      document.body.prepend(root);
      const learning = createLearningStore(localStorage, surahs),
        lab = createPuzzleStore(localStorage, surahs);
      const host = q.createQuestHost({
        root,
        map,
        store,
        learning,
        lab,
        owner: null,
        getOwner: () => window.questOwner,
        storage: localStorage,
      });
      window.quest = { q, map, store, host, learning, root };
      await host.launch(
        q.nextCheckpoint(map, store.snapshot().runs[map.id]).id,
      );
    },
    { campaignId, game, key, restore },
  );
}
async function fill(page) {
  const ids = await page
    .locator("#quest-harness [data-quest-bank] [data-quest-word]")
    .evaluateAll((bs) =>
      bs.map((b) => Number(b.dataset.questWord)).sort((a, b) => a - b),
    );
  for (const id of ids)
    await page.locator(`#quest-harness [data-quest-word="${id}"]`).click();
  await page.locator("[data-quest-check]").click();
}
async function next(page) {
  await page.evaluate(async () => {
    const { q, map, store, host } = window.quest;
    await host.launch(q.nextCheckpoint(map, store.snapshot().runs[map.id]).id);
  });
}

test("practice, real registered maze and existing recall workflow share deterministic checkpoint progress without arcade mastery", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await prepare(page);
  await fill(page);
  await expect(page.locator("[data-quest-status]")).toContainText(
    "Workspace saved",
  );
  await next(page);
  await expect(page.locator(".memory-maze")).toBeVisible();
  for (const text of surahs[0].verses[0].words)
    await openMazeChoice(page, text);
  await expect(page.locator("[data-maze-panel]")).toContainText("saved");
  const state = await page.evaluate(() => window.quest.learning.snapshot());
  expect(state.records["1:1"].memory.card).toBe(null);
  expect(state.records["1:1"].memory.independentAttempts).toBe(0);
  await next(page);
  await page.locator("[data-quest-confirm]").click();
  await expect(page.locator("[data-quest-status]")).toContainText(
    "No successful independent",
  );
  await page.locator("[data-quest-recall]").click();
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await page.locator('[data-grade="Good"]').click();
  await page.locator(".passage-studio [data-close]").click();
  await page.locator("[data-quest-confirm]").click();
  await expect(page.locator("[data-quest-status]")).toContainText(
    "checkpoint saved",
  );
  const result = await page.evaluate(() => ({
    run: Object.values(window.quest.store.snapshot().runs)[0],
    passage: JSON.parse(localStorage.getItem("ayah-passage-recall-v1")),
  }));
  expect(Object.keys(result.run.completed)).toHaveLength(3);
  expect(result.passage.records["ayah:1:1"].card).not.toBe(null);
});

test("reload resumes next checkpoint, blocked games use practice, keyboard controls work and repeated completion earns once", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await prepare(page, { game: "bridge" });
  await fill(page);
  await page.reload();
  await prepare(page, { restore: true });
  await expect(page.locator(".quest-practice")).toBeVisible();
  await expect(
    page.locator(".memory-maze,.astro-flight,.snake-game"),
  ).toHaveCount(0);
  await page.locator("[data-quest-bank] [data-quest-word]").first().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator("[data-quest-built] [data-quest-word]"),
  ).toHaveCount(1);
  await page.locator("[data-quest-clear]").click();
  await fill(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("ayah-rewards-v1"),
  );
  await page.locator("[data-quest-check]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-rewards-v1")),
  ).toBe(before);
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-quest-campaigns-v1"),
  );
  expect(raw).not.toMatch(/[\u0600-\u06ff]/);
});

test("switching and account changes dispose registered games, media, transitions and keyboard listeners", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.qa = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        this.paused = true;
        window.qa.push(this);
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
  await prepare(page, { campaignId: "constellation-rescue", game: "snake" });
  await expect(page.locator(".ayah-snake")).toBeVisible();
  await page.evaluate(() => window.quest.host.dispose());
  await expect(page.locator("#quest-harness")).toBeEmpty();
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => window.qa.every((a) => a.paused))).toBe(
    true,
  );
  await page.evaluate(() => window.quest.root.remove());
  await prepare(page, { campaignId: "memory-repair" });
  await page.locator("[data-quest-audio]").click();
  await expect
    .poll(() => page.evaluate(() => window.qa.some((a) => !a.paused)))
    .toBe(true);
  await page.evaluate(() => {
    window.questOwner = "another-account";
    window.dispatchEvent(new Event("ayahprofilechange"));
  });
  await expect(page.locator("#quest-harness")).toBeEmpty();
  expect(await page.evaluate(() => window.qa.every((a) => a.paused))).toBe(
    true,
  );
  expect(
    await page.evaluate(() => {
      try {
        window.quest.host.dispatch({ type: "word", position: 1 });
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
});

test("private content is requested through existing authorized loader; denial never falls back to private text", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  const error = await page.evaluate(async () => {
    const { loadBundle } = await import("/src/content/library.js");
    try {
      await loadBundle("2:282", null);
      return null;
    } catch (e) {
      return e.message;
    }
  });
  expect(error).toContain("Sign in");
  // An existing metadata-only checkpoint cannot manufacture content after authorization is lost.
  await prepare(page);
  await page.evaluate(async () => {
    const { host } = window.quest;
    host.dispose();
    const { createQuestHost } = window.quest.q;
    const { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js");
    const { surahs } = await import("/src/data.js");
    window.quest.host = createQuestHost({
      ...window.quest,
      owner: null,
      getOwner: () => null,
      storage: localStorage,
      lab: createPuzzleStore(localStorage, surahs),
      bundleLoader: async () => {
        throw Error("Server denied content");
      },
    });
    try {
      await window.quest.host.launch(window.quest.map.checkpoints[0].id);
    } catch {}
  });
  await expect(page.locator("#quest-harness")).toContainText("Server denied");
  await expect(page.locator("[data-quest-word]")).toHaveCount(0);
});

test.describe("touch and reduced motion", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 320, height: 740 },
    reducedMotion: "reduce",
  });
  test("bounded fallback requires all long-ayah workspaces before completing an arcade checkpoint", async ({
    page,
  }) => {
    await mockBilling(page, { signed: false });
    await page.goto("/");
    await prepare(page, {
      campaignId: "constellation-rescue",
      game: "bubble",
      key: "98:5",
    });
    let count = 0;
    while (await page.locator("[data-quest-bank] [data-quest-word]").count()) {
      const ids = await page
        .locator("[data-quest-bank] [data-quest-word]")
        .evaluateAll((bs) =>
          bs.map((b) => Number(b.dataset.questWord)).sort((a, b) => a - b),
        );
      expect(ids.length).toBeLessThanOrEqual(12);
      for (const id of ids)
        await page.locator(`[data-quest-word="${id}"]`).tap();
      await page.locator("[data-quest-check]").tap();
      count++;
      if (
        (await page.locator("[data-quest-status]").textContent()).includes(
          "Workspace saved",
        )
      )
        break;
      expect(
        await page.evaluate(() =>
          Object.keys(
            Object.values(window.quest.store.snapshot().runs)[0].completed,
          ),
        ),
      ).toHaveLength(0);
    }
    expect(count).toBe(3);
    const bounds = await page.locator("[data-quest-check]").boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.getElementById("quest-harness").getAnimations().length,
      ),
    ).toBe(0);
    expect(
      await page.evaluate(() =>
        Object.keys(
          Object.values(window.quest.store.snapshot().runs)[0].completed,
        ),
      ),
    ).toHaveLength(1);
  });
});

test("late media is released on activity cancellation and source revisions cannot reuse old checkpoints", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await prepare(page);
  await page.evaluate(async () => {
    const { q, host, root, map, store, learning } = window.quest;
    host.dispose();
    const { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js");
    const { surahs } = await import("/src/data.js");
    window.questReleased = 0;
    window.quest.host = q.createQuestHost({
      root,
      map,
      store,
      learning,
      storage: localStorage,
      getOwner: () => null,
      lab: createPuzzleStore(localStorage, surahs),
      audioLoader: () =>
        new Promise(
          (resolve) =>
            (window.questRelease = () =>
              resolve({
                url: "fixture-only.mp3",
                revoke: () => window.questReleased++,
              })),
        ),
    });
    window.pendingQuestLaunch = window.quest.host.launch(map.checkpoints[0].id);
  });
  await expect
    .poll(() => page.evaluate(() => typeof window.questRelease))
    .toBe("function");
  await page.evaluate(async () => {
    window.quest.host.dispose();
    window.questRelease();
    await window.pendingQuestLaunch;
  });
  expect(await page.evaluate(() => window.questReleased)).toBe(1);
  await expect(page.locator("#quest-harness")).toBeEmpty();
  await page.evaluate(async () => {
    const { q, root, map, store, learning } = window.quest;
    const { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js");
    const { surahs } = await import("/src/data.js");
    const { loadBundle } = await import("/src/content/library.js");
    const host = q.createQuestHost({
      root,
      map,
      store,
      learning,
      storage: localStorage,
      getOwner: () => null,
      lab: createPuzzleStore(localStorage, surahs),
      bundleLoader: async (key) => ({
        ...(await loadBundle(key)),
        contentRevision: "different-source-fixture",
      }),
    });
    try {
      await host.launch(map.checkpoints[0].id);
    } catch {}
    window.quest.host = host;
  });
  await expect(page.locator("#quest-harness")).toContainText(
    "Source or reviewed segmentation changed",
  );
  expect(
    await page.evaluate(() =>
      Object.keys(
        Object.values(window.quest.store.snapshot().runs)[0].completed,
      ),
    ),
  ).toHaveLength(0);
});

test("default account namespaces never inherit guest or other-account campaigns", async ({
  page,
}) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await prepare(page);
  const result = await page.evaluate(() => {
    const { q, map } = window.quest;
    let owner = "A";
    const a = q.createQuestStore({ owner: "A", getOwner: () => owner });
    a.open(map);
    a.start(map, map.checkpoints[0]);
    a.complete(map, map.checkpoints[0], { evidence: "practice" });
    owner = "B";
    const b = q.createQuestStore({ owner: "B", getOwner: () => owner });
    b.open(map);
    return {
      b: Object.keys(b.snapshot().runs[map.id].completed).length,
      a: JSON.parse(localStorage.getItem("ayah-user:A:ayah-quest-campaigns-v1"))
        .runs[map.id].unlocks.length,
      guest: Object.values(window.quest.store.snapshot().runs)[0].unlocks
        .length,
    };
  });
  expect(result).toEqual({ a: 1, b: 0, guest: 0 });
});

test("authorized map metadata cannot bypass a later real content-endpoint denial", async ({
  page,
}) => {
  await mockBilling(page, { plan: "pathfinder" });
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  let deny = false;
  const requests = [];
  await page.route("**/functions/v1/quran-content", (r) => {
    requests.push(r.request().postDataJSON());
    return r.fulfill(
      deny
        ? {
            status: 403,
            json: { error: "Subscription no longer grants this content" },
          }
        : { json: fixture },
    );
  });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          !!(await import("/src/learner/accounts.js")).appearanceAccount()
            .client,
      ),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const q = await import("/src/quest/index.js"),
      { loadBundle } = await import("/src/content/library.js");
    const { appearanceAccount } = await import("/src/learner/accounts.js");
    const { client, userId } = appearanceAccount();
    const { surahs } = await import("/src/data.js"),
      { createLearningStore } = await import("/src/learning-store.js"),
      { createPuzzleStore } = await import("/src/puzzles/puzzle-store.js");
    const { scopedStorage } = await import("/src/learner/profile-storage.js");
    const storage = scopedStorage(userId);
    const map = await q.createCampaignMap({
      campaignId: "memory-repair",
      bundles: [await loadBundle("2:282", client)],
    });
    const store = q.createQuestStore({
      owner: userId,
      getOwner: () => userId,
      storage,
    });
    store.open(map);
    const root = document.createElement("section");
    root.id = "quest-private";
    document.body.prepend(root);
    window.privateQuest = {
      host: q.createQuestHost({
        root,
        map,
        store,
        owner: userId,
        getOwner: () => userId,
        storage,
        client,
        learning: createLearningStore(storage, surahs),
        lab: createPuzzleStore(storage, surahs),
      }),
      map,
    };
  });
  deny = true;
  await page.evaluate(async () => {
    try {
      await window.privateQuest.host.launch(
        window.privateQuest.map.checkpoints[0].id,
      );
    } catch {}
  });
  await expect(page.locator("#quest-private")).toContainText(
    "Subscription no longer grants",
  );
  await expect(page.locator("#quest-private [data-quest-word]")).toHaveCount(0);
  expect(requests).toEqual([
    { key: "2:282", asset: "bundle" },
    { key: "2:282", asset: "bundle" },
  ]);
});
