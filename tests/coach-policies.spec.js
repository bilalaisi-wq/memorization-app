import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002";
test("Coach subscriptions, flags, cache, concurrent quota, owner isolation, expiration and deletion are server authoritative", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`,
    );
    for (
      const f of [
        "20261022_billing.sql",
        "20261026_recitation_ai.sql",
        "20261027_hifz_coach.sql",
      ]
    ) {
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + f, import.meta.url),
          "utf8",
        ),
      );
    }
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261027_hifz_coach.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('${A}'),('${B}');insert into public.billing_customers(user_id,mode,stripe_customer_id)values('${A}','test','cus_A');insert into public.billing_subscriptions(user_id,mode,stripe_subscription_id,plan,status,price_id,access_until)values('${A}','test','sub_A','pathfinder','active','price_A',now()+interval '1 day');update public.billing_config set ai_enabled=true;update public.hifz_coach_config set enabled=true,privacy_reviewed=true,pathfinder_monthly=1;`,
    );
    const access = async () =>
      (await db.query(`select public.hifz_coach_access('${A}') v`)).rows[0].v;
    expect((await access()).enabled).toBe(false);
    await db.exec(
      `insert into public.recitation_adult_pilot(user_id,approved_by,policy_version)values('${A}','Reviewed adult','adult-pilot-2026-10-v1');`,
    );
    expect((await access()).enabled).toBe(true);
    const id = crypto.randomUUID(),
      hash = "a".repeat(64),
      other = "b".repeat(64);
    const reservation = await Promise.allSettled([
      db.query(`select public.reserve_hifz_coach('${A}','${hash}','${id}')`),
      db.query(
        `select public.reserve_hifz_coach('${A}','${other}','${crypto.randomUUID()}')`,
      ),
    ]);
    expect(reservation.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await access()).used).toBe(1);
    await db.query(
      `select public.finish_hifz_coach('${A}','${id}','${hash}','{"focus":"weak","newCap":0,"goalAdvice":"reduce","breakStyle":"short"}','{"model":"fixture"}')`,
    );
    expect(
      (await db.query(
        `select public.reserve_hifz_coach('${A}','${hash}','${crypto.randomUUID()}') v`,
      )).rows[0].v.cached,
    ).toBe(true);
    await expect(
      db.query(
        `select public.reserve_hifz_coach('${A}','${other}','${crypto.randomUUID()}')`,
      ),
    ).rejects.toThrow();
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${B}';`);
    for (
      const q of [
        "select * from public.hifz_coach_cache",
        "update public.hifz_coach_usage set used=0",
        `select public.hifz_coach_access('${A}')`,
        `select public.reserve_hifz_coach('${A}','${hash}','${crypto.randomUUID()}')`,
      ]
    ) await expect(db.query(q)).rejects.toThrow();
    await db.query("select public.delete_my_hifz_coach_cache()");
    await db.exec("reset role");
    expect(
      (await db.query("select count(*)::int n from public.hifz_coach_cache"))
        .rows[0].n,
    ).toBe(1);
    await db.exec(
      `update public.billing_subscriptions set access_until=now()-interval '1 second';`,
    );
    expect((await access()).enabled).toBe(false);
    await expect(
      db.query(
        `select public.reserve_hifz_coach('${A}','${hash}','${crypto.randomUUID()}')`,
      ),
    ).rejects.toThrow();
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);
    await db.query("select public.delete_my_hifz_coach_cache()");
    await db.exec("reset role");
    expect(
      (await db.query("select count(*)::int n from public.hifz_coach_cache"))
        .rows[0].n,
    ).toBe(0);
    expect((await access()).used).toBe(1);
    // An in-flight response cannot restore deleted cache.
    await db.exec(
      `update public.hifz_coach_usage set request_id='${id}';set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    await db.query("select public.delete_my_hifz_coach_cache()");
    await db.exec("reset role");
    await db.query(
      `select public.finish_hifz_coach('${A}','${id}','${hash}','{}','{}')`,
    );
    expect(
      (await db.query("select count(*)::int n from public.hifz_coach_cache"))
        .rows[0].n,
    ).toBe(0);
  } finally {
    await db.close();
  }
});
