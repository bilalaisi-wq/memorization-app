// Curated, append-only item identifiers. Existing ownership must remain valid.
export const catalogVersion = 1;
export const items = [
  {
    id: "sprout",
    kind: "creature",
    name: "Little Sprout",
    price: 0,
    description: "A small beginning, full of possibility.",
  },
  {
    id: "owl",
    kind: "creature",
    name: "Moon Owl",
    price: 80,
    description: "A quiet companion for daily revision.",
  },
  {
    id: "fox",
    kind: "creature",
    name: "Meadow Fox",
    price: 120,
    description: "Curiosity, one word at a time.",
  },
  {
    id: "turtle",
    kind: "creature",
    name: "Steady Turtle",
    price: 160,
    description: "Slow and steady grows strong roots.",
  },
  {
    id: "cactus",
    kind: "creature",
    name: "Desert Bloom",
    price: 200,
    description: "A little patience, a little sunshine.",
  },
  {
    id: "butterfly",
    kind: "creature",
    name: "Sky Butterfly",
    price: 240,
    description: "Let your practice take wing.",
  },
  {
    id: "scarf-lilac",
    kind: "outfit",
    name: "Lilac Scarf",
    price: 35,
    color: "#a68bdd",
    shape: "scarf",
    description: "A soft ribbon of evening color.",
  },
  {
    id: "scarf-teal",
    kind: "outfit",
    name: "River Scarf",
    price: 35,
    color: "#42b7ac",
    shape: "scarf",
    description: "A little river-blue sparkle.",
  },
  {
    id: "cape-gold",
    kind: "outfit",
    name: "Sunbeam Cape",
    price: 75,
    color: "#e6b74c",
    shape: "cape",
    description: "A warm glow for your companion.",
  },
  {
    id: "hat-rose",
    kind: "outfit",
    name: "Petal Hat",
    price: 60,
    color: "#df88a5",
    shape: "hat",
    description: "A bright garden-day accessory.",
  },
  {
    id: "garden",
    kind: "scene",
    name: "Garden Home",
    price: 0,
    description: "A peaceful place to grow.",
  },
  {
    id: "night",
    kind: "scene",
    name: "Starry Clearing",
    price: 95,
    description: "A little home beneath the stars.",
  },
  {
    id: "dawn",
    kind: "scene",
    name: "Dawn Meadow",
    price: 95,
    description: "Begin again in gentle morning light.",
  },
];
export const starter = ["sprout", "garden"];
export function avatarSvg(profile = {}, className = "nature-avatar") {
  const creature =
    items.find((i) => i.id === profile.creature && i.kind === "creature")?.id ||
    "sprout";
  const outfit = items.find((i) =>
    i.id === profile.outfit && i.kind === "outfit"
  );
  const scene = ["night", "dawn"].includes(profile.scene)
    ? profile.scene
    : "garden";
  const body = {
    sprout:
      '<path d="M100 135V75" stroke="#397953" stroke-width="9"/><path d="M99 98Q40 99 53 51Q102 50 99 98M103 84Q151 86 149 39Q104 39 103 84" fill="#7fc897"/><ellipse cx="100" cy="140" rx="32" ry="13" fill="#c68e64"/>',
    owl:
      '<path d="M57 84 62 39 87 58Q100 52 113 58L139 39 144 87Q155 151 100 155 46 151 57 84" fill="#a697cd"/><ellipse cx="100" cy="112" rx="30" ry="35" fill="#ede6fa"/><circle cx="80" cy="82" r="21" fill="#fff4d8"/><circle cx="120" cy="82" r="21" fill="#fff4d8"/><path d="m94 94 6 13 7-13" fill="#dfa451"/>',
    fox:
      '<path d="M53 91 52 37 87 61Q100 56 114 61L149 37 147 95 127 139Q100 158 72 139Z" fill="#df9864"/><path d="M59 99 101 118 141 98 124 139Q100 151 76 138Z" fill="#fff1d8"/><path d="m94 115 7 9 7-9" fill="#484356"/>',
    turtle:
      '<ellipse cx="100" cy="114" rx="48" ry="34" fill="#69b59b"/><circle cx="100" cy="74" r="29" fill="#b2d9a0"/><path d="m100 91 26 19-10 25H85l-10-25Z" fill="#a4cc89"/><ellipse cx="56" cy="142" rx="15" ry="9" fill="#b2d9a0"/><ellipse cx="144" cy="142" rx="15" ry="9" fill="#b2d9a0"/>',
    cactus:
      '<path d="M80 145V68a20 20 0 0 1 40 0v77M80 112H61V83M120 102h20V75" fill="none" stroke="#78b59a" stroke-width="23" stroke-linecap="round"/><path d="M73 138h55l-8 24H81Z" fill="#d5a47a"/><path d="m102 43-12-12 15-4 6-12 8 14 15 3-12 12Z" fill="#e69db2"/>',
    butterfly:
      '<path d="M100 83Q38 20 39 81 23 122 91 122Q49 160 83 159L100 132M100 83Q162 20 161 81 177 122 109 122Q151 160 117 159L100 132" fill="#b2a0dc"/><path d="M100 76v62M100 79 87 60M100 79l13-19" stroke="#59566e" stroke-width="8" stroke-linecap="round"/>',
  }[creature];
  const clothes = outfit
    ? outfit.shape === "hat"
      ? `<path d="m64 58 20-25h31l20 25Z" fill="${outfit.color}"/><path d="M56 58h88" stroke="${outfit.color}" stroke-width="10" stroke-linecap="round"/>`
      : outfit.shape === "cape"
      ? `<path d="m74 105-14 47 42-13 39 13-17-47Z" fill="${outfit.color}" opacity=".9"/>`
      : `<path d="M74 110q26 14 52 0M111 116v28" fill="none" stroke="${outfit.color}" stroke-width="12" stroke-linecap="round"/>`
    : "";
  const eyes = creature === "butterfly"
    ? ""
    : `<circle cx="${creature === "sprout" ? 86 : 82}" cy="${
      creature === "sprout" ? 77 : 83
    }" r="3.5" fill="#484356"/><circle cx="${
      creature === "sprout" ? 112 : 118
    }" cy="${creature === "sprout" ? 65 : 83}" r="3.5" fill="#484356"/>`;
  return `<svg class="${className}" viewBox="0 0 200 200" role="img" aria-label="Nature companion"><circle cx="100" cy="100" r="96" fill="${
    scene === "night" ? "#25264e" : scene === "dawn" ? "#fae4c9" : "#e1eee5"
  }"/><path d="M15 153q85-29 170 0v24Q100 217 15 177Z" fill="${
    scene === "night" ? "#48567a" : "#a6c7b1"
  }"/>${
    scene === "night"
      ? '<path d="m40 43 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#f3d888"/><circle cx="150" cy="29" r="3" fill="#f9edb7"/>'
      : '<circle cx="156" cy="43" r="15" fill="#f2d78e"/>'
  }${body}${clothes}${eyes}</svg>`;
}
