import {versionedStore} from '../../ui/versioned-store.js';
import {campaignRefs as validateRefs} from './model.js';
export const REVISION_MISSIONS_KEY='ayah-revision-missions-v1';
const games=['snake','asteroids','maze','falling','bubble','sirat','link','runner'];
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const str=x=>typeof x==='string'&&x.length>0&&x.length<=2048;
const grade=x=>object(x)&&str(x.attemptId)&&['Again','Hard','Good','Easy'].includes(x.grade)&&typeof x.independent==='boolean'&&(x.nextReview==null||Number.isFinite(Date.parse(x.nextReview)));
const safeMetadata=x=>{if(Array.isArray(x))return x.every(safeMetadata);if(object(x))return Object.entries(x).every(([k,v])=>!['text','textUthmani','words','translation','audio','audioUrl','access_token','refresh_token'].includes(k)&&safeMetadata(v));return x===null||['string','number','boolean'].includes(typeof x);};
export function validMissions(d){try{return d?.version===1&&object(d.runs)&&Object.keys(d.runs).length<=2000&&Object.entries(d.runs).every(([id,r])=>
 /^[a-f0-9]{64}$/.test(id)&&r.id===id&&validateRefs(r.refs)&&games.includes(r.game)&&['ayah','passage'].includes(r.recallScheduler)&&
 (r.reason===null||typeof r.reason==='string'&&r.reason.length<=20000)&&Array.isArray(r.done)&&new Set(r.done).size===r.done.length&&r.done.every(str)&&
 object(r.pins)&&Object.entries(r.pins).every(([k,p])=>r.refs.includes(k)&&object(p)&&/^[a-f0-9]{64}$/.test(p.source)&&/^[a-f0-9]{64}$/.test(p.review))&&
 object(r.assessments)&&Object.entries(r.assessments).every(([t,a])=>r.done.includes(t)&&t.endsWith(':recall')&&grade(a))&&
 (r.pending===null||object(r.pending)&&str(r.pending.unitId)&&Array.isArray(r.pending.baseline)&&r.pending.baseline.every(str)&&(!r.pending.engine||r.pending.engine==='ayah'))&&
 Array.isArray(r.evidence)&&safeMetadata(r.evidence)&&safeMetadata(r.recallTarget));}catch{return false;}}
export function missionStore(storage){const s=versionedStore(storage,REVISION_MISSIONS_KEY,()=>({version:1,runs:{}}),validMissions);return {...s,
 open(plan){return s.transact(d=>{const entry={id:plan.id,refs:plan.refs,game:plan.game,reason:plan.reason,recallTarget:plan.recallTarget,recallScheduler:plan.recallScheduler,evidence:plan.evidence,done:[],pins:{},assessments:{},pending:null};if(!validMissions({version:1,runs:{[plan.id]:JSON.parse(JSON.stringify(entry))}}))throw Error('Invalid campaign metadata. Existing data is preserved.');d.runs[plan.id]??=entry;const r=d.runs[plan.id],tasks=plan.stages.flatMap(st=>st.tasks.map(t=>`${st.id}:${t}`));if(r.done.some((t,i)=>t!==tasks[i]))throw Error('Saved mission ordering needs recovery. Existing records preserved.');return r;});},
 pin(id,pins){return s.transact(d=>{const r=d.runs[id];for(const [key,p] of Object.entries(pins)){if(r.pins[key]&&JSON.stringify(r.pins[key])!==JSON.stringify(p))throw Error('Source or review revision changed. Export the saved campaign for recovery.');r.pins[key]=p;}});},
 complete(plan,task,assessment=null){return s.transact(d=>{const r=d.runs[plan.id];if(r.done.includes(task))return {duplicate:true};const order=plan.stages.flatMap(st=>st.tasks.map(t=>`${st.id}:${t}`));if(order[r.done.length]!==task)throw Error('Complete the current mission checkpoint first.');if(assessment&&!task.endsWith(':recall'))throw Error('Only a recall checkpoint can record an assessment.');if(task.endsWith(':recall')&&!grade(assessment))throw Error('A saved native assessment is required.');r.done.push(task);if(assessment){r.assessments[task]=assessment;r.pending=null;}return {duplicate:false};});},
 pending(id,value){return s.transact(d=>{d.runs[id].pending=value;});}
};}
