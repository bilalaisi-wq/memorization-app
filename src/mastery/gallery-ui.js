import { esc, clearLearningView } from "../ui/dom.js";
import { masteryStories, gallerySurahIds } from "./masteryStories.js";
import { CHECKPOINT_DAYS } from "./mastery-store.js";
let cleanup = null;
export function stopMasteryUI() {
  cleanup?.();
  cleanup = null;
}
export function mosaic(ayahIds) {
  const sections = [];
  function split(ids, x, y, w, h) {
    if (ids.length === 1) {
      sections.push({ ayahId: ids[0], x, y, w, h });
      return;
    }
    const n = Math.floor(ids.length / 2),
      ratio = n / ids.length;
    if ((w * 4) / 3 >= h) {
      split(ids.slice(0, n), x, y, w * ratio, h);
      split(ids.slice(n), x + w * ratio, y, w * (1 - ratio), h);
    } else {
      split(ids.slice(0, n), x, y, w, h * ratio);
      split(ids.slice(n), x, y + h * ratio, w, h * (1 - ratio));
    }
  }
  if (ayahIds.length) split(ayahIds, 0, 0, 100, 100);
  return sections;
}
const labelDate = (date, timezone) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date))
    : "Start recall to schedule reviews";
function artwork(surah, story, state, animate = false) {
  return `<div class="mastery-mosaic ${surah.verses.every((v) => state.unlocks[`${surah.id}:${v.id}`]) ? "art-complete" : ""}" role="img" aria-label="${esc(surah.name)} reward: ${surah.verses.filter((v) => state.unlocks[`${surah.id}:${v.id}`]).length} of ${surah.verses.length} sections revealed">
    <img class="art-probe" src="${story.illustration}" alt="" aria-hidden="true">
    ${mosaic(surah.verses.map((v) => v.id))
      .map(({ ayahId, x, y, w, h }) => {
        const key = `${surah.id}:${ayahId}`,
          open = !!state.unlocks[key],
          fresh = open && !state.seen.includes(key);
        return `<span data-art-ayah="${ayahId}" class="art-region ${open ? "art-open" : "art-locked"} ${animate && fresh ? "art-new" : ""}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;background-size:${10000 / w}% ${10000 / h}%;background-position:${w === 100 ? 0 : (x / (100 - w)) * 100}% ${h === 100 ? 0 : (y / (100 - h)) * 100}%"><span class="art-lock-number">${ayahId}</span></span>`;
      })
      .join("")}
    </div><p class="art-caption">Artwork preview · final illustration pending</p>`;
}
function bindArtwork(root) {
  root.querySelectorAll(".art-probe").forEach((img) => {
    const mosaic = img.closest(".mastery-mosaic"),
      caption = mosaic.nextElementSibling;
    img.onload = () => {
      mosaic.style.setProperty(
        "--art-url",
        `url("${img.getAttribute("src")}")`,
      );
      if (img.getAttribute("src") === "/mastery-art/placeholder.svg") {
        mosaic.dataset.fallback = "true";
        caption.textContent =
          "Local artwork placeholder · final illustration pending";
      } else {
        caption.textContent = "Reward illustration";
      }
    };
    img.onerror = () => {
      img.onerror = null;
      img.src = "/mastery-art/placeholder.svg";
    };
    if (img.complete && img.naturalWidth) img.onload();
    else if (img.complete && !img.naturalWidth) img.onerror();
  });
}
const publishable = (story) =>
  story.editorialStatus === "verified" &&
  story.narrative.trim() &&
  story.narrative.trim().split(/\s+/).length < 200 &&
  story.sources.every((s) => s.checked && s.reference);
function showStory(root, surah, story, full, callbacks) {
  const dialog = document.createElement("dialog");
  dialog.className = "mastery-dialog";
  dialog.innerHTML = `<button class="text-button dialog-close" aria-label="Close story">Close ×</button><span class="eyebrow">${full ? "SURAH COLLECTIBLE" : "TAFSIR SOURCES"}</span><h2>${esc(surah.name)} · ${esc(story.title)}</h2><p class="arabic" lang="ar" dir="rtl">${surah.arabic}</p>${full && publishable(story) ? `<p>${esc(story.historicalContext)}</p><p>${esc(story.narrative)}</p><ul>${story.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="editorial-note">${full ? "Your checkpoint collectible is earned. " : "Complete the recall checkpoints to earn this collectible. "}The tafsir story is awaiting source verification. Final artwork is awaiting the supplied concept table and approval.</p>`}<h3>Explore the Tafsir</h3><ul>${story.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.author)}</a><small>${esc(s.reference)}</small></li>`).join("")}</ul><div class="gallery-actions"><button class="primary" data-review-surah>Review the Surah</button><button class="text-button" data-open-gallery>View My Gallery</button><button class="text-button" data-continue>Continue Journey</button></div>`;
  root.append(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector(".dialog-close").onclick = close;
  dialog.addEventListener("cancel", () => dialog.remove());
  dialog.querySelector("[data-review-surah]").onclick = () => {
    close();
    callbacks.onReviewSurah(surah.id);
  };
  dialog.querySelector("[data-open-gallery]").onclick = () => {
    close();
    callbacks.onGallery();
  };
  dialog.querySelector("[data-continue]").onclick = close;
  dialog.showModal();
}
export function mountGallery(
  main,
  gallery,
  learning,
  surahs,
  callbacks,
  journeyId = null,
) {
  stopMasteryUI();
  clearLearningView(main);
  const root = document.createElement("section");
  root.className = "mastery-view";
  main.append(root);
  let error = "";
  try {
    gallery.sync(learning);
  } catch (e) {
    error = e.message;
  }
  const state = gallery.snapshot(),
    timezone = learning.snapshot().timeZone;
  const ids =
    journeyId && gallerySurahIds.includes(journeyId)
      ? [journeyId]
      : gallerySurahIds;
  const hasPending =
    !!journeyId &&
    ids.some((id) =>
      surahs
        .find((s) => s.id === id)
        .verses.some(
          (v) =>
            state.unlocks[`${id}:${v.id}`] &&
            !state.seen.includes(`${id}:${v.id}`),
        ),
    );
  main.querySelector(".page-heading h1").textContent = journeyId
    ? "Your Surah Journey"
    : "My Mastery Gallery";
  root.innerHTML = `<div class="gallery-intro"><span class="eyebrow">A MEMORY JOURNEY</span><h2>${journeyId ? "A section for each ayah" : "Collect meaningful milestones"}</h2><p>Each section unlocks after correct independent, self-assessed recall on ${CHECKPOINT_DAYS} distinct days. Your artwork stays revealed after a break or a lapse. Spaced reviews continue separately.</p><p>This Gallery covers Al-Fatihah and surahs 103–114. Final illustrations and tafsir stories are pending editorial review. These geometric previews are placeholders.</p>${journeyId ? '<button class="text-button" data-gallery>View My Gallery →</button>' : ""}<div class="gallery-animation-controls" ${hasPending ? "" : "hidden"}><button class="text-button" id="skip-reveal">Skip animations</button></div></div>
  <div class="gallery-grid ${journeyId ? "journey-grid" : ""}">${ids
    .map((id) => {
      const surah = surahs.find((s) => s.id === id),
        story = masteryStories.find((s) => s.surahId === id),
        progress = gallery.progress(surah, learning);
      return `<article class="gallery-card" data-gallery-surah="${id}"><div class="gallery-card-title"><h3>${esc(surah.name)}</h3><span class="arabic" lang="ar" dir="rtl">${surah.arabic}</span></div>${artwork(surah, story, state, !!journeyId)}<p><strong>${progress.revealed} / ${surah.verses.length} sections revealed</strong> · ${progress.full ? "Checkpoint collectible earned" : "Journey in progress"}</p><p>${progress.maintained ? `Maintained award earned${progress.currentMaintained ? "" : " · Memory needs revision"}` : "Maintained: requires successful spaced reviews for every ayah"}</p><small>Next review: ${labelDate(progress.nextReview, timezone)}</small><p>Story: ${publishable(story) ? (progress.full ? "Available" : "Unlock the collectible first") : "Awaiting source verification"}</p><div class="gallery-actions"><button class="primary small" data-journey="${id}">Continue Journey</button><button class="text-button" data-story="${id}">Read the Story</button><button class="text-button" data-tafsir="${id}">Explore the Tafsir</button><button class="text-button" data-review="${id}">Review the Surah</button></div>${journeyId ? `<div class="journey-ayahs">${surah.verses.map((v) => `<button class="text-button" data-assess="${id}:${v.id}">${state.unlocks[`${id}:${v.id}`] ? "✓" : "○"} Ayah ${v.id} · Recall</button>`).join("")}</div>` : ""}</article>`;
    })
    .join(
      "",
    )}</div><p data-status role="status" aria-live="polite"></p>${error || gallery.warning ? `<p role="alert">${esc(error || gallery.warning)}</p>` : ""}`;
  bindArtwork(root);
  root
    .querySelector("[data-gallery]")
    ?.addEventListener("click", callbacks.onGallery);
  root
    .querySelectorAll("[data-journey]")
    .forEach(
      (b) => (b.onclick = () => callbacks.onJourney(Number(b.dataset.journey))),
    );
  root
    .querySelectorAll("[data-assess]")
    .forEach((b) => (b.onclick = () => callbacks.onRecall(b.dataset.assess)));
  root
    .querySelectorAll("[data-review]")
    .forEach(
      (b) =>
        (b.onclick = () => callbacks.onReviewSurah(Number(b.dataset.review))),
    );
  for (const type of ["story", "tafsir"])
    root.querySelectorAll(`[data-${type}]`).forEach(
      (b) =>
        (b.onclick = () => {
          const id = Number(b.dataset[type]);
          showStory(
            root,
            surahs.find((s) => s.id === id),
            masteryStories.find((s) => s.surahId === id),
            gallery.progress(
              surahs.find((s) => s.id === id),
              learning,
            ).full,
            callbacks,
          );
        }),
    );
  const pending = journeyId
    ? surahs
        .find((s) => s.id === journeyId)
        .verses.map((v) => `${journeyId}:${v.id}`)
        .filter((k) => state.unlocks[k] && !state.seen.includes(k))
    : [];
  let timer = null;
  const finish = () => {
    clearTimeout(timer);
    root
      .querySelectorAll(".art-new")
      .forEach((s) => s.classList.remove("art-new"));
    root.querySelector(".gallery-animation-controls").hidden = true;
    if (!pending.length) return;
    try {
      gallery.markSeen(pending);
    } catch (e) {
      root.querySelector("[data-status]").textContent = e.message;
      return;
    }
    root.querySelector("[data-status]").textContent = pending
      .map((k) => `Ayah ${k.split(":")[1]} — Memory strengthened!`)
      .join(" ");
    if (
      gallery.progress(
        surahs.find((s) => s.id === journeyId),
        learning,
      ).full
    )
      showStory(
        root,
        surahs.find((s) => s.id === journeyId),
        masteryStories.find((s) => s.surahId === journeyId),
        true,
        callbacks,
      );
  };
  root.querySelector("#skip-reveal").onclick = finish;
  if (pending.length)
    timer = setTimeout(
      finish,
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1200,
    );
  cleanup = () => {
    clearTimeout(timer);
    root.querySelectorAll("dialog").forEach((d) => {
      d.close();
      d.remove();
    });
  };
}
