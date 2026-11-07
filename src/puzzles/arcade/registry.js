import {compatibility} from '../../passage-context/compatibility.js';
import {isDeveloperMode} from '../../developer/access.js';
// Metadata is also used by persistence; keep retired identifiers forever.
export const arcadeGames = Object.freeze([
  ['asteroids', 'Ayah Space'], ['sirat', 'Sirat Quest'],
  ['maze', 'Memory Maze'], ['bubble', 'Ayah Bubble Burst'],
  ['snake', 'Ayah Serpent'], ['bridge', 'Bridge Builder'],
].map(([id, title]) => Object.freeze({id, title, category: 'order', status: ['asteroids','snake','maze','bubble','sirat','bridge'].includes(id)?'available':'planned'})));
export const arcadeIds = [...arcadeGames.map(g => g.id), 'arcade-example', 'falling'];
export function createRegistry() {
  const entries = new Map();
  return {
    register(definition) {
      if (!arcadeIds.includes(definition.id) || entries.has(definition.id) || typeof definition.create !== 'function') throw Error('Invalid or duplicate arcade registration');
      entries.set(definition.id, Object.freeze({...definition}));
    },
    list({developer = isDeveloperMode()} = {}) { return [...entries.values()].filter(g => !g.developerOnly || developer).map(({create, ...metadata}) => metadata); },
    create(id, options, {developer = isDeveloperMode()} = {}) {
      const entry = entries.get(id);
      if (!entry || (entry.developerOnly && !developer)) throw Error('Game unavailable');
      if(options?.passageContext){const result=compatibility({game:id,refs:options.passageContext.refs,units:options.sourceUnitKind||"words",registered:[...entries.keys()]});if(!result.available)throw Error(result.reason);}
      const game = entry.create(options);
      for (const method of ['start','pause','resume','dispatch','getSnapshot','dispose']) {
        if (typeof game?.[method] !== 'function') { game?.dispose?.(); throw Error(`Missing game method: ${method}`); }
      }
      return game;
    },
  };
}
export function createLauncher(registry) {
  let current = null;
  return {
    launch(id, options, access) { current?.dispose(); current = null; current = registry.create(id, options, access); return current; },
    getSnapshot() { return current?.getSnapshot() ?? null; },
    dispose() { current?.dispose(); current = null; },
  };
}
