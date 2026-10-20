// Apply a guest's saved palette before the app renders. Verified account settings
// take over before learning UI mounts; this never selects or authorizes a profile.
try {
  const preference = JSON.parse(localStorage.getItem('ayah-appearance-v1'));
  document.documentElement.dataset.theme = preference?.version === 1 && preference.theme === 'night-sky' ? 'night-sky' : 'simple';
  if(preference?.reduceEffects)document.documentElement.dataset.celestialMotion='reduced';
} catch { document.documentElement.dataset.theme='simple'; }
