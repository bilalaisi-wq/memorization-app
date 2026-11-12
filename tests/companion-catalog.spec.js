import {expect,test} from '@playwright/test';
import {createHash} from 'node:crypto';
import {avatarSvg,catalogVersion,items,starter} from '../src/rewards/catalog.js';
const additions={penguin:100,beaver:140,otter:160,capybara:180,'red-panda':220,quokka:240};
test('append-only companion catalog retains legacy IDs and six distinct original offline SVG animals',()=>{
 expect(catalogVersion).toBe(2);
 expect(starter).toEqual(['sprout','garden']);
 const original={sprout:0,owl:80,fox:120,turtle:160,cactus:200,butterfly:240,'scarf-lilac':35,'scarf-teal':35,'cape-gold':75,'hat-rose':60,garden:0,night:95,dawn:95};
 expect(new Set(items.map(i=>i.id)).size).toBe(items.length);
 for(const [id,price] of Object.entries({...original,...additions}))expect(items.find(i=>i.id===id)?.price).toBe(price);
 const hashes=new Set();
 for(const id of Object.keys(additions)){
  expect(items.find(i=>i.id===id)?.kind).toBe('creature');
  const svg=avatarSvg({creature:id,scene:'night'});
  expect(svg).toContain('viewBox="0 0 200 200"');
  expect(svg).not.toMatch(/undefined|<image|https?:|<script|foreignObject/);
  hashes.add(createHash('sha256').update(svg).digest('hex'));
  for(const outfit of items.filter(i=>i.kind==='outfit'))for(const scene of ['garden','night','dawn']){
   const dressed=avatarSvg({creature:id,outfit:outfit.id,scene});
   expect(dressed).toContain(outfit.color);
   expect(dressed).not.toContain('undefined');
  }
 }
 expect(hashes.size).toBe(6);
 expect(avatarSvg({creature:'unrecognized-owned-id'})).toBe(avatarSvg({creature:'sprout'}));
});
