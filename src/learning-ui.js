import { profileBackup } from "./learner/profile-storage.js";
import { mountLearnerDashboard } from "./learner/dashboard.js";
import { successCue } from "./ui/encouragement.js";
import {
  createRecallRecording,
  stopRecallPlayback,
} from "./recall-recording.js";
import { verseAudio } from "./data.js";
export function stopLearningAudio() {
  stopRecallPlayback();
}
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function locate(surahs, key) {
  const [s, a] = key.split(":").map(Number),
    surah = surahs.find((x) => x.id === s);
  return { surah, verse: surah?.verses.find((x) => x.id === a) };
}
const title = (surahs, key) => {
  const { surah, verse } = locate(surahs, key);
  return surah && verse ? `${surah.name} · Ayah ${verse.id}` : key;
};
const dateLabel = (date, timeZone) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(date))
    : "Not scheduled";
function clearWorkflow(main) {
  main.querySelector(".reference-card")?.remove();
  main.querySelector(".mode-row")?.remove();
  main.querySelector(".memory-summary")?.remove();
  let node = main.querySelector(".builder");
  while (node) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
}
function bindOpen(root, callbacks) {
  root
    .querySelectorAll("[data-start-recall]")
    .forEach(
      (b) => (b.onclick = () => callbacks.onRecall(b.dataset.startRecall)),
    );
  root
    .querySelectorAll("[data-study]")
    .forEach((b) => (b.onclick = () => callbacks.onStudy(b.dataset.study)));
  root
    .querySelectorAll("[data-daily]")
    .forEach((b) => (b.onclick = callbacks.onDaily));
}
export function mountDailySummary(main, store, surahs, callbacks) {
  const daily = store.daily(),
    state = store.snapshot(),
    next =
      daily.dueNow[0]?.key ||
      daily.suggested[0] ||
      daily.dueToday[0]?.key ||
      daily.upcoming[0]?.key;
  const root = document.createElement("section");
  root.className = "memory-summary";
  root.innerHTML = `<div><span class="eyebrow">YOUR DAILY QUEST</span><h3>A little retrieval keeps memory growing.</h3><p>${daily.dueNow.length} due now · ${daily.dueToday.length} due today · ${daily.weak.length} needing practice</p><small>Puzzles: ${daily.puzzleCompleted} completed · Memorization: ${daily.retained} retained (self-assessed)</small></div><div class="summary-buttons"><button class="primary" data-daily>Daily quests</button><button class="text-button" data-start-recall="${callbacks.currentKey()}">Assess this ayah</button>${next ? `<button class="text-button" data-start-recall="${next}">${daily.dueNow.length ? "Start review" : "Self-assess recall"} →</button>` : ""}${state.activeReview && !state.activeReview.graded ? `<button class="text-button" data-start-recall="${state.activeReview.key}">Resume recall</button>` : ""}</div>${store.warning ? `<p class="storage-warning" role="alert">${esc(store.warning)}</p>` : ""}`;
  main.querySelector(".surah-heading").after(root);
  bindOpen(root, callbacks);
}
export function mountDailyDashboard(main, store, surahs, callbacks) {
  clearWorkflow(main);
  main.querySelector(".surah-heading")?.remove();
  main.querySelector(".page-heading h1").textContent =
    "A little recall, every day.";
  const root = document.createElement("section");
  root.className = "daily-dashboard";
  main.append(root);
  const daily = store.daily(),
    state = store.snapshot();
  const renderList = (records, kind) =>
    records
      .slice(0, 8)
      .map((r) => {
        const key = typeof r === "string" ? r : r.key;
        return `<li><div><strong>${esc(title(surahs, key))}</strong><small>${kind === "due" ? dateLabel(r.memory.nextReview, state.timeZone) : kind === "weak" ? "Try a little practice before recalling" : "No independent recall scheduled yet"}</small></div><div><button class="text-button" data-study="${key}">Study</button><button class="primary small" data-start-recall="${key}">${kind === "due" && new Date(r.memory.nextReview) > new Date() ? "Practice early" : "Recall"}</button></div></li>`;
      })
      .join("");
  const first =
    daily.dueNow[0]?.key ||
    daily.suggested[0] ||
    daily.dueToday[0]?.key ||
    daily.upcoming[0]?.key;
  root.innerHTML = `<section class="quest-banner daily-intro"><span class="quest-mascot" aria-hidden="true">✦</span><div><h2>Daily Quest</h2><p>No lost points for a break. Return to the ayahs that need attention.</p></div><div class="star-score">★ ${state.wallet.stars} stars<small>${state.wallet.xp} XP</small></div>${first ? `<button class="primary" id="start-due-review" data-start-recall="${first}">${daily.dueNow.length ? "Start review" : "Start recall assessment"} →</button>` : ""}</section>
 <section class="memory-metrics"><article><span>Puzzle progress</span><strong>${daily.puzzleCompleted} / ${surahs.reduce((n, s) => n + s.verses.length, 0)}</strong><small>Game achievements stay yours</small></article><article><span>Memorization mastery</span><strong>${daily.retained} retained</strong><small>Self-assessed across distinct days</small></article><article><span>Retrieval today</span><strong>${daily.reviewedToday} ayahs</strong><small>Independent scheduled recall</small></article></section>
 <div class="daily-columns"><section><h3>Ayahs due today <span>${daily.dueToday.length}</span></h3><p>${daily.dueNow.length} ready now. Review dates use ${esc(state.timeZone)}.</p><ul>${renderList(daily.dueToday, "due") || "<li>No reviews due today. A short new assessment can start your memory schedule.</li>"}</ul>${daily.dueToday.length > 8 ? "<small>Showing the first 8; completing reviews brings the next ones forward.</small>" : ""}</section><section><h3>Weak ayahs <span>${daily.weak.length}</span></h3><p>Study help is welcome. It does not certify independent recall.</p><ul>${renderList(daily.weak, "weak") || "<li>No weak ayahs recorded yet.</li>"}</ul></section><section><h3>Suggested new memorization</h3><p>Study first, then try reciting without the text.</p><ul>${renderList(daily.suggested, "new") || "<li>Your whole library has a recall schedule.</li>"}</ul></section></div>
 <section class="daily-columns upcoming-reviews"><section><h3>Next scheduled reviews</h3><ul>${renderList(daily.upcoming, "due") || "<li>No future reviews yet. Your first self-assessment sets the schedule.</li>"}</ul></section></section>
 <section class="memory-notes"><h3>Puzzles and memory are different journeys</h3><p>Puzzle wins unlock the existing three challenge levels. Memorization stages come from self-assessed recitation and reviews on different days, not puzzle points. “Retained” is a learning marker, not automatic verification of recitation.</p><p>FSRS schedules your next independent review. Listening or revealing text before reciting counts as assisted study. Comparing after you have recited is part of self-assessment.</p><button class="text-button" id="export-learning">Export learning data</button>${state.activeReview && !state.activeReview.graded ? `<button class="text-button" data-start-recall="${state.activeReview.key}">Resume unfinished recall</button>` : ""}</section>${store.warning ? `<p class="storage-warning" role="alert">${esc(store.warning)}</p>` : ""}`;
  bindOpen(root, callbacks);
  mountLearnerDashboard(root, store, surahs, callbacks);
  root.querySelector("#export-learning").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...JSON.parse(store.exportData()), profile: profileBackup() }, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ayah-learning-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
export function mountRecall(main, store, surahs, callbacks) {
  clearWorkflow(main);
  const root = document.createElement("section");
  root.className = "self-assessment";
  main.append(root);
  let error = "",
    recording;
  const draw = () => {
    if (!root.isConnected) return;
    const state = store.snapshot(),
      a = state.activeReview;
    if (!a) {
      root.innerHTML =
        "<p>No active assessment. Open Daily Quest to start one.</p><button data-daily>Daily quests</button>";
      bindOpen(root, callbacks);
      return;
    }
    const { surah, verse } = locate(surahs, a.key);
    if (!verse) {
      root.textContent = "This saved ayah is not available in the library.";
      return;
    }
    const r = store.getRecord(a.key),
      assisted = a.usedHint || a.audioBeforeRecall;
    root.innerHTML = `<section class="recall-intro"><span class="eyebrow">SELF-ASSESSED RECITATION</span><h2>${esc(surah.name)} · Ayah ${verse.id}</h2><p>Recite this ayah from memory, out loud or quietly. Recording is optional and stays in this tab. This app does not automatically verify your speech.</p>${r.memory.card && new Date(r.memory.card.due) > new Date() && !a.graded ? '<p class="early-practice-note">This is early practice. Correct recall keeps your future review date unchanged; an Again result schedules relearning.</p>' : ""}<div class="recall-prompt"><span aria-hidden="true">✧</span><strong>${a.comparisonRevealed ? "Compare your recitation" : "Take a breath. Recall the ayah without looking."}</strong>${!a.comparisonRevealed ? "<p>The Arabic text, translation, and word pieces are hidden.</p>" : ""}</div>${a.comparisonRevealed ? `<div class="verified-text"><p class="arabic" lang="ar" dir="rtl">${verse.text}</p><p>${verse.translation}</p></div>` : ""}
 ${!a.comparisonRevealed && !a.graded ? '<div class="recall-start-actions"><button class="primary" id="recited-compare">I’ve recited — compare</button><button class="text-button" id="recall-hint">I need the text first</button></div>' : ""}
 ${!a.graded ? `${assisted ? '<p class="assistance-note">Assisted study: you can still self-assess. This attempt will not count as successful independent recall or increase your FSRS memory state.</p>' : ""}` : ""}
 ${
   a.comparisonRevealed && !a.graded
     ? `<label class="honesty-check"><input id="recall-assisted" type="checkbox" ${assisted ? "checked disabled" : ""}> I used help before reciting</label><fieldset class="recall-grades"><legend>Compare every word. Missing or incorrect words mean Again; the other grades mean full, correct recall.</legend>${[
         ["Again", "I could not recall it"],
         ["Hard", "I recalled it with difficulty"],
         ["Good", "I recalled it correctly"],
         ["Easy", "I recalled it with ease"],
       ]
         .map(
           ([grade, label]) =>
             `<button data-recall-grade="${grade}"><strong>${grade}</strong><span>${label}</span></button>`,
         )
         .join("")}</fieldset>`
     : ""
 }
 ${a.graded ? `<div class="recall-result" role="status" tabindex="-1"><h3>Assessment saved</h3><p>${a.result.independent ? (a.result.earlyPractice ? "Early independent practice recorded. Your scheduled FSRS review was not moved." : "Independent, self-assessed recall recorded.") : "Assisted study recorded; a practice reminder is set. No independent recall credit."}</p><p><strong>Next review: <time datetime="${a.result.nextReview || ""}">${dateLabel(a.result.nextReview, state.timeZone)}</time></strong></p><p>+${a.result.reward.xp} XP · +${a.result.reward.stars} stars${!a.result.reward.xp ? " · Today’s reward limit has already been reached, or this was early practice." : ""}</p><small>Stage: ${r.memory.stage} · ${r.memory.successfulDays.length} successful review days</small><div><button class="primary" data-daily>Back to Daily Quest</button><button class="text-button" id="recall-retry">Practice another attempt</button></div></div>` : ""}
 <details class="recall-history"><summary>Recall history (${r.memory.history.length})</summary><p>${r.memory.independentAttempts} independent attempts · ${r.memory.assistedAttempts} assisted attempts · ${r.memory.lapses} lapses</p><ol>${
   r.memory.history
     .slice(-10)
     .reverse()
     .map(
       (h) =>
         `<li>${dateLabel(h.at, state.timeZone)} · ${esc(h.grade)} · ${h.independent ? "independent" : "assisted"}${h.earlyPractice ? " · early practice" : ""}</li>`,
     )
     .join("") || "<li>No completed assessments yet.</li>"
 }</ol><small>Showing up to 10 recent assessments. Export includes the full history.</small></details></section>${error || store.warning ? `<p class="storage-warning" role="alert">${esc(error || store.warning)}</p>` : ""}`;
    bindOpen(root, callbacks);
    const change = (action) => {
      try {
        store.updateRecall(a.id, action);
        error = "";
        draw();
        root.querySelector("[data-recall-grade]")?.focus();
      } catch (e) {
        error = e.message;
        draw();
      }
    };
    root
      .querySelector("#recited-compare")
      ?.addEventListener("click", () => change("compare"));
    root
      .querySelector("#recall-hint")
      ?.addEventListener("click", () => change("hint"));
    root
      .querySelector("#recall-assisted")
      ?.addEventListener("change", () => change("assisted"));
    root.querySelectorAll("[data-recall-grade]").forEach(
      (b) =>
        (b.onclick = () => {
          stopLearningAudio();
          try {
            store.gradeRecall(a.id, b.dataset.recallGrade);
            error = "";
            draw();
            root.querySelector(".recall-result")?.focus();
            callbacks.onWalletChange();
            if (b.dataset.recallGrade !== "Again")
              successCue(
                `recall:${a.id}`,
                "Recall assessed — keep strengthening your memory.",
              );
          } catch (e) {
            error = e.message;
            draw();
          }
        }),
    );
    root.querySelector("#recall-retry")?.addEventListener("click", () => {
      try {
        store.beginRecall(a.key);
        error = "";
        draw();
        root.querySelector("#recited-compare")?.focus();
      } catch (e) {
        error = e.message;
        draw();
      }
    });
    recording?.setContext({ ...a, audio: verseAudio(verse.id, surah.id) });
    if (recording) {
      root
        .querySelector(".recall-intro")
        .insertBefore(
          recording.element,
          root.querySelector(
            ".honesty-check, .recall-grades, .recall-result, .recall-history",
          ),
        );
      for (const button of root.querySelectorAll(
        "#recited-compare, #recall-hint, [data-recall-grade], #recall-retry",
      )) {
        button.disabled = recording.busy();
      }
    }
  };
  recording = createRecallRecording({
    onReference() {
      const attempt = store.snapshot().activeReview;
      if (
        attempt &&
        !attempt.graded &&
        !attempt.declaredRecited &&
        !attempt.audioBeforeRecall
      ) {
        store.updateRecall(attempt.id, "audio");
        // Keep native audio elements connected while playback starts.
        const note = document.createElement("p");
        note.className = "assistance-note";
        note.textContent =
          "Assisted study: you can still self-assess. This attempt will not count as successful independent recall or increase your FSRS memory state.";
        recording.element.before(note);
        const checkbox = root.querySelector("#recall-assisted");
        if (checkbox) checkbox.checked = checkbox.disabled = true;
      }
    },
    onChange: () => draw(),
  });
  draw();
  (
    root.querySelector("#recited-compare") ||
    root.querySelector("[data-recall-grade]")
  )?.focus();
}
