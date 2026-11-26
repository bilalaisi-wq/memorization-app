import { wavePlan, ENEMY_ROSTER } from "./defense-waves.js";
import {
  mapFor,
  pathLength,
  pathPoint,
  placementCheck,
  legalPositions,
} from "./defense-maps.js";
export const TOWERS = {
  arrow: {
    name: "Arrow",
    cost: 50,
    energy: 6,
    range: 160,
    rate: 0.5,
    damage: 5,
  },
  frost: {
    name: "Frost",
    cost: 90,
    energy: 6,
    range: 140,
    rate: 1.4,
    damage: 1,
  },
  beam: {
    name: "Beam",
    cost: 130,
    energy: 8,
    range: 180,
    rate: 0.15,
    damage: 2,
  },
  pulse: {
    name: "Pulse",
    cost: 160,
    energy: 8,
    range: 120,
    rate: 1.8,
    damage: 9,
  },
  guardian: {
    name: "Guardian",
    cost: 180,
    energy: 6,
    range: 155,
    rate: 2,
    damage: 0,
  },
  observatory: {
    name: "Observatory",
    cost: 200,
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
// One complete, pure purchase rule for preview, pointer release and engine commit.
export function purchaseCheck(state, kind, position) {
  if (!Object.hasOwn(TOWERS, kind))
    return { valid: false, reason: "Choose a tower." };
  if (!["ready", "playing", "paused"].includes(state.status))
    return { valid: false, reason: "Repair the fortress before building." };
  if (state.towers.length >= 24)
    return {
      valid: false,
      reason: "This battlefield has its maximum 24 towers.",
    };
  if (state.energy < TOWERS[kind].cost)
    return {
      valid: false,
      reason: `Need ${TOWERS[kind].cost} Construction Points.`,
    };
  if (
    !TOWERS[kind].damage &&
    !state.towers.some((t) => TOWERS[t.kind].damage > 0)
  )
    return {
      valid: false,
      reason: "Build an attacking tower before support towers.",
    };
  return placementCheck(state.map, position, state.towers);
}
export function towerRange(kind, position, level = 1, towers = []) {
  const base = TOWERS[kind].range * (1 + 0.12 * (level - 1));
  if (kind === "observatory") return base;
  const boost = towers
    .filter(
      (t) =>
        t.active &&
        t.kind === "observatory" &&
        Math.hypot(t.x - position.x, t.y - position.y) <
          190 * (1 + 0.12 * (t.level - 1))
    )
    .reduce((n, t) => n + t.level, 0);
  return TOWERS[kind].range * (1 + 0.12 * (level - 1) + boost * 0.12);
}
export function openingPace(
  state,
  { openingSeconds = 30, rampSeconds = 60 } = {}
) {
  const armed = state.towers.some((t) => TOWERS[t.kind].damage > 0),
    grace = !armed || state.time < openingSeconds;
  const age = armed
    ? Math.max(
        0,
        state.time - Math.max(openingSeconds, state.firstBuiltAt ?? state.time)
      )
    : 0;
  const ramp = Math.min(1, age / rampSeconds);
  return {
    grace,
    ramp,
    multiplier: grace ? 0.2 : state.reading > 12 ? 0.28 : 0.4 + 0.6 * ramp,
  };
}
export function defensePath(map = 0, lane = 0) {
  return mapFor(map).paths[lane % mapFor(map).paths.length];
}
export function pointOnPath(distance, map = 0, lane = 0) {
  return pathPoint(distance, defensePath(map, lane));
}
export function migrateDefenseCheckpoint(old) {
  if (!old || old.version === 2) return old;
  const next = {
    ...structuredClone(old),
    version: 2,
    map: 0,
    tourMaps: false,
    earnedByRef: {},
    totalEarned: 0,
    nextEnemyId: 0,
    nextTowerId: 0,
    firstBuiltAt: old.towers.some((t) => t.active) ? 0 : null,
    accepted: [...old.accepted],
    towers: [],
    queue: [],
    legacy: true,
  };
  for (const t of old.towers) {
    const paid = {
      arrow: 8,
      frost: 10,
      beam: 12,
      pulse: 12,
      guardian: 10,
      observatory: 10,
    }[t.kind];
    if (t.active && placementCheck(0, t, next.towers).valid)
      next.towers.push({
        ...t,
        id: ++next.nextTowerId,
        active: true,
        paidCost: paid + (t.charge || 0),
        upgradeSpend: (18 * (t.level - 1) * t.level) / 2,
        targeting: "first",
      });
    else {
      next.energy += paid + (t.charge || 0);
      next.coins += (18 * (t.level - 1) * t.level) / 2;
    }
  }
  next.firstBuiltAt = next.towers.some((t) => TOWERS[t.kind].damage > 0)
    ? 0
    : null;
  return next;
}
export function createAyahDefense({
  motor = "relaxed",
  restore = null,
  map = 0,
  tourMaps = false,
  onEvent = () => {},
} = {}) {
  let disposed = false,
    serial = 0,
    acc = 0;
  const s = {
    version: 2,
    wavePlannerVersion: restore ? restore.wavePlannerVersion || 3 : 4,
    waveState: null,
    map,
    originMap: map,
    tourMaps,
    earnedByRef: {},
    totalEarned: 0,
    nextEnemyId: 0,
    nextTowerId: 0,
    firstBuiltAt: null,
    status: "ready",
    time: 0,
    coins: 0,
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
    ...structuredClone(migrateDefenseCheckpoint(restore) || {}),
  };
  s.enemies =
    s.wavePlannerVersion === 4 ? structuredClone(restore?.enemies || []) : [];
  s.effects = [];
  s.status = "ready";
  s.reading = 0;
  serial = s.nextEnemyId;
  const event = (type, data = {}) => onEvent({ type, ...data });
  function hit(e, damage, pierce = false) {
    if (e.shield > 0 && !pierce) {
      const amount = Math.min(e.shield, damage);
      e.shield -= amount;
      damage -= amount;
    }
    const escorted = s.enemies.some(
      (o) =>
        o.id !== e.id &&
        o.kind === "rover" &&
        o.hp > 0 &&
        Math.abs(o.d - e.d) < 80 &&
        o.lane === e.lane
    );
    if (damage > 0)
      e.hp -= Math.max(
        0.25,
        damage - (pierce ? 0 : (e.armor || 0) + (escorted ? 1 : 0))
      );
  }
  function tick(dt) {
    s.time += dt;
    s.reading += dt;
    for (const k of Object.keys(s.cooldowns))
      s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
    s.overcharge = Math.max(0, s.overcharge - dt);
    s.effects = s.effects.filter((e) => (e.life -= dt) > 0);
    const { grace, ramp, multiplier: pressure } = openingPace(s),
      pace = { relaxed: 34, normal: 48, arcade: 64 }[motor];
    if (s.wavePlannerVersion === 4) {
      if (!s.waveState) {
        s.wave = Math.max(1, s.wave);
        s.waveState = { number: s.wave, spawned: 0, elapsed: 0 };
        event("wave-start", { wave: s.wave });
      }
      const plan = wavePlan(s.waveState.number, { motor, map: s.map }),
        limit = s.final ? 2 : plan.count;
      s.waveState.elapsed += dt;
      s.spawn -= dt;
      if (
        s.spawn <= 0 &&
        s.waveState.spawned < limit &&
        s.enemies.length < (grace ? 4 : s.reading > 12 ? 5 : 24)
      ) {
        const blueprint =
          plan.enemies[s.waveState.spawned % plan.enemies.length];
        s.nextEnemyId = ++serial;
        s.enemies.push({
          ...blueprint,
          id: serial,
          lane: serial % mapFor(s.map).paths.length,
          maxHp: blueprint.hp,
          d: 0,
          slow: 0,
        });
        s.waveState.spawned++;
        if (s.final) s.finalSpawns++;
        s.spawn = plan.interval * (grace ? 1 : s.reading > 12 ? 1.5 : 1);
      }
      if (s.waveState.spawned >= limit && !s.enemies.length && !s.final) {
        event("wave-complete", { wave: s.wave });
        s.wave++;
        s.waveState = { number: s.wave, spawned: 0, elapsed: 0 };
        s.spawn = 3;
      }
    } else {
      s.spawn -= dt;
      if (
        s.spawn <= 0 &&
        s.enemies.length < (grace ? 4 : s.reading > 12 ? 5 : 12) &&
        (!s.final || s.finalSpawns < 2)
      ) {
        const types = Object.keys(ENEMIES),
          kind =
            s.final && !grace
              ? "siege"
              : types[
                  s.wave %
                    Math.min(
                      types.length,
                      1 + Math.floor(ramp * 4) + Math.floor(s.wave / 8)
                    )
                ],
          e = ENEMIES[kind];
        s.nextEnemyId = ++serial;
        s.enemies.push({
          id: serial,
          lane: serial % mapFor(s.map).paths.length,
          kind,
          ...e,
          maxHp: e.hp,
          d: 0,
          slow: 0,
        });
        if (kind === "swarm" && s.enemies.length < 8)
          s.enemies.push({
            id: ++serial,
            lane: serial % mapFor(s.map).paths.length,
            kind,
            ...e,
            maxHp: e.hp,
            d: -25,
            slow: 0,
          });
        s.nextEnemyId = serial;
        s.spawn =
          (grace ? 1.1 : motor === "arcade" ? 2.8 : 4.8) /
          (grace ? 1 : pressure);
        s.wave++;
        if (s.final) s.finalSpawns++;
      }
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
        range = towerRange(t.kind, t, level, s.towers),
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
            const p = pointOnPath(e.d, s.map, e.lane);
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
          const p = pointOnPath(e.d, s.map, e.lane);
          return Math.hypot(p.x - t.x, p.y - t.y) < range;
        })
        .sort((a, b) =>
          t.targeting === "last"
            ? a.d - b.d
            : t.targeting === "strongest"
            ? b.hp - a.hp
            : t.targeting === "nearest"
            ? Math.hypot(
                pointOnPath(a.d, s.map, a.lane).x - t.x,
                pointOnPath(a.d, s.map, a.lane).y - t.y
              ) -
              Math.hypot(
                pointOnPath(b.d, s.map, b.lane).x - t.x,
                pointOnPath(b.d, s.map, b.lane).y - t.y
              )
            : b.d / pathLength(defensePath(s.map, b.lane)) -
              a.d / pathLength(defensePath(s.map, a.lane))
        );
      if (!targets.length || t.cool > 0) continue;
      t.cool = rate;
      const selected =
        t.kind === "frost" && level >= 3
          ? targets
          : t.kind === "pulse"
          ? targets.filter((e) => {
              const a = pointOnPath(targets[0].d, s.map, targets[0].lane),
                b = pointOnPath(e.d, s.map, e.lane);
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
        const p = pointOnPath(e.d, s.map, e.lane);
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
        pace *
        e.speed *
        pressure *
        (e.slow > 0
          ? Math.max(
              ENEMY_ROSTER[e.kind]?.slowResistance || 0,
              e.slowFactor || 0.4
            )
          : 1) *
        dt;
      if (e.hp <= 0) {
        s.coins += ["siege", "tank"].includes(e.kind)
          ? 12
          : ["boulder", "rover"].includes(e.kind)
          ? 6
          : 3;
        const pop = pointOnPath(e.d, s.map, e.lane);
        s.effects.push({
          kind: "pop",
          x: pop.x,
          y: pop.y,
          tx: pop.x,
          ty: pop.y,
          life: 0.35,
        });
        s.kills++;
        s.score += 10;
        event("neutral-defeated", { kind: e.kind });
        continue;
      }
      const length = pathLength(defensePath(s.map, e.lane));
      if (grace) e.d = Math.min(e.d, length * 0.72);
      if (e.d >= length) {
        s.motorErrors++;
        const damage = ["siege", "tank"].includes(e.kind)
            ? 20
            : e.kind === "boulder"
            ? 12
            : 8,
          absorbed = Math.min(s.shield, damage);
        s.shield -= absorbed;
        s.core = Math.max(
          grace || s.reading > 12 ? 1 : 0,
          s.core - (damage - absorbed)
        );
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
        const position =
          a.position || (a.site !== undefined ? SITES[a.site] : null);
        const check = purchaseCheck(s, a.kind, position);
        if (!check.valid) {
          event("invalid-placement", check);
          break;
        }
        s.energy -= TOWERS[a.kind].cost;
        const t = {
          ...position,
          id: ++s.nextTowerId,
          kind: a.kind,
          level: 1,
          charge: 0,
          active: true,
          paidCost: TOWERS[a.kind].cost,
          upgradeSpend: 0,
          targeting: "first",
          builtAt: s.time,
        };
        s.towers.push(t);
        if (s.firstBuiltAt === null) s.firstBuiltAt = s.time;
        s.effects.push({
          kind: "build",
          x: t.x,
          y: t.y,
          tx: t.x,
          ty: t.y,
          life: 0.6,
        });
        event("tower-built", { id: t.id });
        break;
      }
      case "targeting": {
        const t = s.towers.find((t) => t.id === a.id);
        if (t && ["first", "last", "strongest", "nearest"].includes(a.value))
          t.targeting = a.value;
        break;
      }
      case "map": {
        const next = mapFor(a.value),
          index = Number.isInteger(a.value) ? a.value : 0;
        if (index < 0 || index > 3) break;
        let points = 0,
          coins = 0;
        const kept = [];
        for (const t of s.towers) {
          if (placementCheck(index, t, kept).valid) kept.push(t);
          else {
            points += t.paidCost || 0;
            coins += t.upgradeSpend || 0;
          }
        }
        s.towers = kept;
        if (!kept.some((t) => TOWERS[t.kind].damage > 0)) s.firstBuiltAt = null;
        s.energy += points;
        s.coins += coins;
        s.map = index;
        s.enemies = [];
        s.spawn = 3;
        event("map-transfer", { points, coins });
        break;
      }
      case "upgrade": {
        const t = s.towers.find(
          (t) => t.id === a.id || (a.site !== undefined && t.site === a.site)
        );
        if (!t?.active || t.level >= 3 || s.coins < t.level * 18) break;
        s.coins -= t.level * 18;
        t.upgradeSpend = (t.upgradeSpend || 0) + t.level * 18;
        t.builtAt = s.time;
        t.level++;
        s.effects.push({
          kind: "build",
          x: t.x,
          y: t.y,
          tx: t.x,
          ty: t.y,
          life: 0.6,
        });
        event("tower-upgraded");
        break;
      }
      case "revision":
        if (s.status !== "playing" || s.accepted.includes(a.id)) break;
        if (
          typeof a.id !== "string" ||
          a.id.length > 100 ||
          !/^\d+:\d+:\d+-\d+(?::review)?$/.test(a.id)
        )
          break;
        if (
          a.points !== undefined &&
          (!Number.isInteger(a.points) || a.points < 0 || a.points > 20)
        )
          break;
        s.accepted.push(a.id);
        s.reading = 0;
        const ref = a.id.split(":").slice(0, 2).join(":"),
          prior = s.earnedByRef[ref] || 0;
        let earned =
          a.points === 0
            ? 0
            : Math.min(
                80 - prior,
                Math.max(1, Math.min(20, Math.floor(a.points || 10)))
              );
        // A tiny selected passage still earns its first defense through genuine completion.
        if (a.lastSource && a.points !== 0 && s.totalEarned + earned < 50)
          earned = 50 - s.totalEarned;
        s.earnedByRef[ref] = prior + earned;
        s.energy += earned;
        s.totalEarned += earned;
        if (earned > 0) s.score += 20;
        s.effects.push({
          kind: "construction",
          x: 450,
          y: 490,
          tx: 850,
          ty: 245,
          life: 0.45,
        });
        event("construction-energy");
        break;
      case "region":
        s.region = a.index % REGIONS.length;
        if (s.tourMaps)
          dispatch({
            type: "map",
            value: ((s.originMap ?? 0) + Math.floor(a.index)) % 4,
          });
        s.enemies = [];
        s.spawn = 1;
        break;
      case "final":
        if (s.final) break;
        s.final = true;
        s.finalSpawns = 0;
        if (s.wavePlannerVersion === 4)
          s.waveState = { number: Math.max(1, s.wave), spawned: 0, elapsed: 0 };
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
  }

  return {
    start: () => dispatch({ type: "start" }),
    pause: () => dispatch({ type: "pause" }),
    resume: () => dispatch({ type: "resume" }),
    dispatch,
    getSnapshot: () => structuredClone(s),
    getFrame: () => structuredClone({ ...s, accepted: [], earnedByRef: {} }),
    checkpoint: () => ({
      ...structuredClone(s),
      enemies: s.wavePlannerVersion === 4 ? structuredClone(s.enemies) : [],
      effects: [],
      accepted: [...s.accepted],
    }),
    dispose() {
      disposed = true;
      s.status = "disposed";
      s.enemies = [];
      s.effects = [];
    },
  };
}
