import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const appId =
  import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID ||
  import.meta.env.VITE_FIREBASE_APP_ID ||
  "1:803891035138:web:0b61998d8469b9d1c57b1b";

// VAPID Key yang sudah diverifikasi valid secara matematis kurva P-256 (J25Oewrt dengan O kapital)
const vapidKey =
  import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY ||
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  "BJqbD1sHSJ6nhPkBCXupiYz-U2Gt-CZzjXyqxMkR42PgX8sLI9Mv1J25OewrtZVxeCQKexPOmfmW6-jpznB1Y1o";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyAuRDJSTHaKdJFsTHobXbqFaPy4D2IKMYA",
  projectId:
    import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    "mider-web",
  appId,
  messagingSenderId: appId ? appId.split(":")[1] || "803891035138" : "803891035138",
};

export type PushPermissionStatus =
  | "granted"
  | "denied"
  | "unsupported"
  | "open-in-new-tab"
  | "not-configured";

export async function requestAndSavePushToken(
  userId: string,
): Promise<{ status: PushPermissionStatus; token?: string; error?: string }> {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !appId || !vapidKey) {
    return { status: "not-configured" };
  }

  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return { status: "unsupported" };
  }

  if (window.top !== window.self) return { status: "open-in-new-tab" };

  try {
    if (!(await isSupported())) return { status: "unsupported" };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied", error: "Izin notifikasi tidak diizinkan di browser." };

    const query = new URLSearchParams(
      Object.entries(firebaseConfig).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();

    // Daftarkan Service Worker
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`,
      { scope: "/" },
    );

    // Tunggu sampai Service Worker aktif
    await navigator.serviceWorker.ready;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!fcmToken) return { status: "denied", error: "Token FCM tidak ditemukan" };

    const platform = /Android/i.test(navigator.userAgent) ? "android_twa" : "pwa";

    // 1. Coba simpan via RPC
    const { error: rpcError } = await (supabase as any).rpc("register_user_push_token", {
      p_user_id: userId,
      p_token: fcmToken,
      p_platform: platform,
    });

    // 2. Fallback: simpan langsung ke tabel jika RPC belum siap
    if (rpcError) {
      console.warn("RPC register_user_push_token gagal, mencoba simpan langsung ke tabel:", rpcError);
      const { error: tableError } = await (supabase as any)
        .from("user_push_tokens")
        .upsert(
          {
            user_id: userId,
            token: fcmToken,
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,token" }
        );
      if (tableError) throw tableError;
    }

    return { status: "granted", token: fcmToken };
  } catch (error: any) {
    console.error("Gagal mendaftarkan push notification:", error);
    return { status: "denied", error: error?.message || String(error) };
  }
}

export async function sendOrderPushEvent(
  eventType: "order_created" | "order_status_changed" | "merchant_order_ready" | "chat_message",
  orderId: string,
  messageId?: string,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("send-order-push", {
      body: { eventType, orderId, messageId },
    });
    if (error) {
      console.error("Notifikasi push tidak terkirim:", {
        eventType,
        orderId,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        context: (error as any).context,
      });
      return;
    }
    if (!data?.success) {
      console.warn("Push tidak terkirim atau tidak memiliki penerima/token:", {
        eventType,
        orderId,
        response: data,
      });
    } else {
      console.info("Push notification accepted:", { eventType, orderId, response: data });
    }
  } catch (error) {
    console.error("Gagal memanggil layanan push notification:", error);
  }
}


/**
 * Remove the current browser's push token before signing out.
 * The delete is scoped to both the authenticated user and this browser token.
 */
export async function unregisterCurrentPushToken(userId: string): Promise<void> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!fcmToken) return;

    const { error } = await (supabase as any)
      .from("user_push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", fcmToken);

    if (error) {
      console.warn("Token not removed during sign-out:", error.message);
    }
  } catch (error) {
    // Logout must continue even if push-token cleanup fails.
    console.warn("Could not remove push token during sign-out:", error);
  }
}
