import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {isNativeApp} from './platform.js';
export async function shareJson(blob,name,{files=Filesystem,share=Share}={}){
 if(blob.size>20*1024*1024)throw Error('This export is too large to share. Export a smaller recovery file.');
 const path=`ayah-export-${crypto.randomUUID()}.json`;
 try{const saved=await files.writeFile({path,directory:Directory.Cache,data:await blob.text(),encoding:Encoding.UTF8});await share.share({title:'Ayah A Day progress backup',files:[saved.uri],dialogTitle:name});}
 finally{await files.deleteFile({path,directory:Directory.Cache}).catch(()=>{});}
}
// Existing export handlers use detached anchors and sometimes revoke immediately.
// A native-only adapter retains their Blob for the share sheet, without rewriting stores.
export function installNativeDownloads({native=isNativeApp(),send=shareJson}={}){
 if(!native)return ()=>{};const blobs=new Map(),create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=HTMLAnchorElement.prototype.click;
 URL.createObjectURL=function(blob){const url=create.call(URL,blob);blobs.set(url,blob);return url;};
 URL.revokeObjectURL=function(url){blobs.delete(url);return revoke.call(URL,url);};
 HTMLAnchorElement.prototype.click=function(){const blob=blobs.get(this.href);if(blob&&this.download.endsWith('.json')){void send(blob,this.download).catch(()=>{window.dispatchEvent(new CustomEvent('ayah-native-export-error'));});return;}return click.call(this);};
 return ()=>{URL.createObjectURL=create;URL.revokeObjectURL=revoke;HTMLAnchorElement.prototype.click=click;blobs.clear();};
}
