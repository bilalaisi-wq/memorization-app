import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002";
test("AI database gates adults, flags and paid access; serializes quota; isolates feedback/deletion and blocks direct writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`,
    );
    for (const name of ["20261022_billing.sql", "20261026_recitation_ai.sql"]) {
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    }
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026_recitation_ai.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`insert into auth.users values('${A}'),('${B}');`);
    const access = async () =>
      (await db.query(`select public.recitation_ai_access('${A}') v`)).rows[0]
        .v;
    expect((await access()).enabled).toBe(false);
    await db.exec(
      `update public.billing_config set ai_enabled=true;update public.recitation_ai_config set enabled=true,privacy_reviewed=true,pathfinder_monthly=1;
 insert into public.billing_customers(user_id,mode,stripe_customer_id) values('${A}','test','cus_A');
 insert into public.billing_subscriptions(user_id,mode,stripe_subscription_id,plan,status,price_id,access_until) values('${A}','test','sub_A','pathfinder','active','price_A',now()+interval '1 day');`,
    );
    expect((await access()).enabled).toBe(false);
    await db.exec(
      `insert into public.recitation_adult_pilot(user_id,approved_by,policy_version) values('${A}','Operator reviewed adult pilot','adult-pilot-2026-10-v1');`,
    );
    expect((await access()).enabled).toBe(true);
    await db.exec(
      "update public.recitation_ai_config set privacy_reviewed=false",
    );
    expect((await access()).enabled).toBe(false);
    await db.exec(
      "update public.recitation_ai_config set privacy_reviewed=true;update public.billing_config set ai_enabled=false",
    );
    expect((await access()).enabled).toBe(false);
    await db.exec("update public.billing_config set ai_enabled=true");
    const id = crypto.randomUUID(), other = crypto.randomUUID();
    const attempts = await Promise.allSettled([
      db.query(`select public.reserve_recitation_ai('${A}','${id}')`),
      db.query(`select public.reserve_recitation_ai('${A}','${other}')`),
    ]);
    expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await access()).used).toBe(1);
    await expect(
      db.query(`select public.reserve_recitation_ai('${A}','${id}')`),
    ).rejects.toThrow();
    await db.exec(
      `update public.recitation_ai_requests set state='complete',metadata='{"model":"whisper-1"}',created_at=now()-interval '2 hours' where user_id='${A}';`,
    );
    await expect(
      db.query(
        `select public.reserve_recitation_ai('${A}','${crypto.randomUUID()}')`,
      ),
    ).rejects.toThrow("Monthly allowance");
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${B}';`);
    for (
      const query of [
        `select * from public.recitation_ai_requests`,
        `update public.recitation_ai_usage set used=0`,
        `update public.recitation_adult_pilot set approved_by='me'`,
        `select public.reserve_recitation_ai('${A}','${crypto.randomUUID()}')`,
        `select public.recitation_ai_access('${A}')`,
        `select public.recitation_ai_feedback('${id}','helpful')`,
      ]
    ) await expect(db.query(query)).rejects.toThrow();
    await db.query("select public.delete_my_recitation_analysis()");
    await db.exec(`reset role;`);
    expect(
      (await db.query(
        `select metadata from public.recitation_ai_requests where user_id='${A}'`,
      )).rows[0].metadata.model,
    ).toBe("whisper-1");
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);
    await db.query(
      `select public.recitation_ai_feedback('${id}','false_positive')`,
    );
    await db.query("select public.delete_my_recitation_analysis()");
    await db.exec("reset role");
    const deleted = (await db.query(
      `select * from public.recitation_ai_requests where user_id='${A}'`,
    )).rows[0];
    expect(deleted.metadata).toBe(null);
    expect(deleted.feedback).toBe(null);
    expect(deleted.deleted_at).not.toBe(null);
    expect((await access()).used).toBe(1);
    await db.exec(
      `update public.billing_subscriptions set access_until=now()-interval '1 second';`,
    );
    expect((await access()).enabled).toBe(false);
    await db.exec(
      `delete from auth.users where id='${B}';delete from public.billing_subscriptions where user_id='${A}';delete from public.billing_customers where user_id='${A}';delete from auth.users where id='${A}';`,
    );
    for (
      const table of [
        "recitation_adult_pilot",
        "recitation_ai_usage",
        "recitation_ai_requests",
      ]
    ) {
      expect(
        (await db.query(`select count(*)::int n from public.${table}`)).rows[0]
          .n,
      ).toBe(0);
    }
  } finally {
    await db.close();
  }
});
