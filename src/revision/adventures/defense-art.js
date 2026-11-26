// Original procedural SVG illustration. No third-party game artwork or Quran text in combat.
import { mapFor, WORLD, placementCheck } from "./defense-maps.js";
import { TOWERS, pointOnPath } from "./defense.js";
const path = (p) => p.map((v, i) => `${i ? "L" : "M"}${v.x},${v.y}`).join(" ");
const tree = (x, y, r = 24) =>
  `<g transform="translate(${x} ${y})"><ellipse cy="20" rx="${r}" ry="10" fill="#082b35" opacity=".5"/><path d="M-5 17 V-15 H5 V17" fill="#98754f"/><path d="M0 -${
    r + 15
  } Q-${r + 30} -12 -${r} 4 Q0 15 ${r} 4 Q${r + 30} -12 0 -${
    r + 15
  }" fill="url(#canopy)"/><path d="M0 -${r + 9} Q-${r} -9 -${
    r - 5
  } 1" fill="none" stroke="#a1d49c" opacity=".5" stroke-width="3"/></g>`;
function environment(mapId, region) {
  const m = mapFor(mapId),
    [sky, grass, light, road] = m.colors;
  return `<defs><linearGradient id="land" x2="0" y2="1"><stop stop-color="${grass}"/><stop offset="1" stop-color="${sky}"/></linearGradient><radialGradient id="canopy"><stop stop-color="#73aa85"/><stop offset="1" stop-color="#226251"/></radialGradient><linearGradient id="stone" x2=".5" y2="1"><stop stop-color="#f2dcaa"/><stop offset="1" stop-color="#ad905f"/></linearGradient><linearGradient id="water" x2="1" y2="1"><stop stop-color="#297c9b"/><stop offset="1" stop-color="#144c72"/></linearGradient><pattern id="speckle" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M6 17 l3 -4 m12 10 l3 -3" stroke="${light}" stroke-width="1" opacity=".18"/></pattern></defs><rect width="900" height="500" fill="url(#land)"/><path d="M0 44 L110 0 170 40 300 -5 370 38 530 3 690 43 780 2 900 35 V0 H0Z" fill="${sky}"/><rect width="900" height="500" fill="url(#speckle)"/>
 ${Array.from(
   { length: 28 },
   (_, i) =>
     `<circle cx="${(i * 137 + 29) % 900}" cy="${(i * 79 + 18) % 500}" r="${
       i % 3 === 0 ? 2.5 : 1.2
     }" fill="#f9e3a7" opacity="${0.2 + (i % 4) * 0.12}"/>`
 ).join("")}
 ${m.blocked
   .map((o) =>
     o.kind === "water"
       ? `<rect x="${o.x}" y="0" width="${
           o.w
         }" height="500" fill="url(#water)"/><path d="M${
           o.x + 10
         } 0 q18 50 0 100 t0 100 t0 100 t0 100 t0 100" stroke="#91e3da" stroke-width="2" fill="none" opacity=".55"/>`
       : o.kind === "tree"
       ? tree(o.x, o.y, o.r)
       : o.kind === "pond"
       ? `<ellipse cx="${o.x}" cy="${o.y}" rx="${o.r}" ry="${
           o.r
         }" fill="url(#water)" stroke="#7ab6a0" stroke-width="7"/><path d="M${
           o.x - 22
         } ${o.y} h32 m-18 10 h29" stroke="#8adad3"/>`
       : `<g transform="translate(${o.x} ${o.y})"><ellipse cy="10" rx="${
           o.r
         }" ry="12" fill="#102c3d" opacity=".6"/><path d="M-${o.r} 7 L-12 -${
           o.r
         } 8 -${o.r + 9} ${o.r} 8 0 21Z" fill="${
           o.kind === "crystal" ? "#82b9cf" : "#83959b"
         }" stroke="#b2d6c9"/><path d="M8 -${o.r + 9} 0 21 -12 -${
           o.r
         }" fill="none" stroke="#d1f0d3" opacity=".7"/></g>`
   )
   .join("")}
 ${m.paths
   .map(
     (p) =>
       `<path d="${path(
         p
       )}" fill="none" stroke="#13373c" stroke-width="43" stroke-linejoin="round"/><path d="${path(
         p
       )}" fill="none" stroke="${road}" stroke-width="30" stroke-linejoin="round"/><path d="${path(
         p
       )}" fill="none" stroke="#fff4cf" stroke-width="2" stroke-dasharray="3 14" opacity=".35"/>`
   )
   .join("")}
 ${m.water
   .flatMap((x) =>
     m.paths.flatMap((p) =>
       p.slice(1).flatMap((b, i) => {
         const a = p[i];
         if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) return [];
         const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
         return [
           `<g transform="translate(${
             x + 17
           } ${y})"><rect x="-32" y="-18" width="64" height="36" rx="4" fill="#b99a6e" stroke="#e3c696" stroke-width="4"/><path d="M-18 -18 V18 M-6 -18 V18 M6 -18 V18 M18 -18 V18" stroke="#755b44" stroke-width="3"/></g>`,
         ];
       })
     )
   )
   .join("")}
 ${Array.from({ length: 38 }, (_, i) => {
   const x = 30 + ((i * 89) % 830),
     y = 32 + ((i * 127) % 445);
   if (!placementCheck(mapId, { x, y }).valid) return "";
   return `<g transform="translate(${x} ${y})"><path d="M0 5 V-4" stroke="#8ba56a"/><circle cx="-3" cy="-5" r="3" fill="${
     i % 2 ? "#e3b7df" : "#f7ce77"
   }"/><circle cx="3" cy="-5" r="3" fill="${
     i % 2 ? "#c197cb" : "#f4ddb0"
   }"/><circle cy="-7" r="3" fill="#f7eac4"/></g>`;
 }).join("")}
 <g transform="translate(850 245)"><ellipse cy="27" rx="41" ry="17" fill="#102d3b" opacity=".65"/><path d="M-34 23 V-24 H34 V23Z" fill="url(#stone)" stroke="#917d58" stroke-width="2"/><path d="M-40 -18 H40 L30 -30 H-30Z" fill="#579b9e"/><path d="M-28 -17 V-48 H-11 V-17 M12 -17 V-48 H29 V-17" fill="url(#stone)" stroke="#c9b27c"/><path d="M-33 -48 L-20 -64 -7 -48 M7 -48 L21 -64 34 -48" fill="#56a99f" stroke="#c7dcbb"/><path d="M-7 23 V4 Q0 -7 7 4 V23" fill="#334f55"/><path d="M-19 -36 h3 m34 0 h3" stroke="#6b754f" stroke-width="5"/><circle cy="-20" r="7" fill="#ffe39c" opacity=".85"/></g><text x="850" y="295" fill="#f4e5b9" text-anchor="middle" font-size="13">Fortress</text><text x="26" y="475" fill="#e6edcd" font-family="system-ui" font-size="15">${
   m.name
 } · region ${region + 1}</text>`;
}
const weapons = {
  arrow: (l) =>
    `<path d="M-17 -31 Q0 -55 17 -31 M0 -50 V-22 M-10 -40 L0 -50 10 -40" stroke="#685137" stroke-width="4" fill="none"/>${
      l > 1 ? '<path d="M-23 -19 H23" stroke="#d6b267" stroke-width="6"/>' : ""
    }${
      l > 2
        ? '<path d="M-18 -30 H18 M-15 -37 H15" stroke="#ebd690" stroke-width="3"/>'
        : ""
    }`,
  frost: (l) =>
    `<path d="M0 -${40 + l * 7} L-${10 + l * 2} -25 0 -15 ${
      10 + l * 2
    } -25Z" fill="#a4e9e6" stroke="#eeffff"/><path d="M0 -${
      40 + l * 7
    } V-15" stroke="#62b9d6"/>${
      l > 1
        ? '<path d="M-17 -24 l-6 -19 13 13 M17 -24 l6 -19 -13 13" fill="#8cdcd8"/>'
        : ""
    }`,
  beam: (l) =>
    `<path d="M-14 -20 L-7 -42 H7 L14 -20Z" fill="#535899"/><circle cy="-43" r="${
      7 + l * 2
    }" fill="#cff9dc" stroke="#bdc57a" stroke-width="4"/>${
      l > 1 ? '<path d="M-21 -37 H21" stroke="#dda95e" stroke-width="4"/>' : ""
    }`,
  pulse: (l) =>
    Array.from(
      { length: l + 1 },
      (_, i) =>
        `<ellipse cy="${-22 - i * 8}" rx="${
          16 - i * 2
        }" ry="6" fill="#568e9f" stroke="#a2e5db" stroke-width="3"/>`
    ).join(""),
  guardian: (l) =>
    `<path d="M-21 -16 V-35 H-13 V-29 H-5 V-35 H5 V-29 H13 V-35 H21 V-16Z" fill="#c5b483" stroke="#ecdda9" stroke-width="2"/><path d="M-9 -21 V-37 H9 V-21 Q0 -11 -9 -21" fill="#79bcaa" stroke="#c8f3d8"/>${
      l > 1
        ? '<path d="M-25 -15 V8 H-16 V-15 M25 -15 V8 H16 V-15" fill="#d3ba86"/>'
        : ""
    }${
      l > 2
        ? '<ellipse cy="-19" rx="32" ry="35" fill="none" stroke="#a0ebd1" stroke-width="2"/>'
        : ""
    }`,
  observatory: (l) =>
    `<path d="M-19 -21 A19 19 0 0 1 19 -21Z" fill="#60a5a9" stroke="#b5e6d6"/><path d="M-3 -19 L-13 -41 10 -49 18 -29Z" fill="#b9a47a" stroke="#ecdcae"/><ellipse cx="13" cy="-40" rx="8" ry="12" transform="rotate(-24 13 -40)" fill="#78cdd0" stroke="#e2d195"/>${
      l > 1
        ? '<circle cx="-24" cy="-31" r="8" fill="none" stroke="#e1c77b" stroke-width="3"/>'
        : ""
    }${
      l > 2 ? '<path d="M21 -17 L31 -35 36 -30 29 -14" fill="#c6bf86"/>' : ""
    }`,
};
export function renderDefenseScene(
  svg,
  s,
  {
    placement = null,
    selected = null,
    zoom = null,
    minimal = false,
    effects = "full",
  } = {}
) {
  svg.dataset.placing = String(!!placement);
  svg.setAttribute(
    "viewBox",
    zoom ? `${zoom.x} ${zoom.y} 560 350` : "0 0 900 500"
  );
  const key = `${s.map}:${s.region}`;
  if (svg.dataset.environment !== key) {
    svg.dataset.environment = key;
    svg.innerHTML = `${environment(
      s.map,
      s.region
    )}<g data-defense-dynamic></g>`;
  }
  const dynamic = svg.querySelector("[data-defense-dynamic]");
  let markup = s.towers
    .map((t) => {
      const growth = minimal
        ? 1
        : Math.min(1, Math.max(0.05, (s.time - (t.builtAt ?? -2)) / 0.6));
      return `<g data-flow-tower-entity="${t.kind}" data-defense-tower="${
        t.id
      }" transform="translate(${t.x} ${t.y})"><title>${
        TOWERS[t.kind].name
      } Tower level ${t.level}</title>${
        selected === t.id
          ? `<circle r="${
              TOWERS[t.kind].range * (1 + 0.12 * (t.level - 1))
            }" fill="#9be2d009" stroke="#e8d29a" stroke-dasharray="5 6"/>`
          : ""
      }<ellipse cy="12" rx="29" ry="13" fill="#0b2d36" opacity=".6"/><path d="M-24 8 L0 -5 24 8 0 22Z" fill="#a5a888" stroke="#e2d1a3"/><g transform="translate(0 ${
        22 * (1 - growth)
      }) scale(1 ${growth})"><path d="M-17 5 V-25 H17 V5 L0 14Z" fill="url(#stone)" stroke="#796a54" stroke-width="2"/><path d="M0 -25 V14 L17 5 V-25Z" fill="#8a8864" opacity=".45"/><path d="M-21 -25 L0 -40 21 -25 0 -11Z" fill="#418e91" stroke="#9fc6ac"/>${weapons[
        t.kind
      ](t.level)}<path d="M-8 2 V-10 H-2 V6" fill="#455f5d"/>${
        t.level > 1
          ? '<path d="M-21 3 V-15 M21 3 V-15" stroke="#e2c57d" stroke-width="5"/>'
          : ""
      }</g><text y="36" fill="#f3e8c7" text-anchor="middle" font-size="12">${
        t.level === 3 ? "★★★" : t.level === 2 ? "★★" : "★"
      }</text></g>`;
    })
    .join("");
  markup += s.enemies
    .map((e) => {
      const p = pointOnPath(e.d, s.map, e.lane),
        color = {
          walker: "#ebbd89",
          scout: "#e6a9be",
          armored: "#96b9c3",
          swarm: "#c6b8e9",
          shielded: "#83d6c5",
          siege: "#cca0ba",
        }[e.kind];
      return `<g data-defense-balloon="${e.kind}" transform="translate(${p.x} ${
        p.y
      })"><title>${
        e.kind
      } balloon</title><ellipse cy="8" rx="13" ry="7" fill="#0c3846" opacity=".35"/><path d="M0 -18 C-22 -20 -21 6 0 12 C21 6 22 -20 0 -18Z" fill="${color}" stroke="#fff5d4" stroke-width="1.5"/><ellipse cx="-6" cy="-10" rx="4" ry="5" fill="white" opacity=".4"/><path d="M-3 12 L0 16 3 12 M0 16 q-5 6 0 9" stroke="${color}" fill="none"/>${
        e.kind === "armored"
          ? '<path d="M-13 -5 H13 M0 -17 V10" stroke="#455f75" stroke-width="4"/>'
          : e.kind === "scout"
          ? '<path d="M-10 0 l7 -7 0 7 7 -7" stroke="#984677" stroke-width="2" fill="none"/>'
          : e.kind === "siege"
          ? '<path d="M-9 -9 L-5 -16 0 -10 5 -16 9 -9Z" fill="#f1d180"/>'
          : ""
      }${
        e.shield > 0
          ? '<ellipse cy="-3" rx="23" ry="27" stroke="#9eeaf1" stroke-width="2" fill="none"/>'
          : ""
      }<rect x="-15" y="-27" width="30" height="3" fill="#183648"/><rect x="-15" y="-27" width="${
        30 * Math.max(0, e.hp / e.maxHp)
      }" height="3" fill="#c5e0a0"/></g>`;
    })
    .join("");
  markup += s.effects
    .filter(
      (e) => effects !== "off" || !["build", "construction"].includes(e.kind)
    )
    .slice(-40)
    .map((e) =>
      e.kind === "build"
        ? `<circle cx="${e.x}" cy="${e.y}" r="${
            minimal ? 29 : 25 + (0.6 - e.life) * 50
          }" stroke="#ffe8a6" stroke-width="3" fill="none" opacity="${
            e.life / 0.6
          }"/>`
        : e.kind === "pulse"
        ? `<circle cx="${e.tx}" cy="${e.ty}" r="${
            minimal ? 35 : (0.22 - e.life) * 200
          }" fill="#83cfca22" stroke="#bee9cd"/>`
        : `<path d="M${e.x} ${e.y} L${e.tx} ${e.ty}" stroke="${
            e.kind === "frost"
              ? "#9ee9f0"
              : e.kind === "beam"
              ? "#c6f8db"
              : "#f5da92"
          }" stroke-width="${
            e.kind === "beam" ? 5 : 2
          }" fill="none" opacity=".9"/>`
    )
    .join("");
  if (placement) {
    const check = placementCheck(s.map, placement, s.towers);
    markup += `<g data-defense-preview data-valid="${
      check.valid
    }" transform="translate(${placement.x} ${
      placement.y
    })" pointer-events="none"><circle r="${
      TOWERS[placement.kind].range
    }" fill="#aae5d00c" stroke="${
      check.valid ? "#9bf1cd" : "#f9a4a5"
    }" stroke-dasharray="6 6"/><circle r="${WORLD.footprint}" fill="${
      check.valid ? "#83dbbe55" : "#ed878855"
    }" stroke="${
      check.valid ? "#b7f7dc" : "#ffc1b9"
    }" stroke-width="3"/><path d="M-12 -10 L0 -29 12 -10 V8 H-12Z" fill="#e8e5c588"/><text y="4" text-anchor="middle" fill="#fff" font-size="24">${
      check.valid ? "✓" : "×"
    }</text></g>`;
  }
  dynamic.innerHTML = markup;
  svg.dataset.map = mapFor(s.map).id;
}
