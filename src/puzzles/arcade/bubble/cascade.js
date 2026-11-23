// Neutral geometry only; never inspects expected wording or changes source content.
const origin={x:450,y:760},R=13,W=900;
function intersection(p,d,c){const x=p.x-c.x,y=p.y-c.y,b=x*d.x+y*d.y,dis=b*b-(x*x+y*y-(c.radius+R)**2);if(dis<0)return Infinity;const t=-b-Math.sqrt(dis);return t>0.01?t:Infinity;}
export function traceCascade(state,angle){let p={...origin},d={x:Math.cos(angle),y:Math.sin(angle)},points=[p],bounces=0;const circles=[...(state.obstacles||[]),...state.bubbles];
 for(let n=0;n<5;n++){const wall=d.x<0?(R-p.x)/d.x:d.x>0?(W-R-p.x)/d.x:Infinity,ceiling=d.y<0?-p.y/d.y:Infinity;let distance=Math.min(wall,ceiling),hit=null;for(const c of circles){const t=intersection(p,d,c);if(t<distance){distance=t;hit=c;}}if(!Number.isFinite(distance))break;p={x:p.x+d.x*distance,y:p.y+d.y*distance};points.push(p);if(hit)return {points,hit,bounces,margin:hit.radius+R-Math.abs((p.x-hit.x)*d.y-(p.y-hit.y)*d.x)};if(ceiling<=wall)return {points,hit:null,bounces};d.x=-d.x;bounces++;p={x:p.x+d.x*.01,y:p.y+d.y*.01};}
 return {points,hit:null,bounces};
}
export function reachableShots(state){const found=new Map();for(let i=0;i<=240;i++){const angle=-Math.PI+.12+i*(Math.PI-.24)/240,t=traceCascade(state,angle);if(t.hit?.piece&&(!found.has(t.hit.slot)||t.margin>found.get(t.hit.slot).margin))found.set(t.hit.slot,{angle,bounces:t.bounces,margin:t.margin});}return found;}
export function configureCascade(s){const phase=s.cursor%5,seed=(s.session.config.seed+s.cursor*31)>>>0;
 for(const b of s.bubbles){const slot=b.slot;b.x=150+slot*300+((seed+slot*71)%41)-20;const lower=b.id.endsWith('-0');b.y=((b.radius>100?[420,450,480]:[380,420,350])[(slot+(seed%3))%3]+s.descent)-(lower?0:b.radius*2);}
 s.formationPhase=phase;s.obstacles=[];
 if(phase){const count=phase===4?3:phase===3?2:1;for(let i=0;i<count;i++){const obstacle={id:`crystal-${s.cursor}-${i}`,x:450+(i-(count-1)/2)*75,y:625+(i%2)*10,radius:28,neutral:true};if(s.bubbles.every(b=>Math.hypot(b.x-obstacle.x,b.y-obstacle.y)>b.radius+obstacle.radius+18))s.obstacles.push(obstacle);}}
 // Neutral pendants depend on real support IDs. Removing their root releases
 // the connected neutral cluster; Arabic targets are never cascade members.
 const roots=[...s.obstacles];for(const root of roots){let support=root.id;for(let j=0;j<(phase>=3?2:1);j++){const node={id:root.id+'-pendant-'+j,support,x:root.x+(j%2?18:-18),y:root.y-55*(j+1),radius:18,neutral:true};if(s.bubbles.every(b=>Math.hypot(b.x-node.x,b.y-node.y)>b.radius+node.radius+8)){s.obstacles.push(node);support=node.id;}}}
 if(reachableShots(s).size<new Set(s.bubbles.map(b=>b.slot)).size)s.obstacles=[];
 if(reachableShots(s).size<new Set(s.bubbles.map(b=>b.slot)).size){for(const b of s.bubbles){b.x=150+b.slot*300;b.y=400-(b.id.endsWith('-0')?0:b.radius*2);}s.safeFallback=true;}else s.safeFallback=false;
 s.routes=[...reachableShots(s).values()].map(r=>({bounces:r.bounces})); // No answer IDs or correctness hints.
}

export function releaseNeutralCluster(obstacles,id){const ids=new Set([id]);let previous=-1;while(previous!==ids.size){previous=ids.size;for(const n of obstacles)if(ids.has(n.support))ids.add(n.id);}return obstacles.filter(n=>ids.has(n.id));}
