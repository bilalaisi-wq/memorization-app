import {createRewardStore} from '../../rewards/store.js';
import {profileStorage,activeProfileId} from '../../learner/profile-storage.js';
import {sha256} from '../../../supabase/functions/_shared/content-policy.js';
// Small supplementary XP uses existing lab/day/ayah caps, never native recall grades.
export function createFlightBonuses(mission,{storage=profileStorage,getOwner=activeProfileId,clock=()=>new Date()}={}){
  const owner=getOwner(),rewards=createRewardStore(storage);
  let pending=Promise.resolve();
  return {record(event){
    const operation=pending.then(async()=>{
      if(getOwner()!==owner)throw Error('Account changed; reopen the flight.');
      const blaster=event.type==='runner:asteroid-destroyed',boost=event.type==='runner:pickup-correct'&&event.boosted===true;
      if((!blaster&&!boost)||!event.awardedPoints||!event.scoreReceipt||!mission.refs.includes(event.targetRef))return {xp:0};
      const now=clock(),day=now.toISOString().slice(0,10);
      const receiptId=`quest:${await sha256(JSON.stringify([day,mission.id,event.stageIndex,event.roundIndex,event.scoreReceipt]))}`;
      if(getOwner()!==owner)throw Error('Account changed; bonus not saved to another profile.');
      return rewards.award({mode:'lab',unit:event.targetRef,action:blaster?'cosmic-blaster':'cosmic-boost',xp:blaster?2:4,receiptId,now});
    });
    pending=operation.catch(()=>{});return operation;
  }};
}
