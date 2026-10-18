// Guest records retain their existing keys. Authenticated users never read another profile.
let owner = null;
export const selectProfile = (id) => {
  owner = id || null;
};
export const profileKey = (key) => (owner ? `ayah-user:${owner}:${key}` : key);
export const profileStorage = {
  getItem: (key) => localStorage.getItem(profileKey(key)),
  setItem: (key, value) => localStorage.setItem(profileKey(key), value),
  removeItem: (key) => localStorage.removeItem(profileKey(key)),
};
export const progressKeys = [
  "ayah-learning-v1",
  "ayah-learning-legacy-v1",
  "ayah-mastery",
  "ayah-quiz",
  "ayah-completed",
  "ayah-gallery-v1",
  "ayah-puzzle-lab-v1",
  "ayah-goals-v1",
  "ayah-activity-v1",
  "ayah-achievements-v1",
];
export function profileBackup() {
  return Object.fromEntries(
    progressKeys
      .map((key) => [key, profileStorage.getItem(key)])
      .filter(([, value]) => value !== null),
  );
}
