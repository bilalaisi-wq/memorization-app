import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enableDeveloperLab } from "./developer-lab-helper.js";
import { menu } from "./menu-helper.js";
import { mockBilling } from "./billing-fixtures.js";
import { seedRescue, gradeRescue, openRescue } from "./rescue-helper.js";
test.use({ hasTouch: true });
async function openMode(page, label) {
  await menu(page);
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function audioFixture(page) {
  await page.addInitScript(() => {
    window.auditClips = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        window.auditClips.push(this);
      }
      play() {
        this.active = true;
        return Promise.resolve();
      }
      pause() {
        this.active = false;
      }
      removeAttribute() {}
      load() {}
    };
  });
}
test("opening a quest suspends Blocks motion and recitation without destroying its current game", async ({
  page,
}) => {
  await audioFixture(page);
  await page.goto("/");
  await enableDeveloperLab(page);
  await page.locator("#nav-puzzle-lab").click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.auditClips.filter((a) => a.active).length),
    )
    .toBe(1);
  await openMode(page, "Muraja’ah Boss Rush");
  await expect(page.locator(".advanced-revision")).toBeVisible();
  await expect(page.locator("#fall-pause")).toHaveText("Resume");
  expect(
    await page.evaluate(() => window.auditClips.filter((a) => a.active).length),
  ).toBe(0);
  await page.locator(".advanced-revision").focus();
  await page.keyboard.press("KeyP");
  await expect(page.locator("#fall-pause")).toHaveText("Resume");
  const positions = await page
    .locator(".tetromino-cell.active")
    .evaluateAll((ns) => ns.map((n) => n.getAttribute("style")));
  await page.waitForTimeout(1450);
  expect(
    await page
      .locator(".tetromino-cell.active")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("style"))),
  ).toEqual(positions);
  await page.locator("[data-rv-close]").click();
  await expect(page.locator(".falling-stage")).toBeVisible();
  await expect(page.locator("#fall-pause")).toHaveText("Resume");
  await page.locator("#fall-pause").click();
  await expect(page.locator("#fall-pause")).toHaveText("Pause");
});
test("late reward responses cannot write account A totals into account B", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { RewardPublisher } = await import("/src/rewards/publisher.js"),
      { createLearningStore } = await import("/src/learning-store.js"),
      { surahs } = await import("/src/data.js"),
      { profileStorage, selectProfile } =
        await import("/src/learner/profile-storage.js");
    selectProfile("audit-a");
    let release;
    const gate = new Promise((r) => (release = r));
    const client = {
      rpc: async () => {
        await gate;
        return { data: { lifetimeXp: 999, lifetimeStars: 8 } };
      },
    };
    const pub = new RewardPublisher(
      client,
      createLearningStore(profileStorage, surahs),
      profileStorage,
      "audit-a",
    );
    const pending = pub.flush();
    await new Promise((r) => setTimeout(r, 30));
    pub.dispose();
    selectProfile("audit-b");
    release();
    await pending;
    return { b: profileStorage.getItem("ayah-reward-remote-v1") };
  });
  expect(result.b).toBeNull();
});
test("passage export preserves malformed source bytes rather than exporting an empty fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "ayah-passage-recall-v1",
      '{"version":999,"precious":"original"}',
    ),
  );
  await page.evaluate(async () =>
    (await import("/src/passage/ui.js")).openPassageStudio({}),
  );
  await page.locator("[data-start]").click();
  await expect(page.locator("[data-export]")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.locator("[data-export]").click();
  const file = await download;
  expect(await readFile(await file.path(), "utf8")).toBe(
    '{"version":999,"precious":"original"}',
  );
});
test("device export includes local quest and passage records and excludes other profiles and auth tokens", async ({
  page,
}) => {
  await page.goto("/");
  const exported = await page.evaluate(async () => {
    const { profileStorage, profileBackup, selectProfile } =
      await import("/src/learner/profile-storage.js");
    selectProfile("audit-a");
    for (const k of [
      "ayah-passage-recall-v1",
      "ayah-passage-workspaces-v1",
      "ayah-quest-campaigns-v1",
      "ayah-quest-revision-v1",
    ])
      profileStorage.setItem(k, `raw:${k}`);
    localStorage.setItem(
      "ayah-user:audit-b:ayah-passage-recall-v1",
      "private B",
    );
    localStorage.setItem("sb-audit-auth-token", "secret fixture");
    return profileBackup();
  });
  for (const k of [
    "ayah-passage-recall-v1",
    "ayah-passage-workspaces-v1",
    "ayah-quest-campaigns-v1",
    "ayah-quest-revision-v1",
  ])
    expect(exported[k]).toBe(`raw:${k}`);
  expect(JSON.stringify(exported)).not.toContain("private B");
  expect(JSON.stringify(exported)).not.toContain("secret fixture");
});

test("upgrade and downgrade reauthorize private passages while preserving history and allowing free recall after explicitly setting aside an unavailable attempt", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  const state = await mockBilling(page, { plan: "free" });
  let grant = false;
  await page.route("**/functions/v1/quran-content", async (r) =>
    grant
      ? r.fulfill({ json: fixture })
      : r.fulfill({
          status: 403,
          json: { error: "Premium entitlement unavailable" },
        }),
  );
  await page.goto("/");
  await seedRescue(page, {
    keys: ["2:282"],
    signed: true,
    ages: [3],
    privateBundle: fixture,
  });
  const original = await page.evaluate(
    async () =>
      JSON.parse(
        (
          await import("/src/learner/profile-storage.js")
        ).profileStorage.getItem("ayah-passage-recall-v1"),
      ).records["ayah:2:282"],
  );
  await openRescue(page);
  await page.locator("[data-cr-review]").click();
  await expect(page.locator("[data-cr-status]")).toContainText(
    "Premium entitlement unavailable",
  );
  await expect(page.locator(".passage-studio")).toHaveCount(0);
  grant = true;
  state.ent.plan = "pathfinder";
  state.ent.features.passageBuilder = true;
  await page.locator("[data-cr-review]").click();
  await expect(page.locator("[data-declare]")).toBeVisible();
  await page.locator(".passage-studio [data-close]").click();
  grant = false;
  state.ent.plan = "free";
  state.ent.features.passageBuilder = false;
  await page.locator("[data-cr-review]").click();
  await expect(page.locator("[data-cr-status]")).toContainText(
    "Premium entitlement unavailable",
  );
  await expect(page.locator(".passage-studio")).toHaveCount(0);
  await page.locator("[data-cr-classic]").last().click();
  await page.locator("[data-set-aside]").click();
  await page.locator("[data-start]").click();
  await expect(page.locator("[data-reference]")).toHaveValue("1:1");
  await page.locator("[data-recall]").click();
  await gradeRescue(page);
  const after = await page.evaluate(async () =>
    JSON.parse(
      (await import("/src/learner/profile-storage.js")).profileStorage.getItem(
        "ayah-passage-recall-v1",
      ),
    ),
  );
  expect(after.records["ayah:2:282"]).toEqual(original);
  expect(after.records["ayah:1:1"].history).toHaveLength(1);
  expect(after.records["ayah:1:1"].history[0].independent).toBe(true);
});
test("returning to practice records no invented Again grade or FSRS lapse", async ({
  page,
}) => {
  await page.goto("/");
  await seedRescue(page);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).records,
  );
  await page.evaluate(async () =>
    (await import("/src/passage/ui.js")).openPassageStudio({}),
  );
  await page.locator("[data-start]").click();
  await page.locator("[data-recall]").click();
  await expect(page.locator("[data-declare]")).toBeVisible();
  await page.locator("[data-abandon]").click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).records,
    ),
  ).toEqual(before);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).active,
    ),
  ).toBeNull();
});

test("sign-out clears private surfaces and audio authorization before page reload while retaining owned review history", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
  );
  const { billingUser } = await import("./billing-fixtures.js");
  await mockBilling(page, { plan: "pathfinder" });
  await page.route("**/functions/v1/quran-content", (r) =>
    r.fulfill({ json: fixture }),
  );
  await page.route("**/auth/v1/logout*", (r) => r.fulfill({ status: 204 }));
  await page.goto("/");
  await seedRescue(page, {
    keys: ["2:282"],
    signed: true,
    privateBundle: fixture,
  });
  const before = await page.evaluate(async () =>
    (await import("/src/learner/profile-storage.js")).profileStorage.getItem(
      "ayah-passage-recall-v1",
    ),
  );
  await enableDeveloperLab(page);
  await page.evaluate(async (user) => {
    const { openPassageStudio } = await import("/src/passage/ui.js"),
      { appearanceAccount } = await import("/src/learner/accounts.js"),
      { configurePrivateAudio, privateAudioSource, resolvePlaybackSource } =
        await import("/src/content/private-audio.js"),
      { activeProfileId } = await import("/src/learner/profile-storage.js");
    openPassageStudio({
      user,
      client: appearanceAccount().client,
      initialReference: "2:282",
    });
    configurePrivateAudio(["2:282"], async () => ({
      url: "blob:audit-only-resource",
      revoke() {},
    }));
    await resolvePlaybackSource("ayah-private:2:282");
    window.addEventListener(
      "beforeunload",
      () =>
        localStorage.setItem(
          "audit-signout-proof",
          JSON.stringify({
            surfaces: document.querySelectorAll(
              ".passage-studio,.passage-expedition,.advanced-revision,.memory-repair,.constellation-rescue",
            ).length,
            source: privateAudioSource(2, 282),
            owner: activeProfileId(),
          }),
        ),
      { once: true },
    );
  }, billingUser);
  await expect(page.locator(".passage-studio .arabic").first()).toHaveText(
    fixture.textUthmani,
  );
  const navigation = page.waitForEvent("framenavigated", {
    predicate: (f) => f === page.mainFrame(),
  });
  await page
    .evaluate(async () => {
      const { appearanceAccount } = await import("/src/learner/accounts.js");
      await appearanceAccount().client.auth.signOut({ scope: "local" });
    })
    .catch((e) => {
      if (!/Execution context|navigation|destroyed/.test(e.message)) throw e;
    });
  await navigation;
  await page.waitForLoadState("domcontentloaded");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("audit-signout-proof")),
    ),
  ).toEqual({ surfaces: 0, source: null, owner: null });
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`ayah-user:${id}:ayah-passage-recall-v1`),
      billingUser.id,
    ),
  ).toBe(before);
});

for (const mode of ["expedition", "boss", "survival"])
  test(`${mode} volume controls have touch-sized hit areas and work with arrow keys`, async ({
    page,
  }) => {
    const { openAuditMode, chartAudit, auditModes } =
      await import("./release-helpers.js");
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/");
    await openAuditMode(page, mode);
    if (mode === "expedition") await chartAudit(page);
    const range = page
      .locator(`${auditModes[mode].root} input[type=range]`)
      .first();
    await expect(range).toBeVisible();
    expect((await range.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await range.fill("0.5");
    await range.focus();
    await page.keyboard.press("ArrowRight");
    expect(Number(await range.inputValue())).toBeGreaterThan(0.5);
  });
test("an old billing portal response cannot redirect after its account changes", async ({
  page,
}) => {
  await mockBilling(page, { plan: "pathfinder" });
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/functions/v1/billing-portal", async (r) => {
    await gate;
    await r.fulfill({
      json: { url: "https://billing.stripe.com/p/session/test_fixture" },
    });
  });
  let redirects = 0;
  await page.route("https://billing.stripe.com/**", (r) => {
    redirects++;
    return r.fulfill({ body: "must not navigate" });
  });
  await page.goto("/");
  await enableDeveloperLab(page);
  await openMode(page, "Subscription & billing");
  await page.locator("[data-portal]").click();
  await page.evaluate(async () =>
    (await import("/src/learner/profile-storage.js")).selectProfile("audit-b"),
  );
  await expect(page.locator(".billing-dialog")).toHaveCount(0);
  release();
  await page.waitForTimeout(150);
  expect(redirects).toBe(0);
});
test("paused recitation releases the sound-effect ownership lock without resuming narration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ayah-experience-v1",
      JSON.stringify({ sound: true, volume: 0.3, motion: false }),
    );
    window.auditSoundContexts = 0;
    window.AudioContext = class {
      constructor() {
        window.auditSoundContexts++;
        throw Error("test-only audio sink");
      }
    };
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createAudioManager } =
        await import("/src/puzzles/arcade/services.js"),
      { successCue } = await import("/src/ui/encouragement.js");
    class Clip {
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
      removeAttribute() {}
      load() {}
    }
    const audio = createAudioManager({ AudioClass: Clip, owner: "audit-lock" });
    await audio.play("audit-clip");
    successCue("audit-busy");
    const busy = window.auditSoundContexts;
    audio.pause();
    successCue("audit-paused");
    const paused = window.auditSoundContexts;
    audio.dispose();
    return { busy, paused };
  });
  expect(result).toEqual({ busy: 0, paused: 1 });
});

test("copying guest core progress is explicit, keeps guest quest data intact and never imports another profile", async ({
  page,
}) => {
  const { billingUser } = await import("./billing-fixtures.js");
  await mockBilling(page);
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await import("/src/learner/profile-storage.js")).activeProfileId(),
      ),
    )
    .toBe(billingUser.id);
  const before = await page.evaluate(async () => {
    const { createLearningStore } = await import("/src/learning-store.js"),
      { surahs } = await import("/src/data.js");
    const s = createLearningStore(localStorage, surahs);
    s.recordLabPuzzle({
      key: "1:1",
      sessionId: "audit-guest",
      game: "falling",
      mistakes: 0,
    });
    localStorage.setItem(
      "ayah-quest-revision-v1",
      '{"version":999,"precious":"guest journey"}',
    );
    localStorage.setItem("ayah-user:audit-b:ayah-learning-v1", "private B");
    return localStorage.getItem("ayah-learning-v1");
  });
  await menu(page);
  await page.getByRole("button", { name: "My account", exact: true }).click();
  await expect(page.locator("[data-copy]")).toContainText("core");
  page.on("dialog", (d) => d.accept());
  const navigation = page.waitForEvent("framenavigated", {
    predicate: (f) => f === page.mainFrame(),
  });
  await page.locator("[data-copy]").click();
  await navigation;
  await page.waitForLoadState("domcontentloaded");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-learning-v1")),
  ).toBe(before);
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-quest-revision-v1")),
  ).toContain("guest journey");
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem(`ayah-user:${id}:ayah-learning-v1`))
          .wallet.xp,
      billingUser.id,
    ),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`ayah-user:${id}:ayah-quest-revision-v1`),
      billingUser.id,
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ayah-user:audit-b:ayah-learning-v1"),
    ),
  ).toBe("private B");
});
