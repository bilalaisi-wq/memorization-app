import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('paste-ready Juz 29 review setup creates missing schema and preserves existing review history on rerun',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`);
  const sql=readFileSync('supabase/SETUP_JUZ29_REVIEWS.sql','utf8');
  await db.exec(sql);
  expect((await db.query('select count(*) n from quran_review_heads')).rows[0].n).toBe(35);
  expect((await db.query('select count(*) n from quran_reviewers')).rows[0].n).toBe(0);
  expect((await db.query('select count(*) n from quran_review_versions')).rows[0].n).toBe(0);
  await db.exec(`update quran_review_heads set revision=1 where verse_key='73:20';insert into quran_review_versions(verse_key,version,source_hash,reviewer_name,reviewer_credentials,source_edition,riwayah,segments) select verse_key,1,source_hash,'Test fixture','Test only','Test edition','Hafs','[]' from quran_review_heads where verse_key='73:20';`);
  await db.exec(sql);
  expect((await db.query("select revision from quran_review_heads where verse_key='73:20'")).rows[0].revision).toBe(1);
  expect((await db.query("select count(*) n from quran_review_versions where verse_key='73:20'")).rows[0].n).toBe(1);
  for(const table of ['quran_reviewers','quran_review_heads','quran_review_versions']){
   expect((await db.query(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`)).rows[0].relrowsecurity).toBe(true);
  }
  await db.exec('set role authenticated');
  await expect(db.query('select * from quran_review_heads')).rejects.toThrow();
  await expect(db.query("select submit_segmentation_review('73:20',1,'fake','edition','Hafs','[]')")).rejects.toThrow('Qualified');
 }finally{await db.close();}
});
