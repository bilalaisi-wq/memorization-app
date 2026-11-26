import { test, expect } from "@playwright/test";
import { mountRush } from "./rush3-ui-helper.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
import { localBundle } from "../src/content/library.js";
test("manual replay after an audio pause resets the pause button state to the playing recording", async ({
  page,
}) => {
  await mountRush(page, {
    game: "ayah-defense",
    refs: ["1:1", "1:2"],
    audioMode: "listen",
  });
  await expect.poll(() => page.evaluate(() => window.rushAudio.length)).toBe(1);
  await page.locator("[data-flow-audio-pause]").click();
  await expect(page.locator("[data-flow-audio-pause]")).toHaveText(
    "Resume audio"
  );
  await page.locator(".gameplay-toolbar [data-game-command=listen]").click();
  await expect.poll(() => page.evaluate(() => window.rushAudio.length)).toBe(2);
  await expect(page.locator("[data-flow-audio-pause]")).toHaveText(
    "Pause audio"
  );
  await page.locator("[data-flow-audio-pause]").click();
  expect(
    await page.evaluate(() => window.rushAudio.filter((a) => a.playing).length)
  ).toBe(0);
});
test("expert settings conceal old context without moving the current group or erasing prior assistance", async ({
  page,
}) => {
  await mountRush(page, { game: "ayah-defense", refs: ["98:5", "98:6"] });
  const units = revisionUnits(localBundle("98:5"));
  await page
    .locator("[data-flow-choice]")
    .filter({ hasText: units[0].text })
    .click();
  await expect(page.locator(".flow-ribbon p.arabic")).toHaveCount(1);
  await page.locator("[data-game-command=settings]").click();
  await page.locator("[data-game-memory]").selectOption("expert");
  await page.locator("[data-game-command=restart-challenge]").click();
  await expect(page.locator(".flow-ribbon p.arabic")).toHaveCount(0);
  const s = await page.evaluate(() => window.rushActivity.getSnapshot());
  expect(s.unit).toBe(1);
  expect(s.completed).toBe(0);
  await page.locator("[data-flow-ready]").click();
  await page
    .locator("[data-flow-choice]")
    .filter({ hasText: units[1].text })
    .click();
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.recognitionHistory.at(-1).kind).toBe("assisted-recognition");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-passage-recall-v1"))
  ).toBeNull();
});
test("resuming audio after changing ayahs while paused loads the current full recording", async ({
  page,
}) => {
  await mountRush(page, {
    game: "ayah-defense",
    refs: ["98:5", "98:6"],
    audioMode: "listen",
  });
  await expect.poll(() => page.evaluate(() => window.rushAudio.length)).toBe(1);
  await page.locator("[data-flow-audio-pause]").click();
  for (const u of revisionUnits(localBundle("98:5")))
    await page
      .locator("[data-flow-choice]")
      .filter({ hasText: u.text })
      .click();
  expect(await page.evaluate(() => window.rushAudio.length)).toBe(1);
  await page.locator("[data-flow-audio-pause]").click();
  await expect.poll(() => page.evaluate(() => window.rushAudio.length)).toBe(2);
  expect(await page.evaluate(() => window.rushAudio.at(-1).src)).toContain(
    "098006.mp3"
  );
  expect(
    await page.evaluate(() => window.rushAudio.filter((a) => a.playing).length)
  ).toBe(1);
});
test("a concealed transition cue does not falsely mark expert recognition as assisted", async ({
  page,
}) => {
  await mountRush(page, {
    game: "ayah-defense",
    refs: ["1:1", "1:2", "1:3"],
    memory: "expert",
  });
  for (const ref of ["1:1", "1:2"]) {
    await page.locator("[data-flow-ready]").click();
    await page
      .locator("[data-flow-choice]")
      .filter({ hasText: revisionUnits(localBundle(ref), "expert")[0].text })
      .click();
  }
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.recognitionHistory.map((e) => e.kind)).toEqual([
    "unassisted-recognition",
    "unassisted-recognition",
  ]);
  expect(r.assistance).toBe(0);
});
test("raising recitation volume in paused settings keeps subsequent recognition assisted", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("ayah-lab-volume", "0"));
  await mountRush(page, {
    game: "ayah-defense",
    refs: ["1:1", "1:2"],
    audioMode: "listen",
  });
  await expect.poll(() => page.evaluate(() => window.rushAudio.length)).toBe(1);
  await page.locator("[data-game-command=settings]").click();
  await page.locator("[data-game-volume]").fill("0.5");
  await page.locator(".gameplay-settings [data-game-command=resume]").click();
  await page
    .locator("[data-flow-choice]")
    .filter({ hasText: revisionUnits(localBundle("1:1"))[0].text })
    .click();
  const r = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(r.recognitionHistory[0].kind).toBe("assisted-recognition");
});
