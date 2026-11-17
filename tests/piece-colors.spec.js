import {test,expect} from '@playwright/test';
import {createPieceColors,colorDifficulty,setColorDifficulty,COLOR_COUNT,PIECE_COLORS_KEY} from '../src/ui/piece-colors.js';
test('long palettes do not repeat a position-based cycle and reshuffling changes every source position',()=>{
 let seed=17;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 let previous=[];for(let round=0;round<20;round++){const colors=createPieceColors(300,previous,rng);expect(colors.every(c=>Number.isInteger(c)&&c>=0&&c<COLOR_COUNT)).toBe(true);expect(colors.every((c,i)=>c!==previous[i])).toBe(true);expect(colors.slice(0,12)).not.toEqual(colors.slice(12,24));previous=colors;}
});
test('color settings preserve corrupt data until explicit changes and never write learning history',()=>{
 const values=new Map([[PIECE_COLORS_KEY,'broken'],['ayah-learning-v1','ORIGINAL']]),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 expect(colorDifficulty(storage)).toBe('mixed');expect(values.get(PIECE_COLORS_KEY)).toBe('broken');setColorDifficulty(storage,'neutral');expect(colorDifficulty(storage)).toBe('neutral');expect(values.get('ayah-learning-v1')).toBe('ORIGINAL');expect(()=>setColorDifficulty(storage,'invalid')).toThrow();
});
const colors=async locator=>{await expect(locator.first()).toBeVisible();return locator.evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.word,[...n.classList].find(c=>/^color-/.test(c))])));};
test('Practice colors stay with a piece when moved, and fresh rounds recolor rather than follow the old cycle',async({page})=>{
 await page.goto('/');const initial=await colors(page.locator('.word-bank .piece'));
 await page.locator('.word-bank [data-word="0"]').click();expect((await colors(page.locator('.build-zone .piece')))['0']).toBe(initial['0']);
 await page.locator('#clear').click();const fresh=await colors(page.locator('.word-bank .piece'));expect(Object.keys(fresh).every(i=>fresh[i]!==initial[i])).toBe(true);
});
test('Puzzle Quest shuffle changes piece colors as well as the mixed bank and keeps canonical validation',async({page})=>{
 await page.goto('/');await page.locator('[data-mode=quiz]').click();const initial=await colors(page.locator('.word-bank .piece'));await page.locator('#build-all').click();const fresh=await colors(page.locator('.word-bank .piece'));expect([0,1,2,3].every(i=>fresh[i]!==initial[i])).toBe(true);
 for(const i of [0,1,2,3])await page.locator(`.word-bank [data-word="${i}"]`).click();await page.locator('#next').click();await expect(page.locator('.feedback')).toContainText('Beautiful work');
});
for(const mode of ['practice','quiz','sequence'])test(`${mode} no-color difficulty removes colored aids without clearing arrangements and persists on reload`,async({page})=>{
 await page.goto('/');if(mode!=='practice')await page.locator(`[data-mode=${mode}]`).click();if(mode==='sequence')await page.locator('#chain-start').click();
 const bank=mode==='sequence'?page.locator('[data-puzzle="1"] .word-bank'):page.locator('.word-bank');await bank.locator('[data-word="0"]').click();
 await page.locator('[data-piece-color-mode]').selectOption('neutral');const built=mode==='sequence'?page.locator('[data-puzzle="1"] .build-zone'):page.locator('.build-zone');await expect(built.locator('[data-word="0"]')).toBeVisible();
 const pieces=page.locator('.piece');expect(await pieces.evaluateAll(xs=>xs.every(n=>n.classList.contains('piece-neutral')&&![...n.classList].some(c=>c.startsWith('color-'))&&!n.classList.contains('divine-gold')))).toBe(true);
 await expect(pieces.first()).toHaveCSS('filter','grayscale(1)');await page.reload();await expect(page.locator('[data-piece-color-mode]')).toHaveValue('neutral');
});
test('Chain reset recolors each word, and another profile does not inherit the no-color preference',async({page})=>{
 await page.goto('/');await page.locator('[data-mode=sequence]').click();await page.locator('#chain-start').click();const puzzle=page.locator('[data-puzzle="1"]'),old=await colors(puzzle.locator('.piece'));await puzzle.locator('[data-chain-reset]').click();const next=await colors(puzzle.locator('.piece'));expect(Object.keys(next).every(i=>next[i]!==old[i])).toBe(true);
 await page.locator('[data-piece-color-mode]').selectOption('neutral');const result=await page.evaluate(async()=>{const {profileStorage,selectProfile}=await import('/src/learner/profile-storage.js'),{colorDifficulty}=await import('/src/ui/piece-colors.js');selectProfile('another-owner');return colorDifficulty(profileStorage);});expect(result).toBe('mixed');
});
