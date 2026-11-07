import {reportStudyExposure} from '../study-exposure.js';
import {activeProfileId} from '../learner/profile-storage.js';
import './ui.css';
let active=null;
export function playAdaptiveRecitation(){if(!active)return false;active.listen();return true;}
export function disposeAdaptivePractice(){active?.dispose();active=null;}
export function mountAdaptivePractice(main,{reference,ctx}){
 const bar=main.querySelector('.mode-row');if(!bar)return;
 const button=document.createElement('button');button.className='text-button';button.dataset.adaptivePractice='';button.textContent='✦ Adaptive groups & cumulative practice';bar.after(button);
 button.onclick=async()=>{button.disabled=true;const owner=activeProfileId();try{const {openPassageStudio}=await import('../passage/ui.js');if(!button.isConnected||owner!==activeProfileId())return;disposeAdaptivePractice();const root=document.createElement('section');root.className='context-lab-content native-adaptive';button.after(root);const hidden=[...main.querySelectorAll('.builder,.practice-controls,.bottom-row,.practice-next-step')];hidden.forEach(n=>n.style.display='none');const references=[...main.querySelectorAll('.reference-card .full-verse,.reference-card .translation,#reference-toggle')],original=new Map(references.map(n=>[n,n.style.display]));let concealed=false;const conceal=flag=>{if(!flag&&concealed&&owner===activeProfileId()){try{reportStudyExposure([reference]);}catch{flag=true;}}concealed=flag;references.forEach(n=>n.style.display=flag?'none':original.get(n));};let studio=null;const dispose=()=>{studio?.close();root.remove();hidden.forEach(n=>n.style.display='');button.disabled=false;};active={dispose,listen:()=>studio?.listen()};studio=openPassageStudio({...ctx,inlineRoot:root,initialReference:reference,onAssessmentView:conceal,onClose:()=>{conceal(false);root.remove();hidden.forEach(n=>n.style.display='');button.disabled=false;active=null;}});}catch(e){button.disabled=false;button.textContent=e.message;}};
}
