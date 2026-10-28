import {flightNextSteps} from "./arcade/asteroids/next-steps.js";
import {readGoals} from "../learner/insights.js";
import {profileStorage} from "../learner/profile-storage.js";
import {asteroidsRegistration} from "./arcade/asteroids/ui.js";
import { isDeveloperMode } from "../developer/access.js";
import { activeProfileId } from "../learner/profile-storage.js";
import { createRegistry,createLauncher,createContentAdapter,createResultRecorder } from "./arcade/index.js";
import { registrationExample } from "./arcade/example.js";
import { mountFalling } from "./falling-ui.js";
import { labMemoryTips } from "../ui/memory-tips.js";
import {
  successCue,
  transitionCue,
  stopEncouragement,
  studyAudioStart,
  studyAudioStop,
} from "../ui/encouragement.js";
import { wordChoices, passageChoices, textIdentity } from "./lab-choices.js";
import { shuffled, verseAudio, wordAudio } from "../data.js";
import { outline } from "../illustrations.js";
import { esc, clearLearningView, uid } from "../ui/dom.js";
import { gameTypes } from "./puzzle-store.js";
let cleanup = null;
export function stopPuzzleLab() {
  cleanup?.();
  cleanup = null;
}
export const detectivePairs = [
  [113, 4, 5, 2],
  [109, 2, 4, 2],
  [1, 6, 7, 1],
];
export function checkedDetectivePairs(surahs) {
  return detectivePairs.map(([id, a, b, cue]) => {
    const surah = surahs.find((s) => s.id === id),
      first = surah?.verses.find((v) => v.id === a),
      second = surah?.verses.find((v) => v.id === b);
    if (
      !first ||
      !second ||
      first.words.length <= cue ||
      second.words.length <= cue
    )
      throw new Error("Detective source passage unavailable");
    return { surah, first, second, cue };
  });
}
export function mountPuzzleLab(
  main,
  surah,
  verse,
  learning,
  lab,
  callbacks,
  surahs,
) {
  stopPuzzleLab();
  clearLearningView(main);
  main.querySelector(".page-heading h1").textContent = "Puzzle Lab";
  const root = document.createElement("section");
  root.className = "puzzle-lab";
  main.append(root);
  const key = `${surah.id}:${verse.id}`,
    recommendation = lab.recommend(key, learning);
  if (!isDeveloperMode() && !["falling","asteroids","recall"].includes(recommendation.game)) { recommendation.game="falling"; recommendation.reason="Practice visible word order with Falling Words."; }
  root.innerHTML = `<div class="lab-intro"><span class="eyebrow">TRY ANOTHER WAY</span><h2>${esc(surah.name)} · Ayah ${verse.id}</h2><p>These games practice recognition, word order, and recall cues. Game XP is separate from independent spoken memorization and artwork checkpoints.</p><div class="lab-recommendation"><strong>Suggested next step</strong><p>${esc(recommendation.reason)}</p><button class="primary small" id="lab-recommended">${recommendation.game === "recall" ? "Independent recall assessment" : gameTypes.find((g) => g[0] === recommendation.game)[1]}</button></div></div><div class="lab-menu">${[...gameTypes,["arcade-example","Arcade contract preview","Developer-only shared framework example"]].map(([id, title, description]) => `<button ${!["falling","asteroids"].includes(id) && !isDeveloperMode()?"hidden disabled":""} data-game="${id}" class="lab-game-card"><strong>${title}</strong><span>${description}</span></button>`).join("")}</div><div class="lab-settings"><label>Difficulty<select id="lab-level"><option value="1">1 · Visible words</option><option value="2">2 · Fewer cues</option><option value="3">3 · Concealed words</option><option value="4">4 · Minimal hints</option></select></label><button class="text-button" id="lab-restart">Fresh round</button><button class="text-button" id="lab-replay">♫ Replay ayah</button><button class="text-button" id="lab-mute" aria-pressed="false">Mute audio</button></div><section class="lab-game" aria-label="Puzzle play area"></section><p data-status role="status" aria-live="polite"></p><div class="lab-after"><button class="text-button" id="lab-retry-save" hidden>Retry saving this result</button><button class="primary small" id="lab-next-level" hidden>Try fewer hints →</button><button class="text-button" id="lab-recall">Try independent self-assessment →</button></div>${lab.warning ? `<p role="alert">${esc(lab.warning)}</p>` : ""}`;
  const area = root.querySelector(".lab-game"),
    status = root.querySelector("[data-status]");
  let resultKey = key,
    referenceAudio = verseAudio(verse.id, surah.id),
    game = "falling",
    level = 1,
    session = uid(),
    mistakes = 0,
    hinted = false,
    done = false,
    gameCleanup = null,
    audio = null,
    audioRun = 0,
    muted = localStorage.getItem("ayah-lab-muted") === "true",
    choiceEntries = [],
    pendingAudio = [],
    pauseGame = () => {},
    fallingControl = null,
    arcadeMeta = null;
  const say = (text) => {
    status.textContent = text;
    status.dataset.tone = "info";
  };
  const stopAudio = () => {
    studyAudioStop("lab");
    audioRun++;
    pendingAudio = [];
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
  };
  const playAudio = async (url, assistance = false, automatic = false) => {
    if (automatic && audio) { pendingAudio.push(url); return; }
    if (!automatic) pauseGame();
    stopAudio();
    studyAudioStart("lab");
    if (assistance) hinted = true;
    const run = audioRun;
    const urls = Array.isArray(url) ? url : [url];
    const playNext = async (i) => {
      if (run !== audioRun) return;
      if (i >= urls.length) {
        audio = null;
        studyAudioStop("lab");
        const next = pendingAudio.shift();
        if (next) {
          const remaining = pendingAudio;
          playAudio(next, false, true);
          pendingAudio = remaining;
        }
        return;
      }
      audio = new Audio(urls[i]);
      audio.muted = muted;
      audio.onended = () => playNext(i + 1);
      audio.onerror = () => {
        if (run === audioRun) {
          audio = null;
          pendingAudio = [];
          studyAudioStop("lab");
          say("Audio could not load. You can continue the puzzle.");
        }
      };
      try {
        await audio.play();
      } catch {
        if (run === audioRun) {
          audio = null;
          pendingAudio = [];
          studyAudioStop("lab");
          say("Audio could not start. Try again.");
        }
      }
    };
    await playNext(0);
  };
  const fail = (message) => {
    if (done) return;
    mistakes++;
    say(message || "Try another arrangement. No points are lost.");
    status.dataset.tone = "error";
  };
  const finish = () => {
    if (done) return;
    pauseGame();
    if (game !== "falling") area
      .querySelectorAll("button:not([data-lab-audio])")
      .forEach((b) => (b.disabled = true));
    try {
      const reward = learning.recordLabPuzzle({
        key: resultKey,
        sessionId: session,
        game,
        mistakes,
        hinted,
      });
      lab.record({
        key: resultKey,
        sessionId: session,
        game,
        mistakes,
        hinted,
        xp: reward.xp,
        ...(arcadeMeta ? {arcade:arcadeMeta} : {}),
      });
      done = true;
      root.querySelector("#lab-retry-save").hidden = true;
      callbacks.onWalletChange();
      successCue(
        `${session}:complete`,
        "Challenge complete — beautifully done!",
      );
      say(
        `Challenge complete! +${reward.duplicate ? 0 : reward.xp} game XP. ${reward.xp && !reward.duplicate ? "" : "Today’s reward ceiling for this game is reached. "}This does not certify independent memorization.`,
      );
      if (game !== "falling") area
        .querySelectorAll("button:not([data-lab-audio])")
        .forEach((b) => (b.disabled = true));
      root.querySelector("#lab-next-level").hidden =
        level >= 4 || ["falling", "match", "detective"].includes(game);
    } catch (e) {
      root.querySelector("#lab-retry-save").hidden = false;
      say(e.message + " Your result can be retried without duplicate XP.");
    }
  };
  const wordsHTML = (words) => words.map((w) => esc(w)).join(" ");
  const button = (index, text, attrs = "") =>
    `<button class="lab-word" data-choice="${index}" ${attrs}><span class="arabic" lang="ar" dir="rtl">${esc(text)}</span></button>`;
  const listenButton = (id) =>
    `<button class="lab-choice-audio" data-lab-audio="${id}" aria-label="Hear this choice">♫</button>`;
  const bindChoiceAudio = (entries) => {
    choiceEntries = entries;
    area.querySelectorAll("[data-lab-audio]").forEach((b) => {
      b.onclick = () => playAudio(entries[Number(b.dataset.labAudio)].audio);
    });
  };
  function start(next = game) {
    if (!["falling","asteroids"].includes(next) && !isDeveloperMode()) return;
    const changedMode = next !== game;
    stopEncouragement();
    gameCleanup?.();
    fallingControl = null;
    arcadeMeta = null;
    stopAudio();
    pauseGame = () => {};
    game = next;
    const tipText = root.querySelector(".memory-pro-tip p");
    if (tipText) tipText.textContent = labMemoryTips[game] || "Say each word aloud as you practice. Arcade practice is separate from independent recall.";
    resultKey = key;
    referenceAudio = verseAudio(verse.id, surah.id);
    level = Number(root.querySelector("#lab-level").value);
    session = uid();
    mistakes = 0;
    hinted = false;
    done = false;
    say("");
    root.querySelectorAll("[data-game]").forEach((b) => {
      b.classList.toggle("active", b.dataset.game === game);
      b.setAttribute("aria-pressed", String(b.dataset.game === game));
    });

    root.querySelector("#lab-next-level").hidden = true;
    root.querySelector("#lab-retry-save").hidden = true;
    const levelControl = root.querySelector("#lab-level");
    levelControl.closest("label").hidden = ["falling", "asteroids", "arcade-example", "match", "detective"].includes(
      game,
    );
    const labels = {
      vanishing: ["25% hidden", "50% hidden", "75% hidden", "100% hidden"],
      jigsaw: [
        "Meanings and transliteration",
        "No meanings",
        "Concealed groups",
        "No positional hints",
      ],
      chain: [
        "Visible ayahs",
        "Visible ayahs",
        "Short opening cues",
        "One-word cues",
      ],
      continue: [
        "Opening phrase",
        "Opening phrase",
        "Shorter cue",
        "Shorter cue",
      ],
    }[game];
    if (labels)
      [...levelControl.options].forEach(
        (option, i) => (option.textContent = `${i + 1} · ${labels[i]}`),
      );
    if (game === "asteroids") asteroids();
    else if (game === "arcade-example") arcadePreview();
    else if (game === "falling") falling();
    else if (game === "vanishing") vanishing();
    else if (game === "jigsaw") jigsaw();
    else if (game === "match") match();
    else if (game === "chain") chain();
    else if (game === "continue") continuation();
    else detective();
    if (changedMode) transitionCue();
  }
  function asteroids() {
    const registry=createRegistry();registry.register(asteroidsRegistration);
    const launcher=createLauncher(registry),adapter=createContentAdapter(surahs);
    const record=createResultRecorder({learning,lab,accountId:activeProfileId(),getAccountId:activeProfileId});
    let cancelled=false,launchRun=0;
    area.innerHTML=`<form class="astro-config"><h3>Choose your space voyage</h3><p>Navigate your ship, aim a tractor beam and capture the ayah in order. Extra words are redirected intact.</p><div class="astro-config-fields"><label>Journey<select name="journey"><option value="single">Single Ayah</option><option value="chain">Ayah Chain</option></select></label><label>Starting ayah<input name="first" type="number" min="1" max="${surah.verses.at(-1).id}" value="${verse.id}"></label><label>Through ayah<input name="last" type="number" min="1" max="${surah.verses.at(-1).id}" value="${verse.id}"></label><label>Checkpoints<select name="rules"><option value="classic">Classic · three strikes per run</option><option value="practice">Practice · three per ayah</option></select></label><label>Flight difficulty<select name="difficulty"><option value="beginner">Beginner · slower, next-word cue</option><option value="standard">Standard · busier space, fewer cues</option><option value="expert">Expert · verified phrases, similar distractors</option></select></label></div><p>Expert uses approved phrases or short whole ayahs. Unreviewed long phrases are unavailable.</p><button class="primary" type="submit">Prepare flight</button><p data-flight-error role="status"></p></form><div data-flight-host></div>`;
    const form=area.querySelector('form'),host=area.querySelector('[data-flight-host]'),error=area.querySelector('[data-flight-error]');
    const through=form.elements.last;through.disabled=true;form.elements.journey.onchange=()=>through.disabled=form.elements.journey.value==='single';
    let nextLaunchAudio="listen",autoStart=false;
    const launchFlight=async()=>{const token=++launchRun,button=form.querySelector('[type=submit]');button.disabled=true;error.textContent='Preparing verified flight pieces…';
      try {
        const first=Number(form.elements.first.value),difficulty=form.elements.difficulty.value;
        const config=adapter.configure({surah:surah.id,start:first,end:form.elements.journey.value==='single'?first:Number(through.value),mode:form.elements.journey.value,chainMode:form.elements.rules.value,seed:crypto.getRandomValues(new Uint32Array(1))[0]});
        const reviews={};
        for(const key of config.keys) {
          const canonical=adapter.words(key);
          if((difficulty==='expert'&&canonical.length>8)||canonical.length>40){
            const bundle=await callbacks.getArcadeBundle?.(key);
            if(cancelled||token!==launchRun)return;
            const review=bundle?.segmentationReview;
            if(!review || review.verseKey!==key || review.sourceHash!==bundle.contentRevision || !review.version || bundle.words.length!==canonical.length || bundle.words.some((w,i)=>w.text!==canonical[i].text))throw Error(`${key}: published teacher-approved phrase boundaries are not available. Use Beginner/Standard for short ayahs.`);
            reviews[key]=review.segments.map(s=>({key,startWord:s.startWord-1,endWord:s.endWord,status:s.displayStatus,reviewId:`${key}:v${review.version}`,stopStatus:s.stopStatus,recitationStop:s.recitationStop}));
          }
        }
        if(cancelled||token!==launchRun)return;
        fallingControl=launcher.launch('asteroids',{root:host,adapter,config,library:surahs,id:uid(),difficulty,reviews,muted:()=>muted,onComplete:s=>{record(s);callbacks.onWalletChange();},initialAudioMode:nextLaunchAudio,
          getNextSteps:s=>flightNextSteps({session:s.session,elapsed:s.elapsed,goals:readGoals(profileStorage),due:learning.daily().dueNow,history:lab.snapshot().history,lastAyah:surah.verses.at(-1).id}),
          onRecall:target=>callbacks.onRecall(target),onPractice:target=>callbacks.onStudy(target),
          onJourney:async choice=>{
            nextLaunchAudio=choice.audioMode;
            if(choice.kind==='customize'){form.scrollIntoView({block:'start'});form.elements.first.focus();return;}
            const range=choice.kind==='continue'?choice.next:{first:Number(choice.config.keys[0].split(':')[1]),last:Number(choice.config.keys.at(-1).split(':')[1])};
            if(!range)throw Error('This surah is complete. Choose another surah from study.');
            form.elements.rules.value=choice.config.chainMode;form.elements.difficulty.value=difficulty;
            form.elements.first.value=String(range.first);through.value=String(range.last);
            form.elements.journey.value=range.first===range.last?'single':'chain';through.disabled=range.first===range.last;
            nextLaunchAudio=choice.audioMode;autoStart=true;await launchFlight();
          },onExit:target=>callbacks.onStudy(target)});
        const startedAutomatically=autoStart;
        if(autoStart){autoStart=false;fallingControl.start();}
        error.textContent=startedAutomatically?'Starting your next flight…':'Ready. Press Start flight below.';host.scrollIntoView({block:'start'});
      }catch(e){if(!cancelled){error.textContent=e.message;if(autoStart){autoStart=false;throw e;}}}finally{if(!cancelled)button.disabled=false;}
    };
    form.onsubmit=e=>{e.preventDefault();autoStart=false;launchFlight();};
    pauseGame=()=>fallingControl?.pause();
    gameCleanup=()=>{cancelled=true;launchRun++;launcher.dispose();};
  }
  function arcadePreview() {
    const registry=createRegistry(); registry.register(registrationExample);
    const launcher=createLauncher(registry),adapter=createContentAdapter(surahs);
    const getAccountId=activeProfileId;
    const record=createResultRecorder({learning,lab,accountId:getAccountId(),getAccountId});
    area.innerHTML=`<h3>Shared arcade configuration</h3><label>Journey<select data-journey><option value="single">Single Ayah</option><option value="chain">Ayah Chain</option></select></label><label>Through ayah<input data-end type="number" min="${verse.id}" max="${surah.verses.at(-1).id}" value="${verse.id}"></label><label>Checkpoint rules<select data-rules><option value="classic">Classic · restart chain</option><option value="practice">Practice · keep checkpoints</option></select></label><label>Speed profile<select data-speed><option value="gentle">Gentle</option><option value="steady">Steady</option><option value="swift">Swift</option></select></label><button class="primary" data-launch>Launch preview</button><section data-arcade-host aria-label="Arcade preview"></section>`;
    area.querySelector('[data-launch]').onclick=()=>{
      if(!isDeveloperMode())return;
      try {
        const mode=area.querySelector('[data-journey]').value;
        const config=adapter.configure({surah:surah.id,start:verse.id,end:mode==='single'?verse.id:Number(area.querySelector('[data-end]').value),mode,chainMode:area.querySelector('[data-rules]').value,profile:area.querySelector('[data-speed]').value,seed:1});
        config.keys.forEach(k=>adapter.choices(k)); // refuse unsupported long-ayah workspaces before launch
        fallingControl=launcher.launch('arcade-example',{muted:()=>muted,root:area.querySelector('[data-arcade-host]'),adapter,config,id:uid(),onComplete:s=>{record(s);callbacks.onWalletChange();}},{developer:isDeveloperMode()});
      } catch(e){say(e.message);}
    };
    pauseGame=()=>fallingControl?.pause();
    gameCleanup=()=>launcher.dispose();
  }
  function falling() {
    const control = mountFalling(area, {
      surah, verse, level, muted: () => muted, say,
      onScope(target) { resultKey=target;session=uid(); done=false; },
      onFinish(meta) { arcadeMeta=meta; mistakes=meta.errors.length; hinted ||= meta.usedAudio; finish(); },
      onFailure(meta) {
        try {
          lab.record({key:resultKey,sessionId:`${session}:failed:${uid()}`,game:"falling",mistakes:meta.errors.length,hinted:true,xp:0,arcade:meta});
          return true;
        } catch(e) { say(`Your attempt could not be saved: ${e.message}`); return false; }
      },
      onExit: () => callbacks.onStudy(key),
    });
    fallingControl=control;
    pauseGame=()=>control.pause();
    gameCleanup=()=>control.dispose();

  }
  function vanishing() {
    const fraction = [0.25, 0.5, 0.75, 1][level - 1],
      hide = new Set(
        shuffled(verse.words.length).slice(
          0,
          Math.ceil(verse.words.length * fraction),
        ),
      );
    const entries = wordChoices(surah, verse, level + 2);
    const missing = [...hide].sort((a, b) => a - b),
      picked = [],
      remaining = new Set([
        ...missing,
        ...entries.map((_, i) => i).filter((i) => i >= verse.words.length),
      ]);
    const draw = () => {
      area.innerHTML = `<h3>Vanishing Ayah · ${Math.round(fraction * 100)}% hidden</h3><p>Choose the missing words in order from right to left. Ignore extra words from other ayahs. Increase Difficulty for the next concealment step.</p><div class="vanishing-line" dir="rtl">${verse.words.map((w, i) => `<span class="arabic" lang="ar">${!hide.has(i) || picked.includes(i) ? esc(w) : "▢"}</span>`).join(" ")}</div><div class="lab-bank" dir="rtl">${shuffled(
        remaining.size,
      )
        .map((p) => [...remaining][p])
        .map(
          (i) =>
            `<div class="lab-choice-wrap">${button(i, entries[i].text)}${listenButton(i)}</div>`,
        )
        .join(
          "",
        )}</div><button class="text-button" id="vanish-reveal">Reveal answer (study help)</button>`;
      area.querySelectorAll("[data-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            const index = Number(b.dataset.choice),
              target = missing[picked.length];
            if (
              index >= verse.words.length ||
              verse.words[index] !== verse.words[target]
            ) {
              fail("Try a different missing word.");
              return;
            }
            remaining.delete(index);
            picked.push(target);
            successCue(`${session}:missing:${target}`, "You found the word!");
            draw();
            if (picked.length === missing.length) finish();
          }),
      );
      bindChoiceAudio(entries);
      area.querySelector("#vanish-reveal").onclick = () => {
        hinted = true;
        area.querySelector(".vanishing-line").innerHTML =
          `<span class="arabic" lang="ar">${wordsHTML(verse.words)}</span>`;
        say("Answer revealed for study. Try rebuilding it in a fresh round.");
      };
    };
    draw();
    gameCleanup = () => {};
  }
  function jigsaw() {
    const size = verse.words.length > 4 ? 3 : 2,
      groups = [];
    for (let i = 0; i < verse.words.length; i += size)
      groups.push({
        words: verse.words.slice(i, i + size),
        start: i,
        roman: verse.roman.slice(i, i + size),
        meanings: verse.meanings.slice(i, i + size),
        audio: Array.from(
          { length: Math.min(size, verse.words.length - i) },
          (_, k) => wordAudio(verse.id, i + k, surah.id),
        ),
      });
    const targetCount = groups.length;
    groups.push(
      ...passageChoices(
        surahs,
        surah.id,
        [verse.words, ...groups.map((g) => g.words)],
        groups.map((g) => g.words.length),
        level + 2,
      ),
    );
    const concealedIds = new Set(
      shuffled(groups.length).slice(0, Math.ceil(groups.length / 2)),
    );
    const bank = shuffled(groups.length),
      selected = [];
    const draw = () => {
      const piece = (i) => {
        const group = groups[i],
          concealed = level >= 3 && concealedIds.has(i);
        return `<div class="lab-choice-wrap"><button class="lab-group" data-group="${i}" style="--group-color:${["#f0d6a1", "#d4e8cd", "#d9dff1", "#f4d5d5"][i % 4]}">${level < 4 ? `<svg viewBox="0 0 180 140" aria-hidden="true"><path d="${outline(i % targetCount, targetCount)}"/></svg>` : ""}<span class="arabic" lang="ar" dir="rtl">${concealed ? "؟" : wordsHTML(group.words)}</span>${level < 3 ? `<small>${esc(group.roman.join(" "))}</small>` : ""}${
          level === 1
            ? `<small>${esc(
                group.meanings.map((m) => m[0]).join(" · "),
              )}</small>`
            : ""
        }</button>${listenButton(i)}</div>`;
      };
      area.innerHTML = `<h3>Ayah Jigsaw</h3><p>Choose the ayah’s word groups and build from right to left. Ignore foreign groups; tap a built group to remove it.</p><div class="lab-build" dir="rtl">${selected.map(piece).join("") || "Your connected groups go here"}</div><div class="lab-bank" dir="rtl">${bank
        .filter((i) => !selected.includes(i))
        .map(piece)
        .join(
          "",
        )}</div><button class="primary small" id="jigsaw-check">Check grouped ayah</button><button class="text-button" id="jigsaw-reveal">Reveal group words</button>`;
      area.querySelectorAll("[data-group]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.group),
              p = selected.indexOf(i);
            if (p >= 0) selected.splice(p, 1);
            else selected.push(i);
            draw();
          }),
      );
      bindChoiceAudio(groups);
      area.querySelector("#jigsaw-check").onclick = () => {
        if (
          selected.map((i) => groups[i].words.join(" ")).join(" ") ===
          verse.words.join(" ")
        )
          finish();
        else fail("The groups need another arrangement.");
      };
      area.querySelector("#jigsaw-reveal").onclick = () => {
        hinted = true;
        area
          .querySelectorAll("[data-group] .arabic")
          .forEach(
            (span) =>
              (span.textContent =
                groups[
                  Number(span.closest("[data-group]").dataset.group)
                ].words.join(" ")),
          );
      };
    };
    draw();
    gameCleanup = () => {};
  }
  function match() {
    let subtype = "meaning",
      cards = [],
      flipped = [],
      matched = new Set(),
      expectedPairs = 0;
    function setup() {
      const seen = new Set(),
        pairs = [];
      if (subtype === "continuation") {
        for (const v of surah.verses) {
          const n = Math.ceil(v.words.length / 2);
          if (n >= v.words.length) continue;
          const opening = v.words.slice(0, n).join(" "),
            tail = v.words.slice(n).join(" ");
          if (seen.has(opening) || seen.has(tail)) continue;
          seen.add(opening);
          seen.add(tail);
          pairs.push([
            {
              text: opening,
              arabic: true,
              audio: Array.from({ length: n }, (_, i) =>
                wordAudio(v.id, i, surah.id),
              ),
            },
            {
              text: tail,
              arabic: true,
              audio: Array.from({ length: v.words.length - n }, (_, i) =>
                wordAudio(v.id, n + i, surah.id),
              ),
            },
          ]);
          if (pairs.length === 4) break;
        }
      } else
        for (let i = 0; i < verse.words.length; i++) {
          if (seen.has(verse.words[i]) || seen.has(verse.meanings[i][0]))
            continue;
          seen.add(verse.words[i]);
          seen.add(verse.meanings[i][0]);
          pairs.push([
            {
              text: verse.words[i],
              arabic: true,
              audio: wordAudio(verse.id, i, surah.id),
            },
            {
              text:
                subtype === "audio" ? "♫ Hear the word" : verse.meanings[i][0],
              arabic: false,
              audio: wordAudio(verse.id, i, surah.id),
            },
          ]);
          if (pairs.length === 4) break;
        }
      expectedPairs = pairs.length;
      if (subtype === "continuation") {
        const used = new Set(
          pairs.flat().map((c) => textIdentity(c.text.split(" "))),
        );
        for (const passage of passageChoices(
          surahs,
          surah.id,
          pairs.flat().map((c) => c.text.split(" ")),
          [null],
          30,
        )) {
          const n = Math.ceil(passage.words.length / 2);
          if (n === passage.words.length) continue;
          const opening = passage.words.slice(0, n).join(" "),
            tail = passage.words.slice(n).join(" ");
          if (
            used.has(textIdentity(opening.split(" "))) ||
            used.has(textIdentity(tail.split(" ")))
          )
            continue;
          used.add(textIdentity(opening.split(" ")));
          used.add(textIdentity(tail.split(" ")));
          pairs.push([
            {
              text: opening,
              arabic: true,
              audio: Array.from({ length: n }, (_, i) =>
                wordAudio(passage.ayah, i, passage.surah),
              ),
            },
            {
              text: tail,
              arabic: true,
              audio: Array.from({ length: passage.words.length - n }, (_, i) =>
                wordAudio(passage.ayah, n + i, passage.surah),
              ),
            },
          ]);
          if (pairs.length === expectedPairs + 2) break;
        }
      } else {
        const usedMeanings = new Set(
          verse.meanings.map((m) => m[0].toLowerCase().trim()),
        );
        for (const word of wordChoices(surah, verse, 16).slice(
          verse.words.length,
        )) {
          if (usedMeanings.has(word.meaning.toLowerCase().trim())) continue;
          usedMeanings.add(word.meaning.toLowerCase().trim());
          pairs.push([
            { text: word.text, arabic: true, audio: word.audio },
            {
              text: subtype === "audio" ? "♫ Hear the word" : word.meaning,
              arabic: false,
              audio: word.audio,
            },
          ]);
          if (pairs.length === expectedPairs + 2) break;
        }
      }
      const all = pairs.flatMap((pair, id) =>
        pair.map((card) => ({ ...card, pair: id })),
      );
      cards = shuffled(all.length).map((i) => all[i]);
      flipped = [];
      matched = new Set();
      draw();
    }
    const draw = () => {
      area.innerHTML = `<h3>Memory Match</h3><p>Match only the selected ayah’s words (or this surah’s openings and continuations). Leave foreign pairs unmatched.</p><label>Pair type<select id="match-type"><option value="meaning">Word and meaning</option><option value="audio">Word and audio</option><option value="continuation">Opening and continuation</option></select></label><div class="match-grid">${cards.map((c, i) => `<div class="lab-choice-wrap"><button data-card="${i}" data-pair="${c.pair}" class="match-card ${matched.has(c.pair) ? "matched" : ""}" ${matched.has(c.pair) ? "disabled" : ""} aria-label="${matched.has(c.pair) ? "Matched: " + esc(c.text) : flipped.includes(i) ? esc(c.text) : `Turn card ${i + 1}`}">${matched.has(c.pair) || flipped.includes(i) ? `<span ${c.arabic ? 'class="arabic" lang="ar" dir="rtl"' : ""}>${esc(c.text)}</span>` : "✦"}</button>${listenButton(i)}</div>`).join("")}</div><button class="text-button" id="match-reset-pair" ${flipped.length === 2 ? "" : "hidden"}>Try another pair</button>`;
      area.querySelector("#match-type").value = subtype;
      area.querySelector("#match-type").onchange = (e) => {
        subtype = e.target.value;
        session = uid();
        done = false;
        mistakes = 0;
        hinted = false;
        stopAudio();
        setup();
      };
      area.querySelectorAll("[data-card]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.card);
            if (flipped.includes(i) || flipped.length === 2) return;
            flipped.push(i);
            if (flipped.length === 2) {
              if (
                cards[flipped[0]].pair === cards[flipped[1]].pair &&
                cards[i].pair < expectedPairs
              ) {
                matched.add(cards[i].pair);
                successCue(
                  `${session}:pair:${cards[i].pair}`,
                  "A perfect match!",
                );
                flipped = [];
              } else
                fail(
                  cards[flipped[0]].pair === cards[flipped[1]].pair
                    ? "That pair is from another ayah or surah. Leave it unmatched."
                    : "Those cards do not form a pair. Listen or look, then try another pair.",
                );
            }
            draw();
            if (matched.size === expectedPairs && expectedPairs) finish();
          }),
      );
      bindChoiceAudio(cards);
      area.querySelector("#match-reset-pair").onclick = () => {
        flipped = [];
        draw();
      };
    };
    setup();
    gameCleanup = () => {};
  }
  function chain() {
    const startIndex = Math.min(
        surah.verses.indexOf(verse),
        Math.max(0, surah.verses.length - 3),
      ),
      passage = surah.verses.slice(startIndex, startIndex + 5),
      selected = [];
    const targetCount = passage.length;
    const cards = passage.map((v) => ({
      words: v.words,
      audio: [verseAudio(v.id, surah.id)],
    }));
    cards.push(
      ...passageChoices(
        surahs,
        surah.id,
        passage.map((v) => v.words),
        [null],
        level + 2,
      ),
    );
    const bank = shuffled(cards.length);
    const draw = () => {
      const card = (i) =>
        `<div class="lab-choice-wrap"><button class="chain-lab-card" data-chain="${i}"><span class="arabic" lang="ar" dir="rtl">${wordsHTML(level >= 3 ? cards[i].words.slice(0, level === 4 ? 1 : 2) : cards[i].words)}</span>${level >= 3 ? "<small>Opening cue only</small>" : ""}</button>${listenButton(i)}</div>`;
      area.innerHTML = `<h3>Broken Chain</h3><p>Restore ayahs ${passage[0].id}–${passage.at(-1).id} in their surah order. Ignore ayahs outside this passage. Tap a chosen ayah to undo it.</p><div class="lab-chain-build">${selected.map(card).join("") || "Choose the first ayah below"}</div><div class="lab-chain-bank">${bank
        .filter((i) => !selected.includes(i))
        .map(card)
        .join(
          "",
        )}</div><button class="primary small" id="chain-check">Check ayah sequence</button>`;
      area.querySelectorAll("[data-chain]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.chain),
              p = selected.indexOf(i);
            if (p >= 0) selected.splice(p, 1);
            else selected.push(i);
            draw();
          }),
      );
      bindChoiceAudio(cards);
      area.querySelector("#chain-check").onclick = () => {
        if (
          selected.length === targetCount &&
          selected.every(
            (v, i) =>
              textIdentity(cards[v].words) === textIdentity(passage[i].words),
          )
        )
          finish();
        else fail("Try another ayah sequence.");
      };
    };
    draw();
    gameCleanup = () => {};
  }
  function continuation() {
    const cue = Math.max(
        1,
        Math.floor(verse.words.length / (level >= 3 ? 4 : 3)),
      ),
      opening = verse.words.slice(0, cue),
      tail = verse.words.slice(cue);
    if (!tail.length) {
      area.innerHTML =
        "<h3>Continue the Ayah</h3><p>This ayah is one word. Try full independent self-assessment using the button below, or choose another ayah for continuation practice.</p>";
      gameCleanup = () => {};
      return;
    }
    const choices = wordChoices(surah, verse, level + 2);
    const entries = [
      ...choices.slice(cue, verse.words.length),
      ...choices.slice(verse.words.length),
    ];
    const bank = shuffled(entries.length),
      selected = [];
    let compared = false,
      checked = false,
      revealed = false;
    const draw = () => {
      const choice = (i) =>
        `<div class="lab-choice-wrap">${button(i, entries[i].text)}${listenButton(i)}</div>`;
      area.innerHTML = `<h3>Continue the Ayah</h3><p>Use the opening and try the rest from memory. Then build the remainder in order, ignoring extra words. This cued practice is not an independent mastery checkpoint.</p><p class="arabic lab-opening" lang="ar" dir="rtl">${wordsHTML(opening)}</p><button class="primary small" id="continue-compare" ${compared ? "disabled" : ""}>I tried the remainder — build and compare</button><div class="continue-answer" ${compared ? "" : "hidden"}><div class="lab-build" dir="rtl">${selected.map(choice).join("") || "Build the remainder here"}</div><div class="lab-bank" dir="rtl">${bank
        .filter((i) => !selected.includes(i))
        .map(choice)
        .join(
          "",
        )}</div><button class="primary small" id="continue-check">Check my remainder</button><button class="text-button" id="continue-again">I need the answer first</button>${revealed ? `<p class="arabic" lang="ar" dir="rtl">${wordsHTML(tail)}</p>` : ""}<button class="primary small" id="continue-good" ${checked ? "" : "disabled"}>I recalled and built the remainder correctly</button></div>`;
      area.querySelector("#continue-compare").onclick = () => {
        compared = true;
        draw();
      };
      area.querySelectorAll("[data-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.choice),
              p = selected.indexOf(i);
            if (p >= 0) selected.splice(p, 1);
            else selected.push(i);
            checked = false;
            draw();
          }),
      );
      bindChoiceAudio(entries);
      area.querySelector("#continue-check").onclick = () => {
        if (selected.map((i) => entries[i].text).join(" ") === tail.join(" ")) {
          checked = true;
          say(
            "The remainder fits. Compare your spoken attempt before completing.",
          );
          draw();
        } else
          fail(
            "Some words do not belong, or the remainder is out of order. Remove and replace them.",
          );
      };
      area.querySelector("#continue-again").onclick = () => {
        hinted = true;
        revealed = true;
        fail(
          "Answer revealed for study. Still build the correct remainder to complete.",
        );
        draw();
      };
      area.querySelector("#continue-good").onclick = () => {
        if (checked) finish();
      };
    };
    draw();
    gameCleanup = () => {};
  }

  function detective() {
    const pairs = checkedDetectivePairs(surahs),
      local = pairs.find((p) => p.surah.id === surah.id),
      pair = local || pairs[Math.floor(Math.random() * pairs.length)];
    resultKey = `${pair.surah.id}:${pair.first.id}`;
    referenceAudio = verseAudio(pair.first.id, pair.surah.id);
    const entries = [
      {
        words: pair.first.words.slice(pair.cue),
        audio: pair.first.words
          .slice(pair.cue)
          .map((_, i) => wordAudio(pair.first.id, pair.cue + i, pair.surah.id)),
      },
      {
        words: pair.second.words.slice(pair.cue),
        audio: pair.second.words
          .slice(pair.cue)
          .map((_, i) =>
            wordAudio(pair.second.id, pair.cue + i, pair.surah.id),
          ),
      },
    ];
    entries.push(
      ...passageChoices(
        surahs,
        pair.surah.id,
        entries.map((e) => e.words),
        [entries[0].words.length, entries[1].words.length],
        level + 1,
      ),
    );
    const options = shuffled(entries.length);
    area.innerHTML = `<h3>Similar Ayah Detective</h3><p>Which continuation belongs to ${esc(pair.surah.name)}, ayah ${pair.first.id}? All choices are authentic Quran passages. Choose the right continuation and ignore the others.</p><p class="arabic lab-opening" lang="ar" dir="rtl">${wordsHTML(pair.first.words.slice(0, pair.cue))}</p><div class="detective-options">${options.map((i) => `<div class="lab-choice-wrap">${button(i, entries[i].words.join(" "))}${listenButton(i)}</div>`).join("")}</div><p class="detective-source" hidden>Verified library comparison: ${pair.surah.id}:${pair.first.id} and ${pair.surah.id}:${pair.second.id}</p>`;
    area.querySelectorAll("[data-choice]").forEach(
      (b) =>
        (b.onclick = () => {
          if (Number(b.dataset.choice) === 0) {
            area.querySelector(".detective-source").hidden = false;
            finish();
          } else
            fail(
              "That is a real continuation from the other ayah. Compare the opening and try again.",
            );
        }),
    );
    bindChoiceAudio(entries);
    gameCleanup = () => {};
  }
  root.querySelectorAll("[data-game]").forEach(
    (b) =>
      (b.onclick = () => {
        start(b.dataset.game);
        area.scrollIntoView({ block: "start" });
        (
          area.querySelector(".falling-stage") || area.querySelector("button")
        )?.focus();
      }),
  );
  root.querySelector("#lab-level").onchange = () => start();

  root.querySelector("#lab-restart").onclick = () => start();
  root.querySelector("#lab-replay").onclick = () =>
    fallingControl ? fallingControl.listen() : playAudio(referenceAudio, true);
  const muteButton = root.querySelector("#lab-mute");
  const updateMute = () => {
    muteButton.textContent = muted ? "Unmute audio" : "Mute audio";
    muteButton.setAttribute("aria-pressed", String(muted));
    if (audio) audio.muted = muted;
    fallingControl?.mute();
  };
  muteButton.onclick = () => {
    muted = !muted;
    try { localStorage.setItem("ayah-lab-muted", String(muted)); } catch {}
    updateMute();
  };
  updateMute();
  area.addEventListener("click", (event) => {
    const piece = event.target.closest("[data-choice], [data-group], [data-card], [data-chain]");
    if (!piece || piece.disabled) return;
    const listen = piece.closest(".lab-choice-wrap")?.querySelector("[data-lab-audio]");
    const entry = listen && choiceEntries[Number(listen.dataset.labAudio)];
    if (entry) playAudio(entry.audio, false, true);
  }, true);
  root.querySelector("#lab-retry-save").onclick = finish;
  root.querySelector("#lab-next-level").onclick = () => {
    root.querySelector("#lab-level").value = String(Math.min(4, level + 1));
    start();
    area.scrollIntoView({ block: "start" });
  };
  root.querySelector("#lab-recall").onclick = () =>
    callbacks.onRecall(resultKey);
  root.querySelector("#lab-recommended").onclick = () =>
    recommendation.game === "recall"
      ? callbacks.onRecall(key)
      : start(isDeveloperMode() ? recommendation.game : "falling");
  const refreshAccess=()=>{
    if(!isDeveloperMode() && !["falling","asteroids","recall"].includes(recommendation.game)) {
      recommendation.game="falling";
      recommendation.reason="Practice visible word order with Falling Words.";
      root.querySelector('.lab-recommendation p').textContent=recommendation.reason;
      root.querySelector('#lab-recommended').textContent="Falling Words";
    }
    root.querySelectorAll('[data-game]').forEach(b=>{const restricted=!['falling','asteroids'].includes(b.dataset.game)&&!isDeveloperMode();b.hidden=restricted;b.disabled=restricted;});
    if(!['falling','asteroids'].includes(game)&&!isDeveloperMode())start('falling');
  };
  globalThis.addEventListener('ayah-developer-mode',refreshAccess);
  start();
  cleanup = () => {
    globalThis.removeEventListener('ayah-developer-mode',refreshAccess);
    gameCleanup?.();
    stopAudio();
  };
}
