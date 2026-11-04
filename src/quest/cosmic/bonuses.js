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
      const link=event.type==='link:transition-correct',boss=event.type==='boss:memory-correct';
      const defense=event.type==='defense:memory-correct'||link||boss;
      const blaster=event.type==='runner:asteroid-destroyed',boost=event.type==='runner:pickup-correct'&&event.boosted===true;
      if((!blaster&&!boost&&!defense)||!defense&&!event.awardedPoints||!defense&&!event.scoreReceipt||!mission.refs.includes(event.targetRef))return {xp:0};
      const now=clock(),day=now.toISOString().slice(0,10);
      const receiptId=`quest:${await sha256(JSON.stringify([day,mission.id,event.stageIndex,event.roundIndex,defense?`${boss?'boss':link?'link':'defense'}:recognition:${event.targetRef}${boss?':'+(event.questionId||'shield'):''}`:event.scoreReceipt]))}`;
      if(getOwner()!==owner)throw Error('Account changed; bonus not saved to another profile.');
      return rewards.award({mode:'lab',unit:event.targetRef,action:boss?'cosmic-boss':link?'cosmic-link':defense?'cosmic-defense':blaster?'cosmic-blaster':'cosmic-boost',xp:blaster?2:4,receiptId,now});
    });
    pending=operation.catch(()=>{});return operation;
  }};
}
