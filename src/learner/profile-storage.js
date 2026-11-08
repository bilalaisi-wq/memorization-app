// Guest records retain their existing keys. Authenticated users never read another profile.
let owner = null,identityRevision=0;
export const profileRevision=()=>identityRevision;
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
  identityRevision++;
  owner = id || null;
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("ayahprofilechange",{detail:{owner}}));
};
export const profileKey = (key) => (owner ? `ayah-user:${owner}:${key}` : key);
export const cosmicKeys = Object.freeze(['ayah-cosmic-expeditions-v1','ayah-cosmic-links-v1','ayah-cosmic-gateways-v1','ayah-cosmic-adaptive-v1']);
export const profileStorage = {
  getItem: (key) => localStorage.getItem(profileKey(key)),
  setItem: (key, value) => {
    localStorage.setItem(profileKey(key), value);
    if(typeof window!=='undefined'&&(cosmicKeys.includes(key)||key==='ayah-passage-recall-v1'))window.dispatchEvent(new CustomEvent('ayahcosmicchange',{detail:{owner,key}}));
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
// Export scope is deliberately larger than the server's legacy cloud whitelist.
export const exportKeys = Object.freeze([...progressKeys,
  'ayah-chronicles-v1','ayah-revision-missions-v1','ayah-cosmic-defense-capture-v1','ayah-arcade-passages-v1','ayah-memorization-lab-v1','ayah-passage-context-v1','ayah-sirat-journeys-v2','ayah-maze-expeditions-v2','ayah-bridge-tutorial-v1','ayah-bridge-checkpoints-v2','ayah-passage-recall-v1','ayah-passage-sync-v1','ayah-passage-workspaces-v1',
  'ayah-quest-campaigns-v1','ayah-quest-revision-v1','ayah-quest-recovery-backup-v1','ayah-cosmic-gateways-v1','ayah-cosmic-links-v1','ayah-cosmic-expeditions-v1',
  'ayah-cosmic-preferences-v1','ayah-cosmic-adaptive-v1','ayah-cosmic-cloud-v1','ayah-cosmic-recovery-v1','ayah-cloud-sync-v1','ayah-cloud-restore-backup-v1','ayah-rewards-v1','ayah-reward-remote-v1',
  'ayah-nature-profile-v1','ayah-appearance-v1','ayah-sky-celebrations-v1','ayah-coach-settings-v1',
]);
export function profileBackup() {
  return Object.fromEntries(
    exportKeys
      .map((key) => [key, profileStorage.getItem(key)])
      .filter(([, value]) => value !== null),
  );
}
