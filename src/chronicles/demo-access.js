import {billingClient} from '../billing/client.js';
import {activeProfileId} from '../learner/profile-storage.js';
export async function authorizeChroniclesDemo(client){const owner=activeProfileId(),ent=await billingClient(client).entitlements();if(owner!==activeProfileId()||ent.developer!==true)throw Error('Active server-authorized developer mode is required for the mechanics demo.');return {mechanicsOnly:true};}
