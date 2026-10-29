// Real HTTP wrappers + official Stripe/Supabase SDKs, with network replaced by
// explicit local fixtures. These tests require no live keys and cannot use net.
const assert = {
  equal(actual: unknown, expected: unknown) {
    if (!Object.is(actual, expected)) {
      throw new Error(
        `Expected ${JSON.stringify(expected)}, received ${
          JSON.stringify(actual)
        }`,
      );
    }
  },
  ok(value: unknown) {
    if (!value) throw new Error("Assertion failed");
  },
};
import { protectedEndpoint, Stripe } from "./runtime.ts";
import {
  checkout,
  closeBilling,
  passages,
  portal,
  refresh,
} from "./actions.ts";
import { webhookHandler } from "./webhook.ts";
const A = "00000000-0000-0000-0000-000000000001";
const fixtureEnv = {
  STRIPE_MODE: "test",
  STRIPE_SECRET_KEY: "sk_test_fixture_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture_not_a_real_secret",
  SUPABASE_URL: "https://billing.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-not-a-real-service-role",
  BILLING_SITE_URL: "https://ayah.example.test",
  STRIPE_EXPLORER_MONTHLY_PRICE_ID: "price_e",
  STRIPE_PATHFINDER_MONTHLY_PRICE_ID: "price_p",
};
for (const [key, value] of Object.entries(fixtureEnv)) Deno.env.set(key, value);
function request(
  path: string,
  body: unknown = {},
  token = "verified-A",
  origin = "https://ayah.example.test",
) {
  return new Request(`https://billing.example.test/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function fixture(fn: (calls: any[], state: any) => Promise<void>) {
  const original = globalThis.fetch, calls: any[] = [];
  const state: any = {
    pending: null,
    failCheckoutWrite: false,
    pendingWrites: 0,
    ent: { plan: "explorer", features: { passageBuilder: true } },
    subscriptions: [],
    user: A,
  };
  globalThis.fetch = async (input: any, init: any = {}) => {
    const url = new URL(
      typeof input === "string" ? input : input.url || String(input),
    );
    const method = init.method || "GET",
      headers = new Headers(init.headers),
      raw = typeof init.body === "string" ? init.body : "";
    calls.push({
      url: url.href,
      path: url.pathname,
      method,
      raw,
      headers,
      query: url.searchParams,
    });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      });
    const path = url.pathname;
    if (path === "/auth/v1/user") {
      return headers.get("authorization") === "Bearer verified-A"
        ? json({
          id: state.user,
          email: "fixture@example.test",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          is_anonymous: false,
        })
        : json({ message: "Invalid token" }, 401);
    }
    if (path === "/rest/v1/billing_config") {
      return json({
        stripe_mode: "test",
        checkout_enabled: true,
        guardian_enabled: false,
      });
    }
    if (path === "/rest/v1/billing_customers") {
      return json({
        stripe_customer_id: "cus_A",
        closed_at: state.closed ? "2026-01-01T00:00:00Z" : null,
      });
    }
    if (path === "/rest/v1/rpc/billing_acquire_lock") return json(true);
    if (path === "/rest/v1/rpc/billing_release_lock") return json(null);
    if (path === "/rest/v1/rpc/billing_entitlements_for") {
      return json(state.ent);
    }
    if (path === "/rest/v1/rpc/billing_commit_snapshot") return json(true);
    if (path === "/rest/v1/saved_passages") {
      return json(method === "POST" ? { id: "passage_A" } : []);
    }
    if (path === "/rest/v1/billing_checkouts") {
      if (method === "GET") return json(state.pending || []);
      if (method === "POST") {
        state.pendingWrites++;
        state.pending = JSON.parse(raw);
        return json(null);
      }
      if (method === "PATCH") {
        if (state.failCheckoutWrite) {
          return json({ message: "temporary database failure" }, 503);
        }
        state.pending = { ...state.pending, ...JSON.parse(raw) };
        return json(null);
      }
      return json(null);
    }
    if (path === "/v1/prices/price_e") {
      return json({
        id: "price_e",
        active: true,
        type: "recurring",
        currency: "usd",
        unit_amount: 399,
        livemode: false,
        recurring: { interval: "month", interval_count: 1 },
      });
    }
    if (path === "/v1/customers/cus_A") {
      return json({
        id: "cus_A",
        ...(method === "DELETE" || state.deleted ? { deleted: true } : {}),
      });
    }
    if (path === "/v1/checkout/sessions/cs_test_A/expire") {
      return json({ id: "cs_test_A", status: "expired" });
    }
    if (path === "/v1/subscriptions") {
      return json({
        object: "list",
        has_more: false,
        data: state.subscriptions,
      });
    }
    if (path === "/v1/checkout/sessions") {
      return json({
        id: "cs_test_A",
        url: "https://checkout.stripe.com/c/pay/test_A",
        status: "open",
      });
    }
    if (path === "/v1/checkout/sessions/cs_test_A") {
      return json({
        id: "cs_test_A",
        url: "https://checkout.stripe.com/c/pay/test_A",
        status: "open",
      });
    }
    if (path === "/v1/billing_portal/sessions") {
      return json({
        id: "bps_A",
        url: "https://billing.stripe.com/p/session/test_A",
      });
    }
    throw Error(`Unexpected fixture request: ${method} ${url.origin}${path}`);
  };
  try {
    await fn(calls, state);
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("endpoints reject absent/forged JWTs, foreign origins, GETs, extra checkout fields and Guardian", async () => {
  await fixture(async (calls) => {
    const handler = protectedEndpoint(checkout);
    assert.equal(
      (await handler(request("billing-checkout", {}, ""))).status,
      401,
    );
    assert.equal(
      (await handler(request("billing-checkout", {}, "forged"))).status,
      401,
    );
    assert.equal(
      (await handler(
        request("billing-checkout", {}, "verified-A", "https://evil.example"),
      )).status,
      403,
    );
    assert.equal(
      (await handler(
        new Request("https://billing.example.test", { method: "GET" }),
      )).status,
      405,
    );
    assert.equal(
      (await handler(
        request("billing-checkout", { plan: "guardian", cadence: "monthly" }),
      )).status,
      403,
    );
    assert.equal(
      (await handler(
        request("billing-checkout", {
          plan: "explorer",
          cadence: "monthly",
          userId: "B",
          price: "price_fake",
        }),
      )).status,
      400,
    );
    assert.equal(
      calls.filter((c) => c.url.startsWith("https://api.stripe.com")).length,
      0,
    );
  });
});
Deno.test("Checkout uses owner-bound customer, fixed return URLs, verified price and persistent idempotency across failed saves", async () => {
  await fixture(async (calls, state) => {
    const handler = protectedEndpoint(checkout),
      req = () =>
        request("billing-checkout", { plan: "explorer", cadence: "monthly" });
    state.failCheckoutWrite = true;
    assert.equal((await handler(req())).status, 503);
    const attempt = state.pending.request_key;
    state.failCheckoutWrite = false;
    const response = await handler(req());
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).url,
      "https://checkout.stripe.com/c/pay/test_A",
    );
    assert.equal(state.pending.request_key, attempt);
    assert.equal(state.pendingWrites, 1);
    const sessions = calls.filter((c) => c.path === "/v1/checkout/sessions");
    assert.equal(sessions.length, 2);
    assert.equal(
      sessions[0].headers.get("idempotency-key"),
      sessions[1].headers.get("idempotency-key"),
    );
    const form = new URLSearchParams(sessions[0].raw);
    assert.equal(form.get("customer"), "cus_A");
    assert.equal(form.get("line_items[0][price]"), "price_e");
    assert.equal(
      form.get("success_url"),
      "https://ayah.example.test/?billing=success",
    );
    assert.equal(form.get("client_reference_id"), A);
    assert.equal(form.get("mode"), "subscription");
    const resumed = await handler(req());
    assert.equal(resumed.status, 200);
    assert.equal(
      calls.filter((c) => c.path === "/v1/checkout/sessions").length,
      2,
    );
    state.subscriptions = [{ status: "active" }];
    assert.equal((await handler(req())).status, 409);
  });
});
Deno.test("Portal and refresh bind to the verified account, ignoring supplied customer/plan/user IDs", async () => {
  await fixture(async (calls) => {
    const response = await protectedEndpoint(portal)(
      request("billing-portal", {
        customer: "cus_B",
        userId: "B",
        returnUrl: "https://evil.example",
      }),
    );
    assert.equal(response.status, 200);
    const portalCall = calls.find((c) =>
      c.path === "/v1/billing_portal/sessions"
    );
    const form = new URLSearchParams(portalCall.raw);
    assert.equal(form.get("customer"), "cus_A");
    assert.equal(
      form.get("return_url"),
      "https://ayah.example.test/?billing=return",
    );
    assert.ok(
      calls.find((c) => c.path === "/rest/v1/billing_customers").query.get(
        "user_id",
      ).includes(A),
    );
    assert.equal(
      (await protectedEndpoint(refresh)(
        request("billing-refresh", { userId: "B", plan: "guardian" }),
      )).status,
      200,
    );
    const commit = calls.find((c) =>
      c.path === "/rest/v1/rpc/billing_commit_snapshot"
    );
    assert.equal(JSON.parse(commit.raw).p_user, A);
  });
});
Deno.test("premium endpoint denies Free writes, preserves reads/removal, validates ranges and cannot target B", async () => {
  await fixture(async (calls, state) => {
    const handler = protectedEndpoint(passages);
    state.ent = { plan: "free", features: { passageBuilder: false } };
    assert.equal(
      (await handler(
        request("billing-passages", {
          action: "save",
          userId: "B",
          title: "x",
          surah: 1,
          firstAyah: 1,
          lastAyah: 2,
        }),
      )).status,
      403,
    );
    assert.equal(
      (await handler(
        request("billing-passages", { action: "list", userId: "B" }),
      )).status,
      200,
    );
    state.ent = { plan: "explorer", features: { passageBuilder: true } };
    assert.equal(
      (await handler(
        request("billing-passages", {
          action: "save",
          title: "x",
          surah: 2,
          firstAyah: 1,
          lastAyah: 2,
        }),
      )).status,
      400,
    );
    assert.equal(
      (await handler(
        request("billing-passages", {
          action: "save",
          title: "x",
          surah: 1,
          firstAyah: 1,
          lastAyah: 999,
        }),
      )).status,
      400,
    );
    assert.equal(
      (await handler(
        request("billing-passages", {
          action: "save",
          userId: "B",
          title: "My passage",
          surah: 1,
          firstAyah: 1,
          lastAyah: 2,
        }),
      )).status,
      200,
    );
    const insert = calls.find((c) =>
      c.path === "/rest/v1/saved_passages" && c.method === "POST"
    );
    assert.equal(JSON.parse(insert.raw).user_id, A);
  });
});
Deno.test("webhook HTTP verifies official Stripe signatures, untouched raw bytes, timestamp and mode before processing", async () => {
  const stripe = new Stripe(fixtureEnv.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  let processed = 0;
  const handler = webhookHandler(() => ({ stripe } as any), async () => {
    processed++;
    return { processed: true };
  });
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    livemode: false,
    type: "invoice.paid",
    data: { object: { customer: "cus_A" } },
  });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: fixtureEnv.STRIPE_WEBHOOK_SECRET,
  });
  const req = (body = payload, sig = signature) =>
    new Request("https://billing.example.test/functions/v1/billing-webhook", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body,
    });
  assert.equal((await handler(req())).status, 200);
  assert.equal(processed, 1);
  assert.equal((await handler(req(payload + " "))).status, 400);
  assert.equal((await handler(req(payload, "bad"))).status, 400);
  const stale = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: fixtureEnv.STRIPE_WEBHOOK_SECRET,
    timestamp: 1,
  });
  assert.equal((await handler(req(payload, stale))).status, 400);
  assert.equal(processed, 1);
});

Deno.test("closing billing requires explicit confirmation and verified cancellation; retry after Stripe deletion is safe", async () => {
  await fixture(async (calls, state) => {
    const handler = protectedEndpoint(closeBilling);
    assert.equal((await handler(request("billing-close", {}))).status, 400);
    // An active subscription is detected by canonical Stripe state even if the DB missed its webhook.
    state.subscriptions = [{
      id: "sub_A",
      livemode: false,
      status: "active",
      items: { data: [{ price: { id: "price_e" }, quantity: 1 }] },
    }];
    const original = globalThis.fetch;
    globalThis.fetch = async (input: any, init: any = {}) => {
      if (String(input).includes("/v1/invoices")) {
        return new Response(JSON.stringify({ data: [], has_more: false }), {
          headers: { "content-type": "application/json" },
        });
      }
      return original(input, init);
    };
    assert.equal(
      (await handler(request("billing-close", { confirm: true, userId: "B" })))
        .status,
      409,
    );
    assert.equal(
      calls.filter((c) =>
        c.path === "/v1/customers/cus_A" && c.method === "DELETE"
      ).length,
      0,
    );
    state.subscriptions = [];
    assert.equal(
      (await handler(request("billing-close", { confirm: true }))).status,
      200,
    );
    assert.equal(
      calls.filter((c) =>
        c.path === "/v1/customers/cus_A" && c.method === "DELETE"
      ).length,
      1,
    );
    state.deleted = true;
    assert.equal(
      (await handler(request("billing-close", { confirm: true }))).status,
      200,
    );
    state.closed = true;
    state.ent = { plan: "free", features: { passageBuilder: false } };
    const stripeCalls = calls.filter((c) =>
      c.url.startsWith("https://api.stripe.com")
    ).length;
    assert.equal(
      (await protectedEndpoint(refresh)(request("billing-refresh"))).status,
      200,
    );
    assert.equal(
      calls.filter((c) => c.url.startsWith("https://api.stripe.com")).length,
      stripeCalls,
    );
    assert.equal(
      (await protectedEndpoint(portal)(request("billing-portal"))).status,
      409,
    );
  });
});

Deno.test('authenticated non-payment services can initialize without Stripe; payment operations still reject missing or mismatched keys',async()=>{
 const names=['STRIPE_MODE','STRIPE_SECRET_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','BILLING_SITE_URL'],before=Object.fromEntries(names.map(n=>[n,Deno.env.get(n)]));
 try{
  Deno.env.set('STRIPE_MODE','test');Deno.env.set('STRIPE_SECRET_KEY','');Deno.env.set('SUPABASE_URL','https://db.example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service-fixture');Deno.env.set('BILLING_SITE_URL','https://ayah.example.test');
  const {services}=await import('./runtime.ts');const s=services();assert.ok(s.admin);assert.equal(s.site,'https://ayah.example.test');let rejected=false;try{void s.stripe;}catch{rejected=true;}assert.ok(rejected);
  Deno.env.set('STRIPE_SECRET_KEY','sk_live_wrong_environment_fixture');rejected=false;try{void services().stripe;}catch{rejected=true;}assert.ok(rejected);
 }finally{for(const n of names){if(before[n]===undefined)Deno.env.delete(n);else Deno.env.set(n,before[n]!);}}
});
