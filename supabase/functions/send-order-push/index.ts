import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "";
const APP_ORIGIN = "https://mider-jastip.lovable.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type EventType = "order_created" | "order_status_changed" | "merchant_order_ready" | "chat_message";
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64url(new Uint8Array(signature));
  const tokenResponse = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || typeof tokenBody.access_token !== "string") {
    throw new Error("Firebase OAuth gagal: " + JSON.stringify(tokenBody).slice(0, 500));
  }
  return tokenBody.access_token;
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Supabase secrets belum dikonfigurasi" }, 500);
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) return json({ error: "FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi pada Edge Function Secrets" }, 503);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = authData.user.id;
    const input = await req.json();
    const eventType = input?.eventType as EventType;
    const orderId = typeof input?.orderId === "string" ? input.orderId : "";
    const messageId = typeof input?.messageId === "string" ? input.messageId : null;
    if (!orderId || !["order_created", "order_status_changed", "merchant_order_ready", "chat_message"].includes(eventType)) return json({ error: "Invalid event" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,user_id,driver_id,status,food_order_type,merchant_response,merchant_id").eq("id", orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);
    const isOwner = order.user_id === callerId;
    const isDriver = order.driver_id === callerId;
    const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    if (roleError) throw roleError;
    const isAdmin = (roles ?? []).some((row) => row.role === "superadmin");
    let targetUserIds: string[] = [];
    let title = "";
    let body = "";
    let targetPath = "/pesanan/" + order.id;

    if (eventType === "order_created") {
      if (!isOwner) return json({ error: "Forbidden" }, 403);
      if (order.status !== "tersedia") return json({ success: true, sent: 0, message: "Order belum tersedia di pool" });
      const { data, error } = await admin.from("driver_profiles").select("user_id").eq("is_online", true);
      if (error) throw error;
      targetUserIds = uniqueIds((data ?? []).map((row) => row.user_id).filter((id) => id !== callerId));
      title = "Ada Order Baru!";
      body = "Order baru tersedia di pool. Buka aplikasi untuk melihat dan mengambil pesanan.";
      targetPath = "/driver";
    } else if (eventType === "order_status_changed") {
      if (!isOwner && !isDriver && !isAdmin) return json({ error: "Forbidden" }, 403);
      if (isDriver && order.user_id) {
        targetUserIds = [order.user_id];
        title = "Pembaruan Pesanan";
        body = order.status === "diambil" ? "Driver menerima pesanan dan sedang menuju lokasi penjemputan."
          : order.status === "dijemput" ? "Pesanan sudah dijemput driver."
          : order.status === "diantar" ? "Pesanan sedang diantar ke tujuan."
          : order.status === "selesai" ? "Pesanan telah selesai."
          : "Status pesanan Anda telah diperbarui.";
      } else if (isAdmin && order.status === "tersedia") {
        const { data, error } = await admin.from("driver_profiles").select("user_id").eq("is_online", true);
        if (error) throw error;
        targetUserIds = uniqueIds((data ?? []).map((row) => row.user_id));
        title = "Ada Order Baru!";
        body = "Order telah tersedia di pool dan bisa diambil.";
        targetPath = "/driver";
      } else {
        return json({ success: true, sent: 0, message: "Tidak ada penerima untuk perubahan ini" });
      }
    } else if (eventType === "merchant_order_ready") {
      let isOrderMerchant = false;
      if (order.merchant_id) {
        const { data: merchant, error } = await admin.from("merchants").select("user_id").eq("id", order.merchant_id).maybeSingle();
        if (error) throw error;
        isOrderMerchant = merchant?.user_id === callerId;
      }
      if (!isDriver && !isAdmin && !isOrderMerchant) return json({ error: "Forbidden" }, 403);
      if (order.food_order_type !== "mitra" || order.merchant_response !== "accepted" || !order.driver_id) {
        return json({ success: true, sent: 0, message: "Order Mitra Resto belum siap atau belum memiliki driver" });
      }
      targetUserIds = [order.driver_id];
      title = "Pesanan Siap Diambil";
      body = "Mitra resto telah menerima pesanan. Datang ke resto dan ikuti instruksi PIN pickup.";
    } else {
      if (!messageId) return json({ error: "Message ID is required" }, 400);
      const { data: message, error } = await admin.from("order_messages").select("id,order_id,sender_id,body")
        .eq("id", messageId).eq("order_id", orderId).maybeSingle();
      if (error) throw error;
      if (!message || message.sender_id !== callerId) return json({ error: "Forbidden" }, 403);
      if (isOwner && order.driver_id) targetUserIds = [order.driver_id];
      else if (isDriver) targetUserIds = [order.user_id];
      else if (isAdmin) targetUserIds = uniqueIds([order.user_id, order.driver_id].filter((id) => id !== callerId));
      else return json({ error: "Forbidden" }, 403);
      title = isDriver ? "Pesan Baru dari Driver" : "Pesan Baru dari Pelanggan";
      body = "Anda menerima pesan baru pada chat pesanan.";
    }

    targetUserIds = uniqueIds(targetUserIds);
    if (!targetUserIds.length) return json({ success: true, sent: 0, failed: 0, message: "Tidak ada penerima" });

    const { data: tokens, error: tokenError } = await admin.from("user_push_tokens").select("user_id,token").in("user_id", targetUserIds);
    if (tokenError) throw new Error("Gagal membaca token Firebase: " + tokenError.message);
    const tokenRows = (tokens ?? []).filter((row) => typeof row.token === "string" && row.token.length > 0);
    if (!tokenRows.length) return json({ success: false, sent: 0, failed: 0, recipientCount: targetUserIds.length, message: "Penerima belum mendaftarkan token Firebase" }, 200);

    const account = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak memiliki project_id, client_email, atau private_key");
    const accessToken = await getAccessToken(account);
    const notificationUrl = new URL(targetPath, APP_ORIGIN).toString();
    const results = await Promise.all(tokenRows.map(async (row) => {
      try {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + account.project_id + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: {
            token: row.token,
            notification: { title, body },
            data: { event_type: eventType, order_id: String(order.id), url: targetPath },
            webpush: { headers: { Urgency: "high" }, fcmOptions: { link: notificationUrl } },
          } }),
        });
        const responseText = await response.text();
        if (!response.ok) console.error("FCM send failed", { status: response.status, response: responseText.slice(0, 500) });
        return { ok: response.ok, status: response.status, response: response.ok ? undefined : responseText.slice(0, 300) };
      } catch (error) {
        return { ok: false, status: 0, response: error instanceof Error ? error.message : String(error) };
      }
    }));
    const sent = results.filter((result) => result.ok).length;
    const failed = results.length - sent;
    return json({ success: sent > 0 && failed === 0, provider: "firebase", sent, failed, recipientCount: targetUserIds.length, tokenCount: tokenRows.length,
      ...(failed ? { failures: results.filter((result) => !result.ok).map(({ status, response }) => ({ status, response })) } : {}) }, sent > 0 ? 200 : 502);
  } catch (error) {
    console.error("send-order-push error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
