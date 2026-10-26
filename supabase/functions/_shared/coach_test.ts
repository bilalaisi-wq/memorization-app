import { coachHandler } from "./coach-handler.ts";
import { COACH_CONSENT } from "./coach-core.js";
const assert = (x: unknown, m = "Assertion failed") => {
  if (!x) throw Error(m);
};
Deno.env.set("OPENAI_API_KEY", "test-secret");
Deno.env.set("BILLING_SITE_URL", "https://ayah.test");
const summary = {
  minutes: 10,
  days: 5,
  reviewCost: 2,
  tracked: 10,
  retained: 3,
  independent: 4,
  assisted: 1,
  due: 8,
  weak: 3,
  repeated: 2,
  transitions: 1,
  recentMistakes: 2,
  newAvailable: 500,
  aim: "daily",
  confidence: "shaky",
  futureDue: [8, 1, 0, 0, 0, 0, 0],
  inconsistent: false,
};
const advice = {
  focus: "weak",
  newCap: 0,
  goalAdvice: "reduce",
  breakStyle: "spaced",
};
function fixture() {
  const f: any = {
    enabled: true,
    verified: true,
    used: 0,
    allowance: 2,
    calls: 0,
    cache: new Map(),
    pending: false,
    error: false,
    unsafe: false,
    logs: [],
  };
  const admin: any = {
    auth: {
      getUser: async () => ({
        data: {
          user: f.verified ? { id: "A", email_confirmed_at: "yes" } : null,
        },
      }),
    },
    rpc: async (name: string, args: any) => {
      assert(args.p_user === "A");
      if (name === "hifz_coach_access") return { data: { enabled: f.enabled } };
      if (name === "reserve_hifz_coach") {
        const cached = f.cache.get(args.p_fingerprint);
        if (cached) {
          return {
            data: {
              cached: true,
              ...cached,
              usage: { used: f.used, allowance: f.allowance },
            },
          };
        }
        if (f.pending || f.used >= f.allowance) {
          return {
            error: { code: "P0001" },
          };
        }
        f.pending = true;
        f.used++;
        return {
          data: {
            cached: false,
            usage: { used: f.used, allowance: f.allowance },
          },
        };
      }
      if (name === "finish_hifz_coach") {
        f.pending = false;
        f.logs.push(args);
        if (args.p_advice) {
          f.cache.set(args.p_fingerprint, {
            advice: args.p_advice,
            metadata: args.p_metadata,
          });
        }
        return {};
      }
      throw Error(name);
    },
  };
  f.handler = coachHandler(
    {
      factory: () => admin,
      provider: async (_url: any, options: any) => {
        f.calls++;
        const body = JSON.parse(options.body);
        assert(body.model === "gpt-4o-mini");
        assert(options.headers.authorization === "Bearer test-secret");
        assert(body.response_format.json_schema.strict === true);
        const sent = JSON.parse(body.messages[1].content);
        assert(!JSON.stringify(sent).includes("1:1"));
        assert(!("records" in sent));
        if (f.error) throw Error("private provider details");
        return new Response(
          JSON.stringify({
            model: "gpt-4o-mini-test",
            choices: [{
              message: {
                content: JSON.stringify(
                  f.unsafe ? { ...advice, tafsir: "unreviewed claim" } : advice,
                ),
              },
            }],
          }),
        );
      },
    } as any,
  );
  return f;
}
function req(body: any = { summary, consent: COACH_CONSENT }, token = true) {
  return new Request("https://edge.test/hifz-coach", {
    method: "POST",
    headers: {
      origin: "https://ayah.test",
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer x" } : {}),
    },
    body: JSON.stringify(body),
  });
}
Deno.test("Coach verifies auth, entitlement/adult gate, consent and strict aggregates before provider or quota", async () => {
  const f = fixture();
  assert((await f.handler(req(undefined, false))).status === 401);
  f.verified = false;
  assert((await f.handler(req())).status === 401);
  f.verified = true;
  f.enabled = false;
  assert((await f.handler(req())).status === 403);
  f.enabled = true;
  for (
    const body of [
      { summary, consent: "no" },
      {
        summary: { ...summary, quran: "injected text" },
        consent: COACH_CONSENT,
      },
      { summary: { ...summary, retained: 100 }, consent: COACH_CONSENT },
      { summary, consent: COACH_CONSENT, plan: "guardian" },
    ]
  ) assert((await f.handler(req(body))).status === 400);
  assert(f.used === 0 && f.calls === 0);
});
Deno.test("Identical daily summaries are cached per account; concurrent and changed summaries cannot bypass allowance", async () => {
  const f = fixture(), a = await f.handler(req());
  assert(a.status === 200);
  const first = await a.json();
  assert(first.cached === false && f.calls === 1);
  const second = await (await f.handler(req())).json();
  assert(second.cached === true && f.calls === 1 && f.used === 1);
  f.cache.clear();
  const results = await Promise.all([
    f.handler(req()),
    f.handler(
      req({ summary: { ...summary, minutes: 15 }, consent: COACH_CONSENT }),
    ),
  ]);
  assert(results.filter((x) => x.status === 200).length === 1);
  assert(f.used === 2 && f.calls === 2);
  assert(
    (await f.handler(
      req({ summary: { ...summary, minutes: 20 }, consent: COACH_CONSENT }),
    )).status === 429,
  );
  f.enabled = false;
  assert((await f.handler(req())).status === 403);
  assert(
    !JSON.stringify(f.logs).includes("records") &&
      !JSON.stringify(f.logs).includes("test-secret"),
  );
});
Deno.test("Provider failures and invented religious/freeform outputs fail closed, consume reservation and never retry", async () => {
  const f = fixture();
  f.error = true;
  assert((await f.handler(req())).status === 503);
  assert(f.calls === 1 && f.used === 1);
  f.error = false;
  f.unsafe = true;
  const bad = await f.handler(req());
  assert(bad.status === 503);
  assert(!(await bad.text()).includes("unreviewed claim"));
  assert(f.cache.size === 0 && f.calls === 2);
});
Deno.test("Coach rejects oversized and cross-origin requests without AI", async () => {
  const f = fixture();
  assert(
    (await f.handler(
      new Request("https://edge.test/", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
    )).status === 403,
  );
  const large = await f.handler(
    req({ summary, consent: COACH_CONSENT, extra: "x".repeat(9000) }),
  );
  assert(large.status === 400 && f.used === 0);
});

Deno.test("Missing provider configuration consumes no allowance and preserves local fallback", async () => {
  const key = Deno.env.get("OPENAI_API_KEY");
  Deno.env.delete("OPENAI_API_KEY");
  try {
    const f = fixture();
    assert((await f.handler(req())).status === 503);
    assert(f.used === 0 && f.calls === 0);
  } finally {
    if (key) Deno.env.set("OPENAI_API_KEY", key);
  }
});
