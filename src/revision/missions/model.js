import {catalog,reference,availableReference} from '../../../supabase/functions/_shared/content-policy.js';
import {sha256} from '../../content/library.js';
import {passageRefs,validateRefs} from '../../passage-context/model.js';
import {repairAnalysis} from '../../quest/repair/model.js';
import {validLinkEvidence} from '../../quest/cosmic/link-evidence.js';
export const LENGTHS=[5,10,15,20,30];
export function marathonRange({surah,selection='5',first=1,last}) {
 const c=catalog.chapters.find(c=>c.id===surah);
 if(!c)throw Error('Choose a canonical surah.');
 if(selection==='entire'){first=1;last=c.verseCount;}
 else if(LENGTHS.includes(Number(selection)))last=Math.min(c.verseCount,first+Number(selection)-1);
 else if(selection!=='custom')throw Error('Choose a supported passage length.');
 if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<1||last<first||last>c.verseCount)throw Error('Choose a valid forward range.');
 return validateRefs(Array.from({length:last-first+1},(_,i)=>`${surah}:${first+i}`));
}
export async function marathonPlan(refs,{game='snake',reason=null,evidence=[],recallTarget=null,recallScheduler='passage'}={}) {
 campaignRefs(refs);

 if(!['snake','asteroids','maze','falling','bubble','sirat','link','runner'].includes(game))throw Error('Choose an implemented bounded game.');
 if(game==='link'&&refs.length<2)throw Error('Ayah Link requires two real adjacent ayahs.');
 const config={version:1,refs:[...refs],game,reason,evidence,recallTarget,recallScheduler};
 const id=await sha256(JSON.stringify(config));
 const stages=[];
 for(let i=0;i<refs.length;){const surah=reference(refs[i]).surah;let end=i;while(end<refs.length&&end<i+5&&reference(refs[end]).surah===surah)end++;const keys=refs.slice(i,end),links=i&&reference(refs[i-1]).surah===surah?[refs[i-1],...keys]:keys;i=end;stages.push({id:`${id}:${stages.length}`,refs:keys,links,tasks:game==='link'?['study','link','repeat-link','recall','summary']:['study','game','repeat',...(links.length>1?['link']:[]),'recall','summary']});}
 return {...config,id,stages};
}
export function rescueRecommendations({lab={},memory={},learning={},links={},capture={},now=new Date()}={}) {
 const results=repairAnalysis({lab,memory}).recommendations.filter(r=>(['word-selection','word-order','phrase-transition'].includes(r.category)||r.category==='review-difficulty'&&r.evidence.some(e=>e.source==='self-reported-recall'))).map(r=>{const unit=r.category==='review-difficulty'?r.evidence.find(e=>e.source==='self-reported-recall'&&e.unit)?.unit:null;return {id:r.id,refs:unit?.refs||[r.key],unit,category:r.category,reason:[...new Set(r.evidence.map(e=>e.detail))].join(' '),evidence:r.evidence.map(e=>({id:e.id,source:e.source})),game:r.category==='word-selection'?'asteroids':r.category==='phrase-transition'?'maze':'snake'};});
 const addReview=(unit,card,history,scope)=>{if(!unit?.refs?.length)return;try{validateRefs(unit.refs);}catch{return;}if(card&&Number.isFinite(Date.parse(card.due))&&Date.parse(card.due)<+now)results.push({id:`due:${scope}:${unit.id}`,refs:unit.refs,category:'due-review',reason:`Scheduled review due ${card.due}. This is a review date, not evidence that you forgot.`,evidence:[{id:unit.id,source:scope+'-fsrs',due:card.due}],unit,scheduler:scope==='ayah'?'ayah':'passage',game:'snake'});
 if(scope==='ayah'){const h=(history||[]).at(-1);if(h&&['Again','Hard'].includes(h.grade))results.push({id:`recall:${scope}:${unit.id}`,refs:unit.refs,category:'review-difficulty',reason:`Learner self-rated ${h.grade}; no teacher or speech verification.`,evidence:[{id:h.attemptId||h.id||unit.id,source:'self-reported-recall'}],scheduler:'ayah',unit,game:'snake'});}};
 for(const r of Object.values(memory.records||{}))addReview(r.unit,r.card,r.history,'passage');
 for(const r of Object.values(learning.records||{}))if(r.key)addReview({id:`ayah:${r.key}`,type:'ayah',refs:[r.key]},r.memory?.card,r.memory?.history,'ayah');
 if(validLinkEvidence(links)){const groups=new Map();for(const e of links.events){if(e.scope!=='transition'||e.type!=='link:mistake'||!['opening-word-selection','boundary-endpoint-selection','self-reported-recall-difficulty'].includes(e.category)||!e.pairKey)continue;const refs=[e.fromRef,e.toRef];try{validateRefs(refs);}catch{continue;}const g=groups.get(e.pairKey)||{id:`transition:${e.pairKey}`,refs,category:'adjacent-continuation',game:'link',evidence:[],reason:'Recorded adjacent-ayah continuation responses; no spoken certification.'};g.evidence.push({id:e.id,source:e.category==='self-reported-recall-difficulty'?'self-reported-recall':'observed-link',revision:e.sourceRevision,pins:e.sourceFingerprints});groups.set(e.pairKey,g);}results.push(...groups.values());}
 for(const [id,r] of Object.entries(capture.runs||{}))for(const [i,e] of (r.memoryMistakes||[]).entries())if(e.key&&Array.isArray(e.expectedIds)&&Array.isArray(e.selectedIds))results.push({id:`carrier:${id}:${i}`,refs:[e.key],category:'word-selection',game:'asteroids',reason:'A deliberately captured carrier did not match the expected source unit. This is recognition evidence, not spoken recall.',evidence:[{id:`${id}:${i}`,source:'observed-carrier'}]});
 return results.filter(r=>{try{return r.refs.every(k=>availableReference(reference(k).key));}catch{return false;}}).sort((a,b)=>a.id.localeCompare(b.id));
}

export function revisionRange(options){if(options.scope==='range'){const first=reference(options.from),last=reference(options.to),keys=canonicalCampaignKeys(),start=keys.indexOf(first.key),end=keys.indexOf(last.key);if(start<0||end<start)throw Error('Choose a forward canonical range.');return campaignRefs(keys.slice(start,end+1));}if(options.scope==='juz'){const juz=catalog.juzs.find(j=>j.id===options.juz);if(!juz)throw Error('Choose a canonical juz.');const refs=juz.ranges.flatMap(r=>Array.from({length:r.last-r.first+1},(_,i)=>`${r.surah}:${r.first+i}`));return campaignRefs(refs);}return marathonRange(options);}

export const canonicalCampaignKeys=()=>catalog.chapters.flatMap(c=>Array.from({length:c.verseCount},(_,i)=>`${c.id}:${i+1}`));
export function campaignRefs(refs){if(!Array.isArray(refs)||!refs.length||refs.length>6236)throw Error('Choose a bounded canonical campaign.');const all=canonicalCampaignKeys(),start=all.indexOf(refs[0]);if(start<0||all.slice(start,start+refs.length).join('|')!==refs.join('|'))throw Error('Campaign references must be unique, canonical and consecutive.');return [...refs];}
