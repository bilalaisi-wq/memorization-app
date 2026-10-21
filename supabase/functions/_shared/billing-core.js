// Runtime-independent billing rules. Imported by the Deno handlers and backend tests.
export const PLANS = Object.freeze({
  explorer: { monthly: 399, annual: 3599, rank: 1 },
  pathfinder: { monthly: 699, annual: 5999, rank: 2 },
  guardian: { monthly: 1199, annual: 9999, rank: 3 },
});
export class BillingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function priceCatalog(env) {
  const entries = [];
  for (const [plan, rule] of Object.entries(PLANS)) {
    for (const cadence of ["monthly", "annual"]) {
      const id = env(
        `STRIPE_${plan.toUpperCase()}_${cadence.toUpperCase()}_PRICE_ID`,
      );
      if (id) {
        entries.push({
          id,
          plan,
          cadence,
          amount: rule[cadence],
          interval: cadence === "annual" ? "year" : "month",
        });
      }
    }
  }
  if (new Set(entries.map((p) => p.id)).size !== entries.length) {
    throw new BillingError(503, "Billing price configuration needs attention.");
  }
  return entries;
}
export function checkoutPrice(body, catalog, config) {
  if (
    !body || Object.keys(body).some((k) => !["plan", "cadence"].includes(k))
  ) throw new BillingError(400, "Choose a plan and billing period.");
  if (!config.checkout_enabled) {
    throw new BillingError(
      503,
      "Checkout is not activated yet. Free learning remains available.",
    );
  }
  if (body.plan === "guardian" && !config.guardian_enabled) {
    throw new BillingError(403, "Guardian is not available yet.");
  }
  const price = catalog.find((p) =>
    p.plan === body.plan && p.cadence === body.cadence
  );
  if (!price) throw new BillingError(400, "This plan is not available.");
  return price;
}
export function validateStripePrice(price, expected, mode) {
  if (
    !price.active || price.type !== "recurring" || price.currency !== "usd" ||
    price.unit_amount !== expected.amount ||
    price.recurring?.interval !== expected.interval ||
    price.recurring?.interval_count !== 1 ||
    price.livemode !== (mode === "live")
  ) {
    throw new BillingError(
      503,
      "The configured Stripe price does not match this plan.",
    );
  }
}
const idOf = (value) => typeof value === "string" ? value : value?.id;
const iso = (sec) =>
  Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : null;
export function subscriptionSnapshot(
  subscription,
  paidInvoices,
  catalog,
  mode,
) {
  if (subscription.livemode !== (mode === "live")) {
    throw new BillingError(400, "Stripe environment mismatch.");
  }
  const items = subscription.items?.data || [];
  const item = items[0];
  const current = items.length === 1 && item.quantity === 1
    ? catalog.find((p) => p.id === idOf(item.price))
    : null;
  let plan = null, access = 0;
  if (current) {
    const paid = [];
    for (const invoice of paidInvoices) {
      if (
        invoice.status !== "paid" || invoice.livemode !== (mode === "live") ||
        idOf(
            invoice.parent?.subscription_details?.subscription ||
              invoice.subscription,
          ) !== subscription.id
      ) continue;
      for (const line of invoice.lines?.data || []) {
        const sourceSubscription = idOf(
          line.parent?.subscription_item_details?.subscription ||
            line.subscription,
        );
        const recurring = line.parent?.type === "subscription_item_details" ||
          line.type === "subscription";
        if (
          !recurring ||
          (sourceSubscription && sourceSubscription !== subscription.id) ||
          line.quantity !== 1
        ) continue;
        const price = catalog.find((p) =>
          p.id === idOf(line.pricing?.price_details?.price || line.price)
        );
        if (price && Number.isFinite(line.period?.end)) {
          paid.push({ plan: price.plan, end: line.period.end });
        }
      }
    }
    // A failed upgrade may change the subscription's item before money is collected.
    // Use only paid lines covering the latest paid end, capped at the current plan.
    const end = Math.max(0, ...paid.map((p) => p.end));
    const atEnd = paid.filter((p) => p.end === end).sort((a, b) =>
      PLANS[b.plan].rank - PLANS[a.plan].rank
    );
    if (atEnd.length) {
      plan = PLANS[current.plan].rank <= PLANS[atEnd[0].plan].rank
        ? current.plan
        : atEnd[0].plan;
      access = end;
    }
    if (subscription.status === "trialing" && subscription.trial_end) {
      plan = current.plan;
      access = subscription.trial_end;
    }
  }
  return {
    id: subscription.id,
    plan,
    status: subscription.status,
    priceId: idOf(item?.price) || "unknown",
    periodEnd: iso(item?.current_period_end || subscription.current_period_end),
    accessUntil: iso(access),
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
  };
}
export function isFreeContent(surah, juz) {
  return surah === 1 || juz === 30;
}
export function canAccessJuz(entitlements, juz) {
  return juz === 30 || (Number.isInteger(juz) && juz >= 1 && juz <= 29 &&
    (entitlements.features?.allQuran ||
      (entitlements.plan === "explorer" &&
        entitlements.selectedJuz?.includes(juz))));
}
export const webhookTypes = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.marked_uncollectible",
  "invoice.voided",
]);
export async function processWebhook(event, deps) {
  if (event.livemode !== (deps.mode === "live")) {
    throw new BillingError(400, "Stripe environment mismatch.");
  }
  if (!webhookTypes.has(event.type)) return { ignored: true };
  if (await deps.seen(event.id)) return { duplicate: true };
  const customer = idOf(event.data?.object?.customer);
  if (!customer) throw new BillingError(400, "Missing Stripe customer.");
  const owner = await deps.owner(customer);
  // Billing for other products on the same Stripe account does not grant app access.
  if (!owner) return { ignored: true };
  return deps.lock(owner, async (token) => {
    // Re-fetch canonical Stripe state *inside* the distributed lock, even for old events.
    // This prevents both out-of-order payloads and concurrent stale snapshot overwrites.
    if (await deps.seen(event.id)) return { duplicate: true };
    const snapshots = await deps.snapshot(customer);
    const applied = await deps.commit(owner, token, event, snapshots);
    return { processed: applied, duplicate: !applied };
  });
}
