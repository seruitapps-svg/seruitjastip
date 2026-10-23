import { supabase } from "@/integrations/supabase/client";

const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "";

export type PushPermissionStatus =
  | "granted"
  | "denied"
  | "unsupported"
  | "open-in-new-tab"
  | "not-configured";

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

function bytesToBase64Url(value: ArrayBuffer | null): string {
  if (!value) return "";
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sameApplicationServerKey(
  subscription: PushSubscription,
  expectedKey: Uint8Array,
): boolean {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return false;
  return bytesToBase64Url(currentKey) === bytesToBase64Url(expectedKey.buffer as ArrayBuffer);
}

export async function requestAndSavePushSubscription(): Promise<{
  status: PushPermissionStatus;
  error?: string;
}> {
  if (!vapidPublicKey) return { status: "not-configured" };

  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return { status: "unsupported" };
  }

  if (window.top !== window.self) return { status: "open-in-new-tab" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied" };

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const registration = await navigator.serviceWorker.register("/push-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameApplicationServerKey(subscription, applicationServerKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const serialized = subscription.toJSON();
    const endpoint = serialized.endpoint || subscription.endpoint;
    const p256dh = serialized.keys?.p256dh;
    const auth = serialized.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      throw new Error("Browser tidak memberikan data subscription Web Push yang lengkap.");
    }

    const { error } = await (supabase as any).rpc("register_user_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth_key: auth,
      p_platform: /Android/i.test(navigator.userAgent) ? "android_pwa" : "web_pwa",
    });
    if (error) throw error;

    return { status: "granted" };
  } catch (error) {
    console.error("Gagal mendaftarkan Web Push:", error);
    return {
      status: "denied",
      error: error instanceof Error ? error.message : String(error),
    };
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
      console.warn("Push tidak terkirim atau tidak memiliki penerima/subscription:", {
        eventType,
        orderId,
        response: data,
      });
    } else {
      console.info("Web Push accepted:", { eventType, orderId, response: data });
    }
  } catch (error) {
    console.error("Gagal memanggil layanan Web Push:", error);
  }
}

/**
 * Remove this browser's Web Push subscription before signing out so another
 * account using the same browser cannot receive the previous user's messages.
 */
export async function unregisterCurrentPushSubscription(): Promise<void> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const { error } = await (supabase as any).rpc("unregister_user_push_subscription", {
      p_endpoint: subscription.endpoint,
    });
    if (error) {
      console.warn("Subscription tidak dapat dilepas dari akun:", error.message);
      await subscription.unsubscribe();
      return;
    }

    await subscription.unsubscribe();
  } catch (error) {
    // Logout must continue even if push-subscription cleanup fails.
    console.warn("Could not remove Web Push subscription during sign-out:", error);
  }
}
