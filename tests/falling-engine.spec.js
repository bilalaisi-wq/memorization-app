import { test, expect } from "@playwright/test";
import {
  createFalling,
  stepFalling,
  cells,
  collides,
  landing,
  SHAPES,
} from "../src/puzzles/falling-engine.js";
const make = (words = ["أ", "ب", "ب"]) =>
  createFalling({
    words,
    entries: [
      ...words.map((text, index) => ({ text, position: index })),
      { text: "د", surah: 2, ayah: 1, position: 0 },
    ],
    order: [3, ...words.map((_, i) => i)],
  });
test("all seven tetrominoes rotate, collide, land and freeze while paused or lost", () => {
  expect(Object.keys(SHAPES)).toHaveLength(7);
  let s = make();
  const original = structuredClone(s);
  for (let i = 0; i < 20; i++) s = stepFalling(s, { type: "move", delta: -1 });
  expect(Math.min(...cells(s.current).map((p) => p[0]))).toBe(0);
  s = stepFalling(s, { type: "rotate" });
  expect(collides(s.board, s.current)).toBe(false);
  expect(landing(s).y).toBeGreaterThan(s.current.y);
  s = stepFalling(s, { type: "pause" });
  expect(stepFalling(s, { type: "tick" })).toBe(s);
  s = stepFalling(s, { type: "pause" });
  for (let i = 0; i < 100; i++) s = stepFalling(s, { type: "tick" });
  expect(s.strikes).toBe(0);
  for (let i = 0; i < 3; i++) s = stepFalling(s, { type: "drop", slot: 9 });
  expect(s.status).toBe("lost");
  expect(s.errors).toHaveLength(3);
  expect(stepFalling(s, { type: "hold" })).toBe(s);
  expect(original).toEqual(make());
});
test("discard recovery, Hold, repeated words and canonical queues remain solvable", () => {
  let s = stepFalling(make(), { type: "discard" });
  s = stepFalling(s, { type: "discard" });
  expect(s.strikes).toBe(1);
  expect(s.current.entry.text).toBe("أ");
  s = stepFalling(s, { type: "hold" });
  expect(s.hold.text).toBe("أ");
  s = stepFalling(s, { type: "hold" });
  expect(s.current.entry.text).toBe("أ");
  for (let i = 0; i < 12 && s.status === "playing"; i++) {
    if (
      s.current.entry.target &&
      s.current.entry.text !== s.words[s.accepted.length] &&
      s.hold?.text === s.words[s.accepted.length]
    )
      s = stepFalling(s, { type: "hold" });
    s = stepFalling(s, { type: s.current.entry.target ? "drop" : "discard" });
  }
  expect(s.status).toBe("won");
  expect(s.accepted).toEqual(["أ", "ب", "ب"]);
  expect(s.strikes).toBe(1);
});
test("wrong sequence or wrong destination costs one strike without losing a word", () => {
  let s = stepFalling(make(), { type: "discard" });
  s = stepFalling(s, { type: "drop", slot: 1 });
  expect(s.strikes).toBe(1);
  expect(s.accepted).toEqual([]);
  s = stepFalling(s, { type: "drop", slot: 0 });
  expect(s.accepted).toEqual(["أ"]);
  expect(s.board.flat().filter(Boolean)).toHaveLength(4);
});
test("every shape has four rigid cells through four rotations and obeys stack collisions", () => {
  for (const shape of Object.keys(SHAPES)) {
    let s = make();
    s.current.shape = shape;
    const initial = cells(s.current);
    for (let i = 0; i < 4; i++) {
      s = stepFalling(s, { type: "rotate" });
      expect(new Set(cells(s.current).map((p) => p.join(":"))).size).toBe(4);
      expect(collides(s.board, s.current)).toBe(false);
    }
    expect(cells(s.current)).toEqual(initial);
    const p = landing(s);
    expect(collides(s.board, { ...p, y: p.y + 1 })).toBe(true);
    const [x, y] = cells(p)[0];
    s.board[y][x] = "O";
    expect(collides(s.board, p)).toBe(true);
  }
});
test("hundreds of shuffled source queues finish without forced errors and repeated words remain occurrences", () => {
  const words = ["a", "b", "b", "c", "a"];
  const entries = [
    ...words.map((text) => ({ text })),
    { text: "d" },
    { text: "e" },
  ];
  for (let seed = 0; seed < 100; seed++) {
    const order = entries
      .map((_, i) => i)
      .sort(
        (a, b) => ((a * 31 + seed * 17) % 13) - ((b * 31 + seed * 17) % 13),
      );
    let s = createFalling({ words, entries, order });
    while (s.status === "playing")
      s = stepFalling(s, { type: s.current.entry.target ? "drop" : "discard" });
    expect(s.accepted).toEqual(words);
    expect(s.strikes).toBe(0);
  }
});
test("incomplete or duplicated source queues fail before gameplay", () => {
  expect(() =>
    createFalling({ words: ["a", "b"], entries: [{ text: "a" }] }),
  ).toThrow();
  expect(() =>
    createFalling({
      words: ["a"],
      entries: [{ text: "a" }, { text: "b" }],
      order: [0, 0],
    }),
  ).toThrow();
});
