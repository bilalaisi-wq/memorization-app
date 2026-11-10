import { expect, test } from "@playwright/test";
import { surahs } from "../src/data.js";
import { createContentAdapter } from "../src/puzzles/arcade/content.js";
import {
  buildSnakeSectors,
  createSnake,
  foodCells,
} from "../src/puzzles/arcade/snake/engine.js";
import { snakeRoute } from "./snake-helper.js";
function newSnake() {
  const adapter = createContentAdapter(surahs),
    config = adapter.configure({
      surah: 1,
      start: 1,
      end: 1,
      mode: "single",
      chainMode: "classic",
      seed: 43,
    });
  return createSnake({
    id: "boost-test",
    config,
    sectors: buildSnakeSectors(adapter, config),
  });
}
function collectNext(s) {
  for (let i = 0; i < 400; i++) {
    if (s.motorPause) s = stepSnake(s, { type: "recover" });
    const cursor = s.cursor,
      food = s.food.find((f) => f.required),
      path = snakeRoute(
        s,
        foodCells(food),
        s.food.filter((f) => !f.required).flatMap(foodCells),
      );
    if (!path?.length) throw Error("Missing safe path");
    s = stepSnake(stepSnake(s, { type: "direction", value: path[0] }), {
      type: "tick",
    });
    if (s.cursor !== cursor) return s;
  }
  throw Error("No collection");
}
import {
  SNAKE_BOOST,
  snakeSpeeds,
  snakeStepMs,
  stepSnake,
} from "../src/puzzles/arcade/snake/engine.js";
import { openSnake } from "./snake-helper.js";
const advance = (s, n) => {
  for (let ms = 0; ms < n; ms += Math.min(200, n - ms)) {
    s = stepSnake(s, { type: "advance", dt: Math.min(200, n - ms) });
  }
  return s;
};
test("boost gives 60% faster movement, lasts five active seconds and has a two-second cooldown", () => {
  let s = stepSnake(newSnake(), { type: "start" });
  s = stepSnake(s, { type: "boost" });
  expect(snakeStepMs(s)).toBe(snakeSpeeds.slow / 1.6);
  s = advance(s, 4800);
  expect(s.boost.remainingMs).toBe(200);
  expect(stepSnake(s, { type: "boost" }).boost.remainingMs).toBe(200);
  s = stepSnake(s, { type: "pause" });
  expect(advance(s, 5000).boost).toEqual(s.boost);
  s = stepSnake(s, { type: "resume" });
  s = advance(s, 200);
  expect(s.boost).toEqual({ remainingMs: 0, cooldownMs: 2000 });
  expect(snakeStepMs(s)).toBe(snakeSpeeds.slow);
  s = advance(s, 1800);
  expect(stepSnake(s, { type: "boost" }).boost.remainingMs).toBe(0);
  s = advance(s, 200);
  s = stepSnake(s, { type: "boost" });
  expect(s.boost.remainingMs).toBe(SNAKE_BOOST.durationMs);
});
test("boosted correct collection earns bonus arcade points without a review or mastery grade", () => {
  let s = stepSnake(stepSnake(newSnake(), { type: "start" }), {
    type: "boost",
  });
  s = collectNext(s);
  expect(s.score).toBe(150);
  expect(s.boostCaptures).toBe(1);
  expect(s.session.strikes).toBe(0);
  s.motorPause = true;
  expect(advance(s, 1000).boost).toEqual(s.boost);
  expect(stepSnake(s, { type: "dispose" }).session.status).toBe("disposed");
});
test("Space and the mobile boost button activate boost, repeated keys cannot retrigger it and pause freezes it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSnake(page);
  await page.locator(".snake-board").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-snake-action=boost]")).toHaveText(
    "Boosting · 5s",
  );
  await page.keyboard.press("Space");
  await page.locator("[data-snake-action=pause]").click();
  await page.clock.runFor(6000);
  await expect(page.locator("[data-snake-action=boost]")).toHaveText(
    "Boosting · 5s",
  );
  await page.locator("[data-snake-action=resume]").click();
  await page.clock.runFor(1100);
  await expect(page.locator("[data-snake-action=boost]")).toHaveText(
    "Boosting · 4s",
  );
  await openSnake(page, { clock: false });
  await page.locator("[data-snake-action=boost]").click();
  await expect(page.locator("[data-snake-action=boost]")).toHaveText(
    "Boosting · 5s",
  );
});
