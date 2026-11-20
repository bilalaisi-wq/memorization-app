import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',L='00000000-0000-4000-8000-000000000099';
const sql=name=>readFileSync('supabase/migrations/'+name,'utf8');
test('native migration preserves Stripe, scopes receipts, prevents client grants, reserves purchases, reconciles tiers and expires without touching learning',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`);
 await db.exec(sql('20261022_billing.sql'));const oid=(await db.query("select 'public.billing_entitlements_for(uuid)'::regprocedure::oid id")).rows[0].id;await db.exec(sql('20261119_native_billing.sql'));expect((await db.query("select 'public.billing_entitlements_for(uuid)'::regprocedure::oid id")).rows[0].id).toBe(oid);await db.exec(sql('20261119_native_billing.sql'));
 await db.exec(`insert into auth.users values('${A}'),('${B}');insert into public.billing_store_bindings(user_id,account_token) values('${A}','${A}'),('${B}','${B}');insert into public.billing_store_products values('apple','example.explorer','', 'explorer','monthly',true),('google','example.pathfinder','monthly','pathfinder','monthly',true);update public.billing_store_config set verification_enabled=true,purchase_enabled=true,sandbox_approved=true,policy_reviewed=true;set role authenticated;set request.jwt.claim.sub='${A}';`);
 const ent=async()=>(await db.query('select public.my_billing_entitlements() e')).rows[0].e;
 expect((await ent()).plan).toBe('free');expect((await ent()).features.juzAmma).toBe(true);
 for(const table of ['billing_store_config','billing_store_bindings','billing_native_transactions','billing_native_events','billing_native_subscriptions'])await expect(db.query(`select * from public.${table}`)).rejects.toThrow();
 await expect(db.query(`select public.billing_native_start('${A}','apple','example.explorer','')`)).rejects.toThrow();
 await db.exec('reset role;set role service_role;');
 const start=()=>db.query(`select public.billing_native_start('${A}','apple','example.explorer','') id`);await start();await expect(start()).rejects.toThrow();
 expect((await db.query(`select public.billing_native_checkout_guard('${A}') ok`)).rows[0].ok).toBe(false);
 await db.exec(`delete from public.billing_native_reservations;select public.billing_acquire_lock('${A}','test','${L}');`);
 const snapshot={provider:'apple',environment:'sandbox',chain_id:'original',transaction_id:'renewal-1',product_id:'example.explorer',base_plan_id:'',account_token:A,status:'active',access_until:'2099-01-01',expires_at:'2099-01-01',auto_renew:false,purchase_reference:'original'};
 const commit=async(s=snapshot,event='e1')=>(await db.query('select public.billing_native_commit($1,$2,$3,$4,$5) ok',[A,L,'test',s,event])).rows[0].ok;
 expect(await commit()).toBe(true);expect(await commit()).toBe(false);expect(await commit({...snapshot,account_token:B},'bad-owner').catch(()=>false)).toBe(false);
 expect((await db.query('select count(*) n from public.billing_native_transactions')).rows[0].n).toBe(1);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);expect((await ent()).plan).toBe('explorer');await db.exec("reset role;update public.billing_config set stripe_mode='live';set role authenticated;");expect((await ent()).plan).toBe('free');await db.exec("reset role;update public.billing_config set stripe_mode='test';set role authenticated;");await db.query('select public.choose_my_juz(array[1,2,3,4,5])');await expect(db.query('select public.choose_my_juz(array[1,2,3,4,5,6])')).rejects.toThrow();
 await db.exec(`set request.jwt.claim.sub='${B}';`);expect((await ent()).plan).toBe('free');expect((await db.query('select provider,plan from public.billing_native_subscriptions')).rows).toHaveLength(0);
 await db.exec(`reset role;set role service_role;insert into public.billing_customers(user_id,mode,stripe_customer_id) values('${A}','test','cus_A');insert into public.billing_subscriptions(mode,stripe_subscription_id,user_id,plan,status,price_id,access_until) values('test','web','${A}','pathfinder','active','price','2099-01-01');set role authenticated;set request.jwt.claim.sub='${A}';`);
 expect((await ent()).plan).toBe('pathfinder');expect((await ent()).provider).toBe('stripe');expect((await ent()).providers).toHaveLength(2);
 await db.exec(`reset role;set role service_role;update public.billing_subscriptions set access_until='2000-01-01';`);await commit({...snapshot,status:'revoked',access_until:null},'refund');await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);expect((await ent()).plan).toBe('free');expect((await ent()).features.juzAmma).toBe(true);
 await db.exec(`reset role;set role service_role;`);await commit({...snapshot,transaction_id:'renewal-2',status:'grace'},'renewal');await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);expect((await ent()).plan).toBe('explorer');
 await db.exec(`reset role;update public.billing_native_subscriptions set access_until='2000-01-01';set role authenticated;`);expect((await ent()).plan).toBe('free');

 await db.exec(`reset role;set role service_role;`);
 const google={...snapshot,provider:'google',product_id:'example.pathfinder',base_plan_id:'monthly',plan:'pathfinder',chain_id:'new-A',transaction_id:'GPA-new',purchase_reference:'new-A'};
 await db.query(`insert into public.billing_native_subscriptions(provider,environment,chain_id,user_id,transaction_id,product_id,base_plan_id,plan,status,access_until,expires_at,auto_renew,purchase_reference) values('google','sandbox','old-B',$1,'GPA-B','example.pathfinder','monthly','pathfinder','active','2099-01-01','2099-01-01',true,'old-B'),('google','sandbox','old-A',$2,'GPA-A','example.pathfinder','monthly','pathfinder','active','2099-01-01','2099-01-01',true,'old-A')`,[B,A]);
 await expect(commit({...google,linked_reference:'old-B'},'foreign-linked')).rejects.toThrow();
 await commit({...google,linked_reference:'old-A'},'replacement');await commit({...google,chain_id:'old-A',transaction_id:'GPA-A',purchase_reference:'old-A'},'late-old');
 await db.exec(`update public.billing_native_subscriptions set access_until='2000-01-01' where chain_id='new-A';set role authenticated;set request.jwt.claim.sub='${A}';`);expect((await ent()).plan).toBe('free');
 await db.exec(`reset role;set role service_role;`);await commit(snapshot,'same-event');expect(await commit({...snapshot,status:'revoked',access_until:null},'same-event')).toBe(false);
 await db.exec(`set role authenticated;`);expect((await ent()).plan).toBe('free');
 }finally{await db.close();}
});
