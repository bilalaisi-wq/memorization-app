import { expect, test } from "@playwright/test";
import {
  canAccessJuz,
  checkoutPrice,
  processWebhook,
  subscriptionSnapshot,
  validateStripePrice,
} from "../supabase/functions/_shared/billing-core.js";
const catalog = [{
  id: "price_e",
  plan: "explorer",
  cadence: "monthly",
  amount: 399,
  interval: "month",
}, {
  id: "price_p",
  plan: "pathfinder",
  cadence: "monthly",
  amount: 699,
  interval: "month",
}];
const config = { checkout_enabled: true, guardian_enabled: false };
const sub = (status = "active", price = "price_e") => ({
  id: "sub_A",
  livemode: false,
  status,
  items: {
    data: [{
      quantity: 1,
      price: { id: price },
      current_period_end: 2100000000,
    }],
  },
  cancel_at_period_end: false,
});
const invoice = (price = "price_e", end = 2000000000) => ({
  status: "paid",
  livemode: false,
  parent: { subscription_details: { subscription: "sub_A" } },
  lines: {
    data: [{
      quantity: 1,
      parent: {
        type: "subscription_item_details",
        subscription_item_details: { subscription: "sub_A" },
      },
      pricing: { price_details: { price } },
      period: { end },
    }],
  },
});
test("checkout maps only known plan/cadence selectors, checks prices/mode and keeps Guardian disabled", () => {
  expect(
    checkoutPrice({ plan: "explorer", cadence: "monthly" }, catalog, config).id,
  ).toBe("price_e");
  for (
    const body of [
      { plan: "guardian", cadence: "monthly" },
      { plan: "explorer", cadence: "daily" },
      { plan: "free", cadence: "monthly" },
      { plan: "explorer", cadence: "monthly", price: "price_hacked" },
    ]
  ) expect(() => checkoutPrice(body, catalog, config)).toThrow();
  expect(() =>
    checkoutPrice({ plan: "explorer", cadence: "monthly" }, catalog, {
      ...config,
      checkout_enabled: false,
    })
  ).toThrow();
  const price = {
    active: true,
    type: "recurring",
    currency: "usd",
    unit_amount: 399,
    livemode: false,
    recurring: { interval: "month", interval_count: 1 },
  };
  expect(() => validateStripePrice(price, catalog[0], "test")).not.toThrow();
  for (
    const change of [{ livemode: true }, { unit_amount: 1 }, {
      currency: "eur",
    }, { active: false }]
  ) {
    expect(() =>
      validateStripePrice({ ...price, ...change }, catalog[0], "test")
    ).toThrow();
  }
});
test("paid periods drive access; payment failures, unpaid upgrades and plan changes never invent payment", () => {
  expect(subscriptionSnapshot(sub(), [], catalog, "test").accessUntil).toBe(
    null,
  );
  const paid = subscriptionSnapshot(sub(), [invoice()], catalog, "test");
  expect(paid.plan).toBe("explorer");
  expect(paid.accessUntil).toBe(new Date(2000000000000).toISOString());
  expect(
    subscriptionSnapshot(
      sub(),
      [invoice(), invoice("price_e", 2100000000)],
      catalog,
      "test",
    ).accessUntil,
  ).toBe(new Date(2100000000000).toISOString());
  const failed = subscriptionSnapshot(
    sub("past_due"),
    [invoice(), { ...invoice("price_e", 2100000000), status: "open" }],
    catalog,
    "test",
  );
  expect(failed.accessUntil).toBe(paid.accessUntil);
  expect(
    subscriptionSnapshot(
      sub("past_due", "price_p"),
      [invoice()],
      catalog,
      "test",
    ).plan,
  ).toBe("explorer");
  expect(
    subscriptionSnapshot(
      sub("active", "price_p"),
      [invoice(), invoice("price_p", 2100000000)],
      catalog,
      "test",
    ).plan,
  ).toBe("pathfinder");
  expect(
    subscriptionSnapshot(
      sub("active", "price_e"),
      [invoice("price_p")],
      catalog,
      "test",
    ).plan,
  ).toBe("explorer");
  expect(
    subscriptionSnapshot(
      { ...sub(), cancel_at_period_end: true },
      [invoice()],
      catalog,
      "test",
    ).cancelAtPeriodEnd,
  ).toBe(true);
  expect(() =>
    subscriptionSnapshot({ ...sub(), livemode: true }, [], catalog, "test")
  ).toThrow();
  expect(
    subscriptionSnapshot(
      sub("active", "price_unknown"),
      [invoice()],
      catalog,
      "test",
    ).plan,
  ).toBe(null);
  expect(
    subscriptionSnapshot(
      { ...sub(), items: { data: [...sub().items.data, ...sub().items.data] } },
      [invoice()],
      catalog,
      "test",
    ).plan,
  ).toBe(null);
});
test("duplicate and out-of-order webhooks use locked canonical state, not event payloads", async () => {
  const seen = new Set();
  let state = "active", stored = "", calls = 0;
  const deps = {
    mode: "test",
    seen: async (id) => seen.has(id),
    owner: async (c) => c === "cus_A" ? "A" : null,
    lock: async (u, fn) => fn("lock"),
    snapshot: async () => {
      calls++;
      return state;
    },
    commit: async (u, t, e, s) => {
      seen.add(e.id);
      stored = s;
      return true;
    },
  };
  const event = (id, type = "customer.subscription.updated") => ({
    id,
    type,
    livemode: false,
    data: {
      object: {
        customer: "cus_A",
        status: "canceled",
        metadata: { plan: "guardian" },
      },
    },
  });
  await processWebhook(event("new"), deps);
  expect(stored).toBe("active");
  await processWebhook(event("new"), deps);
  expect(calls).toBe(1);
  state = "canceled";
  await processWebhook(event("old"), deps);
  expect(stored).toBe("canceled");
  expect(
    await processWebhook({
      ...event("other"),
      data: { object: { customer: "cus_other" } },
    }, deps),
  ).toEqual({ ignored: true });
  await expect(processWebhook({ ...event("live"), livemode: true }, deps))
    .rejects.toThrow("environment");
  const broken = {
    ...deps,
    commit: async () => {
      throw Error("database unavailable");
    },
  };
  await expect(processWebhook(event("retry"), broken)).rejects.toThrow();
  expect(seen.has("retry")).toBe(false);
  await processWebhook(event("retry"), deps);
  expect(seen.has("retry")).toBe(true);
});
test("all subscription states preserve free Juz Amma; Explorer gets only five server-selected juz", () => {
  for (const plan of ["free", "explorer", "pathfinder", "guardian"]) {
    expect(canAccessJuz({ plan, features: {} }, 30)).toBe(true);
  }
  expect(
    canAccessJuz({
      plan: "explorer",
      features: {},
      selectedJuz: [1, 2, 3, 4, 5],
    }, 5),
  ).toBe(true);
  expect(
    canAccessJuz({
      plan: "explorer",
      features: {},
      selectedJuz: [1, 2, 3, 4, 5],
    }, 6),
  ).toBe(false);
  expect(canAccessJuz({ plan: "pathfinder", features: { allQuran: true } }, 29))
    .toBe(true);
  expect(canAccessJuz({ plan: "free", features: {} }, 1)).toBe(false);
});
