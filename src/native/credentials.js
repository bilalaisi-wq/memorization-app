import {SecureStorage,KeychainAccess} from '@aparajita/capacitor-secure-storage';
import {isNativeApp} from './platform.js';
// Only Supabase session/PKCE keys migrate; learning progress stays in its existing store.
export async function authStorage(key,{native=isNativeApp(),secure=SecureStorage,local=localStorage,session=sessionStorage}={}){
 if(!native)return local;
 await secure.setKeyPrefix('ayah-auth-v1_');await secure.setSynchronize(false);
 await secure.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
 for(const name of [key,`${key}-code-verifier`]){
  const saved=await secure.getItem(name),legacy=local.getItem(name)||session.getItem(name);
  if(saved===null&&legacy!==null){await secure.setItem(name,legacy);if(await secure.getItem(name)!==legacy)throw Error('Secure session migration could not be verified.');}
  // Do not erase conflicting legacy credentials: operator can recover them, never guess ownership.
  if(legacy!==null&&(saved===null||saved===legacy)){local.removeItem(name);session.removeItem(name);}
 }
 return {getItem:key=>secure.getItem(key),setItem:(key,value)=>secure.setItem(key,value),removeItem:async key=>{await secure.removeItem(key);local.removeItem(key);session.removeItem(key);}};
}
