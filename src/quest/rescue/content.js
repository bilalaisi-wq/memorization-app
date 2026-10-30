import { loadBundle } from "../../content/library.js";
import { recallUnit } from "../../passage/model.js";
export async function verifyRescueUnit(unit, client) {
  const bundles = await Promise.all(
    unit.refs.map((key) => loadBundle(key, client)),
  );
  const segment =
    unit.type === "segment"
      ? bundles[0].segments.find((s) => s.id === unit.segment)
      : null;
  if (
    (unit.type === "segment" && !segment) ||
    (await recallUnit(bundles, segment)).id !== unit.id
  )
    throw Error(
      "This source or reviewed recall unit changed. Your old review record is preserved. Check the current boundaries in Classic Passage Builder.",
    );
  return bundles;
}
