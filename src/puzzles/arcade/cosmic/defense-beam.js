/** Geometry uses arena coordinates; no source/correctness information enters aim. */
export const BEAM_LIMIT=1.5,BEAM_COOLDOWN=.3;
export const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export function rayIntersection(angle,objects,{cx=500,cy=340,tolerance=10}={}){
 const dx=Math.cos(angle),dy=Math.sin(angle);let hit=null;
 for(const o of objects){const x=o.x-cx,y=o.y-cy,along=x*dx+y*dy,r=o.radius+tolerance,perp=x*x+y*y-along*along;if(along<0||perp>r*r)continue;const distance=Math.max(0,along-Math.sqrt(Math.max(0,r*r-perp)));if(!hit||distance<hit.distance)hit={object:o,distance,x:cx+dx*distance,y:cy+dy*distance};}
 return hit;
}
export function reflectMeteor(m,c){
 const dx=m.x-c.x,dy=m.y-c.y,d=Math.hypot(dx,dy),limit=m.radius+c.radius;
 if(d>=limit||(m.shieldCooldown||0)>0)return false;
 const nx=d?dx/d:0,ny=d?dy/d:-1,dot=m.vx*nx+m.vy*ny;
 m.x=c.x+nx*(limit+2);m.y=c.y+ny*(limit+2);
 if(dot<0){m.vx=(m.vx-2*dot*nx)*.9;m.vy=(m.vy-2*dot*ny)*.9;}
 m.bounces=(m.bounces||0)+1;m.shieldCooldown=.35;
 if(m.bounces>=3){const a=Math.atan2(m.y-340,m.x-500);m.vx=Math.cos(a)*70;m.vy=Math.sin(a)*70;}
 return true;
}
