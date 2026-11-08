import {clearLearningView} from '../ui/dom.js';
let active=null,generation=0;
export function stopChroniclesLab(){generation++;active?.dispose();active=null;}
export function pauseChroniclesLab(){active?.pause();}
export async function mountChroniclesLab(main){stopChroniclesLab();clearLearningView(main);main.querySelector('.page-heading h1').textContent='Comprehension Lab';const token=generation,p=document.createElement('p');p.setAttribute('role','status');p.textContent="Opening QUR'AN CHRONICLES…";main.append(p);try{const {mountChronicles}=await import('./ui.js');if(token!==generation||!main.isConnected)return;p.remove();active=mountChronicles(main);}catch(e){if(token===generation&&p.isConnected)p.textContent=e.message;}}
