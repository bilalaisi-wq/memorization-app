// Metadata only: no Quran text is copied into diagnostic records.
export function selectionEvidence(selected, expected) {
  const words = (p) => p?.words || (p ? [p] : []);
  const a = words(selected),
    b = words(expected);
  if (!a.length || !b.length) return {};
  return {
    category:
      a.length > 1 || b.length > 1
        ? "phrase-transition"
        : a[0].key === b[0].key
          ? "word-order"
          : "word-selection",
    expected: b.flatMap(w=>w.sourceWordIds||[w.id]),
    selected: a.flatMap(w=>w.sourceWordIds||[w.id]),
  };
}
