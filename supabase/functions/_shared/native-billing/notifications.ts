import {services,env,response,BillingError} from '../runtime.ts';
import {appleServices,verifyGooglePush} from './providers.ts';
import {APP_ID,requireValue} from './model.js';
import {store,reconcile} from './service.ts';
export function notificationEndpoint(provider:'apple'|'google'){
 return async(req:Request)=>{
  try{
   if(req.method!=='POST')throw new BillingError(405,'Use POST.');
   if(Number(req.headers.get('content-length'))>65536)throw new BillingError(413,'Notification too large.');
   const raw=await req.text();if(raw.length>65536)throw new BillingError(413,'Notification too large.');
   const s=services(),{cfg}=await store(s,provider);let eventId:string,reference:string;
   const body=JSON.parse(raw);
   if(provider==='apple'){
    requireValue(typeof body.signedPayload==='string','A signed notification is required.');
    const {verifier}=appleServices(cfg.environment);const notice=await verifier.verifyAndDecodeNotification(body.signedPayload);
    requireValue(notice.notificationUUID,'Missing Apple notification ID.');
    if(notice.notificationType==='TEST')return response({received:true,test:true});
    const tx=await verifier.verifyAndDecodeTransaction(requireValue(notice.data?.signedTransactionInfo,'Missing signed store transaction.'));
    eventId=notice.notificationUUID!;reference=requireValue(tx.originalTransactionId,'Missing original transaction.');
   }else{
    await verifyGooglePush(req);
    requireValue(typeof body.message?.messageId==='string'&&body.message.messageId.length<=200&&typeof body.message.data==='string','Invalid Pub/Sub envelope.');
    const data=JSON.parse(atob(body.message.data));requireValue(data.packageName===APP_ID,'Unexpected Google package.');
    if(data.testNotification)return response({received:true,test:true});
    reference=requireValue(data.subscriptionNotification?.purchaseToken||data.voidedPurchaseNotification?.purchaseToken,'Unsupported notification.');eventId=body.message.messageId;
   }
   await reconcile(s,provider,reference,null,eventId);return response({received:true});
  }catch(error){return response({error:error instanceof BillingError?error.message:'Store notification could not be verified. Retry later.'},error instanceof BillingError?error.status:503);}
 };
}
