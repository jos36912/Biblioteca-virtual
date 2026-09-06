// Media Gateway: entrega segura de archivos desde Cloudflare R2.
//
// GET ?asset_id=<id>&session_token=<token>&download=1
//   1. Valida visibilidad del activo vía RPC get_media_asset (public | recruiter).
//   2. Firma una presigned URL de corta duración (TTL 60s) contra R2.
//   3. Responde 302 a la URL firmada. El frontend nunca ve el origen real ni el object_key.
//
// Notas de seguridad:
//   - El object_key solo lo conoce esta función (RPC security definer).
//   - El RPC get_media_asset se invoca con la service role key (solo servidor);
//     anon/authenticated tienen el execute revocado (security-fixes.sql).
//   - Rate limiting básico en memoria (una instancia); no sustituye un WAF.
//   - Nunca registrar tokens de sesión ni object_keys en logs.

import { presignUrl } from "../_shared/sign.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
const R2_BUCKET = Deno.env.get("R2_BUCKET")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;

const SIGNED_URL_TTL_SECONDS = 60;
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(request: Request): boolean {
  const ip = clientIp(request);
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function getMediaAsset(assetId: number, sessionToken: string | null) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_media_asset`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_asset_id: assetId, p_session_token: sessionToken }),
  });
  if (!response.ok) return null;
  return response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  if (rateLimited(request)) {
    return json(429, { ok: false, error: "rate_limited" });
  }

  const url = new URL(request.url);
  const assetId = Number(url.searchParams.get("asset_id"));
  const sessionToken = url.searchParams.get("session_token") || null;
  const download = url.searchParams.get("download") === "1";

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return json(400, { ok: false, error: "invalid_asset" });
  }

  const result = await getMediaAsset(assetId, sessionToken);
  if (!result || !result.ok || !result.object_key) {
    return json(403, { ok: false, error: "forbidden" });
  }

  const query = download
    ? { "response-content-disposition": `attachment; filename="${result.object_key.split("/").pop() || "download"}"` }
    : undefined;

  let signedUrl: string;
  try {
    signedUrl = await presignUrl({
      method: "GET",
      endpointHost: new URL(R2_ENDPOINT).host,
      bucket: R2_BUCKET,
      objectKey: result.object_key,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      query,
    });
  } catch (_) {
    return json(502, { ok: false, error: "gateway_error" });
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: signedUrl,
      "Cache-Control": "no-store",
    },
  });
});
