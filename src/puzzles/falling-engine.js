// Pure 10-column word-stack engine. Qur'anic strings are compared/displayed verbatim.
export const COLS = 10,
  ROWS = 18;
export const SHAPES = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};
export function cells(piece) {
  let a = SHAPES[piece.shape].map((p) => [...p]);
  for (let i = 0; i < (piece.shape === "O" ? 0 : piece.rotation); i++)
    a = a.map(([x, y]) => [(piece.shape === "I" ? 3 : 2) - y, x]);
  return a.map(([x, y]) => [x + piece.x, y + piece.y]);
}
export function collides(board, piece) {
  return cells(piece).some(
    ([x, y]) =>
      x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x] !== null,
  );
}
export function landing(state) {
  let p = { ...state.current };
  if (!p.entry) return p;
  while (!collides(state.board, { ...p, y: p.y + 1 })) p.y++;
  return p;
}
const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
function spawn(s, entry) {
  s.current = { entry, shape: entry?.shape || "T", rotation: 0, x: 3, y: 0 };
  if (entry && collides(s.board, s.current)) {
    s.board = empty();
    s.boardEpoch++;
  }
}
export function createFalling({
  words,
  entries,
  order = entries.map((_, i) => i),
}) {
  if (!words.length || !entries.length) throw Error("Verified words required");
  if (
    words.some(
      (w, i) => typeof w !== "string" || !w || entries[i]?.text !== w,
    ) ||
    order.length !== entries.length ||
    new Set(order).size !== entries.length ||
    order.some((i) => !Number.isInteger(i) || i < 0 || i >= entries.length)
  )
    throw Error(
      "Every verified word occurrence and queue index must be present exactly once",
    );
  const keys = Object.keys(SHAPES);
  const pool = order.map((i, n) => ({
    ...entries[i],
    index: i,
    target: i < words.length,
    shape: keys[n % 7],
    uid: `piece-${n}`,
  }));
  // Required occurrences are always deliverable in order, with shuffled decoys interleaved.
  const targets = pool
    .filter((e) => e.target)
    .sort((a, b) => a.index - b.index);
  let at = 0;
  const queue = pool.map((e) => (e.target ? targets[at++] : e));
  const s = {
    words: [...words],
    queue: queue.slice(1),
    current: null,
    hold: null,
    board: empty(),
    accepted: [],
    placements: [],
    boardEpoch: 0,
    strikes: 0,
    errors: [],
    score: 0,
    status: "playing",
    paused: false,
    locks: 0,
    event: "start",
  };
  spawn(s, queue[0]);
  return s;
}
function advance(s) {
  // Recovery never strands a required word behind future words, even after Hold or rejection.
  const needed = s.words.slice(s.accepted.length);
  const targets = s.queue.filter((e) => e.target);
  const sorted = [];
  for (const word of needed) {
    const i = targets.findIndex((e) => e.text === word);
    if (i >= 0) sorted.push(...targets.splice(i, 1));
  }
  let n = 0;
  s.queue = s.queue.map((e) => (e.target ? sorted[n++] || e : e));
  if (!s.queue.length && s.hold) {
    s.queue.push(s.hold);
    s.hold = null;
  }
  spawn(s, s.queue.shift());
}
export function stepFalling(state, action) {
  if (state.status !== "playing") return state;
  const s = structuredClone(state);
  s.event = "";
  if (action.type === "pause") {
    s.paused = !s.paused;
    return s;
  }
  if (s.paused || !s.current?.entry) return state;
  const p = s.current;
  if (action.type === "move") {
    const q = { ...p, x: p.x + action.delta };
    if (!collides(s.board, q)) s.current = q;
    return s;
  }
  if (action.type === "rotate") {
    const q = { ...p, rotation: (p.rotation + 1) % 4 };
    for (const kick of [0, -1, 1, -2, 2])
      if (!collides(s.board, { ...q, x: q.x + kick })) {
        s.current = { ...q, x: q.x + kick };
        break;
      }
    return s;
  }
  if (action.type === "tick" || action.type === "soft") {
    if (!collides(s.board, { ...p, y: p.y + 1 })) p.y++;
    else return stepFalling(s, { type: "drop" });
    return s;
  }
  if (action.type === "hold") {
    const held = s.hold;
    s.hold = p.entry;
    if (held) spawn(s, held);
    else advance(s);
    s.event = "hold";
    return s;
  }
  if (action.type !== "drop") return state;
  const e = p.entry,
    next = s.accepted.length;
  const landed = landing(s);
  const side =
    action.slot === undefined && cells(landed).every(([x]) => x < 3 || x > 6);
  if (side) {
    s.placements.push({
      entry: e,
      piece: landed,
      kind: "side",
      epoch: s.boardEpoch,
    });
    for (const [x, y] of cells(landed)) s.board[y][x] = e.shape;
    if (e.target) s.queue.unshift(e);
    else s.score += 10;
    s.event = "parked";
    advance(s);
    return s;
  }
  const wrong =
    !e.target ||
    e.text !== s.words[next] ||
    (action.slot !== undefined && action.slot !== next);
  if (wrong) {
    s.strikes++;
    s.errors.push({
      kind: e.target ? "sequence" : "distractor-placed",
      surah: e.surah,
      ayah: e.ayah,
      position: e.position,
      expectedPosition: next,
      word: e.text,
    });
    s.event = "mistake";
    if (s.strikes >= 3) {
      s.status = "lost";
      return s;
    }
    if (e.target) s.queue.unshift(e);
    else s.queue.push(e);
    advance(s);
    return s;
  }
  s.placements.push({
    entry: e,
    piece: landed,
    kind: "sequence",
    epoch: s.boardEpoch,
  });
  for (const [x, y] of cells(landed)) s.board[y][x] = e.shape;
  s.accepted.push(s.words[next]);
  s.locks++;
  s.score += 100;
  s.event = "correct";
  if (s.accepted.length === s.words.length) {
    s.status = "won";
    return s;
  }
  advance(s);
  return s;
}
