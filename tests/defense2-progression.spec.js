// Exact ignored operator sources; transport authorization is mocked, not hosted-account certification.
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { revisionUnits } from "../src/revision/adventures/content.js";
test("actual Ayah Defense host covers 7:1–206 through failed save, unavailable 7:6, resume and difficulty restart", async ({
  page,
}) => {
  test.setTimeout(1800000);
  test.skip(
    !existsSync(".quran-private/7/206/bundle.json"),
    "Operator source files required"
  );
  let denySix = true,
    memory = "guided";
  await page.route("https://defense-source.test/**", async (r) => {
    const key = new URL(r.request().url()).searchParams.get("key");
    if (key === "7:6" && denySix) {
      denySix = false;
      return r.fulfill({
        status: 503,
        json: {
          error: "Verified 7:6 is temporarily unavailable. Retry the source.",
        },
      });
    }
    return r.fulfill({
      json: JSON.parse(
        readFileSync(`.quran-private/${key.replace(":", "/")}/bundle.json`)
      ),
    });
  });
  async function mount() {
    await page.evaluate(async () => {
      window.Audio = class {
        play() {
          return Promise.resolve();
        }
        pause() {}
        load() {}
        removeAttribute() {}
      };
      const root = document.createElement("section");
      document.body.replaceChildren(root);
      const { mountAdventure } = await import("/src/revision/adventures/ui.js");
      window.hostFrames = new Map();
      let frameId = 0;
      window.defenseRun = await mountAdventure(root, {
        frameScheduler: {
          request(fn) {
            const id = ++frameId;
            window.hostFrames.set(id, fn);
            return id;
          },
          cancel(id) {
            window.hostFrames.delete(id);
          },
        },
        game: "ayah-defense",
        refs: Array.from({ length: 206 }, (_, i) => `7:${i + 1}`),
        client: {
          functions: {
            invoke: async (_, { body }) => {
              if (body.asset === "audio")
                return { error: Error("No fixture media") };
              const response = await fetch(
                "https://defense-source.test/?key=" + body.key
              );
              return response.ok
                ? { data: await response.json() }
                : { error: { context: { json: () => response.json() } } };
            },
          },
        },
      });
    });
    await page.locator("[data-adventure-audio]").selectOption("paused");
    await page.locator("[data-flow-start]").click();
  }
  await page.goto("/");
  await mount();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.failFive = true;
    Storage.prototype.setItem = function (k, v) {
      if (
        k === "ayah-flow-adventures-v1" &&
        window.failFive &&
        Object.values(JSON.parse(v).runs).some((r) => r.completed === 5)
      ) {
        window.failFive = false;
        throw new DOMException("Simulated full storage", "QuotaExceededError");
      }
      return set.call(this, k, v);
    };
  });
  for (let n = 1; n <= 206; n++) {
    const bundle = JSON.parse(
      readFileSync(`.quran-private/7/${n}/bundle.json`)
    );
    await page.evaluate(
      async (units) => {
        const nextTask = () =>
          new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {
              channel.port1.close();
              channel.port2.close();
              resolve();
            };
            channel.port2.postMessage(0);
          });
        for (const unit of units) {
          let button;
          for (;;) {
            button = [...document.querySelectorAll("[data-flow-choice]")].find(
              (b) =>
                b.dataset.flowPrompt === unit.id &&
                b.querySelector(".arabic")?.textContent === unit.text
            );
            if (
              button &&
              !button.disabled &&
              !window.defenseRun.getSnapshot().answerPending
            )
              break;
            await new Promise((resolve) => {
              const observer = new MutationObserver(() => {
                observer.disconnect();
                resolve();
              });
              observer.observe(document.querySelector(".flow-ribbon"), {
                childList: true,
                subtree: true,
                attributes: true,
              });
              if (button)
                nextTask().then(() => {
                  observer.disconnect();
                  resolve();
                });
            });
            await nextTask();
          }
          button.click();
          await nextTask();
        }
      },
      revisionUnits(bundle, memory).map((u) => ({ id: u.id, text: u.text }))
    );
    if (
      !(await page.locator("[data-flow-tower-entity]").count()) &&
      (await page.locator("[data-defense-buy=arrow]").isEnabled())
    ) {
      await page.locator("[data-defense-buy=arrow]").click();
      await page.locator("[data-defense-confirm]").click();
    }
    await expect(page.locator(".flow-battlefield")).toHaveAttribute(
      "data-covered",
      String(n)
    );
    if (n === 5) {
      expect(
        await page.evaluate(() => window.defenseRun.getSnapshot().pendingSave)
      ).toBe(true);
      expect(
        await page.evaluate(
          () =>
            Object.values(
              JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
            )[0].completed
        )
      ).toBe(4);
      const credits = await page.evaluate(
        () => window.defenseRun.getSnapshot().engine.energy
      );
      await page
        .getByRole("button", { name: "Retry source / save", exact: true })
        .click();
      await expect(page.locator("[data-flow-message]")).toContainText(
        "7:6 is temporarily unavailable"
      );
      await page
        .getByRole("button", { name: "Retry source / save", exact: true })
        .click();
      await expect(page.locator(".flow-ribbon")).toContainText("7:6");
      expect(
        await page.evaluate(() => window.defenseRun.getSnapshot().engine.energy)
      ).toBe(credits);
      await page.locator(".gameplay-viewport").screenshot({
        path: "/workspace/artifacts/defense2-araf-past-five.png",
      });
    }
    if (n === 10) {
      await page.locator("[data-game-command=settings]").click();
      await page.locator("[data-game-memory]").selectOption("standard");
      await page.locator("[data-game-motor]").selectOption("normal");
      await page.locator("[data-game-command=restart-challenge]").click();
      memory = "standard";
      await expect(page.locator(".flow-battlefield")).toHaveAttribute(
        "data-covered",
        "10"
      );
      await page.locator(".gameplay-toolbar [data-game-command=exit]").click();
      await page.reload();
      await mount();
      await expect(page.locator(".flow-battlefield")).toHaveAttribute(
        "data-covered",
        "10"
      );
    }
    if ([5, 10, 50, 100, 150, 200, 206].includes(n))
      console.log(
        "full-host milestone",
        n,
        await page.locator(".flow-hud").textContent()
      );
    if (n < 206)
      await expect(page.locator(".flow-ribbon")).toContainText(`7:${n + 1}`);
  }
  await expect(page.locator(".flow-ribbon")).not.toContainText(
    "Passage complete ·"
  );
  async function finishCombat() {
    await page.evaluate(() => {
      let time = performance.now();
      for (let frame = 0; frame < 14400; frame++) {
        time += 1000 / 60;
        for (const [id, fn] of [...window.hostFrames]) {
          window.hostFrames.delete(id);
          fn(time);
        }
        if (window.defenseRun.getSnapshot().engine.status !== "playing") break;
      }
    });
  }
  await finishCombat();
  if (await page.locator("[data-flow-recover]").count()) {
    await page.locator("[data-flow-recover]").click();
    await finishCombat();
  }
  await expect(page.locator(".flow-ribbon")).toContainText(
    "Passage complete · 206/206"
  );
  await page
    .locator(".gameplay-viewport")
    .screenshot({ path: "docs/defense2/araf-completion-no-source-text.png" });
  const saved = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("ayah-flow-adventures-v1")).runs
      )[0]
  );
  expect(saved.completed).toBe(206);
  expect(saved.finished).toBe(true);
  expect(JSON.stringify(saved)).not.toMatch(/[\u0600-\u06ff]/);
  expect(new Set(saved.arcade.accepted).size).toBe(
    saved.arcade.accepted.length
  );
});
