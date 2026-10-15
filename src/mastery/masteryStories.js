// No tafsir passage has been verified: both supplied primary URLs returned HTTP 403.
// The absent artwork table and editorial verification must be resolved before publication.
const concepts = [
  [
    1,
    "A Prayer for Guidance",
    "A patterned garden path: a cue for seeking guidance, never a representation of Allah.",
  ],
  [
    103,
    "Time and What Lasts",
    "A garden changing through seasons, with four connected geometric panels.",
  ],
  [
    104,
    "Words and Wealth",
    "Coins and fractured ornamental patterns, without depicting unseen punishment.",
  ],
  [
    105,
    "The Protected House",
    "Architectural and geometric motifs; no historical people or unseen beings.",
  ],
  [
    106,
    "Gratitude and Security",
    "A safe caravan route and a shared meal within a geometric border.",
  ],
  [
    107,
    "Care in Small Acts",
    "A bowl of food and simple everyday tools shared with others.",
  ],
  [
    108,
    "Gratitude for Abundance",
    "An abundant earthly garden used as a general gratitude cue, not a depiction of al-Kawthar.",
  ],
  [
    109,
    "Clarity in Worship",
    "Distinct geometric paths and borders, without images of objects of worship.",
  ],
  [
    110,
    "Praise and Seeking Forgiveness",
    "An open courtyard with a quiet geometric pattern, without historical people.",
  ],
  [
    111,
    "Responsibility and Consequences",
    "A rope and empty courtyard: earthly objects, without a depiction of Hell.",
  ],
  [
    112,
    "The Oneness of Allah",
    "Pure geometric ornament. No object, light source, or figure symbolizes Allah.",
  ],
  [
    113,
    "Seeking Refuge",
    "An earthly garden at dawn, not a representation of Allah or unseen beings.",
  ],
  [
    114,
    "Refuge from Whispering",
    "A calm garden enclosed by a patterned border, without depicting the whisperer.",
  ],
];
export const masteryStories = concepts.map(
  ([surahId, title, illustrationDescription]) => ({
    surahId,
    title,
    illustration: `/mastery-art/${String(surahId).padStart(3, "0")}.webp`,
    artworkTitle: ({1: "Illuminated Path Through World", 114: "Golden Sanctuary Against the Shadows", 113: "Dawn Over the Shadow Valley"})[surahId] || title,
    illustrationDescription,
    artworkStatus: "placeholder",
    contextType: "unverified",
    historicalContext: "",
    narrative: "",
    takeaways: [],
    sources: [
      {
        author: "Ibn Kathir",
        url: "https://www.qtafsir.com/#surahs",
        reference: `Surah ${surahId}; passage verification pending`,
      },
      {
        author: "Al-Jalalayn",
        url: "https://aqeedeh.com/book_files/pdf/en/tafsir-al-jalalain-Eng-PDF.pdf",
        reference: `Surah ${surahId}; PDF passage verification pending`,
      },
    ],
    editorialStatus: "needs-review",
    editorialNote:
      "Primary references could not be retrieved (HTTP 403). No tafsir narrative is published. Artwork concepts are provisional until the missing table is supplied.",
  }),
);
export const gallerySurahIds = masteryStories.map((story) => story.surahId);
