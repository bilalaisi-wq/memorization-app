import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Keyboard} from '@capacitor/keyboard';
import {SplashScreen} from '@capacitor/splash-screen';
import {SystemBars,SystemBarsStyle} from '@capacitor/core';
import {installNativeDownloads} from './downloads.js';
import {isNativeApp} from './platform.js';
export function closeNativeSurface(document){
 const dialogs=[...document.querySelectorAll('dialog[open]')];const last=dialogs.at(-1);
 if(last){const cancelled=new Event('cancel',{cancelable:true});if(last.dispatchEvent(cancelled)){last.close();last.remove();}return true;}
 const toggle=document.querySelector('#site-menu-toggle[aria-expanded=true]');if(toggle){toggle.click();toggle.focus();return true;}return false;
}
export async function initializeNative({onBack=()=>false,app=App,native=isNativeApp()}={}){
 if(!native)return ()=>{};document.documentElement.dataset.native='true';const listeners=[installNativeDownloads()],handles=[];
 const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));};
 const style=()=>SystemBars.setStyle({style:document.documentElement.dataset.theme==='night-sky'?SystemBarsStyle.Dark:SystemBarsStyle.Light}).catch(()=>{});
 await style();listen(document,'ayahappearancechange',style);listen(window,'ayahappearancechange',style);
 handles.push(await app.addListener('appStateChange',({isActive})=>{if(!isActive){window.dispatchEvent(new Event('ayah-study-overlay'));window.dispatchEvent(new Event('ayah-native-background'));document.querySelectorAll('audio,video').forEach(media=>media.pause());}else{window.dispatchEvent(new Event('ayah-native-foreground'));window.dispatchEvent(new Event('focus'));}}));
 handles.push(await app.addListener('backButton',()=>{if(closeNativeSurface(document)||onBack())return;
 const dialog=document.createElement('dialog');dialog.className='account-dialog';dialog.innerHTML='<h2>Close Ayah A Day?</h2><p>Your saved progress stays on this device.</p><button data-stay>Keep learning</button><button data-leave>Close app</button>';document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-stay]').onclick=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-leave]').onclick=()=>{window.dispatchEvent(new Event('ayah-study-overlay'));void app.exitApp();};}));
 // Keep external sources in the system browser; never navigate away from bundled frontend.
 listen(document,'click',event=>{const anchor=event.target.closest?.('a[href]');if(!anchor)return;let url;try{url=new URL(anchor.href);}catch{return;}if(['http:','https:'].includes(url.protocol)&&url.origin!==location.origin){event.preventDefault();void Browser.open({url:url.href}).catch(()=>{});}});
 try{handles.push(await Keyboard.addListener('keyboardWillShow',()=>document.documentElement.dataset.keyboard='open'));handles.push(await Keyboard.addListener('keyboardWillHide',()=>delete document.documentElement.dataset.keyboard));}catch{}
 listen(window,'ayah-native-export-error',()=>{const d=document.createElement('dialog');d.className='account-dialog';d.innerHTML='<h2>Backup could not be shared</h2><p>Your original learning records are unchanged. Try exporting again.</p><button>Close</button>';document.body.append(d);d.showModal();d.querySelector('button').onclick=()=>{d.close();d.remove();};});
 await SplashScreen.hide().catch(()=>{});
 return ()=>{listeners.forEach(dispose=>dispose());handles.forEach(handle=>handle.remove());};
}
