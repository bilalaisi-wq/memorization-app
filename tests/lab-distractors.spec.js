import { menu } from "./menu-helper.js";
import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { surahs } from "../src/data.js";
import { wordIdentity } from "../src/distractors.js";
import {
  wordChoices,
  passageChoices,
  textIdentity,
} from "../src/puzzles/lab-choices.js";
import { LEARNING_KEY } from "../src/learning-store.js";
const open = async (page, game = "falling") => {
  await page.addInitScript(() => {
    window.played = [];
    window.Audio = class {
      constructor(url) {
        this.url = url;
      }
      play() {
        window.played.push(this.url);
        setTimeout(() => this.onended?.(), 2);
        return Promise.resolve();
      }
      pause() {}
    };
  });
  await page.goto("/");
  await (await menu(page)).locator("#nav-lab").click();
  if (game !== "falling") await page.locator(`[data-game="${game}"]`).click();
};
const noReward = async (page) => {
  const data = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    LEARNING_KEY,
  );
  expect(data.wallet.xp).toBe(0);
  expect(Object.values(data.records).flatMap((r) => r.memory.history)).toEqual(
    [],
  );
};

test("every supported ayah receives distinct authentic extra words with local audio", () => {
  test.setTimeout(90_000);
  for (const chapter of surahs)
    for (const verse of chapter.verses) {
      const choices = wordChoices(chapter, verse, 3);
      expect(choices.map((c) => c.text).slice(0, verse.words.length)).toEqual(
        verse.words,
      );
      expect(choices).toHaveLength(verse.words.length + 3);
      const extra = choices.slice(verse.words.length);
      expect(new Set(extra.map((e) => wordIdentity(e.text))).size).toBe(3);
      for (const e of extra) {
        expect(e.surah).not.toBe(chapter.id);
        expect(verse.words.map(wordIdentity)).not.toContain(
          wordIdentity(e.text),
        );
        expect(existsSync(`public${e.audio}`)).toBe(true);
      }
    }
});

test("foreign word groups and ayahs are unchanged contiguous verified passages with exact recordings", () => {
  for (const chapter of surahs) {
    const verse = chapter.verses[0];
    for (const lengths of [[1, 2, 3], [null]]) {
      const choices = passageChoices(
        surahs,
        chapter.id,
        [verse.words],
        lengths,
        4,
      );
      expect(choices).toHaveLength(4);
      for (const e of choices) {
        const original = surahs
          .find((s) => s.id === e.surah)
          .verses.find((v) => v.id === e.ayah);
        expect(e.words).toEqual(
          original.words.slice(e.start, e.start + e.words.length),
        );
        expect(textIdentity(e.words)).not.toBe(textIdentity(verse.words));
        if (lengths[0] !== null) {
          for (let i = 0; i + e.words.length <= verse.words.length; i++)
            expect(textIdentity(e.words)).not.toBe(
              textIdentity(verse.words.slice(i, i + e.words.length)),
            );
        }
        for (const url of e.audio)
          expect(existsSync(`public${url}`)).toBe(true);
      }
    }
  }
});

test("Falling Words rejects wrong blocks, refuses to discard targets, and plays foreign audio", async ({
  page,
}) => {
  await open(page);
  const n = 4;
  while (
    Number(await page.locator(".falling-block").getAttribute("data-index")) < n
  ) {
    const index = await page
      .locator(".falling-block")
      .getAttribute("data-index");
    await page.locator(`[data-slot="${index}"]`).click();
  }
  const filled = await page.locator(".slot-filled").count();
  await page.locator('[data-slot="0"]').click();
  await expect(page.locator("[data-status]")).toContainText("another ayah");
  await expect(page.locator(".slot-filled")).toHaveCount(filled);
  await page.waitForTimeout(30);
  await page.evaluate(() => { window.played = []; });
  await page.locator("#fall-listen").click();
  await expect.poll(() => page.evaluate(() => window.played.length)).toBe(1);
  expect(await page.evaluate(() => window.played[0])).not.toContain("/001_");
  await page.locator("#fall-pause").click();
  await page.locator(".falling-stage").focus();
  await page.keyboard.press("Delete");
  await noReward(page);
  await page.locator("#lab-restart").click();
  while (
    Number(await page.locator(".falling-block").getAttribute("data-index")) >= n
  )
    await page.locator("#fall-discard").click();
  const target = await page
    .locator(".falling-block")
    .getAttribute("data-index");
  await page.locator("#fall-discard").click();
  await expect(page.locator(".falling-block")).toHaveAttribute(
    "data-index",
    target,
  );
  await expect(page.locator("[data-status]")).toContainText(
    "belongs to the ayah",
  );
});

test("Vanishing Ayah keeps decoys in the mixed bank and rotates them on fresh rounds", async ({
  page,
}) => {
  await open(page, "vanishing");
  await expect(page.locator("[data-choice]")).toHaveCount(4);
  await page.locator('[data-choice="4"]').click();
  await expect(page.locator("[data-status]")).toContainText(
    "different missing word",
  );
  await expect(page.locator("[data-choice]")).toHaveCount(4);
  await noReward(page);
  const first = await page
    .locator("[data-choice]")
    .evaluateAll((bs) =>
      bs.filter((b) => Number(b.dataset.choice) >= 4).map((b) => b.textContent),
    );
  // Isolate explicit replay from the new automatic selection pronunciation.
  await page.waitForTimeout(30);
  await page.evaluate(() => { window.played = []; });
  await page.locator('[data-lab-audio="4"]').click();
  await expect.poll(() => page.evaluate(() => window.played.length)).toBe(1);
  await page.locator("#lab-restart").click();
  const next = await page
    .locator("[data-choice]")
    .evaluateAll((bs) =>
      bs.filter((b) => Number(b.dataset.choice) >= 4).map((b) => b.textContent),
    );
  expect(next.some((text) => first.includes(text))).toBe(false);
});

test("Jigsaw requires removing a foreign group; foreign group audio reads all its words", async ({
  page,
}) => {
  await open(page, "jigsaw");
  await expect(page.locator("[data-group]")).toHaveCount(5);
  await page.locator('[data-group="2"]').click();
  await page.locator('[data-group="1"]').click();
  await page.locator("#jigsaw-check").click();
  await expect(page.locator("[data-status]")).toContainText(
    "another arrangement",
  );
  await noReward(page);
  // Isolate explicit replay from the new automatic selection pronunciation.
  await page.waitForTimeout(30);
  await page.evaluate(() => { window.played = []; });
  await page.locator('.lab-build [data-lab-audio="2"]').click();
  await expect.poll(() => page.evaluate(() => window.played.length)).toBe(2);
  expect(
    await page.evaluate(() =>
      window.played.every((url) => !url.includes("/001_")),
    ),
  ).toBe(true);
  await page.locator('.lab-build [data-group="2"]').click();
  await page.locator('.lab-build [data-group="1"]').click();
  for (let i = 0; i < 2; i++) await page.locator(`[data-group="${i}"]`).click();
  await page.locator("#jigsaw-check").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
});

for (const subtype of ["meaning", "audio", "continuation"])
  test(`Memory Match ${subtype} rejects a real foreign pair and leaves it unmatched`, async ({
    page,
  }) => {
    await open(page, "match");
    await page.locator("#match-type").selectOption(subtype);
    await expect(page.locator("[data-card]")).toHaveCount(12);
    const foreign = page.locator('[data-pair="4"]');
    await foreign.nth(0).click();
    await foreign.nth(1).click();
    await expect(page.locator("[data-status]")).toContainText(
      "Leave it unmatched",
    );
    await expect(page.locator(".matched")).toHaveCount(0);
    await noReward(page);
    const spokenCard = foreign
      .filter({ has: page.locator("span.arabic") })
      .first();
    const spoken = await spokenCard.textContent();
    await page.evaluate(() => (window.played = []));
    await spokenCard.locator("..").locator("[data-lab-audio]").click();
    await expect
      .poll(async () => {
        const urls = await page.evaluate(() => window.played);
        return urls
          .map((url) => {
            const match = url.match(/(\d{3})_(\d{3})_(\d{3})\.mp3/);
            if (!match) return "";
            return surahs
              .find((s) => s.id === Number(match[1]))
              .verses.find((v) => v.id === Number(match[2])).words[
              Number(match[3]) - 1
            ];
          })
          .join(" ");
      })
      .toBe(spoken);

    await page.locator("#match-reset-pair").click();
    for (let id = 0; id < 4; id++) {
      const pair = page.locator(`[data-pair="${id}"]`);
      await pair.nth(0).click();
      await pair.nth(1).click();
    }
    await expect(page.locator("[data-status]")).toContainText(
      "Challenge complete",
    );
    await expect(page.locator('[data-pair="4"].matched')).toHaveCount(0);
  });

test("Broken Chain ignores foreign ayahs and reads their authentic full recitations", async ({
  page,
}) => {
  await open(page, "chain");
  await expect(page.locator("[data-chain]")).toHaveCount(8);
  await page.locator('[data-chain="5"]').click();
  for (let i = 1; i < 5; i++) await page.locator(`[data-chain="${i}"]`).click();
  await page.locator("#chain-check").click();
  await expect(page.locator("[data-status]")).toContainText(
    "another ayah sequence",
  );
  await noReward(page);
  // Isolate explicit replay from the new automatic selection pronunciation.
  await page.waitForTimeout(30);
  await page.evaluate(() => { window.played = []; });
  await page.locator('.lab-chain-build [data-lab-audio="5"]').click();
  await expect.poll(() => page.evaluate(() => window.played.length)).toBe(1);
  expect(await page.evaluate(() => window.played[0])).toMatch(
    /\/audio\/\d{6}\.mp3$/,
  );
  await page.locator('.lab-chain-build [data-chain="5"]').click();
  for (let i = 1; i < 5; i++)
    await page.locator(`.lab-chain-build [data-chain="${i}"]`).click();
  for (let i = 0; i < 5; i++) await page.locator(`[data-chain="${i}"]`).click();
  await page.locator("#chain-check").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
});

test("Continue the Ayah cannot complete until learners replace wrong words and build the true remainder", async ({
  page,
}) => {
  await open(page, "continue");
  await page.locator("#continue-compare").click();
  await expect(page.locator("[data-choice]")).toHaveCount(6);
  await expect(page.locator("#continue-good")).toBeDisabled();
  for (const i of [3, 1, 2]) await page.locator(`[data-choice="${i}"]`).click();
  await page.locator("#continue-check").click();
  await expect(page.locator("#continue-good")).toBeDisabled();
  await noReward(page);
  // Isolate explicit replay from the new automatic selection pronunciation.
  await page.waitForTimeout(30);
  await page.evaluate(() => { window.played = []; });
  await page.locator('.lab-build [data-lab-audio="3"]').click();
  await expect.poll(() => page.evaluate(() => window.played.length)).toBe(1);
  await page.locator('.lab-build [data-choice="3"]').click();
  for (const i of [1, 2])
    await page.locator(`.lab-build [data-choice="${i}"]`).click();
  for (const i of [0, 1, 2]) await page.locator(`[data-choice="${i}"]`).click();
  await page.locator("#continue-check").click();
  await page.locator("#continue-good").click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
});

test("Detective mixes more authentic wrong continuations, with audio for each option", async ({
  page,
}) => {
  await open(page, "detective");
  await expect(page.locator("[data-choice]")).toHaveCount(4);
  await expect(page.locator("[data-lab-audio]")).toHaveCount(4);
  await page.locator('[data-choice="2"]').click();
  await expect(page.locator("[data-status]")).toContainText("other ayah");
  await noReward(page);
  await page.locator('[data-lab-audio="2"]').click();
  await expect
    .poll(() => page.evaluate(() => window.played.length))
    .toBeGreaterThan(0);
  await page.locator('[data-choice="0"]').click();
  await expect(page.locator("[data-status]")).toContainText(
    "Challenge complete",
  );
});
