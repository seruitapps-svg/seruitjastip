import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://mider-jastip.lovable.app";
const VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") ?? APP_ORIGIN;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type EventType = "order_created" | "order_status_changed" | "merchant_order_ready" | "chat_message";
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Supabase secrets belum dikonfigurasi" }, 500);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: "WEB_PUSH_VAPID_PUBLIC_KEY dan WEB_PUSH_VAPID_PRIVATE_KEY belum dikonfigurasi pada Edge Function Secrets" }, 503);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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

    const { data: subscriptions, error: subscriptionError } = await admin
      .from("user_push_subscriptions")
      .select("user_id,endpoint,p256dh,auth_key")
      .in("user_id", targetUserIds);
    if (subscriptionError) throw new Error("Gagal membaca subscription Web Push: " + subscriptionError.message);
    const subscriptionRows = (subscriptions ?? []).filter((row) =>
      typeof row.endpoint === "string" &&
      typeof row.p256dh === "string" &&
      typeof row.auth_key === "string" &&
      row.endpoint.length > 0 &&
      row.p256dh.length > 0 &&
      row.auth_key.length > 0
    );
    if (!subscriptionRows.length) {
      return json({
        success: false,
        sent: 0,
        failed: 0,
        recipientCount: targetUserIds.length,
        message: "Penerima belum mendaftarkan Web Push",
      }, 200);
    }

    const notificationUrl = new URL(targetPath, APP_ORIGIN).toString();
    const payload = JSON.stringify({
      title,
      body,
      url: notificationUrl,
      data: {
        event_type: eventType,
        order_id: String(order.id),
        url: targetPath,
      },
    });

    const results = await Promise.all(subscriptionRows.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth_key },
      };
      try {
        const response = await webpush.sendNotification(subscription, payload, {
          TTL: 60,
          urgency: "high",
        });
        return { ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, endpoint: row.endpoint };
      } catch (error) {
        const status = typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode) || 0
          : 0;
        if (status === 404 || status === 410) {
          const { error: deleteError } = await admin
            .from("user_push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);
          if (deleteError) console.warn("Subscription kedaluwarsa tidak dapat dihapus:", deleteError.message);
        }
        return {
          ok: false,
          status,
          endpoint: row.endpoint,
          response: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        };
      }
    }));
    const sent = results.filter((result) => result.ok).length;
    const failed = results.length - sent;
    return json({
      success: sent > 0 && failed === 0,
      provider: "web-push-vapid",
      sent,
      failed,
      recipientCount: targetUserIds.length,
      subscriptionCount: subscriptionRows.length,
      ...(failed ? {
        failures: results.filter((result) => !result.ok).map(({ status, response }) => ({ status, response })),
      } : {}),
    }, sent > 0 ? 200 : 502);
  } catch (error) {
    console.error("send-order-push error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
