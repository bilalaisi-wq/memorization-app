// Presentation access only. Never use browser UI gates to authorize server operations.
const OWNER_EMAIL = 'bilalaisi@gmail.com';
let allowed = false;
let preview = false;
export const isDeveloperMode = () => allowed && preview;
function paintDeveloperMode(){
 if(!globalThis.document)return;
 document.documentElement.dataset.developerMode=isDeveloperMode()?'true':'false';
 document.querySelectorAll('[data-developer-only]').forEach(el=>{el.hidden=!isDeveloperMode();el.disabled=!isDeveloperMode();});
}
export function setDeveloperPreview(active) {
  preview = allowed && active === true;
  paintDeveloperMode();
  globalThis.dispatchEvent?.(new Event("ayah-developer-mode"));
}
export function setDeveloperUser(user) {
  preview = false;
  allowed = !!user?.id && !!user.email_confirmed_at &&
    user.email?.trim().toLowerCase() === OWNER_EMAIL;
  paintDeveloperMode();
  globalThis.dispatchEvent?.(new Event('ayah-developer-mode'));
}
export const isDeveloper = () => allowed;
let client = null;
let orderRequest = null;

export function configureDeveloperClient(value) { client = value; orderRequest = null; }
export async function applyMenuOrder(nav) {
  if (!client) return;
  orderRequest ||= Promise.resolve(client.from('site_layout').select('menu_order').eq('id',1).maybeSingle()).catch(()=>({error:true}));
  const {data, error} = await orderRequest;
  if (error || !Array.isArray(data?.menu_order) || !nav.isConnected) return;
  for (const label of data.menu_order) {
    const button = [...nav.children].find(b => b.textContent.trim() === label);
    if (button) nav.append(button);
  }
}
export function mountDeveloperMenu(nav) {
  applyMenuOrder(nav).catch(() => {});
  if (!isDeveloper() || nav.querySelector("[data-developer-toggle]")) return;
  const button = document.createElement('button');
  button.className = 'text-button';
  button.textContent = 'Developer mode';
  button.dataset.developerToggle='true';
  button.onclick = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'account-dialog';
    dialog.innerHTML = '<button class="text-button" data-close>Close ×</button><h2>Developer mode</h2><p>Your verified owner account can enable server-authorized content preview, or return to regular learner access. AI services retain their safety flags and usage limits.</p><button class="primary" data-enable>Enable developer access</button><button class="text-button" data-disable>Return to learner mode</button><h3>Menu editor</h3><p>Move items up or down, then save to publish the order for everyone. Changes affect navigation only.</p><ol data-items></ol><button class="primary" data-save>Save menu order</button><p role="status" data-status></p>';
    const status = dialog.querySelector('[data-status]');
    const items = [...nav.children].filter(b => b.tagName === 'BUTTON');
    const draw = () => {
      const list = dialog.querySelector('[data-items]'); list.replaceChildren();
      items.forEach((item,i) => {
        const row = document.createElement('li');
        const name = document.createElement('span'); name.textContent = item.textContent.trim(); row.append(name);
        for (const [label, delta] of [['↑',-1],['↓',1]]) {
          const b = document.createElement('button'); b.className='text-button'; b.textContent=label;
          b.setAttribute('aria-label', `Move ${name.textContent} ${delta<0?'up':'down'}`);
          b.disabled=i+delta<0 || i+delta>=items.length;
          b.onclick=()=>{ [items[i],items[i+delta]]=[items[i+delta],items[i]]; items.forEach(el=>nav.append(el));
            const live=document.querySelector('.explore-nav');
            if(live&&live!==nav)for(const item of items){const current=[...live.children].find(el=>el.textContent.trim()===item.textContent.trim());if(current)live.append(current);}
            draw(); };
          row.append(b);
        }
        list.append(row);
      });
    }; draw();
    const run = async fn => { try { if (!client) throw Error('Sign in first.'); await fn(); } catch(e) { status.textContent=e.message; } };
    for (const [selector,enabled] of [['[data-enable]',true],['[data-disable]',false]]) {
      dialog.querySelector(selector).onclick=()=>run(async()=>{
        const {error}=await client.rpc('set_my_developer_mode',{active:enabled});
        if(error) throw Error('Developer access is not configured. Run the developer setup SQL for your verified owner account.');
        setDeveloperPreview(enabled);
        status.textContent=enabled?'Developer access enabled. Reopen the desired feature to refresh access.':'Regular learner access restored.';
      });
    }
    dialog.querySelector('[data-save]').onclick=()=>run(async()=>{
      const {error}=await client.rpc('save_site_menu',{items:items.map(b=>b.textContent.trim())});
      if(error) throw Error('Enable developer mode before saving. Ensure the developer migration is installed.');
      orderRequest=Promise.resolve({data:{menu_order:items.map(b=>b.textContent.trim())}});
      const live=document.querySelector('.explore-nav');if(live)await applyMenuOrder(live);
      status.textContent='Menu order saved for all learners.';
    });
    dialog.querySelector('[data-close]').onclick = () => { dialog.close(); dialog.remove(); };
    dialog.oncancel = () => dialog.remove();
    document.body.append(dialog); dialog.showModal();
  };
  nav.append(button);
}
