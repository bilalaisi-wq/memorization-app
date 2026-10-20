// Presentation access only. Never use browser UI gates to authorize server operations.
const OWNER_EMAIL = 'bilalaisi@gmail.com';
let allowed = false;
export function setDeveloperUser(user) {
  allowed = !!user?.id && !!user.email_confirmed_at &&
    user.email?.trim().toLowerCase() === OWNER_EMAIL;
}
export const isDeveloper = () => allowed;
export function mountDeveloperMenu(nav) {
  if (!isDeveloper()) return;
  const button = document.createElement('button');
  button.className = 'text-button';
  button.textContent = 'Developer mode';
  button.onclick = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'account-dialog';
    dialog.innerHTML = '<button class="text-button" data-close>Close ×</button><h2>Developer mode</h2><p>Editorial diagnostics are visible for your verified owner account.</p><p>Gallery artwork fallbacks and unpublished tafsir status appear in the Gallery. These notes are hidden from learners.</p><p>This view does not grant database administration or publish unverified content.</p>';
    dialog.querySelector('button').onclick = () => { dialog.close(); dialog.remove(); };
    dialog.oncancel = () => dialog.remove();
    document.body.append(dialog); dialog.showModal();
  };
  nav.append(button);
}
