import {items,avatarSvg} from './catalog.js';
import {activeProfileId,profileRevision} from '../learner/profile-storage.js';
import {esc} from '../ui/dom.js';
// Presentation only. Ownership/equipment still come from the existing shop/RPC.
export function validCompanion(profile){
 return profile&&Array.isArray(profile.owned)&&profile.owned.includes(profile.creature)&&items.some(i=>i.id===profile.creature&&i.kind==='creature');
}
export function publishCompanion(profile,{owner=activeProfileId(),revision=profileRevision()}={}){
 if(owner!==activeProfileId()||revision!==profileRevision()||!validCompanion(profile))return false;
 window.dispatchEvent(new CustomEvent('ayahnaturechange',{detail:{...profile,owner,identityRevision:revision}}));return true;
}
export function companionDetails(profile){
 if(!validCompanion(profile))return '<p>Your companion will appear here when your wardrobe is available.</p>';
 const name=items.find(i=>i.id===profile.creature)?.name||'Nature companion',outfit=items.find(i=>i.id===profile.outfit)?.name||'No outfit',home=items.find(i=>i.id===profile.scene)?.name||'Garden Home';
 return `${avatarSvg(profile)}<div><h4>${esc(name)}</h4><p>Outfit: ${esc(outfit)}</p><p>Home: ${esc(home)}</p></div>`;
}
