import {generateKeyPair,exportJWK,SignJWT} from 'npm:jose@6.2.18';
import {SignedDataVerifier,Environment} from 'npm:@apple/app-store-server-library@3.1.0';
import {verifyGooglePush} from './providers.ts';
const ok=(x:boolean)=>{if(!x)throw Error('Assertion failed');};
const rejects=async(fn:()=>Promise<unknown>)=>{try{await fn();}catch{return;}throw Error('Expected verification rejection');};
Deno.test('Google RTDN uses pinned official JWKS issuer, exact audience, signed email and expiry; fabricated pushes cannot authenticate',async()=>{
 const original=globalThis.fetch,{publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='fixture';
 Deno.env.set('GOOGLE_RTDN_AUDIENCE','https://billing.example.test/push');Deno.env.set('GOOGLE_RTDN_SERVICE_EMAIL','push@example.test');
 let requests=0;globalThis.fetch=async input=>{ok(String(input)==='https://www.googleapis.com/oauth2/v3/certs');requests++;return Response.json({keys:[jwk]});};
 try{
  const token=async(overrides:any={})=>await new SignJWT({email:'push@example.test',email_verified:true,...overrides}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuer(overrides.iss||'https://accounts.google.com').setAudience(overrides.aud||'https://billing.example.test/push').setIssuedAt().setExpirationTime(overrides.exp||'5m').sign(privateKey);
  const req=(t:string)=>new Request('https://billing.example.test/push',{headers:{authorization:'Bearer '+t}});
  await verifyGooglePush(req(await token()));ok(requests===1);
  for(const claims of [{email:'attacker@example.test'},{email_verified:false},{aud:'https://other.test'},{iss:'https://attacker.test'},{exp:1}])await rejects(async()=>verifyGooglePush(req(await token(claims))));
  await rejects(()=>verifyGooglePush(req('not-a-signed-token')));
 }finally{globalThis.fetch=original;Deno.env.delete('GOOGLE_RTDN_AUDIENCE');Deno.env.delete('GOOGLE_RTDN_SERVICE_EMAIL');}
});
Deno.test('official Apple verifier rejects an unsigned notification and attacker transaction instead of trusting client fields',async()=>{
 const verifier=new SignedDataVerifier([],false,Environment.SANDBOX,'com.ayahaday.app');
 const forged=btoa(JSON.stringify({alg:'none'}))+'.'+btoa(JSON.stringify({bundleId:'com.ayahaday.app',environment:'Sandbox',appAccountToken:'claimed',expiresDate:9999999999999}))+'.';
 await rejects(()=>verifier.verifyAndDecodeNotification(forged));await rejects(()=>verifier.verifyAndDecodeTransaction(forged));
});
Deno.test('native reconciliation queries canonical Play state under the user lock; late events cannot restore revoked access or cross accounts',async()=>{
 const {reconcile}=await import('./service.ts');const {exportPKCS8}=await import('npm:jose@6.2.18');const {privateKey}=await generateKeyPair('RS256',{extractable:true});
 const account='00000000-0000-4000-8000-000000000001',original=globalThis.fetch;
 Deno.env.set('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',JSON.stringify({client_email:'fixture@example.test',private_key:await exportPKCS8(privateKey)}));
 const product={provider:'google',product_id:'example.explorer',base_plan_id:'monthly',plan:'explorer'};
 let read=0,snapshot:any=null,commits=0,locks=0;const receipts=new Set();
 const purchase=()=>({testPurchase:{},externalAccountIdentifiers:{obfuscatedExternalAccountId:account},subscriptionState:++read===1?'SUBSCRIPTION_STATE_ACTIVE':'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{productId:product.product_id,offerDetails:{basePlanId:'monthly'},expiryTime:'2099-01-01T00:00:00Z',autoRenewingPlan:{autoRenewEnabled:false},latestSuccessfulOrderId:'ORDER'}]});
 globalThis.fetch=async(input)=>{const url=String(input);if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture-only',expires_in:300});if(url.startsWith('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.ayahaday.app/purchases/subscriptionsv2/tokens/'))return Response.json(purchase());throw Error('Unexpected provider URL');};
 class Query{constructor(private name:string){}select(){return this;}eq(){return this;}single(){return this;}maybeSingle(){return this;}delete(){return this;}then(resolve:any){return Promise.resolve({error:null,data:this.name==='billing_store_config'?{verification_enabled:true,environment:'sandbox'}:this.name==='billing_store_products'?[product]:this.name==='billing_store_bindings'?{user_id:account}:null}).then(resolve);}}
 const s:any={mode:'test',admin:{from:(name:string)=>new Query(name),rpc:async(name:string,args:any)=>{
  if(name==='billing_acquire_lock'){locks++;return {data:true,error:null};}
  if(name==='billing_native_commit'){if(receipts.has(args.p_event))return {data:false,error:null};receipts.add(args.p_event);snapshot=args.p_snapshot;commits++;}
  return {data:name==='billing_entitlements_for'?{plan:'free',features:{juzAmma:true}}:true,error:null};
 }}};
 try{
  await reconcile(s,'google','valid-token',account,'late-notice');ok(read===2);ok(snapshot.status==='expired'&&snapshot.access_until===null);
  await reconcile(s,'google','valid-token',account,'late-notice');ok(commits===1);const before=locks;
  await rejects(()=>reconcile(s,'google','valid-token','00000000-0000-4000-8000-000000000002','foreign'));ok(locks===before);
 }finally{globalThis.fetch=original;Deno.env.delete('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');}
});
