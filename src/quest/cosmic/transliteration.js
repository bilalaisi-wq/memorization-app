import { freeReference, localBundle } from "../../content/library.js";
import { esc } from "../../ui/dom.js";
// Source lookup only: never transliterate Arabic algorithmically or invent missing aids.
export function sourceRoman(unit) {
  if (Array.isArray(unit?.sourceWords)) {
    return unit.sourceWords.every(w=>typeof w.transliteration==='string'&&w.transliteration.trim())?unit.sourceWords.map(w=>w.transliteration).join(" "):"";
  }
  if (typeof unit?.transliteration === "string") return unit.transliteration;
  if (typeof unit?.roman === 'string') return unit.roman;
  if (Array.isArray(unit?.roman)) return unit.roman.every(x=>typeof x==='string'&&x.trim())?unit.roman.join(' '):'';

  const ref = unit?.ref || unit?.reference || unit?.key || unit?.refs?.[0] || (unit?.surah&&unit?.ayah?`${unit.surah}:${unit.ayah}`:null);
  try {
    if (!ref || !freeReference(ref)) return "";
    const b = localBundle(ref);
    if (!b) return "";
    let first = unit.firstWord
      ? unit.firstWord - 1
      : Number.isInteger(unit.index)
      ? unit.index
      : Number.isInteger(unit.position)
      ? unit.position
      : Number.isInteger(unit.first)
      ? unit.first
      : null;
    let last = unit.lastWord || unit.endIndex ||
      (Number.isInteger(unit.last) ? unit.last + 1 : null);
    if (first !== null) {
      last ??= first + 1;
      return b.words.slice(first,last).every(w=>w.transliteration)?b.words.slice(first,last).map(w=>w.transliteration).join(' '):'';
    }
    if (unit.text === b.textUthmani) {
      return b.words.every(w=>w.transliteration)?b.words.map(w=>w.transliteration).join(" "):"";
    }
    const matches = [];
    for (let i = 0; i < b.words.length; i++) {
      for (let n = 1; n <= Math.min(12, b.words.length - i); n++) {
        if (
          b.words.slice(i, i + n).map((w) => w.text).join(" ") === unit.text
        ) {
          matches.push(
            b.words.slice(i,i+n).every(w=>w.transliteration)?b.words.slice(i,i+n).map(w=>w.transliteration).join(" "):"",
          );
        }
      }
    }
    return new Set(matches).size === 1 ? matches[0] : "";
  } catch {
    return "";
  }
}
export const romanHTML = (unit) => {
  const text = sourceRoman(unit);
  return text
    ? `<span class="cosmic-roman" lang="ar-Latn" dir="ltr">${esc(text)}</span>`
    : "";
};
