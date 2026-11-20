import {db,env,locked,BillingError} from '../runtime.ts';
import {requireValue} from './model.js';
import {verifyApple,verifyGoogle,acknowledgeGoogle} from './providers.ts';
export async function store(s:any,provider:string){
 requireValue(['apple','google'].includes(provider),'Unknown purchase provider.');
 const cfg:any=await db(s.admin.from('billing_store_config').select('*').eq('provider',provider).single());
 if(!cfg.verification_enabled)throw new BillingError(503,'Store verification is not enabled. Free learning remains available.');
 requireValue((cfg.environment==='sandbox')===(s.mode==='test'),'Native and website billing environments must match.');
 const products:any=await db(s.admin.from('billing_store_products').select('*').eq('provider',provider));
 return {cfg,products};
}
export async function binding(s:any,user:string){
 await db(s.admin.from('billing_store_bindings').upsert({user_id:user},{onConflict:'user_id',ignoreDuplicates:true}));
 const row:any=await db(s.admin.from('billing_store_bindings').select('account_token').eq('user_id',user).single());return row.account_token;
}
export async function reconcile(s:any,provider:string,reference:string,expectedUser:string|null,eventId:string|null=null){
 requireValue(typeof reference==='string'&&reference.length>0&&reference.length<=4096,'Invalid store reference.');
 const {cfg,products}=await store(s,provider),verify=()=>provider==='apple'?verifyApple(reference,products,cfg.environment):verifyGoogle(reference,products,cfg.environment);
 const initial:any=await verify();requireValue(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(initial.account_token),'This purchase has no supported learning-account binding. Contact support.');const owner:any=await db(s.admin.from('billing_store_bindings').select('user_id').eq('account_token',initial.account_token).maybeSingle());
 if(!owner||expectedUser&&owner.user_id!==expectedUser)throw new BillingError(403,'This purchase belongs to a different or deleted learning account. Sign into its original account or contact support.');
 return await locked(s,owner.user_id,async(token:string)=>{
  // Notifications are hints, not state updates. Re-fetch canonical store state under the shared user lock.
  const snapshot:any=await verify();requireValue(snapshot.account_token===initial.account_token,'Store ownership changed during verification.');
  await db(s.admin.rpc('billing_native_commit',{p_user:owner.user_id,p_lock:token,p_mode:s.mode,p_snapshot:snapshot,p_event:eventId}));
  if(provider==='google')await acknowledgeGoogle(snapshot);
  await db(s.admin.from('billing_native_reservations').delete().eq('user_id',owner.user_id));
  const entitlements=await db(s.admin.rpc('billing_entitlements_for',{p_user:owner.user_id}));
  return {verified:true,provider,transactionId:snapshot.transaction_id,status:snapshot.status,entitlements};
 });
}
export async function nativeAction(req:Request,s:any,user:any){
 if(Number(req.headers.get('content-length'))>8192)throw new BillingError(413,'Request too large.');
 const raw=await req.text();if(raw.length>8192)throw new BillingError(413,'Request too large.');
 let body:any;try{body=JSON.parse(raw);}catch{throw new BillingError(400,'Invalid request.');}
 if(!await db(s.admin.rpc('billing_native_rate',{p_user:user.id})))throw new BillingError(429,'Too many billing requests. Please wait a minute.');
 const provider=body.provider;requireValue(['apple','google'].includes(provider),'Unknown purchase provider.');
 if(body.action==='catalog'){
  const cfg:any=await db(s.admin.from('billing_store_config').select('*').eq('provider',provider).single());
  const ready=cfg.verification_enabled&&(cfg.environment==='sandbox')===(s.mode==='test');
  const enabled=ready&&cfg.purchase_enabled&&(cfg.environment==='sandbox'||cfg.sandbox_approved&&cfg.policy_reviewed&&cfg.privacy_url?.startsWith('https://')&&cfg.terms_url?.startsWith('https://'));
  const products:any=ready?await db(s.admin.from('billing_store_products').select('product_id,base_plan_id,plan,cadence').eq('provider',provider).eq('enabled',true)):[];
  const globalConfig:any=await db(s.admin.from('billing_config').select('guardian_enabled').eq('id',1).single());
  const visibleProducts=products.filter((p:any)=>p.plan!=='guardian'||globalConfig.guardian_enabled);
  const bindingToken=ready?await binding(s,user.id):null;
  return {enabled,restoreEnabled:ready,environment:cfg.environment,bindingToken,products:visibleProducts,privacyUrl:cfg.privacy_url,termsUrl:cfg.terms_url};
 }
 if(body.action==='start'){
  await store(s,provider);await binding(s,user.id);
  const requestId=await db(s.admin.rpc('billing_native_start',{p_user:user.id,p_provider:provider,p_product:body.productId,p_base:body.basePlanId||''}));return {requestId};
 }
 if(body.action==='cancel'){
  requireValue(/^[a-f0-9-]{36}$/i.test(body.requestId||''),'Invalid purchase request.');
  await db(s.admin.from('billing_native_reservations').delete().eq('user_id',user.id).eq('request_id',body.requestId));return {cancelled:true};
 }
 if(body.action==='verify')return await reconcile(s,provider,body.reference,user.id);
 if(body.action==='refresh'){
  await store(s,provider);const rows:any=await db(s.admin.from('billing_native_subscriptions').select('purchase_reference').eq('user_id',user.id).eq('provider',provider).limit(10));
  for(const row of rows)await reconcile(s,provider,row.purchase_reference,user.id);
  return {entitlements:await db(s.admin.rpc('billing_entitlements_for',{p_user:user.id}))};
 }
 throw new BillingError(400,'Unknown native billing action.');
}
