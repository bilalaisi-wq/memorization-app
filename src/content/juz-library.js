import {isDeveloperMode} from "../developer/access.js";
import { catalog, availability } from './library.js';
import { esc } from '../ui/dom.js';
export function openJuz29(ctx) {
  if(!isDeveloperMode())return;
  const d=document.createElement('dialog');d.className='account-dialog';
  const chapters=catalog.chapters.filter(c=>c.id===7||c.id>=67&&c.id<=77);
  d.innerHTML=`<button class="text-button" data-close>Close ×</button><h2>Developer library · Al-A‘raf &amp; Juz 29</h2><p>Al-A‘raf: 206 ayahs. Juz 29: 11 surahs · 431 ayahs. These 12 surahs are available only in active developer preview. Open a chapter to use the main Memorization Lab and Puzzle Lab.</p><div class="juz-chapters">${chapters.map(c=>`<article><h3>${esc(c.name)} <span lang="ar" dir="rtl">${esc(c.arabic)}</span></h3><p>Surah ${c.id} · ${c.verseCount} ayahs · ${availability.fullyVerifiedSurahs.includes(c.id)?'Source-validated':'Preparation pending'}</p><button class="primary" data-open="${c.id}" ${availability.fullyVerifiedSurahs.includes(c.id)?'':'disabled'}>Open ${esc(c.name)}</button></article>`).join('')}</div><p>Study workspaces preserve canonical Uthmani text. Internal visual boundaries are not scholar-approved recitation stops.</p>`;
  d.querySelector('[data-close]').onclick=()=>{d.close();d.remove();};d.oncancel=()=>d.remove();
  d.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{d.close();d.remove();if(ctx.onDeveloperChapter)ctx.onDeveloperChapter(Number(b.dataset.open));else import('../passage/ui.js').then(m=>m.openPassageStudio({...ctx,initialReference:`${b.dataset.open}:1`}));});
  document.body.append(d);d.showModal();
}
