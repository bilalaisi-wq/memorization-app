import { profileStorage } from './learner/profile-storage.js';
import { createPassageMemory } from './passage/memory.js';

// Exposure is assistance, never a recall grade or a scheduling event.
export function reportStudyExposure(refs, storage = profileStorage) {
  const keys = [...new Set(refs)].filter(key => /^\d+:\d+$/.test(key));
  if (!keys.length) return;
  const event = new CustomEvent('ayah-study-exposure', {cancelable:true, detail:{keys}});
  if (!window.dispatchEvent(event)) throw Error('Could not record study assistance. Preserve/export your progress before continuing.');
  const memory = createPassageMemory(storage), data = memory.snapshot(), active = data.active;
  if (active && !active.graded && !active.declared && !active.assisted &&
      data.records[active.unitId]?.unit.refs.some(key => keys.includes(key))) memory.update('assisted');
}
