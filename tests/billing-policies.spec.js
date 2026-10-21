import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002",
  T = "00000000-0000-0000-0000-000000000099";
test("billing database enforces owner isolation, service-only writes, expiration, cancellation, flags, choices, deletion and idempotence", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`,
    );
    const sql = readFileSync(
      new URL("../supabase/migrations/20261022_billing.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.exec(
      `insert into auth.users values('${A}'),('${B}');insert into public.billing_customers(user_id,mode,stripe_customer_id) values('${A}','test','cus_A'),('${B}','test','cus_B');set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    const ent = async () =>
      (await db.query("select public.my_billing_entitlements() e")).rows[0].e;
    expect((await ent()).plan).toBe("free");
    expect((await ent()).features.juzAmma).toBe(true);
    for (
      const table of [
        "billing_config",
        "billing_customers",
        "billing_events",
        "billing_checkouts",
        "billing_locks",
        "billing_juz_choices",
        "saved_passages",
      ]
    ) await expect(db.query(`select * from public.${table}`)).rejects.toThrow();
    await expect(
      db.query(
        `insert into public.billing_subscriptions(mode,stripe_subscription_id,user_id,status,price_id) values('test','sub_fake','${A}','active','fake')`,
      ),
    ).rejects.toThrow();
    await expect(db.query(`select public.billing_entitlements_for('${B}')`))
      .rejects.toThrow();
    await expect(
      db.query(`select public.billing_acquire_lock('${A}','test','${T}')`),
    ).rejects.toThrow();
    await expect(db.query(`select public.choose_my_juz(array[1,2])`)).rejects
      .toThrow();
    await db.exec(`reset role;set role service_role;`);
    expect(
      (await db.query(
        `select public.billing_acquire_lock('${A}','test','${T}') ok`,
      )).rows[0].ok,
    ).toBe(true);
    expect(
      (await db.query(
        `select public.billing_acquire_lock('${A}','test','${T}') ok`,
      )).rows[0].ok,
    ).toBe(false);
    const snapshot = [{
      id: "sub_A",
      plan: "explorer",
      status: "active",
      priceId: "price_e",
      accessUntil: "2099-01-01T00:00:00Z",
      periodEnd: "2099-01-01T00:00:00Z",
      cancelAtPeriodEnd: true,
    }];
    const apply = async (event, s = snapshot) =>
      (await db.query(
        "select public.billing_commit_snapshot($1,$2,$3,$4,$5,$6) ok",
        [
          A,
          "test",
          T,
          event,
          "customer.subscription.updated",
          JSON.stringify(s),
        ],
      )).rows[0].ok;
    expect(await apply("evt_1")).toBe(true);
    expect(await apply("evt_1", [{ ...snapshot[0], plan: "guardian" }])).toBe(
      false,
    );
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    expect((await ent()).plan).toBe("explorer");
    expect((await ent()).cancelAtPeriodEnd).toBe(true);
    await db.query("select public.choose_my_juz(array[1,2,3,4,5])");
    expect((await ent()).selectedJuz).toEqual([1, 2, 3, 4, 5]);
    for (
      const choices of [
        "array[1,2,3,4,5,6]",
        "array[1,1]",
        "array[30]",
        "array[null]::integer[]",
      ]
    ) {
      await expect(db.query(`select public.choose_my_juz(${choices})`)).rejects
        .toThrow();
    }
    await expect(
      db.query("update public.billing_subscriptions set plan='guardian'"),
    ).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub='${B}';`);
    expect((await ent()).plan).toBe("free");
    expect((await db.query("select * from public.billing_subscriptions")).rows)
      .toHaveLength(0);
    await db.exec("reset role;set role service_role;");
    await apply("evt_2", [{
      ...snapshot[0],
      status: "past_due",
      accessUntil: "2001-01-01T00:00:00Z",
    }]);
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    expect((await ent()).plan).toBe("free");
    expect((await ent()).features.juzAmma).toBe(true);
    await db.exec("reset role;set role service_role;");
    await apply("evt_3", [{ ...snapshot[0], plan: "pathfinder" }]);
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    expect((await ent()).features.memoryAnalytics).toBe(true);
    expect((await ent()).features.ai).toBe(false);
    await db.exec("reset role;");
    await expect(db.query(`delete from auth.users where id='${A}'`)).rejects
      .toThrow(/billing/i);
    // Environment switching cannot mix a test subscription into live entitlements.
    await db.exec("update public.billing_config set stripe_mode='live'");
    expect((await ent()).plan).toBe("free");
    await db.exec("update public.billing_config set stripe_mode='test'");
    await db.exec("set role service_role;");
    await apply("evt_4", [{ ...snapshot[0], status: "canceled" }]);
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    expect((await ent()).plan).toBe("free");
    await db.exec("reset role;set role service_role;");
    await db.exec(
      "update public.billing_locks set expires_at=now()-interval '1 second'",
    );
    await expect(apply("evt_expired")).rejects.toThrow("lock expired");
    expect(
      (await db.query(
        "select * from public.billing_events where event_id='evt_expired'",
      )).rows,
    ).toHaveLength(0);
    await db.exec(
      `reset role;update public.billing_customers set closed_at=now() where user_id='${A}';delete from auth.users where id='${A}';`,
    );
    expect((await db.query("select * from public.billing_customers")).rows)
      .toHaveLength(1);
    await db.exec("set role anon;");
    expect((await ent()).features.juzAmma).toBe(true);
    await expect(db.query("select * from public.billing_subscriptions")).rejects
      .toThrow();
  } finally {
    await db.close();
  }
});
