import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('Cosmic SQL is rerunnable, account-isolated, RPC-only, idempotent and CAS-protected without touching native history',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20261023_passage_content.sql','utf8'));const sql=readFileSync('supabase/SETUP_COSMIC_PROGRESS.sql','utf8');await db.exec(sql);await db.exec(sql);
  const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',r1='10000000-0000-0000-0000-000000000001',r2='10000000-0000-0000-0000-000000000002';await db.query('insert into auth.users values ($1),($2)',[a,b]);await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
  const doc={version:1,entries:{'ayah-cosmic-expeditions-v1':JSON.stringify({version:1,runs:{}})}},save=(who,rev,id,d)=>db.query('select public.save_my_cosmic_progress($1,$2,$3,$4) as revision',[who,rev,id,JSON.stringify(d)]);
  expect((await save(a,0,r1,doc)).rows[0].revision).toBe(1);expect((await save(a,0,r1,doc)).rows[0].revision).toBe(1);expect((await save(a,0,r2,doc)).rows[0].revision).toBe(1);
  const next={version:1,entries:{...doc.entries,'ayah-cosmic-adaptive-v1':'{"version":1,"events":[]}'}};expect((await save(a,1,r2,next)).rows[0].revision).toBe(2);await expect(save(a,0,r1,doc)).rejects.toThrow();await expect(save(b,2,r1,next)).rejects.toThrow();await expect(save(a,2,r1,{version:1,entries:{'ayah-learning-v1':'{}'}})).rejects.toThrow();
  await expect(db.query('update cosmic_progress set revision=99')).rejects.toThrow();await expect(db.query('delete from cosmic_progress')).rejects.toThrow();await expect(db.query('insert into cosmic_progress(user_id,document,last_request) values ($1,$2,$3)',[b,'{}',r1])).rejects.toThrow();
  const native={version:1,records:{},active:null};expect((await db.query('select public.save_my_cosmic_passage_learning($1,0,$2) as revision',[a,JSON.stringify(native)])).rows[0].revision).toBe(1);await expect(db.query('select public.save_my_cosmic_passage_learning($1,1,$2)',[b,JSON.stringify(native)])).rejects.toThrow();
  await db.exec(`set request.jwt.claim.sub='${b}';`);expect((await db.query('select * from cosmic_progress')).rows).toHaveLength(0);expect((await db.query('select * from passage_learning')).rows).toHaveLength(0);await expect(save(a,2,r1,next)).rejects.toThrow();await db.exec('set role anon;');await expect(db.query('select * from cosmic_progress')).rejects.toThrow();await expect(save(b,0,r1,doc)).rejects.toThrow();
  await db.exec('reset role;');expect((await db.query('select document from passage_learning where user_id=$1',[a])).rows[0].document).toEqual(native);await db.query('delete from auth.users where id=$1',[a]);expect((await db.query('select * from cosmic_progress')).rows).toHaveLength(0);
 }finally{await db.close();}
});
