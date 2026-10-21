import {
  BillingError,
  checkoutPrice,
  processWebhook,
  validateStripePrice,
} from "./billing-core.js";
import {
  body,
  canonicalSnapshots,
  commit,
  configFor,
  db,
  locked,
  services,
} from "./runtime.ts";
import { availableContent } from "./available-content.js";
type Services = ReturnType<typeof services>;
async function customer(s: Services, user: string) {
  return await db<any>(
    s.admin.from("billing_customers").select("stripe_customer_id,closed_at").eq(
      "user_id",
      user,
    ).eq("mode", s.mode).maybeSingle(),
  );
}
export async function checkout(req: Request, s: Services, user: any) {
  const cfg = await configFor(s),
    price = checkoutPrice(await body(req), s.catalog, cfg);
  validateStripePrice(await s.stripe.prices.retrieve(price.id), price, s.mode);
  return locked(s, user.id, async () => {
    let owner = await customer(s, user.id);
    if (owner?.closed_at) {
      throw new BillingError(
        409,
        "Billing was closed for account deletion. Contact support before reopening it.",
      );
    }
    if (!owner) {
      const created = await s.stripe.customers.create({
        metadata: { supabase_user_id: user.id, application: "ayah-quest" },
      }, { idempotencyKey: `ayah-customer:${s.mode}:${user.id}` });
      await db(
        s.admin.from("billing_customers").insert({
          user_id: user.id,
          mode: s.mode,
          stripe_customer_id: created.id,
        }),
      );
      owner = { stripe_customer_id: created.id };
    }
    const subscriptions = await s.stripe.subscriptions.list({
      customer: owner.stripe_customer_id,
      status: "all",
      limit: 100,
    });
    if (
      subscriptions.has_more ||
      subscriptions.data.some((x) =>
        !["canceled", "incomplete_expired"].includes(x.status)
      )
    ) {
      throw new BillingError(
        409,
        "You already have a subscription. Use Manage billing to change it.",
      );
    }
    let pending = await db<any>(
      s.admin.from("billing_checkouts").select("*").eq("user_id", user.id).eq(
        "mode",
        s.mode,
      ).maybeSingle(),
    );
    if (pending && Date.parse(pending.expires_at) > Date.now()) {
      if (pending.price_id !== price.id) {
        throw new BillingError(
          409,
          "Another checkout is pending. Resume that plan or wait for checkout to expire (about one hour).",
        );
      }
      if (pending.session_id) {
        const session = await s.stripe.checkout.sessions.retrieve(
          pending.session_id,
        );
        if (session.status === "open") return { url: session.url };
        if (session.status === "complete") {
          throw new BillingError(
            409,
            "Payment is being confirmed. Refresh billing shortly.",
          );
        }
        pending = null;
      }
    } else pending = null;
    if (!pending) {
      pending = {
        user_id: user.id,
        mode: s.mode,
        price_id: price.id,
        request_key: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 3660000).toISOString(),
        session_id: null,
        checkout_url: null,
      };
      // Persist the idempotency key BEFORE contacting Stripe, including when the
      // Stripe response or final database write is lost.
      await db(
        s.admin.from("billing_checkouts").upsert(pending, {
          onConflict: "user_id,mode",
        }),
      );
    }
    const session = await s.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: owner.stripe_customer_id,
      allowed_payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: user.id,
      expires_at: Math.floor(Date.parse(pending.expires_at) / 1000),
      success_url: `${s.site}/?billing=success`,
      cancel_url: `${s.site}/?billing=cancel`,
      subscription_data: { metadata: { application: "ayah-quest" } },
      allow_promotion_codes: false,
    }, { idempotencyKey: `ayah-checkout:${s.mode}:${pending.request_key}` });
    await db(
      s.admin.from("billing_checkouts").update({
        session_id: session.id,
        checkout_url: session.url,
      }).eq("user_id", user.id).eq("mode", s.mode),
    );
    return { url: session.url };
  });
}
export async function portal(_req: Request, s: Services, user: any) {
  const owner = await customer(s, user.id);
  if (!owner) {
    throw new BillingError(404, "No billing account yet. Choose a plan first.");
  }
  if (owner.closed_at) {
    throw new BillingError(409, "Billing was closed for account deletion.");
  }
  const session = await s.stripe.billingPortal.sessions.create({
    customer: owner.stripe_customer_id,
    return_url: `${s.site}/?billing=return`,
    ...(Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID")
      ? { configuration: Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID") }
      : {}),
  });
  return { url: session.url };
}
export async function refresh(_req: Request, s: Services, user: any) {
  const owner = await customer(s, user.id);
  if (owner && !owner.closed_at) {
    await locked(s, user.id, async (token) => {
      const snapshots = await canonicalSnapshots(s, owner.stripe_customer_id);
      await commit(s, user.id, token, snapshots);
      // Completed checkouts can no longer create a second subscription.
      if (
        snapshots.some((sub) =>
          !["canceled", "incomplete_expired"].includes(sub.status)
        )
      ) {
        await db(
          s.admin.from("billing_checkouts").delete().eq("user_id", user.id).eq(
            "mode",
            s.mode,
          ),
        );
      }
    });
  }
  return await db(s.admin.rpc("billing_entitlements_for", { p_user: user.id }));
}
export async function webhookEvent(event: any, s: Services) {
  await configFor(s);
  return processWebhook(event, {
    mode: s.mode,
    seen: async (id: string) =>
      !!await db(
        s.admin.from("billing_events").select("event_id").eq("mode", s.mode).eq(
          "event_id",
          id,
        ).maybeSingle(),
      ),
    owner: async (id: string) =>
      (await db<any>(
        s.admin.from("billing_customers").select("user_id").eq("mode", s.mode)
          .eq("stripe_customer_id", id).is("closed_at", null).maybeSingle(),
      ))?.user_id,
    lock: (user: string, action: (token: string) => Promise<unknown>) =>
      locked(s, user, action),
    snapshot: (id: string) => canonicalSnapshots(s, id),
    commit: (user: string, token: string, event: any, snapshots: unknown[]) =>
      commit(s, user, token, snapshots, event),
  });
}
export async function passages(req: Request, s: Services, user: any) {
  const entitlements = await db<any>(
    s.admin.rpc("billing_entitlements_for", { p_user: user.id }),
  );
  const request = await body(req);
  if (request.action === "list") {
    return await db(
      s.admin.from("saved_passages").select(
        "id,title,surah,first_ayah,last_ayah,created_at",
      ).eq("user_id", user.id).order("created_at", { ascending: false }).limit(
        100,
      ),
    );
  }
  if (request.action === "delete") {
    if (
      typeof request.id !== "string" || !/^[0-9a-f-]{36}$/i.test(request.id)
    ) throw new BillingError(400, "Invalid passage.");
    await db(
      s.admin.from("saved_passages").delete().eq("user_id", user.id).eq(
        "id",
        request.id,
      ),
    );
    return { deleted: true };
  }
  if (!entitlements.features.passageBuilder) {
    throw new BillingError(
      403,
      "Explorer or Pathfinder is required to save a new passage. Existing progress remains yours.",
    );
  }
  if (request.action !== "save") {
    throw new BillingError(400, "Unknown passage action.");
  }
  const { title, surah, firstAyah, lastAyah } = request;
  const count = (availableContent as Record<string, number>)[surah];
  if (
    typeof title !== "string" || !title.trim() || title.trim().length > 80 ||
    !Number.isInteger(surah) || !count || !Number.isInteger(firstAyah) ||
    !Number.isInteger(lastAyah) || firstAyah < 1 || lastAyah < firstAyah ||
    lastAyah > count
  ) {
    throw new BillingError(
      400,
      "Choose a valid passage from the currently available library.",
    );
  }
  return await db(
    s.admin.from("saved_passages").insert({
      user_id: user.id,
      title: title.trim(),
      surah,
      first_ayah: firstAyah,
      last_ayah: lastAyah,
    }).select("id,title,surah,first_ayah,last_ayah").single(),
  );
}

export async function closeBilling(req: Request, s: Services, user: any) {
  if ((await body(req)).confirm !== true) {
    throw new BillingError(
      400,
      "Confirm closing billing for account deletion.",
    );
  }
  return locked(s, user.id, async (token) => {
    const owner = await customer(s, user.id);
    if (!owner || owner.closed_at) return { closed: true };
    const existing = await s.stripe.customers.retrieve(
      owner.stripe_customer_id,
    );
    if (existing.deleted) {
      await commit(s, user.id, token, []);
      await db(
        s.admin.from("billing_checkouts").delete().eq("user_id", user.id).eq(
          "mode",
          s.mode,
        ),
      );
      await db(
        s.admin.from("billing_customers").update({
          closed_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("mode", s.mode),
      );
      return { closed: true };
    }
    const pending = await db<any>(
      s.admin.from("billing_checkouts").select("*").eq("user_id", user.id).eq(
        "mode",
        s.mode,
      ).maybeSingle(),
    );
    if (pending && Date.parse(pending.expires_at) > Date.now()) {
      if (!pending.session_id) {
        throw new BillingError(
          409,
          "A checkout is pending. Wait for it to expire before closing billing.",
        );
      }
      const session = await s.stripe.checkout.sessions.retrieve(
        pending.session_id,
      );
      if (session.status === "open") {
        await s.stripe.checkout.sessions.expire(pending.session_id);
      }
    }
    const snapshots = await canonicalSnapshots(s, owner.stripe_customer_id);
    if (
      snapshots.some((sub) =>
        !["canceled", "incomplete_expired"].includes(sub.status)
      )
    ) {
      throw new BillingError(
        409,
        "Cancel your subscription in Stripe and wait for its effective cancellation date before closing billing.",
      );
    }
    // Deleting the Stripe customer also prevents unobserved sessions from charging.
    await s.stripe.customers.del(owner.stripe_customer_id);
    await commit(s, user.id, token, snapshots);
    await db(
      s.admin.from("billing_checkouts").delete().eq("user_id", user.id).eq(
        "mode",
        s.mode,
      ),
    );
    await db(
      s.admin.from("billing_customers").update({
        closed_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("mode", s.mode),
    );
    return { closed: true };
  });
}
