import {resolvePlaybackSource} from "./content/private-audio.js";
import { awardStudy } from "./rewards/store.js";
import {
  successCue,
  studyAudioStart,
  studyAudioStop,
} from "./ui/encouragement.js";
import { scrambledBank, quizCorrect, wordAudio, verseAudio } from "./data.js";
import { illustration, outline } from "./illustrations.js";
let state = null,
  root = null,
  currentAudio = null,
  token = 0;
export function stopSequence() {
  studyAudioStop("sequence");
  token++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (state) {
    state.playing = false;
    state.active = "";
  }
}
export function mountSequence(main, surah, initialAyahs = null) {
  stopSequence();
  if (!state || state.surah.id !== surah.id || initialAyahs)
    state = {
      surah,
      chosen: initialAyahs || [1, 2],
      wordOrder: {},
      banks: {},
      chain: [],
      cards: [],
      showReference: true,
      feedback: "",
      repeat: 1,
      speed: 1,
      playing: false,
      active: "",
      started: false,
      pages:{},activePuzzle:null,
    };
  main.querySelector(".reference-card")?.remove();
  let node = main.querySelector(".builder");
  while (node) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
  main.querySelector(".sequence-panel")?.remove();
  root = document.createElement("section");
  root.className = "sequence-panel";
  main.append(root);
  draw();
}
const verse = (id) => state.surah.verses.find((v) => v.id === id);
function start() {
  stopSequence();
  state.started = true;
  state.chain = [];
  state.wordOrder = {};
  state.banks = {};
  for (const id of state.chosen) {
    state.wordOrder[id] = [];
    state.banks[id] = scrambledBank(verse(id).words.length);
  }
  state.cards = scrambledBank(state.chosen.length).map((i) => state.chosen[i]);
  state.feedback = "";
  draw();
}
function wordPiece(id, i) {
  const v = verse(id),
    [meaning, art] = v.meanings[i],
    built = state.wordOrder[id].includes(i);
  return `<div class="piece-wrap"><button class="piece color-${i % 9} ${art === "gold" ? "divine-gold" : ""} ${state.active === id + ":" + i ? "sounding" : ""}" data-chain-word="${id}:${i}" aria-label="${built ? "Return" : "Add"} ${v.roman[i]}" draggable="true"><svg class="puzzle-outline" viewBox="0 0 180 140" preserveAspectRatio="none" aria-hidden="true"><path d="${outline(i, v.words.length)}"/></svg>${art === "gold" ? '<span class="gold-sparkles" aria-hidden="true">✧</span>' : illustration(art)}<span class="arabic" lang="ar" dir="rtl">${v.words[i]}</span><span class="roman">${v.roman[i]}</span><span class="word-meaning">${meaning}</span></button><button class="piece-listen" data-chain-listen="${id}:${i}" aria-label="Listen to this piece">♫</button></div>`;
}
function draw() {
  if (!root?.isConnected) return;
  const s = state;s.pages ||= {};
  const remaining=s.started?s.cards.filter(id=>!s.chain.includes(id)):[];
  if(!remaining.includes(s.activePuzzle))s.activePuzzle=remaining[0];
  const inWindow=(id,i)=>!s.surah.developerOnly||verse(id).words.length<=24||i>=((s.pages[id]||0)*12)&&i<((s.pages[id]||0)*12+12);
  root.innerHTML = `<section class="chain-config"><div><h3>Build your ayah chain</h3><p>Choose two or more ayahs from ${s.surah.name}. Build their words, then connect the ayahs in surah order.</p></div><fieldset><legend>Choose your ayahs</legend><div class="chain-choices">${s.surah.verses.map((v) => `<label><input type="checkbox" data-chain-choice="${v.id}" ${s.chosen.includes(v.id) ? "checked" : ""}> Ayah ${v.id}</label>`).join("")}</div></fieldset><div class="chain-config-actions"><button class="text-button" id="chain-all">${s.surah.developerOnly?"Choose first ten":"Choose all"}</button><button class="primary" id="chain-start" ${s.chosen.length < 2 ? "disabled" : ""}>${s.started ? "Start fresh" : "Start my chain"} →</button></div>${s.chosen.length < 2 ? '<p role="status">Choose at least two ayahs to practice their order.</p>' : ""}</section>
${
  s.started
    ? `<section class="chain-reference"><div class="builder-heading"><h3>Your reference sequence</h3><button class="text-button" id="chain-reference-toggle">${s.showReference ? "Hide" : "Show"} reference</button></div>${s.showReference ? s.chosen.map((id) => `<div class="chain-reference-ayah"><span>Ayah ${id}</span><p class="arabic" lang="ar" dir="rtl">${verse(id).text}</p><small>${verse(id).translation}</small></div>`).join("") : "<p>The reference is hidden. Recall how each ayah leads into the next.</p>"}${s.chosen.some((id, i) => i && id !== s.chosen[i - 1] + 1) ? '<p class="sequence-hint">You chose nonconsecutive ayahs. Practice order follows their positions in the surah and skips the unselected ayahs.</p>' : ""}</section>
<section class="chain-target"><div class="builder-heading"><div><h3>Your ayah sequence</h3><p>First added ayah plays first. Use the arrows to change the order.</p></div><span>${s.chain.length} / ${s.chosen.length} ayahs</span></div><div class="chain-slots" data-chain-drop-order>${s.chain.length ? s.chain.map((id, index) => `<article class="chain-slot" data-chain-card="${id}" draggable="true"><span class="chain-step">${index + 1}</span><p class="arabic" lang="ar" dir="rtl">${s.wordOrder[id].map((i) => verse(id).words[i]).join(" ")}</p><div><button data-chain-move="${id}:-1" ${index === 0 ? "disabled" : ""} aria-label="Move ayah earlier">↑</button><button data-chain-move="${id}:1" ${index === s.chain.length - 1 ? "disabled" : ""} aria-label="Move ayah later">↓</button><button data-chain-remove="${id}">Return to puzzles</button><button data-chain-full="${id}">♫ Listen</button></div></article>`).join("") : "<p>Finish a word puzzle below, then add that ayah here.</p>"}</div><div class="chain-playback"><label>Repeat <select id="chain-repeat">${[1, 3, 5, 10].map((n) => `<option value="${n}" ${s.repeat === n ? "selected" : ""}>${n} ${n === 1 ? "time" : "times"}</option>`).join("")}</select></label><label>Speed <select id="chain-speed">${[0.75, 1, 1.25].map((n) => `<option value="${n}" ${s.speed === n ? "selected" : ""}>${n}×</option>`).join("")}</select></label><button class="primary" id="chain-play" ${!s.chain.length ? "disabled" : ""}>${s.playing ? "Stop audio" : "Listen to my chain"}</button><button class="text-button" id="chain-reference-audio">♫ Listen in surah order</button></div><p class="sequence-hint">“My chain” plays your chosen order. Compare it with the surah-order recording.</p><button class="primary" id="chain-check">Check my sequence ✓</button></section>
${s.surah.developerOnly?`<label>Active word puzzle<select id="chain-active-puzzle">${remaining.map(id=>`<option value="${id}" ${id===s.activePuzzle?'selected':''}>Ayah ${id}</option>`).join('')}</select></label><p>Only one bounded puzzle is shown at a time. Visual pages are not recitation stops; audio stays continuous.</p>`:''}<div class="chain-puzzles"><h3>Your shuffled ayah puzzles</h3><p>Use the words and their meaning to recognize each ayah. The puzzle labels aren’t ayah numbers.</p>${
        s.cards
          .filter((id) => !s.chain.includes(id)&&(!s.surah.developerOnly||id===s.activePuzzle))
          .map(
            (id) =>
              `<section class="chain-puzzle" data-puzzle="${id}"><div class="builder-heading"><h3>Puzzle ${String.fromCharCode(65 + s.cards.indexOf(id))}</h3><button class="text-button" data-chain-reset="${id}">↺ Reset words</button></div><div class="build-zone ${s.wordOrder[id].length ? "has-pieces" : ""}" dir="rtl" data-chain-drop="${id}">${s.wordOrder[id].length ? s.wordOrder[id].filter(i=>inWindow(id,i)).map((i) => wordPiece(id, i)).join("") : "<p>Build this ayah from right to left.</p>"}</div><div class="word-bank" dir="rtl">${s.banks[
                id
              ]
                .filter((i) => inWindow(id,i)&&!s.wordOrder[id].includes(i))
                .map((i) => wordPiece(id, i))
                .join(
                  "",
                )}</div>${s.surah.developerOnly&&verse(id).words.length>24?`<div class="study-workspace-nav"><button data-chain-page="${id}:-1" ${(s.pages[id]||0)===0?'disabled':''}>Previous workspace</button><span>Visual workspace ${(s.pages[id]||0)+1}/${Math.ceil(verse(id).words.length/12)}</span><button data-chain-page="${id}:1" ${(s.pages[id]||0)+1>=Math.ceil(verse(id).words.length/12)?'disabled':''}>Next workspace</button></div>`:''}<div class="chain-puzzle-actions"><button class="text-button" data-chain-preview="${id}" ${!s.wordOrder[id].length ? "disabled" : ""}>♫ Listen to these pieces</button><button class="primary" data-chain-add="${id}" ${s.wordOrder[id].length !== verse(id).words.length ? "disabled" : ""}>Add ayah to chain →</button></div></section>`,
          )
          .join("") ||
        "<p>All your ayahs are in the chain. Check their sequence above!</p>"
      }</div>`
    : ""
}<div class="feedback ${s.feedback.startsWith("Beautiful") ? "success" : ""}" role="status" aria-live="polite">${s.feedback}</div>`;
  bind();
}
async function play(items) {
  if(state.surah.developerOnly)items=items.filter(([id],i)=>i===0||id!==items[i-1][0]).map(([id])=>[id,-1]);
  if (state.playing) {
    stopSequence();
    draw();
    return;
  }
  stopSequence();
  const run = token;
  state.playing = true;
  studyAudioStart("sequence");
  state.feedback = "";
  draw();
  try {
    for (let repeat = 0; repeat < state.repeat; repeat++)
      for (const [id, i] of items) {
        if (run !== token) return;
        state.active = id + ":" + i;
        draw();
        const source=await resolvePlaybackSource(i === -1
              ? verseAudio(id, state.surah.id)
              : wordAudio(id, i, state.surah.id));
        if(run!==token)return;
        await new Promise((resolve,reject)=>{
          currentAudio=new Audio(source);
          currentAudio.playbackRate = state.speed;
          currentAudio.onended = resolve;
          currentAudio.onerror = () => reject(new Error("audio"));
          currentAudio.play().catch(reject);
        });
      }
    if (run !== token) return;
    studyAudioStop("sequence");
    state.playing = false;
    state.active = "";
    state.feedback =
      "Listening complete. Try reciting the transitions yourself.";
    draw();
  } catch {
    if (run !== token) return;
    stopSequence();
    state.feedback =
      "Audio could not load. Check the bundled audio files and try again.";
    draw();
  }
}
function changeWords(id, i, addOnly = false) {
  stopSequence();
  if (
    !state.chosen.includes(id) ||
    !Number.isInteger(i) ||
    i < 0 ||
    i >= verse(id).words.length ||
    state.chain.includes(id)
  )
    return;
  const words = state.wordOrder[id];
  state.wordOrder[id] = words.includes(i)
    ? addOnly
      ? words
      : words.filter((x) => x !== i)
    : [...words, i];
  if(state.surah.developerOnly)state.wordOrder[id].sort((a,b)=>Math.floor(a/12)-Math.floor(b/12));
  state.feedback = "";
  draw();
}
function bind() {
  root.querySelector('#chain-active-puzzle')?.addEventListener('change',e=>{stopSequence();state.activePuzzle=Number(e.target.value);draw();});
  root.querySelectorAll('[data-chain-page]').forEach(b=>b.onclick=()=>{stopSequence();const [id,step]=b.dataset.chainPage.split(':').map(Number);state.pages[id]=Math.max(0,Math.min(Math.ceil(verse(id).words.length/12)-1,(state.pages[id]||0)+step));draw();});
  root.querySelectorAll("[data-chain-choice]").forEach(
    (b) =>
      (b.onchange = () => {
        stopSequence();
        const id = +b.dataset.chainChoice;
        if(state.surah.developerOnly&&b.checked&&state.chosen.length>=10){state.feedback='Choose up to ten ayahs per passage to keep the workspace manageable.';draw();return;}
        state.chosen = b.checked
          ? [...state.chosen, id].sort((a, b) => a - b)
          : state.chosen.filter((x) => x !== id);
        state.started = false;
        state.feedback = "";
        draw();
      }),
  );
  root.querySelector("#chain-all").onclick = () => {
    stopSequence();
    state.chosen = state.surah.verses.slice(0,state.surah.developerOnly?10:undefined).map((v) => v.id);
    state.started = false;
    draw();
  };
  root.querySelector("#chain-start").onclick = start;
  root
    .querySelector("#chain-reference-toggle")
    ?.addEventListener("click", () => {
      state.showReference = !state.showReference;
      draw();
    });
  root.querySelectorAll("[data-chain-word]").forEach((b) => {
    b.onclick = () =>
      changeWords(...b.dataset.chainWord.split(":").map(Number));
    b.ondragstart = (e) =>
      e.dataTransfer.setData("text/plain", "word:" + b.dataset.chainWord);
  });
  root.querySelectorAll("[data-chain-drop]").forEach((b) => {
    b.ondragover = (e) => e.preventDefault();
    b.ondrop = (e) => {
      e.preventDefault();
      const match = /^word:(\d+):(\d+)$/.exec(
        e.dataTransfer.getData("text/plain"),
      );
      if (match && +match[1] === +b.dataset.chainDrop)
        changeWords(+match[1], +match[2], true);
    };
  });
  root
    .querySelectorAll("[data-chain-listen]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          play([b.dataset.chainListen.split(":").map(Number)])),
    );
  root
    .querySelectorAll("[data-chain-full]")
    .forEach((b) => (b.onclick = () => play([[+b.dataset.chainFull, -1]])));
  root
    .querySelectorAll("[data-chain-preview]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          play(
            state.wordOrder[+b.dataset.chainPreview].map((i) => [
              +b.dataset.chainPreview,
              i,
            ]),
          )),
    );
  root.querySelectorAll("[data-chain-add]").forEach(
    (b) =>
      (b.onclick = () => {
        stopSequence();
        const id = +b.dataset.chainAdd;
        if (!quizCorrect(state.wordOrder[id], verse(id).words, [])) {
          state.feedback =
            "A few words in that puzzle are out of order. Return and replace them before adding the ayah.";
          draw();
          return;
        }
        state.chain.push(id);
        state.feedback = "";
        draw();
      }),
  );
  root.querySelectorAll("[data-chain-reset]").forEach(
    (b) =>
      (b.onclick = () => {
        stopSequence();
        const id = +b.dataset.chainReset;
        state.wordOrder[id] = [];
        state.banks[id] = scrambledBank(verse(id).words.length);
        state.feedback = "";
        draw();
      }),
  );
  root.querySelectorAll("[data-chain-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        stopSequence();
        state.chain = state.chain.filter((x) => x !== +b.dataset.chainRemove);
        state.feedback = "";
        draw();
      }),
  );
  root.querySelectorAll("[data-chain-move]").forEach(
    (b) =>
      (b.onclick = () => {
        stopSequence();
        const [id, offset] = b.dataset.chainMove.split(":").map(Number),
          i = state.chain.indexOf(id),
          j = i + offset;
        if (j < 0 || j >= state.chain.length) return;
        [state.chain[i], state.chain[j]] = [state.chain[j], state.chain[i]];
        state.feedback = "";
        draw();
      }),
  );
  root.querySelectorAll("[data-chain-card]").forEach((b) => {
    b.ondragstart = (e) =>
      e.dataTransfer.setData("text/plain", "ayah:" + b.dataset.chainCard);
    b.ondragover = (e) => e.preventDefault();
    b.ondrop = (e) => {
      e.preventDefault();
      const match = /^ayah:(\d+)$/.exec(e.dataTransfer.getData("text/plain"));
      if (!match) return;
      const from = state.chain.indexOf(+match[1]),
        to = state.chain.indexOf(+b.dataset.chainCard);
      if (from < 0 || to < 0) return;
      stopSequence();
      const [id] = state.chain.splice(from, 1);
      state.chain.splice(to, 0, id);
      state.feedback = "";
      draw();
    };
  });
  root
    .querySelector("#chain-repeat")
    ?.addEventListener("change", (e) => (state.repeat = +e.target.value));
  root.querySelector("#chain-speed")?.addEventListener("change", (e) => {
    state.speed = +e.target.value;
    if (currentAudio) currentAudio.playbackRate = state.speed;
  });
  root
    .querySelector("#chain-play")
    ?.addEventListener("click", () => play(state.chain.map((id) => [id, -1])));
  root
    .querySelector("#chain-reference-audio")
    ?.addEventListener("click", () => play(state.chosen.map((id) => [id, -1])));
  root.querySelector("#chain-check")?.addEventListener("click", () => {
    state.feedback =
      state.chain.length !== state.chosen.length
        ? "Add all your chosen ayahs to the chain first."
        : state.chain.every((id, i) => id === state.chosen[i])
          ? "Beautiful work! Your ayahs are in surah order. Replay the chain and practice the transitions."
          : "The ayahs are out of order. Move them earlier or later, then check again.";
    if (
      state.chain.length === state.chosen.length &&
      state.chain.every((id, i) => id === state.chosen[i])
    ) {
      stopSequence();
      awardStudy({mode:"chain",unit:`${state.surah.id}:${state.chosen.join("-")}`,action:"completion",xp:8});
      successCue(
        `chain:${state.surah.id}:${state.chosen.join(",")}`,
        "Your ayahs connect beautifully!",
      );
    }
    draw();
  });
}
