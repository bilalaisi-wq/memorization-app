import {compressPhoto,createLocalNatureStore} from './shop.js';
import {activeProfileId} from '../learner/profile-storage.js';
import {esc} from '../ui/dom.js';
export function mountAccountPhoto(dialog,{client,user}){
 const root=document.createElement('section');root.className='account-photo';root.setAttribute('aria-label','Profile picture');
 root.innerHTML='<h3>Your private profile picture</h3><div data-photo-preview></div><label>Private profile picture<input data-photo type="file" accept="image/jpeg,image/png,image/webp"></label><p>Your picture stays private. The leaderboard shows your nature companion instead. Images are cropped, resized and re-encoded before saving.</p><button class="text-button" data-remove-photo>Remove picture</button><p data-photo-status role="status"></p>';
 dialog.querySelector('[data-content]').before(root);const local=createLocalNatureStore(),owner=activeProfileId();let busy=false;
 const valid=()=>root.isConnected&&activeProfileId()===owner;
 const draw=photo=>{root.querySelector('[data-photo-preview]').innerHTML=photo&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)?`<img class="profile-photo" src="${esc(photo)}" alt="Your private profile picture">`:'';};
 const rpc=async(name,args={})=>{const {data,error}=await client.rpc(name,{...args,expected_user:user.id});if(error)throw Error('Profile picture could not be saved. Your learning progress is safe.');return data;};
 async function change(file){if(busy||!valid())return;busy=true;root.querySelectorAll('button,input').forEach(b=>b.disabled=true);try{
  const photo=file?await compressPhoto(file):null;if(!valid())return;
  let profile;if(user){await rpc('set_my_profile_photo',{photo_data:photo});profile=await rpc('my_nature_profile');}else{local.transact(p=>p.photo=photo);profile=local.snapshot();}
  if(valid()){draw(profile.photo);window.dispatchEvent(new CustomEvent('ayahnaturechange',{detail:profile}));root.querySelector('[data-photo-status]').textContent=photo?'Profile picture saved privately.':'Profile picture removed.';}
 }catch(e){if(valid())root.querySelector('[data-photo-status]').textContent=e.message;}finally{busy=false;if(valid())root.querySelectorAll('button,input').forEach(b=>b.disabled=false);}}
 root.querySelector('[data-photo]').onchange=e=>{if(e.target.files[0])change(e.target.files[0]);};root.querySelector('[data-remove-photo]').onclick=()=>change(null);
 if(user)rpc('my_nature_profile').then(p=>{if(valid()&&!busy)draw(p?.photo);}).catch(()=>{});else draw(local.snapshot().photo);
}
