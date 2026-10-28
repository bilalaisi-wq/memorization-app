// Metadata is also used by persistence; keep retired identifiers forever.
export const arcadeGames = Object.freeze([
  ['asteroids', 'Ayah Asteroids'], ['sirat', 'Sirat Quest'],
  ['maze', 'Memory Maze'], ['bubble', 'Ayah Bubble Burst'],
  ['snake', 'Ayah Snake'], ['bridge', 'Bridge Builder'],
].map(([id, title]) => Object.freeze({id, title, category: 'order', status: id==='asteroids'?'available':'planned'})));
export const arcadeIds = [...arcadeGames.map(g => g.id), 'arcade-example'];
export function createRegistry() {
  const entries = new Map();
  return {
    register(definition) {
      if (!arcadeIds.includes(definition.id) || entries.has(definition.id) || typeof definition.create !== 'function') throw Error('Invalid or duplicate arcade registration');
      entries.set(definition.id, Object.freeze({...definition}));
    },
    list({developer = false} = {}) { return [...entries.values()].filter(g => !g.developerOnly || developer).map(({create, ...metadata}) => metadata); },
    create(id, options, {developer = false} = {}) {
      const entry = entries.get(id);
      if (!entry || (entry.developerOnly && !developer)) throw Error('Game unavailable');
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
