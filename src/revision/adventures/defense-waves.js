// Neutral game objects only. No Qur'anic wording participates in combat.
export const ENEMY_ROSTER = {
  walker: {
    name: "Basic balloon",
    family: "balloon",
    hp: 22,
    speed: 1,
    armor: 0,
    cost: 1,
  },
  scout: {
    name: "Swift balloon",
    family: "balloon",
    hp: 16,
    speed: 1.65,
    armor: 0,
    cost: 1.3,
  },
  shielded: {
    name: "Layered balloon",
    family: "balloon",
    hp: 36,
    speed: 0.9,
    armor: 0,
    shield: 20,
    cost: 2,
  },
  armored: {
    name: "Reinforced balloon",
    family: "balloon",
    hp: 60,
    speed: 0.78,
    armor: 2.2,
    cost: 2.8,
  },
  boulder: {
    name: "Rolling boulder",
    family: "boulder",
    hp: 125,
    speed: 0.56,
    armor: 3.4,
    cost: 5,
    slowResistance: 0.35,
  },
  rover: {
    name: "Armored rover",
    family: "rover",
    hp: 115,
    speed: 0.95,
    armor: 3,
    cost: 6,
    escort: true,
  },
  tank: {
    name: "Siege tank",
    family: "tank",
    hp: 320,
    speed: 0.5,
    armor: 5,
    cost: 12,
    slowResistance: 0.55,
  },
};
export function wavePlan(
  number,
  { motor = "relaxed", map = 0, seed = 1 } = {}
) {
  const wave = Math.max(1, Math.min(10000, Math.floor(number))),
    late = Math.max(0, wave - 3);
  const scale = wave <= 3 ? 1 : 1 + late * 0.2 + late * late * 0.012;
  const count = wave <= 3 ? wave + 2 : Math.min(24, 6 + Math.floor(late * 1.2));
  const unlocked = [
    "walker",
    ...(wave >= 2 ? ["scout"] : []),
    ...(wave >= 3 ? ["shielded"] : []),
    ...(wave >= 4 ? ["armored"] : []),
    ...(wave >= 6 ? ["boulder"] : []),
    ...(wave >= 8 ? ["rover"] : []),
  ];
  const kinds = Array.from(
    { length: count },
    (_, i) => unlocked[(i + wave + ((seed >>> 0) % 7)) % unlocked.length]
  );
  if (wave >= 10) kinds[kinds.length - 1] = "tank";
  // A real wave budget: composition, durability, density and speed all contribute.
  const health = scale * (1 + map * 0.035),
    speed = 1 + Math.min(0.55, late * 0.025),
    interval = Math.max(0.65, 3.2 - late * 0.12);
  const enemies = kinds.map((kind) => ({
    ...ENEMY_ROSTER[kind],
    kind,
    hp: Math.round(ENEMY_ROSTER[kind].hp * health),
    shield: Math.round((ENEMY_ROSTER[kind].shield || 0) * health),
    speed: ENEMY_ROSTER[kind].speed * speed,
    armor: ENEMY_ROSTER[kind].armor * (1 + late * 0.025),
  }));
  const threat =
    enemies.reduce(
      (n, e) => n + (e.hp + (e.shield || 0)) * (1 + e.armor * 0.1) * e.speed,
      0
    ) / interval;
  return {
    version: 4,
    number: wave,
    motor,
    map,
    seed,
    count,
    interval,
    health,
    speed,
    threat,
    enemies,
  };
}
