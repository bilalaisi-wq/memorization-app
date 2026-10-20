import { esc } from "../ui/dom.js";
import { profileStorage } from "../learner/profile-storage.js";
import { celestialMotion } from "./appearance.js";
export const STAR_PAGE_SIZE = 24;
const RECEIPTS = "ayah-sky-celebrations-v1";
let prior = null,
  completed = new Set(),
  receiptsBlocked = false;
export function starStatus(record, now = new Date()) {
  const mastered = record?.memory?.stage === "retained";
  const begun =
    mastered ||
    record?.game?.completed ||
    record?.game?.puzzleWins > 0 ||
    record?.memory?.history?.length > 0 ||
    (record?.memory?.stage && record.memory.stage !== "new");
  return {
    status: mastered ? "mastered" : begun ? "inProgress" : "notStarted",
    reviewDue:
      !!record?.memory?.nextReview && new Date(record.memory.nextReview) <= now,
  };
}
export function constellationLayout(
  surahId,
  ayahIds,
  offset = 0,
  limit = STAR_PAGE_SIZE,
) {
  const ids = ayahIds.slice(offset, offset + Math.min(limit, STAR_PAGE_SIZE));
  let seed =
    (surahId * 2654435761 + Math.floor(offset / STAR_PAGE_SIZE) * 97) >>> 0;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const rotation = random() * Math.PI * 2;
  return ids.map((ayahId, index) => {
    let x = 50,
      y = 50;
    if (ids.length > 12) {
      const col = index % 6,
        row = Math.floor(index / 6);
      x = 10 + (row % 2 ? 5 - col : col) * 16 + (random() - 0.5) * 4;
      y = 18 + row * 21 + (random() - 0.5) * 5;
    } else if (ids.length > 1) {
      const angle = rotation + (index / ids.length) * Math.PI * 2,
        radius = 31 + random() * 9;
      x = 50 + Math.cos(angle) * radius;
      y = 50 + Math.sin(angle) * (25 + random() * 9);
    }
    return {
      key: `${surahId}:${ayahId}`,
      ayahId,
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
    };
  });
}
export function surahSky(surah, state, now = new Date()) {
  const nodes = surah.verses.map((verse) => ({
    key: `${surah.id}:${verse.id}`,
    ayahId: verse.id,
    ...starStatus(state.records[`${surah.id}:${verse.id}`], now),
  }));
  return {
    nodes,
    mastered: nodes.filter((n) => n.status === "mastered").length,
    complete: nodes.length > 0 && nodes.every((n) => n.status === "mastered"),
    due: nodes.filter((n) => n.reviewDue).length,
  };
}
const statusLabel = (node) =>
  `${node.status === "mastered" ? "Mastered" : node.status === "inProgress" ? "In progress" : "Not begun"}${node.reviewDue ? " · Review due" : ""}`;
export function constellationSVG(
  surah,
  state,
  { offset = 0, interactive = false, currentKey = null, ignited = [] } = {},
) {
  const sky = surahSky(surah, state),
    layout = constellationLayout(
      surah.id,
      surah.verses.map((v) => v.id),
      offset,
    );
  const nodes = layout.map((point) => ({
    ...point,
    ...sky.nodes.find((n) => n.key === point.key),
  }));
  const paths = nodes
    .slice(1)
    .map(
      (node, i) =>
        `<line class="sky-line ${node.status === "mastered" && nodes[i].status === "mastered" ? "mastered" : ""}" x1="${nodes[i].x * 6.4}" y1="${nodes[i].y * 2.6}" x2="${node.x * 6.4}" y2="${node.y * 2.6}"/>`,
    )
    .join("");
  return `<svg class="constellation-map ${interactive && nodes.length > 12 ? "dense" : ""}" viewBox="0 0 640 260" role="${interactive ? "group" : "img"}" aria-label="${esc(surah.name)} constellation · ${sky.mastered} of ${sky.nodes.length} ayahs mastered${sky.nodes.length > STAR_PAGE_SIZE ? " · paginated preview" : ""}">${paths}${nodes.map((node) => `<g class="sky-node ${node.status} ${node.reviewDue ? "reviewDue" : ""} ${node.key === currentKey ? "current" : ""} ${ignited.includes(node.key) ? "sky-ignite" : ""}" transform="translate(${node.x * 6.4} ${node.y * 2.6})" ${interactive ? `data-star-key="${node.key}" role="button" tabindex="0" aria-label="${esc(surah.name)} · Ayah ${node.ayahId} · ${statusLabel(node)} · Start self-assessed recall"` : ""}><circle class="node-hit" r="23"/><circle r="${node.status === "mastered" ? 6 : 5}"/><text y="29">${node.ayahId}</text>${!interactive ? `<title>Ayah ${node.ayahId}: ${statusLabel(node)}</title>` : ""}</g>`).join("")}</svg>`;
}
export function resetSkyObserver() {
  prior = null;
  completed = new Set();
  receiptsBlocked = false;
}
export function observeMastery(state, surahs, storage = profileStorage) {
  const next = new Set(
    Object.entries(state.records)
      .filter(([, r]) => r.memory?.stage === "retained")
      .map(([key]) => key),
  );
  const full = surahs
    .filter((s) => surahSky(s, state).complete)
    .map((s) => s.id);
  if (prior === null) {
    try {
      const saved = JSON.parse(storage.getItem(RECEIPTS));
      if (saved?.version === 1 && Array.isArray(saved.surahs))
        completed = new Set(saved.surahs);
      else if (saved) receiptsBlocked = true;
    } catch {
      receiptsBlocked = true;
    }
    full.forEach((id) => completed.add(id));
    prior = next;
    try {
      if (!receiptsBlocked)
        storage.setItem(
          RECEIPTS,
          JSON.stringify({ version: 1, surahs: [...completed] }),
        );
    } catch {}
    return { ignited: [], completed: [] };
  }
  const ignited = [...next].filter((key) => !prior.has(key)),
    newFull = full.filter((id) => !completed.has(id));
  prior = next;
  if (newFull.length) {
    if (receiptsBlocked) return { ignited, completed: [] };
    const union = new Set([...completed, ...newFull]);
    try {
      storage.setItem(
        RECEIPTS,
        JSON.stringify({ version: 1, surahs: [...union] }),
      );
      completed = union;
    } catch {
      return { ignited, completed: [] };
    } // Failed presentation receipt never re-earns a completion celebration.
  }
  return { ignited, completed: newFull };
}
function completeEffect(surah) {
  if (document.documentElement.dataset.theme !== "night-sky") return;
  document.querySelector(".celestial-complete")?.remove();
  const card = document.createElement("section");
  card.className = "celestial-complete";
  card.setAttribute("role", "status");
  const title = document.createElement("strong");
  title.textContent = "Surah constellation complete";
  const text = document.createElement("p");
  text.textContent = `${surah.name} · Every ayah is retained in your saved, self-assessed memory record.`;
  const dismiss = document.createElement("button");
  dismiss.className = "text-button";
  dismiss.textContent = "Dismiss";
  dismiss.onclick = () => card.remove();
  card.append(title, text, dismiss);
  if (!celestialMotion()) card.style.animation = "none";
  (document.querySelector(".sky-view") || document.body).append(card);
  setTimeout(() => card.remove(), 2400);
}
export function mountSkyProgress(
  main,
  learning,
  surahs,
  currentSurah,
  currentKey,
  mode,
  callbacks,
) {
  main.querySelector(".sky-view")?.remove();
  const state = learning.snapshot(),
    changes = observeMastery(state, surahs);
  if (document.documentElement.dataset.theme !== "night-sky") return;
  const root = document.createElement("section");
  root.className = "sky-view";
  root.setAttribute("aria-label", "Quran constellation progress");
  let offset =
      Math.floor(
        Math.max(
          0,
          currentSurah.verses.findIndex(
            (v) => `${currentSurah.id}:${v.id}` === currentKey,
          ),
        ) / STAR_PAGE_SIZE,
      ) * STAR_PAGE_SIZE,
    search = "",
    catalogPage = 0;
  const galaxy = ["daily", "gallery"].includes(mode);
  const draw = () => {
    const sky = surahSky(currentSurah, state),
      start = offset + 1,
      end = Math.min(offset + STAR_PAGE_SIZE, sky.nodes.length);
    root.innerHTML = `<div class="sky-map-heading"><div><span class="eyebrow">EVERY AYAH A STAR</span><h2>${galaxy ? "Your Qur’an Sky" : esc(currentSurah.name) + " constellation"}</h2></div><span>${sky.mastered} / ${sky.nodes.length} ayahs mastered</span></div><p>Stars reflect retained, self-assessed memory—not puzzle points. ${sky.due} review${sky.due === 1 ? "" : "s"} due. Select an ayah to recite, record if useful, and compare.</p><div class="sky-legend"><span class="notStarted">Not begun</span><span class="inProgress">In progress</span><span class="mastered">Mastered</span><span class="reviewDue">Review due</span></div><div data-active-constellation>${constellationSVG(currentSurah, state, { offset, interactive: true, currentKey, ignited: celestialMotion() ? changes.ignited : [] })}</div>${sky.nodes.length > STAR_PAGE_SIZE ? `<div class="sky-pagination"><button class="text-button" data-star-prev ${offset === 0 ? "disabled" : ""}>← Earlier ayahs</button><span>Ayahs ${start}–${end} of ${sky.nodes.length}</span><button class="text-button" data-star-next ${end === sky.nodes.length ? "disabled" : ""}>Later ayahs →</button></div>` : ""}${galaxy ? '<div class="sky-search"><label for="sky-surah-search">Find a surah</label><input id="sky-surah-search" type="search" placeholder="Name or surah number"></div><div class="sky-catalog"></div><div class="sky-pagination" data-catalog-pages></div>' : ""}`;
    root.querySelectorAll("[data-star-key]").forEach((node) => {
      const open = () => callbacks.onRecall(node.dataset.starKey);
      node.onclick = open;
      node.onkeydown = (event) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          open();
        }
      };
    });
    const paginate = (delta) => {
      offset += delta * STAR_PAGE_SIZE;
      draw();
      root
        .querySelector(`[data-star-${delta > 0 ? "prev" : "next"}]`)
        ?.focus({ preventScroll: true });
    };
    root
      .querySelector("[data-star-prev]")
      ?.addEventListener("click", () => paginate(-1));
    root
      .querySelector("[data-star-next]")
      ?.addEventListener("click", () => paginate(1));
    if (galaxy) {
      const input = root.querySelector("input");
      input.value = search;
      input.oninput = () => {
        search = input.value;
        catalogPage = 0;
        drawCatalog();
      };
      drawCatalog();
    }
  };
  function drawCatalog() {
    const matches = surahs.filter((s) =>
        `${s.name} ${s.id}`.toLowerCase().includes(search.toLowerCase()),
      ),
      pages = Math.max(1, Math.ceil(matches.length / 6));
    catalogPage = Math.min(catalogPage, pages - 1);
    root.querySelector(".sky-catalog").innerHTML =
      matches
        .slice(catalogPage * 6, catalogPage * 6 + 6)
        .map((s) => {
          const sky = surahSky(s, state);
          return `<article class="sky-surah-card ${sky.complete ? "complete" : ""}" data-sky-surah="${s.id}"><h3>${esc(s.name)}</h3>${constellationSVG(s, state)}<p>${sky.mastered} / ${sky.nodes.length} mastered · ${sky.complete ? "Constellation complete" : sky.due ? "Review due" : "Keep growing"}${sky.nodes.length > STAR_PAGE_SIZE ? " · First 24 shown" : ""}</p><button class="text-button" data-sky-open="${s.id}">Continue recall →</button></article>`;
        })
        .join("") || "<p>No matching surahs.</p>";
    root.querySelectorAll("[data-sky-open]").forEach(
      (button) =>
        (button.onclick = () => {
          const s = surahs.find((s) => s.id === Number(button.dataset.skyOpen)),
            target =
              s.verses.find(
                (v) => starStatus(state.records[`${s.id}:${v.id}`]).reviewDue,
              ) ||
              s.verses.find(
                (v) =>
                  starStatus(state.records[`${s.id}:${v.id}`]).status !==
                  "mastered",
              ) ||
              s.verses[0];
          callbacks.onRecall(`${s.id}:${target.id}`);
        }),
    );
    const nav = root.querySelector("[data-catalog-pages]");
    nav.innerHTML = `<button class="text-button" data-catalog-prev ${catalogPage === 0 ? "disabled" : ""}>← Previous</button><span>Page ${catalogPage + 1} / ${pages}</span><button class="text-button" data-catalog-next ${catalogPage + 1 === pages ? "disabled" : ""}>Next →</button>`;
    nav.querySelector("[data-catalog-prev]").onclick = () => {
      catalogPage--;
      drawCatalog();
    };
    nav.querySelector("[data-catalog-next]").onclick = () => {
      catalogPage++;
      drawCatalog();
    };
  }
  const anchor = main.querySelector(".explore-nav");
  anchor.after(root);
  draw();
  if (changes.completed.length)
    completeEffect(surahs.find((s) => s.id === changes.completed[0]));
}
