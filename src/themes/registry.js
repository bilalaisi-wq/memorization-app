/** @typedef {'simple'|'night-sky'} ThemeId */
/** A theme changes presentation only; learning data never depends on these tokens. */
export const NIGHT_SKY_ENABLED =
  import.meta.env?.VITE_NIGHT_SKY_ENABLED !== "false";
export const THEMES = Object.freeze({
  simple: {
    id: "simple",
    name: "Simple",
    description: "The familiar, calm garden palette.",
    color: "#234f45",
  },
  "night-sky": {
    enabled: NIGHT_SKY_ENABLED,
    id: "night-sky",
    name: "Night Sky",
    description:
      "Moonlit indigo, violet nebulae, and your own Qur’an constellations.",
    color: "#070a20",
  },
});
export const APPEARANCE_KEY = "ayah-appearance-v1";
export const validAppearance = (value) =>
  value?.version === 1 &&
  Object.hasOwn(THEMES, value.theme) &&
  THEMES[value.theme].enabled !== false &&
  typeof value.reduceEffects === "boolean" &&
  typeof value.updatedAt === "string" &&
  Number.isFinite(Date.parse(value.updatedAt));
export const defaultAppearance = () => ({
  version: 1,
  theme: "simple",
  reduceEffects: false,
  updatedAt: "1970-01-01T00:00:00.000Z",
});
