import {cosmicSurahs} from './mission.js';
import {cosmicReducedMotion} from './preferences.js';
// A constellation celebrates observed route coverage, never certified memorization.
export function mountConstellationReveal(host,mission,coverage){
 const expected=mission.refs.slice(1).map((r,i)=>`${mission.refs[i]}>${r}`);
 if(!coverage.gameplayComplete||coverage.refs.length!==mission.refs.length||coverage.refs.some((r,i)=>r!==mission.refs[i])||expected.some(p=>!coverage.links.includes(p)))return null;
 const full=mission.first===1&&mission.last===cosmicSurahs.find(s=>s.id===mission.surah)?.verses.length;
 const box=document.createElement('section');box.className='cosmic-reveal';box.setAttribute('aria-label',full?'Full-surah practice constellation':'Passage practice constellation');box.innerHTML=`<h4>${full?'Full-surah':'Passage'} constellation connected</h4><p>${mission.refs.length} ayahs practised, ${expected.length} internal connections. Gameplay progress is separate from independent recall.</p>`;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 180');svg.setAttribute('aria-hidden','true');
 const cols=Math.min(12,mission.refs.length),rows=Math.ceil(mission.refs.length/cols),points=mission.refs.map((ref,i)=>({ref,x:30+(i%cols)*540/Math.max(1,cols-1),y:30+Math.floor(i/cols)*120/Math.max(1,rows-1)+(i%2?10:0)}));
 for(let i=1;i<points.length;i++){const line=document.createElementNS(ns,'line');line.setAttribute('x1',points[i-1].x);line.setAttribute('y1',points[i-1].y);line.setAttribute('x2',points[i].x);line.setAttribute('y2',points[i].y);svg.append(line);}
 for(const p of points){for(const [radius,cls] of [[12,'halo'],[4,'star']]){const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',radius);circle.setAttribute('class',cls);svg.append(circle);}}
 box.querySelector('h4').tabIndex=-1;box.append(svg);const skip=document.createElement('button');skip.className='cosmic-secondary';skip.dataset.skipCelebration='';skip.textContent='Skip celebration animation';skip.onclick=()=>{box.dataset.animation='skipped';skip.disabled=true;skip.textContent='Constellation revealed';};box.append(skip);if(cosmicReducedMotion())box.dataset.animation='skipped';host.prepend(box);return box;
}
