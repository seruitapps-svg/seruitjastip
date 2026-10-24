import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PushEventType =
  | "order_created"
  | "order_status_changed"
  | "merchant_order_ready"
  | "merchant_rejected"
  | "chat_message";

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };
type Notice = { userIds: string[]; title: string; body: string; path: string; ttl: number };

const URGENT_TTL = 300;
const NORMAL_TTL = 3600;

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

async function onlineDriverIds(order: { service?: string | null }, excludeIds: string[] = []): Promise<string[]> {
  const { data, error } = await admin().from("driver_profiles").select("user_id,accepts_ojek").eq("is_online", true);
  if (error) throw error;
  return uniqueIds(
    ((data ?? []) as Array<{ user_id: string; accepts_ojek: boolean | null }>)
      .filter((row) => !(order.service === "ojek" && row.accepts_ojek === false))
      .map((row) => row.user_id)
      .filter((id) => !excludeIds.includes(id)),
  );
}

async function merchantOwnerId(merchantId: string | null | undefined): Promise<string | null> {
  if (!merchantId) return null;
  const { data, error } = await admin().from("merchants").select("user_id").eq("id", merchantId).maybeSingle();
  if (error) throw error;
  return (data?.user_id as string | undefined) ?? null;
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

  if (!serviceAccountJson) return stop("FIREBASE_SERVICE_ACCOUNT_JSON belum tersedia di server aplikasi");

  try {
    const { data: order, error: orderError } = await admin()
      .from("orders")
      .select("id,code,user_id,driver_id,status,service,food_order_type,merchant_response,merchant_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return stop("Order tidak ditemukan");

    const isOwner = order.user_id === callerId;
    const isDriver = order.driver_id === callerId;
    const merchantUserId = await merchantOwnerId(order.merchant_id);
    const isOrderMerchant = Boolean(merchantUserId) && merchantUserId === callerId;
    const { data: roles, error: roleError } = await admin().from("user_roles").select("role").eq("user_id", callerId);
    if (roleError) throw roleError;
    const isAdmin = ((roles ?? []) as Array<{ role: string }>).some((row) => row.role === "superadmin");

    const label = order.code ? "#" + order.code : "";
    const orderPath = "/pesanan/" + order.id;
    const isMitra = order.food_order_type === "mitra";
    const notices: Notice[] = [];

    if (eventType === "order_created") {
      if (!isOwner) return stop("Forbidden");
      if (order.status !== "tersedia") return { success: true, sent: 0, message: "Order belum tersedia di pool" };
      if (isMitra && order.merchant_response === "pending") {
        notices.push({
          userIds: merchantUserId ? [merchantUserId] : [],
          title: "Pesanan Baru Masuk!",
          body: `Pesanan ${label} menunggu keputusan resto. Buka dashboard untuk menerima atau menolak.`,
          path: "/mitra",
          ttl: URGENT_TTL,
        });
      } else {
        notices.push({
          userIds: await onlineDriverIds(order, [callerId]),
          title: "Ada Order Baru!",
          body: isMitra ? `Order ${label} sudah diterima resto dan tersedia untuk diambil.` : `Order ${label} tersedia. Buka aplikasi untuk melihat dan mengambil pesanan.`,
          path: "/driver",
          ttl: URGENT_TTL,
        });
      }
    } else if (eventType === "order_status_changed") {
      if (!isOwner && !isDriver && !isAdmin && !isOrderMerchant) return stop("Forbidden");

      if (order.status === "dibatalkan") {
        notices.push({
          userIds: uniqueIds([order.user_id, order.driver_id].filter((id: string | null) => id !== callerId)),
          title: "Pesanan Dibatalkan",
          body: `Pesanan ${label} dibatalkan.`,
          path: orderPath,
          ttl: URGENT_TTL,
        });
        if (isMitra && order.merchant_response !== "rejected" && merchantUserId && merchantUserId !== callerId) {
          notices.push({
            userIds: [merchantUserId],
            title: "Pesanan Dibatalkan",
            body: `Pesanan ${label} dibatalkan oleh pelanggan atau admin.`,
            path: "/mitra",
            ttl: URGENT_TTL,
          });
        }
      } else if (isDriver && order.user_id) {
        notices.push({
          userIds: [order.user_id],
          title: "Pembaruan Pesanan",
          body: order.status === "diambil" ? "Driver menerima pesanan dan sedang menuju lokasi penjemputan."
            : order.status === "dijemput" ? "Pesanan sudah dijemput driver."
            : order.status === "diantar" ? "Pesanan sedang diantar ke tujuan."
            : order.status === "selesai" ? "Pesanan telah selesai."
            : "Status pesanan Anda telah diperbarui.",
          path: orderPath,
          ttl: NORMAL_TTL,
        });
        if (isMitra && order.status === "diambil" && merchantUserId) {
          notices.push({
            userIds: [merchantUserId],
            title: "Driver Menuju Resto",
            body: `Driver mengambil pesanan ${label} dan sedang menuju resto. Siapkan pesanan dan PIN pengambilan.`,
            path: "/mitra",
            ttl: URGENT_TTL,
          });
        }
      } else if (isAdmin && order.status === "tersedia") {
        notices.push({
          userIds: await onlineDriverIds(order),
          title: "Ada Order Baru!",
          body: "Order telah tersedia di pool dan bisa diambil.",
          path: "/driver",
          ttl: URGENT_TTL,
        });
      }
    } else if (eventType === "merchant_order_ready") {
      if (!isDriver && !isAdmin && !isOrderMerchant) return stop("Forbidden");
      if (!isMitra || order.merchant_response !== "accepted") {
        return { success: true, sent: 0, message: "Order Mitra Resto belum diterima resto" };
      }
      if (order.driver_id) {
        notices.push({
          userIds: [order.driver_id],
          title: "Pesanan Siap Diambil",
          body: "Mitra resto telah menerima pesanan. Datang ke resto dan ikuti instruksi PIN pickup.",
          path: orderPath,
          ttl: URGENT_TTL,
        });
      } else if (order.status === "tersedia") {
        notices.push({
          userIds: await onlineDriverIds(order),
          title: "Ada Order Baru!",
          body: `Order ${label} sudah diterima resto dan siap diambil.`,
          path: "/driver",
          ttl: URGENT_TTL,
        });
        notices.push({
          userIds: order.user_id && order.user_id !== callerId ? [order.user_id] : [],
          title: "Pesanan Diterima Resto",
          body: "Resto menerima pesanan Anda. Sedang mencari driver.",
          path: orderPath,
          ttl: NORMAL_TTL,
        });
      }
    } else if (eventType === "merchant_rejected") {
      if (!isOrderMerchant && !isAdmin) return stop("Forbidden");
      if (!isMitra || order.merchant_response !== "rejected") {
        return { success: true, sent: 0, message: "Pesanan belum ditolak resto" };
      }
      notices.push({
        userIds: order.user_id ? [order.user_id] : [],
        title: "Pesanan Ditolak Resto",
        body: `Maaf, resto menolak pesanan ${label}. Silakan pesan dari outlet lain.`,
        path: orderPath,
        ttl: NORMAL_TTL,
      });
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
      let ids: string[] = [];
      if (isOwner && order.driver_id) ids = [order.driver_id];
      else if (isDriver) ids = [order.user_id];
      else if (isAdmin) ids = uniqueIds([order.user_id, order.driver_id].filter((id: string | null) => id !== callerId));
      else if (isOrderMerchant && order.driver_id) ids = [order.driver_id];
      else return stop("Forbidden");
      const preview = typeof message.body === "string" ? message.body.slice(0, 80) : "";
      notices.push({
        userIds: ids,
        title: isDriver ? "Pesan Baru dari Driver" : "Pesan Baru dari Pelanggan",
        body: preview || "Anda menerima pesan baru pada chat pesanan.",
        path: orderPath,
        ttl: NORMAL_TTL,
      });
    }

    const active = notices.filter((notice) => notice.userIds.length > 0);
    const allUserIds = uniqueIds(active.flatMap((notice) => notice.userIds));
    if (!allUserIds.length) {
      await logPush({ event_type: eventType, order_id: orderId, ok: false, detail: { note: "tidak ada penerima" } });
      return { success: true, sent: 0, failed: 0, message: "Tidak ada penerima" };
    }

    const { data: tokenData, error: tokenError } = await admin().from("user_push_tokens").select("user_id,token").in("user_id", allUserIds);
    if (tokenError) throw new Error("Gagal membaca token Firebase: " + tokenError.message);
    const tokensByUser = new Map<string, Set<string>>();
    for (const row of (tokenData ?? []) as Array<{ user_id: string; token: string }>) {
      if (typeof row.token !== "string" || !row.token) continue;
      const set = tokensByUser.get(row.user_id) ?? new Set<string>();
      set.add(row.token);
      tokensByUser.set(row.user_id, set);
    }
    const jobs: Array<{ token: string; notice: Notice }> = [];
    for (const notice of active) {
      const tokenSet = new Set<string>();
      for (const uid of notice.userIds) for (const token of tokensByUser.get(uid) ?? []) tokenSet.add(token);
      for (const token of tokenSet) jobs.push({ token, notice });
    }
    if (!jobs.length) {
      await logPush({ event_type: eventType, order_id: orderId, ok: false, detail: { note: "penerima belum punya token", recipients: allUserIds.length } });
      return { success: false, sent: 0, failed: 0, recipientCount: allUserIds.length, message: "Penerima belum mendaftarkan token Firebase" };
    }

    const account = JSON.parse(serviceAccountJson) as ServiceAccount;
    if (!account.project_id || !account.client_email || !account.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak memiliki project_id, client_email, atau private_key");
    }
    const accessToken = await getAccessToken(account);

    const results = await Promise.all(jobs.map(async ({ token, notice }) => {
      try {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + account.project_id + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: {
            token,
            data: { title: notice.title, body: notice.body, event_type: eventType, order_id: String(order.id), url: notice.path },
            android: { priority: "high", ttl: notice.ttl + "s" },
            webpush: { headers: { Urgency: "high", TTL: String(notice.ttl) } },
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
        return { ok: response.ok, status: response.status, errorCode, stale, token, response: response.ok ? undefined : responseText.slice(0, 300) };
      } catch (error) {
        return { ok: false, status: 0, errorCode: "FETCH_ERROR", stale: false, token, response: error instanceof Error ? error.message : String(error) };
      }
    }));

    const staleTokens = [...new Set(results.filter((r) => r.stale).map((r) => r.token))];
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
      detail: { sent, failed, removedStale: staleTokens.length, tokens: jobs.length, failures },
    });
    return {
      success: sent > 0,
      provider: "firebase",
      sent,
      failed,
      removedStale: staleTokens.length,
      recipientCount: allUserIds.length,
      tokenCount: jobs.length,
      ...(failed ? { failures } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("dispatchOrderPush error:", error);
    return stop(message);
  }
}
