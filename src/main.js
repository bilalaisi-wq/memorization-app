import { mountSequence, stopSequence } from "./sequence.js";
import "./style.css";
import {
  surahs,
  totalAyahs,
  shuffled,
  wordAudio,
  verseAudio,
  distractors,
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
let chapter = 0,
  verses = surahs[0].verses,
  peekTimer = null,
  peeking = false,
  roundLevel = 1,
  roundId = 0;
let mastery = {};
try {
  mastery = JSON.parse(localStorage.getItem("ayah-mastery") || "{}");
} catch {}
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
let extras = [],
  attempts = 0,
  quizSolved = false,
  hinted = false,
  stars = 0,
  xp = 0,
  streak = 0;
try {
  const saved = JSON.parse(localStorage.getItem("ayah-quiz") || "{}");
  stars = saved.stars || 0;
  xp = saved.xp || 0;
  streak = saved.streak || 0;
} catch {}
let completed;
try {
  completed = new Set(
    JSON.parse(localStorage.getItem("ayah-completed") || "[]").map((k) =>
      typeof k === "number" ? "1:" + (k + 1) : k,
    ),
  );
} catch {
  completed = new Set();
}
const app = document.querySelector("#app");
function reset() {
  stop();
  clearTimeout(peekTimer);
  peeking = false;
  selected = [];
  roundId++;
  roundLevel = challengeLevel(mastery[key()] || 0);
  const pool = distractors.filter((d) => !verses[ayah].words.includes(d.text));
  extras =
    mode === "quiz"
      ? shuffled(pool.length)
          .slice(0, roundLevel + 3)
          .map((i) => pool[i])
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
  const v = verses[ayah],
    surah = surahs[chapter],
    count = chapterCompleted();
  app.innerHTML = `
<aside class="sidebar"><a class="brand" href="#" aria-label="Ayah home"><span class="brand-mark">۞</span><span>ayah<span class="brand-period">.</span></span></a><div class="sidebar-sub">A LITTLE EACH DAY. A LIFETIME WITH YOU.</div><div class="nav-label">YOUR SPACE</div><button class="nav-item active" id="nav-learn">${icon("grid")} Memorization <span class="nav-pill">${totalAyahs}</span></button><button class="nav-item" id="nav-progress">${icon("book")} My progress</button><div class="surah-label">CHOOSE A SURAH</div><label class="surah-picker-label">Your surah<select id="surah-picker">${surahs.map((s, i) => `<option value="${i}" ${chapter === i ? "selected" : ""}>${s.name} · ${s.verses.length} ayahs</option>`).join("")}</select></label><div class="surah-side"><span class="surah-symbol">${String(surah.id).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])}</span><div><strong>${surah.name}</strong><small>${surah.meaning} · ${verses.length} ayahs</small></div></div><div class="ayah-nav">${verses.map((x, i) => `<button data-ayah="${i}" class="ayah-item ${i === ayah ? "current" : ""}"><span class="ayah-number">${completed.has(surah.id + ":" + (i + 1)) ? "✓" : i + 1}</span><span>Ayah ${i + 1}</span>${i === ayah ? '<span class="current-dot"></span>' : ""}</button>`).join("")}</div><div class="sidebar-bottom"><span class="small-flower">✧</span><p>“And We have certainly made<br>the Quran easy to remember.”</p><small>AL-QAMAR · 54:17</small></div></aside>
<div class="main-shell"><header><div class="breadcrumb">My learning <span>/</span> <strong>${surah.name}</strong></div><div class="header-right"><span class="daily">✧ <b>${completed.size}</b> ayahs practiced</span><span class="avatar">Y</span></div></header><main><div class="page-heading"><div class="eyebrow">MEMORIZE, PIECE BY PIECE</div><h1>Small pieces. Big discoveries.</h1><p>A colorful little adventure, one ayah at a time.</p></div><div class="surah-heading"><div><span class="surah-tag">SURAH ${String(surah.id).padStart(3, "0")}</span><h2>${surah.name} <span lang="ar" class="surah-arabic">${surah.arabic}</span></h2><p>${surah.meaning} <span>•</span> ${surah.origin} <span>•</span> ${verses.length} ayahs</p></div><div class="progress-summary"><span>Your journey <b>${count} / ${verses.length} ayahs</b></span><div class="progress-track"><i style="width:${(count / verses.length) * 100}%"></i></div></div></div>
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
${mode === "quiz" ? `<section class="quest-banner"><span class="quest-mascot" aria-hidden="true">✦</span><div><strong>Ayah ${v.id} quest</strong><p>Find ${v.words.length} words. Leave the ${extras.length} extra words behind!<br><small>Level ${roundLevel} / 3 · ${roundLevel === 1 ? "Find the words" : roundLevel === 2 ? "Some words are blank" : "Most words are blank"} · ${roundLevel === 3 ? "Keep practicing for mastery" : Math.min(2, Math.max(0, (mastery[key()] || 0) - (roundLevel - 1) * 2)) + " / 2 memory wins to level up"}</small></p></div><span class="star-score">★ ${stars} stars <small>${quizSolved ? "Round complete!" : attempts + " tries"}</small></span><div class="level-trail">${[1, 2, 3].map((l) => `<span class="level-step ${l === roundLevel ? "level-active" : ""} ${l < roundLevel ? "level-done" : ""}">${l < roundLevel ? "✓" : l} ${["", "Discover", "Remember", "Master"][l]}</span>`).join("")}</div><div class="xp-line"><strong>Learner level ${1 + Math.floor(xp / 100)}</strong><span>${xp} XP · ${streak} clean rounds in a row</span><progress max="100" value="${xp % 100}" aria-label="Progress toward next learner level"></progress></div><p class="quest-help">Two unassisted wins unlock the next level. Every fresh round earns XP. Reveals help you practice; try again without them to level up.</p></section>` : ""}<section class="builder"><div class="builder-heading"><div><h3>${mode === "practice" ? "Your practice space" : mode === "quiz" ? "Build the ayah in order" : "Bring the missing words to mind"}</h3><p>${mode === "practice" ? "Choose a word or a few. Build the part you want to remember." : mode === "quiz" ? "Choose the right words from the mixed bag, then build from right to left." : "Some words are hidden. Use their shapes and colors to recall them."}</p></div><button class="text-button muted" id="clear">↺ Reset</button></div><div class="build-zone ${selected.length ? "has-pieces" : ""}" data-drop="build" dir="rtl">${selected.length ? selected.map((i) => piece(i, "selected")).join("") : `<div class="empty-zone"><span class="empty-puzzle">${icon("grid")}</span><strong>Let’s put the pieces together!</strong><span>Click or drag word pieces below to begin</span></div>`}</div><div class="build-actions"><span class="selected-count"><span class="tiny-dot"></span> ${selected.length} of ${v.words.length} words selected</span><div><button class="text-button" id="build-all">${mode === "practice" ? "Build full ayah" : "Shuffle pieces"}</button>${mode === "quiz" && hidden.size ? '<button class="text-button" id="peek-words">' + icon("eye") + (peeking ? " Words visible for 8 seconds" : " Peek for 8 seconds") + "</button>" : ""}${mode === "recall" ? '<button class="text-button" id="reveal-words">' + icon("eye") + " Reveal words</button>" : ""}<button class="primary small" id="practice-audio" ${!selected.length ? "disabled" : ""}>${icon(playing ? "pause" : "play")} ${playing ? "Stop" : "Listen to my pieces"}</button></div></div>${mode === "quiz" ? '<p class="sequence-hint">Plays your pieces exactly as arranged, including extra words. Compare with the full ayah.</p>' : ""}<div class="word-bank-heading"><span class="section-label">YOUR WORD PIECES</span><span>Tap headphones to hear any piece <span class="rtl-arrow">←</span></span></div><div class="word-bank" dir="rtl" data-drop="bank">${
    bank
      .filter((i) => !selected.includes(i))
      .map((i) => piece(i, "bank"))
      .join("") ||
    '<span class="bank-empty">Every piece has found a place ✧</span>'
  }</div><div class="builder-footer">${icon("grid")}<span>Match a left tab with the next right socket. Pictures are memory cues, not literal translations.</span></div></section>
<section class="practice-controls"><div class="repeat-label"><span class="control-icon">${icon("repeat")}</span><div><strong>Little repetitions, lasting memory</strong><p>Give your selected words a few more moments.</p></div></div><div class="control-fields"><label>Repeat <select id="repeat"><option value="1" ${repeats === 1 ? "selected" : ""}>1 time</option><option value="3" ${repeats === 3 ? "selected" : ""}>3 times</option><option value="5" ${repeats === 5 ? "selected" : ""}>5 times</option><option value="10" ${repeats === 10 ? "selected" : ""}>10 times</option></select></label><label>Speed <select id="speed">${[0.75, 1, 1.25].map((s) => `<option value="${s}" ${speed === s ? "selected" : ""}>${s}×</option>`).join("")}</select></label></div></section><div class="feedback ${feedback.startsWith("Beautiful") ? "success" : ""}" role="status" aria-live="polite">${feedback}</div><div class="bottom-row">${mode === "quiz" ? '<button class="text-button" id="next-ayah">Next ayah →</button>' : ""}<span>✧ Progress is a practice, not a race.</span><button class="primary" id="next">${mode === "practice" ? "Complete & next ayah" : quizSolved ? "Play again →" : "Check my order"} ${icon(mode === "practice" ? "arrow" : "check")}</button></div><footer>Made for a mindful moment with the Quran.<span>Recitation: Mishary Rashid Alafasy · Uthmanic Hafs script</span></footer></main></div>`;
  bind();
  if (mode === "sequence") mountSequence(document.querySelector("main"), surah);
}
function stop() {
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
  completed.add(key());
  try {
    localStorage.setItem("ayah-completed", JSON.stringify([...completed]));
  } catch {}
}
function bind() {
  document.querySelectorAll("[data-ayah]").forEach(
    (b) =>
      (b.onclick = () => {
        ayah = +b.dataset.ayah;
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
    b.ondragstart = (e) => {
      e.dataTransfer.setData("text/plain", b.dataset.word);
    };
  });
  document.querySelectorAll("[data-drop]").forEach((z) => {
    z.ondragover = (e) => e.preventDefault();
    z.ondrop = (e) => {
      e.preventDefault();
      if (quizSolved) return;
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const i = Number(raw);
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= verses[ayah].words.length + extras.length
      )
        return;
      if (z.dataset.drop === "build") add(i);
      else {
        stop();
        selected = selected.filter((x) => x !== i);
        quizSolved = false;
        render();
      }
    };
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
      complete();
      if (ayah < verses.length - 1) {
        ayah++;
        reset();
      } else {
        feedback = `Beautiful work. You have practiced the final ayah of ${surahs[chapter].name}.`;
        render();
      }
    } else {
      if (quizCorrect(selected, verses[ayah].words, extras)) {
        complete();
        quizSolved = mode === "quiz";
        let earned = 0,
          earnedXP = 0;
        if (mode === "quiz") {
          const reward = challengeReward(roundLevel, attempts, hinted);
          earned = reward.stars;
          earnedXP = reward.xp;
          stars += earned;
          xp += earnedXP;
          streak = !hinted && attempts === 0 ? streak + 1 : 0;
          if (!hinted) mastery[key()] = (mastery[key()] || 0) + 1;
          try {
            localStorage.setItem(
              "ayah-quiz",
              JSON.stringify({ stars, xp, streak }),
            );
            localStorage.setItem("ayah-mastery", JSON.stringify(mastery));
          } catch {}
        }
        feedback =
          "Beautiful work! Every word is in the right place." +
          (mode === "quiz"
            ? ` ★ +${earned} stars · +${earnedXP} XP. ${hinted ? "Try a fresh round without reveals to grow your memory." : challengeLevel(mastery[key()]) > roundLevel ? "New level unlocked! Play again for a bigger memory challenge." : roundLevel === 3 ? "Mastery grows with every repetition. Play again!" : "Play again to unlock the next level."}`
            : "");
        hidden.forEach((x) => reveal.add(x));
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
    reset();
  };
  document.querySelector("#peek-words")?.addEventListener("click", peekWords);
  document.querySelector("#next-ayah")?.addEventListener("click", () => {
    ayah = (ayah + 1) % verses.length;
    reset();
  });
  document.querySelector("#nav-progress").onclick = () => {
    feedback = `Your progress: ${completed.size} of ${totalAyahs} ayahs practiced. ${completed.size === totalAyahs ? `You have practiced all ${surahs.length} surahs!` : "Keep going, one small step at a time."}`;
    render();
    document
      .querySelector(".feedback")
      .scrollIntoView({ behavior: "smooth", block: "center" });
  };
  document.querySelector("#nav-learn").onclick = () => {
    mode = "practice";
    reset();
  };
}
reset();
