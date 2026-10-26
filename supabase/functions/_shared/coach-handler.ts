import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  COACH_CONSENT,
  COACH_MODEL,
  COACH_VERSION,
  validateAdvice,
  validateSummary,
} from "./coach-core.js";
import { sha256 } from "./content-policy.js";
async function bounded(req: Request | Response, limit: number) {
  if (Number(req.headers.get("content-length")) > limit) throw Error("size");
  const reader = req.body?.getReader();
  if (!reader) throw Error("body");
  let size = 0, timer: ReturnType<typeof setTimeout>;
  const chunks: Uint8Array[] = [];
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error("timeout")), 10000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.length;
      if (size > limit) throw Error("size");
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer!);
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(bytes);
}
export function coachHandler({
  factory = () =>
    createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: AbortSignal.any([
                ...(init?.signal ? [init.signal] : []),
                AbortSignal.timeout(10000),
              ]),
            }),
        },
      },
    ),
  provider = fetch,
} = {}) {
  return async (req: Request) => {
    let cors: Record<string, string> = {},
      admin: any,
      owner = "",
      requestId = "",
      fingerprint = "",
      reserved = false;
    const reply = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: {
          ...cors,
          "content-type": "application/json",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    try {
      const origin = req.headers.get("origin"),
        origins = [
          Deno.env.get("BILLING_SITE_URL") ||
          "https://ayah-a-day.up.railway.app",
          ...(Deno.env.get("BILLING_ALLOWED_ORIGINS") || "").split(",").map(
            (x) => x.trim(),
          ).filter(Boolean),
        ];
      if (origin && !origins.includes(origin)) {
        return reply({ error: "Origin not allowed" }, 403);
      }
      if (origin) {
        cors = {
          "access-control-allow-origin": origin,
          vary: "Origin",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info",
          "access-control-allow-methods": "POST,OPTIONS",
        };
      }
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      if (req.method !== "POST") return reply({ error: "Use POST" }, 405);
      const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)
        ?.[1];
      if (!token) return reply({ error: "Sign in required" }, 401);
      admin = factory();
      const identity = await admin.auth.getUser(token);
      if (
        identity.error || !identity.data.user?.email_confirmed_at ||
        identity.data.user.is_anonymous
      ) return reply({ error: "Verified sign-in required" }, 401);
      owner = identity.data.user.id;
      const access = await admin.rpc("hifz_coach_access", { p_user: owner });
      if (access.error) {
        return reply({
          error: "Coach access is unavailable. Your local plan remains usable.",
        }, 503);
      }
      if (access.data?.enabled !== true) {
        return reply({
          error:
            "AI Coach requires an enabled AI subscription and approved adult pilot access. Your rules-based plan remains available.",
        }, 403);
      }
      if (!req.headers.get("content-type")?.startsWith("application/json")) {
        return reply({ error: "Use JSON" }, 415);
      }
      let summary;
      try {
        const body = JSON.parse(await bounded(req, 8192));
        if (
          Object.keys(body).sort().join() !== "consent,summary" ||
          body.consent !== COACH_CONSENT
        ) throw Error();
        summary = validateSummary(body.summary);
      } catch {
        return reply({
          error: "Invalid summary or missing adult aggregate-data consent",
        }, 400);
      }
      fingerprint = await sha256(
        JSON.stringify({
          summary,
          version: COACH_VERSION,
          model: COACH_MODEL,
          day: new Date().toISOString().slice(0, 10),
        }),
      );
      // Missing provider configuration never consumes an allowance, including on cache miss.
      if (!Deno.env.get("OPENAI_API_KEY")) {
        return reply({
          error: "AI is not configured. Use the rules-based plan.",
        }, 503);
      }
      requestId = crypto.randomUUID();
      const reservation = await admin.rpc("reserve_hifz_coach", {
        p_user: owner,
        p_fingerprint: fingerprint,
        p_request: requestId,
      });
      if (reservation.error) {
        return reply({
          error:
            "AI access, rate limit or monthly coach allowance prevents this request. Use your local plan.",
        }, reservation.error.code === "42501" ? 403 : 429);
      }
      if (reservation.data.cached) {
        const advice = validateAdvice(reservation.data.advice);
        return reply({
          advice,
          metadata: reservation.data.metadata,
          usage: reservation.data.usage,
          cached: true,
        });
      }
      reserved = true;
      const response = await provider(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            "content-type": "application/json",
          },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            model: COACH_MODEL,
            temperature: 0,
            max_tokens: 200,
            messages: [{
              role: "system",
              content:
                "Select conservative learning-plan options only from the schema. Counts are recorded/self-assessed learning evidence, not verified memorization. Prefer reducing new work when overdue or repeatedly failing. Never provide Quran text, tafsir, religious interpretation, mastery claims or scheduler changes. Do not infer unreported progress. The local planner enforces time budgets and due-review priority.",
            }, { role: "user", content: JSON.stringify(summary) }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "hifz_coach_options",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    focus: {
                      type: "string",
                      enum: ["steady", "weak", "transitions"],
                    },
                    newCap: { type: "integer", enum: [0, 1, 2] },
                    goalAdvice: {
                      type: "string",
                      enum: ["maintain", "reduce"],
                    },
                    breakStyle: { type: "string", enum: ["short", "spaced"] },
                  },
                  required: ["focus", "newCap", "goalAdvice", "breakStyle"],
                },
              },
            },
          }),
        },
      );
      if (!response.ok) throw Error("provider");
      const result = JSON.parse(await bounded(response, 32768));
      const advice = validateAdvice(
        JSON.parse(result.choices?.[0]?.message?.content),
      );
      const metadata = {
        model: typeof result.model === "string"
          ? result.model.slice(0, 100)
          : COACH_MODEL,
        requestedModel: COACH_MODEL,
        version: COACH_VERSION,
        consentVersion: COACH_CONSENT,
        createdAt: new Date().toISOString(),
        basis:
          "minimized browser-recorded aggregates; not verified memorization",
        religiousContent: "none",
        schedulerWrites: false,
      };
      const saved = await admin.rpc("finish_hifz_coach", {
        p_user: owner,
        p_request: requestId,
        p_fingerprint: fingerprint,
        p_advice: advice,
        p_metadata: metadata,
      });
      if (saved.error) throw Error("cache");
      return reply({
        advice,
        metadata,
        usage: reservation.data.usage,
        cached: false,
      });
    } catch {
      if (reserved) {
        try {
          await admin.rpc("finish_hifz_coach", {
            p_user: owner,
            p_request: requestId,
            p_fingerprint: fingerprint,
            p_advice: null,
            p_metadata: null,
          });
        } catch {}
      }
      return reply({
        error: reserved
          ? "AI could not generate a safe recommendation. No retry was made; the reserved allowance remains used. Continue with the rules-based plan."
          : "AI is unavailable. Your learning records and local plan are unchanged.",
      }, 503);
    }
  };
}
