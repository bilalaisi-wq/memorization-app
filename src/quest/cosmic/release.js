// Same Vite opt-out convention as the existing Night Sky rollout. This controls
// presentation only; free-content authorization remains in the canonical adapter.
export const COSMIC_EXPEDITIONS_ENABLED=import.meta.env?.VITE_COSMIC_EXPEDITIONS_ENABLED!=='false';
export const cosmicRollout=(enabled=COSMIC_EXPEDITIONS_ENABLED)=>Object.freeze({runner:true,defense:true,link:true,expeditions:enabled});
