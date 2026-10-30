// Read-only selectors. Scheduling and grading belong exclusively to existing stores.
export function selectRevision({
  learning,
  passageMemory,
  allowedRefs,
  now = new Date(),
  limit = 10,
}) {
  const allowed = new Set(allowedRefs),
    due = [],
    weak = [];
  const add = (unit, memory, history) => {
    if (!unit.refs.every((k) => allowed.has(k))) return;
    const date = memory.nextReview || memory.card?.due;
    const row = {
      unit: structuredClone(unit),
      due: date || null,
      mistakes:
        memory.lapses ||
        memory.mistakes ||
        history.filter((h) => h.grade === "Again").length,
    };
    if (
      date &&
      Number.isFinite(Date.parse(date)) &&
      Date.parse(date) <= +new Date(now)
    )
      due.push(row);
    if (row.mistakes > 0) weak.push(row);
  };
  for (const [key, r] of Object.entries(learning?.records || {}))
    add(
      { id: `ayah:${key}`, type: "ayah", refs: [key] },
      r.memory,
      r.memory.history || [],
    );
  for (const r of Object.values(passageMemory?.records || {}))
    add(r.unit, r, r.history || []);
  const distinct = (rows) => {
    const seen = new Set();
    return rows
      .filter((row) => {
        if (seen.has(row.unit.id)) return false;
        seen.add(row.unit.id);
        return true;
      })
      .slice(0, Math.max(0, Math.min(50, limit)));
  };
  return {
    due: distinct(
      due.sort(
        (a, b) =>
          Date.parse(a.due) - Date.parse(b.due) ||
          a.unit.id.localeCompare(b.unit.id),
      ),
    ),
    weak: distinct(
      weak.sort(
        (a, b) => b.mistakes - a.mistakes || a.unit.id.localeCompare(b.unit.id),
      ),
    ),
  };
}
export function recallEvidence(unit, { learning, passageMemory, startedAt }) {
  const histories = [...(passageMemory?.records?.[unit.id]?.history || [])];
  if (unit.type === "ayah")
    histories.push(
      ...(learning?.records?.[unit.refs[0]]?.memory.history || []),
    );
  return (
    histories.find(
      (h) =>
        h.independent === true &&
        ["Hard", "Good", "Easy"].includes(h.grade) &&
        h.attemptId &&
        Date.parse(h.at) >= Date.parse(startedAt),
    ) || null
  );
}
