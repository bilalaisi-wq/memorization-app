import {createGameplayFeedback} from './gameplay-feedback.js';
const feedbacks=new WeakMap();
// Supported puzzle correctness only. Never used to certify spoken recall or schedule FSRS.
export function showAnswerFeedback(root,correct,{detail='',focus=false}={}){
 if(!root)return;
 root.querySelector(':scope > .answer-feedback')?.remove();
 const box=document.createElement('section');box.className=`answer-feedback ${correct?'answer-correct':'answer-incorrect'}`;box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.setAttribute('aria-atomic','true');box.tabIndex=-1;
 const icon=document.createElement('span');icon.className='answer-symbol';icon.setAttribute('aria-hidden','true');icon.textContent=correct?'✓':'✕';
 const text=document.createElement('div'),title=document.createElement('strong');title.textContent=correct?'Correct!':'Not quite — check the word order and try again.';text.append(title);
 if(detail){const p=document.createElement('p');p.textContent=detail;text.append(p);}box.append(icon,text);
 if(correct){const stars=document.createElement('span');stars.className='answer-stars';stars.setAttribute('aria-hidden','true');stars.textContent='✦ ⋆ ✦';box.append(stars);}
 root.prepend(box);if(correct){let fx=feedbacks.get(root);if(!fx){fx=createGameplayFeedback(root);feedbacks.set(root,fx);}fx.correct(box,{id:crypto.randomUUID()});}else feedbacks.get(root)?.mistake();if(focus){box.scrollIntoView({block:'nearest',behavior:'instant'});box.focus({preventScroll:true});}
 return box;
}
