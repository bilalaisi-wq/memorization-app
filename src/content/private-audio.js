// Private recitation is resolved only after authenticated backend authorization.
// Keep a small in-memory cache; never persist premium audio or bearer tokens.
const references=new Set(),resources=new Map();let loader=null,generation=0;
export function configurePrivateAudio(keys,load){clearPrivateAudio();keys.forEach(k=>references.add(k));loader=load;}
export const privateAudioSource=(surah,ayah)=>references.has(`${surah}:${ayah}`)?`ayah-private:${surah}:${ayah}`:null;
export function clearPrivateAudio(){generation++;references.clear();for(const value of resources.values())value.then(r=>r.revoke()).catch(()=>{});resources.clear();loader=null;}
export async function resolvePlaybackSource(source){
 if(!source?.startsWith('ayah-private:'))return source;
 const key=source.slice(13),token=generation;
 if(!references.has(key)||!loader)throw Error('Reopen the developer library to authorize audio.');
 if(!resources.has(key)){
  if(resources.size>=4){const [old,value]=resources.entries().next().value;resources.delete(old);value.then(r=>r.revoke()).catch(()=>{});}
  const request=Promise.resolve().then(()=>loader(key));resources.set(key,request);
  request.catch(()=>{if(resources.get(key)===request)resources.delete(key);});
 }
 const resource=await resources.get(key);if(token!==generation)throw Error('Developer access changed.');
 return resource.url;
}
