import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { surahs } from "../../../src/data.js";
import {
  allowedReference,
  availability,
  freeReference,
  reference,
  sha256,
  validateBundle,
} from "./content-policy.js";
import {
  compareTranscript,
  COMPARISON_VERSION,
  MAX_AUDIO_BYTES,
  MODEL,
  POLICY_VERSION,
  providerQuality,
  validAudio,
} from "./recitation-core.js";
const MAX_BODY = MAX_AUDIO_BYTES + 32 * 1024;
async function boundedBody(req: Request | Response, limit = MAX_BODY) {
  if (Number(req.headers.get("content-length")) > limit) throw Error("size");
  const reader = req.body?.getReader();
  if (!reader) throw Error("body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error("body timeout")), 20000);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
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
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function recitationHandler({
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
    const finish = async (state: string, metadata: unknown) => {
      // Deleting metadata during an in-flight call must not restore it on completion.
      const saved = await admin.from("recitation_ai_requests").update({
        state,
        finished_at: new Date().toISOString(),
        metadata,
      }).eq("user_id", owner).eq("request_id", requestId).is(
        "deleted_at",
        null,
      );
      if (saved.error) throw Error("metadata");
    };
    try {
      const origin = req.headers.get("origin");
      const origins = [
        Deno.env.get("BILLING_SITE_URL") || "https://ayah-a-day.up.railway.app",
        ...(Deno.env.get("BILLING_ALLOWED_ORIGINS") || "").split(",").map((x) =>
          x.trim()
        ).filter(Boolean),
      ];
      if (origin && !origins.includes(origin)) {
        return reply({ error: "Origin not allowed" }, 403);
      }
      if (origin) {
        cors = {
          "access-control-allow-origin": origin,
          "vary": "Origin",
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
      const access = await admin.rpc("recitation_ai_access", { p_user: owner });
      if (access.error) {
        return reply({ error: "Experimental access unavailable" }, 503);
      }
      if (access.data?.enabled !== true) {
        return reply({
          error:
            "Adult pilot approval and an AI-enabled subscription are required. Local recording is still available.",
        }, 403);
      }
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        return reply({
          error:
            "Transcription is not configured. Local recording remains available.",
        }, 503);
      }
      if (
        !(req.headers.get("content-type") || "").startsWith(
          "multipart/form-data;",
        )
      ) return reply({ error: "Use an audio form upload" }, 415);
      let form: FormData;
      try {
        const bytes = await boundedBody(req);
        form = await new Response(bytes, {
          headers: { "content-type": req.headers.get("content-type")! },
        }).formData();
      } catch {
        return reply({ error: "Invalid upload or file exceeds 8 MiB" }, 413);
      }
      const keys = [...form.keys()];
      if (
        keys.length !== 4 || new Set(keys).size !== 4 ||
        keys.some((k) =>
          !["audio", "reference", "requestId", "consent"].includes(k)
        )
      ) return reply({ error: "Invalid upload fields" }, 400);
      if (form.get("consent") !== POLICY_VERSION) {
        return reply({
          error: "Explicit adult audio-processing consent is required",
        }, 400);
      }
      requestId = String(form.get("requestId"));
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(requestId)
      ) return reply({ error: "Invalid request ID" }, 400);
      const key = String(form.get("reference"));
      let ref;
      try {
        ref = reference(key);
      } catch {
        return reply({ error: "Invalid ayah" }, 400);
      }
      const file = form.get("audio");
      if (
        !(file instanceof File) ||
        !validAudio(new Uint8Array(await file.arrayBuffer()), file.type)
      ) {
        return reply({
          error:
            "Unsupported, oversized, or invalid audio. Use WebM, MP4, WAV, OGG or MP3 (8 MiB maximum).",
        }, 415);
      }
      const ent = await admin.rpc("billing_entitlements_for", {
        p_user: owner,
      });
      if (ent.error) return reply({ error: "Entitlements unavailable" }, 503);
      if (!ent.data?.features?.ai || !allowedReference(key, ent.data)) {
        return reply(
          { error: "Subscription does not include this comparison" },
          403,
        );
      }
      let text: string, words: string[], sourceHash: string;
      if (freeReference(key)) {
        const ayah = surahs.find((s) => s.id === ref.surah)?.verses.find((v) =>
          v.id === ref.ayah
        );
        if (!ayah) {
          return reply({ error: "Verified reference is unavailable" }, 404);
        }
        text = ayah.text;
        words = ayah.words;
        sourceHash = await sha256(JSON.stringify({ key, text, words }));
      } else {
        const entry = availability.premium.find((p) => p.key === key);
        if (!entry) {
          return reply({ error: "Verified reference is not published" }, 404);
        }
        const stored = await admin.storage.from("quran-premium").download(
          `${ref.surah}/${ref.ayah}/bundle.json`,
        );
        if (stored.error || !stored.data) {
          return reply({ error: "Verified reference is unavailable" }, 503);
        }
        const bytes = await stored.data.arrayBuffer();
        if (await sha256(bytes) !== entry.sha256) {
          return reply({ error: "Reference integrity check failed" }, 503);
        }
        const bundle = validateBundle(
          JSON.parse(new TextDecoder().decode(bytes)),
          key,
        );
        text = bundle.textUthmani;
        words = bundle.words.map((w: any) => w.text);
        sourceHash = entry.sha256;
      }
      if (words.length > 512) {
        return reply({
          error:
            "This experimental comparison supports up to 512 words per ayah",
        }, 400);
      }
      const reservation = await admin.rpc("reserve_recitation_ai", {
        p_user: owner,
        p_request: requestId,
      });
      if (reservation.error) {
        return reply({
          error: reservation.error.code === "23505"
            ? "This request was already submitted. It will not be sent again."
            : "Access, rate limit, or monthly allowance prevents this request.",
        }, reservation.error.code === "42501" ? 403 : 429);
      }
      reserved = true;
      const payload = new FormData();
      // Never give the provider the expected ayah: that can prime/hallucinate its transcript.
      const extension: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp4": "mp4",
        "audio/x-m4a": "m4a",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
      };
      payload.set(
        "file",
        file,
        `recitation.${extension[file.type.split(";")[0].toLowerCase()]}`,
      );
      payload.set("model", MODEL);
      payload.set("language", "ar");
      payload.set("response_format", "verbose_json");
      payload.set("temperature", "0");
      const started = Date.now();
      const response = await provider(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}` },
          body: payload,
          signal: AbortSignal.timeout(35000),
        },
      );
      // No automatic retries: timeouts may already have incurred provider processing/cost.
      if (!response.ok) throw Error("provider");
      const raw = new TextDecoder().decode(await boundedBody(response, 256000));
      if (raw.length > 256000) throw Error("provider");
      const result = JSON.parse(raw);
      if (typeof result.text !== "string" || result.text.length > 12000) {
        throw Error("provider");
      }
      const quality = providerQuality(result),
        comparison = compareTranscript(words, result.text, quality);
      const metadata = {
        model: MODEL,
        modelVersion: "provider snapshot not exposed",
        comparisonVersion: COMPARISON_VERSION,
        policyVersion: POLICY_VERSION,
        sourceHash,
        reference: key,
        outcome: comparison.status,
        differenceCount: comparison.differences.length,
        providerDurationSeconds: Number.isFinite(result.duration)
          ? result.duration
          : null,
        latencyMs: Date.now() - started,
        qualityScreen: "uncalibrated-whisper-segment-v1",
        evaluated: false,
      };
      await finish("complete", metadata);
      return reply({
        requestId,
        transcript: result.text,
        verifiedText: text,
        verifiedWords: words,
        comparison,
        metadata,
        usage: reservation.data,
      });
    } catch {
      if (reserved) {
        try {
          await finish("failed", {
            model: MODEL,
            comparisonVersion: COMPARISON_VERSION,
            outcome: "provider_unavailable",
            evaluated: false,
          });
        } catch {}
      }
      // Never log user audio, transcript, provider payloads, authorization or secrets.
      return reply({
        error: reserved
          ? "Transcription could not be assessed. The reserved allowance is retained; no automatic retry was made."
          : "Comparison is unavailable. Continue with local playback and self-assessment.",
      }, 503);
    }
  };
}
