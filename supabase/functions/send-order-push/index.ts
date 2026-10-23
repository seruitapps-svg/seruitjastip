import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";
const ONESIGNAL_APP_ID = "1dc83317-d6c7-43ce-aa95-fdfff1ab2364";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://mider-jastip.lovable.app";

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

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase function secrets are not configured" }, 500);
  }
  if (!ONESIGNAL_REST_API_KEY) {
    return json({ error: "ONESIGNAL_REST_API_KEY belum dikonfigurasi di secrets Supabase" }, 500);
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
      .select("id,user_id,driver_id,status,service,food_order_type,merchant_response,merchant_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    const isOwner = order.user_id === callerId;
    const isDriver = order.driver_id === callerId;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles ?? []).some((row) => row.role === "superadmin");

    let targetUserIds: string[] = [];
    let title = "";
    let body = "";
    let targetPath = `/pesanan/${order.id}`;

    if (eventType === "order_created") {
      if (!isOwner) return json({ error: "Forbidden" }, 403);
      if (order.status !== "tersedia") return json({ success: true, sent: 0, message: "Order belum tersedia di pool" });
      const { data: onlineDrivers, error } = await admin
        .from("driver_profiles")
        .select("user_id")
        .eq("is_online", true);
      if (error) throw error;
      targetUserIds = uniqueIds((onlineDrivers ?? []).map((row) => row.user_id).filter((id) => id !== callerId));
      title = "Ada Order Baru!";
      body = "Order baru tersedia di pool. Buka aplikasi untuk melihat dan mengambil pesanan.";
      targetPath = "/driver";
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
        const { data: onlineDrivers, error } = await admin
          .from("driver_profiles")
          .select("user_id")
          .eq("is_online", true);
        if (error) throw error;
        targetUserIds = uniqueIds((onlineDrivers ?? []).map((row) => row.user_id));
        title = "Ada Order Baru!";
        body = "Order telah tersedia di pool dan bisa diambil.";
        targetPath = "/driver";
      } else {
        return json({ success: true, sent: 0, message: "Tidak ada penerima untuk perubahan ini" });
      }
    } else if (eventType === "merchant_order_ready") {
      let isOrderMerchant = false;
      if (order.merchant_id) {
        const { data: merchant, error: merchantError } = await admin
          .from("merchants")
          .select("user_id")
          .eq("id", order.merchant_id)
          .maybeSingle();
        if (merchantError) throw merchantError;
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
      else if (isAdmin) targetUserIds = uniqueIds([order.user_id, order.driver_id].filter((id) => id !== callerId));
      else return json({ error: "Forbidden" }, 403);
      title = isDriver ? "Pesan Baru dari Driver" : "Pesan Baru dari Pelanggan";
      body = "Anda menerima pesan baru pada chat pesanan.";
    }

    targetUserIds = uniqueIds(targetUserIds);
    if (targetUserIds.length === 0) {
      console.info("send-order-push: no recipients", { eventType, orderId, callerId });
      return json({ success: true, sent: 0, failed: 0, stage: "recipients", message: "No recipients" });
    }

    const notificationUrl = new URL(targetPath, APP_ORIGIN).toString();
    const chunks: string[][] = [];
    for (let index = 0; index < targetUserIds.length; index += 2000) {
      chunks.push(targetUserIds.slice(index, index + 2000));
    }

    const results = await Promise.all(chunks.map(async (externalIds) => {
      try {
        const response = await fetch(ONESIGNAL_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            target_channel: "push",
            include_aliases: { external_id: externalIds },
            headings: { en: title, id: title },
            contents: { en: body, id: body },
            url: notificationUrl,
            data: { event_type: eventType, order_id: String(order.id), url: targetPath },
            web_push: { headers: { Urgency: "high" } },
          }),
        });
        const responseText = await response.text();
        let responseBody: unknown = responseText;
        try {
          responseBody = responseText ? JSON.parse(responseText) : null;
        } catch {
          responseBody = responseText.slice(0, 500);
        }
        if (!response.ok) {
          console.error("send-order-push: OneSignal rejected notification", {
            eventType, orderId, status: response.status, response: responseBody,
            targetCount: externalIds.length,
          });
        }
        return { ok: response.ok, status: response.status, response: responseBody, targetCount: externalIds.length };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("send-order-push: OneSignal request failed", { eventType, orderId, message });
        return { ok: false, status: 0, response: message, targetCount: externalIds.length };
      }
    }));

    const sent = results.filter((result) => result.ok).length;
    const failed = results.length - sent;
    console.info("send-order-push: OneSignal summary", {
      eventType, orderId, recipientCount: targetUserIds.length, requestCount: results.length, sent, failed,
    });
    return json({
      success: failed === 0 && sent > 0,
      sent,
      failed,
      recipientCount: targetUserIds.length,
      requestCount: results.length,
      ...(failed ? { failures: results.filter((result) => !result.ok).map(({ status, response }) => ({ status, response })) } : {}),
    }, sent === 0 ? 502 : 200);
  } catch (error) {
    console.error("send-order-push error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
