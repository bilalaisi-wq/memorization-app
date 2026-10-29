import { quranHandler } from "./quran-handler.ts";
const assert = (ok: unknown, message = "Assertion failed") => {
  if (!ok) throw Error(message);
};
const bytes = await Deno.readFile(
  new URL("../../../tests/fixtures/2-282.json", import.meta.url),
);
Deno.env.set("BILLING_SITE_URL", "https://ayah.example.test");
Deno.test("private Quran requests require verified identity and server-derived juz entitlements; never accept a client plan/path/customer", async () => {
  let authenticated = true,
    ent: any = { plan: "free", selectedJuz: [], features: {} },
    reads = 0,
    owner = "";
  const admin: any = {
    auth: {
      getUser: async (token: string) =>
        authenticated && token === "verified-B"
          ? { data: { user: { id: "B", email_confirmed_at: "2026-01-01" } } }
          : { error: true, data: {} },
    },
    rpc: async (_name: string, args: any) => {
      owner = args.p_user;
      return { data: ent };
    },
    storage: {
      from: (bucket: string) => {
        assert(bucket === "quran-premium");
        return {
          download: async (path: string) => {
            reads++;
            assert(path === "2/282/bundle.json" || path === "2/282/full.mp3");
            return { data: new Blob([bytes]) };
          },
        };
      },
    },
  };
  const handler = quranHandler(() => admin);
  const req = (body: any, token = "verified-B") =>
    new Request("https://api.example.test/functions/v1/quran-content", {
      method: "POST",
      headers: {
        origin: "https://ayah.example.test",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
  assert(
    (await handler(req({ key: "2:282", asset: "bundle" }, ""))).status === 401,
  );
  assert(
    (await handler(
      req({
        key: "2:282",
        asset: "bundle",
        plan: "guardian",
        juz: 30,
        user: "A",
        path: "../secret",
      }),
    )).status === 403,
  );
  assert(reads === 0);
  assert(owner === "B");
  ent = { plan: "explorer", selectedJuz: [29], features: {} };
  assert(
    (await handler(req({ key: "2:282", asset: "bundle" }))).status === 403,
  );
  ent = { plan: "explorer", selectedJuz: [3], features: {} };
  const good = await handler(req({ key: "2:282", asset: "bundle" }));
  assert(good.status === 200);
  assert((await good.json()).key === "2:282");
  assert(good.headers.get("cache-control") === "private, no-store");
  authenticated = false;
  assert((await handler(req({ key: "2:282", asset: "audio" }))).status === 401);
  authenticated = true;
  assert(
    (await handler(req({ key: "2:283", asset: "bundle" }))).status === 404,
  );
  assert(
    (await handler(req({ key: "2:282", asset: "../../secret" }))).status ===
      400,
  );
  // Bundle bytes cannot be passed off as audio; every asset has its own digest.
  assert((await handler(req({ key: "2:282", asset: "audio" }))).status === 503);
});
Deno.test("private object corruption fails closed even for Pathfinder; expired plans cannot download again", async () => {
  let ent: any = { plan: "pathfinder", features: { allQuran: true } };
  const admin: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "A", email_confirmed_at: "2026-01-01" } },
      }),
    },
    rpc: async () => ({ data: ent }),
    storage: {
      from: () => ({ download: async () => ({ data: new Blob(["corrupt"]) }) }),
    },
  };
  const handler = quranHandler(() => admin),
    req = () =>
      new Request("https://api.example.test", {
        method: "POST",
        headers: { authorization: "Bearer verified" },
        body: JSON.stringify({ key: "2:282", asset: "bundle" }),
      });
  assert((await handler(req())).status === 503);
  ent = { plan: "free", features: {} };
  assert((await handler(req())).status === 403);
});

Deno.test("staff access and reviewed stop metadata come only from the server; canonical text is untouched", async () => {
  const { draftSegments } = await import("./segmentation.js");
  const source = JSON.parse(new TextDecoder().decode(bytes));
  const proposal = draftSegments(source)!;
  const rows: any[] = proposal.segments.map((s) => ({ ...s }));
  rows[0].stopStatus = "approved";
  rows[0].restartWord = 11;
  let staff = false;
  const queries: string[] = [];
  const admin: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "teacher", email_confirmed_at: "2026-01-01" } },
      }),
    },
    rpc: async (name: string) => ({
      data: name === "is_quran_reviewer"
        ? staff
        : { plan: "free", features: {} },
    }),
    storage: {
      from: () => ({ download: async () => ({ data: new Blob([bytes]) }) }),
    },
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: (key: string) => {
          queries.push(key);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: {
            version: 1,
            source_edition: "TEST FIXTURE",
            riwayah: "Hafs",
            reviewer_name: "TEST ONLY",
            reviewed_at: "2026-01-01",
            segments: rows,
          },
        }),
      };
      return chain;
    },
  };
  const handler = quranHandler(() => admin),
    req = () =>
      new Request("https://api.example.test", {
        method: "POST",
        headers: { authorization: "Bearer teacher" },
        body: JSON.stringify({ key: "2:282", asset: "bundle", reviewer: true }),
      });
  assert((await handler(req())).status === 403);
  staff = true;
  const response = await handler(req());
  assert(response.status === 200);
  const result = await response.json();
  assert(result.textUthmani === source.textUthmani);
  assert(result.segments.length === 2);
  assert(result.segments[1].review.status === "approved");
  assert(!result.segments[1].audioReview);
  assert(queries.includes("source_hash"));
});

Deno.test('Juz 29 preview rejects paid juz selection and requires active server developer mode before private storage',async()=>{
 let ent:any={plan:'free',features:{}}, reads:string[]=[];
 const admin:any={
  auth:{getUser:async()=>({data:{user:{id:'learner',email_confirmed_at:'2026-01-01'}}})},
  rpc:async(name:string)=>({data:name==='developer_enabled'?ent.developer===true:name==='is_quran_reviewer'?false:ent}),
  storage:{from:(bucket:string)=>{assert(bucket==='quran-premium');return{download:async(path:string)=>{reads.push(path);return{error:true};}};}},
 };
 const handler=quranHandler(()=>admin,{bundleLoader:async()=>{throw Error('Provider offline');}});
 const request=(key:string)=>new Request('https://api.example.test',{method:'POST',headers:{authorization:'Bearer verified'},body:JSON.stringify({key,asset:'bundle',developer:true,plan:'pathfinder',juz:30})});
 for(const key of ['67:1','77:50'])assert((await handler(request(key))).status===403);
 assert(reads.length===0);
 ent={plan:'explorer',selectedJuz:[28],features:{}};
 assert((await handler(request('77:50'))).status===403);
 ent={plan:'explorer',selectedJuz:[29],features:{}};
 assert((await handler(request('77:50'))).status===403);
 assert(reads.length===0);
 ent={plan:'pathfinder',developer:true,features:{allQuran:true}};
 assert((await handler(request('67:1'))).status===503);
 assert(reads[0]==='67/1/bundle.json');
 ent={plan:'free',features:{}};
 assert((await handler(request('67:1'))).status===403);
 assert(reads.length===1);
});

Deno.test('developer-only chapters reject paid accounts, forged claims and inactive owner flags before fetching text',async()=>{
 let developer=false,paid=true,calls=0;
 const admin:any={auth:{getUser:async(token:string)=>token==='verified'?{data:{user:{id:'owner',email_confirmed_at:'2026-01-01'}}}:{error:true,data:{}}},rpc:async(name:string)=>({data:name==='developer_enabled'?developer:name==='is_quran_reviewer'?false:{plan:paid?'pathfinder':'free',features:{allQuran:paid},developer}}),storage:{from:()=>({download:async()=>({error:true})})}};
 const handler=quranHandler(()=>admin,{chapterLoader:async()=>{calls++;return [{key:'7:1'}];}});
 const req=(key='7:1',token='verified')=>new Request('https://api.example.test',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify({key,asset:'chapter',developer:true,plan:'guardian',user:'owner'})});
 assert((await handler(req('7:1',''))).status===401);assert((await handler(req())).status===403);assert(calls===0);
 developer=true;assert((await handler(req())).status===200);assert(calls===1);developer=false;assert((await handler(req())).status===403);assert(calls===1);
 paid=false;developer=true;assert((await handler(req('67:1'))).status===200);assert(calls===2);
});
Deno.test('provider fingerprints reject changed Quran wording, translation and word alignment',async()=>{
 const {bundleFromProvider,contentFingerprint}=await import('./provider-content.js');
 const {sha256}=await import('./content-policy.js');
 const {surahs}=await import('../../../src/data.js');const v=surahs[0].verses[0];
 const original={key:'1:1',juz:1,textUthmani:v.text,translation:v.translation,words:v.words.map((text:string,i:number)=>({position:i+1,text,translation:v.meanings[i][0],transliteration:v.roman[i]}))},entry={key:original.key,contentSha256:await sha256(contentFingerprint(original))};
 const verse={verse_key:original.key,juz_number:original.juz,translations:[{resource_id:20,text:original.translation}],words:original.words.map((w:any)=>({position:w.position,char_type_name:'word',text_uthmani:w.text,translation:{text:w.translation},transliteration:{text:w.transliteration},audio_url:w.audioSource}))},canonical={verse_key:original.key,text_uthmani:original.textUthmani};
 const checked=await bundleFromProvider(verse,canonical,entry);assert(checked.textUthmani===original.textUthmani);assert(checked.words.length===original.words.length);
 for(const kind of ['translation','word']){const variant=structuredClone(verse);if(kind==='translation')variant.translations[0].text+=' changed';else variant.words[0].text_uthmani=variant.words[1].text_uthmani;let rejected=false;try{await bundleFromProvider(variant,canonical,entry);}catch{rejected=true;}assert(rejected);}
 const reordered=structuredClone(verse);[reordered.words[0],reordered.words[1]]=[reordered.words[1],reordered.words[0]];let rejected=false;try{await bundleFromProvider(reordered,canonical,entry);}catch{rejected=true;}assert(rejected);
});
