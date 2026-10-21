import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { draftSegments } from "../supabase/functions/_shared/segmentation.js";
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002";
test("only assigned qualified reviewers can append source-bound decisions; progress/storage remain private", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert on storage.objects to anon,authenticated;create policy broad_fixture_policy on storage.objects for all to anon,authenticated using(true) with check(true);`,
    );
    for (
      const f of [
        "20261023_passage_content.sql",
        "20261024_segmentation_review.sql",
        "20261025_review_sources.sql",
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
          "../supabase/migrations/20261024_segmentation_review.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('${A}'),('${B}');insert into storage.objects values(gen_random_uuid(),'quran-premium'),(gen_random_uuid(),'other');set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    await expect(
      db.query(
        "select public.submit_segmentation_review('2:282',0,'x','edition','Hafs','[]')",
      ),
    ).rejects.toThrow("Qualified");
    await expect(db.query("select * from public.quran_review_versions")).rejects
      .toThrow();
    await expect(
      db.query(
        `insert into public.quran_reviewers values('${A}','Fake','Fake','scholar',true)`,
      ),
    ).rejects.toThrow();
    expect((await db.query("select bucket_id from storage.objects")).rows)
      .toEqual([{ bucket_id: "other" }]);
    await expect(
      db.query(
        "insert into storage.objects values(gen_random_uuid(),'quran-premium')",
      ),
    ).rejects.toThrow();
    await db.exec(
      `reset role;insert into public.quran_reviewers values('${A}','Fixture teacher','Verified qualification fixture','teacher',true);set role authenticated;set request.jwt.claim.sub='${A}';`,
    );
    const data =
        (await db.query("select public.get_segmentation_review('2:282') d"))
          .rows[0].d,
      hash = data.head.source_hash;
    const bundle = JSON.parse(
        readFileSync(new URL("./fixtures/2-282.json", import.meta.url)),
      ),
      draft = draftSegments(bundle);
    const rows = draft.segments.map((s) =>
      Object.fromEntries(
        Object.entries(s).filter(([k]) =>
          [
            "id",
            "startWord",
            "endWord",
            "displayStatus",
            "stopStatus",
            "restartWord",
            "pauseMark",
            "boundaryType",
            "topic",
          ].includes(k)
        ),
      )
    );
    const submit = (segments, rev = 0, source = hash) =>
      db.query(
        "select public.submit_segmentation_review($1,$2,$3,$4,$5,$6) v",
        [
          "2:282",
          rev,
          source,
          "Test source edition",
          "Hafs an Asim",
          JSON.stringify(segments),
        ],
      );
    await expect(submit(rows, 0, "wrong")).rejects.toThrow("hash differs");
    await expect(submit([{ ...rows[0], startWord: 2 }, ...rows.slice(1)]))
      .rejects.toThrow("gap");
    const bad = structuredClone(rows);
    bad[0].stopStatus = "approved";
    await expect(submit(bad)).rejects.toThrow("restart");
    bad[0].restartWord = 8;
    bad[0].audioApproved = true;
    await expect(submit(bad)).rejects.toThrow("audio");
    expect((await submit(rows)).rows[0].v).toBe(1);
    await expect(submit(rows)).rejects.toThrow("Another reviewer");
    const changed = structuredClone(rows);
    changed[0].endWord = 9;
    changed[1].startWord = 10;
    changed[0].displayStatus = "approved";
    expect((await submit(changed, 1)).rows[0].v).toBe(2);
    const history =
      (await db.query("select public.get_segmentation_review('2:282') d"))
        .rows[0].d.history;
    expect(history).toHaveLength(2);
    expect(history[1].segments[0].endWord).toBe(10);
    expect(history[0].reviewer_name).toBe("Fixture teacher");
    await db.exec(`set request.jwt.claim.sub='${B}';`);
    await expect(submit(rows, 2)).rejects.toThrow("Qualified");
    const doc = JSON.stringify({ version: 1, records: {}, active: null });
    expect(
      (await db.query("select public.save_my_passage_learning(0,$1) r", [doc]))
        .rows[0].r,
    ).toBe(1);
    await expect(
      db.query("select public.save_my_passage_learning(0,$1)", [doc]),
    ).rejects.toThrow("Another device");
    await db.exec(`set request.jwt.claim.sub='${A}';`);
    expect((await db.query("select * from public.passage_learning")).rows)
      .toHaveLength(0);
    await expect(db.query("update public.passage_learning set revision=99"))
      .rejects.toThrow();
  } finally {
    await db.close();
  }
});
