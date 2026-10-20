import { mountDeveloperMenu } from '../developer/access.js';
export function mountSiteMenu(main) {
  const nav = main.querySelector('.explore-nav');
  const shell = document.createElement('section');
  shell.className = 'site-menu';
  const toggle = document.createElement('button');
  toggle.className = 'text-button menu-toggle';
  toggle.id = 'site-menu-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'site-menu-options');
  toggle.innerHTML = '<span aria-hidden="true">☰</span> Menu';
  nav.id = 'site-menu-options';
  nav.hidden = true;
  nav.before(shell); shell.append(toggle, nav);
  mountDeveloperMenu(nav);
  const close = () => { nav.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  toggle.onclick = () => {
    nav.hidden = !nav.hidden;
    toggle.setAttribute('aria-expanded', String(!nav.hidden));
  };
  shell.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); toggle.focus(); }
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('button')) close();
  });
}
