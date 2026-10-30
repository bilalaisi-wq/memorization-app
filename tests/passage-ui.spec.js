import {enableDeveloperLab} from "./developer-lab-helper.js";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { menu } from "./menu-helper.js";
import { mockBilling } from "./billing-fixtures.js";
const long = JSON.parse(
  readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
);
async function open(page) {
  await enableDeveloperLab(page);
  await menu(page);
  await page.getByRole("button", { name: "Passage memorization", exact: true })
    .click();
  await page.getByRole("button", { name: /Start with Al-Fatihah|Resume saved workspace/ }).click();
  await expect(page.locator("[data-reference]")).toBeVisible();
}
test("128-word ayah uses bounded workspaces, progressive hints, and no unapproved segment audio", async ({ page }) => {
  await mockBilling(page, { plan: "pathfinder" });
  await page.route(
    "**/functions/v1/quran-content",
    (r) => r.fulfill({ json: long }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await open(page);
  await page.locator("[data-reference]").selectOption("2:282");
  await expect(page.locator("[data-studio]")).toContainText("128 words");
  await expect(page.locator(".passage-studio [data-word]")).toHaveCount(10);
  await expect(page.locator("[data-segment] option")).toHaveCount(1);
  await expect(page.locator("[data-segment-audio]")).toHaveCount(0);
  await page.locator("[data-hints]").selectOption("2");
  await expect(page.locator('[data-place="bank"]')).not.toContainText(
    long.words[0].text,
  );
  await page.locator("[data-reveal]").click();
  await expect(page.locator('[data-place="bank"]')).toContainText(
    long.words[0].text,
  );
  await page.locator("[data-next]").click();
  await expect(page.locator(".passage-studio [data-word]")).toHaveCount(4);
  await expect(page.locator("[data-studio]")).toContainText("workspace 2 / 20");
  expect(
    await page.locator(".passage-studio").evaluate((el) =>
      el.scrollWidth <= el.clientWidth + 1
    ),
  ).toBe(true);
  await page.locator("[data-close]").click();
  await open(page);
  await page.locator("[data-reference]").selectOption("2:282");
  await expect(page.locator("[data-studio]")).toContainText("workspace 2 / 20");
});
test("independent full-ayah recall hides Arabic, schedules FSRS, and persists without changing old progress", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await open(page);
  const old = await page.evaluate(() =>
    localStorage.getItem("ayah-learning-v1")
  );
  await page.locator("[data-recall]").click();
  await expect(page.locator("[data-studio] [data-word]")).toHaveCount(0);
  await expect(page.locator("[data-studio]")).not.toContainText("بِسْمِ");
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await expect(page.locator("[data-comparison]")).toContainText("بِسْمِ");
  await page.locator('[data-grade="Good"]').click();
  await expect(page.locator("[data-studio-status]")).toContainText(
    "Independent self-assessment saved",
  );
  const raw = await page.evaluate(() =>
    localStorage.getItem("ayah-passage-recall-v1")
  );
  expect(JSON.parse(raw).records["ayah:1:1"].card).not.toBe(null);
  expect(await page.evaluate(() => localStorage.getItem("ayah-learning-v1")))
    .toBe(old);
  await page.reload();
  await open(page);
  await expect(page.locator("[data-studio]")).toContainText("Next review");
});
test("server denial does not render or cache private text; free practice remains available", async ({ page }) => {
  await mockBilling(page, { plan: "free" });
  await page.route(
    "**/functions/v1/quran-content",
    (r) =>
      r.fulfill({
        status: 403,
        json: { error: "Your subscription does not include this juz" },
      }),
  );
  await page.goto("/");
  await open(page);
  await page.locator("[data-reference]").selectOption("2:282");
  await expect(page.locator("[data-studio-status]")).toContainText(
    "does not include",
  );
  await expect(page.locator("[data-studio]")).not.toContainText(
    long.words[0].text,
  );
  await expect(page.locator(".passage-studio [data-word]")).toHaveCount(4);
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((x) => x.includes("تَدَايَنتُم"))
    ),
  ).toBe(false);
});
test("Passage Chain uses chosen ayahs and independent passage recall is a distinct unit", async ({ page }) => {
  await mockBilling(page, { signed: false });
  await page.goto("/");
  await open(page);
  await page.locator("[data-reference]").selectOption("1:2");
  await page.locator("[data-add-ref]").click();
  await page.locator("[data-chain]").click();
  await expect(page.locator("[data-chain-cards] [data-chain-move]"))
    .toHaveCount(4);
  await page.locator("[data-passage-recall]").click();
  await expect(page.locator("[data-studio]")).toContainText(
    "Independent passage recall",
  );
  await page.locator("[data-declare]").click();
  await page.locator("[data-compare]").click();
  await expect(page.locator("[data-comparison] section")).toHaveCount(2);
  await page.locator('[data-grade="Good"]').click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayah-passage-recall-v1"))
  );
  expect(Object.values(data.records)[0].unit.type).toBe("passage");
  expect(data.records["ayah:1:1"]).toBeUndefined();
});

test("resume restores selected ayah, hints, arrangements and reconstruction order through reload", async ({page}) => {
  await mockBilling(page, {signed:false});
  await page.goto('/'); await open(page);
  await page.locator('[data-reference]').selectOption('1:7');
  await expect(page.locator('[data-studio]')).toContainText('Current: 1:7');
  await page.locator('[data-place="bank"] [data-word="2"]').click();
  await page.locator('[data-place="bank"] [data-word="1"]').click();
  await page.locator('[data-hints]').selectOption('1');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ayah-passage-workspaces-v1')));
  await page.reload(); await open(page);
  await expect(page.locator('[data-reference]')).toHaveValue('1:7');
  await expect(page.locator('[data-hints]')).toHaveValue('1');
  expect(await page.locator('[data-place="built"] [data-word]').evaluateAll(bs=>bs.map(b=>Number(b.dataset.word)))).toEqual([2,1]);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-workspaces-v1')))).toEqual(before);
  await page.locator('[data-reference]').selectOption('1:2');
  await expect(page.locator('[data-hints]')).toHaveValue('0');
  await page.locator('[data-reference]').selectOption('1:7');
  await expect(page.locator('[data-hints]')).toHaveValue('1');
});

test("dropping onto bank returns a word, self-drop preserves order and keyboard buttons remain focused", async ({page}) => {
  await mockBilling(page, {signed:false}); await page.goto('/'); await open(page);
  await page.locator('.passage-studio [data-word="1"]').click();
  await page.locator('.passage-studio [data-word="2"]').click();
  const transfer = await page.evaluateHandle(()=>new DataTransfer());
  await page.locator('.passage-studio [data-word="1"]').dispatchEvent('dragstart', {dataTransfer:transfer});
  await page.locator('[data-place="bank"] [data-word]').first().dispatchEvent('drop', {dataTransfer:transfer});
  await expect(page.locator('[data-place="built"] [data-word]')).toHaveCount(1);
  await expect(page.locator('[data-place="bank"] [data-word="1"]')).toBeVisible();
  await page.locator('.passage-studio [data-word="1"]').click();
  const self = await page.evaluateHandle(()=>new DataTransfer());
  await page.locator('.passage-studio [data-word="1"]').dispatchEvent('dragstart',{dataTransfer:self});
  await page.locator('.passage-studio [data-word="1"]').dispatchEvent('drop',{dataTransfer:self});
  expect(await page.locator('[data-place="built"] [data-word]').evaluateAll(bs=>bs.map(b=>Number(b.dataset.word)))).toEqual([2,1]);
  await page.locator('[data-move="1:-1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-move="1:-1"]')).toBeFocused();
  expect(await page.locator('[data-place="built"] [data-word]').evaluateAll(bs=>bs.map(b=>Number(b.dataset.word)))).toEqual([1,2]);
});

test("corrupt workspace records are not silently replaced during practice", async ({page}) => {
  await mockBilling(page,{signed:false}); await page.goto('/'); await open(page);
  const raw = await page.evaluate(()=>{
    const key='ayah-passage-workspaces-v1', d=JSON.parse(localStorage.getItem(key));
    Object.values(d.records)[0].orders={0:[999]};
    const raw=JSON.stringify(d);localStorage.setItem(key,raw);return raw;
  });
  await page.reload(); await open(page);
  await expect(page.locator('[data-studio-status]')).toContainText('recovery');
  await page.locator('.passage-studio [data-word]').first().click();
  expect(await page.evaluate(()=>localStorage.getItem('ayah-passage-workspaces-v1'))).toBe(raw);
});

test("audio continues across visual pages but stops on ayah switch, recall exit and dialog exit", async ({page}) => {
  await mockBilling(page,{signed:false});
  await page.addInitScript(()=>{
    window.__audio=[];
    window.Audio=class {constructor(src){this.src=src;this.paused=true;window.__audio.push(this)} play(){this.paused=false;return Promise.resolve()} pause(){this.paused=true}};
  });
  await page.goto('/'); await open(page);
  await page.locator('[data-reference]').selectOption('98:5');
  await expect(page.locator('[data-studio]')).toContainText('Current: 98:5');
  await page.locator('.passage-studio [data-listen]').click();
  await expect.poll(()=>page.evaluate(()=>window.__audio.some(a=>!a.paused))).toBe(true);
  await page.locator('[data-next]').click();
  expect(await page.evaluate(()=>window.__audio.length)).toBe(1);
  expect(await page.evaluate(()=>window.__audio[0].paused)).toBe(false);
  await page.locator('[data-reference]').selectOption('1:2');
  await expect.poll(()=>page.evaluate(()=>window.__audio.every(a=>a.paused))).toBe(true);
  await page.locator('[data-recall]').click();
  await page.locator('[data-recall-listen]').click();
  await expect.poll(()=>page.evaluate(()=>window.__audio.some(a=>!a.paused))).toBe(true);
  await page.locator('[data-abandon]').click();
  await expect.poll(()=>page.evaluate(()=>window.__audio.every(a=>a.paused))).toBe(true);
  const memory=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-recall-v1')));
  expect(memory.records['ayah:1:2'].card).toBe(null);
  await page.locator('.passage-studio [data-listen]').click();
  await expect.poll(()=>page.evaluate(()=>window.__audio.some(a=>!a.paused))).toBe(true);
  await page.locator('[data-close]').click();
  expect(await page.evaluate(()=>window.__audio.every(a=>a.paused))).toBe(true);
});

test("stopping audio does not cancel content loading and stale failures cannot replace a newer ayah", async ({page}) => {
  await mockBilling(page,{plan:'pathfinder'});
  let release, requested = false;
  let gate = new Promise(resolve=>release=resolve);
  let deny = false;
  await page.route('**/functions/v1/quran-content',async r=>{
    requested=true; await gate;
    await r.fulfill(deny ? {status:403,json:{error:'Old denied request'}} : {json:long});
  });
  await page.goto('/'); await open(page);
  await page.locator('[data-reference]').selectOption('2:282');
  await expect.poll(()=>requested).toBe(true);
  await page.locator('[data-stop]').click(); release();
  await expect(page.locator('[data-studio]')).toContainText('Current: 2:282');
  // A second private reference fails after switching back to a free ayah.
  requested=false; deny=true; gate=new Promise(resolve=>release=resolve);
  await page.locator('[data-reference]').selectOption('2:255');
  await expect.poll(()=>requested).toBe(true);
  await page.locator('[data-reference]').selectOption('1:2');
  await expect(page.locator('[data-studio]')).toContainText('Current: 1:2');
  const response=page.waitForResponse(r=>r.url().includes('/quran-content'));
  release(); await response;
  await expect(page.locator('[data-reference]')).toHaveValue('1:2');
  await expect(page.locator('[data-studio-status]')).not.toContainText('Old denied');
});

test("reviewed segment drafts restore separately and unavailable saved content has a free escape", async ({page}) => {
  await mockBilling(page,{plan:'pathfinder'});
  const reviewed={id:'fixture-only',reference:long.key,kind:'reviewed',firstWord:11,lastWord:14,
    review:{status:'approved',reviewer:'TEST FIXTURE',reviewedAt:'2026-01-01',evidence:'Test boundaries only; no production approval'}};
  await page.route('**/functions/v1/quran-content',r=>r.fulfill({json:{...long,segments:[...long.segments,reviewed]}}));
  await page.goto('/'); await open(page);
  await page.locator('[data-reference]').selectOption(long.key);
  await expect(page.locator('[data-segment] option')).toHaveCount(2);
  await page.locator('[data-segment]').selectOption(reviewed.id);
  await page.locator('.passage-studio [data-word="11"]').click();
  await page.locator('[data-hints]').selectOption('2');
  await page.locator('[data-close]').click(); await open(page);
  await expect(page.locator('[data-reference]')).toHaveValue(long.key);
  await expect(page.locator('[data-segment]')).toHaveValue(reviewed.id);
  await expect(page.locator('[data-hints]')).toHaveValue('2');
  await expect(page.locator('[data-place="built"] [data-word="11"]')).toHaveCount(1);
  await expect(page.locator('[data-segment-audio]')).toHaveCount(0);
  await page.locator('[data-close]').click();
  await page.route('**/functions/v1/quran-content',r=>r.fulfill({status:403,json:{error:'Access unavailable'}}));
  await enableDeveloperLab(page); await menu(page);
  await page.getByRole('button',{name:'Passage memorization',exact:true}).click();
  await page.getByRole('button',{name:'Resume saved workspace'}).click();
  await expect(page.locator('[data-studio-status]')).toContainText('Access unavailable');
  await page.getByRole('button',{name:'Practice free Al-Fatihah'}).click();
  await expect(page.locator('[data-reference]')).toHaveValue('1:1');
});

test.describe("mobile Passage Builder", () => {
  test.use({hasTouch:true});
for (const width of [320,390]) test(`mobile ${width}px supports touch-sized reordering and whole-ayah reconstruction`, async ({page})=>{
  await page.setViewportSize({width,height:740});
  await mockBilling(page,{signed:false}); await page.goto('/'); await open(page);
  for (const id of [4,3,2,1]) await page.locator(`.passage-studio [data-word="${id}"]`).tap();
  await page.locator('[data-check-whole]').click();
  await expect(page.locator('[data-studio-status]')).toContainText('Complete each workspace');
  for (const id of [1,2,3]) for(let n=0;n<4-id;n++) await page.locator(`[data-move="${id}:-1"]`).tap();
  await page.locator('[data-check-whole]').click();
  await expect(page.locator('[data-studio-status]')).toContainText('Reconstruction correct');
  const dimensions=await page.locator('.passage-studio').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+1);
  const bounds=await page.locator('[data-move="1:-1"]').boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>localStorage.getItem('ayah-passage-recall-v1'))).toBe(null);
});

});

test("superseded audio errors cannot interrupt a newer recitation", async ({page})=>{
  await mockBilling(page,{signed:false});
  await page.addInitScript(()=>{
    window.__audio=[];
    window.Audio=class {
      constructor(src){this.src=src;this.paused=true;window.__audio.push(this)}
      play(){this.paused=false;return window.__audio.length===1 ? new Promise((_,reject)=>this.reject=reject) : Promise.resolve()}
      pause(){this.paused=true}
    };
  });
  await page.goto('/'); await open(page);
  await page.locator('.passage-studio [data-listen]').click();
  await expect.poll(()=>page.evaluate(()=>window.__audio.length)).toBe(1);
  await page.locator('.passage-studio [data-listen]').click();
  await expect.poll(()=>page.evaluate(()=>window.__audio.length)).toBe(2);
  await page.evaluate(()=>{window.__audio[0].reject(Error('old rejection')); window.__audio[0].onerror();});
  await expect.poll(()=>page.evaluate(()=>window.__audio[1].paused)).toBe(false);
  await expect(page.locator('[data-studio-status]')).not.toContainText('old rejection');
});

test("account workspace drafts remain isolated and resume only for their owner", async ({page})=>{
  await mockBilling(page,{signed:false}); await page.goto('/');
  const launch=async id=>page.evaluate(async id=>{
    const {openPassageStudio}=await import('/src/passage/ui.js');
    openPassageStudio({user:{id},client:null});
  },id);
  await launch('fixture-a'); await page.locator('[data-start]').click();
  await page.locator('.passage-studio [data-word="2"]').click();
  await page.locator('[data-hints]').selectOption('2');
  await page.locator('[data-close]').click();
  await launch('fixture-b'); await page.locator('[data-start]').click();
  await expect(page.locator('[data-place="built"] [data-word]')).toHaveCount(0);
  await expect(page.locator('[data-hints]')).toHaveValue('0');
  await page.locator('[data-close]').click(); await launch('fixture-a');
  await page.locator('[data-start]').click();
  await expect(page.locator('[data-place="built"] [data-word="2"]')).toHaveCount(1);
  await expect(page.locator('[data-hints]')).toHaveValue('2');
});

for (const action of ['data-compare','data-recall-listen']) test(`requesting ${action} before declaring recall remains assisted during delayed loading`, async ({page})=>{
  await mockBilling(page,{plan:'pathfinder'});
  let release, requested=false;
  let gate=Promise.resolve();
  await page.route('**/functions/v1/quran-content',async r=>{requested=true;await gate;await r.fulfill({json:long})});
  await page.goto('/'); await open(page);
  await page.locator('[data-reference]').selectOption(long.key);
  await expect(page.locator('[data-studio]')).toContainText('Current: 2:282');
  await page.locator('[data-recall]').click(); await page.locator('[data-close]').click();
  requested=false;gate=new Promise(resolve=>release=resolve);
  await enableDeveloperLab(page);await menu(page);
  await page.getByRole('button',{name:'Passage memorization',exact:true}).click();
  await page.locator(`[${action}]`).click();
  await expect.poll(()=>requested).toBe(true);
  await page.locator('[data-declare]').click();
  release();
  await page.locator('[data-compare]').click();
  await expect(page.locator('[data-comparison]')).toContainText(long.words[0].text);
  await page.locator('[data-grade="Good"]').click();
  await expect(page.locator('[data-studio-status]')).toContainText('Assisted self-assessment saved');
  const memory=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-user:00000000-0000-0000-0000-000000000001:ayah-passage-recall-v1')));
  expect(memory.records['ayah:2:282'].card).toBe(null);
});

test("multi-workspace reconstruction requires all words and retains the chosen excerpt sequence", async ({page})=>{
  await mockBilling(page,{signed:false});await page.goto('/');await open(page);
  await page.locator('[data-reference]').selectOption('98:5');
  await expect(page.locator('[data-studio]')).toContainText('workspace 1 / 3');
  const fill=async()=>{
    const ids=await page.locator('[data-place="bank"] [data-word]').evaluateAll(bs=>bs.map(b=>Number(b.dataset.word)).sort((a,b)=>a-b));
    for(const id of ids) await page.locator(`.passage-studio [data-word="${id}"]`).click();
  };
  await fill();await page.locator('[data-check-whole]').click();
  await expect(page.locator('[data-studio-status]')).toContainText('Complete each workspace');
  await page.locator('[data-next]').click();await fill();
  await page.locator('[data-next]').click();await fill();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ayah-passage-workspaces-v1')));
  const draft=Object.entries(before.records).find(([k])=>k.startsWith('98:5:'))[1];
  const sequence=[...draft.windowSequence];
  for(let target=0;target<sequence.length;target++){
    let index=sequence.indexOf(target);
    while(index>target){
      await page.locator(`[data-window-move="${index}:-1"]`).click();
      [sequence[index-1],sequence[index]]=[sequence[index],sequence[index-1]];
      index--;
    }
  }
  await page.locator('[data-check-whole]').click();
  await expect(page.locator('[data-studio-status]')).toContainText('Reconstruction correct');
  const saved=await page.evaluate(()=>localStorage.getItem('ayah-passage-workspaces-v1'));
  await page.reload();await open(page);
  expect(await page.evaluate(()=>localStorage.getItem('ayah-passage-workspaces-v1'))).toBe(saved);
  await page.locator('[data-check-whole]').click();
  await expect(page.locator('[data-studio-status]')).toContainText('Reconstruction correct');
});
