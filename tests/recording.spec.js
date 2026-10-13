import { test, expect } from "@playwright/test";
import { LEARNING_KEY } from "../src/learning-store.js";

test.use({
  permissions: ["microphone"],
  launchOptions: { executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});
const open = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Assess this ayah", exact: true }).click();
};
const record = async (page) => {
  await page.locator("#record-recall").click();
  await expect(page.locator("#recording-status")).toContainText("Recording your recitation");
  await expect(page.locator("#recited-compare")).toBeDisabled();
  await expect(page.locator("#recording-time")).toHaveText("0:01", { timeout: 5000 });
  await page.locator("#stop-recording").click();
  await expect(page.locator("#play-my-recording")).toBeEnabled();
  await expect.poll(() => page.locator("#learner-recording").evaluate((a) => a.duration > 0)).toBe(true);
};

test("actual browser recording decodes, plays separately and together, and keeps independent assessment", async ({ page }) => {
  await open(page);
  await record(page);
  await page.locator("#play-my-recording").click();
  await expect.poll(() => page.locator("#learner-recording").evaluate((a) => !a.paused)).toBe(true);
  await page.locator("#recited-compare").click();
  await expect(page.locator("#learner-recording")).toHaveAttribute("src", /^blob:/);
  await page.locator("#recall-audio").click();
  await expect.poll(() => page.locator("#reference-recording").evaluate((a) => !a.paused)).toBe(true);
  await page.locator("#compare-recordings").click();
  expect(await page.locator(".recording-tracks audio").evaluateAll((tracks) => tracks.every((a) => !a.paused && a.currentTime < 0.8))).toBe(true);
  await page.locator("#learner-volume").fill("0.4");
  expect(await page.locator("#learner-recording").evaluate((a) => a.volume)).toBe(0.4);
  await page.locator("#stop-comparison").click();
  expect(await page.locator(".recording-tracks audio").evaluateAll((tracks) => tracks.every((a) => a.paused))).toBe(true);
  await page.locator('[data-recall-grade="Good"]').click();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LEARNING_KEY);
  expect(state.records["1:1"].memory.independentAttempts).toBe(1);
  expect(state.records["1:1"].memory.history[0].audioBeforeRecall).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: "Assess this ayah", exact: true }).click();
  await expect(page.locator("#learner-recording")).not.toHaveAttribute("src", /^blob:/);
});

test("simultaneous comparison before declared recall is assisted; retries clear recordings", async ({ page }) => {
  await open(page);
  await record(page);
  await page.locator("#compare-recordings").click();
  await expect(page.locator(".assistance-note")).toBeVisible();
  await page.locator("#recited-compare").click();
  await page.locator('[data-recall-grade="Good"]').click();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LEARNING_KEY);
  expect(state.records["1:1"].memory.independentAttempts).toBe(0);
  await page.locator("#recall-retry").click();
  await expect(page.locator("#play-my-recording")).toBeDisabled();
  await expect(page.locator("#compare-recordings")).toBeDisabled();
});

test("permission denial allows self-assessment and navigation releases an active microphone", async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.capturedStreams = [];
    navigator.mediaDevices.getUserMedia = async (options) => {
      if (!window.allowCapture) throw new DOMException("Denied", "NotAllowedError");
      const stream = await original(options);
      window.capturedStreams.push(stream);
      return stream;
    };
  });
  await open(page);
  await page.locator("#record-recall").click();
  await expect(page.locator("#recording-status")).toContainText("permission was denied");
  await expect(page.locator("#recited-compare")).toBeEnabled();
  await page.evaluate(() => window.allowCapture = true);
  await page.locator("#record-recall").click();
  await expect(page.locator("#recording-status")).toContainText("Recording your recitation");
  await page.locator("#nav-daily").click();
  expect(await page.evaluate(() => window.capturedStreams.every((s) => s.getTracks().every((t) => t.readyState === "ended")))).toBe(true);
});

test("native reciter playback remains audible and marks pre-recall assistance", async ({ page }) => {
  await open(page);
  await page.locator("#reference-recording").evaluate((a) => a.play());
  await expect(page.locator(".assistance-note")).toBeVisible();
  expect(await page.locator("#reference-recording").evaluate((a) => !a.paused)).toBe(true);
  await page.locator("#recited-compare").click();
  await expect(page.locator("#recall-assisted")).toBeChecked();
  await page.locator('[data-recall-grade="Good"]').click();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LEARNING_KEY);
  expect(state.records["1:1"].memory.history[0].audioBeforeRecall).toBe(true);
});

test("a microphone permission request resolved after navigation cannot leave a live stream", async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      await new Promise((resolve) => { window.resolveMicrophone = resolve; });
      window.lateStream = await original(options);
      return window.lateStream;
    };
  });
  await open(page);
  await page.locator("#record-recall").click();
  await expect(page.locator("#recording-status")).toContainText("Waiting for microphone");
  await page.locator("#nav-daily").click();
  await page.evaluate(() => window.resolveMicrophone());
  await expect.poll(() => page.evaluate(() => window.lateStream?.getTracks().every((t) => t.readyState === "ended"))).toBe(true);
});
