// A remembered device namespace is NOT authentication or an offline entitlement.
export const DEVICE_IDENTITY='ayah-verified-device-profile-v1';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
export function rememberVerifiedDevice(user,url,storage=localStorage){
 if(!uuid(user?.id))return;
 try{storage.setItem(DEVICE_IDENTITY,JSON.stringify({version:1,owner:user.id,project:new URL(url).origin}));}catch{}
}
export function offlineDeviceOwner(url,storage=localStorage){
 try{const project=new URL(url),marker=JSON.parse(storage.getItem(DEVICE_IDENTITY)),session=JSON.parse(storage.getItem(`sb-${project.hostname.split('.')[0]}-auth-token`));
 return marker?.version===1&&marker.project===project.origin&&uuid(marker.owner)&&session?.user?.id===marker.owner&&typeof session.access_token==='string'?marker.owner:null;
 }catch{return null;}
}
export function forgetDeviceIdentity(storage=localStorage){try{storage.removeItem(DEVICE_IDENTITY);}catch{}}
