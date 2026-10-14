import { test, expect } from "@playwright/test";
import { movePiece } from "../src/ui/piece-drag.js";
import { LEARNING_KEY } from "../src/learning-store.js";
const order = (page) =>
  page
    .locator(".build-zone [data-word]")
    .evaluateAll((buttons) => buttons.map((b) => Number(b.dataset.word)));
const build = async (page, ids = [0, 1, 2, 3]) => {
  for (const id of ids)
    await page.locator(`.word-bank [data-word="${id}"]`).click();
};
test("insertion handles moving in both directions, append and bank insertion without duplicates", () => {
  expect(movePiece([0, 1, 2, 3], 3, 0)).toEqual([3, 0, 1, 2]);
  expect(movePiece([0, 1, 2, 3], 0, 2, true)).toEqual([1, 2, 0, 3]);
  expect(movePiece([0, 1, 3], 2, 3)).toEqual([0, 1, 2, 3]);
  expect(movePiece([0, 1], 0, null)).toEqual([1, 0]);
  expect(movePiece([0, 1], 1, 1)).toEqual([0, 1]);
});
for (const mode of ["practice", "quiz"])
  test(`${mode} supports native dragging within the building zone, insertion from bank and keyboard corrections`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.goto("/");
    if (mode === "quiz") await page.locator('[data-mode="quiz"]').click();
    await build(page);
    await page
      .locator('.build-zone [data-word="3"]')
      .dragTo(page.locator('.build-zone [data-word="0"]'));
    await expect.poll(() => order(page)).toEqual([3, 0, 1, 2]);
    await page.locator('.build-zone [data-word="3"]').focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(() => order(page)).toEqual([0, 3, 1, 2]);
    await page.locator('.build-zone [data-word="3"]').click();
    await page
      .locator('.word-bank [data-word="3"]')
      .dragTo(page.locator('.build-zone [data-word="1"]'));
    await expect.poll(() => order(page)).toEqual([0, 3, 1, 2]);
    await page.locator('.build-zone [data-word="3"]').focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(() => order(page)).toEqual([0, 1, 2, 3]);
    await page.locator("#next").click();
    if (mode === "quiz")
      await expect(page.locator(".feedback")).toContainText("Beautiful work");
  });
test.describe("touch controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("a touch handle can move the last piece to the beginning without clearing the others", async ({
    page,
  }) => {
    await page.goto("/");
    await build(page);
    await page.locator(".build-zone").scrollIntoViewIfNeeded();
    const handle = await page.locator('[data-grab="3"]').boundingBox(),
      target = await page.locator('.build-zone [data-word="0"]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: target.x + target.width * 0.8, y: target.y + target.height / 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => order(page)).toEqual([3, 0, 1, 2]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});
test("tutorial is optional, skippable, restartable and demonstrations never award progress", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".tutorial-welcome")).toBeVisible();
  await page
    .getByRole("button", { name: "Skip tutorial", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".tutorial-welcome")).toHaveCount(0);
  await page.locator("#nav-tutorial").click();
  await expect(page.locator(".tutorial-dialog")).toBeVisible();
  const before = await page.evaluate(
    (k) => localStorage.getItem(k),
    LEARNING_KEY,
  );
  for (let i = 0; i < 9; i++) {
    await page.locator("#tutorial-next").click();
  }
  await expect(page.locator(".tutorial-dialog")).toContainText(
    "Encouragement and preferences",
  );
  await page.locator("#tutorial-next").click();
  expect(
    await page.evaluate((k) => localStorage.getItem(k), LEARNING_KEY),
  ).toBe(before);
  await page.locator("#nav-tutorial").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".tutorial-dialog")).toHaveCount(0);
});
test("tutorial sandbox avoids exposing the ayah in an unfinished independent assessment", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  const before = await page.evaluate(
    (k) => localStorage.getItem(k),
    LEARNING_KEY,
  );
  await page.locator("#nav-tutorial").click();
  await expect(page.locator(".tutorial-demo")).toContainText("Al-Ikhlas");
  await page.locator("#skip-tutorial").click();
  expect(
    await page.evaluate((k) => localStorage.getItem(k), LEARNING_KEY),
  ).toBe(before);
});
function wav() {
  const samples = 1600,
    b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(Math.round(Math.sin(i * 0.12) * 5000), 44 + i * 2);
  return b;
}
test("feedback preferences and custom uploaded audio persist across reload and can be reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#nav-encouragement").click();
  await page.locator("#success-sound").uncheck();
  await page.locator("#experience-motion").uncheck();
  await page.locator("#success-upload").setInputFiles({
    name: "my-chime.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(page.locator("[data-settings-status]")).toContainText(
    "saved in this browser",
  );
  await page.reload();
  await page.locator("#nav-encouragement").click();
  await expect(page.locator("#success-sound")).not.toBeChecked();
  await expect(page.locator("#experience-motion")).not.toBeChecked();
  await expect(page.locator("#success-file")).toHaveText("my-chime.wav");
  await page.locator("#reset-success-sound").click();
  await expect(page.locator("#success-file")).toHaveText("Built-in chime");
});
test("correct challenges celebrate without duplicating XP; motion can be disabled and muted", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="quiz"]').click();
  await build(page);
  await page.locator("#next").click();
  await expect(page.locator(".success-celebration")).toContainText(
    "Beautiful work",
  );
  const xp = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).wallet.xp,
    LEARNING_KEY,
  );
  await page.locator("#nav-encouragement").click();
  await page.locator("#success-sound").uncheck();
  await page.locator("#experience-motion").uncheck();
  await page.locator("#preview-success").click();
  await expect(page.locator(".success-celebration")).toHaveClass(/still/);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).wallet.xp,
      LEARNING_KEY,
    ),
  ).toBe(xp);
});
test("recitation interrupts celebratory sound and stars; reduced motion suppresses transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('[data-mode="quiz"]').click();
  await expect(page.locator(".mode-transition")).toHaveCount(0);
  await build(page);
  await page.locator("#next").click();
  await expect(page.locator(".success-celebration")).toHaveClass(/still/);
  await page.locator("#full-audio").click();
  await expect(page.locator(".success-celebration")).toHaveCount(0);
});

test("the default chime and uploaded clip use real Web Audio, with no sound when muted", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.oscillators = 0;
    window.buffers = 0;
    const prototype = AudioContext.prototype,
      osc = prototype.createOscillator,
      source = prototype.createBufferSource;
    prototype.createOscillator = function (...args) {
      window.oscillators++;
      return osc.apply(this, args);
    };
    prototype.createBufferSource = function (...args) {
      window.buffers++;
      return source.apply(this, args);
    };
  });
  await page.goto("/");
  await page.locator("#nav-encouragement").click();
  await page.locator("#preview-success").click();
  await expect.poll(() => page.evaluate(() => window.oscillators)).toBe(3);
  await page
    .locator("#success-upload")
    .setInputFiles({
      name: "teacher.wav",
      mimeType: "audio/wav",
      buffer: wav(),
    });
  await expect(page.locator("[data-settings-status]")).toContainText(
    "saved in this browser",
  );
  await page.locator("#preview-success").click();
  await expect.poll(() => page.evaluate(() => window.buffers)).toBe(1);
  await page.locator("#success-sound").uncheck();
  await page.locator("#preview-success").click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.buffers)).toBe(1);
});

test("an app-wide configured sound can replace the synthesized chime", async ({
  page,
}) => {
  await page.route("**/feedback-sounds.json", (route) =>
    route.fulfill({
      json: { schemaVersion: 1, success: "/feedback-audio/teacher.wav" },
    }),
  );
  await page.route("**/feedback-audio/teacher.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav() }),
  );
  await page.addInitScript(() => {
    window.buffers = 0;
    const proto = AudioContext.prototype,
      source = proto.createBufferSource;
    proto.createBufferSource = function (...args) {
      window.buffers++;
      return source.apply(this, args);
    };
  });
  const downloaded = page.waitForResponse("**/feedback-audio/teacher.wav");
  await page.goto("/");
  await downloaded;
  await page.locator("#nav-encouragement").click();
  await page.locator("#preview-success").click();
  await expect.poll(() => page.evaluate(() => window.buffers)).toBe(1);
});
