import { catalog, reference } from "../content/library.js";
// Chapter recognition is metadata, never evidence that an approved tafsir exists.
// Envelopes come from chronicles-content's access-filtered published listing.
export function chroniclesCatalog(envelopes = []) {
  const chapters = catalog.chapters.map((c) => ({
    id: c.id,
    name: c.name,
    verseCount: c.verseCount,
    lessons: [],
  }));
  for (const lesson of envelopes) {
    if (
      lesson?.status !== "published" || typeof lesson.id !== "string" ||
      !/^[a-f0-9]{64}$/.test(lesson.hash) || !Array.isArray(lesson.refs) ||
      !lesson.refs.length
    ) continue;
    let ids;
    try {
      ids = [...new Set(lesson.refs.map((k) => reference(k).surah))];
    } catch {
      continue;
    }
    for (const id of ids) chapters[id - 1].lessons.push(lesson.id);
  }
  return chapters;
}
