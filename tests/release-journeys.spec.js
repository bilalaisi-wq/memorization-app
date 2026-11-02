import { test, expect } from "@playwright/test";
import { surahs } from "../src/data.js";
import { openMazeChoice } from "./maze-helper.js";
import { gradeRescue } from "./rescue-helper.js";
import { openAuditMode, chartAudit, connectAudit } from "./release-helpers.js";
import { mockBilling, billingUser } from "./billing-fixtures.js";
test.use({ hasTouch: true });
test("one learner studies, completes a real arcade, independently recalls, revises, repairs and follows a Survival route without fake mastery", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await openAuditMode(page, "expedition");
  await chartAudit(page);
  await page.locator("[data-ex-discover]").click();
  await page.locator("[data-ex-next]").click();
  for (let i = 0; i < 3; i++) await connectAudit(page);
  await page.locator("[data-ex-next]").click();
  await connectAudit(page);
  await page.locator("[data-ex-next]").click();
  await expect(page.locator(".maze-grid")).toBeVisible();
  for (const text of surahs[0].verses[0].words)
    await openMazeChoice(page, text);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("ayah-passage-recall-v1") || '{"records":{}}',
        ).records,
    ),
  ).toEqual({});
  await page.locator("[data-ex-next]").click();
  await page.locator("[data-quest-recall]").click();
  await gradeRescue(page);
  await page.locator("[data-ex-next]").click();
  await expect(page.locator(".ex-reveal")).toBeVisible();
  await page.locator("[data-ex-revision]").click();
  await expect(page.locator("[data-cr-star]")).toHaveCount(1);
  await page.locator("[data-cr-review]").click();
  await gradeRescue(page, "Again");
  const actual = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).records[
        "ayah:1:1"
      ],
  );
  expect(actual.history.map((h) => h.grade)).toEqual(["Good", "Again"]);
  await page.locator("[data-cr-close]").click();
  await openAuditMode(page, "repair", { enable: false });
  await page
    .locator("[data-repair-node]")
    .filter({ hasText: "Recall difficulty records" })
    .click();
  await expect(page.locator(".repair-detail")).toContainText(
    "Learner graded Again",
  );
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1"),
  );
  await page.locator("[data-repair-launch]").click();
  await expect(page.locator(".snake-board")).toBeVisible();
  await page.locator("[data-repair-back]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
  ).toBe(raw);
  await page
    .locator("[data-repair-node]")
    .filter({ hasText: "Recall difficulty records" })
    .click();
  await page.locator("[data-repair-recall]").click();
  await gradeRescue(page);
  await page.locator("[data-repair-close]").click();
  await openAuditMode(page, "survival", { enable: false });
  await page.locator("[data-rv-unit]").first().check();
  await page.locator("[data-rv-form] button[type=submit]").click();
  await page.locator("[data-rv-recall]").click();
  await gradeRescue(page);
  await expect(page.locator(".rv-summary")).toContainText(
    "1 distinct recall units covered",
  );
  await page.locator("[data-rv-revision]").click();
  await expect(page.locator("[data-cr-star]")).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ayah-passage-recall-v1")).records[
          "ayah:1:1"
        ].history.length,
    ),
  ).toBe(4);
});
for (const [mode, status] of [
  ["boss", "playing"],
  ["boss", "pending"],
  ["boss", "paused"],
  ["boss", "lost"],
  ["boss", "won"],
  ["survival", "pending"],
  ["survival", "camp"],
  ["survival", "lost"],
  ["survival", "won"],
  ["survival", "ended"],
])
  test(`${mode} reload preserves ${status} state, genuine grades and game charges`, async ({
    page,
  }) => {
    await page.goto("/");
    const seeded = await page.evaluate(
      async ({ mode, status }) => {
        const { buildRevisionPlan } =
            await import("/src/quest/advanced/model.js"),
          { createRevisionStore } =
            await import("/src/quest/advanced/store.js"),
          { createPassageMemory } = await import("/src/passage/memory.js"),
          { localBundle } = await import("/src/content/library.js"),
          { recallUnit } = await import("/src/passage/model.js");
        const units = await Promise.all(
            ["1:1", "1:2", "1:3", "1:4"].map((k) =>
              recallUnit([localBundle(k)]),
            ),
          ),
          memory = createPassageMemory(localStorage),
          store = createRevisionStore({
            storage: localStorage,
            owner: null,
            getOwner: () => null,
          });
        const { plan } = await buildRevisionPlan(
            mode === "boss"
              ? { mode, refs: ["1:1", "1:2"] }
              : { mode, units, length: "extended" },
          ),
          run = store.create(plan);
        const grade = (rating) => {
          const r = store.snapshot().runs[run.id],
            c = r.plan.checkpoints[r.cursor];
          store.begin(run.id);
          const a = memory.begin(c.unit);
          memory.update("declared");
          memory.update("compared");
          memory.grade(a.id, rating);
          store.apply(run.id, memory.snapshot());
        };
        if (status === "pending") {
          store.begin(run.id);
          const a = memory.begin(plan.checkpoints[0].unit);
          memory.update("declared");
        }
        if (status === "paused") store.pause(run.id);
        if (status === "lost") for (let i = 0; i < 3; i++) grade("Again");
        if (status === "camp") for (let i = 0; i < 3; i++) grade("Good");
        if (status === "won")
          while (store.snapshot().runs[run.id].status !== "won") {
            const r = store.snapshot().runs[run.id];
            if (r.status === "camp") store.camp(run.id);
            else if (r.plan.checkpoints[r.cursor].kind === "discrimination")
              store.choose(run.id, r.plan.checkpoints[r.cursor].target);
            else grade("Good");
          }
        if (status === "ended") store.end(run.id);
        return {
          run: store.snapshot().runs[run.id],
          memory: localStorage.getItem("ayah-passage-recall-v1"),
        };
      },
      { mode, status },
    );
    await page.reload();
    await openAuditMode(page, mode);
    await page.locator(`[data-rv-resume="${seeded.run.id}"]`).click();
    expect(
      await page.evaluate(
        () =>
          Object.values(
            JSON.parse(localStorage.getItem("ayah-quest-revision-v1")).runs,
          )[0].charges,
      ),
    ).toBe(seeded.run.charges);
    expect(
      await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1")),
    ).toBe(seeded.memory);
    if (status === "pending") {
      await page.locator("[data-rv-recall]").click();
      await expect(page.locator("[data-declare]")).toBeDisabled();
      await page.locator(".passage-studio [data-close]").click();
    }
    if (status === "lost" || status === "won" || status === "ended")
      await expect(page.locator(".rv-summary")).toBeVisible();
    else if (status === "camp")
      await expect(page.locator("[data-rv-camp]")).toBeVisible();
    else await expect(page.locator(".rv-challenge")).toBeVisible();
  });
test("standalone passage audio and pending sync are disposed when the profile changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.auditPlaying = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
        window.auditPlaying.push(this);
      }
      play() {
        this.active = true;
        return Promise.resolve();
      }
      pause() {
        this.active = false;
      }
      load() {}
      removeAttribute() {}
    };
  });
  await mockBilling(page);
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await import("/src/learner/profile-storage.js")).activeProfileId(),
      ),
    )
    .toBe(billingUser.id);
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/rest/v1/passage_learning*", async (r) => {
    await gate;
    await r.fulfill({
      json: {
        document: { version: 1, records: {}, active: null },
        revision: 2,
      },
    });
  });
  await page.evaluate(
    async (user) =>
      (await import("/src/passage/ui.js")).openPassageStudio({
        user,
        client: (await import("/src/learner/accounts.js")).appearanceAccount()
          .client,
      }),
    billingUser,
  );
  await page.locator("[data-start]").click();
  await page.locator(".passage-studio [data-listen]").click();
  await expect
    .poll(() =>
      page.evaluate(() => window.auditPlaying.filter((a) => a.active).length),
    )
    .toBe(1);
  await page.locator("[data-sync]").click();
  await page.evaluate(async () =>
    (await import("/src/learner/profile-storage.js")).selectProfile("audit-b"),
  );
  await expect(page.locator(".passage-studio")).toHaveCount(0);
  expect(
    await page.evaluate(() => window.auditPlaying.every((a) => !a.active)),
  ).toBe(true);
  release();
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ayah-user:audit-b:ayah-passage-recall-v1"),
    ),
  ).toBeNull();
});

test('metadata navigation is neutral but Expedition study marks a matching core recall as assisted',async({page})=>{
 const {enableDeveloperLab}=await import('./developer-lab-helper.js');await page.goto('/');await enableDeveloperLab(page);await page.locator('[data-start-recall="1:1"]').first().click();const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).activeReview);expect(before.usedHint).toBe(false);await openAuditMode(page,'rescue',{enable:false});expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).activeReview.usedHint)).toBe(false);await page.locator('[data-cr-close]').click();await openAuditMode(page,'expedition',{enable:false});await chartAudit(page);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-learning-v1')).activeReview.usedHint)).toBe(true);
});
test('repair-game word exposure flags a pending passage attempt without writing a grade, history or schedule',async({page})=>{
 const {seedAuditRecords}=await import('./release-helpers.js');await page.goto('/');await seedAuditRecords(page);await page.evaluate(async()=>{const {createPassageMemory}=await import('/src/passage/memory.js');createPassageMemory(localStorage).begin({id:'ayah:1:1',type:'ayah',refs:['1:1']});});const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-recall-v1')).records);await openAuditMode(page,'repair');await page.locator('[data-repair-node]').filter({hasText:'Word selection'}).click();await page.locator('[data-repair-launch]').click();await expect(page.locator('.astro-stage')).toBeVisible();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-recall-v1')));expect(after.active.assisted).toBe(true);expect(after.records).toEqual(before);
});
