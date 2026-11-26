// Original SVG artwork: no franchise assets, external sprites or Qur'an text in hazards.
import { ZONES, STRIDE, coursePlan, platformY } from "./rush-course.js";
const leafTree = (x, y, color = "#67b37d") =>
  `<g transform="translate(${x} ${y})"><path d="M0 50 V-22" stroke="#766b67" stroke-width="12"/><path d="M0 -65 Q-75 -10 -28 24 Q0 40 30 20 Q73 -15 0 -65Z" fill="${color}"/><path d="M-5 -40 Q-24 -10 -9 16" stroke="#c3e1a7" stroke-width="4" fill="none" opacity=".6"/></g>`;
const gear = (x, y, r, angle) =>
  `<g transform="translate(${x} ${y}) rotate(${angle})">${Array.from(
    { length: 8 },
    (_, i) =>
      `<rect x="-7" y="-${
        r + 9
      }" width="14" height="20" rx="3" fill="#599fba" transform="rotate(${
        i * 45
      })"/>`
  ).join(
    ""
  )}<circle r="${r}" fill="#314f70" stroke="#83c7ca" stroke-width="7"/><circle r="${
    r * 0.35
  }" fill="#ad86ca"/></g>`;
function backdrop(s, minimal) {
  const z = ZONES[s.zone % 5],
    offset = minimal ? 0 : -(s.camera * 0.16) % 400,
    shift = minimal ? 0 : -(s.camera * 0.35) % 500;
  let decor = "";
  for (let i = -1; i < 5; i++) {
    const x = i * 330 + shift;
    if (z.id === "emerald")
      decor += `<path d="M${x} 580 Q${x + 120} 100 ${
        x + 330
      } 580" fill="#387e6d"/>${leafTree(x + 120, 370, "#87b998")}<path d="M${
        x + 170
      } 390 Q${x + 190} 440 ${
        x + 165
      } 520" stroke="#8ddcd1" stroke-width="22" fill="none"/>`;
    if (z.id === "forest")
      decor +=
        leafTree(x + 80, 385, "#244963") +
        leafTree(x + 210, 280, "#355e6c") +
        `<path d="M${
          x + 50
        } 580 v-22 m-20 0q20 -35 40 0Z" fill="#95cbb0"/><circle cx="${
          x + 150
        }" cy="210" r="3" fill="#efdfa7"/>`;
    if (z.id === "skyways")
      decor += `<path d="M${x} 340 Q${x + 60} 290 ${x + 140} 340 L${
        x + 70
      } 450Z" fill="#586c98" stroke="#bfc29d" stroke-width="5"/><path d="M${
        x + 140
      } 340 Q${x + 190} 370 ${
        x + 330
      } 300" fill="none" stroke="#c1ac6f" stroke-width="9"/><ellipse cx="${
        x + 140
      }" cy="130" rx="110" ry="22" fill="#b5cbdf22"/>`;
    if (z.id === "clockwork")
      decor += `<path d="M${x} 600 V240 H${x + 85} V180 H${
        x + 180
      } V600" fill="#314264" stroke="#7969a9" stroke-width="4"/>${gear(
        x + 170,
        350,
        48,
        minimal ? 0 : s.time * 12
      )}<path d="M${x + 20} 260 V500 M${
        x + 70
      } 260 V500" stroke="#54b7bb" stroke-width="7"/>`;
    if (z.id === "oasis")
      decor += `<ellipse cx="${
        x + 260
      }" cy="610" rx="130" ry="24" fill="#4aafad" opacity=".6"/><path d="M${x} 620 L${
        x + 15
      } 230 ${x + 120} 170 ${x + 210} 620Z" fill="#82646c"/><path d="M${
        x + 20
      } 340 H${x + 130} M${x + 25} 400 H${
        x + 150
      }" stroke="#b09280" stroke-width="8"/><path d="M${x + 230} 570 Q${
        x + 210
      } 420 ${
        x + 235
      } 380" fill="none" stroke="#b19770" stroke-width="13"/><path d="M${
        x + 235
      } 380q-75 -65 -90 20q65 -25 90 -20q55 -70 90 10q-65 -20 -90 -10Z" fill="#6ba691"/>`;
  }
  return `<g transform="translate(${s.camera} ${s.cameraY})"><rect width="${
    s.viewWidth
  }" height="${s.viewHeight}" fill="${
    z.sky
  }"/><g transform="translate(${offset} 0)"><circle cx="780" cy="105" r="49" fill="#eee1b5" opacity=".6"/>${Array.from(
    { length: 34 },
    (_, i) =>
      `<circle cx="${(i * 109) % 1400}" cy="${(i * 43) % 380}" r="${
        i % 3 === 0 ? 2 : 1
      }" fill="#d6e4f7" opacity=".65"/>`
  ).join(
    ""
  )}<path d="M-300 580 Q100 100 350 530 Q600 30 920 570 Q1200 180 1600 600V900H-300Z" fill="#45547a" opacity=".55"/></g><g opacity=".75">${decor}</g></g>`;
}
export function renderRushScene(
  svg,
  s,
  { minimal = false, effects = "full" } = {}
) {
  const p = s.plan,
    z = ZONES[s.zone % 5],
    floorPath = (v) =>
      v.ground || v.curve || v.hills
        ? `M${v.a} ${v.y} ${Array.from({ length: 15 }, (_, i) => {
            const x = v.a + ((v.b - v.a) * i) / 14;
            return `L${x} ${
              v.curve
                ? v.y + (v.toY - v.y) * ((i / 14) ** 2 * (3 - (2 * i) / 14))
                : v.hills
                ? v.y +
                  Math.sin((x - v.a) / 65) * 18 * Math.sin((Math.PI * i) / 14)
                : x - v.a < 430
                ? v.y +
                  Math.sin((x - v.a) / 100) *
                    12 *
                    Math.sin((Math.min(1, (430 - x + v.a) / 100) * Math.PI) / 2)
                : v.y
            }`;
          }).join(" ")}`
        : `M${v.a} ${platformY(v, s.time)} H${v.b}`;
  svg.setAttribute(
    "viewBox",
    `${s.camera} ${s.cameraY} ${s.viewWidth} ${s.viewHeight}`
  );
  svg.dataset.zone = z.id;
  svg.dataset.course = String(s.course);
  svg.dataset.layout = p.kind;
  svg.dataset.upperRoute = p.layouts?.upper || p.kind;
  svg.dataset.middleRoute = p.layouts?.middle || p.kind;
  const next = coursePlan(s.course + 1, {
    motor: s.motor,
    seed: p.seed,
    generatorVersion: s.generatorVersion,
    express: s.express,
    zone: s.zone,
  });
  const platforms = [
    ...p.platforms,
    ...next.platforms.filter((v) => v.a < next.start + 460),
    {
      a: p.express ? p.start + 1106 : p.start + 1260,
      b: p.end - 50,
      y: p.lower,
      toY: p.middle,
      slope: true,
    },
  ];
  let ground = platforms
    .map((v) => {
      const y = platformY(v, s.time),
        line = v.rotating
          ? `M${v.a} ${
              v.y -
              ((v.b - v.a) / 2) *
                Math.sin((s.time * Math.PI * 2) / v.period) *
                0.3
            } L${v.b} ${
              v.y +
              ((v.b - v.a) / 2) *
                Math.sin((s.time * Math.PI * 2) / v.period) *
                0.3
            }`
          : v.slope
          ? `M${v.a} ${v.y} L${v.b} ${v.toY}`
          : floorPath(v);
      const color = v.safety ? "#55657a" : z.land;
      const soil = v.ground
        ? `<path d="${line} L${v.b} 920 L${v.a} 920Z" fill="${z.land}" opacity=".7"/>`
        : "";
      const texture = Array.from(
        { length: Math.max(1, Math.floor((v.b - v.a) / 62)) },
        (_, i) =>
          `<path d="M${v.a + i * 62 + 16} ${y + 7}l8 7m13 -7l8 7" stroke="${
            z.accent
          }" stroke-width="2" opacity=".4"/>`
      ).join("");
      return `${soil}<g data-rush-platform="${v.id || "exit"}" ${
        v.moving ? 'data-moving-platform="true"' : ""
      }><path d="${line}" stroke="${color}" stroke-width="${
        v.safety ? 14 : 28
      }" fill="none"/><path d="${line}" stroke="${
        z.edge
      }" stroke-width="6" fill="none"/>${
        (v.gaps || [v.gap]).filter(Boolean).length
          ? (v.gaps || [v.gap])
              .filter(Boolean)
              .map(
                (g) =>
                  `<rect x="${g[0]}" y="${y - 12}" width="${
                    g[1] - g[0]
                  }" height="33" fill="${z.sky}"/>`
              )
              .join("")
          : ""
      }</g>`;
    })
    .join("");
  ground += p.springs
    .map(
      (v) =>
        `<g data-rush-spring transform="translate(${v.x} ${v.y})"><path d="M-17 0 L15 -7 -15 -14 15 -21 -15 -28 17 -35" stroke="#efbb8b" stroke-width="5" fill="none"/><rect x="-24" y="-39" width="48" height="9" rx="4" fill="#f4d67c"/></g>`
    )
    .join("");
  if (p.loop)
    ground += `<circle data-rush-loop cx="${p.loop.cx}" cy="${p.loop.cy}" r="${p.loop.r}" stroke="${z.land}" stroke-width="21" fill="none"/><circle cx="${p.loop.cx}" cy="${p.loop.cy}" r="${p.loop.r}" stroke="${z.edge}" stroke-width="4" fill="none"/>`;
  if (p.rail)
    ground += `<path data-rush-rail d="M${p.rail.a} ${p.rail.fromY}L${
      p.rail.b
    } ${p.rail.toY}" stroke="#eacc7a" stroke-width="9"/><path d="M${p.rail.a} ${
      p.rail.fromY - 5
    }L${p.rail.b} ${p.rail.toY - 5}" stroke="#8ee2dc" stroke-width="3"/>`;
  ground += [...p.barriers, ...(p.walls || [])]
    .map(
      (v) =>
        `<g data-rush-obstacle><rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="7" fill="#b095c8" stroke="#ead2a4" stroke-width="4"/></g>`
    )
    .join("");
  ground += p.commits
    .slice(0, s.challenge?.count || 3)
    .map(
      (v) =>
        `<g data-rush-gateway="${v.index}" transform="translate(${v.x} ${
          v.y
        })"><path d="M-19 0V-73Q0 -99 19 -73V0" fill="none" stroke="${
          s.resolved && s.route === v.index
            ? "#ffe098"
            : s.detour && s.route === v.index
            ? "#ee9d9f"
            : "#95cbd4"
        }" stroke-width="6"/><circle cy="-85" r="13" fill="#243c59" stroke="#9ecbcb"/><text y="-80" text-anchor="middle" fill="#fff" font-size="15">${
          v.index + 1
        }</text></g>`
    )
    .join("");
  if (s.detour)
    ground += `<g data-rush-detour><path d="M${p.start + 1080} 630H${
      p.detour.gap[0]
    } M${p.detour.gap[1]} 630H${p.end + 60} M${p.start + 1410} 552H${
      p.end + 90
    }" stroke="#b98b9d" stroke-width="18"/><path d="M${
      p.end - 65
    } 552l15 -15 -15 -15 15 -15" stroke="#f2d28c" stroke-width="7" fill="none"/><text x="${
      p.start + 1170
    }" y="700" fill="#f7d8dc" font-size="22">Recovery trail · jump, then retry the same continuation</text></g>`;
  const bob = minimal ? 0 : Math.sin(s.time * 12) * 3;
  svg.innerHTML = `${backdrop(
    s,
    minimal
  )}${ground}<g data-flow-runner transform="translate(${s.x} ${
    s.y
  })"><ellipse cy="22" rx="22" ry="6" fill="#10213b" opacity=".4"/>${
    s.feedback > 0 && effects !== "off"
      ? '<path d="M-22 2H-96" stroke="#f5dc8d" stroke-width="6" opacity=".7"/>'
      : ""
  }<ellipse rx="${s.slide ? 24 : 18}" ry="${
    s.slide ? 10 : 20
  }" fill="#80d8c7" stroke="#d4efb9" stroke-width="2"/><path d="M-4 -17 Q-31 -43 5 -28 L13 -36 17 -17" fill="#eed38a"/><path d="M-17 6 L-32 -1 -23 15Z" fill="#b6e4b4"/><circle cx="7" cy="-5" r="3.5" fill="#183751"/><path d="M12 5l10 4 -10 4" fill="#e9bf82"/><path d="M-8 19l-4 ${
    5 + bob
  } m18 -5l5 ${5 - bob}" stroke="#d5c9aa" stroke-width="4"/>${
    s.dash > 0
      ? '<path d="M-30 -6 H-75 M-28 6 H-90" stroke="#8ee6df" stroke-width="4"/>'
      : ""
  }</g>`;
}
