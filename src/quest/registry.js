// Campaign identities are permanent. These are route policies, not shipped campaign UIs.
export const campaigns = Object.freeze(
  [
    ["passage-expedition", "Passage Expedition", ["study", "arcade", "recall"]],
    ["constellation-rescue", "Constellation Rescue", ["arcade", "recall"]],
    ["memory-repair", "Memory Repair Workshop", ["study", "recall"]],
    ["murajaah-boss-rush", "Muraja’ah Boss Rush", ["recall", "arcade"]],
    ["hifz-survival", "Hifz Survival", ["arcade", "recall"]],
  ].map(([id, title, activities]) =>
    Object.freeze({
      id,
      title,
      activities: Object.freeze(activities),
      status: id === "passage-expedition" ? "available" : "framework",
    }),
  ),
);
export function campaign(id) {
  const found = campaigns.find((c) => c.id === id);
  if (!found) throw Error("Unknown campaign");
  return found;
}
