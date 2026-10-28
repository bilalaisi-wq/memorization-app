// Guest records retain their existing keys. Authenticated users never read another profile.
let owner = null;
export const activeProfileId = () => owner;
const listeners = new Set();
export const onProfileChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const scopedStorage = (id) => ({
  getItem: (key) => localStorage.getItem(`ayah-user:${id}:${key}`),
  setItem: (key, value) =>
    localStorage.setItem(`ayah-user:${id}:${key}`, value),
  removeItem: (key) => localStorage.removeItem(`ayah-user:${id}:${key}`),
});
export const selectProfile = (id) => {
  owner = id || null;
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("ayahprofilechange",{detail:{owner}}));
};
export const profileKey = (key) => (owner ? `ayah-user:${owner}:${key}` : key);
export const profileStorage = {
  getItem: (key) => localStorage.getItem(profileKey(key)),
  setItem: (key, value) => {
    localStorage.setItem(profileKey(key), value);
    if (progressKeys.includes(key) || key === "ayah-rewards-v1")
      for (const listener of listeners) listener(owner, key);
  },
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
