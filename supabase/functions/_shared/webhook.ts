import { BillingError, env, response, services, Stripe } from "./runtime.ts";
import { webhookEvent } from "./actions.ts";
export function webhookHandler(factory = services, process = webhookEvent) {
  return async (req: Request) => {
    if (req.method !== "POST") return response({ error: "Use POST." }, 405);
    try {
      if (Number(req.headers.get("content-length")) > 2097152) {
        return response({ error: "Payload too large." }, 413);
      }
      const signature = req.headers.get("stripe-signature");
      if (!signature) return response({ error: "Signature required." }, 400);
      const raw = await req.text();
      if (raw.length > 2097152) {
        return response({ error: "Payload too large." }, 413);
      }
      const s = factory();
      const secret = env("STRIPE_WEBHOOK_SECRET");
      if (!secret.startsWith("whsec_")) {
        throw new BillingError(503, "Webhook is not configured.");
      }
      let event;
      try {
        event = await s.stripe.webhooks.constructEventAsync(
          raw,
          signature,
          secret,
          300,
          Stripe.createSubtleCryptoProvider(),
        );
      } catch {
        return response({ error: "Invalid webhook signature." }, 400);
      }
      return response(await process(event, s));
    } catch (error) {
      return response({
        error: error instanceof BillingError
          ? error.message
          : "Webhook processing failed; retry.",
      }, error instanceof BillingError ? error.status : 503);
    }
  };
}
