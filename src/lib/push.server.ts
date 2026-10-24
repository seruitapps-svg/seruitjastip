import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PushEventType = "order_created" | "order_status_changed" | "merchant_order_ready" | "chat_message";
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = () => supabaseAdmin as any;

async function logPush(entry: Record<string, unknown>) {
  try {
    await admin().from("push_delivery_log").insert({ source: "server", ...entry });
  } catch (e) {
    console.error("logPush gagal", e);
  }
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

export async function dispatchOrderPush(input: {
  eventType: PushEventType;
  orderId: string;
  messageId?: string | null;
  callerId: string;
}): Promise<Record<string, unknown>> {
  const { eventType, orderId, messageId, callerId } = input;
  const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] ?? "";

  await logPush({
    event_type: "invoked",
    order_id: orderId,
    detail: { eventType, hasFirebaseSecret: Boolean(serviceAccountJson) },
  });

  const stop = async (error: string, extra: Record<string, unknown> = {}) => {
    await logPush({ event_type: eventType, order_id: orderId, ok: false, detail: { error, ...extra } });
    return { success: false, sent: 0, failed: 0, error, ...extra };
  };

  if (!serviceAccountJson) {
    return stop("FIREBASE_SERVICE_ACCOUNT_JSON belum tersedia di server aplikasi");
  }

  try {
    const { data: order, error: orderError } = await admin()
      .from("orders")
      .select("id,user_id,driver_id,status,food_order_type,merchant_response,merchant_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return stop("Order tidak ditemukan");

    const isOwner = order.user_id === callerId;
    const isDriver = order.driver_id === callerId;
    const { data: roles, error: roleError } = await admin().from("user_roles").select("role").eq("user_id", callerId);
    if (roleError) throw roleError;
    const isAdmin = ((roles ?? []) as Array<{ role: string }>).some((row) => row.role === "superadmin");

    let targetUserIds: string[] = [];
    let title = "";
    let body = "";
    let targetPath = "/pesanan/" + order.id;

    if (eventType === "order_created") {
      if (!isOwner) return stop("Forbidden");
      if (order.status !== "tersedia") return { success: true, sent: 0, message: "Order belum tersedia di pool" };
      const { data, error } = await admin().from("driver_profiles").select("user_id").eq("is_online", true);
      if (error) throw error;
      targetUserIds = uniqueIds(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id).filter((id) => id !== callerId));
      title = "Ada Order Baru!";
      body = "Order baru tersedia di pool. Buka aplikasi untuk melihat dan mengambil pesanan.";
      targetPath = "/driver";
    } else if (eventType === "order_status_changed") {
      if (!isOwner && !isDriver && !isAdmin) return stop("Forbidden");
      if (isDriver && order.user_id) {
        targetUserIds = [order.user_id];
        title = "Pembaruan Pesanan";
        body = order.status === "diambil" ? "Driver menerima pesanan dan sedang menuju lokasi penjemputan."
          : order.status === "dijemput" ? "Pesanan sudah dijemput driver."
          : order.status === "diantar" ? "Pesanan sedang diantar ke tujuan."
          : order.status === "selesai" ? "Pesanan telah selesai."
          : "Status pesanan Anda telah diperbarui.";
      } else if (isAdmin && order.status === "tersedia") {
        const { data, error } = await admin().from("driver_profiles").select("user_id").eq("is_online", true);
        if (error) throw error;
        targetUserIds = uniqueIds(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id));
        title = "Ada Order Baru!";
        body = "Order telah tersedia di pool dan bisa diambil.";
        targetPath = "/driver";
      } else {
        return { success: true, sent: 0, message: "Tidak ada penerima untuk perubahan ini" };
      }
    } else if (eventType === "merchant_order_ready") {
      let isOrderMerchant = false;
      if (order.merchant_id) {
        const { data: merchant, error } = await admin().from("merchants").select("user_id").eq("id", order.merchant_id).maybeSingle();
        if (error) throw error;
        isOrderMerchant = merchant?.user_id === callerId;
      }
      if (!isDriver && !isAdmin && !isOrderMerchant) return stop("Forbidden");
      if (order.food_order_type !== "mitra" || order.merchant_response !== "accepted" || !order.driver_id) {
        return { success: true, sent: 0, message: "Order Mitra Resto belum siap atau belum memiliki driver" };
      }
      targetUserIds = [order.driver_id];
      title = "Pesanan Siap Diambil";
      body = "Mitra resto telah menerima pesanan. Datang ke resto dan ikuti instruksi PIN pickup.";
    } else {
      if (!messageId) return stop("Message ID wajib diisi");
      const { data: message, error } = await admin()
        .from("order_messages")
        .select("id,order_id,sender_id,body")
        .eq("id", messageId)
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!message || message.sender_id !== callerId) return stop("Forbidden");
      if (isOwner && order.driver_id) targetUserIds = [order.driver_id];
      else if (isDriver) targetUserIds = [order.user_id];
      else if (isAdmin) targetUserIds = uniqueIds([order.user_id, order.driver_id].filter((id: string | null) => id !== callerId));
      else return stop("Forbidden");
      title = isDriver ? "Pesan Baru dari Driver" : "Pesan Baru dari Pelanggan";
      body = "Anda menerima pesan baru pada chat pesanan.";
    }

    targetUserIds = uniqueIds(targetUserIds);
    if (!targetUserIds.length) {
      await logPush({ event_type: eventType, order_id: orderId, ok: false, detail: { note: "tidak ada penerima" } });
      return { success: true, sent: 0, failed: 0, message: "Tidak ada penerima" };
    }

    const { data: tokens, error: tokenError } = await admin().from("user_push_tokens").select("user_id,token").in("user_id", targetUserIds);
    if (tokenError) throw new Error("Gagal membaca token Firebase: " + tokenError.message);
    const tokenRows = [...new Map(
      ((tokens ?? []) as Array<{ user_id: string; token: string }>)
        .filter((row) => typeof row.token === "string" && row.token.length > 0)
        .map((row) => [row.token, row] as const),
    ).values()];
    if (!tokenRows.length) {
      await logPush({ event_type: eventType, order_id: orderId, ok: false, detail: { note: "penerima belum punya token", recipients: targetUserIds.length } });
      return { success: false, sent: 0, failed: 0, recipientCount: targetUserIds.length, message: "Penerima belum mendaftarkan token Firebase" };
    }

    const account = JSON.parse(serviceAccountJson) as ServiceAccount;
    if (!account.project_id || !account.client_email || !account.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak memiliki project_id, client_email, atau private_key");
    }
    const accessToken = await getAccessToken(account);

    const results = await Promise.all(tokenRows.map(async (row) => {
      try {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + account.project_id + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          // Data-only: hanya service worker / listener foreground yang menampilkan notifikasi (tidak ganda).
          body: JSON.stringify({ message: {
            token: row.token,
            data: { title, body, event_type: eventType, order_id: String(order.id), url: targetPath },
            android: { priority: "high" },
            webpush: { headers: { Urgency: "high", TTL: "3600" } },
          } }),
        });
        const responseText = await response.text();
        let errorCode = "";
        if (!response.ok) {
          console.error("FCM send failed", { status: response.status, response: responseText.slice(0, 500) });
          try {
            const parsed = JSON.parse(responseText);
            const detail = (parsed?.error?.details ?? []).find((d: { errorCode?: string }) => d?.errorCode);
            errorCode = detail?.errorCode || parsed?.error?.status || "";
          } catch { /* respons bukan JSON */ }
        }
        const stale = !response.ok && (
          response.status === 404 ||
          errorCode === "UNREGISTERED" ||
          (errorCode === "INVALID_ARGUMENT" && /registration token/i.test(responseText))
        );
        return { ok: response.ok, status: response.status, errorCode, stale, token: row.token, response: response.ok ? undefined : responseText.slice(0, 300) };
      } catch (error) {
        return { ok: false, status: 0, errorCode: "FETCH_ERROR", stale: false, token: row.token, response: error instanceof Error ? error.message : String(error) };
      }
    }));

    const staleTokens = results.filter((r) => r.stale).map((r) => r.token);
    if (staleTokens.length) {
      const { error: deleteError } = await admin().from("user_push_tokens").delete().in("token", staleTokens);
      if (deleteError) console.error("Gagal menghapus token kedaluwarsa:", deleteError.message);
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;
    const failures = results.filter((r) => !r.ok).map(({ status, errorCode, response }) => ({ status, errorCode, response }));
    await logPush({
      event_type: eventType,
      order_id: orderId,
      ok: sent > 0,
      detail: { sent, failed, removedStale: staleTokens.length, tokens: tokenRows.length, failures },
    });
    return {
      success: sent > 0,
      provider: "firebase",
      sent,
      failed,
      removedStale: staleTokens.length,
      recipientCount: targetUserIds.length,
      tokenCount: tokenRows.length,
      ...(failed ? { failures } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("dispatchOrderPush error:", error);
    return stop(message);
  }
}
