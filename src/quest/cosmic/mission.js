import { surahs } from '../../data.js';
import { freeReference, sha256 } from '../../../supabase/functions/_shared/content-policy.js';

export const MISSION_LENGTHS = Object.freeze([5, 10, 15, 20]);
export const cosmicSurahs = Object.freeze(surahs.filter(s => s.id === 1 || s.id >= 78 && s.id <= 114));
// Full hybrid mission is not available; only Star Runner can be launched.
export const COSMIC_GAMEPLAY_AVAILABLE = false;
export const STAR_RUNNER_AVAILABLE = true;
export const objectives = Object.freeze([
  { id: 'runner', title: 'Star Runner', description: 'Navigate your spacecraft through the stage’s ayah sectors.' },
  { id: 'defense', title: 'Meteor Defense', description: 'Aim and defend against environmental hazards. Movement errors are separate from memory mistakes.' },
  { id: 'link', title: 'Ayah Link', description: 'Connect verified words and consecutive ayahs in their canonical order.' },
  { id: 'weak-link', title: 'Weak-Link Boss', description: 'Practice transitions supported by your learning history, or suggested transitions when no evidence is available.' },
  { id: 'oral', title: 'Final Oral Recall', description: 'Recite independently, compare with the verified text and self-assess. Games do not certify memorization.' },
]);

function integer(value, label) {
  if (!Number.isSafeInteger(value)) throw Error(`${label} must be a whole number.`);
  return value;
}

export function selectMissionRange({ surahId, selection = '5', start = 1, end }) {
  integer(surahId, 'Surah');
  const surah = cosmicSurahs.find(s => s.id === surahId);
  if (!surah) throw Error('Choose Al-Fatihah or a surah from Juz Amma.');
  const total = surah.verses.length;
  let first = selection === 'entire' ? 1 : integer(start, 'First ayah');
  let last;
  if (first < 1 || first > total) throw Error(`First ayah must be between 1 and ${total}.`);
  if (selection === 'entire') last = total;
  else if (selection === 'custom') last = integer(end, 'Last ayah');
  else {
    if (!MISSION_LENGTHS.some(n => String(n) === selection)) throw Error('Choose a supported mission length.');
    last = Math.min(total, first + Number(selection) - 1);
  }
  if (last < first || last > total) throw Error(`Last ayah must be between ${first} and ${total}.`);
  const refs = Array.from({ length: last - first + 1 }, (_, i) => `${surahId}:${first + i}`);
  if (!refs.every(freeReference)) throw Error('This mission only supports free content.');
  return { surah, selection, first, last, refs };
}

// Configuration identity, not a gameplay run/award ID. Nothing is marked completed.
export async function createMission(options) {
  const range = selectMissionRange(options);
  const sourceHash = await sha256(JSON.stringify(range.refs.map(ref => {
    const ayah = range.surah.verses.find(v => `${range.surah.id}:${v.id}` === ref);
    if (!ayah) throw Error('Verified ayah is unavailable.');
    return [ref, ayah.text, ayah.words];
  })));
  const config = { schema: 1, policy: 'cosmic-free-v1', surah: range.surah.id, first: range.first, last: range.last, stageSize: 5, sourceHash };
  const id = `cosmic:${await sha256(JSON.stringify(config))}`;
  const stages = [];
  for (let offset = 0; offset < range.refs.length; offset += 5) {
    const refs = range.refs.slice(offset, offset + 5);
    stages.push({ id: `${id}:stage:${stages.length + 1}`, order: stages.length + 1, refs, first: Number(refs[0].split(':')[1]), last: Number(refs.at(-1).split(':')[1]), objectives: objectives.map(o => o.id) });
  }
  return { ...config, id, refs: range.refs, stages };
}
