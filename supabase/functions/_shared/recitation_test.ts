import { recitationHandler } from "./recitation-handler.ts";
import { POLICY_VERSION } from "./recitation-core.js";
const assert = (value: unknown, message = "Assertion failed") => {
  if (!value) throw Error(message);
};
Deno.env.set("OPENAI_API_KEY", "test-only-secret");
Deno.env.set("BILLING_SITE_URL", "https://ayah.example.test");
function fixture() {
  const f: any = {
    verified: true,
    enabled: true,
    ai: true,
    quota: 2,
    used: 0,
    calls: 0,
    rows: [],
    seen: new Set(),
    providerError: false,
    quality: false,
  };
  const admin: any = {
    auth: {
      getUser: async () => ({
        data: {
          user: f.verified
            ? { id: "owner-A", email_confirmed_at: "yes" }
            : null,
        },
        error: null,
      }),
    },
    rpc: async (name: string, args: any) => {
      assert(args.p_user === "owner-A", "never accept client owner");
      if (name === "recitation_ai_access") {
        return { data: { enabled: f.enabled }, error: null };
      }
      if (name === "billing_entitlements_for") {
        return {
          data: { features: { ai: f.ai }, plan: "pathfinder" },
          error: null,
        };
      }
      if (name === "reserve_recitation_ai") {
        if (f.seen.has(args.p_request)) return { error: { code: "23505" } };
        if (f.used >= f.quota) return { error: { code: "P0001" } };
        f.used++;
        f.seen.add(args.p_request);
        return { data: { used: f.used, allowance: f.quota }, error: null };
      }
      throw Error(name);
    },
    from: (table: string) => ({
      update: (data: any) => {
        assert(table === "recitation_ai_requests");
        const query: any = {
          eq: (field: string, value: string) => {
            if (field === "user_id") assert(value === "owner-A");
            return query;
          },
          is: async (field: string, value: unknown) => {
            assert(field === "deleted_at" && value === null);
            if (!f.deleted) f.rows.push(data);
            return { error: null };
          },
        };
        return query;
      },
    }),
  };
  f.handler = recitationHandler(
    {
      factory: () => admin,
      provider: async (_url: any, options: any) => {
        f.calls++;
        assert(options.headers.authorization === "Bearer test-only-secret");
        assert(
          !options.body.has("prompt"),
          "reference must not prime transcription",
        );
        assert(options.body.get("language") === "ar");
        assert(options.body.get("model") === "whisper-1");
        if (f.beforeResult) await f.beforeResult();
        if (f.providerError) {
          throw Error("private provider error");
        }
        return new Response(
          JSON.stringify({
            text: "بسم الله الرحمن الرحيم",
            duration: 3,
            segments: [{
              avg_logprob: f.quality ? -2 : -0.1,
              no_speech_prob: 0.01,
              compression_ratio: 1,
            }],
          }),
        );
      },
    } as any,
  );
  return f;
}
function request(
  {
    id = crypto.randomUUID(),
    token = true,
    extra = false,
    bad = false,
    consent = POLICY_VERSION,
    key = "1:1",
  } = {},
) {
  const form = new FormData();
  form.set("reference", key);
  form.set("requestId", id);
  form.set("consent", consent);
  form.set(
    "audio",
    new Blob([bad ? "fake" : Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 1])], {
      type: "audio/webm",
    }),
    "a.webm",
  );
  if (extra) form.set("plan", "guardian");
  return new Request("https://edge.test/recitation-compare", {
    method: "POST",
    headers: {
      origin: "https://ayah.example.test",
      ...(token ? { authorization: "Bearer token" } : {}),
    },
    body: form,
  });
}
Deno.test("AI endpoint enforces identity, adult pilot/flags, consent, real references, types and entitlement before quota/provider", async () => {
  const f = fixture();
  assert((await f.handler(request({ token: false }))).status === 401);
  f.verified = false;
  assert((await f.handler(request())).status === 401);
  f.verified = true;
  f.enabled = false;
  assert((await f.handler(request())).status === 403);
  f.enabled = true;
  for (
    const options of [{ extra: true }, { consent: "child" }, { key: "2:999" }, {
      bad: true,
    }]
  ) assert((await f.handler(request(options))).status >= 400);
  f.ai = false;
  assert((await f.handler(request())).status === 403);
  f.ai = true;
  assert((await f.handler(request({ key: "67:1" }))).status === 403);
  assert(f.used === 0 && f.calls === 0);
});
Deno.test("Atomic reservation and request idempotence bound concurrent provider calls; no raw audio/transcript metadata", async () => {
  const f = fixture(), id = crypto.randomUUID();
  const responses = await Promise.all([
    f.handler(request({ id })),
    f.handler(request({ id })),
    f.handler(request()),
    f.handler(request()),
  ]);
  assert(responses.filter((r) => r.status === 200).length === 2);
  assert(f.used === 2 && f.calls === 2);
  const result = await responses.find((r) => r.status === 200)!.json();
  assert(
    result.comparison.status === "experimental_comparison" &&
      result.comparison.differences.length === 0,
  );
  assert(result.verifiedText.includes("ٱللَّهِ"));
  assert(
    result.metadata.evaluated === false &&
      result.metadata.model === "whisper-1",
  );
  const stored = JSON.stringify(f.rows);
  assert(
    !stored.includes("بسم") && !stored.includes("blob") &&
      !stored.includes("test-only-secret"),
  );
});
Deno.test("Weak provider evidence abstains; errors use no retries and retain reservation without leaking detail", async () => {
  const f = fixture();
  f.quality = true;
  const weak = await (await f.handler(request())).json();
  assert(weak.comparison.status === "could_not_assess");
  f.providerError = true;
  const failed = await f.handler(request());
  assert(failed.status === 503);
  const error = await failed.text();
  assert(
    !error.includes("private provider error") && !error.includes("secret"),
  );
  assert(f.calls === 2 && f.used === 2);
});
Deno.test("Cross-origin and oversized uploads reject without provider calls", async () => {
  const f = fixture();
  assert(
    (await f.handler(
      new Request("https://edge.test/", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
    )).status === 403,
  );
  const req = new Request("https://edge.test/", {
    method: "POST",
    headers: {
      authorization: "Bearer token",
      "content-type": "multipart/form-data; boundary=x",
      "content-length": String(10 * 1024 * 1024),
    },
    body: "x",
  });
  assert((await f.handler(req)).status === 413);
  assert(f.calls === 0 && f.used === 0);
});

Deno.test("Deleting while processing cannot restore analysis metadata or refund usage", async () => {
  const f = fixture();
  f.beforeResult = () => {
    f.deleted = true;
  };
  const response = await f.handler(request());
  assert(response.status === 200);
  assert(f.rows.length === 0 && f.used === 1 && f.calls === 1);
});
