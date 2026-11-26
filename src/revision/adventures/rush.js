import {
  STRIDE,
  MOTOR_PROFILES,
  coursePlan,
  platformY,
} from "./rush-course.js";
export { STRIDE, MOTOR_PROFILES, coursePlan } from "./rush-course.js";
// Compatibility export for legacy callers; active gameplay uses streamed platform surfaces.
export function terrain(x, course = 0) {
  return 418 + Math.sin((x + course * 91) / 100) * 12;
}
export function migrateRushCheckpoint(old, completed = 0) {
  if (!old) return null;
  if (old.version === 3) return structuredClone(old);
  const course = Number.isSafeInteger(old.course) ? old.course : completed;
  return {
    version: 3,
    challenge: null,
    pendingChallenge: null,
    resolved: false,
    checkpointPending: false,
    x: course * STRIDE + 60,
    y: 400,
    vx: 0,
    vy: 0,
    course,
    time: old.time || 0,
    score: old.score || 0,
    flow: old.flow || 0,
    motorErrors: old.motorErrors || 0,
    distance: old.distance || 0,
    zone: Math.floor(completed / 25) % 5,
    camera: Math.max(0, course * STRIDE - 200),
    cameraY: 60,
    legacyAdapted: true,
  };
}
export function createSurahRush({
  motor = "normal",
  restore = null,
  seed = 1,
  onEvent = () => {},
} = {}) {
  let disposed = false,
    acc = 0,
    cache = new Map();
  const s = {
    version: 3,
    status: "ready",
    x: 60,
    y: 400,
    vx: 0,
    vy: 0,
    direction: 0,
    grounded: true,
    support: null,
    coyote: 0.12,
    jumpBuffer: 0,
    slide: false,
    drop: 0,
    dash: 0,
    cooldown: 0,
    spring: 0,
    loop: null,
    camera: 0,
    cameraY: 80,
    viewWidth: 1000,
    viewHeight: 640,
    course: 0,
    zone: 0,
    flow: 0,
    score: 0,
    time: 0,
    distance: 0,
    motorErrors: 0,
    challenge: null,
    pendingChallenge: null,
    resolved: false,
    committed: false,
    awaiting: false,
    detour: false,
    holding: true,
    final: false,
    route: null,
    feedback: 0,
    checkpointPending: false,
    safe: { x: 60, y: 400 },
    ...migrateRushCheckpoint(restore),
  };
  s.status = "ready";
  s.direction = 0;
  s.loop = null;
  s.jumpBuffer = 0;
  s.support = null;
  s.grounded = false;
  const event = (type, data = {}) => onEvent({ type, ...data });
  function plan(index = s.course) {
    const key = `${index}:${motor}:${s.zone}:${s.challenge?.count || 3}`;
    if (!cache.has(key))
      cache.set(
        key,
        coursePlan(index, {
          motor,
          seed,
          zone: s.zone,
          count: s.challenge?.count || 3,
        })
      );
    return cache.get(key);
  }
  function surface(p, x, time) {
    if (p.rotating)
      return (
        p.y +
        (x - (p.a + p.b) / 2) * Math.sin((time * Math.PI * 2) / p.period) * 0.3
      );
    if (p.slope) return p.y + ((x - p.a) / (p.b - p.a)) * (p.toY - p.y);
    if (p.ground && x - p.a < 430)
      return (
        p.y +
        Math.sin((x - p.a) / 100) *
          12 *
          Math.sin((Math.min(1, (430 - x + p.a) / 100) * Math.PI) / 2)
      );
    return platformY(p, time);
  }
  function surfaces() {
    const p = plan(),
      list = [
        ...p.platforms,
        {
          id: `${s.course}:lower-exit`,
          a: p.start + 1260,
          b: p.start + 1590,
          y: p.lower,
          toY: p.middle,
          slope: true,
        },
      ];
    if (s.detour)
      return [
        {
          id: "detour",
          a: p.start + 1080,
          b: p.end + 60,
          y: 630,
          gap: motor === "relaxed" ? null : p.detour.gap,
        },
        { id: "detour-step", a: p.start + 1410, b: p.end + 90, y: 552 },
        { id: "detour-return", a: p.end - 70, b: p.end + 200, y: 480 },
      ];
    return list;
  }
  function motorRecover() {
    const p = plan();
    s.x = Math.max(p.start + 30, s.safe.x);
    s.y = s.safe.y;
    s.vx = 0;
    s.vy = 0;
    s.loop = null;
    s.grounded = false;
    s.motorErrors++;
    event("motor-error");
  }
  function enterNext(retry = false) {
    s.course++;
    s.resolved = false;
    s.committed = false;
    s.awaiting = false;
    s.detour = false;
    s.route = null;
    s.loop = null;
    if (!retry) {
      s.challenge = s.pendingChallenge;
      s.pendingChallenge = null;
    }
    s.holding = !s.challenge;
    s.safe = { x: s.course * STRIDE + 40, y: 400 };
    // Recovery joins the next approach through a visible return spring. Normal exits
    // preserve x, velocity and camera; only a fallen recovery traveler is lifted safely.
    if (s.y > 470) {
      s.y = 400;
      s.vy = -220;
      event("return-spring");
    }
    for (const [key, p] of cache)
      if (p.index < s.course - 1 || p.index > s.course + 2) cache.delete(key);
    event(retry ? "retry-junction" : "section-finished", { course: s.course });
  }
  function tick(dt) {
    const p = plan(),
      profile = MOTOR_PROFILES[motor];
    s.time += dt;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.dash = Math.max(0, s.dash - dt);
    s.spring = Math.max(0, s.spring - dt);
    s.drop = Math.max(0, s.drop - dt);
    s.feedback = Math.max(0, s.feedback - dt);
    s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
    s.coyote = s.grounded ? 0.12 : Math.max(0, s.coyote - dt);
    if (s.loop) {
      const loop = s.loop;
      s.loop.angle += Math.max(2.5, Math.abs(s.vx) / loop.r) * dt;
      s.x = loop.cx + Math.cos(loop.angle) * loop.r;
      s.y = loop.cy + Math.sin(loop.angle) * loop.r - 18;
      if (loop.angle >= loop.until) {
        s.loop = null;
        s.x = loop.cx + loop.r + 22;
        s.y = p.middle - 18;
        s.vx = Math.max(240, s.vx);
        s.grounded = true;
        event("loop-finished");
      }
    } else {
      if (s.jumpBuffer > 0 && (s.coyote > 0 || s.wall)) {
        s.vy = -profile.jump;
        s.grounded = false;
        s.support = null;
        s.coyote = 0;
        s.jumpBuffer = 0;
        event(s.wall ? "wall-jump" : "jump");
      }
      const oldX = s.x,
        oldFeet = s.y + 18,
        wasGrounded = s.grounded;
      const reading = (s.challenge?.length || 0) > 22 ? 0.72 : 1;
      let max =
        profile.speed * (s.dash > 0 ? 1.65 : 1) * (s.feedback > 0 ? 1.15 : 1);
      if (!s.resolved && !s.detour && s.x > p.start + 440)
        max = Math.min(max, Math.min(350, profile.speed) * reading);
      if (s.direction)
        s.vx = Math.max(
          -max,
          Math.min(
            max,
            s.vx +
              s.direction *
                (wasGrounded
                  ? profile.acceleration
                  : profile.acceleration * 0.6) *
                dt
          )
        );
      else s.vx *= Math.max(0, 1 - (wasGrounded ? 7 : 1.2) * dt);
      const oldSupport = surfaces().find((v) => v.id === s.support);
      if (wasGrounded && oldSupport) {
        if (oldSupport.conveyor) s.vx += oldSupport.conveyor * dt;
        const delta =
          surface(oldSupport, s.x + 2, s.time) -
          surface(oldSupport, s.x, s.time);
        s.vx += delta * dt * 140;
      }
      s.x = Math.max(p.start + 18, s.x + s.vx * dt);
      s.vy += 1500 * dt;
      if (s.zone === 2 && s.slide && s.vy > 120) s.vy = 120; // Learner-controlled sky glide.
      s.y += s.vy * dt;
      s.grounded = false;
      s.wall = false;
      let landing = null;
      for (const platform of surfaces()) {
        if (
          s.x < platform.a - 8 ||
          s.x > platform.b + 8 ||
          (platform.gap && s.x > platform.gap[0] && s.x < platform.gap[1])
        )
          continue;
        if (s.drop > 0 && platform.route !== 2 && !platform.safety && !s.detour)
          continue;
        const y = surface(platform, s.x, s.time),
          oldFloor = surface(platform, oldX, s.time - dt);
        const riding = wasGrounded && s.support === platform.id;
        if (
          s.vy >= 0 &&
          (oldFeet <= Math.max(y, oldFloor) + 10 || riding) &&
          s.y + 18 >= y &&
          (landing === null || y < landing.y)
        )
          landing = { platform, y };
      }
      if (landing) {
        s.y = landing.y - 18;
        s.vy = 0;
        s.grounded = true;
        s.support = landing.platform.id;
        if (landing.platform.safety) {
          motorRecover();
        } else if (s.x < p.start + 1000 && !s.detour)
          s.safe = { x: s.x, y: s.y };
      } else s.support = null;
      for (const barrier of p.barriers) {
        if (
          !s.detour &&
          !s.slide &&
          s.x + 15 > barrier.x &&
          s.x - 15 < barrier.x + barrier.w &&
          s.y + 18 > barrier.y &&
          s.y - 18 < barrier.y + barrier.h
        ) {
          s.x = oldX;
          s.vx = 0;
          s.wall = true;
        }
      }
      for (const pad of p.springs)
        if (
          !s.detour &&
          s.spring <= 0 &&
          s.grounded &&
          Math.abs(s.x - pad.x) < 22 &&
          Math.abs(s.y + 18 - pad.y) < 22
        ) {
          s.vy = -pad.power;
          s.grounded = false;
          s.spring = 0.9;
          event("spring");
        }
      if (
        p.loop &&
        !s.detour &&
        !s.slide &&
        s.x >= p.loop.entry &&
        oldX < p.loop.entry &&
        Math.abs(s.y + 18 - p.middle) < 28
      ) {
        s.loop = { ...p.loop, angle: Math.PI / 2, until: Math.PI * 2.5 };
        s.x = p.loop.cx;
        s.y = p.loop.cy + p.loop.r - 18;
        event("loop-entered");
      }
    }
    if (s.y > 820) motorRecover();
    if (s.detour) {
      if (s.x >= p.end - 20) {
        enterNext(true);
      }
    } else if (!s.resolved) {
      if (!s.challenge || s.holding) {
        s.x = Math.min(s.x, p.start + 420);
        s.vx = 0;
        s.holding = true;
      } else if (!s.committed && !s.holding) {
        for (const c of p.commits.slice(0, s.challenge.count)) {
          if (
            s.x >= c.x &&
            s.x <= c.b + 40 &&
            s.grounded &&
            Math.abs(s.y + 18 - c.y) < 20
          ) {
            s.committed = true;
            s.awaiting = true;
            s.route = c.index;
            event("route-committed", {
              choice: c.index,
              challengeId: s.challenge.id,
            });
            break;
          }
        }
      }
      if (s.awaiting) {
        s.x = Math.min(s.x, p.start + 1250);
        s.vx *= Math.max(0, 1 - dt * 8);
      }
      if (s.x >= p.start + 1270 && !s.committed) {
        s.safe = { x: p.start + 360, y: 400 };
        motorRecover();
      }
    } else if (s.x >= p.end) {
      if (s.final) {
        s.status = "won";
        event("victory");
      } else enterNext(false);
    }
    const look = 180 + Math.min(150, Math.abs(s.vx) * 0.25),
      target = Math.max(0, s.x - s.viewWidth * 0.3 + look * 0.2);
    s.camera += (target - s.camera) * Math.min(1, dt * 7);
    const cy = Math.max(-100, Math.min(420, s.y - s.viewHeight * 0.55));
    s.cameraY += (cy - s.cameraY) * Math.min(1, dt * 5);
    s.distance = Math.max(s.distance, s.x);
  }
  function dispatch(a) {
    if (disposed) return;
    switch (a.type) {
      case "start":
      case "resume":
        if (["ready", "paused"].includes(s.status) && !s.checkpointPending)
          s.status = "playing";
        break;
      case "pause":
        if (s.status === "playing") s.status = "paused";
        s.direction = 0;
        break;
      case "motor":
        if (MOTOR_PROFILES[a.value]) {
          motor = a.value;
          cache.clear();
        }
        break;
      case "viewport":
        if (a.width >= 360 && a.height >= 300) {
          s.viewWidth = a.width;
          s.viewHeight = a.height;
        }
        break;
      case "move":
        s.direction = Math.sign(a.direction);
        break;
      case "jump":
        if (s.loop) {
          s.loop = null;
          s.vy = -MOTOR_PROFILES[motor].jump;
          s.grounded = false;
        }
        s.jumpBuffer = 0.14;
        break;
      case "slide":
        s.slide = !!a.active;
        if (a.drop) {
          s.drop = 0.45;
          s.grounded = false;
          s.support = null;
          s.y += 6;
        }
        break;
      case "drop":
        s.drop = 0.45;
        s.grounded = false;
        s.support = null;
        s.y += 6;
        break;
      case "dash":
        if (s.cooldown <= 0 && s.status === "playing") {
          s.dash = 0.65;
          s.cooldown = 2;
          s.vx += 70;
          event("dash");
        }
        break;
      case "challenge": {
        if (typeof a.id !== "string" || ![2, 3].includes(a.count)) break;
        const v = {
          id: a.id,
          count: a.count,
          length: Math.max(0, Math.min(100, a.length || 0)),
        };
        s.zone = Number.isInteger(a.zone) ? a.zone % 5 : s.zone;
        if (s.resolved) {
          s.pendingChallenge = v;
        } else {
          if (s.challenge?.id !== v.id) {
            s.challenge = v;
            s.committed = false;
            s.awaiting = false;
          } else s.challenge = v;
          s.holding = !!a.held;
        }
        break;
      }
      case "correct":
        if (s.committed && !s.resolved) {
          s.resolved = true;
          s.awaiting = false;
          s.flow++;
          s.score += 20 + Math.min(6, s.flow) * 5;
          s.feedback = 1.2;
          s.vx = Math.max(s.vx, 230);
          s.holding = false;
          event("correct-route", { route: s.route });
        }
        break;
      case "wrong":
        if (s.committed && !s.resolved && !s.detour) {
          s.detour = true;
          s.awaiting = false;
          s.flow = 0;
          s.vx = Math.max(90, Math.abs(s.vx) * 0.5);
          s.y = 590;
          s.vy = 0;
          s.safe = { x: plan().start + 1160, y: 612 };
          event("recovery-detour");
        }
        break;
      case "checkpoint":
        s.checkpointPending = true;
        s.status = "paused";
        s.direction = 0;
        break;
      case "continue-checkpoint":
        s.checkpointPending = false;
        s.status = "playing";
        break;
      case "retry-challenge":
        s.committed = false;
        s.awaiting = false;
        s.detour = false;
        s.resolved = false;
        s.x = plan().start + 360;
        s.y = 400;
        s.vx = 0;
        s.vy = 0;
        s.support = null;
        s.grounded = false;
        s.holding = !s.challenge;
        break;
      case "next":
        break; // legacy notification; a verified challenge is required before progressing.
      case "route":
        break; // Choice clicks/numeric shortcuts are intentionally not answer submissions.
      case "final":
        s.final = true;
        break;
      case "tick":
        if (s.status === "playing") {
          acc += Math.min(0.25, Math.max(0, a.dt || 0));
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
    getSnapshot: () =>
      structuredClone({
        ...s,
        plan: plan(),
        residentSections: cache.size,
        motor,
      }),
    getFrame: () => structuredClone({ ...s, plan: plan(), motor }),
    checkpoint: () => {
      const { plan: p, ...out } = { ...s };
      return structuredClone({ ...out, loop: null, direction: 0 });
    },
    dispose() {
      disposed = true;
      cache.clear();
      s.status = "disposed";
    },
  };
}
