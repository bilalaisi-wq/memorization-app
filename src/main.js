import { mountSiteMenu } from "./ui/site-menu.js";
import { initializeAppearance } from "./themes/appearance.js";
import { mountSkyProgress, resetSkyObserver } from "./themes/constellations.js";
import { initializeAccounts, mountAccountControls, appearanceAccount } from "./learner/accounts.js";
import { profileStorage } from "./learner/profile-storage.js";
import { trackStudy, summarizeActivity, achievements, preserveAchievements } from "./learner/insights.js";
import { mountMemoryTip } from "./ui/memory-tips.js";
import { bindPieceDrag, stopPieceDrag } from "./ui/piece-drag.js";
import { mountExperienceControls } from "./ui/tutorial.js";
import {
  configureExperience,
  successCue,
  transitionCue,
  stopEncouragement,
  studyAudioStart,
  studyAudioStop,
} from "./ui/encouragement.js";
import { isRecallRecordingBusy } from "./recall-recording.js";
import { createMasteryStore } from "./mastery/mastery-store.js";
import { gallerySurahIds } from "./mastery/masteryStories.js";
import { mountGallery, stopMasteryUI } from "./mastery/gallery-ui.js";
import { createPuzzleStore } from "./puzzles/puzzle-store.js";
import { mountPuzzleLab, stopPuzzleLab } from "./puzzles/puzzle-lab.js";
import { disposeRecallRecording } from "./recall-recording.js";
import { createDistractorPicker } from "./distractors.js";
import { createLearningStore } from "./learning-store.js";
import {
  mountDailySummary,
  mountDailyDashboard,
  mountRecall,
  stopLearningAudio,
} from "./learning-ui.js";
import { mountSequence, stopSequence } from "./sequence.js";
import "./style.css";
import "./themes/night-sky.css";
import {
  surahs,
  totalAyahs,
  shuffled,
  wordAudio,
  verseAudio,
  quizCorrect,
  scrambledBank,
  challengeLevel,
  challengeReward,
} from "./data.js";
import { illustration, outline } from "./illustrations.js";
const icons = {
  play: '<path d="m9 5 10 7-10 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13h4v7H4zM16 13h4v7h-4z"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  repeat:
    '<path d="M4 9a7 7 0 0 1 12-4l3 3M19 3v5h-5M20 15a7 7 0 0 1-12 4l-3-3M5 21v-5h5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  book: '<path d="M12 5v15M12 5C8 3 4 4 3 4v15c4-1 6 0 9 1 3-1 5-2 9-1V4c-3-1-6 0-9 1z"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
await initializeAccounts();
initializeAppearance(appearanceAccount());
const learning = createLearningStore(profileStorage, surahs);
const gallery = createMasteryStore(profileStorage, surahs);
const lab = createPuzzleStore(profileStorage, surahs);
let puzzleSessionId = "";
let chapter = 0,
  verses = surahs[0].verses,
  peekTimer = null,
  peeking = false,
  roundLevel = 1,
  roundId = 0;
let mastery = Object.fromEntries(
  Object.values(learning.snapshot().records).map((r) => [
    r.key,
    r.game.puzzleWins,
  ]),
);
const key = () => surahs[chapter].id + ":" + verses[ayah].id;
const chapterCompleted = () =>
  verses.filter((v) => completed.has(surahs[chapter].id + ":" + v.id)).length;
let ayah = 0,
  mode = "practice",
  selected = [],
  bank = [],
  hidden = new Set(),
  reveal = new Set(),
  playing = false,
  activeWord = -1,
  run = 0,
  audio = null,
  repeats = 3,
  speed = 1,
  feedback = "",
  reference = true;
const pickDistractors = createDistractorPicker();
let extras = [],
  attempts = 0,
  quizSolved = false,
  hinted = false,
  stars = 0,
  xp = 0,
  streak = 0;
({ stars, xp, streak } = learning.snapshot().wallet);
let completed = new Set(
  Object.values(learning.snapshot().records)
    .filter((r) => r.game.completed)
    .map((r) => r.key),
);
const app = document.querySelector("#app");
function reset() {
  stop();
  clearTimeout(peekTimer);
  peeking = false;
  selected = [];
  roundId++;
  puzzleSessionId =
    globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random();
  roundLevel = challengeLevel(mastery[key()] || 0);
  extras =
    mode === "quiz"
      ? pickDistractors(surahs[chapter].id, verses[ayah].words, roundLevel + 3)
      : [];
  bank = scrambledBank(
    verses[ayah].words.length + extras.length,
    verses[ayah].words.length,
  );
  hidden = new Set(mode === "recall" ? bank.filter((_, i) => i % 2 === 0) : []);
  if (mode === "quiz" && roundLevel > 1) {
    const fraction = roundLevel === 2 ? 1 / 3 : 2 / 3;
    // Blank both real and extra words so every round exercises recall,
    // without revealing which pieces belong to the ayah.
    for (const group of [
      bank.filter((i) => i < verses[ayah].words.length),
      bank.filter((i) => i >= verses[ayah].words.length),
    ]) {
      shuffled(group.length)
        .slice(0, Math.ceil(group.length * fraction))
        .forEach((i) => hidden.add(group[i]));
    }
  }
  reveal.clear();
  feedback = "";
  reference = mode === "practice";
  attempts = 0;
  quizSolved = false;
  hinted = false;
  render();
  transitionCue();
}
function peekWords() {
  clearTimeout(peekTimer);
  hinted = true;
  peeking = true;
  render();
  const id = roundId;
  peekTimer = setTimeout(() => {
    if (id !== roundId) return;
    peeking = false;
    render();
  }, 8000);
}
function piece(i, zone) {
  const v = verses[ayah],
    extra = i >= v.words.length,
    entry = extra ? extras[i - v.words.length] : null,
    blank =
      (mode === "recall" || mode === "quiz") &&
      hidden.has(i) &&
      !reveal.has(i) &&
      !peeking;
  const [meaning, art] = extra ? [entry.meaning, entry.art] : v.meanings[i];
  const gold = art === "gold";
  const position = extra ? (i * 3 + 1) % v.words.length : i;
  return `<div class="piece-wrap"><button class="piece color-${i % 9} ${gold ? "divine-gold" : ""} ${activeWord === i ? "sounding" : ""}" data-word="${i}" data-zone="${zone}" draggable="true" aria-label="${blank ? "Hidden word" : extra ? entry.roman : v.roman[i]}, ${zone === "bank" ? "add to practice" : "remove from practice"}"><svg class="puzzle-outline" viewBox="0 0 180 140" preserveAspectRatio="none" aria-hidden="true"><path d="${outline(position, v.words.length)}"/></svg>${blank ? "" : gold ? '<span class="gold-sparkles" aria-hidden="true">✧ ˚ ✦</span>' : illustration(art)}<span class="arabic" lang="ar" dir="rtl">${blank ? "؟" : extra ? entry.text : v.words[i]}</span><span class="roman">${blank ? "Recall this word" : extra ? entry.roman : v.roman[i]}</span><span class="word-meaning">${blank ? "" : meaning}</span><span class="piece-dot">${zone === "bank" ? "+" : "−"}</span></button><button class="piece-listen" data-listen="${i}" aria-label="Listen to this piece" title="Listen to this piece">${icon(activeWord === i && playing ? "pause" : "headphones")}</button></div>`;
}
function render() {
  ({ stars, xp, streak } = learning.snapshot().wallet);
  const v = verses[ayah],
    surah = surahs[chapter],
    count = chapterCompleted();
  app.innerHTML = `
<aside class="sidebar"><a class="brand" href="#" aria-label="Ayah home"><span class="brand-mark">۞</span><span>ayah<span class="brand-period">.</span></span></a><div class="sidebar-sub">A LITTLE EACH DAY. A LIFETIME WITH YOU.</div><div class="nav-label">YOUR SPACE</div><button class="nav-item active" id="nav-learn">${icon("grid")} Memorization <span class="nav-pill">${totalAyahs}</span></button><button class="nav-item" id="nav-daily">${icon("repeat")} Daily quests</button><button class="nav-item" id="nav-progress">${icon("book")} My progress</button><div class="surah-label">CHOOSE A SURAH</div><label class="surah-picker-label">Your surah<select id="surah-picker">${surahs.map((s, i) => `<option value="${i}" ${chapter === i ? "selected" : ""}>${s.name} · ${s.verses.length} ayahs</option>`).join("")}</select></label><div class="surah-side"><span class="surah-symbol">${String(surah.id).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])}</span><div><strong>${surah.name}</strong><small>${surah.meaning} · ${verses.length} ayahs</small></div></div><div class="ayah-nav">${verses.map((x, i) => `<button data-ayah="${i}" class="ayah-item ${i === ayah ? "current" : ""}"><span class="ayah-number">${completed.has(surah.id + ":" + (i + 1)) ? "✓" : i + 1}</span><span>Ayah ${i + 1}</span>${i === ayah ? '<span class="current-dot"></span>' : ""}</button>`).join("")}</div><div class="sidebar-bottom"><span class="small-flower">✧</span><p>“And We have certainly made<br>the Quran easy to remember.”</p><small>AL-QAMAR · 54:17</small></div></aside>
<div class="main-shell"><header><div class="breadcrumb">My learning <span>/</span> <strong>${surah.name}</strong></div><div class="header-right"><span class="daily">✧ <b>${completed.size}</b> ayahs practiced</span><span class="avatar">Y</span></div></header><main><div class="page-heading"><div class="eyebrow">MEMORIZE, PIECE BY PIECE</div><h1>Small pieces. Big discoveries.</h1><p>A colorful little adventure, one ayah at a time.</p></div><nav class="explore-nav" aria-label="Explore learning tools"><button class="text-button" id="nav-gallery">Mastery Gallery</button><button class="text-button" id="nav-lab">Puzzle Lab</button></nav><div class="surah-heading"><div><span class="surah-tag">SURAH ${String(surah.id).padStart(3, "0")}</span><h2>${surah.name} <span lang="ar" class="surah-arabic">${surah.arabic}</span></h2><p>${surah.meaning} <span>•</span> ${surah.origin} <span>•</span> ${verses.length} ayahs</p></div><div class="progress-summary"><span>Your progress <b>${count} / ${verses.length} ayahs</b></span><div class="progress-track"><i style="width:${(count / verses.length) * 100}%"></i></div></div></div>
<section class="reference-card"><div class="reference-top"><span class="section-label"><span class="tiny-dot"></span> AYAH ${v.id} <span class="muted">OF ${verses.length}</span></span><button class="text-button" id="full-audio">${icon(playing ? "pause" : "headphones")} ${playing ? "Stop audio" : "Listen to full ayah"}</button></div><div class="full-verse ${reference ? "" : "reference-hidden"}" lang="ar" dir="rtl">${reference ? v.text + ' <span class="verse-end">' + String(v.id).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]) + "</span>" : '<span class="hidden-reference">The ayah is hidden for your challenge</span>'}</div><p class="translation">${reference ? v.translation : "Build from memory. Reveal the ayah whenever you need a little help."}</p>${mode !== "practice" ? `<button class="reference-toggle" id="reference-toggle">${icon("eye")} ${reference ? "Hide" : "Reveal"} ayah</button>` : ""}</section>
<div class="mode-row"><div class="tabs" role="tablist" aria-label="Learning mode">${[
    ["practice", "grid", "Practice"],
    ["quiz", "praise", "Puzzle quest"],
    ["recall", "eye", "Active recall"],
    ["sequence", "book", "Ayah chain"],
  ]
    .map(
      ([m, ic, label]) =>
        `<button role="tab" aria-selected="${mode === m}" data-mode="${m}" class="tab ${mode === m ? "selected" : ""}">${icon(ic)} ${label}${m === "practice" ? '<span class="tab-dot"></span>' : ""}</button>`,
    )
    .join(
      "",
    )}</div><span class="mode-caption">${mode === "practice" ? "Make it yours. Go at your pace." : mode === "quiz" ? "Put every word in its place." : "Same pieces. A little more memory."}</span></div>
${mode === "quiz" ? `<section class="quest-banner"><span class="quest-mascot" aria-hidden="true">✦</span><div><strong>Ayah ${v.id} quest</strong><p>Find ${v.words.length} words. Leave the ${extras.length} extra words behind!<br><small>Level ${roundLevel} / 3 · ${roundLevel === 1 ? "Find the words" : roundLevel === 2 ? "Some words are blank" : "Most words are blank"} · ${roundLevel === 3 ? "Keep practicing for mastery" : Math.min(2, Math.max(0, (mastery[key()] || 0) - (roundLevel - 1) * 2)) + " / 2 puzzle wins to level up"}</small></p></div><span class="star-score">★ ${stars} stars <small>${quizSolved ? "Round complete!" : attempts + " tries"}</small></span><div class="level-trail">${[1, 2, 3].map((l) => `<span class="level-step ${l === roundLevel ? "level-active" : ""} ${l < roundLevel ? "level-done" : ""}">${l < roundLevel ? "✓" : l} ${["", "Discover", "Remember", "Master"][l]}</span>`).join("")}</div><div class="xp-line"><strong>Learner level ${1 + Math.floor(xp / 100)}</strong><span>${xp} XP · ${streak} clean rounds practiced</span><progress max="100" value="${xp % 100}" aria-label="Progress toward next learner level"></progress></div><p class="quest-help">Two unassisted wins unlock the next level. Every fresh round earns XP. Reveals help you practice; try again without them to level up.</p></section>` : ""}<section class="builder"><div class="builder-heading"><div><h3>${mode === "practice" ? "Your practice space" : mode === "quiz" ? "Build the ayah in order" : "Bring the missing words to mind"}</h3><p>${mode === "practice" ? "Choose a word or a few. Build the part you want to remember." : mode === "quiz" ? "Choose the right words from the mixed bag, then build from right to left." : "Some words are hidden. Use their shapes and colors to recall them."}</p></div><button class="text-button muted" id="clear">↺ Reset</button></div><div class="build-zone ${selected.length ? "has-pieces" : ""}" data-drop="build" dir="rtl">${selected.length ? selected.map((i) => piece(i, "selected")).join("") : `<div class="empty-zone"><span class="empty-puzzle">${icon("grid")}</span><strong>Let’s put the pieces together!</strong><span>Click or drag word pieces below to begin</span></div>`}</div><div class="build-actions"><span class="selected-count"><span class="tiny-dot"></span> ${selected.length} of ${v.words.length} words selected</span><div><button class="text-button" id="build-all">${mode === "practice" ? "Build full ayah" : "Shuffle pieces"}</button>${mode === "quiz" && hidden.size ? '<button class="text-button" id="peek-words">' + icon("eye") + (peeking ? " Words visible for 8 seconds" : " Peek for 8 seconds") + "</button>" : ""}${mode === "recall" ? '<button class="text-button" id="reveal-words">' + icon("eye") + " Reveal words</button>" : ""}<button class="primary small" id="practice-audio" ${!selected.length ? "disabled" : ""}>${icon(playing ? "pause" : "play")} ${playing ? "Stop" : "Listen to my pieces"}</button></div></div>${mode === "quiz" ? '<p class="sequence-hint">Plays your pieces exactly as arranged, including extra words. Compare with the full ayah.</p>' : ""}<div class="word-bank-heading"><span class="section-label">YOUR WORD PIECES</span><span>Tap headphones to hear any piece <span class="rtl-arrow">←</span></span></div><div class="word-bank" dir="rtl" data-drop="bank">${
    bank
      .filter((i) => !selected.includes(i))
      .map((i) => piece(i, "bank"))
      .join("") ||
    '<span class="bank-empty">Every piece has found a place ✧</span>'
  }</div><div class="builder-footer">${icon("grid")}<span>Match a left tab with the next right socket. Pictures are memory cues, not literal translations. Drag a piece or its ⠿ handle to reorder; use →/← for earlier/later.</span></div></section>
<section class="practice-controls"><div class="repeat-label"><span class="control-icon">${icon("repeat")}</span><div><strong>Little repetitions, lasting memory</strong><p>Give your selected words a few more moments.</p></div></div><div class="control-fields"><label>Repeat <select id="repeat"><option value="1" ${repeats === 1 ? "selected" : ""}>1 time</option><option value="3" ${repeats === 3 ? "selected" : ""}>3 times</option><option value="5" ${repeats === 5 ? "selected" : ""}>5 times</option><option value="10" ${repeats === 10 ? "selected" : ""}>10 times</option></select></label><label>Speed <select id="speed">${[0.75, 1, 1.25].map((s) => `<option value="${s}" ${speed === s ? "selected" : ""}>${s}×</option>`).join("")}</select></label></div></section><div class="feedback ${feedback.startsWith("Beautiful") ? "success" : ""}" role="status" aria-live="polite">${feedback}</div><div class="bottom-row">${mode === "quiz" ? '<button class="text-button" id="next-ayah">Next ayah →</button>' : ""}<span>✧ Progress is a practice, not a race.</span><button class="primary" id="next">${mode === "practice" ? "Complete & next ayah" : quizSolved ? "Play again →" : "Check my order"} ${icon(mode === "practice" ? "arrow" : "check")}</button></div><footer>Made for a mindful moment with the Quran.<span>Recitation: Mishary Rashid Alafasy · Uthmanic Hafs script</span></footer></main></div>`;
  bind();
  document
    .querySelector("#nav-learn")
    .classList.toggle("active", mode !== "daily" && mode !== "review");
  document
    .querySelector("#nav-daily")
    .classList.toggle("active", mode === "daily" || mode === "review");
  if (mode === "gallery")
    mountGallery(
      document.querySelector("main"),
      gallery,
      learning,
      surahs,
      memoryCallbacks,
      galleryFocus,
    );
  else if (mode === "lab")
    mountPuzzleLab(
      document.querySelector("main"),
      surah,
      v,
      learning,
      lab,
      memoryCallbacks,
      surahs,
    );
  else if (mode === "daily")
    mountDailyDashboard(
      document.querySelector("main"),
      learning,
      surahs,
      memoryCallbacks,
    );
  else if (mode === "review")
    mountRecall(
      document.querySelector("main"),
      learning,
      surahs,
      memoryCallbacks,
    );
  else
    mountDailySummary(
      document.querySelector("main"),
      learning,
      surahs,
      memoryCallbacks,
    );
  if (mode === "sequence") mountSequence(document.querySelector("main"), surah);
  mountSkyProgress(document.querySelector("main"), learning, surahs, surah, key(), mode, memoryCallbacks);
  mountMemoryTip(document.querySelector("main"), mode);
  mountAccountControls(document.querySelector("main"), learning);
  const planButton = document.createElement("button");
  planButton.className = "text-button";
  planButton.textContent = "My plan & achievements";
  planButton.onclick = memoryCallbacks.onDaily;
  document.querySelector(".explore-nav").append(planButton);
  mountExperienceControls(document.querySelector("main"), {
    beforeTour: stop,
    afterTour: render,
    assessmentKey: learning.snapshot().activeReview?.graded
      ? null
      : learning.snapshot().activeReview?.key,
    practice: () => {
      if (!markStudyBeforeRecall(key())) return;
      mode = "practice";
      reset();
    },
    quest: () => {
      if (!markStudyBeforeRecall(key())) return;
      mode = "quiz";
      reset();
    },
    recall: () => {
      if (!markStudyBeforeRecall(key())) return;
      mode = "recall";
      reset();
    },
    chain: () => {
      if (!markStudyBeforeRecall(key())) return;
      mode = "sequence";
      reset();
    },
    daily: memoryCallbacks.onDaily,
    assessment: () => memoryCallbacks.onRecall(key()),
    lab: memoryCallbacks.onLab,

    gallery: memoryCallbacks.onGallery,
  });
  mountSiteMenu(document.querySelector("main"));
}
function stop() {
  stopPieceDrag();
  stopEncouragement();
  studyAudioStop("practice");
  stopPuzzleLab();
  stopMasteryUI();
  disposeRecallRecording();
  stopLearningAudio();
  stopSequence();
  run++;
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
  playing = false;
  activeWord = -1;
}
async function play(full, single = null) {
  if (playing && (single === null || activeWord === single)) {
    stop();
    render();
    return;
  }
  const list = full ? [-1] : single !== null ? [single] : [...selected];
  if (!list.length) return;
  stop();
  studyAudioStart("practice");
  const token = run;
  playing = true;
  feedback = "";
  render();
  try {
    for (let r = 0; r < (full || single !== null ? 1 : repeats); r++) {
      for (const i of list) {
        if (token !== run) return;
        activeWord = i;
        render();
        await new Promise((resolve, reject) => {
          audio = new Audio(
            i < 0
              ? verseAudio(verses[ayah].id, surahs[chapter].id)
              : i >= verses[ayah].words.length
                ? extras[i - verses[ayah].words.length].audio
                : wordAudio(verses[ayah].id, i, surahs[chapter].id),
          );
          audio.playbackRate = speed;
          audio.onended = resolve;
          audio.onerror = () => reject(new Error("audio"));
          audio.play().catch(reject);
        });
      }
      if (token !== run) return;
    }
    studyAudioStop("practice");
    playing = false;
    activeWord = -1;
    feedback = "Listening complete. Take a breath and try saying it yourself.";
    render();
  } catch {
    if (token !== run) return;
    stop();
    feedback =
      "Audio could not load. Check that the app’s audio files are available, then try again.";
    render();
  }
}
function add(i) {
  if (quizSolved) return;
  stop();
  if (!selected.includes(i)) selected.push(i);
  feedback = "";
  render();
}
function complete() {
  try {
    learning.markPuzzleComplete(key());
    completed.add(key());
    return true;
  } catch (e) {
    feedback = e.message;
    render();
    return false;
  }
}
function markStudyBeforeRecall(target) {
  const a = learning.snapshot().activeReview;
  if (a && !a.graded && !a.declaredRecited && a.key === target) {
    try {
      learning.updateRecall(a.id, "assisted");
    } catch (e) {
      feedback = e.message;
      render();
      return false;
    }
  }
  return true;
}
let galleryFocus = null;
const memoryCallbacks = {
  currentKey: key,
  onGallery(id = null) {
    galleryFocus = typeof id === "number" && gallerySurahIds.includes(id) ? id : null;
    mode = "gallery";
    reset();
  },
  onLab() {
    if (!markStudyBeforeRecall(key())) return;
    mode = "lab";
    reset();
  },
  onReviewSurah(id) {
    const chapter = surahs.find((s) => s.id === id);
    const ordered = [...chapter.verses].sort((a, b) => {
      const date = (v) => {
        const next = learning.getRecord(`${id}:${v.id}`).memory.nextReview;
        return next ? Date.parse(next) : Infinity;
      };
      return date(a) - date(b);
    });
    memoryCallbacks.onRecall(`${id}:${ordered[0].id}`);
  },
  onDaily() {
    clearTimeout(peekTimer);
    peeking = false;
    stop();
    mode = "daily";
    render();
    transitionCue();
  },
  onRecall(target) {
    clearTimeout(peekTimer);
    peeking = false;
    try {
      const [surahId, ayahId] = target.split(":").map(Number);
      const chapterIndex = surahs.findIndex((s) => s.id === surahId);
      if (chapterIndex < 0) return;
      stop();
      chapter = chapterIndex;
      verses = surahs[chapter].verses;
      ayah = verses.findIndex((v) => v.id === ayahId);
      if (ayah < 0) return;
      const active = learning.snapshot().activeReview;
      if (!active || active.graded || active.key !== target)
        learning.beginRecall(target);
      mode = "review";
      reset();
    } catch (e) {
      feedback = e.message;
      render();
    }
  },
  onStudy(target) {
    if (!markStudyBeforeRecall(target)) return;
    const [s, a] = target.split(":").map(Number);
    stop();
    chapter = surahs.findIndex((x) => x.id === s);
    verses = surahs[chapter].verses;
    ayah = verses.findIndex((v) => v.id === a);
    mode = "practice";
    reset();
  },
  onRecommended(target, nextMode) {
    memoryCallbacks.onStudy(target);
    if (nextMode === "quiz") { mode = "quiz"; reset(); }
  },
  onWalletChange() {
    mountSkyProgress(document.querySelector("main"), learning, surahs, surahs[chapter], key(), mode, memoryCallbacks);
    const current = learning.snapshot();
    preserveAchievements(profileStorage, achievements(current, surahs, summarizeActivity(current, profileStorage)));
    ({ stars, xp, streak } = learning.snapshot().wallet);
    try {
      const result = gallery.sync(learning);
      if (result.unlocks.length) {
        const notice = document.createElement("p");
        notice.className = "mastery-notice";
        notice.textContent = `${result.unlocks.length} artwork section${result.unlocks.length > 1 ? "s" : ""} unlocked through independent recall. `;
        const button = document.createElement("button");
        button.className = "text-button";
        button.textContent = "See my Mastery Gallery";
        button.onclick = () =>
          memoryCallbacks.onGallery(Number(result.unlocks[0].split(":")[0]));
        notice.append(button);
        document.querySelector(".recall-result")?.append(notice);
      }
    } catch (e) {
      const notice = document.createElement("p");
      notice.textContent = e.message;
      document.querySelector(".recall-result")?.append(notice);
    }
  },
};
function bind() {
  document.querySelectorAll("[data-ayah]").forEach(
    (b) =>
      (b.onclick = () => {
        if (mode === "review" || mode === "daily") {
          memoryCallbacks.onRecall(
            `${surahs[chapter].id}:${+b.dataset.ayah + 1}`,
          );
          return;
        }
        ayah = +b.dataset.ayah;
        if (mode === "lab" && !markStudyBeforeRecall(key())) return;
        reset();
      }),
  );
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        reset();
      }),
  );
  document
    .querySelectorAll("[data-listen]")
    .forEach((b) => (b.onclick = () => play(false, +b.dataset.listen)));
  document.querySelectorAll("[data-word]").forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.word;
      if (quizSolved) return;
      if (b.dataset.zone === "bank") add(i);
      else {
        stop();
        selected = selected.filter((x) => x !== i);
        quizSolved = false;
        render();
      }
    };
  });
  bindPieceDrag(app, {
    selection: () => selected,
    count: verses[ayah].words.length + extras.length,
    locked: () => quizSolved,
    change(next, id) {
      stop();
      selected = next;
      feedback = "";
      render();
      document
        .querySelector(`.build-zone [data-word="${id}"]`)
        ?.focus({ preventScroll: true });
    },
  });
  document.querySelector("#clear").onclick = reset;
  document.querySelector("#full-audio").onclick = () => play(true);
  document.querySelector("#practice-audio").onclick = () => play(false);
  document.querySelector("#build-all").onclick = () => {
    stop();
    if (mode === "practice") selected = verses[ayah].words.map((_, i) => i);
    else {
      reset();
      return;
    }
    feedback = "";
    render();
  };
  document.querySelector("#repeat").onchange = (e) =>
    (repeats = +e.target.value);
  document.querySelector("#speed").onchange = (e) => {
    speed = +e.target.value;
    if (audio) audio.playbackRate = speed;
  };
  document.querySelector("#reference-toggle")?.addEventListener("click", () => {
    reference = !reference;
    if (reference) hinted = true;
    render();
  });
  document.querySelector("#reveal-words")?.addEventListener("click", () => {
    if (reveal.size) reveal.clear();
    else hidden.forEach((x) => reveal.add(x));
    render();
  });
  document.querySelector("#next").onclick = () => {
    if (quizSolved) {
      reset();
      return;
    }
    if (mode === "practice") {
      if (!quizCorrect(selected, verses[ayah].words, extras)) {
        feedback =
          "Build all the words in the correct order before marking this ayah complete. You can keep practicing a smaller part.";
        render();
        return;
      }
      if (!complete()) return;
      const successId = `${puzzleSessionId}:practice:${key()}`;
      if (ayah < verses.length - 1) {
        ayah++;
        reset();
      } else {
        feedback = `Beautiful work. You have practiced the final ayah of ${surahs[chapter].name}.`;
        render();
      }
      stop();
      successCue(successId);
    } else {
      if (quizCorrect(selected, verses[ayah].words, extras)) {
        if (!complete()) return;
        quizSolved = mode === "quiz";
        let earned = 0,
          earnedXP = 0,
          rewardCapped = false;
        if (mode === "quiz") {
          const potential = challengeReward(roundLevel, attempts, hinted);
          try {
            const reward = learning.recordPuzzle({
              key: key(),
              sessionId: puzzleSessionId,
              level: roundLevel,
              attempts,
              hinted,
              potential,
            });
            rewardCapped = reward.capped;
            earned = reward.stars;
            earnedXP = reward.xp;
            mastery[key()] = learning.getRecord(key()).game.puzzleWins;
            ({ stars, xp, streak } = learning.snapshot().wallet);
          } catch (e) {
            quizSolved = false;
            feedback = e.message;
            render();
            return;
          }
        }
        feedback =
          "Beautiful work! Every word is in the right place." +
          (mode === "quiz"
            ? ` ★ +${earned} stars · +${earnedXP} XP. ${hinted ? "Try a fresh round without reveals to grow your memory." : challengeLevel(mastery[key()]) > roundLevel ? "New level unlocked! Play again for a bigger memory challenge." : roundLevel === 3 ? "Keep strengthening your puzzle skills. Try a self-assessed recall review too." : "Play again to unlock the next level."}`
            : "") +
          (rewardCapped
            ? " Today’s puzzle reward limit for this level is reached; you can keep practicing without losing any points."
            : "");
        hidden.forEach((x) => reveal.add(x));
        stop();
        successCue(`${puzzleSessionId}:${mode}:${key()}`);
      } else {
        attempts++;
        feedback = selected.some((i) => i >= verses[ayah].words.length)
          ? "Some words belong to another ayah. Return them to the word bank and try again."
          : selected.length < verses[ayah].words.length
            ? "Add all the pieces, then check your order."
            : "A few pieces are out of order. Click a piece to return it, then try again.";
      }
      render();
    }
  };
  document.querySelector("#surah-picker").onchange = (e) => {
    chapter = +e.target.value;
    verses = surahs[chapter].verses;
    ayah = 0;
    if (mode === "lab" && !markStudyBeforeRecall(key())) return;
    if (mode === "review") {
      learning.beginRecall(key());
    }
    reset();
  };
  document.querySelector("#peek-words")?.addEventListener("click", peekWords);
  document.querySelector("#next-ayah")?.addEventListener("click", () => {
    ayah = (ayah + 1) % verses.length;
    reset();
  });
  document.querySelector("#nav-gallery").onclick = memoryCallbacks.onGallery;
  document.querySelector("#nav-lab").onclick = memoryCallbacks.onLab;
  document.querySelector("#nav-daily").onclick = memoryCallbacks.onDaily;
  document.querySelector("#nav-progress").onclick = memoryCallbacks.onDaily;
  document.querySelector("#nav-learn").onclick = () => {
    if (!markStudyBeforeRecall(key())) return;
    mode = "practice";
    reset();
  };
}
configureExperience(isRecallRecordingBusy);
const unfinished = learning.snapshot().activeReview;
if (unfinished && !unfinished.graded) {
  const [s, a] = unfinished.key.split(":").map(Number);
  const c = surahs.findIndex((x) => x.id === s);
  if (c >= 0 && surahs[c].verses.some((v) => v.id === a)) {
    chapter = c;
    verses = surahs[c].verses;
    ayah = verses.findIndex((v) => v.id === a);
    mode = "review";
  }
}
reset();

// Study activity is separate from game XP and independent recall eligibility.
const noteActivity = event => {
  if (!event.target.closest('.piece, .piece-listen, .lab-game button, .falling-stage, [data-grab], [data-sequence-word], #build-all, #practice-audio, #full-audio')) return;
  try { trackStudy(profileStorage, key(), mode, new Date(), learning.snapshot().timeZone); } catch { /* Existing learning remains available if activity storage fails. */ }
};
document.addEventListener('click', noteActivity, true);
document.addEventListener('dragstart', noteActivity, true);

document.addEventListener('ayahappearancechange',()=>{
  if(!document.querySelector('main'))return;
  mountSkyProgress(document.querySelector('main'),learning,surahs,surahs[chapter],key(),mode,memoryCallbacks);
  document.querySelector('.celestial-complete')?.remove();
});
window.addEventListener('ayahprofilechange',resetSkyObserver);
const backdrop=document.createElement('div');backdrop.id='sky-backdrop';backdrop.setAttribute('aria-hidden','true');backdrop.innerHTML='<i></i><i></i><i></i>';document.body.prepend(backdrop);
