import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { surahs } from "../src/data.js";
import { createDistractorPicker, distractorWords, wordIdentity } from "../src/distractors.js";

test("every ayah and level gets distinct, recorded words from other surahs", () => {
  test.setTimeout(60_000);
  const pick = createDistractorPicker();
  for (const surah of surahs) for (const verse of surah.verses) {
    for (const count of [4, 5, 6]) {
      const words = pick(surah.id, verse.words, count);
      expect(words).toHaveLength(count);
      expect(new Set(words.map((w) => wordIdentity(w.text))).size).toBe(count);
      expect(new Set(words.map((w) => w.surah)).size).toBe(count);
      for (const word of words) {
        expect(word.surah).not.toBe(surah.id);
        expect(verse.words.map(wordIdentity)).not.toContain(wordIdentity(word.text));
        expect(word.roman).toBeTruthy();
        expect(word.meaning).toBeTruthy();
        expect(existsSync(`public${word.audio}`)).toBe(true);
      }
    }
  }
  expect(distractorWords.length).toBeGreaterThan(1000);
});

test("level two rotates distractors across fresh rounds and surah changes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ayah-mastery", JSON.stringify({"1:1":2,"114:1":2})));
  await page.goto("/");
  await page.locator('[data-mode="quiz"]').click();
  const read = async () => {
    await expect(page.locator(".quest-banner")).toContainText("5 extra words");
    await page.locator("#peek-words").click();
    return page.locator('.word-bank .piece').evaluateAll((pieces) =>
      pieces.filter((b) => Number(b.dataset.word) >= 4)
        .map((b) => b.querySelector(".arabic").textContent));
  };
  const first = await read();
  await page.locator('[data-ayah="0"]').click();
  const second = await read();
  expect(second).toHaveLength(5);
  expect(second.filter((word) => first.includes(word))).toEqual([]);
  await page.locator("#surah-picker").selectOption("1");
  await expect(page.locator(".quest-banner")).toContainText("5 extra words");
});
