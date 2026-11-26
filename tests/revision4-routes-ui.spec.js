import { test, expect } from "@playwright/test";
import { mountRush } from "./rush3-ui-helper.js";
for (const [name, target, upper, middle] of [
  ["spring", 0, "spring-ascent", "rolling-hills"],
  ["ramp", 0, "spiral-ramp", "rolling-hills"],
  ["lift", 0, "lift-climb", "rolling-hills"],
  ["wall", 0, "wall-jump", "rolling-hills"],
  ["rail", 0, "sky-rail", "rolling-hills"],
  ["hills", 1, "spring-ascent", "rolling-hills"],
  ["tunnel", 1, "spring-ascent", "slide-tunnel"],
  ["loop", 1, "spring-ascent", "loop-run"],
  ["gaps", 1, "spring-ascent", "gap-hops"],
  ["conveyor", 1, "spring-ascent", "conveyor-dash"],
])
  test(`actual recovered ${name} junction moves through its physical route before committing Arabic`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mountRush(page, { refs: ["1:1", "1:2"] });
    await page.evaluate(
      async ({ upper, middle }) => {
        window.rushActivity.dispose();
        const { createSurahRush } = await import(
            "/src/revision/adventures/rush.js"
          ),
          { validAdventure } = await import(
            "/src/revision/adventures/store.js"
          );
        const data = JSON.parse(
            localStorage.getItem("ayah-flow-adventures-v1")
          ),
          r = Object.values(data.runs).find((r) => r.game === "surah-rush"),
          a = createSurahRush().checkpoint();
        a.junction = {
          index: 0,
          generatorVersion: 4,
          layouts: { upper, middle },
        };
        r.arcade = a;
        if (!validAdventure(r))
          throw Error("Invalid recovered junction fixture");
        localStorage.setItem("ayah-flow-adventures-v1", JSON.stringify(data));
      },
      { upper, middle }
    );
    await mountRush(page, { refs: ["1:1", "1:2"] });
    await page.evaluate(async (target) => {
      const key = (code, type = "keydown") =>
        document
          .querySelector(".flow-battlefield")
          .dispatchEvent(new KeyboardEvent(type, { bubbles: true, code }));
      for (let n = 0; n < 2500; n++) {
        const s = window.rushActivity.getSnapshot().engine,
          x = s.x - s.plan.start;
        if (s.x >= s.plan.commits[0].x - 25) {
          key("ArrowRight", "keyup");
          return;
        }
        key("ArrowRight");
        if (
          target === 0 &&
          ((s.grounded && x > 440 && s.y + 18 > s.plan.upper + 8) || s.wall)
        )
          key("Space");
        if (target === 1 && s.plan.layouts.middle === "slide-tunnel" && x > 805)
          key("KeyS");
        if (
          target === 1 &&
          s.grounded &&
          s.plan.platforms
            .find((p) => p.route === 1)
            ?.gaps?.some((g) => s.x > g[0] - 22 && s.x < g[0])
        )
          key("Space");
        window.rushClock += 1000 / 60;
        for (const [id, fn] of [...window.rushFrames]) {
          window.rushFrames.delete(id);
          fn(window.rushClock);
        }
        if (n % 12 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      throw Error("Physical route did not reach approach");
    }, target);
    const s = await page.evaluate(() => window.rushActivity.getSnapshot());
    expect(s.completed).toBe(0);
    expect(s.engine.x).toBeGreaterThan(1000);
    await expect(page.locator(".flow-scene svg")).toHaveAttribute(
      "data-upper-route",
      upper
    );
    await expect(page.locator(".flow-scene svg")).toHaveAttribute(
      "data-middle-route",
      middle
    );
    await page.evaluate(() => window.rushActivity.pause());
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/revision4/route-${name}.png` });
  });
