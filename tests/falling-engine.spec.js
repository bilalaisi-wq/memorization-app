import { test, expect } from "@playwright/test";
import {
  createFalling,
  stepFalling,
  cells,
  collides,
  landing,
  SHAPES,
} from "../src/puzzles/falling-engine.js";
const make = () =>
  createFalling({
    words: ["a", "b", "b"],
    entries: [{ text: "a" }, { text: "b" }, { text: "b" }, { text: "extra" }],
    order: [3, 0, 1, 2],
  });
const park = (state) => {
  let s = state;
  const width = () => {
    const xs = cells(s.current).map(([x]) => x);
    return Math.max(...xs) - Math.min(...xs) + 1;
  };
  if (width() > 3) s = stepFalling(s, { type: "rotate" });
  for (let i = 0; i < 10; i++) s = stepFalling(s, { type: "move", delta: -1 });
  return stepFalling(s, { type: "drop" });
};
test("seven shapes rotate, collide and have valid ghost landings", () => {
  for (const shape of Object.keys(SHAPES)) {
    let s = make();
    s.current.shape = shape;
    const original = cells(s.current);
    for (let i = 0; i < 4; i++) s = stepFalling(s, { type: "rotate" });
    expect(cells(s.current)).toEqual(original);
    for (let i = 0; i < 20; i++)
      s = stepFalling(s, { type: "move", delta: -1 });
    expect(Math.min(...cells(s.current).map(([x]) => x))).toBe(0);
    expect(collides(s.board, s.current)).toBe(false);
    const p = landing(s);
    expect(collides(s.board, { ...p, y: p.y + 1 })).toBe(true);
  }
});
test("extra words parked to either side cost no strike; middle mistakes cost three strikes and freeze", () => {
  let s = park(make());
  expect(s.strikes).toBe(0);
  expect(s.event).toBe("parked");
  expect(s.accepted).toEqual([]);
  expect(s.board.flat().filter(Boolean)).toHaveLength(4);
  s = stepFalling(s, { type: "drop" });
  expect(s.accepted).toEqual(["a"]);
  for (let i = 0; i < 3; i++) s = stepFalling(s, { type: "drop", slot: 0 });
  expect(s.status).toBe("lost");
  expect(s.strikes).toBe(3);
  expect(stepFalling(s, { type: "move", delta: 1 })).toBe(s);
});
test("required side parking recovers the occurrence and duplicate words stay solvable", () => {
  let s = park(make());
  s = park(s);
  expect(s.current.entry.text).toBe("a");
  expect(s.strikes).toBe(0);
  for (let i = 0; i < 3; i++) s = stepFalling(s, { type: "drop" });
  expect(s.status).toBe("won");
  expect(s.accepted).toEqual(["a", "b", "b"]);
});
test("gravity locks automatically; pause freezes motion and Hold preserves the queue", () => {
  let s = make();
  s = stepFalling(s, { type: "pause" });
  expect(stepFalling(s, { type: "tick" })).toBe(s);
  s = stepFalling(s, { type: "pause" });
  s = stepFalling(s, { type: "hold" });
  expect(s.hold.text).toBe("extra");
  for (let i = 0; i < 30 && !s.accepted.length; i++)
    s = stepFalling(s, { type: "tick" });
  expect(s.accepted).toEqual(["a"]);
});
test("discard is removed and incomplete queues fail before play", () => {
  const s = make();
  expect(stepFalling(s, { type: "discard" })).toBe(s);
  expect(() =>
    createFalling({ words: ["a", "b"], entries: [{ text: "a" }] }),
  ).toThrow();
});
test("Ash-Shams example: Al-Layl is safe on the right but a strike in the ayah stack", async () => {
  const { surahs } = await import("../src/data.js");
  const words = surahs.find((s) => s.id === 91).verses[0].words;
  const extra = surahs.find((s) => s.id === 92).verses[0].words[0];
  let s = createFalling({
    words,
    entries: [...words.map((text) => ({ text })), { text: extra }],
    order: [0, 2, 1],
  });
  s = stepFalling(s, { type: "drop" });
  expect(s.accepted).toEqual([words[0]]);
  expect(stepFalling(s, { type: "drop" }).strikes).toBe(1);
  if (
    Math.max(...cells(s.current).map(([x]) => x)) -
      Math.min(...cells(s.current).map(([x]) => x)) +
      1 >
    3
  )
    s = stepFalling(s, { type: "rotate" });
  for (let i = 0; i < 10; i++) s = stepFalling(s, { type: "move", delta: 1 });
  s = stepFalling(s, { type: "drop" });
  expect(s.strikes).toBe(0);
  expect(s.accepted).toEqual([words[0]]);
  expect(s.placements.at(-1).entry.text).toBe(extra);
  s = stepFalling(s, { type: "drop" });
  expect(s.status).toBe("won");
  expect(s.accepted).toEqual(words);
});
