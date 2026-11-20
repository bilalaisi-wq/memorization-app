import {profileStorage} from '../learner/profile-storage.js';
import {sourceRoman} from '../quest/cosmic/transliteration.js';
import {esc} from './dom.js';
export const READING_KEY='ayah-reading-aids-v1';
export function readingEnabled(storage=profileStorage){try{const p=JSON.parse(storage.getItem(READING_KEY));return p?.version===1&&p.showTransliteration===true;}catch{return false;}}
export function setReadingEnabled(value,storage=profileStorage){storage.setItem(READING_KEY,JSON.stringify({version:1,showTransliteration:!!value}));if(typeof document!=='undefined'){document.documentElement.dataset.transliteration=value?'on':'off';window.dispatchEvent(new CustomEvent('ayah-reading-change',{detail:{enabled:!!value}}));document.querySelectorAll('[data-show-transliteration]').forEach(n=>n.checked=!!value);}}
export function readingControl(){return `<label class="reading-toggle"><input type="checkbox" data-show-transliteration ${readingEnabled()?'checked':''}> Show Transliteration</label>`;}
export function initializeReadingAids(){
 document.documentElement.dataset.transliteration=readingEnabled()?'on':'off';
 document.addEventListener('change',event=>{if(!event.target.matches('[data-show-transliteration]'))return;try{setReadingEnabled(event.target.checked);}catch{event.target.checked=readingEnabled();}});
 window.addEventListener('ayahprofilechange',()=>{document.documentElement.dataset.transliteration=readingEnabled()?'on':'off';document.querySelectorAll('[data-reading-guide]').forEach(n=>n.remove());});
}
export function readingHTML(unit){const text=sourceRoman(unit);return text?`<span class="reading-roman" lang="ar-Latn" dir="ltr">${esc(text)}</span>`:'';}
// Companion panel, never a new source loader. Callers pass only visible authorized candidates.
// Tiny moving objects retain their geometry when reading aids change.
export function readingGuide(root,units,{label='Word and phrase reading guide',before=null}={}){
 if(!root)return;let panel=root.querySelector('[data-reading-guide]');
 if(!panel){panel=document.createElement('aside');panel.dataset.readingGuide='';panel.className='reading-guide';panel.setAttribute('aria-label',label);panel.innerHTML='<details open><summary></summary><div class="reading-candidates"></div></details>';panel.querySelector('summary').textContent=label;if(before)before.before(panel);else root.append(panel);}
 const candidates=new Map();for(let unit of units||[]){if(Array.isArray(unit?.words)){const words=unit.words;unit={...unit,text:words.map(w=>w.text).join(' '),sourceWords:words};}if(!unit||typeof unit.text!=='string'||!unit.text)continue;const id=unit.id||`${unit.ref||unit.key||unit.reference||''}:${unit.index??unit.position??''}:${unit.text}`;if(!candidates.has(id))candidates.set(id,unit);}
 const selected=[...candidates.values()].slice(0,12),signature=JSON.stringify(selected.map(u=>[u.id,u.text,u.readingLabel,sourceRoman(u)]));
 if(panel.dataset.signature===signature)return;panel.dataset.signature=signature;
 panel.querySelector('.reading-candidates').innerHTML=selected.length?selected.map(u=>`<div class="reading-candidate">${u.readingLabel?`<small>${esc(u.readingLabel)}</small>`:""}<span class="arabic" dir="rtl" lang="ar">${esc(u.text)}</span>${readingHTML(u)||'<small class="reading-unavailable">Source transliteration unavailable; verified audio remains available.</small>'}</div>`).join(''):'<p>Reading aids appear for visible study choices. No hidden recall answers are shown.</p>';
}

export function mountReadingSetting(root){if(!root||root.querySelector('[data-show-transliteration]'))return;const node=document.createElement('div');node.innerHTML=readingControl();root.prepend(node);}

// Keep the copyable Arabic sequence exact; its pronunciation is a separate sibling.
export function readingSequence(sequence,units){
 if(!sequence)return;let panel=sequence.nextElementSibling;if(!panel?.hasAttribute('data-reading-sequence')){panel=document.createElement('div');panel.dataset.readingSequence='';panel.className='reading-roman';panel.dir='ltr';panel.setAttribute('aria-label','Transliteration of assembled words');sequence.after(panel);}
 const words=(units||[]).slice(-12),roman=sourceRoman({sourceWords:words}),text=roman||(words.length?'Source transliteration unavailable; use verified audio.':'');panel.lang=roman?'ar-Latn':'en';if(panel.textContent!==text)panel.textContent=text;
}
