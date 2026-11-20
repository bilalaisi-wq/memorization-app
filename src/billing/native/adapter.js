import {activeProfileId,profileRevision} from '../../learner/profile-storage.js';
// No client-side subscription state: every delivery/restore requires the authenticated backend.
export function purchaseAdapter({provider,plugin,api,owner=activeProfileId,revision=profileRevision}){
 const initialOwner=owner(),initialRevision=revision();let busy=false,disposed=false,catalog=null;
 const current=()=>{if(disposed||!initialOwner||owner()!==initialOwner||revision()!==initialRevision)throw Error('Account changed. Reopen subscriptions for your current account.');};
 const call=async(body)=>{current();const result=await api.invoke('native',{provider,...body});current();return result;};
 const exclusive=async fn=>{current();if(busy)throw Error('A store operation is already in progress.');busy=true;try{return await fn();}finally{busy=false;}};
 const reference=tx=>provider==='apple'?tx.transactionId:tx.purchaseToken;
 async function verify(tx){
  current();const id=reference(tx);if(typeof id!=='string'||!id)throw Error('The store has not completed this purchase. Try Restore after approval.');
  const result=await call({action:'verify',reference:id});if(result.verified!==true)throw Error('Purchase was not verified. Access is unchanged.');
  // StoreKit finishing happens ONLY after verified server delivery. Play acknowledgment is server-side.
  if(provider==='apple')await plugin.finishTransaction({transactionId:tx.transactionId,allowUnverified:false});
  current();return result;
 }
 return {
  async catalog(){current();await plugin.configure({autoFinishTransactions:false});catalog=await call({action:'catalog'});if(!catalog.enabled)return {...catalog,items:[]};
   const {products}=await plugin.getProducts({productIdentifiers:[...new Set(catalog.products.map(p=>p.product_id))],productType:'subs'});current();
   const items=catalog.products.flatMap(p=>{const product=products.find(x=>provider==='apple'?x.identifier===p.product_id:x.planIdentifier===p.product_id&&x.identifier===p.base_plan_id);
    return product&&typeof product.priceString==='string'&&!product.introductoryPrice?[{...p,price:product.priceString,storeProduct:product}]:[];});return {...catalog,items};
  },
  purchase(item){return exclusive(async()=>{
   if(!catalog?.enabled||!catalog.bindingToken||!catalog.products.some(p=>p.product_id===item.product_id&&p.base_plan_id===item.base_plan_id))throw Error('This store product is not available.');
   const {requestId}=await call({action:'start',productId:item.product_id,basePlanId:item.base_plan_id});let tx;
   try{tx=await plugin.purchaseProduct({productIdentifier:item.product_id,planIdentifier:item.base_plan_id||undefined,productType:'subs',appAccountToken:catalog.bindingToken,autoAcknowledgePurchases:false,isConsumable:false});}
   catch{await call({action:'cancel',requestId}).catch(()=>{});throw Error('The store did not complete the purchase. Nothing is unlocked; use Restore if payment is pending.');}
   return await verify(tx);
  });},
  restore(){return exclusive(async()=>{
   if(!catalog)catalog=await call({action:'catalog'});if(!catalog.restoreEnabled||!catalog.bindingToken)throw Error('Store restoration is not configured in this build.');
   await plugin.configure({autoFinishTransactions:false});await plugin.restorePurchases();current();
   const {purchases}=await plugin.getPurchases({productType:'subs',appAccountToken:catalog.bindingToken,onlyCurrentEntitlements:true});current();
   let restored=0;
   const unfinished=provider==='apple'&&typeof plugin.getUnfinishedTransactions==='function'?(await plugin.getUnfinishedTransactions({includeUnverified:false})).transactions:[];current();
   const unique=new Map([...purchases,...unfinished].map(tx=>[reference(tx),tx]));
   const batch=[...unique.values()].slice(0,10);
   for(const tx of batch){await verify(tx);restored++;}
   const result=await call({action:'refresh'});return {...result,restored,remaining:Math.max(0,unique.size-batch.length)};
  });},
  refresh:()=>exclusive(()=>call({action:'refresh'})),
  manage:()=>exclusive(async()=>{await plugin.manageSubscriptions();current();}),
  dispose(){disposed=true;catalog=null;},
 };
}
