import {PASSAGE_GAMES,validatePractice,practiceProgress,recordPracticeXP,acknowledgePracticeRecall,recommendPassageGame} from './practice-plan.js';
import { reportStudyExposure } from "../study-exposure.js";
import { awardStudy } from "../rewards/store.js";
import {
  canonicalSlice,
  studySegmentation,
} from "../../supabase/functions/_shared/segmentation.js";
import { esc } from "../ui/dom.js";
import {
  loadAudio,
  loadBundle,
  localBundle,
  reference,
  referenceOptions,
} from "../content/library.js";
import {
  reviewedSegments,
  segmentAudioReviewed,
} from "../../supabase/functions/_shared/content-policy.js";
import {
  correct,
  hiddenWord,
  recallUnit,
  shuffled,
  WINDOW_SIZE,
  wordWindow,
  groupedWindow,
  restoreWorkspace,
} from "./model.js";
import { createPassageMemory, PASSAGE_MEMORY_KEY } from "./memory.js";
import { activeProfileId, scopedStorage } from "../learner/profile-storage.js";
import {
  studyAudioStart,
  studyAudioStop,
  successCue,
} from "../ui/encouragement.js";
import "./passage.css";
export function openPassageStudio(ctx = {}) {
  const d = document.createElement(ctx.inlineRoot ? "section" : "dialog");
  d.className = "account-dialog passage-studio";
  let closed=false,releaseOwner=()=>{};
  const owner = ctx.user?.id || null;
  const guard=()=>{if(closed||activeProfileId()!==owner)throw Error('Account changed or passage studio closed.');};
  guard();
  window.dispatchEvent(new Event('ayah-study-overlay'));
  const baseStorage=owner?scopedStorage(owner):localStorage;
  const storage={getItem:k=>{guard();return baseStorage.getItem(k);},setItem:(k,v)=>{guard();baseStorage.setItem(k,v);},removeItem:k=>{guard();baseStorage.removeItem(k);}};
  const memory = createPassageMemory(storage);
  const lifecycle=new AbortController();
  const options = referenceOptions();
  let bundle = null,
    layout = "grouped",
    gameHost = null,
    lastGame = null,
    launchingGame = false,
    page = 0,
    level = 0,
    segmentId = "full",
    selectedRefs = ["1:1"],
    chain = [],
    orders = {},
    bank = [],
    windowSequence = [],
    audio = null,
    audioResource = null,
    generation = 0,
    navigation = 0,
    assessmentView = 0,
    assessmentBundles = null;
  const cache = new Map();
  let loading = false,
    work = { version: 1, records: {}, refs: ["1:1"] },
    workWarning = "";
  try {
    const saved = JSON.parse(storage.getItem("ayah-passage-workspaces-v1"));
    if (saved) {
      if (
        saved.version !== 1 || !saved.records || typeof saved.records !== "object" || Array.isArray(saved.records) || !Array.isArray(saved.refs) || !saved.refs.length ||
        saved.refs.length > 10
      ) throw Error();
      const refs = saved.refs.map((k) => reference(k).key);
      if (new Set(refs).size !== refs.length) throw Error();
      if (saved.current) {
        reference(saved.current.key);
        if (typeof saved.current.segmentId !== "string") throw Error();
      }
      validatePractice(saved);
      work = saved;
      selectedRefs = refs;
    }
  } catch {
    workWarning =
      "Saved workspace needs recovery; it has not been overwritten.";
  }
  const workKey = () =>
    `${bundle.key}:${segmentId}:${bundle.contentRevision || "free-v1"}:${
      bundle.segmentationReview?.version || "draft-0.1"
    }${layout === "grouped" ? ":grouped-v1" : ""}`;
  function persistWork() {
    if (workWarning) return;
    if(bundle) {
      work.records[workKey()] = { page, orders, windowSequence, level };
      work.current = { key: bundle.key, segmentId, layout };
    }
    work.refs = selectedRefs;
    try {
      storage.setItem("ayah-passage-workspaces-v1", JSON.stringify(work));
    } catch {
      note(
        "Workspace could not save. Passage review history is separate.",
        true,
      );
    }
  }
  function restoreWork() {
    const previous = work.records[workKey()];
    if (previous === undefined) return;
    try {
      const restored = restoreWorkspace(bundle, segmentId === "full" ? null : currentSegment(), previous, layout);
      ({ page, orders, windowSequence, level } = restored);
    } catch (e) {
      workWarning = e.message;
    }
  }

  d.innerHTML =
    '<button class="text-button" data-close>Close ×</button><h2>Passage Builder · memorization studio</h2><button class="text-button" data-share-context>Use this passage across labs</button><button class="text-button" data-open-saved>Saved passages</button><button class="primary" data-open-expedition>✦ Explore Passage Expedition</button><button class="text-button" data-open-rescue>✧ Constellation Rescue</button><button class="text-button" data-set-aside hidden>Set aside unfinished recall · no grade</button><div data-studio></div><p data-studio-status role="status" aria-live="polite"></p>';
  const root = d.querySelector("[data-studio]"),
    status = d.querySelector("[data-studio-status]");
  const note = (text, error = false) => {
    status.textContent = text;
    status.dataset.tone = error ? "error" : "info";
  };
  function stop() {
    generation++;
    audio?.pause();
    if (audio) audio.src = "";
    audio = null;
    audioResource?.revoke();
    audioResource = null;
    studyAudioStop("passage");
  }
  const close = () => {
    if(closed)return;
    gameHost?.dispose();gameHost=null;
    closed=true;
    releaseOwner();
    lifecycle.abort();
    navigation++;
    assessmentView++;
    cache.clear();
    bundle=null;assessmentBundles=null;chain=[];orders={};
    stop();
    if(!ctx.inlineRoot)d.close();
    d.remove();
    ctx.onClose?.();
  };
  window.addEventListener('ayahprofilechange',()=>{if(activeProfileId()!==owner)close();},{signal:lifecycle.signal});
  window.addEventListener('pagehide',close,{signal:lifecycle.signal});
  function pendingControl(){const a=memory.snapshot().active;d.querySelector('[data-set-aside]').hidden=!!memory.warning||!a||a.graded;}
  d.querySelector('[data-set-aside]').onclick=()=>{try{const a=memory.snapshot().active;memory.cancel(a.id);navigation++;assessmentView++;stop();assessmentBundles=null;bundle=null;selectedRefs=['1:1'];draw();note('Unfinished attempt set aside. No grade or review date changed. Start free study or choose another available passage.');}catch(e){note(e.message,true);}};
  releaseOwner=ctx.own?.(close)||(()=>{});
  d.querySelector("[data-close]").onclick = close;
  d.querySelector("[data-share-context]").hidden=!ctx.onPassageSelection;
  d.querySelector("[data-share-context]").onclick=()=>{try{const result=ctx.onPassageSelection?.([...selectedRefs]);Promise.resolve(result).catch(e=>note(e.message,true));}catch(e){note(e.message,true);}};
  window.addEventListener("ayah-content-access-changed",()=>{if([...cache.keys()].some(k=>!localBundle(k)))close();},{signal:lifecycle.signal});
  d.oncancel = close;
  d.querySelector('[data-open-saved]').onclick=async()=>{const {openSavedPassages}=await import('../billing/ui.js');if(closed)return;close();openSavedPassages(ctx);};
  d.querySelector('[data-open-rescue]').onclick=async()=>{const {openRescue}=await import('../quest/rescue/ui.js');if(closed)return;close();openRescue(ctx);};
  d.querySelector('[data-open-expedition]').onclick=async()=>{const {openExpedition}=await import('../quest/expedition/ui.js');if(closed)return;const initialReference=bundle?.key||ctx.initialReference;close();openExpedition({...ctx,initialReference});};
  const get = async (key) => {
    if (cache.has(key)) return cache.get(key);
    const b = await loadBundle(key, ctx.client);
    if (!d.isConnected) return b;
    cache.set(key, b);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return b;
  };
  async function select(key) {
    gameHost?.dispose();gameHost=null;lastGame=null;
    stop();
    loading = true;
    note("Loading validated content…");
    const request = ++navigation;
    assessmentView++;
    try {
      const b = await get(key);
      if (!d.isConnected || request !== navigation) return;
      bundle = b;
      segmentId = work.current?.key === key && reviewedSegments(b).some(s => s.id === work.current.segmentId) ? work.current.segmentId : "full";
      page = 0;
      level = 0;
      orders = {};
      windowSequence = [];
      assessmentBundles = null;
      layout = ["grouped","legacy"].includes(work.layoutPreference) ? work.layoutPreference : work.current?.key === key && ["grouped","legacy"].includes(work.current.layout) ? work.current.layout : "grouped";
      if (!work.layoutPreference && !work.records[workKey()]) { layout="legacy";if(!work.records[workKey()])layout="grouped"; }
      restoreWork();
      draw();
      ctx.onReferenceSelected?.(key);
      note(
        workWarning || "Repeat aloud after the reciter. Visual workspace boundaries are not recitation stops.",
      );
    } catch (e) {
      if (!d.isConnected || request !== navigation) return;
      draw();
      note(e.message, true);
    } finally {
      if (request === navigation) loading = false;
    }
  }
  async function play(b = bundle, seg = null) {
    if (!allowStudy([b.key])) return;
    if (!b || loading) return;
    if (seg?.kind === "reviewed" && !segmentAudioReviewed(seg, b)) {
      return note(
        "Segment audio timings are not reviewed yet. Listen to the whole ayah in practice.",
        true,
      );
    }
    const active = memory.snapshot().active;
    if (active && !active.graded) memory.update("assisted");
    stop();
    const request = generation;
    studyAudioStart("passage");
    try {
      const resource = await loadAudio(b, ctx.client);
      if (request !== generation || !d.isConnected) {
        resource.revoke();
        return;
      }
      audioResource = resource;
      audio = new Audio(resource.url);
      const player = audio;
      if (seg?.kind === "reviewed") {
        audio.currentTime = seg.startMs / 1000;
        audio.ontimeupdate = () => {
          if (request === generation && player.currentTime >= seg.endMs / 1000) stop();
        };
      }
      audio.onended = () => { if (request === generation) stop(); };
      audio.onerror = () => {
        if (request !== generation) return;
        stop();
        note("Recitation could not play. Try again.", true);
      };
      await audio.play();
    } catch (e) {
      if (request === generation && d.isConnected) {
        stop();
        note(e.message, true);
      }
    }
  }
  const currentSegment = () =>
    bundle?.segments.find((s) => s.id === segmentId) || null;
  function currentWindow() {
    return (layout === "grouped" ? groupedWindow : wordWindow)(
      bundle,
      page,
      segmentId === "full" ? null : currentSegment(),
    );
  }
  function resetWindow() {
    const w = currentWindow();
    orders[page] ??= [];
    bank = shuffled(
      (w.groups || w.words.map(x=>({id:x.position,positions:[x.position]}))).filter(g=>!g.positions.every(id=>orders[page].includes(id))).map(g=>g.id),
    );
    if (!windowSequence.length) {
      windowSequence = shuffled(Array.from({ length: w.count }, (_, i) => i));
    }
  }
  function allowStudy(keys) {
    try { reportStudyExposure(keys); return true; }
    catch(e) { root.replaceChildren(); const p=document.createElement("p");p.setAttribute("role","alert");p.textContent=e.message;root.append(p);return false; }
  }
  const practiceRefs = () => bundle && selectedRefs.includes(bundle.key) ? [...selectedRefs] : bundle ? [bundle.key] : [];
  function trackAward(result) {
    if(result?.event&&result.xp>0) {recordPracticeXP(work,practiceRefs(),{id:result.event.id,xp:result.xp});persistWork();mountGamePicker();if(practiceProgress(work,practiceRefs()).due)root.querySelector('[data-required-recall]')?.focus({preventScroll:false});}
  }
  async function recallPractice() {
    gameHost?.dispose();gameHost=null;
    const token=++navigation;stop();
    try {const all=await Promise.all(practiceRefs().map(get));if(token!==navigation||closed)return;await beginRecall(all);}catch(e){note(e.message,true);}
  }
  function mountGamePicker() {
    root.querySelector('[data-passage-games]')?.remove();if(!bundle||!root.querySelector('[data-check-window]'))return;
    const recommendation=recommendPassageGame(bundle,memory.snapshot()),choices=work.games||[recommendation.game],progress=practiceProgress(work,practiceRefs());
    const panel=document.createElement('section');panel.dataset.passageGames='';panel.className='passage-games';
    panel.innerHTML=`<h3>Choose your passage games</h3><p>${esc(recommendation.reason)}</p><p>Suggested: ${esc(PASSAGE_GAMES.find(g=>g.id===recommendation.game).title)}. You choose the games and their order.</p><fieldset><legend>Games to include</legend>${PASSAGE_GAMES.map(g=>`<label><input type="checkbox" data-passage-game-choice="${g.id}" ${choices.includes(g.id)?'checked':''}> ${esc(g.title)}</label>`).join('')}</fieldset><p>Games use the current visual workspace’s original words, in canonical order; full-ayah audio stays continuous. They do not certify recall or approved phrase stops.</p><div class="passage-toolbar">${choices.map(id=>`<button class="primary" data-passage-game="${id}" ${progress.due||workWarning?'disabled':''}>Play ${esc(PASSAGE_GAMES.find(g=>g.id===id).title)}</button>`).join('')||'<p>Select at least one game, or continue word practice.</p>'}</div><p>${progress.sinceRecall} / 16 earned practice XP toward your next self-assessment for ${esc(practiceRefs().join(', '))}. Only actually awarded XP counts; normal caps stay in place.</p>${progress.due?'<p role="status"><strong>Time for self-assessed recall.</strong> Recite, reveal and compare, then rate yourself before another passage game. You may leave or keep studying without an invented grade.</p>':''}<button class="primary" data-practice-recall ${progress.due?'data-required-recall':''}>${progress.due?'Start required self-assessment':'Self-assess now'}</button><p>Cosmic Rush is available separately in Revision Lab for Al-Fatihah and Juz Amma.</p>`;
    root.querySelector('[data-check-window]').after(panel);
    panel.querySelectorAll('[data-passage-game-choice]').forEach(input=>input.onchange=()=>{work.games=[...panel.querySelectorAll('[data-passage-game-choice]:checked')].map(n=>n.dataset.passageGameChoice);persistWork();mountGamePicker();root.querySelector(`[data-passage-game-choice="${input.dataset.passageGameChoice}"]`)?.focus({preventScroll:true});});
    panel.querySelectorAll('[data-passage-game]').forEach(b=>b.onclick=()=>runGame(b.dataset.passageGame));panel.querySelector('[data-practice-recall]').onclick=recallPractice;
  }
  async function runGame(game) {
    if(launchingGame||closed||workWarning)return;
    if(practiceProgress(work,practiceRefs()).due){mountGamePicker();return;}
    if(!allowStudy([bundle.key]))return;
    launchingGame=true;stop();const token=++navigation,w=currentWindow();lastGame=game;
    gameHost?.dispose();gameHost=null;
    root.innerHTML='<button class="text-button" data-game-back>← Return to Passage Builder</button><p>Visual word practice, not an approved recitation segment. Motor mistakes do not grade your recall.</p><div data-passage-game-host></div>';
    root.querySelector('[data-game-back]').onclick=()=>{navigation++;gameHost?.dispose();gameHost=null;launchingGame=false;draw();};
    try {
      const {mountPassageGame}=await import('./games.js');if(closed||token!==navigation)return;
      const mounted=await mountPassageGame(root.querySelector('[data-passage-game-host]'),{bundle,window:w,game,ctx,storage,isCurrent:()=>!closed&&token===navigation,onComplete:receipt=>{
        guard();recordPracticeXP(work,practiceRefs(),receipt);persistWork();
        queueMicrotask(()=>{if(!closed&&token===navigation){draw();note(`Game saved · ${receipt.xp} XP awarded. Choose another game or self-assess recall.`);root.querySelector('[data-practice-recall]')?.focus({preventScroll:true});}});
      }});
      if(closed||token!==navigation)mounted?.dispose();else gameHost=mounted;
    }catch(e){if(!closed&&token===navigation){draw();note(e.message,true);}}
    finally{launchingGame=false;}
  }
  function postRecallOptions(unit) {
    const panel=document.createElement('section');panel.className='passage-after-recall';panel.dataset.afterRecall='';panel.innerHTML='<h3>Self-assessment saved. What next?</h3><p>Your own rating—not a game victory—controls the existing review schedule.</p><button class="primary" data-after-practice>Keep practising this ayah</button>'+(lastGame?'<button class="primary" data-after-game>Return to my game</button>':'')+'<button class="primary" data-after-next>Continue to the next available ayah</button>';
    root.prepend(panel);panel.querySelector('[data-after-practice]').onclick=()=>{panel.remove();if(!bundle){selectedRefs=[...unit.refs];select(unit.refs[0]);}else root.querySelector('[data-check-window]')?.focus();};panel.querySelector('[data-after-game]')?.addEventListener('click',()=>runGame(lastGame));
    const end=reference(unit.refs.at(-1)),next=[];
    for(let i=1;i<=unit.refs.length;i++){const o=options.find(o=>reference(o.key).surah===end.surah&&reference(o.key).ayah===end.ayah+i);if(!o)break;next.push(o.key);}
    panel.querySelector('[data-after-next]').disabled=!next.length;panel.querySelector('[data-after-next]').textContent=next.length>1?`Continue to the next ${next.length} ayahs`:'Continue to the next available ayah';panel.querySelector('[data-after-next]').onclick=()=>{selectedRefs=next;select(next[0]);};
    panel.querySelector('h3').tabIndex=-1;panel.querySelector('h3').focus({preventScroll:true});
  }
  function draw() {
    pendingControl();
    assessmentView++;
    d.dataset.recallActive = "false";
    const active = memory.snapshot().active;
    if (active && !active.graded) {
      drawAssessment();
      return;
    }
    if (!bundle) {
      root.innerHTML =
        `<p>Build a passage from the verified library. Free ayahs work without an account.${work.current ? ' Resume saved ayah ' + esc(work.current.key) + '.' : ''}</p><button class="primary" data-start>${work.current ? "Resume saved workspace" : "Start with Al-Fatihah"}</button>${work.current ? '<button class="text-button" data-free-start>Practice free Al-Fatihah</button>' : ""}`;
      root.querySelector("[data-free-start]")?.addEventListener("click", () => select("1:1"));
      root.querySelector("[data-start]").onclick = () => select(work.current?.key || "1:1");
      return;
    }
    if (!allowStudy([bundle.key])) return;
    const focused = document.activeElement;
    const focusWord = focused?.dataset.word;
    const focusMove = focused?.dataset.move;
    gameHost?.dispose();gameHost=null;
    resetWindow();
    persistWork();
    const w = currentWindow(),
      selected = orders[page] || [],
      groups = w.groups || w.words.map(x=>({id:x.position,positions:[x.position]})),
      selectedPieces = groups.filter(g=>g.positions.every(id=>selected.includes(id))).sort((a,b)=>selected.indexOf(a.id)-selected.indexOf(b.id)).map(g=>g.id),
      pieceFor = id => groups.find(g=>g.id===id),
      textAt = id => pieceFor(id).positions.map(p=>hiddenWord(p,level)?'✧':bundle.words.find(x=>x.position===p).text).join(' ');
    root.innerHTML =
      `<p>Work a few words at a time, reconstruct the full ayah, then recite independently. <strong>Visual pages are not approved recitation stops.</strong> Full-ayah audio continues across visual pages.</p><div class="passage-toolbar"><label>Ayah<select data-reference>${
        options.map((o) =>
          `<option value="${o.key}" ${o.key === bundle.key ? "selected" : ""}>${
            esc(o.label)
          }</option>`
        ).join("")
      }</select></label><button class="text-button" data-add-ref>Add to my passage</button></div><label>Workspace layout<select data-layout><option value="grouped" ${layout==="grouped"?"selected":""}>Grouped · up to 12 pieces</option><option value="legacy" ${layout==="legacy"?"selected":""}>Original word windows · saved drafts</option></select></label><p>Current: ${bundle.key} · Juz ${bundle.juz} · ${bundle.words.length} words</p><details data-full-reference><summary>Full verified ayah and translation</summary><p class="arabic" lang="ar" dir="rtl">${
        esc(bundle.textUthmani)
      }</p><p>${esc(bundle.translation)}</p><p>${
        bundle.sources.map((s) =>
          `<a href="${
            esc(s.url)
          }" target="_blank" rel="noopener noreferrer">Source</a>`
        ).join(" · ")
      }</p></details><div class="passage-toolbar"><button class="primary" data-listen>Listen to full ayah</button><button class="text-button" data-stop>Stop audio</button><label>Recitation unit<select data-segment>${
        reviewedSegments(bundle).map((s) =>
          `<option value="${esc(s.id)}" ${
            s.id === segmentId ? "selected" : ""
          }>${
            s.kind === "whole-ayah"
              ? "Whole ayah"
              : `Reviewed segment: words ${s.firstWord}–${s.lastWord}`
          }</option>`
        ).join("")
      }</select></label>${
        segmentId !== "full" && segmentAudioReviewed(currentSegment(), bundle)
          ? '<button class="text-button" data-segment-audio>Listen to reviewed segment</button>'
          : ""
      }</div>${
        reviewedSegments(bundle).length === 1
          ? "<p>No internal recitation segments are approved for this ayah. Practice visual windows while listening to the complete ayah.</p>"
          : ""
      }<div class="passage-toolbar"><button class="text-button" data-prev ${
        w.page === 0 ? "disabled" : ""
      }>Previous workspace</button><strong>Visual workspace ${
        w.page + 1
      } / ${w.count} · Phrase ${w.phrase} / ${w.phraseCount}</strong><button class="text-button" data-next ${
        w.page + 1 === w.count ? "disabled" : ""
      }>Next workspace</button><label>Jump to workspace<select data-workspace-jump>${Array.from({length:w.count},(_,i)=>`<option value="${i}" ${i===page?"selected":""}>${i+1} / ${w.count}</option>`).join('')}</select></label><label>Word hints<select data-hints><option value="0" ${
        level === 0 ? "selected" : ""
      }>All visible</option><option value="1" ${
        level === 1 ? "selected" : ""
      }>Some hidden</option><option value="2" ${
        level === 2 ? "selected" : ""
      }>All hidden</option></select></label><button class="text-button" data-reveal>Reveal this workspace</button></div><p class="arabic phrase-context" lang="ar" dir="rtl">${
        level === 0
          ? esc(canonicalSlice(bundle, w.startWord, w.endWord))
          : "Phrase reference hidden with word hints"
      }</p><p>${
        w.continuation
          ? "Continue the phrase into the next workspace; this is not recitation stop guidance."
          : "Study boundary only. Full-ayah recitation remains continuous."
      }</p><p>${layout==="grouped"?`${w.groups.length} pieces · up to ${w.groupSize} words per piece. Grouping is visual only.`:"Original individual-word workspaces."}</p><p>Say each word as you move it. Hidden pieces are practice, not an independent recall assessment.</p><div class="passage-piece-zone" data-place="built" dir="rtl">${
        selectedPieces.map((id, i) =>
          `<span class="passage-token"><button draggable="true" data-word="${id}" aria-label="Return piece ${
            i + 1
          }">${
            `<span lang="ar" dir="rtl">${esc(textAt(id))}</span>`
          }</button><button class="text-button" data-move="${id}:-1" aria-label="Move piece earlier">→</button><button class="text-button" data-move="${id}:1" aria-label="Move piece later">←</button></span>`
        ).join("") || "<p>Move words here in order.</p>"
      }</div><div class="passage-piece-zone passage-word-bank" data-place="bank" dir="rtl">${
        bank.map((id) =>
          `<button class="passage-token" draggable="true" data-word="${id}" aria-label="Add word piece">${
            `<span lang="ar" dir="rtl">${esc(textAt(id))}</span>`
          }</button>`
        ).join("")
      }</div><button class="primary" data-check-window>Check workspace</button><h3>Full-ayah reconstruction</h3><p>Arrange completed visual workspaces in ayah order, then check the whole ayah. Each card is an excerpt, not a recitation stop.</p><div class="workspace-chain">${
        windowSequence.map((p, i) => {
          const words = (layout === "grouped" ? groupedWindow : wordWindow)(
            bundle,
            p,
            segmentId === "full" ? null : currentSegment(),
          ).words;
          return `<div><span class="arabic" dir="rtl" lang="ar">${
            esc(words[0].text)
          } … ${
            esc(words.at(-1).text)
          }</span><button class="text-button" data-window-move="${i}:-1" aria-label="Move workspace earlier">↑</button><button class="text-button" data-window-move="${i}:1" aria-label="Move workspace later">↓</button></div>`;
        }).join("")
      }</div><button class="primary" data-check-whole>${
        segmentId === "full" ? "Check full ayah" : "Check reviewed segment"
      } reconstruction</button><div class="passage-toolbar"><button class="primary" data-recall>Independent ${
        segmentId === "full" ? "ayah" : "segment"
      } recall</button></div><section class="passage-chain-config"><h3>My passage and Passage Chain</h3><p>Selected references: ${
        selectedRefs.join(", ")
      }. Canonical surah/ayah order is used; gaps remain explicit.</p><button class="text-button" data-clear-refs>Use current ayah only</button><button class="primary" data-chain>Challenge the ayah sequence</button><button class="primary" data-passage-recall>Independent passage recall</button><div data-chain-cards></div></section><section><h3>Passage review schedule</h3>${
        Object.values(memory.snapshot().records).map((r) =>
          `<p>${esc(r.unit.type)} ${esc(r.unit.refs.join(", "))} · ${
            r.card
              ? "Next review " + new Date(r.card.due).toLocaleString()
              : "Not independently scheduled"
          }</p>`
        ).join("") ||
        "<p>No passage reviews yet. Reconstruction alone does not schedule recall.</p>"
      }<button class="text-button" data-sync>Sync private passage reviews</button><button class="text-button" data-export>Export passage review data</button><button class="text-button" data-export-work>Export workspace data</button></section>`;
    if (focusWord) root.querySelector(`[data-word="${Number(focusWord)}"]`)?.focus({preventScroll:true});
    if (focusMove && /^\d+:-?1$/.test(focusMove)) root.querySelector(`[data-move="${focusMove}"]`)?.focus({preventScroll:true});
    root.querySelector('[data-layout]').onchange=e=>{persistWork();layout=e.target.value;work.layoutPreference=layout;page=0;orders={};windowSequence=[];restoreWork();draw();};
    root.querySelector('[data-workspace-jump]').onchange=e=>{page=Number(e.target.value);draw();};
    mountGamePicker();
    root.querySelector("[data-reference]").onchange = (e) =>
      select(e.target.value);
    root.querySelector("[data-add-ref]").onclick = () => {
      if (selectedRefs.length >= 10) {
        return note("Choose up to ten ayahs per passage.", true);
      }
      if (!selectedRefs.includes(bundle.key)) selectedRefs.push(bundle.key);
      selectedRefs.sort((a, b) => {
        const x = reference(a), y = reference(b);
        return x.surah - y.surah || x.ayah - y.ayah;
      });
      draw();
    };
    root.querySelector("[data-clear-refs]").onclick = () => {
      selectedRefs = [bundle.key];
      draw();
    };
    root.querySelector("[data-listen]").onclick = () => play();
    root.querySelector("[data-stop]").onclick = stop;
    root.querySelector("[data-segment-audio]")?.addEventListener(
      "click",
      () => play(bundle, currentSegment()),
    );
    root.querySelector("[data-segment]").onchange = (e) => {
      navigation++;
      loading = false;
      stop();
      segmentId = e.target.value;
      level = 0;
      page = 0;
      orders = {};
      windowSequence = [];
      restoreWork();
      draw();
    };
    root.querySelector("[data-prev]").onclick = () => {
      page--;
      draw();
    };
    root.querySelector("[data-next]").onclick = () => {
      page++;
      draw();
    };
    root.querySelector("[data-hints]").onchange = (e) => {
      level = Number(e.target.value);
      draw();
    };
    root.querySelector("[data-reveal]").onclick = () => {
      level = 0;
      draw();
      note("Hint revealed. Use independent recall later to assess memory.");
    };
    root.querySelectorAll("[data-word]").forEach((b) => {
      b.onclick = () => {
        const id = Number(b.dataset.word);
        if (selectedPieces.includes(id)) {
          orders[page] = selected.filter(x=>!pieceFor(id).positions.includes(x));
        } else orders[page] = [...selected, ...pieceFor(id).positions];
        draw();
      };
      b.ondragstart = (e) =>
        e.dataTransfer.setData("text/plain", b.dataset.word);
      b.ondragover = (e) => e.preventDefault();
      b.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (!pieceFor(id)) return;
        if (zoneIsBank(b)) {
          orders[page] = selected.filter(x => !pieceFor(id).positions.includes(x));
          draw();
          return;
        }
        if (id === Number(b.dataset.word)) return;
        const next = selectedPieces.filter(x=>x!==id);
        next.splice(Math.max(0,next.indexOf(Number(b.dataset.word))),0,id);
        orders[page] = next.flatMap(x=>pieceFor(x).positions);
        draw();
      };
    });
    root.querySelectorAll("[data-place]").forEach((zone) => {
      zone.ondragover = (e) => e.preventDefault();
      zone.ondrop = (e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (!pieceFor(id)) return;
        orders[page] = zone.dataset.place === "bank"
          ? selected.filter(x=>!pieceFor(id).positions.includes(x))
          : [...selected.filter(x=>!pieceFor(id).positions.includes(x)), ...pieceFor(id).positions];
        draw();
      };
    });
    root.querySelectorAll("[data-move]").forEach((b) =>
      b.onclick = () => {
        const [id, delta] = b.dataset.move.split(":").map(Number),
          next = [...selectedPieces],
          i = next.indexOf(id),
          j = i + delta;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        orders[page] = next.flatMap(x=>pieceFor(x).positions);
        draw();
      }
    );
    root.querySelector("[data-check-window]").onclick = () => {
      const good = correct(selected, w.words);
      note(
        good
          ? "Workspace correct. Keep connecting the ayah."
          : "Reorder the pieces and try again.",
        !good,
      );
      if (good) {
        trackAward(awardStudy({mode:"passage",unit:bundle.key,action:"completion",xp:8}));
        successCue(
          `passage-window-${bundle.key}-${page}`,
          "Beautiful work. Connect what you remember.",
        );
      }
    };
    root.querySelectorAll("[data-window-move]").forEach((b) =>
      b.onclick = () => {
        const [i, delta] = b.dataset.windowMove.split(":").map(Number),
          j = i + delta;
        if (j < 0 || j >= windowSequence.length) return;
        [windowSequence[i], windowSequence[j]] = [
          windowSequence[j],
          windowSequence[i],
        ];
        draw();
      }
    );
    root.querySelector("[data-check-whole]").onclick = () => {
      const whole = windowSequence.flatMap((p) => orders[p] || []),
        target = bundle.words.slice(
          (segmentId === "full" ? 1 : currentSegment().firstWord) - 1,
          segmentId === "full"
            ? bundle.words.length
            : currentSegment().lastWord,
        ),
        good = correct(whole, target);
      note(
        good
          ? "Reconstruction correct. Now try reciting independently."
          : "Complete each workspace and check their sequence.",
        !good,
      );
      if (good) {
        trackAward(awardStudy({mode:"passage",unit:bundle.key,action:"completion",xp:8}));
        successCue(
          `passage-whole-${bundle.key}`,
          "Ayah connected. Keep growing.",
        );
      }
    };
    root.querySelector("[data-recall]").onclick = () =>
      beginRecall([bundle], segmentId === "full" ? null : currentSegment());
    root.querySelector("[data-passage-recall]").onclick = async () => {
      const request = ++navigation;
      loading = false;
      stop();
      try {
        note("Loading the selected passage…");
        const all = await Promise.all(selectedRefs.map(get));
        if (!d.isConnected || request !== navigation) return;
        beginRecall(all);
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-chain]").onclick = async () => {
      const request = ++navigation;
      loading = false;
      try {
        const all = await Promise.all(selectedRefs.map(get));
        if (!d.isConnected || request !== navigation) return;
        chain = shuffled(all.map((b) => b.key));
        drawChain(all);
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-sync]").onclick = async () => {
      try {
        note(await memory.sync(ctx.client, ctx.user?.id));
        draw();
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector('[data-export-work]').onclick=()=>{
      const raw=storage.getItem('ayah-passage-workspaces-v1')??JSON.stringify(work),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ayah-passage-workspaces.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    root.querySelector("[data-export]").onclick = () => {
      const url = URL.createObjectURL(
          new Blob([memory.exportRaw() ?? JSON.stringify(memory.snapshot(), null, 2)], {
            type: "application/json",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "ayah-passage-reviews.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  const zoneIsBank = b => !!b.closest('[data-place="bank"]');
  function drawChain(all) {
    if (!allowStudy(all.map(b=>b.key))) return;
    const area = root.querySelector("[data-chain-cards]");
    area.innerHTML =
      chain.map((key, i) =>
        `<div><p class="arabic" lang="ar" dir="rtl">${
          esc(
            all.find((b) => b.key === key).words.slice(0, 4).map((w) => w.text)
              .join(" "),
          )
        } …</p><button class="text-button" data-chain-move="${i}:-1">Move earlier</button><button class="text-button" data-chain-move="${i}:1">Move later</button></div>`
      ).join("") +
      '<button class="primary" data-check-chain>Check Passage Chain</button>';
    area.querySelectorAll("[data-chain-move]").forEach((b) =>
      b.onclick = () => {
        const [i, delta] = b.dataset.chainMove.split(":").map(Number),
          j = i + delta;
        if (j < 0 || j >= chain.length) return;
        [chain[i], chain[j]] = [chain[j], chain[i]];
        drawChain(all);
      }
    );
    area.querySelector("[data-check-chain]").onclick = () => {
      const good = chain.every((k, i) => k === selectedRefs[i]);
      note(
        good
          ? "Passage Chain correct. Try independent passage recall next."
          : "The ayah sequence needs another look.",
        !good,
      );
      if (good) { trackAward(awardStudy({mode:"passage",unit:selectedRefs.join("|"),action:"chain",xp:8}));successCue("passage-chain", "Your passage is connected."); }
    };
  }
  async function beginRecall(all, segment = null) {
    try {
      gameHost?.dispose();gameHost=null;
      loading = false;
      stop();
      assessmentBundles = all;
      const request = ++navigation;
      const unit = await recallUnit(all, segment);
      if (!d.isConnected || request !== navigation) return;
      // Persist externally observed quest support with the actual attempt in one write.
      memory.begin(unit, {assisted: ctx.assessmentAssisted === true});
      drawAssessment();
      note(
        "Self-assessed recitation. No automatic speech verification is performed.",
      );
    } catch (e) {
      note(e.message, true);
    }
  }
  async function drawAssessment() {
    pendingControl();
    const view = ++assessmentView;
    const currentView = () => d.isConnected && view === assessmentView;
    d.dataset.recallActive = "true";
    stop();
    const a = memory.snapshot().active;
    if (!a || a.graded) {
      draw();
      return;
    }
    const unit = memory.snapshot().records[a.unitId].unit;
    // Never render the word bank/reference while attempting independent recall.
    root.innerHTML = `<h3>Independent ${esc(unit.type)} recall</h3><p>Recite ${
      esc(unit.refs.join(", "))
    }${
      unit.type === "segment"
        ? ` · reviewed words ${unit.firstWord}–${unit.lastWord}`
        : ""
    } from memory. This is self-assessed recitation, not automatic speech verification.</p><button class="primary" data-declare ${
      a.declared ? "disabled" : ""
    }>I recited from memory</button><button class="text-button" data-compare>Reveal verified text and compare</button><button class="text-button" data-recall-listen>Listen to reciter (study assistance)</button><button class="text-button" data-abandon>Return to practice</button><div data-comparison></div><div data-grades></div>`;
    root.querySelector("[data-declare]").onclick = () => {
      try {
        memory.update("declared");
        drawAssessment();
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-compare]").onclick = async () => {
      try {
        memory.update("assisted");
        const loaded = assessmentBundles || await Promise.all(unit.refs.map(get));
        if (!currentView()) return;
        assessmentBundles = loaded;
        if (unit.type === "segment") {
          const s = assessmentBundles[0].segments.find((s) =>
            s.id === unit.segment
          );
          if (!s || (await recallUnit(assessmentBundles, s)).id !== unit.id) {
            throw Error(
              "This segment review changed. Start a new assessment after checking the reviewed boundaries.",
            );
          }
        }
        if (!currentView()) return;
        memory.update("compared");
        if (currentView()) showComparison();
      } catch (e) {
        if (currentView()) note(e.message, true);
      }
    };
    root.querySelector("[data-recall-listen]").onclick = async () => {
      try {
        memory.update("assisted");
        const b = await get(unit.refs[0]);
        if (!currentView()) return;
        await play(
          b,
          unit.type === "segment"
            ? b.segments.find((s) => s.id === unit.segment)
            : null,
        );
        if (!currentView()) return;
        note(
          "Listening before declaring recall makes this assessment assisted. For a multi-ayah passage, compare each complete ayah after revealing.",
        );
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-abandon]").onclick = () => {
      try {
        assessmentView++;
        navigation++;
        stop();
        const current = memory.snapshot().active;
        memory.cancel(current.id);
        assessmentBundles = null;
        draw();
        note(
          "Returned to practice. The unfinished attempt was set aside without a grade or schedule change.",
        );
      } catch (e) {
        note(e.message, true);
      }
    };
    if (a.compared) {
      try {
        const loaded = assessmentBundles || await Promise.all(unit.refs.map(get));
        if (!currentView()) return;
        assessmentBundles = loaded;
        if (unit.type === "segment") {
          const s = assessmentBundles[0].segments.find((s) =>
            s.id === unit.segment
          );
          if (!s || (await recallUnit(assessmentBundles, s)).id !== unit.id) {
            throw Error(
              "This segment review changed. Start a new assessment after checking reviewed boundaries.",
            );
          }
        }
        if (currentView()) showComparison();
      } catch (e) {
        note(e.message, true);
      }
    }
  }
  function showComparison() {
    if (!allowStudy(assessmentBundles.map(b=>b.key))) return;
    const a = memory.snapshot().active,
      unit = memory.snapshot().records[a.unitId].unit,
      area = root.querySelector("[data-comparison]");
    if (!area) return;
    area.innerHTML = assessmentBundles.map((b) =>
      `<section><h4>${b.key}</h4><p class="arabic" lang="ar" dir="rtl">${
        esc(
          unit.type === "segment"
            ? b.words.slice(unit.firstWord - 1, unit.lastWord).map((w) =>
              w.text
            ).join(" ")
            : b.textUthmani,
        )
      }</p><p>${
        unit.type === "segment"
          ? "Excerpt of the referenced ayah; see the full ayah in practice."
          : esc(b.translation)
      }</p><button class="text-button" data-compare-audio="${b.key}">Listen to ${b.key}</button></section>`
    ).join("");
    area.querySelectorAll("[data-compare-audio]").forEach((b) =>
      b.onclick = () =>
        play(
          assessmentBundles.find((x) => x.key === b.dataset.compareAudio),
          unit.type === "segment"
            ? assessmentBundles[0].segments.find((s) => s.id === unit.segment)
            : null,
        )
    );
    root.querySelector("[data-grades]").innerHTML = [
      "Again",
      "Hard",
      "Good",
      "Easy",
    ].map((grade) =>
      `<button class="primary" data-grade="${grade}">${grade}</button>`
    ).join("");
    root.querySelectorAll("[data-grade]").forEach((b) =>
      b.onclick = () => {
        try {
          stop();
          const result = memory.grade(a.id, b.dataset.grade, {assessmentSource:"self-assessed"});
          awardStudy({mode:"passage-recall",unit:a.unitId,action:"assessment",xp:result.independent?10:3});
          if(unit.type!=="segment")acknowledgePracticeRecall(work,unit.refs,memory.snapshot().active);
          persistWork();
          assessmentView++;
          assessmentBundles = null;
          draw();
          postRecallOptions(unit);
          note(
            `${
              result.independent ? "Independent" : "Assisted"
            } self-assessment saved. ${
              result.scheduled
                ? "Next review " + new Date(result.nextReview).toLocaleString()
                : result.independent
                ? "The existing due date is preserved."
                : "Independent recall was not scheduled."
            }`,
          );
          ctx.onAssessmentSaved?.(result);
        } catch (e) {
          note(e.message, true);
        }
      }
    );
  }
  (ctx.inlineRoot||document.body).append(d);
  if(!ctx.inlineRoot)d.showModal();
  // A coach review must initialize once: an early resumed view could accept a
  // reveal click and then be replaced by the later verified-source handoff.
  if (ctx.coachTarget && ctx.coachAction === "review") {
    root.innerHTML = '<p role="status">Preparing verified self-assessment…</p>';
  } else draw();
  if (memory.warning || workWarning) note(memory.warning || workWarning, true);
  if(ctx.initialRefs){try{const refs=ctx.initialRefs.map(k=>reference(k).key);if(!refs.length||refs.length>10||new Set(refs).size!==refs.length)throw Error("Choose up to ten canonical passage references.");selectedRefs=refs;}catch(e){note(e.message,true);}}
  if (ctx.initialReference) select(ctx.initialReference);

  if (ctx.coachTarget) (async () => {
    const request = ++navigation;
    try {
      const target = ctx.coachTarget;
      const all = await Promise.all(target.refs.map(get));
      if (!d.isConnected || request !== navigation) return;
      loading = false;
      if (ctx.coachAction === "review") {
        const active = memory.snapshot().active;
        if (active && !active.graded) {
          if (ctx.assessmentAssisted === true) memory.update("abandon");
          await drawAssessment();
          note("Resuming your unfinished passage assessment before starting another.");
          return;
        }
        const saved = target.unit;
        const segment = saved?.type === "segment" ? all[0].segments.find(s => s.id === saved.segment) : null;
        if (!saved || saved.type === "segment" && !segment || (await recallUnit(all, segment)).id !== saved.id) throw Error("The reviewed recall unit changed. Check current boundaries before starting a new assessment.");
        if (!d.isConnected || request !== navigation) return;
        await beginRecall(all, segment);
      } else {
        selectedRefs = target.refs.slice(0, 10);
        bundle = all[0]; page = 0; segmentId = "full";
        restoreWork(); draw();
        note("Coach practice suggestion opened. Review dates and mastery are unchanged.");
      }
    } catch (e) { if (d.isConnected && request === navigation) note(e.message, true); }
  })();

  return {close};
}

// Phase-2 integration seam; callers opt in, no campaign screen is mounted here.
export const loadQuestFramework = () => import('../quest/index.js');
