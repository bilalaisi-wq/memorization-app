import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('developer mode is owner-provisioned, reversible and publishes only menu order',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`);
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 await db.exec(`insert into auth.users values('${a}','bilalaisi@gmail.com',now()),('${b}','other@example.test',now());`);
 const sql=readFileSync('supabase/SETUP_JUZ29.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${b}';`);
 await expect(db.query(`select set_my_developer_mode(true)`)).rejects.toThrow();
 await expect(db.query(`insert into site_developers values('${b}',true)`)).rejects.toThrow();
 await expect(db.query(`select save_site_menu('[]')`)).rejects.toThrow();
 await db.exec(`set request.jwt.claim.sub='${a}';`);
 expect((await db.query('select my_billing_entitlements() e')).rows[0].e.features.allQuran).toBe(false);
 await db.query('select set_my_developer_mode(true)');
 const ent=(await db.query('select my_billing_entitlements() e')).rows[0].e;
 expect(ent.developer).toBe(true);expect(ent.features.allQuran).toBe(true);expect(ent.features.ai).toBe(false);
 await db.query(`select save_site_menu('["Juz 29 library","Practice"]')`);
 await db.exec('reset role');
 await db.exec("update billing_config set checkout_enabled=true; create table existing_progress(id int primary key, xp int); insert into existing_progress values(1,900);");
 await db.exec(sql);
 expect((await db.query('select checkout_enabled from billing_config')).rows[0].checkout_enabled).toBe(true);
 expect((await db.query('select xp from existing_progress')).rows[0].xp).toBe(900);
 expect((await db.query('select count(*) n from quran_review_heads')).rows[0].n).toBe(35);
 expect((await db.query('select enabled from site_developers')).rows[0].enabled).toBe(true);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 await db.query('select set_my_developer_mode(false)');
 expect((await db.query('select my_billing_entitlements() e')).rows[0].e.features.allQuran).toBe(false);
 await db.exec('set role anon');expect((await db.query('select menu_order from site_layout')).rows[0].menu_order).toEqual(['Juz 29 library','Practice']);
 await expect(db.query(`update site_layout set menu_order='[]'`)).rejects.toThrow();
 } finally {await db.close();}
});
