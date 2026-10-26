import { expect, test } from "@playwright/test";
import { mockBilling } from "./billing-fixtures.js";
import { compareTranscript } from "../supabase/functions/_shared/recitation-core.js";
import { verses } from "../src/data.js";
test.use({
  permissions: ["microphone"],
  launchOptions: {
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test("Adult pilot upload is explicit; playback, uncertain feedback, correction and deletion never award mastery", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  const calls = [];
  await page.route(
    "**/rest/v1/rpc/my_recitation_ai_access",
    (r) => r.fulfill({ json: { enabled: true, used: 0, allowance: 30 } }),
  );
  await page.route("**/rest/v1/rpc/recitation_ai_feedback", (r) => {
    calls.push(r.request().postDataJSON());
    return r.fulfill({ json: null });
  });
  await page.route("**/rest/v1/rpc/delete_my_recitation_analysis", (r) => {
    calls.push({ deleted: true });
    return r.fulfill({ json: null });
  });
  let uploads = 0;
  const words = verses[0].text.split(" "), transcript = "بسم الله الرحيم";
  await page.route("**/functions/v1/recitation-compare", (r) => {
    uploads++;
    expect(r.request().headers()["content-type"]).toContain(
      "multipart/form-data",
    );
    return r.fulfill({
      json: {
        requestId: "00000000-0000-4000-8000-000000000001",
        transcript,
        verifiedText: verses[0].text,
        verifiedWords: words,
        comparison: compareTranscript(words, transcript),
        metadata: {
          model: "whisper-1",
          modelVersion: "provider snapshot not exposed",
        },
        usage: { used: 1, allowance: 30 },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.getByText("Experimental AI word comparison · adult pilot", {
    exact: true,
  }).click();
  await page.locator("[data-ai-access]").click();
  await expect(page.locator("[data-ai-access-status]")).toContainText("0 / 30");
  await page.locator("#record-recall").click();
  await expect(page.locator("#recording-time")).toHaveText("0:01", {
    timeout: 5000,
  });
  await page.locator("#stop-recording").click();
  await expect(page.locator("#play-my-recording")).toBeEnabled();
  await page.locator("#play-my-recording").click();
  expect(uploads).toBe(0);
  await page.locator("[data-ai-consent]").check();
  await expect(page.locator("[data-ai-submit]")).toBeDisabled();
  await page.locator("#recited-compare").click();
  await expect(page.locator("[data-ai-submit]")).toBeEnabled();
  const before = await page.evaluate(() =>
    localStorage.getItem(
      "ayah-user:00000000-0000-0000-0000-000000000001:ayah-learning-v1",
    )
  );
  await page.locator("[data-ai-submit]").click();
  await expect(page.locator("[data-ai-result]")).toContainText(
    "Possible word differences",
  );
  await expect(page.locator("[data-ai-result]")).toContainText(
    "possible omission",
  );
  await page.locator("[data-ai-correction]").fill("بسم الله الرحمن الرحيم");
  await page.locator("[data-ai-recompare]").click();
  await expect(page.locator("[data-ai-result]")).toContainText(
    "No normalized word differences",
  );
  await page.locator("[data-ai-feedback]").selectOption("false_positive");
  await page.locator("[data-ai-send-feedback]").click();
  await expect(page.locator("[data-ai-status]")).toContainText(
    "category saved",
  );
  expect(calls[0].p_feedback).toBe("false_positive");
  expect(uploads).toBe(1);
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "ayah-user:00000000-0000-0000-0000-000000000001:ayah-learning-v1",
      )
    ),
  ).toBe(before);
  await page.locator("[data-ai-delete]").click();
  await expect(page.locator("[data-ai-status]")).toContainText(
    "server analysis metadata deleted",
  );
  await expect(page.locator("#learner-recording")).not.toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(page.locator("[data-ai-result]")).toBeEmpty();
});
test("Guests keep local recording and cannot submit AI audio", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await page.getByRole("button", { name: "Assess this ayah", exact: true })
    .click();
  await page.getByText("Experimental AI word comparison · adult pilot", {
    exact: true,
  }).click();
  await page.locator("[data-ai-access]").click();
  await expect(page.locator("[data-ai-access-status]")).toContainText(
    "Sign in",
  );
  await expect(page.locator("[data-ai-submit]")).toBeDisabled();
  await expect(page.locator("#record-recall")).toBeEnabled();
});
