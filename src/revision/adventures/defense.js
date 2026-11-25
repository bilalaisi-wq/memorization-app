export const TOWERS = {
  arrow: {
    name: "Arrow",
    cost: 8,
    energy: 6,
    range: 160,
    rate: 0.5,
    damage: 5,
  },
  frost: {
    name: "Frost",
    cost: 10,
    energy: 6,
    range: 140,
    rate: 1.4,
    damage: 1,
  },
  beam: {
    name: "Beam",
    cost: 12,
    energy: 8,
    range: 180,
    rate: 0.15,
    damage: 2,
  },
  pulse: {
    name: "Pulse",
    cost: 12,
    energy: 8,
    range: 120,
    rate: 1.8,
    damage: 9,
  },
  guardian: {
    name: "Guardian",
    cost: 10,
    energy: 6,
    range: 155,
    rate: 2,
    damage: 0,
  },
  observatory: {
    name: "Observatory",
    cost: 10,
    energy: 6,
    range: 190,
    rate: 1,
    damage: 0,
  },
};
export const SITES = [
  { x: 150, y: 115 },
  { x: 310, y: 255 },
  { x: 430, y: 105 },
  { x: 590, y: 275 },
  { x: 730, y: 115 },
  { x: 825, y: 265 },
];
export const REGIONS = [
  "Starlit Valley",
  "Crystal Pass",
  "Moonlit Ridge",
  "Celestial Observatory",
  "Fortress Gate",
];
const ENEMIES = {
  walker: { hp: 22, speed: 1, armor: 0 },
  scout: { hp: 13, speed: 1.65, armor: 0 },
  armored: { hp: 52, speed: 0.7, armor: 2 },
  swarm: { hp: 9, speed: 1.2, armor: 0 },
  shielded: { hp: 30, speed: 0.9, armor: 0, shield: 15 },
  siege: { hp: 120, speed: 0.5, armor: 1 },
};
export function defensePath(region = 0) {
  return [
    { x: -20, y: 210 },
    { x: 180, y: 210 },
    { x: 250, y: region % 2 ? 90 : 330 },
    { x: 460, y: region % 2 ? 90 : 330 },
    { x: 530, y: 210 },
    { x: 920, y: 210 },
  ];
}
export function pointOnPath(distance, region) {
  const path = defensePath(region);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance <= length)
      return {
        x: a.x + ((b.x - a.x) * distance) / length,
        y: a.y + ((b.y - a.y) * distance) / length,
      };
    distance -= length;
  }
  return path.at(-1);
}
export function createAyahDefense({
  motor = "relaxed",
  restore = null,
  onEvent = () => {},
} = {}) {
  let disposed = false,
    serial = 0,
    acc = 0;
  const s = {
    status: "ready",
    time: 0,
    coins: 72,
    energy: 0,
    core: 100,
    shield: 25,
    towers: [],
    queue: [],
    enemies: [],
    effects: [],
    wave: 0,
    spawn: 0,
    region: 0,
    kills: 0,
    motorErrors: 0,
    score: 0,
    reading: 0,
    cooldowns: { shield: 0, overcharge: 0, frost: 0 },
    overcharge: 0,
    final: false,
    finalSpawns: 0,
    accepted: [],
    ...structuredClone(restore || {}),
  };
  s.enemies = [];
  s.effects = [];
  s.status = "ready";
  s.reading = 0;
  const event = (type, data = {}) => onEvent({ type, ...data });
  function hit(e, damage, pierce = false) {
    if (e.shield > 0 && !pierce) {
      const amount = Math.min(e.shield, damage);
      e.shield -= amount;
      damage -= amount;
    }
    e.hp -= Math.max(0.25, damage - (pierce ? 0 : e.armor || 0));
  }
  function tick(dt) {
    s.time += dt;
    s.reading += dt;
    for (const k of Object.keys(s.cooldowns))
      s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
    s.overcharge = Math.max(0, s.overcharge - dt);
    s.effects = s.effects.filter((e) => (e.life -= dt) > 0);
    const pressure = s.reading > 12 ? 0.28 : 1,
      pace = { relaxed: 34, normal: 48, arcade: 64 }[motor];
    s.spawn -= dt;
    if (
      s.spawn <= 0 &&
      s.enemies.length < (s.reading > 12 ? 3 : 9) &&
      (!s.final || s.finalSpawns < 2)
    ) {
      const types = Object.keys(ENEMIES),
        kind = s.final
          ? "siege"
          : types[
              (s.wave + serial) %
                Math.min(types.length, 2 + Math.floor(s.wave / 2))
            ],
        e = ENEMIES[kind];
      s.enemies.push({ id: ++serial, kind, ...e, maxHp: e.hp, d: 0, slow: 0 });
      if (kind === "swarm" && s.enemies.length < 8)
        s.enemies.push({
          id: ++serial,
          kind,
          ...e,
          maxHp: e.hp,
          d: -25,
          slow: 0,
        });
      s.spawn = (motor === "arcade" ? 2.2 : 3.8) / pressure;
      s.wave++;
      if (s.final) s.finalSpawns++;
    }
    for (const t of s.towers) {
      if (!t.active) continue;
      const def = TOWERS[t.kind],
        level = t.level || 1,
        near = s.towers.filter(
          (o) =>
            o.active &&
            o.kind === "observatory" &&
            Math.hypot(o.x - t.x, o.y - t.y) < 190 * (1 + 0.12 * (o.level - 1))
        ),
        range =
          def.range *
          (1 +
            0.12 * (level - 1) +
            near.reduce((n, o) => n + o.level, 0) * 0.12),
        rate =
          def.rate /
          (1 +
            (level - 1) * 0.25 +
            near.reduce((n, o) => n + o.level, 0) * 0.2 +
            (s.overcharge ? 1 : 0));
      t.cool = (t.cool || 0) - dt;
      if (t.kind === "guardian") {
        if (t.cool <= 0) {
          s.shield = Math.min(60, s.shield + 2 * level);
          for (const e of s.enemies) {
            const p = pointOnPath(e.d, s.region);
            if (Math.hypot(p.x - t.x, p.y - t.y) < range)
              e.d = Math.max(0, e.d - 12 * level);
          }
          if (level >= 3 && s.core < 30 && !t.emergency) {
            s.shield = 75;
            t.emergency = true;
          }
          t.cool = rate;
        }
        continue;
      }
      if (t.kind === "observatory") continue;
      const targets = s.enemies
        .filter((e) => {
          const p = pointOnPath(e.d, s.region);
          return Math.hypot(p.x - t.x, p.y - t.y) < range;
        })
        .sort((a, b) => b.d - a.d);
      if (!targets.length || t.cool > 0) continue;
      t.cool = rate;
      const selected =
        t.kind === "frost" && level >= 3
          ? targets
          : t.kind === "pulse"
          ? targets.filter((e) => {
              const a = pointOnPath(targets[0].d, s.region),
                b = pointOnPath(e.d, s.region);
              return Math.hypot(a.x - b.x, a.y - b.y) < 65 + level * 15;
            })
          : t.kind === "arrow" && level >= 3
          ? targets.slice(0, 3)
          : t.kind === "beam" && level >= 3
          ? targets.slice(0, 2)
          : targets.slice(0, 1);
      for (const e of selected) {
        if (t.kind === "frost") {
          e.slow = level >= 3 ? 3 : 2;
          e.slowFactor = level >= 3 ? 0.05 : 0.55 - 0.1 * (level - 1);
        }
        hit(e, def.damage * (1 + 0.45 * (level - 1)), t.kind === "beam");
        const p = pointOnPath(e.d, s.region);
        s.effects.push({
          x: t.x,
          y: t.y,
          tx: p.x,
          ty: p.y,
          kind: t.kind,
          life: 0.2,
        });
      }
    }
    for (const e of s.enemies) {
      e.slow = Math.max(0, e.slow - dt);
      e.d +=
        pace * e.speed * pressure * (e.slow > 0 ? e.slowFactor || 0.4 : 1) * dt;
      if (e.hp <= 0) {
        s.coins += e.kind === "siege" ? 12 : 3;
        s.kills++;
        s.score += 10;
        event("neutral-defeated", { kind: e.kind });
        continue;
      }
      if (e.d > 1300) {
        s.motorErrors++;
        const damage = e.kind === "siege" ? 20 : 8,
          absorbed = Math.min(s.shield, damage);
        s.shield -= absorbed;
        s.core = Math.max(s.reading > 12 ? 1 : 0, s.core - (damage - absorbed));
        e.hp = 0;
        event("motor-error");
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    if (s.core <= 0) {
      s.status = "recovery";
      event("core-recovery");
    }
    if (s.final && s.finalSpawns >= 2 && !s.enemies.length) {
      s.status = "won";
      event("victory");
    }
  }
  function dispatch(a) {
    if (disposed) return;
    switch (a.type) {
      case "start":
      case "resume":
        if (["ready", "paused"].includes(s.status)) s.status = "playing";
        break;
      case "pause":
        if (s.status === "playing") s.status = "paused";
        break;
      case "motor":
        if (["relaxed", "normal", "arcade"].includes(a.value)) motor = a.value;
        break;
      case "place": {
        if (
          !["ready", "playing", "paused"].includes(s.status) ||
          !Object.hasOwn(TOWERS, a.kind) ||
          !SITES[a.site] ||
          s.towers.some((t) => t.site === a.site) ||
          s.coins < TOWERS[a.kind].cost
        )
          break;
        s.coins -= TOWERS[a.kind].cost;
        s.towers.push({
          ...SITES[a.site],
          site: a.site,
          kind: a.kind,
          level: 1,
          charge: 0,
          active: false,
        });
        s.queue.push(a.site);
        event("blueprint");
        break;
      }
      case "priority":
        if (s.queue.includes(a.site))
          s.queue = [a.site, ...s.queue.filter((n) => n !== a.site)];
        break;
      case "upgrade": {
        const t = s.towers.find((t) => t.site === a.site);
        if (!t?.active || t.level >= 3 || s.coins < t.level * 18) break;
        s.coins -= t.level * 18;
        t.level++;
        event("tower-upgraded");
        break;
      }
      case "revision":
        if (s.status !== "playing" || s.accepted.includes(a.id)) break;
        s.accepted.push(a.id);
        s.accepted = s.accepted.slice(-1000);
        s.reading = 0;
        s.energy += 6;
        s.score += 20;
        {
          const target = s.towers.find((t) => t.site === s.queue[0]);
          if (target)
            s.effects.push({
              kind: "construction",
              x: 450,
              y: 390,
              tx: target.x,
              ty: target.y,
              life: 0.45,
            });
        }
        event("construction-energy");
        break;
      case "region":
        s.region = a.index % REGIONS.length;
        s.enemies = [];
        s.spawn = 1;
        break;
      case "final":
        s.final = true;
        s.finalSpawns = 0;
        s.spawn = 0;
        break;
      case "ability":
        if (
          s.status !== "playing" ||
          !(a.name in s.cooldowns) ||
          s.cooldowns[a.name] > 0
        )
          break;
        s.cooldowns[a.name] = a.name === "shield" ? 20 : 15;
        if (a.name === "shield") s.shield = Math.min(75, s.shield + 35);
        if (a.name === "overcharge") s.overcharge = 6;
        if (a.name === "frost")
          for (const e of s.enemies) {
            e.slow = 5;
            e.slowFactor = 0.15;
          }
        event("ability", { name: a.name });
        break;
      case "recover":
        if (s.status === "recovery") {
          s.core = 60;
          s.shield = 35;
          s.enemies = [];
          s.spawn = 3;
          s.status = "playing";
        }
        break;
      case "tick":
        if (s.status === "playing") {
          acc += Math.min(Math.max(a.dt || 0, 0), 0.2);
          while (acc >= 1 / 60) {
            tick(1 / 60);
            acc -= 1 / 60;
            if (s.status !== "playing") break;
          }
        }
        break;
    }
    while (s.energy > 0 && s.queue.length) {
      const t = s.towers.find((t) => t.site === s.queue[0]),
        efficiency = s.towers
          .filter(
            (o) =>
              o.active &&
              o.kind === "observatory" &&
              Math.hypot(o.x - t.x, o.y - t.y) <
                190 * (1 + 0.12 * (o.level - 1))
          )
          .reduce((n, o) => n + o.level * 0.2, 1),
        cost = Math.ceil(TOWERS[t.kind].energy / efficiency),
        need = Math.max(0, cost - t.charge),
        amount = Math.min(need, s.energy);
      t.charge += amount;
      s.energy -= amount;
      if (t.charge >= cost) {
        t.active = true;
        t.builtAt = s.time;
        s.effects.push({
          kind: "build",
          x: t.x,
          y: t.y,
          tx: t.x,
          ty: t.y,
          life: 0.55,
        });
        s.queue.shift();
        event("tower-built", { site: t.site });
      } else break;
    }
  }
  return {
    start: () => dispatch({ type: "start" }),
    pause: () => dispatch({ type: "pause" }),
    resume: () => dispatch({ type: "resume" }),
    dispatch,
    getSnapshot: () => structuredClone(s),
    checkpoint: () => ({
      ...structuredClone(s),
      enemies: [],
      effects: [],
      accepted: s.accepted.slice(-1000),
    }),
    dispose() {
      disposed = true;
      s.status = "disposed";
      s.enemies = [];
      s.effects = [];
    },
  };
}
