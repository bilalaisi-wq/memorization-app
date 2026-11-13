import { expect, test } from "@playwright/test";
async function setup(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const m = await import("/src/offline/model.js"),
      db = await import("/src/offline/store.js");
    const { sha256 } = await import("/src/content/library.js");
    window.offlineTest = { m, db };
    const manifest = {
      schemaVersion: 1,
      revision: "a".repeat(64),
      texts: {},
      shell: [],
      audio: {},
    };
    for (const key of m.offlineSelection({ surah: 112 }).refs) {
      const b = await m.canonicalText(key), json = JSON.stringify(b);
      manifest.texts[key] = {
        sha256: await sha256(json),
        bytes: new TextEncoder().encode(json).length,
      };
      const paths = [
        `/audio/112${String(b.ayah).padStart(3, "0")}.mp3`,
        ...b.words.map((_, i) =>
          `/audio/112_${String(b.ayah).padStart(3, "0")}_${
            String(i + 1).padStart(3, "0")
          }.mp3`
        ),
      ];
      for (const path of paths) {
        const bytes = new TextEncoder().encode("TEST ONLY AUDIO " + path);
        manifest.audio[path] = {
          key,
          bytes: bytes.length,
          sha256: await sha256(bytes.buffer),
          kind: path.includes("_") ? "word" : "ayah",
        };
      }
    }
    window.offlineTest.manifest = manifest;
    window.offlineTest.plan = await m.planDownload({ surah: 112 }, {
      manifest,
      audio: true,
    });
    window.offlineTest.fetcher = async (path) =>
      new Response(new TextEncoder().encode("TEST ONLY AUDIO " + path), {
        headers: { "Content-Type": "audio/mpeg" },
      });
  });
}
test("interrupted free downloads persist and resume, repeated retries reuse verified assets without touching learning history", async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { m, db, plan, fetcher } = window.offlineTest;
    localStorage.setItem(
      "ayah-passage-recall-v1",
      "ORIGINAL_FSRS_TEST_FIXTURE",
    );
    const s = m.createDownloadService({
        fetcher,
        onProgress: (p) => {
          if (p.completed === 1) s.cancel();
        },
      }),
      partial = await s.download(plan);
    const text = await db.dbRead("texts", "112:1");
    let count = 0;
    const retry = m.createDownloadService({
        fetcher: async (path) => {
          count++;
          return fetcher(path);
        },
      }),
      full = await retry.download(plan),
      once = count;
    await retry.download(plan);
    const b = await m.readDownloaded("112:4");
    return {
      partial: partial.status,
      partialExists: !!text,
      full: full.status,
      once,
      twice: count,
      key: b.key,
      history: localStorage.getItem("ayah-passage-recall-v1"),
    };
  });
  expect(result).toMatchObject({
    partial: "incomplete",
    partialExists: true,
    full: "ready",
    key: "112:4",
    history: "ORIGINAL_FSRS_TEST_FIXTURE",
  });
  expect(result.once).toBeGreaterThan(4);
  expect(result.twice).toBe(result.once);
});
test("checksum failures and corrupt IndexedDB assets are rejected and retry replaces corrupt media", async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { m, db, plan, fetcher } = window.offlineTest;
    const bad = await m.createDownloadService({
      fetcher: async () => new Response("CORRUPT"),
    }).download(plan);
    const good = await m.createDownloadService({ fetcher }).download(plan);
    const asset = await db.dbRead("assets", plan.assets[0].id);
    await db.dbWrite("assets", { ...asset, blob: new Blob(["damaged"]) });
    let rejected = false;
    try {
      await db.assetBytes(asset.id);
    } catch {
      rejected = true;
    }
    const repaired = await m.createDownloadService({ fetcher }).download(plan);
    return {
      bad: bad.status,
      failed: bad.failed.length,
      good: good.status,
      rejected,
      repaired: repaired.status,
      bytes: (await db.assetBytes(asset.id)).size,
    };
  });
  expect(result.bad).toBe("incomplete");
  expect(result.failed).toBeGreaterThan(0);
  expect(result).toMatchObject({
    good: "ready",
    rejected: true,
    repaired: "ready",
  });
  expect(result.bytes).toBeGreaterThan(0);
});
test("overlapping packages retain shared assets; removal never deletes progress or another package", async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { m, db, plan, fetcher } = window.offlineTest;
    await m.createDownloadService({ fetcher }).download(plan);
    await db.dbWrite("packages", {
      ...(await db.dbRead("packages", plan.id)),
      id: "overlapping-test-package",
    });
    await m.removeDownload(plan.id);
    const remains = await db.assetBytes(plan.assets[0].id);
    await m.removeDownload("overlapping-test-package");
    return {
      remains: !!remains,
      gone: !(await db.dbRead("assets", plan.assets[0].id)),
      textsGone: !(await db.dbRead("texts", "112:1")),
    };
  });
  expect(result).toEqual({ remains: true, gone: true, textsGone: true });
});
test("corrupt or stale text stays preserved for recovery and premium/off-account data is never cached", async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { m, db, plan, fetcher } = window.offlineTest;
    await m.createDownloadService({ fetcher }).download(plan);
    const row = await db.dbRead("texts", "112:1");
    await db.dbWrite("texts", {
      ...row,
      bundle: { ...row.bundle, textUthmani: "CORRUPT_TEST_ONLY" },
    });
    let corrupt = "", premium = "";
    try {
      await m.readDownloaded("112:1");
    } catch (e) {
      corrupt = e.message;
    }
    try {
      await m.canonicalText("2:255");
    } catch (e) {
      premium = e.message;
    }
    const { selectProfile, profileStorage } = await import(
      "/src/learner/profile-storage.js"
    );
    selectProfile("account-a");
    profileStorage.setItem("ayah-learning-v1", "ACCOUNT_A");
    selectProfile("account-b");
    const isolated = profileStorage.getItem("ayah-learning-v1") === null;
    const rows = await db.dbList("texts");
    return {
      corrupt,
      premium,
      isolated,
      preserved: (await db.dbRead("texts", "112:1")).bundle.textUthmani,
      freeOnly: rows.every((r) => r.id.startsWith("112:")),
    };
  });
  expect(result.corrupt).toContain("corrupt");
  expect(result.premium).toContain("Premium");
  expect(result).toMatchObject({
    isolated: true,
    preserved: "CORRUPT_TEST_ONLY",
    freeOnly: true,
  });
});

test('source metadata changes are rejected even when Arabic and a rewritten local checksum are unchanged',async({page})=>{await setup(page);const result=await page.evaluate(async()=>{const {m,db,manifest}=window.offlineTest;await m.createDownloadService().download(await m.planDownload({surah:112},{manifest,audio:false}));const row=await db.dbRead('texts','112:1');row.bundle.translation='OUTDATED TEST FIXTURE TRANSLATION';row.sha256=await (await import('/src/content/library.js')).sha256(JSON.stringify(row.bundle));await db.dbWrite('texts',row);try{await m.readDownloaded('112:1');return false;}catch(e){return /revision changed/.test(e.message)&&(await db.dbRead('texts','112:1')).bundle.translation==='OUTDATED TEST FIXTURE TRANSLATION';}});expect(result).toBe(true);});

test('changing an audio package to text-only removes obsolete audio and preserves shared media and FSRS',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const {m,db,plan,fetcher,manifest}=window.offlineTest;
  await m.createDownloadService({fetcher}).download(plan);
  const shared=plan.assets[0].id;
  await db.dbWrite('packages',{...(await db.dbRead('packages',plan.id)),id:'shared-package',paths:[shared]});
  localStorage.setItem('ayah-passage-recall-v1','UNCHANGED_REVIEW_HISTORY');
  const textPlan=await m.planDownload({surah:112},{manifest,audio:false});
  await m.createDownloadService({fetcher}).download(textPlan);
  const assets=await db.dbList('assets'),record=await db.dbRead('packages',plan.id);
  await m.removeDownload(plan.id);
  const retained=!!await db.dbRead('assets',shared);
  await m.removeDownload('shared-package');
  return {paths:record.paths,assets:assets.map(a=>a.id),retained,remaining:(await db.dbList('assets')).length,history:localStorage.getItem('ayah-passage-recall-v1')};
 });
 expect(result).toEqual({paths:[],assets:['/audio/112001.mp3'],retained:true,remaining:0,history:'UNCHANGED_REVIEW_HISTORY'});
});
test('interrupted audio-to-text update retains old media references for explicit removal',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const {m,db,plan,fetcher,manifest}=window.offlineTest;
  await m.createDownloadService({fetcher}).download(plan);
  const text=await m.planDownload({surah:112},{manifest,audio:false});
  const interrupted=await m.createDownloadService({fetcher}).download(text,{prepareShell:async()=>{throw Error('TEST_ONLY_INTERRUPTED_UPDATE');}});
  const readable=await m.readDownloaded('112:1');
  await m.removeDownload(plan.id);
  return {status:interrupted.status,paths:interrupted.paths.length,expected:plan.assets.length,key:readable.key,remaining:(await db.dbList('assets')).length};
 });
 expect(result.status).toBe('incomplete');expect(result.paths).toBe(result.expected);expect(result.key).toBe('112:1');expect(result.remaining).toBe(0);
});
test('cleanup preserves unfamiliar package records and reclaims legacy orphans only after explicit removal',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const {m,db,plan,fetcher}=window.offlineTest;
  await m.createDownloadService({fetcher}).download(plan);
  const asset=await db.dbRead('assets',plan.assets[0].id);
  await db.dbWrite('assets',{...asset,id:'TEST_ONLY_LEGACY_ORPHAN'});
  const future={id:'future-package',version:999,unrecognized:'PRESERVE_EXACTLY'};
  await db.dbWrite('packages',future);
  await m.removeDownload(plan.id);
  const preserved=JSON.stringify(await db.dbRead('packages',future.id))===JSON.stringify(future),held=!!await db.dbRead('assets',asset.id);
  await m.removeDownload(future.id);
  return {preserved,held,remaining:(await db.dbList('assets')).length,texts:(await db.dbList('texts')).length};
 });expect(result).toEqual({preserved:true,held:true,remaining:0,texts:0});
});
