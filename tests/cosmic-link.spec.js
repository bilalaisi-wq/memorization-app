import {test,expect} from '@playwright/test';
import {localBundle} from '../src/content/library.js';
import {sha256} from '../supabase/functions/_shared/content-policy.js';
import {canonicalLinkAyah,reactorPlan,prepareLinkPlans,openingChoices} from '../src/quest/cosmic/link-content.js';
import {cosmicSurahs,createMission} from '../src/quest/cosmic/mission.js';
import {createAyahLink} from '../src/puzzles/arcade/cosmic/link.js';
import {createFlightController} from '../src/quest/cosmic/controller.js';
import {createLinkEvidence,LINK_EVIDENCE_KEY,weakLinkCandidates} from '../src/quest/cosmic/link-evidence.js';
import {comparableAyah} from '../src/quest/cosmic/gateways.js';
async function approved(ref,one=false){const b=localBundle(ref),parts=[];for(let first=1;first<=b.words.length;){const last=Math.min(b.words.length,first+(one?0:2));parts.push({id:parts.length+1,startWord:first,endWord:last,displayStatus:'approved',stopStatus:'pending_review'});first=last+1;}
  b.segmentationReview={verseKey:ref,version:1,sourceHash:await sha256(JSON.stringify({key:ref,text:b.textUthmani,words:b.words.map(w=>w.text)})),reviewerName:'TEST FIXTURE ONLY',reviewedAt:'2026-11-01T00:00:00Z',sourceEdition:'TEST',riwayah:'Hafs',segments:parts};return b;
}
function cross(g){const s=g.getSnapshot();g.dispatch({type:'choices'});const q=g.getSnapshot();g.dispatch({type:'select',choice:q.choices.findIndex(c=>comparableAyah(c.text)===comparableAyah(q.pair.target.words[0].text))});g.dispatch({type:'tick',dt:.25});g.dispatch({type:'tick',dt:.25});g.dispatch({type:'enter'});for(let i=0;i<4;i++)g.dispatch({type:'tick',dt:.25});}
function finish(g){for(let i=0;i<1000;i++){const s=g.getSnapshot();if(s.status==='checkpoint')return;if(s.status==='ready')g.start();else if(s.status==='demonstration'||s.status==='linking')g.dispatch({type:'hide-opening'});else if(s.status==='recall'){if(['guided','recognition'].includes(s.mode))cross(g);else g.dispatch({type:'submit-text',text:s.mode==='extended'?s.pair.target.text:s.pair.target.words[0].text});}else if(s.status==='crossing')g.dispatch({type:'tick',dt:.25});else if(s.status==='reactor'){g.dispatch({type:'arrange',order:s.pair.plan.groups.map(group=>s.tiles.findIndex(t=>t.id===group.id))});g.dispatch({type:'check-reactor'});}else if(s.status==='success')g.dispatch({type:'continue'});else throw Error(s.status);}throw Error('Link did not complete');}
test('canonical highlighting offsets preserve every free ayah and repeated opening choices stay unambiguous',()=>{
  for(const chapter of cosmicSurahs)for(const verse of chapter.verses){const a=canonicalLinkAyah(`${chapter.id}:${verse.id}`);expect(a.text).toBe(verse.text);expect(a.spans.length).toBe(verse.words.length);expect(a.text.slice(a.spans[0].start,a.spans[0].end).length).toBeGreaterThan(0);}
  const choices=openingChoices('83:7',771);expect(new Set(choices.map(c=>comparableAyah(c.text))).size).toBe(3);
});
test('reactor uses only a complete source-pinned approved display partition; never draft stops',async()=>{
  const b=await approved('1:7'),plan=await reactorPlan('1:7',b);expect(plan.kind).toBe('reviewed-phrases');expect(plan.groups.map(g=>g.text).join(' ').replace(/\s+/g,' ')).toBe(b.textUthmani.replace(/\s+/g,' '));
  for(const mutate of [b=>b.segmentationReview.segments[0].displayStatus='pending_review',b=>b.segmentationReview.segments[0].displayStatus='rejected',b=>b.segmentationReview.sourceHash='bad',b=>b.segmentationReview.segments[0].endWord++,b=>b.segmentationReview.reviewerName='']){const copy=structuredClone(b);mutate(copy);expect((await reactorPlan('1:7',copy)).kind).toBe('whole-ayah');}
  const changed=structuredClone(b);changed.words[0].text='invented';await expect(reactorPlan('1:7',changed)).rejects.toThrow();expect((await reactorPlan('1:7')).kind).toBe('whole-ayah');
});
test('demonstration marker fading, recall, progressive hints and genuine gateway travel preserve exact references',async()=>{
  const events=[],plans=await prepareLinkPlans(['1:1','1:2'],null),g=createAyahLink({refs:['1:2'],allRefs:['1:1','1:2'],plans,stageId:'demo',onEvent:e=>events.push(e)});g.start();expect(g.getSnapshot().markersVisible).toBe(true);g.dispatch({type:'connect'});expect(g.getSnapshot()).toMatchObject({status:'linking',markersVisible:false,linked:true});g.dispatch({type:'markers'});expect(g.getSnapshot().markersVisible).toBe(true);g.dispatch({type:'hide-opening'});
  g.dispatch({type:'hint'});g.dispatch({type:'hint'});g.dispatch({type:'hint'});expect(g.getSnapshot().hints).toBe(3);g.dispatch({type:'choices'});const s=g.getSnapshot();const wrong=s.choices.findIndex(c=>comparableAyah(c.text)!==comparableAyah(s.pair.target.words[0].text));g.dispatch({type:'select',choice:wrong});for(let i=0;i<2;i++)g.dispatch({type:'tick',dt:.25});g.dispatch({type:'enter'});expect(g.getSnapshot().status).toBe('repair');g.dispatch({type:'retry'});cross(g);expect(g.getSnapshot().status).toBe('success');g.dispatch({type:'continue'});expect(g.getSnapshot().status).toBe('checkpoint');expect(events.filter(e=>e.type==='link:hint')).toHaveLength(3);expect(events.find(e=>e.type==='link:mistake')).toMatchObject({fromRef:'1:1',targetRef:'1:2'});
});
test('all four levels are solvable and typed matches are distinct from spoken self-assessment',async()=>{
  const plans=await prepareLinkPlans(['112:1','112:2'],null);
  for(const mode of ['guided','recognition','opening','extended']){const events=[],g=createAyahLink({refs:['112:1','112:2'],plans,stageId:mode,mode,onEvent:e=>events.push(e)});finish(g);expect(g.getSnapshot().completed).toEqual(['112:2']);expect(events.some(e=>/fsrs|mastery/.test(e.type))).toBe(false);g.dispose();expect(g.getSnapshot().status).toBe('disposed');}
  const g=createAyahLink({refs:['112:2'],allRefs:['112:1','112:2'],plans,stageId:'spoken',mode:'opening'});g.start();g.dispatch({type:'recited'});expect(g.getSnapshot().status).toBe('comparison');g.dispatch({type:'assess',match:true});expect(g.getSnapshot().outcome).toBe('self-assessed-spoken');
  const retryEvents=[],retry=createAyahLink({refs:['112:2'],allRefs:['112:1','112:2'],plans,stageId:'retry-spoken',mode:'opening',onEvent:e=>retryEvents.push(e)});retry.start();retry.dispatch({type:'recited'});retry.dispatch({type:'assess',match:false});retry.dispatch({type:'retry'});retry.dispatch({type:'submit-text',text:retry.getSnapshot().pair.target.words[0].text});expect(retryEvents.find(e=>e.type==='link:transition-correct')).toMatchObject({assisted:true,independentEligible:false});expect(retryEvents.some(e=>e.category==='prior-reference-comparison')).toBe(true);
});
test('reviewed reactor accepts identical visible components without a provenance trap and preserves errors',async()=>{
  const ref='90:17',plan=await reactorPlan(ref,await approved(ref,true)),events=[],g=createAyahLink({refs:[ref],plans:{[ref]:plan},stageId:'reactor',mode:'opening',onEvent:e=>events.push(e)});g.start();g.dispatch({type:'submit-text',text:g.getSnapshot().pair.target.words[0].text});for(let i=0;i<4;i++)g.dispatch({type:'tick',dt:.25});expect(g.getSnapshot().status).toBe('reactor');
  let s=g.getSnapshot();g.dispatch({type:'arrange',order:[s.tiles.findIndex(t=>!t.target)]});g.dispatch({type:'check-reactor'});expect(g.getSnapshot().mistakes).toBe(1);
  const order=s.pair.plan.groups.map(group=>s.tiles.findIndex(t=>t.id===group.id));const repeated=order.filter((id,i)=>order.some((other,j)=>i!==j&&s.tiles[other].text===s.tiles[id].text));expect(repeated.length).toBeGreaterThan(1);
  const a=order.indexOf(repeated[0]),b=order.indexOf(repeated[1]);[order[a],order[b]]=[order[b],order[a]];g.dispatch({type:'arrange',order});expect(g.getSnapshot().charge).toBe(1);g.dispatch({type:'check-reactor'});expect(g.getSnapshot().status).toBe('success');expect(events.find(e=>e.type==='link:reactor-mistake').category).toBe('phrase-selection');
});
test('pair evidence is source-pinned, profile-isolated, recoverable and suitable for future boss selection',async()=>{
  const mission=await createMission({surahId:112,selection:'entire'}),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};let owner='a';
  const store=createLinkEvidence(mission,{storage,getOwner:()=>owner,runId:'pairs'}),event={type:'link:mistake',evidenceId:'1',targetRef:'112:2',fromRef:'112:1',category:'opening-word-selection',mode:'recognition',stageIndex:0,roundIndex:0};
  await store.record(event);await store.record(event);await store.record({...event,type:'link:hint',evidenceId:'2',hintLevel:2});await store.record({...event,type:'link:reactor-mistake',evidenceId:'3',category:'phrase-order'});
  expect(store.snapshot().events).toHaveLength(3);let weak=await weakLinkCandidates(store.snapshot());expect(weak).toHaveLength(1);expect(weak[0]).toMatchObject({pairKey:'112:1>112:2',selectionMistakes:1,hints:1});expect(weak[0].evidenceIds).toHaveLength(2);
  const stale=store.snapshot();stale.events.forEach(e=>e.sourceRevision='0'.repeat(64));expect(await weakLinkCandidates(stale)).toHaveLength(0);
  owner='b';await expect(store.record({...event,evidenceId:'4'})).rejects.toThrow('Account changed');owner='a';data.set(LINK_EVIDENCE_KEY,'original broken data');await expect(store.record({...event,evidenceId:'5'})).rejects.toThrow();expect(data.get(LINK_EVIDENCE_KEY)).toBe('original broken data');
});
test('director includes the cross-stage adjacent pair, keeps activities separate and never changes native FSRS',async()=>{
  const m=await createMission({surahId:1,selection:'entire'}),g=await createFlightController(m,{activity:'link',pickupMode:'ayahs',linkMode:'opening',rounds:3});g.start();
  for(let i=0;i<3;i++){finish(g);expect(g.nextStage()).toBe(true);}
  expect(g.getSnapshot().pair).toMatchObject({fromRef:'1:5',toRef:'1:6'});for(let i=0;i<3;i++){finish(g);if(i<2)g.nextStage();}expect(g.getSnapshot().routeComplete).toBe(true);g.switchActivity('runner');expect(g.getSnapshot().status).toBe('ready');g.dispose();
});
