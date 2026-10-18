import { test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
test("database policies isolate accounts and enforce opt-in, redaction, score caps and deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;`,
    );
    const setup = readFileSync(
      new URL("../supabase/SETUP_ACCOUNTS.sql", import.meta.url),
      "utf8",
    );
    await db.exec(setup);
    await db.exec(setup); // An existing project can safely rerun the supplied dashboard script.
    const a = "00000000-0000-0000-0000-000000000001",
      b = "00000000-0000-0000-0000-000000000002";
    await db.query("insert into auth.users values ($1),($2)", [a, b]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
    await db.query(
      "insert into public.learner_progress(user_id,payload) values ($1,$2)",
      [a, JSON.stringify({ "ayah-goals-v1": "{}" })],
    );
    const progressDoc = JSON.stringify({ "ayah-goals-v1": '{"version":1}' });
    assert.equal(
      (
        await db.query("select public.save_my_progress($1,$2,$3) as revision", [
          a,
          1,
          progressDoc,
        ])
      ).rows[0].revision,
      2,
    );
    await assert.rejects(
      db.query("select public.save_my_progress($1,$2,$3)", [a, 1, progressDoc]),
      (error) => error.code === "40001",
    );
    await assert.rejects(
      db.query("select public.save_my_progress($1,$2,$3)", [b, 0, progressDoc]),
      (error) => error.code === "42501",
    );
    await assert.rejects(
      db.query("select public.save_my_progress($1,$2,$3)", [
        a,
        2,
        JSON.stringify({ recording: "never upload" }),
      ]),
    );
    await assert.rejects(
      db.query(
        "insert into public.learner_progress(user_id,payload) values ($1,$2)",
        [b, "{}"],
      ),
    );
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${b}';`,
    );
    assert.equal(
      (await db.query("select * from public.learner_progress")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update public.learner_progress set payload=$1 where user_id=$2 returning user_id",
          [JSON.stringify({ stolen: true }), a],
        )
      ).rows.length,
      0,
    );
    await db.query(
      "insert into public.learner_progress(user_id,payload) values ($1,$2)",
      [b, "{}"],
    );
    await assert.rejects(
      db.query(
        "insert into public.learner_progress(user_id,payload) values ($1,$2)",
        [a, "{}"],
      ),
    );
    await assert.rejects(
      db.query("select public.publish_weekly_activity($1)", [
        JSON.stringify({ records: {} }),
      ]),
    );
    await db.query("select public.set_leaderboard_preference($1,$2)", [
      true,
      "Cedar42",
    ]);
    const now = new Date().toISOString();
    const history = {
      records: {
        "1:1": {
          game: { history: [{ at: now, xp: 999999, stars: 9999 }] },
          memory: {
            history: [{ at: now, independent: true, reward: { xp: 12 } }],
          },
        },
      },
    };
    await db.query("select public.publish_weekly_activity($1)", [
      JSON.stringify(history),
    ]);
    let rows = (await db.query("select * from public.get_weekly_leaderboard()"))
      .rows;
    await db.query("select public.publish_weekly_activity($1)", [
      JSON.stringify(history),
    ]);
    assert.equal(
      (await db.query("select * from public.get_weekly_leaderboard()")).rows[0]
        .xp,
      1000,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].alias, "Cedar42");
    assert.equal(rows[0].xp, 1000);
    assert.equal(rows[0].stars, 50);
    assert.equal(rows[0].recalls, 1);
    assert.deepEqual(
      Object.keys(rows[0]).sort(),
      ["alias", "xp", "stars", "recalls"].sort(),
    );
    await db.exec("reset role;set role anon;");
    assert.equal(
      (await db.query("select * from public.get_weekly_leaderboard()")).rows
        .length,
      1,
    );
    await assert.rejects(db.query("select * from public.learner_progress"));
    await assert.rejects(
      db.query("select * from public.leaderboard_preferences"),
    );
    await assert.rejects(db.query("select public.delete_my_account()"));
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${b}';`,
    );
    await db.query("select public.set_leaderboard_preference($1,$2)", [
      false,
      null,
    ]);
    assert.equal(
      (await db.query("select * from public.get_weekly_leaderboard()")).rows
        .length,
      0,
    );
    await db.query("select public.delete_my_account()");
    await db.exec("reset role;");
    assert.deepEqual(
      (await db.query("select id from auth.users")).rows.map((r) => r.id),
      [a],
    );
    assert.deepEqual(
      (await db.query("select user_id from public.learner_progress")).rows.map(
        (r) => r.user_id,
      ),
      [a],
    );
  } finally {
    await db.close();
  }
});
