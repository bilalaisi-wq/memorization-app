import {contentContracts} from '../puzzles/arcade/passage/contracts.js';
import {allFree,validateRefs} from './model.js';
const implemented=new Set(['falling','asteroids','snake','maze','bubble','sirat','bridge']);
export function compatibility({game,refs,units='words',wordCount=0,approved=false,registered=null,unitCount=0,groupWords=0}){
 try{validateRefs(refs);}catch{return {available:false,reason:'Select a valid contiguous passage.',fallback:'practice'};}
 const cross=refs.some(r=>r.split(':')[0]!==refs[0]?.split(':')[0]);
 if(cross&&['bridge','cosmic','runner','defense','link'].includes(game))return {available:false,reason:'This engine requires a same-surah route. Use individual ayah workspaces for this cross-surah passage.',fallback:'maze'};
 if(game==='chronicles')return {available:false,reason:'Comprehension Lab is planned; no game is registered yet.',fallback:'practice'};
 if(['cosmic','runner','defense','link'].includes(game))return {available:allFree(refs),reason:allFree(refs)?'Verified free Cosmic mission.':'Cosmic Rush currently supports Al-Fatihah and Juz Amma. Use bounded sequence practice or self-assessed revision for this passage.',fallback:'maze'};
 if(game==='practice'||game==='recall')return {available:true,reason:'Existing whole-ayah practice and assessment workflow.'};
 if(!implemented.has(game)||registered&&!registered.includes(game))return {available:false,reason:'This game is not registered and playable.',fallback:'practice'};
 if(game==='bridge'&&refs.length<2)return {available:false,reason:'Bridge Builder needs two adjacent ayahs.',fallback:'maze'};
 if(refs.length>50)return {available:false,reason:'Use a bounded workspace or at most 50 ayahs in one arcade run.',fallback:'practice'};
 const contract=contentContracts[game];
 if(contract&&!(game==='bridge'&&units==='words')&&!contract.units.includes(units))return {available:false,reason:'This game does not support that content unit.',fallback:'practice'};
 if(contract&&game!=='bridge'&&(unitCount>contract.maxUnits||units==='words'&&wordCount>contract.maxUnits))return {available:false,reason:'Use a bounded stage of at most twelve movable pieces.',fallback:'practice'};
 if(units==='transitions'&&game!=='bridge'||game==='bridge'&&!['words','transitions'].includes(units))return {available:false,reason:'Bridge Builder uses real adjacent-ayah transitions only.',fallback:'maze'};
 if(units==='visual-groups'&&(!contract?.units.includes(units)||unitCount<1||unitCount>contract.maxUnits||groupWords<1||groupWords>contract.maxGroupWords))return {available:false,reason:'Use source-backed visual groups within the game’s declared size limits. Grouping never approves a recitation stop.',fallback:'practice'};
 if(units==='study-segments'&&(!approved||unitCount<1||unitCount>contract.maxUnits||wordCount>(contract?.maxGroupWords||0)))return {available:false,reason:'This activity requires published, source-matched study segments within its readable size limit.',fallback:'practice'};
 return {available:true,reason:'Canonical word workspace or supported reviewed source unit.'};
}
