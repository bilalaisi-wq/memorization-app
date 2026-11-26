// Original, bounded terrain plans. These are movement surfaces, never Qur'an/waqf units.
export const STRIDE = 1640;
export const ZONES = [
  {
    id: "emerald",
    name: "Emerald Adventure",
    sky: "#143c53",
    land: "#388b62",
    edge: "#a4d784",
    accent: "#efd278",
  },
  {
    id: "forest",
    name: "Moonlight Forest",
    sky: "#141d45",
    land: "#2c5364",
    edge: "#87c8bd",
    accent: "#b5a4ec",
  },
  {
    id: "skyways",
    name: "Celestial Skyways",
    sky: "#1b3260",
    land: "#586a96",
    edge: "#e0c880",
    accent: "#8ce1df",
  },
  {
    id: "clockwork",
    name: "Neon Clockwork City",
    sky: "#212043",
    land: "#3c536b",
    edge: "#59d6cc",
    accent: "#c398eb",
  },
  {
    id: "oasis",
    name: "Oasis Canyon",
    sky: "#353356",
    land: "#ad785d",
    edge: "#e3b98a",
    accent: "#6fd5cc",
  },
];
export const ROUTE_KINDS = [
  "branches",
  "loop-spring",
  "vertical",
  "obstacles",
  "multi-junction",
];
export const MOTOR_PROFILES = {
  relaxed: { name: "Speed Course", speed: 270, acceleration: 1250, jump: 585 },
  normal: {
    name: "Adventure Course",
    speed: 350,
    acceleration: 1350,
    jump: 610,
  },
  arcade: {
    name: "Technical Course",
    speed: 440,
    acceleration: 1450,
    jump: 630,
  },
};
const mix = (n) => {
  n = (n ^ (n >>> 16)) >>> 0;
  n = Math.imul(n, 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
};
export function coursePlan(
  index,
  { seed = 1, motor = "normal", zone = 0, count = 3 } = {}
) {
  const start = index * STRIDE,
    kind = ROUTE_KINDS[(index + (mix(seed) % 5)) % 5],
    jitter = (mix(seed + Math.floor(index / 5)) % 3) * 12;
  const upper = 244 - jitter,
    middle = 418,
    lower = 572 + jitter;
  const platform = (id, a, b, y, route = null, extra = {}) => ({
    id: `${index}:${id}`,
    a: start + a,
    b: start + b,
    y,
    route,
    ...extra,
  });
  const platforms = [
    platform("approach", 0, 600, middle, null, { ground: true }),
    platform("step-a", 480, 720, 350),
    platform("step-b", 655, 900, 286 - jitter),
    platform("upper", 830, 1260, upper, 0),
    platform("middle", 580, 1260, middle, 1),
    platform("lower", 540, 1260, lower, 2),
    platform("landing", 1260, STRIDE + 10, middle),
    platform("safety", 360, 1260, 690, null, { safety: true }),
  ];
  // A genuine gap with a moving crossing; relaxed keeps a supported bridge.
  if (["obstacles", "multi-junction"].includes(kind) && motor !== "relaxed") {
    for (const route of [0, 1, 2]) {
      const p = platforms.find((p) => p.route === route);
      p.gap = [start + 925, start + 1000];
    }
    platforms.push(
      platform("ferry", 905, 1025, middle, null, {
        moving: true,
        amplitude: 72,
        period: 4,
      })
    );
  }
  if (kind === "vertical" || kind === "multi-junction")
    platforms.push(
      platform("lift", 560, 660, 330, null, {
        moving: true,
        amplitude: 105,
        period: 5,
      })
    );
  if (zone === 1)
    platforms.push(
      platform("forest-bounce", 665, 770, 300, null, {
        moving: true,
        amplitude: 35,
        period: 3.6,
      })
    );
  if (zone === 2)
    platforms.push(platform("sky-rail", 600, 800, 210, null, { rail: true }));
  if (zone === 3) {
    platforms[0].conveyor = 45;
    platforms.push(
      platform("rotating-deck", 700, 850, 320, null, {
        rotating: true,
        period: 5,
      })
    );
  }
  const loop = ["loop-spring", "multi-junction"].includes(kind)
    ? {
        cx: start + 805,
        cy: middle - 58,
        r: 58,
        entry: start + 747,
        exit: start + 863,
      }
    : null;
  const springs = [
    {
      x: start + (kind === "vertical" ? 565 : 495),
      y: kind === "vertical" ? middle : 350,
      power: kind === "vertical" ? 710 : 650,
    },
  ];
  const barriers =
    motor === "arcade" && ["obstacles", "multi-junction"].includes(kind)
      ? [{ x: start + 910, y: middle - 42, w: 28, h: 42 }]
      : [];
  const plan = {
    index,
    start,
    end: start + STRIDE,
    kind,
    zone: Math.max(0, zone) % 5,
    upper,
    middle,
    lower,
    count,
    platforms,
    springs,
    loop,
    barriers,
    commits: [upper, middle, lower].map((y, i) => ({
      index: i,
      x: start + 1100,
      y,
      a: start + 1070,
      b: start + 1240,
    })),
    signX: start + 825,
    detour: {
      a: start + 1135,
      b: start + STRIDE + 30,
      y: 630,
      gap: [start + 1300, start + 1360],
    },
    seed,
  };
  return validateCourse(plan)
    ? plan
    : courseFallback(index, { seed, motor, zone, count });
}
export function courseFallback(index, options = {}) {
  const start = index * STRIDE;
  const floors = [244, 418, 572];
  return {
    index,
    start,
    end: start + STRIDE,
    kind: "branches",
    zone: options.zone || 0,
    count: options.count || 3,
    upper: 244,
    middle: 418,
    lower: 572,
    seed: options.seed || 1,
    platforms: [
      { id: `${index}:approach`, a: start, b: start + 600, y: 418 },
      { id: `${index}:step-a`, a: start + 480, b: start + 720, y: 350 },
      { id: `${index}:step-b`, a: start + 655, b: start + 900, y: 286 },
      ...floors.map((y, i) => ({
        id: `${index}:route-${i}`,
        a: start + (i === 0 ? 830 : 540),
        b: start + 1260,
        y,
        route: i,
      })),
      {
        id: `${index}:landing`,
        a: start + 1260,
        b: start + STRIDE + 10,
        y: 418,
      },
      {
        id: `${index}:safety`,
        a: start + 360,
        b: start + 1260,
        y: 690,
        safety: true,
      },
    ],
    springs: [],
    loop: null,
    barriers: [],
    commits: floors.map((y, i) => ({
      index: i,
      x: start + 1100,
      y,
      a: start + 1070,
      b: start + 1240,
    })),
    signX: start + 825,
    detour: {
      a: start + 1135,
      b: start + STRIDE + 30,
      y: 630,
      gap: [start + 1300, start + 1360],
    },
  };
}
export function validateCourse(p) {
  if (
    !p.platforms.length ||
    p.commits.length !== 3 ||
    p.platforms.some((v) => !Number.isFinite(v.y) || v.b <= v.a)
  )
    return false;
  const tiers = [p.middle, 350, 286 - (418 - p.middle), p.upper];
  // Conservative reachability envelope: ledges overlap horizontally; every rise is below
  // the smallest jump's 114px apex. Gap widths are under a normal running jump.
  if (tiers.slice(1).some((y, i) => Math.abs(y - tiers[i]) > 114)) return false;
  return (
    p.commits.every((c) =>
      p.platforms.some((v) => v.route === c.index && v.a <= c.a && v.b >= c.b)
    ) &&
    p.platforms.filter((v) => v.gap).every((v) => v.gap[1] - v.gap[0] <= 90) &&
    p.detour.gap[1] - p.detour.gap[0] <= 90
  );
}
export function platformY(p, time) {
  return (
    p.y +
    (p.moving
      ? Math.sin((time * Math.PI * 2) / p.period) * (p.amplitude || 0)
      : 0)
  );
}
export function floorAt(x, plan, time = 0) {
  const v = plan.platforms.filter(
    (p) => !p.safety && p.route == null && !p.moving && x >= p.a && x <= p.b
  );
  return v[0]?.y ?? plan.middle;
}
export function checkpointDue(
  refs,
  completed,
  { fullSurah = false, checkpointInterval = 25 } = {}
) {
  return fullSurah &&
    completed > 0 &&
    completed < refs.length &&
    completed % checkpointInterval === 0
    ? completed
    : null;
}
