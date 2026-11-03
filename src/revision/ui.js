import { esc, clearLearningView } from '../ui/dom.js';
import { cosmicSurahs, createMission, objectives } from '../quest/cosmic/mission.js';
import './revision.css';
import { mountStarRunner } from '../puzzles/arcade/cosmic/ui.js';
let cleanup = () => {}, pause = () => {};
export function stopRevisionLab() { cleanup(); cleanup = () => {}; pause = () => {}; }
export function pauseRevisionLab() { pause(); }

export function mountRevisionLab(main) {
  stopRevisionLab();
  let flight = null;
  cleanup = () => { generation++; flight?.dispose(); };
  pause = () => {
    generation++; flight?.pause();
    // An overlay may interrupt source validation before a flight exists.
    const launch = main.querySelector('[data-launch-runner]');
    if (launch) launch.disabled = false;
  };
  clearLearningView(main);
  main.querySelector('.page-heading h1').textContent = 'Revision Lab';
  const root = document.createElement('section');
  root.className = 'cosmic-rush';
  root.setAttribute('aria-label', 'Revision Lab');
  main.append(root);
  let generation = 0;
  function selection() {
    generation++;
    root.innerHTML = `<div class="cosmic-hero"><span class="cosmic-eyebrow">YOUR NEXT CONSTELLATION</span><h2>Revision Lab</h2><p>Plan a passage journey. Return to familiar ayahs and connect them together.</p></div><button class="cosmic-card" data-cosmic-select><span aria-hidden="true">✦</span><strong>Cosmic Rush</strong><span>Ayah Relay 2.0</span><p>Explore the mission planner and constellation route.</p><small>Star Runner + Quran memory gateways</small><b>Choose a mission →</b></button>`;
    root.querySelector('[data-cosmic-select]').onclick = () => planner();
  }
  function planner() {
    generation++;
    root.innerHTML = `<button class="cosmic-secondary" data-back>← Revision Lab</button><div class="cosmic-hero"><span class="cosmic-eyebrow">COSMIC RUSH · MISSION PLANNER</span><h2>Chart your ayah journey</h2><p>Al-Fatihah and Juz Amma are free for everyone. Choose a contiguous passage, then explore its route.</p></div><form class="cosmic-form"><label>Surah<select name="surah">${cosmicSurahs.slice().sort((a,b)=>a.id-b.id).map(s=>`<option value="${s.id}">${esc(s.name)} · ${s.verses.length} ayahs</option>`).join('')}</select></label><label>Passage length<select name="selection"><option value="5">Five ayahs</option><option value="10">Ten ayahs</option><option value="15">Fifteen ayahs</option><option value="20">Twenty ayahs</option><option value="custom">Custom contiguous range</option><option value="entire">Entire surah</option></select></label><label data-start>First ayah<input name="start" type="number" min="1" value="1" required></label><label data-end hidden>Last ayah<input name="end" type="number" min="1" value="1"></label><p class="cosmic-range-note">Presets use up to the selected number of ayahs. Shorter surahs and passages include all remaining ayahs.</p><button class="cosmic-primary" type="submit">View mission briefing →</button><p data-error role="alert"></p></form>`;
    root.querySelector('[data-back]').onclick = selection;
    const form = root.querySelector('form');
    const update = () => {
      const s = cosmicSurahs.find(s=>s.id === Number(form.elements.surah.value));
      form.elements.start.max = form.elements.end.max = String(s.verses.length);
      const entire = form.elements.selection.value === 'entire';
      root.querySelector('[data-start]').hidden = entire;
      form.elements.start.disabled = entire;
      const custom = form.elements.selection.value === 'custom';
      root.querySelector('[data-end]').hidden = !custom;
      form.elements.end.disabled = !custom;
      root.querySelector('[data-error]').textContent = '';
    };
    form.elements.surah.onchange = () => { form.elements.start.value = '1'; form.elements.end.value = '1'; update(); };
    form.elements.selection.onchange = update;
    update();
    form.onsubmit = async event => {
      event.preventDefault();
      const token = ++generation;
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        const mission = await createMission({surahId:Number(form.elements.surah.value),selection:form.elements.selection.value,start:Number(form.elements.start.value),end:Number(form.elements.end.value)});
        if (token !== generation || !root.isConnected) return;
        briefing(mission);
      } catch (error) {
        if (token === generation && root.isConnected) { root.querySelector('[data-error]').textContent = error.message; submit.disabled = false; }
      }
    };
  }
  function briefing(mission) {
    let active = 0;
    const s = cosmicSurahs.find(s=>s.id === mission.surah);
    function render(focus = false) {
      const stage = mission.stages[active];
      root.innerHTML = `<button class="cosmic-secondary" data-change>← Change mission</button><div class="cosmic-hero"><span class="cosmic-eyebrow">MISSION BRIEFING</span><h2>${esc(s.name)} · Ayahs ${mission.first}–${mission.last}</h2><p>${mission.refs.length} ayahs · ${mission.stages.length} ${mission.stages.length===1?'stage':'stages'} · Free content</p><p>Stages group up to five consecutive ayahs. These are mission groups, not recitation stopping points.</p></div><div class="cosmic-route" role="navigation" aria-label="Mission constellation">${mission.stages.map((stage,i)=>`<button class="cosmic-node ${i===active?'is-current':''}" data-stage="${i}" ${i===active?'aria-current="step"':''}><span class="cosmic-star" aria-hidden="true">✦</span><strong>Stage ${stage.order}</strong><small>Ayahs ${stage.first}–${stage.last}</small></button>`).join('')}</div><section class="cosmic-briefing" tabindex="-1" aria-labelledby="cosmic-stage-title"><span class="cosmic-eyebrow">ROUTE PREVIEW · NOT COMPLETED</span><h3 id="cosmic-stage-title">Stage ${stage.order}: Ayahs ${stage.first}–${stage.last}</h3><ol>${objectives.map(o=>`<li><strong>${esc(o.title)}</strong><p>${esc(o.description)}</p></li>`).join('')}</ol><div class="cosmic-stage-nav"><button class="cosmic-secondary" data-previous ${active===0?'disabled':''}>← Previous stage</button><button class="cosmic-secondary" data-next ${active===mission.stages.length-1?'disabled':''}>Next stage →</button></div><label>Flight pace<select data-flight-pace><option value="standard">Standard</option><option value="slow">Slow · extra reaction time</option></select></label><label>Pickup style<select data-pickup-mode><option value="mixed">Mixed · chunks 5 : ayahs 1 : words 4</option><option value="words">Word by word</option><option value="ayahs">Whole ayahs</option></select></label><label>Revision rounds per ayah set<select data-flight-rounds>${Array.from({length:8},(_,i)=>`<option value="${i+3}">${i+3} rounds</option>`).join('')}</select></label><p>Repeat each stage’s ayah set at least three times. Every round adds 7% to base flight speed and one more asteroid per wave. Mixed mode targets 5 chunks : 1 whole ayah : 4 single words; short passages adapt to word boundaries.</p><label class="flow-review-option"><input type="checkbox" data-flow-review> Add untimed gateway review at stage checkpoints</label><button class="cosmic-primary" data-launch-runner>Launch Star Runner</button><p class="cosmic-availability" role="status">Steer into the next correct ayah or word as it flows through space. Avoid authentic distractors and asteroids. Meteor Defense, Weak-Link Boss and independent oral recall integration remain in development. Flight begins at stage 1 and pauses at each safe checkpoint. Collect every selected ayah in order. Missed pieces return; wrong pickups keep earlier progress. Optional gateway review pauses at stage checkpoints. This is recognition practice, not independent memorization mastery.</p></section>`;
      root.querySelector('[data-launch-runner]').onclick = async () => {
        const token = ++generation;
        const slow = root.querySelector('[data-flight-pace]').value === 'slow';
        const rounds=Number(root.querySelector('[data-flight-rounds]').value);
        const pickupMode=root.querySelector('[data-pickup-mode]').value,memoryGateways=root.querySelector('[data-flow-review]').checked;
        const launch = root.querySelector('[data-launch-runner]');
        launch.disabled = true;
        try {
          const mounted = await mountStarRunner(root, mission, {slow,pickupMode,rounds,memoryGateways,isCurrent:()=>token===generation,onExit:()=>{flight=null;render(true);}});
          if (token !== generation || !root.isConnected) mounted?.dispose();
          else flight = mounted;
        } catch(error) { if(token===generation&&root.isConnected){flight?.dispose();flight=null;render(true);root.querySelector('.cosmic-availability').textContent=`Could not open flight: ${error.message}`;} }
      };
      root.querySelector('[data-change]').onclick = planner;
      root.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{active=Number(b.dataset.stage);render(true);});
      root.querySelector('[data-previous]').onclick=()=>{active--;render(true);};
      root.querySelector('[data-next]').onclick=()=>{active++;render(true);};
      if(focus)root.querySelector('.cosmic-briefing').focus();
    }
    render(true);
  }
  selection();
}
