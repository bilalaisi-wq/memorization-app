import {providerBundle,providerChapter} from "./provider-content.js";
import { approvedRecitationSegments, draft } from "./segmentation.js";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  allowedReference,
  developerReference,
  availability,
  reference,
  sha256,
  validateBundle,
} from "./content-policy.js";
export function quranHandler(
  factory = () =>
    createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    ),
  {chapterLoader=providerChapter,bundleLoader=providerBundle,fetcher=fetch}={},
) {
  return async (req: Request) => {
    let cors: Record<string, string> = {};
    const reply = (error: string, status: number) =>
      new Response(JSON.stringify({ error }), {
        status,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          ...cors,
        },
      });
    try {
      const origin = req.headers.get("origin"),
        allowed = [
          Deno.env.get("BILLING_SITE_URL") ||
          "https://ayah-a-day.up.railway.app",
          ...(Deno.env.get("BILLING_ALLOWED_ORIGINS") || "").split(",").map(
            (s) => s.trim(),
          ).filter(Boolean),
        ];
      if (origin && !allowed.includes(origin)) {
        return reply("Origin not allowed", 403);
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
      if (req.method !== "POST") return reply("Use POST", 405);
      const raw = await req.text();
      if (raw.length > 2048) return reply("Request too large", 413);
      let body;
      try {
        body = JSON.parse(raw);
        reference(body.key);
      } catch {
        return reply("Invalid Quran reference", 400);
      }
      if (!["bundle", "audio", "chapter"].includes(body.asset)) {
        return reply("Invalid asset", 400);
      }
      const entry = availability.premium.find((p) => p.key === body.key);
      if (!entry) {
        return reply(
          "This reference is not published in the private library",
          404,
        );
      }
      const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)
        ?.[1];
      if (!token) return reply("Sign in required", 401);
      const admin = factory(), identity = await admin.auth.getUser(token);
      if (
        identity.error || !identity.data.user?.id ||
        !identity.data.user.email_confirmed_at ||
        identity.data.user.is_anonymous
      ) return reply("Verified sign-in required", 401);
      const ent = await admin.rpc("billing_entitlements_for", {
        p_user: identity.data.user.id,
      });
      const developerOnly=developerReference(body.key);let previewDeveloper=false;
      if(developerOnly || body.asset==='chapter') {
        const role=await admin.rpc('developer_enabled',{p_user:identity.data.user.id});
        if(role.error || role.data!==true) return reply('Active developer mode is required for this preview',403);
        previewDeveloper=true;
      }
      let reviewer = false;
      if (!allowedReference(body.key, ent.data)&&!previewDeveloper) {
        const role = await admin.rpc("is_quran_reviewer", {
          p_user: identity.data.user.id,
        });
        reviewer = !role.error && role.data === true;
      }
      if (ent.error && !reviewer && !previewDeveloper) return reply("Entitlements unavailable", 503);
      if (!allowedReference(body.key, ent.data) && !reviewer && !previewDeveloper) {
        return reply("Your subscription does not include this juz", 403);
      }
      if(body.asset==='chapter') {
        if(!developerOnly) return reply('Chapter preview unavailable',404);
        const bundles=await chapterLoader(reference(body.key).surah);
        return new Response(JSON.stringify({surah:reference(body.key).surah,bundles}),{headers:{...cors,'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
      }
      // Caller never supplies a bucket/path/juz/plan or receives a public storage URL.
      const { surah, ayah } = reference(body.key),
        path = `${surah}/${ayah}/${
          body.asset === "audio" ? "full.mp3" : "bundle.json"
        }`;
      const file = await admin.storage.from("quran-premium").download(path);
      let fallback=null,bytes;
      if (file.error || !file.data) {
        if(!developerOnly) return reply("Verified content is not deployed yet",503);
        if(body.asset==='bundle') fallback=await bundleLoader(body.key);
        else {
          const url=`https://verses.quran.com/Alafasy/mp3/${String(surah).padStart(3,'0')}${String(ayah).padStart(3,'0')}.mp3`;
          const response=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});
          if(!response.ok || Number(response.headers.get('content-length'))>20*1024*1024) return reply('Verified audio unavailable',503);
          bytes=await response.arrayBuffer();if(bytes.byteLength>20*1024*1024) return reply('Audio too large',503);
        }
      }else bytes=await file.data.arrayBuffer();
      if (!fallback && (
        await sha256(bytes) !==
          (body.asset === "audio" ? entry.audioSha256 : entry.sha256)
      )) return reply("Content integrity check failed", 503);
      if (body.asset === "bundle") {
        const bundle = validateBundle(
          fallback || JSON.parse(new TextDecoder().decode(bytes)),
          body.key,
        );
        // Reviews are trusted, append-only server metadata, never client stop flags.
        let reviewed = null;
        try {
          const result = await admin.from("quran_review_versions").select("*")
            .eq("verse_key", body.key).eq("source_hash", entry.sha256).order(
              "version",
              { ascending: false },
            ).limit(1).maybeSingle();
          if (!result.error) reviewed = result.data;
        } catch {}
        if (reviewed) {
          bundle.segmentationReview = {
            verseKey: body.key,
            version: reviewed.version,
            sourceHash: entry.sha256,
            sourceEdition: reviewed.source_edition,
            riwayah: reviewed.riwayah,
            reviewerName: reviewed.reviewer_name,
            reviewerCredentials: reviewed.reviewer_credentials,
            reviewedAt: reviewed.reviewed_at,
            segments: reviewed.segments,
          };
          bundle.segments.push(
            ...approvedRecitationSegments(bundle.segmentationReview, bundle),
          );
          validateBundle(bundle, body.key);
        }
        if(reviewed || fallback) return new Response(JSON.stringify(bundle), {
            headers: {
              ...cors,
              "content-type": "application/json",
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
            },
          });
      }
      return new Response(bytes, {
        headers: {
          ...cors,
          "content-type": body.asset === "audio"
            ? "audio/mpeg"
            : "application/json",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return reply(
        "Content is unavailable. Free learning remains available.",
        503,
      );
    }
  };
}
