// Curated, append-only item identifiers. Existing ownership must remain valid.
export const catalogVersion = 2;
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
    id: "penguin",
    kind: "creature",
    name: "Pebble Penguin",
    price: 100,
    description: "A bright little flipper for every steady step.",
  },
  {
    id: "beaver",
    kind: "creature",
    name: "Brook Beaver",
    price: 140,
    description: "Build a little confidence, one practice at a time.",
  },
  {
    id: "otter",
    kind: "creature",
    name: "River Otter",
    price: 160,
    description: "A playful friend for a flowing revision rhythm.",
  },
  {
    id: "capybara",
    kind: "creature",
    name: "Calm Capybara",
    price: 180,
    description: "A gentle reminder to learn at your own pace.",
  },
  {
    id: "red-panda",
    kind: "creature",
    name: "Maple Red Panda",
    price: 220,
    description: "A curious companion with a cozy striped tail.",
  },
  {
    id: "quokka",
    kind: "creature",
    name: "Sunny Quokka",
    price: 240,
    description: "A cheerful smile for each small discovery.",
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
    penguin:
      '<ellipse cx="100" cy="107" rx="47" ry="55" fill="#40576c"/><path d="M59 95Q32 98 41 130L67 121M141 95Q168 98 159 130L133 121" fill="#40576c"/><path d="M68 83Q74 59 100 74Q128 59 133 85L131 124Q126 151 100 153Q74 151 68 124Z" fill="#fff5dc"/><path d="m91 96 9 9 10-9Z" fill="#eab264"/><ellipse cx="78" cy="157" rx="19" ry="7" fill="#eab264"/><ellipse cx="122" cy="157" rx="19" ry="7" fill="#eab264"/>',
    beaver:
      '<ellipse cx="56" cy="142" rx="22" ry="32" transform="rotate(-38 56 142)" fill="#79594e"/><path d="m42 124 29 29m-34-13 27-12m-23 24 29-15" stroke="#a88162" stroke-width="3"/><ellipse cx="101" cy="119" rx="44" ry="39" fill="#af805b"/><circle cx="67" cy="57" r="13" fill="#af805b"/><circle cx="133" cy="57" r="13" fill="#af805b"/><circle cx="67" cy="57" r="7" fill="#dfbb91"/><circle cx="133" cy="57" r="7" fill="#dfbb91"/><ellipse cx="100" cy="88" rx="44" ry="37" fill="#af805b"/><ellipse cx="100" cy="107" rx="26" ry="20" fill="#efd2a6"/><path d="M91 107h18v22H91Z" fill="#fff8e7"/><path d="M100 109v19" stroke="#d6c3ab" stroke-width="2"/><ellipse cx="100" cy="100" rx="9" ry="6" fill="#594840"/>',
    otter:
      '<path d="M132 125Q169 151 139 159Q152 146 119 142" fill="#986b54"/><ellipse cx="99" cy="121" rx="35" ry="44" fill="#a97d5f"/><ellipse cx="99" cy="122" rx="23" ry="31" fill="#efd3ac"/><circle cx="65" cy="63" r="11" fill="#986b54"/><circle cx="135" cy="63" r="11" fill="#986b54"/><ellipse cx="100" cy="85" rx="43" ry="32" fill="#a97d5f"/><ellipse cx="100" cy="100" rx="26" ry="17" fill="#f5dfbd"/><ellipse cx="100" cy="96" rx="8" ry="5" fill="#5a4941"/><path d="M100 100v5m-9 0q9 10 18 0M72 100l-15-3m15 10-15 4m71-11 15-3m-15 10 15 4" fill="none" stroke="#765749" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="75" cy="126" rx="11" ry="8" fill="#a97d5f"/><ellipse cx="125" cy="126" rx="11" ry="8" fill="#a97d5f"/>',
    capybara:
      '<ellipse cx="101" cy="125" rx="48" ry="33" fill="#bc9871"/><rect x="67" y="137" width="18" height="22" rx="8" fill="#a98260"/><rect x="119" y="137" width="18" height="22" rx="8" fill="#a98260"/><circle cx="67" cy="58" r="12" fill="#a98260"/><circle cx="130" cy="58" r="12" fill="#a98260"/><circle cx="67" cy="58" r="6" fill="#dfbc97"/><circle cx="130" cy="58" r="6" fill="#dfbc97"/><path d="M57 84Q57 59 86 59h26q30 0 31 25v25q0 22-29 22H85q-28 0-28-22Z" fill="#bc9871"/><rect x="65" y="94" width="70" height="31" rx="15" fill="#d8b58e"/><path d="M92 103h3m10 0h3m-16 12q8 5 16 0" fill="none" stroke="#725b4a" stroke-width="3" stroke-linecap="round"/>',
    "red-panda":
      '<path d="M130 127Q172 99 174 129Q172 161 124 158" fill="#bb704f"/><path d="m150 117 17 9m-27 8 25 10m-40 2 20 14" stroke="#7c4e45" stroke-width="9"/><ellipse cx="99" cy="126" rx="35" ry="32" fill="#775247"/><circle cx="64" cy="54" r="18" fill="#bb704f"/><circle cx="135" cy="54" r="18" fill="#bb704f"/><circle cx="64" cy="54" r="11" fill="#fff0d4"/><circle cx="135" cy="54" r="11" fill="#fff0d4"/><ellipse cx="100" cy="86" rx="47" ry="35" fill="#bb704f"/><path d="M58 82q13-23 32-9l-9 19-23 9m84-19q-13-23-32-9l9 19 23 9M76 100q24-17 48 0l-9 19H85Z" fill="#fff0d4"/><path d="m93 100 7 8 8-8Z" fill="#59443f"/><path d="M93 113q7 5 14 0" fill="none" stroke="#775247" stroke-width="2.5" stroke-linecap="round"/>',
    quokka:
      '<ellipse cx="102" cy="124" rx="40" ry="35" fill="#b79877"/><ellipse cx="67" cy="53" rx="12" ry="18" fill="#b79877"/><ellipse cx="132" cy="53" rx="12" ry="18" fill="#b79877"/><ellipse cx="67" cy="53" rx="6" ry="11" fill="#e7c9a4"/><ellipse cx="132" cy="53" rx="6" ry="11" fill="#e7c9a4"/><ellipse cx="100" cy="88" rx="46" ry="39" fill="#b79877"/><ellipse cx="100" cy="105" rx="29" ry="22" fill="#eed7b7"/><ellipse cx="100" cy="97" rx="9" ry="6" fill="#5e4c43"/><path d="M85 108q15 18 30 0" fill="#fff7e5" stroke="#765e4d" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="73" cy="139" rx="13" ry="18" fill="#9e8066"/><ellipse cx="128" cy="139" rx="13" ry="18" fill="#9e8066"/>',
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
