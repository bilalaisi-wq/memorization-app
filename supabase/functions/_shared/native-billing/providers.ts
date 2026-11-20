import {AppStoreServerAPIClient,Environment,SignedDataVerifier} from 'npm:@apple/app-store-server-library@3.1.0';
import {Buffer} from 'node:buffer';
import {importPKCS8,SignJWT,createRemoteJWKSet,jwtVerify} from 'npm:jose@6.2.18';
import {env,BillingError} from '../runtime.ts';
import {APP_ID,appleSnapshot,googleSnapshot,requireValue} from './model.js';
const timed=async(url:string,options:RequestInit={})=>{const response=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});if(!response.ok)throw new BillingError(503,'Store verification is temporarily unavailable.');return response;};
// Override only transport; Apple's maintained library still signs API calls and validates responses.
class TimedAppleClient extends AppStoreServerAPIClient {
 protected override async makeFetchRequest(path:string,query:URLSearchParams,method:string,body:any,headers:any):Promise<any>{
  const base=env('APPLE_ENVIRONMENT')==='sandbox'?'https://api.storekit-sandbox.itunes.apple.com':'https://api.storekit.itunes.apple.com';
  return await timed(base+path+'?'+query.toString(),{method,body,headers});
 }
}
export function appleServices(environment:string){
 requireValue(env('APPLE_ENVIRONMENT')===environment,'Apple verification environment is not configured.');
 const roots=JSON.parse(env('APPLE_ROOT_CERTIFICATES_BASE64')||'[]');requireValue(Array.isArray(roots)&&roots.length>0&&roots.length<=5,'Configure trusted Apple root certificates.');
 const appleEnv=environment==='sandbox'?Environment.SANDBOX:Environment.PRODUCTION;
 const verifier=new SignedDataVerifier(roots.map((r:string)=>Buffer.from(r,'base64')),true,appleEnv,APP_ID,environment==='production'?Number(env('APPLE_APP_ID')):undefined);
 requireValue(env('APPLE_PRIVATE_KEY')&&env('APPLE_KEY_ID')&&env('APPLE_ISSUER_ID'),'Apple server credentials are not configured.');
 const client=new TimedAppleClient(env('APPLE_PRIVATE_KEY').replace(/\\n/g,'\n'),env('APPLE_KEY_ID'),env('APPLE_ISSUER_ID'),APP_ID,appleEnv);
 return {client,verifier};
}
export async function verifyApple(reference:string,products:any[],environment:string){
 const {client,verifier}=appleServices(environment);
 const initial=await client.getTransactionInfo(reference),seed=await verifier.verifyAndDecodeTransaction(requireValue(initial.signedTransactionInfo,'Missing signed Apple transaction.'));
 const response=await client.getAllSubscriptionStatuses(requireValue(seed.originalTransactionId,'Missing Apple subscription.'));
 const entries=(response.data||[]).flatMap(g=>g.lastTransactions||[]).filter(t=>t.originalTransactionId===seed.originalTransactionId);
 requireValue(entries.length===1,'Apple subscription requires account review.');const entry=entries[0];
 const tx=await verifier.verifyAndDecodeTransaction(requireValue(entry.signedTransactionInfo,'Missing signed transaction.'));
 const renewal=await verifier.verifyAndDecodeRenewalInfo(requireValue(entry.signedRenewalInfo,'Missing signed renewal.'));
 requireValue(tx.originalTransactionId===seed.originalTransactionId&&renewal.originalTransactionId===tx.originalTransactionId,'Apple transaction lineage mismatch.');
 requireValue(tx.inAppOwnershipType!=='FAMILY_SHARED','Family Sharing is not enabled for these subscriptions.');
 return appleSnapshot(tx,renewal,entry.status,products,environment);
}
let googleToken:{value:string;until:number}|null=null;
async function googleAccess(){
 if(googleToken&&googleToken.until>Date.now()+60000)return googleToken.value;
 const account=JSON.parse(env('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')||'{}');requireValue(account.client_email&&account.private_key,'Configure the Play Developer service account.');
 const key=await importPKCS8(account.private_key,'RS256');const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/androidpublisher'}).setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
 const result=await (await timed('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})})).json();
 requireValue(typeof result.access_token==='string','Play authentication failed.');googleToken={value:result.access_token,until:Date.now()+Math.min(Number(result.expires_in)||300,3600)*1000};return result.access_token;
}
const playRoot=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${APP_ID}/purchases/`;
export async function verifyGoogle(reference:string,products:any[],environment:string){
 const data=await (await timed(playRoot+'subscriptionsv2/tokens/'+encodeURIComponent(reference),{headers:{authorization:'Bearer '+await googleAccess()}})).json();
 return googleSnapshot(data,products,environment,reference);
}
export async function acknowledgeGoogle(snapshot:any){
 if(!snapshot.acknowledge)return;
 await timed(playRoot+`subscriptions/${encodeURIComponent(snapshot.product_id)}/tokens/${encodeURIComponent(snapshot.purchase_reference)}:acknowledge`,{method:'POST',headers:{authorization:'Bearer '+await googleAccess(),'content-type':'application/json'},body:'{}'});
}
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:10000});
export async function verifyGooglePush(req:Request){
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];requireValue(token&&env('GOOGLE_RTDN_AUDIENCE')&&env('GOOGLE_RTDN_SERVICE_EMAIL'),'Push authentication is required.');
 const {payload}=await jwtVerify(token!,googleKeys,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:env('GOOGLE_RTDN_AUDIENCE'),maxTokenAge:'1h'});
 requireValue(payload.email===env('GOOGLE_RTDN_SERVICE_EMAIL')&&payload.email_verified===true,'Unexpected Pub/Sub push identity.');
}
