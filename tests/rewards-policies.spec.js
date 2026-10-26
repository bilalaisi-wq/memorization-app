import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002";
test("Every-mode receipts publish automatically after opt-in; inventory spending, ownership and private photos remain isolated", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;`,
    );
    await db.exec(
      readFileSync(
        new URL("../supabase/SETUP_ACCOUNTS.sql", import.meta.url),
        "utf8",
      ),
    );
    const sql = readFileSync(
      new URL(
        "../supabase/SETUP_REWARDS_SHOP.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    const verification = (await db.query(
      readFileSync(
        new URL("../supabase/VERIFY_REWARDS_SHOP.sql", import.meta.url),
        "utf8",
      ),
    )).rows[0];
    expect(verification.catalog_items).toBe(13);
    expect(verification.reward_rls_enabled).toBe(true);
    expect(verification.profile_rls_enabled).toBe(true);
    expect(verification.catalog_rls_enabled).toBe(true);
    expect(verification.direct_reward_insert_allowed).toBe(false);
    expect(verification.direct_wallet_update_allowed).toBe(false);
    expect(verification.direct_price_update_allowed).toBe(false);
    expect(verification.authenticated_sync_allowed).toBe(true);
    await db.exec(
      `insert into auth.users values('${A}'),('${B}');set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    await db.query("select public.set_leaderboard_preference(true,'Cedar42')");
    const modes = [
      "practice",
      "quest",
      "recall-puzzle",
      "active-recall",
      "lab",
      "chain",
      "passage",
      "passage-recall",
    ];
    const events = modes.map((mode, i) => ({
      id: String(i + 1).repeat(64),
      at: new Date(Date.now() - 30000).toISOString(),
      mode,
      xp: 20,
      stars: 1,
      recalls: mode === "active-recall" ? 1 : 0,
    }));
    let p = (await db.query("select public.sync_learning_rewards($1,0) p", [
      JSON.stringify(events),
    ])).rows[0].p;
    expect(p.balance).toBe(200);
    p = (await db.query("select public.sync_learning_rewards($1,0) p", [
      JSON.stringify(events),
    ])).rows[0].p;
    expect(p.balance).toBe(200);
    const leaderboard =
      (await db.query("select * from public.get_weekly_leaderboard()")).rows;
    expect(leaderboard[0].xp).toBe(160);
    expect(leaderboard[0].stars).toBe(8);
    await expect(db.query("select public.equip_nature_item('fox')")).rejects
      .toThrow();
    await expect(db.query("select public.buy_nature_item('fox',0)")).rejects
      .toThrow();
    const buys = await Promise.allSettled([
      db.query("select public.buy_nature_item('fox') p"),
      db.query("select public.buy_nature_item('turtle') p"),
    ]);
    expect(buys.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    p = (await db.query("select public.my_nature_profile() p")).rows[0].p;
    expect(p.balance).toBeGreaterThanOrEqual(0);
    expect(p.owned.includes("fox")).toBe(true);
    await db.query("select public.buy_nature_item('fox')");
    expect(
      (await db.query("select public.my_nature_profile() p")).rows[0].p.spent,
    ).toBe(120);
    await db.query("select public.equip_nature_item('fox')");
    await db.query(
      "select public.set_my_profile_photo('data:image/jpeg;base64,YQ==')",
    );
    expect(
      JSON.stringify(
        (await db.query("select * from public.get_weekly_leaderboard()")).rows,
      ),
    ).not.toContain("base64");
    expect(
      (await db.query("select * from public.get_weekly_leaderboard()")).rows[0]
        .avatar.creature,
    ).toBe("fox");
    for (
      const q of [
        "update public.nature_profiles set spent=0",
        "select * from public.learning_reward_events",
        "update public.avatar_catalog set price=0",
        "select public.set_my_profile_photo('https://evil.test/photo.jpg')",
      ]
    ) await expect(db.query(q)).rejects.toThrow();
    await expect(
      db.query("select public.sync_learning_rewards($1,0)", [
        JSON.stringify([{ ...events[0], xp: 99 }]),
      ]),
    ).rejects.toThrow();
    const legacyAttempt =
      (await db.query("select public.sync_learning_rewards($1,500,500,0) p", [
        "[]",
      ])).rows[0].p;
    expect(legacyAttempt.balance).toBe(80);
    expect(legacyAttempt.lifetimeXp).toBe(160);
    await db.exec(`set request.jwt.claim.sub='${B}';`);
    await expect(db.query("select public.my_nature_profile($1)", [A])).rejects
      .toThrow();
    await expect(
      db.query("select public.sync_learning_rewards($1,0,0,0,$2)", ["[]", A]),
    ).rejects.toThrow();

    expect(
      (await db.query("select public.my_nature_profile() p")).rows[0].p.balance,
    ).toBe(0);
    await expect(db.query("select public.equip_nature_item('fox')")).rejects
      .toThrow();
    await db.exec(`set request.jwt.claim.sub='${A}';`);
    await db.query("select public.set_leaderboard_preference(false,null)");
    expect(
      (await db.query("select * from public.get_weekly_leaderboard()")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select public.my_nature_profile() p")).rows[0].p.owned,
    ).toContain("fox");
  } finally {
    await db.close();
  }
});
