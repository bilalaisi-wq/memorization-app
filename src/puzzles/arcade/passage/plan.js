import {validateRefs,contentView,fingerprints,approvedStudy} from '../../../passage-context/model.js';
import {sha256} from '../../../content/library.js';
import {validateDifficulties} from '../difficulty.js';
import {contentContracts} from './contracts.js';
export async function createArcadePlan(bundles,{game,sourceUnitKind='auto',memoryDifficulty='guided',motorDifficulty='relaxed',scope=null,groupSize=null,seed=1,chainMode='practice'}={}){
 if(!['classic','practice'].includes(chainMode))throw Error('Choose Classic or Practice strikes.');
 const contract=contentContracts[game];if(!contract)throw Error('Choose an implemented game.');validateDifficulties({memoryDifficulty,motorDifficulty});validateRefs(bundles.map(b=>b.key));if(bundles.length>contract.maxAyahs)throw Error('Choose up to 50 consecutive ayahs per arcade run.');
 if(game==='bridge'&&(bundles.length<2||bundles.some(b=>b.surah!==bundles[0].surah)))throw Error('Bridge Builder needs adjacent ayahs within one surah.');
 if(game==='bridge'&&!['auto','transitions'].includes(sourceUnitKind))throw Error('Bridge Builder tests adjacent ayah transitions, not word or phrase stages.');
 if(game!=='bridge'&&!['auto',...contract.units].includes(sourceUnitKind))throw Error('Unsupported source unit. Choose canonical words or visual groups.');
 if(scope&&(bundles.length!==1||!Number.isInteger(scope.first)||!Number.isInteger(scope.last)||scope.first<1||scope.last<scope.first||scope.last>bundles[0].words.length))throw Error('Invalid canonical study range.');
 if(groupSize!==null&&(!Number.isInteger(groupSize)||groupSize<1||groupSize>contract.maxGroupWords))throw Error(`This game supports at most ${contract.maxGroupWords} words per visual piece.`);
 const pins={},stages=[];
 for(const b of bundles){pins[b.key]=await fingerprints(b);if(game==='bridge')continue;const first=scope?.first||1,last=scope?.last||b.words.length,canonical=contentView(b,'words').filter(w=>w.position>=first&&w.position<=last);let units=[];
  if(sourceUnitKind==='study-segments'){
   const reviewed=approvedStudy(b);if(!reviewed.length||reviewed.some(s=>s.firstWord<first||s.lastWord>last||s.lastWord-s.firstWord+1>contract.maxGroupWords))throw Error('Complete source-matched reviewed study segments within this game’s size limit are unavailable. Choose visual groups instead.');
   units=reviewed.map(s=>({kind:'approved-study',positions:Array.from({length:s.lastWord-s.firstWord+1},(_,i)=>s.firstWord+i),reviewId:s.id,stopApproved:s.stopApproved,restartApproved:s.restartApproved}));
  }else{
   const baseline=canonical.length<=12?1:canonical.length<=24?2:canonical.length<=36?3:5;
   let size=groupSize??(sourceUnitKind==='words'?1:Math.min(contract.maxGroupWords,memoryDifficulty==='guided'?Math.min(2,baseline):memoryDifficulty==='expert'?Math.max(2,baseline):baseline));
   size=Math.min(size,contract.maxGroupWords);
   for(let i=0;i<canonical.length;i+=size)units.push({kind:size===1?'word':'visual-group',positions:canonical.slice(i,i+size).map(w=>w.position),stopApproved:false,restartApproved:false});
  }
  for(let i=0;i<units.length;i+=contract.maxUnits){const part=units.slice(i,i+contract.maxUnits);stages.push({reference:b.key,firstWord:part[0].positions[0],lastWord:part.at(-1).positions.at(-1),units:part});}
 }
 if(game==='bridge')stages.push({reference:bundles[0].key,transitions:bundles.slice(1).map((b,i)=>({id:`${bundles[i].key}>${b.key}`,from:bundles[i].key,to:b.key}))});
 const base={version:1,game,refs:bundles.map(b=>b.key),pins,memoryDifficulty,motorDifficulty,sourceUnitKind,chainMode,seed:seed>>>0,stages};
 for(let i=0;i<stages.length;i++){stages[i].seed=(base.seed+i*1009)>>>0;stages[i].id=await sha256(JSON.stringify([base.game,base.refs,pins,memoryDifficulty,motorDifficulty,i,stages[i]]));}
 return {...base,id:await sha256(JSON.stringify(base))};
}
