import Stripe from "npm:stripe@23.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  BillingError,
  priceCatalog,
  subscriptionSnapshot,
} from "./billing-core.js";
export { BillingError, Stripe };
export const env = (name: string) => Deno.env.get(name) || "";
export function services() {
  const mode = env("STRIPE_MODE") || "test";
  const key = env("STRIPE_SECRET_KEY");
  if (!["test", "live"].includes(mode)) throw new BillingError(503,"Invalid billing environment.");
  // Content/passages still need verified auth and entitlements, but do not call
  // Stripe. Initialize the payment client only when a payment operation uses it.
  let stripe: Stripe | null = null;
  const paymentClient = () => {
    if (!key.startsWith(`sk_${mode}_`)) throw new BillingError(503,"Stripe is not configured for this environment.");
    return stripe ||= new Stripe(key,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:1,timeout:15000});
  };
  const admin = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const site = new URL(env("BILLING_SITE_URL"));
  if (
    site.protocol !== "https:" &&
    !(mode === "test" && ["localhost", "127.0.0.1"].includes(site.hostname) &&
      site.protocol === "http:")
  ) throw new BillingError(503, "Invalid billing return URL.");
  if (
    site.username || site.password || site.search || site.hash ||
    site.pathname !== "/"
  ) throw new BillingError(503, "Billing site URL must be an origin.");
  return { get stripe(){return paymentClient();}, admin, mode, site: site.origin, catalog: priceCatalog(env) };
}
export async function db<T>(
  result: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await result;
  if (error) {
    throw new BillingError(503, "Billing could not be saved. Please retry.");
  }
  return data;
}
export async function configFor(s: ReturnType<typeof services>) {
  const config = await db<any>(
    s.admin.from("billing_config").select("*").eq("id", 1).single(),
  );
  if (config.stripe_mode !== s.mode) {
    throw new BillingError(
      503,
      "Billing environment configuration does not match.",
    );
  }
  return config;
}
export async function locked<T>(
  s: ReturnType<typeof services>,
  user: string,
  action: (token: string) => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  const args = { p_user: user, p_mode: s.mode, p_token: token };
  if (!await db(s.admin.rpc("billing_acquire_lock", args))) {
    throw new BillingError(
      409,
      "Billing is being updated. Please retry shortly.",
    );
  }
  try {
    return await action(token);
  } finally {
    await s.admin.rpc("billing_release_lock", args);
  }
}
export async function canonicalSnapshots(
  s: ReturnType<typeof services>,
  customer: string,
) {
  const subscriptions = await s.stripe.subscriptions.list({
    customer,
    status: "all",
    limit: 100,
  });
  if (subscriptions.has_more) {
    throw new BillingError(503, "Billing needs a manual account review.");
  }
  const snapshots = [];
  for (const sub of subscriptions.data) {
    const invoices = await s.stripe.invoices.list({
      subscription: sub.id,
      status: "paid",
      limit: 100,
    });
    snapshots.push(subscriptionSnapshot(sub, invoices.data, s.catalog, s.mode));
  }
  return snapshots;
}
export async function commit(
  s: ReturnType<typeof services>,
  user: string,
  token: string,
  snapshots: unknown[],
  event?: { id: string; type: string },
) {
  return await db(
    s.admin.rpc("billing_commit_snapshot", {
      p_user: user,
      p_mode: s.mode,
      p_token: token,
      p_event_id: event?.id || null,
      p_event_type: event?.type || "manual.refresh",
      p_snapshots: snapshots,
    }),
  );
}
export async function authenticate(
  req: Request,
  s: ReturnType<typeof services>,
) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)
    ?.[1];
  if (!bearer) {
    throw new BillingError(401, "Sign in to manage your subscription.");
  }
  const { data, error } = await s.admin.auth.getUser(bearer);
  if (
    error || !data.user?.id || !data.user.email_confirmed_at ||
    data.user.is_anonymous
  ) throw new BillingError(401, "A verified account is required.");
  return data.user;
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length")) > 8192) {
    throw new BillingError(413, "Request too large.");
  }
  const raw = await req.text();
  if (raw.length > 8192) throw new BillingError(413, "Request too large.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new BillingError(400, "Invalid request.");
  }
}
export function response(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });
}
export function protectedEndpoint(
  action: (
    req: Request,
    s: ReturnType<typeof services>,
    user: any,
  ) => Promise<unknown>,
) {
  return async (req: Request) => {
    let headers: Record<string, string> = {};
    try {
      const s = services();
      const origin = req.headers.get("origin");
      const allowed = [
        s.site,
        ...env("BILLING_ALLOWED_ORIGINS").split(",").map((x) => x.trim())
          .filter(Boolean),
      ];
      if (origin && !allowed.includes(origin)) {
        throw new BillingError(403, "This origin is not allowed.");
      }
      if (origin) {
        headers = {
          "access-control-allow-origin": origin,
          "vary": "Origin",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info",
          "access-control-allow-methods": "POST,OPTIONS",
        };
      }
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }
      if (req.method !== "POST") throw new BillingError(405, "Use POST.");
      const user = await authenticate(req, s);
      await configFor(s);
      return response(await action(req, s, user), 200, headers);
    } catch (error) {
      // Never return Stripe SDK messages, tokens, card details or raw request bodies.
      return response(
        {
          error: error instanceof BillingError
            ? error.message
            : "Billing service is temporarily unavailable.",
        },
        error instanceof BillingError ? error.status : 503,
        headers,
      );
    }
  };
}
