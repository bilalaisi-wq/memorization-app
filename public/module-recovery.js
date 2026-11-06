// A stale open tab may request a hashed chunk removed by a deployment.
// Never loop reloads or discard an in-flight activity without the learner choosing.
(() => {
  function show() {
    if (document.getElementById('ayah-module-recovery')) return;
    const box=document.createElement('section');box.id='ayah-module-recovery';box.setAttribute('role','alertdialog');box.setAttribute('aria-label','App update available');
    Object.assign(box.style,{position:'fixed',bottom:'16px',left:'16px',right:'16px',zIndex:'100000',background:'#14243e',color:'#fff',padding:'20px',border:'2px solid #e9c774',borderRadius:'18px',boxShadow:'0 8px 30px #0008'});
    const p=document.createElement('p');p.textContent='This activity could not load. A newer app version may be available, or the connection may have dropped. Saved progress is retained. Reload to try the latest version; unfinished activity may restart.';
    const button=document.createElement('button');button.textContent='Reload latest version';button.style.cssText='min-height:48px;padding:10px 18px;border-radius:12px;background:#f3d78f;color:#152840;font-weight:bold';
    button.onclick=()=>{try{if(document.querySelector('.cosmic-rush'))sessionStorage.setItem('ayah-update-return','revision');}catch{}const url=new URL(location.href);url.searchParams.set('app-update',String(Date.now()));location.replace(url.href);};
    const close=document.createElement('button');close.textContent='Later';close.style.cssText='min-height:48px;margin-left:12px;padding:10px';close.onclick=()=>box.remove();box.append(p,button,close);document.body.append(box);button.focus();
  }
  window.addEventListener('vite:preloadError',()=>show());
  window.addEventListener('unhandledrejection',e=>{if(/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(e.reason?.message||e.reason))){e.preventDefault();show();}});
})();
