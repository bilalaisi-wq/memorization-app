import {createFlowUnits} from './flow-content.js';
import {freeAyah} from './gateways.js';
// Visual chunks use original word recordings in order, never invented recitation cuts.
export function targetCueSources(unit){
  const ayah=freeAyah(unit.key),words=createFlowUnits([unit.key],'words');
  if(unit.kind==='ayah'&&unit.id===`ayah:${unit.key}`&&unit.text===ayah.text)return [ayah.audio];
  const end=unit.kind==='word'?unit.index+1:unit.endIndex;
  if(!Number.isInteger(unit.index)||unit.index<0||!Number.isInteger(end)||end>words.length||end<=unit.index)throw Error('Invalid target audio reference.');
  const selected=words.slice(unit.index,end);
  const id=unit.kind==='word'?selected[0].id:`chunk:${unit.key}:${unit.index}-${end}`;
  if(!['word','chunk'].includes(unit.kind)||unit.id!==id||unit.text!==selected.map(w=>w.text).join(' ')||unit.kind==='chunk'&&![2,3].includes(selected.length))throw Error('Target audio must match verified words.');
  return selected.map(w=>w.audio);
}
export function createTargetCuePlayer(audio){
  let generation=0,disposed=false,timer=null;
  const clear=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
  return {
    play(unit,{onComplete=()=>{},onFailure=()=>{}}={}){
      const token=++generation;clear();audio.stop();let sources,index=0;
      try{sources=targetCueSources(unit);}catch(error){onFailure(error);return;}
      const next=async()=>{
        if(disposed||token!==generation)return;
        if(index===sources.length){onComplete();return;}
        let settled=false;
        const fail=()=>{if(settled||disposed||token!==generation)return;settled=true;clear();audio.stop();onFailure(Error('Target recitation could not play. Retry audio or continue silently.'));};
        timer=setTimeout(fail,unit.kind==='ayah'?180000:30000);
        try{const ok=await audio.play(sources[index++],{onEnded:()=>{if(settled||disposed||token!==generation)return;settled=true;clear();next();},onError:fail});if(!ok)fail();}catch{fail();}
      };next();
    },
    stop(){generation++;clear();audio.stop();},
    dispose(){disposed=true;generation++;clear();audio.stop();},
  };
}
