import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// The old OneSignal sender has been removed. Keep this endpoint temporarily so
// existing order flows fail clearly instead of calling a removed function.
// Replace this handler with the Firebase Cloud Messaging sender before enabling
// transactional push delivery again.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  return json({
    success: false,
    provider: "firebase",
    error: "FCM sender belum dikonfigurasi. Token Firebase dapat didaftarkan, tetapi push backend belum aktif.",
  }, 503);
});
