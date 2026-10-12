import { test, expect } from "@playwright/test";
test("seven ayahs, partial building and word order challenge", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".ayah-item")).toHaveCount(7);
  await expect(page.locator(".word-bank .piece")).toHaveCount(4);
  await page.locator('.word-bank [data-word="0"]').click();
  await page.locator('.word-bank [data-word="1"]').click();
  await expect(page.locator(".build-zone .piece")).toHaveCount(2);
  await expect(page.locator("#practice-audio")).toBeEnabled();
  await page.locator("#next").click();
  await expect(page.locator(".feedback")).toContainText("Build all");
  await page.locator('[data-mode="quiz"]').click();
  await expect(page.locator(".full-verse")).toContainText("hidden");
  for (const i of [1, 0, 2, 3])
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".feedback")).toContainText("out of order");
  await page.locator("#clear").click();
  for (let i = 0; i < 4; i++)
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".feedback")).toContainText("Beautiful work");
  await expect(page.locator(".progress-summary")).toContainText("1 / 7");
  await page.reload();
  await expect(page.locator(".progress-summary")).toContainText("1 / 7");
  await page.locator('[data-ayah="6"]').click();
  await expect(page.locator(".word-bank .piece")).toHaveCount(9);
});
test("active recall hides words; all seven ayahs render; mobile fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-mode="recall"]').click();
  await expect(
    page.locator(".word-bank .arabic").filter({ hasText: "؟" }),
  ).toHaveCount(2);
  await page.locator("#reveal-words").click();
  await expect(
    page.locator(".word-bank .arabic").filter({ hasText: "؟" }),
  ).toHaveCount(0);
  for (let i = 0; i < 7; i++) {
    await page.locator(`[data-ayah="${i}"]`).click();
    await expect(page.locator(".reference-top")).toContainText(`AYAH ${i + 1}`);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/ayah-mobile.png", fullPage: true });
});
test("audio plays selected words in order for each repetition and handles errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.played = [];
    window.Audio = class {
      constructor(url) {
        this.url = url;
      }
      play() {
        window.played.push(this.url);
        setTimeout(() => this.onended?.(), 15);
        return Promise.resolve();
      }
      pause() {}
    };
  });
  await page.goto("/");
  for (const i of [0, 1])
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#practice-audio").click();
  await expect(page.locator(".feedback")).toContainText("Listening complete");
  const urls = await page.evaluate(() => window.played);
  expect(urls).toHaveLength(6);
  expect(urls[0]).toContain("001_001_001");
  expect(urls[1]).toContain("001_001_002");
  await page.locator("#full-audio").click();
  await expect(page.locator(".feedback")).toContainText("Listening complete");
  expect(await page.evaluate(() => window.played.at(-1))).toContain(
    "001001.mp3",
  );
  await page.evaluate(() => {
    window.Audio = class {
      play() {
        return Promise.reject(new Error("blocked"));
      }
      pause() {}
    };
  });
  await page.locator("#full-audio").click();
  await expect(page.locator(".feedback")).toContainText("Audio could not load");
});
test("desktop font and layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("30px Uthmanic"))).toBe(
    true,
  );
  await page.screenshot({ path: "/tmp/ayah-desktop.png", fullPage: true });
});
test("real bundled recordings decode and selected-word playback completes", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const source = await (await fetch("/quran-source.json")).json();
    const urls = source.verses.flatMap((v) => [
      "/audio/001" + v.verse_key.split(":")[1].padStart(3, "0") + ".mp3",
      ...v.words.map((w) => "/audio/" + w.audio_url.split("/").at(-1)),
    ]);
    return Promise.all(
      urls.map(
        (url) =>
          new Promise((resolve) => {
            const a = new Audio();
            a.onloadedmetadata = () => resolve({ url, ok: a.duration > 0 });
            a.onerror = () => resolve({ url, ok: false });
            a.src = url;
          }),
      ),
    );
  });
  expect(result).toHaveLength(36);
  expect(result.every((r) => r.ok)).toBe(true);
  await page.locator("#repeat").selectOption("1");
  for (const i of [0, 1])
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#practice-audio").click();
  await expect(page.locator(".feedback")).toContainText("Listening complete", {
    timeout: 20000,
  });
});
test("quest uses shuffled decoys, rejects extras and rewards fresh rounds", async ({
  page,
}) => {
  await page.goto("/");
  const practice = await page
    .locator(".word-bank .piece")
    .evaluateAll((bs) => bs.map((b) => +b.dataset.word));
  expect(practice).not.toEqual([0, 1, 2, 3]);
  await page.locator('[data-mode="quiz"]').click();
  await expect(page.locator(".word-bank .piece")).toHaveCount(8);
  await expect(page.locator(".quest-banner")).toContainText("4 extra words");
  const ids = await page
    .locator(".word-bank .piece")
    .evaluateAll((bs) => bs.map((b) => +b.dataset.word));
  expect(ids.filter((i) => i < 4)).not.toEqual([0, 1, 2, 3]);
  for (let i = 0; i < 7; i++) {
    await page.locator(`[data-ayah="${i}"]`).click();
    const expected = [4, 4, 2, 3, 4, 3, 9][i] + 4;
    await expect(page.locator(".word-bank .piece")).toHaveCount(expected);
  }
  await page.locator('[data-ayah="0"]').click();
  await page.locator('.word-bank [data-word="4"]').click();
  for (const i of [1, 2, 3])
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".feedback")).toContainText("another ayah");
  await expect(page.locator(".star-score")).toContainText("0 stars");
  for (const i of [4, 1, 2, 3])
    await page.locator(`.build-zone [data-word="${i}"]`).click();
  for (let i = 0; i < 4; i++)
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".star-score")).toContainText("2 stars");
  await expect(page.locator("#next")).toContainText("Play again");
  await page.locator("#next").click();
  await expect(page.locator(".quest-banner")).toContainText("Ayah 1 quest");
  await page.locator('[data-ayah="0"]').click();
  for (let i = 0; i < 4; i++)
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".star-score")).toContainText("5 stars");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/ayah-quest-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/ayah-quest-desktop.png",
    fullPage: true,
  });
});
test("identical words are interchangeable; connectors fit and shuffles vary", async () => {
  const { verses, quizCorrect, scrambledBank } = await import("../src/data.js");
  const { outline } = await import("../src/illustrations.js");
  expect(quizCorrect([0, 1, 2, 6, 4, 5, 3, 7, 8], verses[6].words, [])).toBe(
    true,
  );
  expect(quizCorrect([0, 1, 2, 3], verses[0].words, [])).toBe(true);
  expect(quizCorrect([0, 1, 3, 2], verses[0].words, [])).toBe(false);
  const orders = new Set();
  for (let i = 0; i < 50; i++) {
    const a = scrambledBank(8, 4);
    expect(a.filter((x) => x < 4)).not.toEqual([0, 1, 2, 3]);
    expect(new Set(a).size).toBe(8);
    orders.add(a.join(","));
  }
  expect(orders.size).toBeGreaterThan(1);
  for (let i = 0; i < 8; i++) {
    const y = 38 + (i % 4) * 18,
      r = 7 + (i % 3) * 2;
    expect(outline(i, 9)).toContain(`C-4 ${y + r} -4 ${y - r} 12 ${y - r}`);
    expect(outline(i + 1, 9)).toContain(
      `C152 ${y - r} 152 ${y + r} 168 ${y + r}`,
    );
  }
});
test("revealing then hiding reference still limits stars; practice rejects wrong order", async ({
  page,
}) => {
  await page.goto("/");
  for (const i of [1, 0, 2, 3])
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".feedback")).toContainText("correct order");
  await page.locator('[data-mode="quiz"]').click();
  await page.locator("#reference-toggle").click();
  await page.locator("#reference-toggle").click();
  for (let i = 0; i < 4; i++)
    await page.locator(`.word-bank [data-word="${i}"]`).click();
  await page.locator("#next").click();
  await expect(page.locator(".star-score")).toContainText("1 stars");
});

test("all four surahs have aligned verified words and readable learning modes", async ({
  page,
}) => {
  const { surahs } = await import("../src/data.js");
  expect(surahs.map((s) => s.verses.length)).toEqual([7, 6, 5, 4]);
  await page.goto("/");
  await expect(page.locator("#surah-picker option")).toHaveCount(4);
  for (let c = 0; c < surahs.length; c++) {
    await page.locator("#surah-picker").selectOption(String(c));
    await expect(page.locator(".surah-heading h2")).toContainText(
      surahs[c].name,
    );
    await expect(page.locator(".ayah-item")).toHaveCount(
      surahs[c].verses.length,
    );
    for (let i = 0; i < surahs[c].verses.length; i++) {
      const v = surahs[c].verses[i];
      expect(v.words.length).toBe(v.roman.length);
      expect(v.words.length).toBe(v.meanings.length);
      await page.locator(`[data-ayah="${i}"]`).click();
      await expect(page.locator(".word-bank .piece")).toHaveCount(
        v.words.length,
      );
      await expect(page.locator(".full-verse")).toContainText(v.text);
    }
    await page.locator('[data-mode="quiz"]').click();
    await expect(page.locator(".word-bank .piece")).toHaveCount(
      surahs[c].verses.at(-1).words.length + 4,
    );
    await page.locator('[data-mode="recall"]').click();
    expect(
      await page.locator(".word-bank .arabic").filter({ hasText: "؟" }).count(),
    ).toBeGreaterThan(0);
    await page.locator('[data-mode="practice"]').click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("repeat wins unlock harder levels and persist; solved round cannot be farmed", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#surah-picker").selectOption("3");
  await page.locator('[data-mode="quiz"]').click();
  const solve = async () => {
    for (let i = 0; i < 4; i++)
      await page.locator(`.word-bank [data-word="${i}"]`).click();
    await page.locator("#next").click();
  };
  await solve();
  await expect(page.locator(".xp-line")).toContainText("15 XP");
  await page.locator('.build-zone [data-word="0"]').click();
  await expect(page.locator(".build-zone .piece")).toHaveCount(4);
  await expect(page.locator(".xp-line")).toContainText("15 XP");
  await page.locator("#next").click();
  await solve();
  await expect(page.locator(".feedback")).toContainText("New level unlocked");
  await page.locator("#next").click();
  await expect(page.locator(".quest-banner")).toContainText("Level 2 / 3");
  await expect(page.locator(".word-bank .piece")).toHaveCount(9);
  expect(
    await page.locator(".word-bank .arabic").filter({ hasText: "؟" }).count(),
  ).toBeGreaterThan(0);
  await solve();
  await page.locator("#next").click();
  await solve();
  await page.locator("#next").click();
  await expect(page.locator(".quest-banner")).toContainText("Level 3 / 3");
  await expect(page.locator(".word-bank .piece")).toHaveCount(10);
  await expect(page.locator(".xp-line")).toContainText("80 XP");
  await page.reload();
  await page.locator("#surah-picker").selectOption("3");
  await page.locator('[data-mode="quiz"]').click();
  await expect(page.locator(".quest-banner")).toContainText("Level 3 / 3");
  await expect(page.locator(".xp-line")).toContainText("80 XP");
  await page.locator("#peek-words").click();
  await expect(
    page.locator(".word-bank .arabic").filter({ hasText: "؟" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".word-bank .arabic").filter({ hasText: "؟" }),
  ).not.toHaveCount(0, { timeout: 10000 });
  await solve();
  await expect(page.locator(".xp-line")).toContainText("85 XP");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ayah-mastery"))["112:1"],
    ),
  ).toBe(4);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/ayah-levels-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/ayah-levels-mobile.png",
    fullPage: true,
  });
});

test("new audio files decode and playback chooses the selected surah", async ({
  page,
}) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const source = await (await fetch("/additional-quran-source.json")).json();
    return Promise.all(
      source.verses
        .flatMap((v) => {
          const [s, a] = v.verse_key.split(":");
          return [
            "/audio/" + s.padStart(3, "0") + a.padStart(3, "0") + ".mp3",
            ...v.words.map((w) => "/audio/" + w.audio_url.split("/").at(-1)),
          ];
        })
        .map(
          (url) =>
            new Promise((resolve) => {
              const audio = new Audio();
              audio.onloadedmetadata = () => resolve(audio.duration > 0);
              audio.onerror = () => resolve(false);
              audio.src = url;
            }),
        ),
    );
  });
  expect(results).toHaveLength(73);
  expect(results.every(Boolean)).toBe(true);
  await page.evaluate(() => {
    window.played = [];
    window.Audio = class {
      constructor(url) {
        this.url = url;
      }
      play() {
        window.played.push(this.url);
        setTimeout(() => this.onended?.(), 10);
        return Promise.resolve();
      }
      pause() {}
    };
  });
  for (const [c, prefix] of [
    [1, "114"],
    [2, "113"],
    [3, "112"],
  ]) {
    await page.locator("#surah-picker").selectOption(String(c));
    await page.locator("#full-audio").click();
    await expect(page.locator(".feedback")).toContainText("Listening complete");
    expect(await page.evaluate(() => window.played.at(-1))).toBe(
      "/audio/" + prefix + "001.mp3",
    );
    await page.locator('.word-bank [data-word="0"]').click();
    await page.locator("#repeat").selectOption("1");
    await page.locator("#practice-audio").click();
    await expect(page.locator(".feedback")).toContainText("Listening complete");
    expect(await page.evaluate(() => window.played.at(-1))).toBe(
      "/audio/" + prefix + "_001_001.mp3",
    );
  }
});

test("legacy progress migrates and stays independent across surahs", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("ayah-completed", "[0,1]"),
  );
  await page.goto("/");
  await expect(page.locator(".progress-summary")).toContainText("2 / 7");
  await page.locator("#surah-picker").selectOption("1");
  await expect(page.locator(".progress-summary")).toContainText("0 / 6");
  await page.locator("#build-all").click();
  await page.locator("#next").click();
  await expect(page.locator(".progress-summary")).toContainText("1 / 6");
  await page.locator("#surah-picker").selectOption("0");
  await expect(page.locator(".progress-summary")).toContainText("2 / 7");
});
