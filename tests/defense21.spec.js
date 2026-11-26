import { test, expect } from "@playwright/test";
import {
  createAyahDefense,
  purchaseCheck,
  openingPace,
  towerRange,
  TOWERS,
} from "../src/revision/adventures/defense.js";
import { legalPositions } from "../src/revision/adventures/defense-maps.js";
import { revisionUnits } from "../src/revision/adventures/content.js";
import { localBundle } from "../src/content/library.js";
import { mountRush } from "./rush3-ui-helper.js";
const advance = (g, seconds) => {
  for (let i = 0; i < seconds * 60; i++)
    g.dispatch({ type: "tick", dt: 1 / 60 });
};
test("complete purchase preview and commit agree for currency, support, footprint, limit and terminal status", () => {
  const g = createAyahDefense();
  g.start();
  let p = legalPositions(0)[0];
  expect(purchaseCheck(g.getSnapshot(), "arrow", p).valid).toBe(false);
  g.dispatch({ type: "place", kind: "arrow", position: p });
  expect(g.getSnapshot().energy).toBe(0);
  for (const k of ["1:1", "1:2", "1:3"])
    g.dispatch({
      type: "revision",
      id: revisionUnits(localBundle(k))[0].id,
      points: 20,
    });
  const before = g.getSnapshot();
  expect(purchaseCheck(before, "arrow", p).valid).toBe(true);
  g.dispatch({ type: "place", kind: "arrow", position: p });
  expect(g.getSnapshot().energy).toBe(10);
  expect(g.getSnapshot().towers).toHaveLength(1);
  expect(purchaseCheck(g.getSnapshot(), "arrow", p).valid).toBe(false);
  expect(
    purchaseCheck({ ...before, status: "won" }, "arrow", p).reason
  ).toContain("Repair");
  expect(
    purchaseCheck({ ...before, energy: 500 }, "guardian", p).reason
  ).toContain("attacking");
  const obs = {
    id: 7,
    kind: "observatory",
    x: p.x + 70,
    y: p.y,
    level: 2,
    active: true,
  };
  expect(towerRange("arrow", p, 1, [obs])).toBeCloseTo(
    TOWERS.arrow.range * 1.24
  );
});
for (const motor of ["relaxed", "normal", "arcade"])
  test(`${motor}: opening moves at 20% baseline and protects the initial 30 seconds even after first purchase`, () => {
    const g = createAyahDefense({ motor });
    g.start();
    advance(g, 1);
    const pace = { relaxed: 34, normal: 48, arcade: 64 }[motor];
    expect(g.getSnapshot().enemies[0].d).toBeCloseTo(pace * 0.2, 0);
    expect(g.getSnapshot().towers).toHaveLength(0);
    expect(g.getSnapshot().coins).toBe(0);
    for (const k of ["1:1", "1:2", "1:3"])
      g.dispatch({
        type: "revision",
        id: revisionUnits(localBundle(k))[0].id,
        points: 20,
      });
    g.dispatch({
      type: "place",
      kind: "arrow",
      position: legalPositions(0)[0],
    });
    expect(openingPace(g.getSnapshot())).toMatchObject({
      grace: true,
      multiplier: 0.2,
    });
    advance(g, 28);
    expect(g.getSnapshot().core).toBe(100);
    expect(openingPace(g.getSnapshot()).grace).toBe(true);
    advance(g, 3);
    expect(openingPace(g.getSnapshot()).grace).toBe(false);
  });
test("established mixed waves introduce every neutral balloon effect without arbitrary Quran rewards", () => {
  const seen = new Set(),
    g = createAyahDefense({
      onEvent: (e) => {
        if (e.type === "neutral-defeated") seen.add(e.kind);
      },
    });
  g.start();
  const units = Array.from({ length: 40 }, (_, i) =>
    revisionUnits(localBundle(`78:${i + 1}`))
  ).flat();
  for (const u of units) g.dispatch({ type: "revision", id: u.id, points: 20 });
  for (const kind of Object.keys(TOWERS)) {
    g.dispatch({
      type: "place",
      kind,
      position: legalPositions(0, g.getSnapshot().towers)[0],
    });
  }
  for (let n = 0; n < 300; n++) {
    g.dispatch({ type: "revision", id: `79:${(n % 46) + 1}:1-1`, points: 1 });
    advance(g, 1);
    for (const e of g.getSnapshot().enemies) seen.add(e.kind);
  }
  expect([...seen].sort()).toEqual(
    ["walker", "scout", "armored", "swarm", "shielded", "siege"].sort()
  );
  expect(g.getSnapshot().kills).toBeGreaterThan(0);
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test(`valid preview survives dynamic-target replacement, resize and zoom before release at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mountRush(page, {
      game: "ayah-defense",
      refs: ["1:1", "1:2", "1:3", "1:4", "1:5"],
    });
    for (const key of ["1:1", "1:2", "1:3"])
      await page
        .locator("[data-flow-choice]")
        .filter({ hasText: localBundle(key).textUthmani })
        .click();
    await page.locator("[data-defense-buy=arrow]").click();
    await page.locator(".defense-map-tools [data-defense-zoom]").click();
    const point = await page.locator(".flow-scene svg").evaluate((svg) => {
      const p = svg.createSVGPoint();
      p.x = 45;
      p.y = 45;
      const v = p.matrixTransform(svg.getScreenCTM());
      return { x: v.x, y: v.y };
    });
    await page.mouse.move(point.x, point.y);
    await expect(page.locator("[data-defense-preview]")).toHaveAttribute(
      "data-valid",
      "true"
    );
    await page
      .locator(".flow-scene svg [data-defense-dynamic]")
      .evaluate((group) => {
        const node = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        node.dataset.transientPlacementTarget = "";
        node.setAttribute("cx", "45");
        node.setAttribute("cy", "45");
        node.setAttribute("r", "12");
        node.setAttribute("fill", "transparent");
        group.append(node);
      });
    await expect(page.locator("[data-transient-placement-target]")).toHaveCount(
      1
    );
    await page.mouse.down();
    await page.evaluate(() => {
      for (let n = 0; n < 60; n++) {
        window.rushClock += 1000 / 60;
        for (const [id, fn] of [...window.rushFrames]) {
          window.rushFrames.delete(id);
          fn(window.rushClock);
        }
      }
    });
    await expect(page.locator("[data-transient-placement-target]")).toHaveCount(
      0
    );
    await page.mouse.up();
    await expect(page.locator("[data-flow-tower-entity]")).toHaveCount(1);
    expect(
      await page.evaluate(() => window.rushActivity.getSnapshot().engine.energy)
    ).toBe(10);
    await page.locator("[data-game-command=expand]").click();
    const frame = await page.locator(".gameplay-viewport").boundingBox(),
      scene = await page.locator(".flow-scene").boundingBox();
    expect(scene.height).toBeGreaterThan(viewport.width > 600 ? 330 : 235);
    expect(scene.y + scene.height).toBeLessThan(frame.y + frame.height);
    await page
      .locator(".gameplay-viewport")
      .screenshot({ path: `docs/surah-rush3/defense21-${viewport.width}.png` });
  });
