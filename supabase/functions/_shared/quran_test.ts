import { quranHandler } from "./quran-handler.ts";
const assert = (ok: unknown, message = "Assertion failed") => {
  if (!ok) throw Error(message);
};
const bytes = await Deno.readFile(
  new URL("../../../tests/fixtures/2-282.json", import.meta.url),
);
Deno.env.set("BILLING_SITE_URL", "https://ayah.example.test");
Deno.test("private Quran requests require verified identity and server-derived juz entitlements; never accept a client plan/path/customer", async () => {
  let authenticated = true,
    ent: any = { plan: "free", selectedJuz: [], features: {} },
    reads = 0,
    owner = "";
  const admin: any = {
    auth: {
      getUser: async (token: string) =>
        authenticated && token === "verified-B"
          ? { data: { user: { id: "B", email_confirmed_at: "2026-01-01" } } }
          : { error: true, data: {} },
    },
    rpc: async (_name: string, args: any) => {
      owner = args.p_user;
      return { data: ent };
    },
    storage: {
      from: (bucket: string) => {
        assert(bucket === "quran-premium");
        return {
          download: async (path: string) => {
            reads++;
            assert(path === "2/282/bundle.json" || path === "2/282/full.mp3");
            return { data: new Blob([bytes]) };
          },
        };
      },
    },
  };
  const handler = quranHandler(() => admin);
  const req = (body: any, token = "verified-B") =>
    new Request("https://api.example.test/functions/v1/quran-content", {
      method: "POST",
      headers: {
        origin: "https://ayah.example.test",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
  assert(
    (await handler(req({ key: "2:282", asset: "bundle" }, ""))).status === 401,
  );
  assert(
    (await handler(
      req({
        key: "2:282",
        asset: "bundle",
        plan: "guardian",
        juz: 30,
        user: "A",
        path: "../secret",
      }),
    )).status === 403,
  );
  assert(reads === 0);
  assert(owner === "B");
  ent = { plan: "explorer", selectedJuz: [29], features: {} };
  assert(
    (await handler(req({ key: "2:282", asset: "bundle" }))).status === 403,
  );
  ent = { plan: "explorer", selectedJuz: [3], features: {} };
  const good = await handler(req({ key: "2:282", asset: "bundle" }));
  assert(good.status === 200);
  assert((await good.json()).key === "2:282");
  assert(good.headers.get("cache-control") === "private, no-store");
  authenticated = false;
  assert((await handler(req({ key: "2:282", asset: "audio" }))).status === 401);
  authenticated = true;
  assert(
    (await handler(req({ key: "2:283", asset: "bundle" }))).status === 404,
  );
  assert(
    (await handler(req({ key: "2:282", asset: "../../secret" }))).status ===
      400,
  );
  // Bundle bytes cannot be passed off as audio; every asset has its own digest.
  assert((await handler(req({ key: "2:282", asset: "audio" }))).status === 503);
});
Deno.test("private object corruption fails closed even for Pathfinder; expired plans cannot download again", async () => {
  let ent: any = { plan: "pathfinder", features: { allQuran: true } };
  const admin: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "A", email_confirmed_at: "2026-01-01" } },
      }),
    },
    rpc: async () => ({ data: ent }),
    storage: {
      from: () => ({ download: async () => ({ data: new Blob(["corrupt"]) }) }),
    },
  };
  const handler = quranHandler(() => admin),
    req = () =>
      new Request("https://api.example.test", {
        method: "POST",
        headers: { authorization: "Bearer verified" },
        body: JSON.stringify({ key: "2:282", asset: "bundle" }),
      });
  assert((await handler(req())).status === 503);
  ent = { plan: "free", features: {} };
  assert((await handler(req())).status === 403);
});

Deno.test("staff access and reviewed stop metadata come only from the server; canonical text is untouched", async () => {
  const { draftSegments } = await import("./segmentation.js");
  const source = JSON.parse(new TextDecoder().decode(bytes));
  const proposal = draftSegments(source)!;
  const rows: any[] = proposal.segments.map((s) => ({ ...s }));
  rows[0].stopStatus = "approved";
  rows[0].restartWord = 11;
  let staff = false;
  const queries: string[] = [];
  const admin: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "teacher", email_confirmed_at: "2026-01-01" } },
      }),
    },
    rpc: async (name: string) => ({
      data: name === "is_quran_reviewer"
        ? staff
        : { plan: "free", features: {} },
    }),
    storage: {
      from: () => ({ download: async () => ({ data: new Blob([bytes]) }) }),
    },
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: (key: string) => {
          queries.push(key);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: {
            version: 1,
            source_edition: "TEST FIXTURE",
            riwayah: "Hafs",
            reviewer_name: "TEST ONLY",
            reviewed_at: "2026-01-01",
            segments: rows,
          },
        }),
      };
      return chain;
    },
  };
  const handler = quranHandler(() => admin),
    req = () =>
      new Request("https://api.example.test", {
        method: "POST",
        headers: { authorization: "Bearer teacher" },
        body: JSON.stringify({ key: "2:282", asset: "bundle", reviewer: true }),
      });
  assert((await handler(req())).status === 403);
  staff = true;
  const response = await handler(req());
  assert(response.status === 200);
  const result = await response.json();
  assert(result.textUthmani === source.textUthmani);
  assert(result.segments.length === 2);
  assert(result.segments[1].review.status === "approved");
  assert(!result.segments[1].audioReview);
  assert(queries.includes("source_hash"));
});
