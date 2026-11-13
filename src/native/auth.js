import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {isNativeApp,NATIVE_AUTH_RETURN,VERIFIED_WEB_RETURN} from './platform.js';
export function callbackCode(value){
 try{const url=new URL(value),allowed=[NATIVE_AUTH_RETURN,VERIFIED_WEB_RETURN].some(path=>{const target=new URL(path);return url.protocol===target.protocol&&url.host===target.host&&url.pathname===target.pathname;});
 if(!allowed||url.hash||url.username||url.password||url.searchParams.getAll('code').length!==1||[...url.searchParams.keys()].some(k=>!['code'].includes(k)))return null;
 const code=url.searchParams.get('code');return /^[A-Za-z0-9._~-]{8,2048}$/.test(code||'')?code:null;
 }catch{return null;}
}
export function createAuthReturnHandler(client,{close=()=>Browser.close(),notify=message=>window.dispatchEvent(new CustomEvent('ayah-native-auth-status',{detail:{message}}))}={}){
 const seen=new Set();let running=Promise.resolve();
 return url=>{const code=callbackCode(url);if(!code||seen.has(code))return running;seen.add(code);if(seen.size>20)seen.delete(seen.values().next().value);
 running=running.then(async()=>{try{await close();}catch{}const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw Error('Sign-in could not finish. Request a new code or try Google again.');notify('Sign-in completed. Your account is being verified.');}).catch(()=>notify('Sign-in could not finish. Request a new code or try Google again.'));return running;};
}
export async function installNativeAuth(client,{app=App,native=isNativeApp(),...options}={}){
 if(!native)return ()=>{};const handle=createAuthReturnHandler(client,options);
 const listener=await app.addListener('appUrlOpen',event=>{void handle(event.url);});
 const launch=await app.getLaunchUrl();if(launch?.url)await handle(launch.url);
 return ()=>listener.remove();
}
export async function openNativeOAuth(value,projectUrl){
 const url=new URL(value),project=new URL(projectUrl);
 if(url.protocol!=='https:'||url.origin!==project.origin||url.pathname!=='/auth/v1/authorize')throw Error('Invalid account authorization destination.');
 await Browser.open({url:url.href,presentationStyle:'popover'});
}
