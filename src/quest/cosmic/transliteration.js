import { freeReference, localBundle } from "../../content/library.js";
import { esc } from "../../ui/dom.js";
// Source lookup only: never transliterate Arabic algorithmically or invent missing aids.
export function sourceRoman(unit) {
  if (typeof unit?.transliteration === "string") return unit.transliteration;
  if (Array.isArray(unit?.sourceWords)) {
    return unit.sourceWords.map((w) => w.transliteration || "").join(" ");
  }
  const ref = unit?.ref || unit?.reference || unit?.key || unit?.refs?.[0];
  try {
    if (!ref || !freeReference(ref)) return "";
    const b = localBundle(ref);
    if (!b) return "";
    let first = unit.firstWord
      ? unit.firstWord - 1
      : Number.isInteger(unit.index)
      ? unit.index
      : Number.isInteger(unit.first)
      ? unit.first
      : null;
    let last = unit.lastWord || unit.endIndex ||
      (Number.isInteger(unit.last) ? unit.last + 1 : null);
    if (first !== null) {
      last ??= first + 1;
      return b.words.slice(first, last).map((w) => w.transliteration || "")
        .join(" ");
    }
    if (unit.text === b.textUthmani) {
      return b.words.map((w) => w.transliteration || "").join(" ");
    }
    const matches = [];
    for (let i = 0; i < b.words.length; i++) {
      for (let n = 1; n <= Math.min(12, b.words.length - i); n++) {
        if (
          b.words.slice(i, i + n).map((w) => w.text).join(" ") === unit.text
        ) {
          matches.push(
            b.words.slice(i, i + n).map((w) => w.transliteration || "").join(
              " ",
            ),
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
    ? `<span class="cosmic-roman" lang="en" dir="ltr">${esc(text)}</span>`
    : "";
};
