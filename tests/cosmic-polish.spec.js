import {test,expect} from '@playwright/test';
import {cosmicRollout} from '../src/quest/cosmic/release.js';
import {cosmicSurahs,createMission} from '../src/quest/cosmic/mission.js';
import {createFlowUnits} from '../src/quest/cosmic/flow-content.js';
import {createFlowRunner} from '../src/puzzles/arcade/cosmic/flow-runner.js';
import {readCosmicPreferences,setCosmicPreference,COSMIC_PREFERENCES_KEY} from '../src/quest/cosmic/preferences.js';
import {createAudioManager} from '../src/puzzles/arcade/services.js';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('rollout leaves every existing standalone entry available and preferences never modify learning records',()=>{
 expect(cosmicRollout(false)).toEqual({runner:true,defense:true,link:true,expeditions:false});const storage=store();storage.setItem('ayah-learning-v1','legacy');setCosmicPreference('muted',true,storage);setCosmicPreference('lowEffects',true,storage);expect(readCosmicPreferences(storage)).toMatchObject({muted:true,lowEffects:true});expect(storage.getItem('ayah-learning-v1')).toBe('legacy');storage.setItem(COSMIC_PREFERENCES_KEY,'malformed');expect(()=>setCosmicPreference('muted',false,storage)).toThrow();expect(storage.getItem(COSMIC_PREFERENCES_KEY)).toBe('malformed');
});
test('all free surahs and supported passage sizes retain canonical coverage and compact word displays preserve diacritics',async()=>{
 for(const chapter of cosmicSurahs){for(const selection of ['5','10','15','20','custom','entire']){const m=await createMission({surahId:chapter.id,selection,start:1,end:chapter.verses.length});expect(m.stages.flatMap(s=>s.refs)).toEqual(m.refs);expect(m.refs).toHaveLength(selection==='custom'||selection==='entire'?chapter.verses.length:Math.min(Number(selection),chapter.verses.length));}}
 const unit=cosmicSurahs.flatMap(s=>s.verses.flatMap(v=>createFlowUnits([`${s.id}:${v.id}`],'words'))).find(w=>w.text.replace(/\p{M}/gu,'').length>=10),g=createFlowRunner({units:[unit],compact:true,stageId:'compact'});g.start();expect(g.getSnapshot().objects.filter(o=>o.kind==='pickup').every(o=>o.ribbon)).toBe(true);expect(g.getSnapshot().objects.find(o=>o.unit?.id===unit.id).unit.text).toBe(unit.text);g.dispose();
});
test('audio manager keeps an explicit zero volume and cleans up interrupted playback without requiring sound for progress',async({page})=>{
 await page.goto('/');const state=await page.evaluate(async()=>{const {createAudioManager}=await import('/src/puzzles/arcade/services.js');const all=[];class Audio{constructor(src){this.src=src;all.push(this);}async play(){this.active=true;}pause(){this.active=false;}load(){}removeAttribute(){}}const a=createAudioManager({AudioClass:Audio,initialVolume:0});await a.play('https://example.test/verified.mp3');const volume=a.getVolume();a.mute(true);const muted=all[0].muted;a.dispose();return {volume,muted,active:all[0].active,ended:all[0].onended};});expect(state).toEqual({volume:0,muted:true,active:false,ended:null});
});
