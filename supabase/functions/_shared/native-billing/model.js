import {BillingError} from '../billing-core.js';
export const APP_ID='com.ayahaday.app';
export const requireValue=(value,message)=>{if(!value)throw new BillingError(400,message);return value;};
export function mappedProduct(products,provider,id,base=''){
 return requireValue(products.find(p=>p.provider===provider&&p.product_id===id&&p.base_plan_id===base),'Store product is not configured.');
}
const iso=value=>Number.isFinite(+value)&&+value>0?new Date(+value).toISOString():null;
export function appleSnapshot(tx,renewal,status,products,environment,now=Date.now()){
 requireValue(tx.bundleId===APP_ID&&tx.environment===(environment==='sandbox'?'Sandbox':'Production'),'Apple application or environment mismatch.');
 requireValue(tx.type==='Auto-Renewable Subscription'&&tx.originalTransactionId&&tx.transactionId&&tx.appAccountToken,'Apple account binding is missing.');
 const product=mappedProduct(products,'apple',tx.productId);
 const expiry=iso(tx.expiresDate),revoked=!!tx.revocationDate||status===5||tx.isUpgraded===true;
 const state=revoked?'revoked':status===4?'grace':status===3?'billing_retry':status===2?'expired':status===1?'active':'expired';
 const access=!revoked&&state==='grace'?iso(renewal.gracePeriodExpiresDate):state==='active'?expiry:null;
 return {provider:'apple',environment,chain_id:String(tx.originalTransactionId),transaction_id:String(tx.transactionId),product_id:product.product_id,base_plan_id:'',plan:product.plan,status:state,
  account_token:tx.appAccountToken,expires_at:expiry,access_until:access&&Date.parse(access)>now?access:null,auto_renew:renewal.autoRenewStatus===1,purchase_reference:String(tx.originalTransactionId)};
}
export function googleSnapshot(data,products,environment,reference,now=Date.now()){
 requireValue((data.testPurchase!==undefined)===(environment==='sandbox'),'Google purchase environment mismatch.');
 requireValue(data.externalAccountIdentifiers?.obfuscatedExternalAccountId,'Google account binding is missing.');
 // One auto-renewing line per purchased tier. Do not guess among prepaid/installment/mixed orders.
 requireValue(data.lineItems?.length===1&&data.lineItems[0].autoRenewingPlan&&!data.lineItems[0].autoRenewingPlan.installmentDetails,'Unsupported Google subscription configuration.');
 const line=data.lineItems[0],product=mappedProduct(products,'google',line.productId,line.offerDetails?.basePlanId||'');
 const status={SUBSCRIPTION_STATE_ACTIVE:'active',SUBSCRIPTION_STATE_IN_GRACE_PERIOD:'grace',SUBSCRIPTION_STATE_CANCELED:'canceled',SUBSCRIPTION_STATE_ON_HOLD:'on_hold',SUBSCRIPTION_STATE_PAUSED:'paused',SUBSCRIPTION_STATE_PENDING:'pending',SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED:'expired',SUBSCRIPTION_STATE_EXPIRED:'expired'}[data.subscriptionState];
 requireValue(status,'Unknown Google subscription state.');const expiry=Number.isFinite(Date.parse(line.expiryTime))?line.expiryTime:null;
 return {provider:'google',environment,chain_id:reference,transaction_id:line.latestSuccessfulOrderId||data.latestOrderId||`pending:${reference}`,product_id:product.product_id,base_plan_id:product.base_plan_id,plan:product.plan,status,
  account_token:data.externalAccountIdentifiers.obfuscatedExternalAccountId,expires_at:expiry,access_until:['active','grace','canceled'].includes(status)&&expiry&&Date.parse(expiry)>now?expiry:null,
  auto_renew:line.autoRenewingPlan.autoRenewEnabled===true,purchase_reference:reference,linked_reference:data.linkedPurchaseToken||null,acknowledge:data.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING'&&['active','grace','canceled'].includes(status)};
}
