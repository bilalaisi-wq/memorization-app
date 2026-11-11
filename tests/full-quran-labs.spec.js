import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  assertRunnerContent,
  prepareRunnerContent,
} from "../src/quest/cosmic/authorized-runner.js";
import {
  createFlowUnits,
  flowChoices,
} from "../src/quest/cosmic/flow-content.js";
import { createFlowRunner } from "../src/puzzles/arcade/cosmic/flow-runner.js";
import {
  campaignRefs,
  marathonPlan,
  revisionRange,
} from "../src/revision/missions/model.js";
import { chroniclesCatalog } from "../src/chronicles/catalog.js";
import { createPassageMemory } from "../src/passage/memory.js";
import { contentContracts } from "../src/puzzles/arcade/passage/contracts.js";
const pilot = JSON.parse(
  await readFile(new URL("./fixtures/2-282.json", import.meta.url), "utf8"),
);
test("all 30 juz and multi-juz ranges generate bounded resumable canonical campaigns with no false chapter seams", async () => {
  for (let juz = 1; juz <= 30; juz++) {
    const refs = revisionRange({ scope: "juz", juz });
    expect(new Set(refs).size).toBe(refs.length);
    const p = await marathonPlan(refs, { game: "runner" });
    expect(p.stages.flatMap((s) => s.refs)).toEqual(refs);
    for (const st of p.stages) {
      expect(st.refs.length).toBeLessThanOrEqual(5);
      expect(new Set(st.links.map((k) => k.split(":")[0])).size).toBe(1);
    }
  }
  const refs = revisionRange({ scope: "range", from: "2:140", to: "3:12" });
  expect(campaignRefs(refs)).toEqual(refs);
  expect((await marathonPlan(refs, { game: "runner" })).id).toBe(
    (await marathonPlan(refs, { game: "runner" })).id,
  );
  expect(() => campaignRefs(["2:1", "2:3"])).toThrow();
});
test("authorized long runner uses original positions, bounded flowing chunks, authentic free distractors and full-ayah audio", async () => {
  let revoked = 0;
  const source = await prepareRunnerContent(["2:282"], null, {
    loader: async () => structuredClone(pilot),
    audioLoader: async () => ({
      url: "blob:test-only",
      revoke() {
        revoked++;
      },
    }),
  });
  const units = createFlowUnits(source.refs, "mixed", 0, source);
  expect(units.every((u) => u.text.split(/\s+/).filter(Boolean).length <= 5))
    .toBe(true);
  expect(
    units.flatMap((u) =>
      u.kind === "word"
        ? [u.index]
        : Array.from({ length: u.endIndex - u.index }, (_, i) => u.index + i)
    ),
  ).toEqual(pilot.words.map((_, i) => i));
  const choices = flowChoices(units[0], 42, source);
  expect(choices).toHaveLength(3);
  expect(choices.every(unit=>source.transliteration(unit).length>0)).toBe(true);
  expect(choices.some((u) => u.id === units[0].id)).toBe(true);
  const engine = createFlowRunner({
    units,
    choices: (u, seed) => flowChoices(u, seed, source),
    stageId: "test",
    seed: 42,
  });
  engine.start();
  engine.dispatch({ type: "steer", direction: 1 });
  engine.dispatch({ type: "tick", dt: .1 });
  expect(engine.getSnapshot().objects.some((o) => o.kind === "pickup")).toBe(
    true,
  );
  expect(await source.audio("2:282")).toBe("blob:test-only");
  expect(await source.audio("2:282")).toBe("blob:test-only");
  source.dispose();
  expect(revoked).toBe(1);
  expect(() => source.words("2:282")).toThrow();
  expect(() => assertRunnerContent({ refs: ["2:282"] })).toThrow();
  engine.dispose();
});
test("denials, source revisions and account-surface invalidation fail closed without FSRS writes", async () => {
  await expect(prepareRunnerContent(["2:282"], null, {
    loader: async () => {
      throw Error("Forbidden");
    },
  })).rejects.toThrow("Forbidden");
  let changed = false, current = true;
  const source = await prepareRunnerContent(["2:282"], null, {
    isCurrent: () => current,
    loader: async () => ({
      ...structuredClone(pilot),
      translation: changed ? "changed edition" : pilot.translation,
    }),
  });
  changed = true;
  await expect(source.revalidate()).rejects.toThrow("revision");
  current = false;
  expect(() => source.words("2:282")).toThrow("authorization");
  source.dispose();
  expect(Object.keys(contentContracts)).toHaveLength(7);
  for (const c of Object.values(contentContracts)) {
    expect(c.maxUnits).toBeLessThanOrEqual(12);
  }
});
test("QUR’AN CHRONICLES recognizes all 114 chapters without inventing published comprehension material", () => {
  expect(chroniclesCatalog()).toHaveLength(114);
  expect(chroniclesCatalog().every((c) => c.lessons.length === 0)).toBe(true);
  const catalog = chroniclesCatalog([{
    id: "draft",
    status: "draft",
    refs: ["2:255"],
    hash: "a".repeat(64),
  }, {
    id: "published",
    status: "published",
    refs: ["2:255"],
    hash: "a".repeat(64),
  }]);
  expect(catalog[1].lessons).toEqual(["published"]);
  expect(catalog[55].lessons).toEqual([]);
});

test("authorized Al-Baqarah uses the same Memorization tabs and actual Star Runner controls, with cleanup and no recall-grade writes", async ({ page }) => {
  const { mockBilling, billingUser } = await import("./billing-fixtures.js");
  await mockBilling(page, { plan: "pathfinder" });
  await page.addInitScript(() => {
    window.Audio = class {
      play() {
        return Promise.resolve();
      }
      pause() {}
      load() {}
      removeAttribute() {}
    };
  });
  await page.route(
    "**/functions/v1/quran-content",
    (r) =>
      r.fulfill(
        r.request().postDataJSON()?.asset === "audio"
          ? { status: 503, json: { error: "Audio fixture unavailable" } }
          : { json: pilot },
      ),
  );
  await page.goto("/");
  await page.locator(".passage-context-nav summary").click();
  await page.locator("[data-context-first]").selectOption("2:282");
  await page.locator("[data-context-last]").fill("282");
  await page.getByRole("button", {
    name: "Use passage in all labs",
    exact: true,
  }).click();
  await expect(page.locator("[data-context-classic=quiz]")).toBeVisible();
  await page.locator("[data-context-classic=quiz]").click();
  await expect(page.locator("[data-hints]")).toHaveValue("1");
  await page.locator("[data-context-classic=practice]").click();
  await expect(page.locator("[data-hints]")).toHaveValue("0");
  await page.locator("[data-context-classic=recall]").click();
  await expect(page.locator(".context-lab-content .passage-studio"))
    .toHaveAttribute("data-recall-active", "true");
  await page.locator("[data-context-classic=practice]").click();
  await expect(page.locator("[data-hints]")).toHaveValue("0");
  await page.locator("#nav-revision-lab").click();
  const before = await page.evaluate(
    (id) => localStorage.getItem(`ayah-user:${id}:ayah-passage-recall-v1`),
    billingUser.id,
  );
  await page.locator("[data-context-runner]").click();
  await expect(page.locator(".star-runner")).toBeVisible();
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await expect(page.locator("[data-flight-objects] .runner-pickup"))
    .toHaveCount(3);
  await page.locator(".runner-field").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-flow-prompt]")).toContainText("Al-Baqarah");
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`ayah-user:${id}:ayah-passage-recall-v1`),
      billingUser.id,
    ),
  ).toBe(before);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("ayah-content-access-changed"))
  );
  await expect(page.locator(".star-runner")).toHaveCount(0);
});
