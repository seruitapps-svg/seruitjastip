import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventType = "order_created" | "order_status_changed" | "merchant_order_ready" | "chat_message";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase function secrets are not configured" }, 500);
  }

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
    if (!orderId || !["order_created", "order_status_changed", "merchant_order_ready", "chat_message"].includes(eventType)) {
      return json({ error: "Invalid event" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,user_id,driver_id,status,service,food_order_type,merchant_response")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    const isOwner = order.user_id === callerId;
    const isDriver = order.driver_id === callerId;
    let isAdmin = false;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    isAdmin = (roles ?? []).some((row) => row.role === "superadmin");

    let targetUserIds: string[] = [];
    let title = "";
    let body = "";
    let targetUrl = `/pesanan/${order.id}`;

    if (eventType === "order_created") {
      if (!isOwner) return json({ error: "Forbidden" }, 403);
      if (order.status !== "tersedia") return json({ sent: 0, message: "Order belum tersedia di pool" });
      const { data: onlineDrivers, error } = await admin
        .from("driver_profiles")
        .select("user_id")
        .eq("is_online", true);
      if (error) throw error;
      targetUserIds = [...new Set((onlineDrivers ?? []).map((row) => row.user_id).filter((id) => id && id !== callerId))];
      title = "Ada Order Baru!";
      body = "Order baru tersedia di pool. Buka aplikasi untuk melihat dan mengambil pesanan.";
      targetUrl = "/driver";
    } else if (eventType === "order_status_changed") {
      if (!isOwner && !isDriver && !isAdmin) return json({ error: "Forbidden" }, 403);
      if (isDriver && order.user_id) {
        targetUserIds = [order.user_id];
        title = "Pembaruan Pesanan";
        body = order.status === "diambil"
          ? "Driver menerima pesanan dan sedang menuju lokasi penjemputan."
          : order.status === "dijemput"
          ? "Pesanan sudah dijemput driver."
          : order.status === "diantar"
          ? "Pesanan sedang diantar ke tujuan."
          : order.status === "selesai"
          ? "Pesanan telah selesai."
          : "Status pesanan Anda telah diperbarui.";
      } else if (isAdmin && order.status === "tersedia") {
        const { data: onlineDrivers, error } = await admin.from("driver_profiles").select("user_id").eq("is_online", true);
        if (error) throw error;
        targetUserIds = [...new Set((onlineDrivers ?? []).map((row) => row.user_id).filter(Boolean))];
        title = "Ada Order Baru!";
        body = "Order telah tersedia di pool dan bisa diambil.";
        targetUrl = "/driver";
      } else {
        return json({ sent: 0, message: "Tidak ada penerima untuk perubahan ini" });
      }
    } else if (eventType === "merchant_order_ready") {
      if (!isOwner && !isDriver && !isAdmin) return json({ error: "Forbidden" }, 403);
      if (order.food_order_type !== "mitra" || order.merchant_response !== "accepted" || !order.driver_id) {
        return json({ sent: 0, message: "Order Mitra Resto belum siap atau belum memiliki driver" });
      }
      targetUserIds = [order.driver_id];
      title = "Pesanan Siap Diambil";
      body = "Mitra resto telah menerima pesanan. Datang ke resto dan ikuti instruksi PIN pickup.";
    } else {
      if (!messageId) return json({ error: "Message ID is required" }, 400);
      const { data: message, error: messageError } = await admin
        .from("order_messages")
        .select("id,order_id,sender_id,body")
        .eq("id", messageId)
        .eq("order_id", orderId)
        .maybeSingle();
      if (messageError) throw messageError;
      if (!message || message.sender_id !== callerId) return json({ error: "Forbidden" }, 403);
      if (isOwner && order.driver_id) targetUserIds = [order.driver_id];
      else if (isDriver) targetUserIds = [order.user_id];
      else if (isAdmin) {
        targetUserIds = [order.user_id, order.driver_id].filter((id): id is string => Boolean(id && id !== callerId));
      } else return json({ error: "Forbidden" }, 403);
      title = isDriver ? "Pesan Baru dari Driver" : "Pesan Baru dari Pelanggan";
      body = "Anda menerima pesan baru pada chat pesanan.";
    }

    if (targetUserIds.length === 0) return json({ sent: 0, message: "No recipients" });
    const { data: tokenRows, error: tokenError } = await admin
      .from("user_push_tokens")
      .select("user_id,token")
      .in("user_id", targetUserIds);
    if (tokenError) throw tokenError;
    if (!tokenRows?.length) return json({ sent: 0, message: "No tokens found" });
    if (!LOVABLE_API_KEY || !FIREBASE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY or FIREBASE_MESSAGING_API_KEY is not configured" }, 500);
    }

    const results = await Promise.all(tokenRows.map(async ({ token }) => {
      const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": FIREBASE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: {
              title,
              body,
              order_id: String(order.id),
              url: targetUrl,
            },
            android: { priority: "high", notification: { sound: "default", channel_id: "orders" } },
            webpush: { headers: { Urgency: "high" }, notification: { requireInteraction: true } },
          },
        }),
      });
      if (response.status === 404 || response.status === 410) {
        await admin.from("user_push_tokens").delete().eq("token", token);
      }
      return response.ok;
    }));

    return json({ success: true, count: results.filter(Boolean).length, failed: results.length - results.filter(Boolean).length });
  } catch (error) {
    console.error("send-order-push error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
