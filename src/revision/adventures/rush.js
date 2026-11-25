export function terrain(x, course = 0) {
  const gap = [
    [340, 430],
    [420, 490],
    [370, 475],
  ][course % 3];
  if (x >= gap[0] && x < gap[1]) return null;
  if (x < 180) return 330;
  if (x < 300) return 330 + (x - 180) * 0.28;
  if (x < 550) return 364 - (x - 300) * 0.18;
  if (x < 850) return 319;
  return 319 + (x - 850) * 0.08;
}
export function createSurahRush({
  motor = "relaxed",
  restore = null,
  onEvent = () => {},
} = {}) {
  let disposed = false,
    acc = 0;
  const s = {
    status: "ready",
    x: 60,
    y: 310,
    vx: 0,
    vy: 0,
    direction: 0,
    grounded: true,
    coyote: 0.12,
    jumpBuffer: 0,
    slide: false,
    dash: 0,
    cooldown: 0,
    spring: 0,
    rail: false,
    loop: null,
    camera: 0,
    choice: null,
    gateOpen: false,
    holding: false,
    flow: 0,
    score: 0,
    motorErrors: 0,
    course: 0,
    distance: 0,
    final: false,
    route: null,
    ...structuredClone(restore || {}),
  };
  s.status = "ready";
  s.direction = 0;
  function recover() {
    s.x = [450, 510, 495][s.course % 3];
    s.y = 280;
    s.vx = 0;
    s.vy = 0;
    s.motorErrors++;
    s.loop = null;
    onEvent({ type: "motor-error" });
  }
  function tick(dt) {
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.dash = Math.max(0, s.dash - dt);
    s.spring = Math.max(0, s.spring - dt);
    s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
    s.coyote = s.grounded ? 0.12 : Math.max(0, s.coyote - dt);
    if (s.loop) {
      s.loop.angle += Math.max(1.5, Math.abs(s.vx) / 60) * dt;
      s.x = s.loop.cx + Math.cos(s.loop.angle) * 58;
      s.y = 250 + Math.sin(s.loop.angle) * 58;
      if (s.loop.angle >= Math.PI * 2) {
        s.loop = null;
        s.x = 1080;
        s.y = 290;
        s.vx = 300;
      }
      return;
    }
    const max =
        { relaxed: 240, normal: 330, arcade: 430 }[motor] *
        (1 + Math.min(6, s.flow) * 0.035),
      acceleration = s.grounded ? 1050 : 550;
    if (s.direction)
      s.vx = Math.max(
        -max,
        Math.min(max, s.vx + s.direction * acceleration * dt)
      );
    else s.vx *= Math.max(0, 1 - (s.grounded ? 7 : 1) * dt);
    if (s.dash > 0) s.vx = Math.max(s.vx, max * 1.65);
    if (s.slide && s.grounded) s.vx *= 1 + dt * 0.12;
    const ground = terrain(s.x, s.course),
      ahead = terrain(s.x + 2, s.course);
    if (s.grounded && ground !== null && ahead !== null)
      s.vx += (ahead - ground) * dt * 120;
    if (s.jumpBuffer > 0 && s.coyote > 0) {
      s.vy = -440;
      s.grounded = false;
      s.coyote = 0;
      s.jumpBuffer = 0;
      onEvent({ type: "jump" });
    }
    if (
      motor !== "relaxed" &&
      !s.slide &&
      s.grounded &&
      s.x >= 185 &&
      s.x < 265 &&
      s.y > terrain(s.x, s.course) - 45
    ) {
      s.vx = Math.min(0, s.vx);
      s.x = 185;
      if (!s.roofBump) {
        s.motorErrors++;
        onEvent({ type: "motor-error" });
      }
      s.roofBump = true;
    } else s.roofBump = false;
    const previousX = s.x,
      previousY = s.y;
    s.x = Math.max(20, s.x + s.vx * dt);
    s.vy += 1080 * dt;
    s.y += s.vy * dt;
    const floor = terrain(s.x, s.course);
    s.grounded = false;
    if (
      floor !== null &&
      s.y >= floor - 18 &&
      previousY <= floor + 12 &&
      s.vy >= 0
    ) {
      s.y = floor - 18;
      s.vy = 0;
      s.grounded = true;
    }
    const springX = [525, 585, 520][s.course % 3];
    if (
      s.x >= springX &&
      previousX < springX + 27 &&
      s.grounded &&
      s.spring <= 0
    ) {
      s.vy = -570;
      s.grounded = false;
      s.spring = 1.2;
      onEvent({ type: "spring" });
    }
    if (!s.gateOpen && s.x >= 730) {
      s.x = 730;
      s.vx = 0;
      s.y = 301;
      s.vy = 0;
      s.grounded = true;
      if (s.choice !== null) {
        const choice = s.choice;
        s.choice = null;
        onEvent({ type: "route-committed", choice });
      }
    }
    if (s.gateOpen && s.route === 2 && s.x > 945 && s.x < 1020 && s.grounded) {
      s.loop = { cx: 1020, angle: Math.PI };
      s.vx = Math.max(220, s.vx);
      s.rail = true;
      onEvent({ type: "rail" });
    }
    if (s.y > 650) recover();
    s.camera = Math.max(0, Math.min(480, s.x - 240));
    if (s.x >= 1260) {
      s.distance += 1260;
      s.course++;
      if (s.final) {
        s.status = "won";
        onEvent({ type: "victory" });
      } else {
        s.x = 60;
        s.y = 310;
        s.vx = Math.min(200, s.vx);
        s.camera = 0;
        s.gateOpen = false;
        s.route = null;
        s.holding = true;
        onEvent({ type: "section-finished" });
      }
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
        s.direction = 0;
        break;
      case "motor":
        if (["relaxed", "normal", "arcade"].includes(a.value)) motor = a.value;
        break;
      case "move":
        s.direction = Math.sign(a.direction);
        break;
      case "jump":
        if (s.loop) {
          s.loop = null;
          s.vy = -420;
        }
        s.jumpBuffer = 0.14;
        break;
      case "slide":
        s.slide = !!a.active;
        break;
      case "dash":
        if (s.cooldown <= 0 && s.status === "playing") {
          s.dash = 0.45;
          s.cooldown = 2;
          onEvent({ type: "dash" });
        }
        break;
      case "route":
        if (
          s.status === "playing" &&
          !s.gateOpen &&
          !s.holding &&
          Number.isInteger(a.index)
        )
          s.choice = a.index;
        break;
      case "correct":
        s.gateOpen = true;
        s.route = a.index;
        s.flow++;
        s.score += 20 + Math.min(6, s.flow) * 5;
        s.vx = 220;
        if (a.index === 1) {
          s.vy = -420;
          s.grounded = false;
        }
        if (a.index === 0) s.dash = 0.7;
        s.holding = false;
        break;
      case "wrong":
        s.flow = 0;
        s.x = 620;
        s.vx = 0;
        s.choice = null;
        break;
      case "next":
        s.holding = false;
        break;
      case "final":
        s.final = true;
        break;
      case "tick":
        if (s.status === "playing" && !s.holding) {
          acc += Math.min(0.2, Math.max(0, a.dt || 0));
          while (acc >= 1 / 120) {
            tick(1 / 120);
            acc -= 1 / 120;
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
    checkpoint: () => ({ ...structuredClone(s), loop: null, direction: 0 }),
    dispose() {
      disposed = true;
      s.status = "disposed";
    },
  };
}
