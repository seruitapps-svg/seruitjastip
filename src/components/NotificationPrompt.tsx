import { useEffect, useState } from "react";
import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureOneSignalReady } from "@/lib/onesignal";
import { useAuth } from "@/hooks/use-auth";

export function NotificationPrompt() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [locationDismissed, setLocationDismissed] = useState(false);
  const [oneSignalLoading, setOneSignalLoading] = useState(false);
  const [oneSignalStatus, setOneSignalStatus] = useState<string | null>(null);
  const [oneSignalError, setOneSignalError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"checking" | "granted" | "prompt" | "denied" | "unsupported" | "error">("checking");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    try {
      setLocationDismissed(window.localStorage.getItem(`mider-location-prompt-dismissed:${user.id}`) === "true");
    } catch {
      // Keep the prompt usable when browser storage is unavailable.
    }
  }, [user?.id]);

  useEffect(() => {
    if (locationStatus === "granted" && user?.id && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(`mider-location-prompt-dismissed:${user.id}`);
      } catch {
        // Location permission still applies when storage is unavailable.
      }
      setLocationDismissed(false);
    }
  }, [locationStatus, user?.id]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }
    if (!(navigator as Navigator & { permissions?: Permissions }).permissions?.query) {
      setLocationStatus("prompt");
      return;
    }
    let cancelled = false;
    void navigator.permissions.query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (!cancelled) {
          setLocationStatus(permission.state === "granted" ? "granted" : permission.state === "denied" ? "denied" : "prompt");
          permission.onchange = () => {
            if (!cancelled) setLocationStatus(permission.state === "granted" ? "granted" : permission.state === "denied" ? "denied" : "prompt");
          };
        }
      })
      .catch(() => { if (!cancelled) setLocationStatus("prompt"); });
    return () => { cancelled = true; };
  }, []);

  // Disable only the legacy Firebase messaging worker; do not unregister other PWA workers.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const scriptUrls = [
          registration.active?.scriptURL,
          registration.waiting?.scriptURL,
          registration.installing?.scriptURL,
        ].filter(Boolean) as string[];
        if (scriptUrls.some((url) => url.includes("/firebase-messaging-sw.js"))) {
          void registration.unregister();
        }
      }
    }).catch((error) => {
      console.warn("Could not unregister legacy Firebase notification worker:", error);
    });
  }, []);

  async function handleEnableLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus("granted");
        setLocationMessage("Izin lokasi aktif di browser ini.");
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Ubah izin Lokasi untuk situs ini melalui pengaturan browser."
            : error.code === error.POSITION_UNAVAILABLE
            ? "Lokasi belum tersedia. Pastikan GPS/lokasi HP aktif."
            : "Permintaan lokasi habis waktu. Aktifkan GPS lalu coba lagi."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function handleEnableOneSignal() {
    if (!user?.id || oneSignalLoading) return;
    setOneSignalLoading(true);
    setOneSignalStatus(null);
    setOneSignalError(null);

    try {
      if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Browser ini belum mendukung Web Push.");
      }
      const OneSignal = await Promise.race([
        ensureOneSignalReady(),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Inisialisasi OneSignal melewati batas 15 detik. Tutup PWA, buka ulang, lalu coba lagi.")),
            15000,
          ),
        ),
      ]);

      await Promise.race([
        OneSignal.Notifications.requestPermission(),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Permintaan izin notifikasi tidak merespons dalam 15 detik.")),
            15000,
          ),
        ),
      ]);

      if (Notification.permission !== "granted") {
        throw new Error("Izin notifikasi belum diizinkan di browser.");
      }

      // Link this browser subscription to the authenticated Mider user so the
      // Edge Function can target the correct account through OneSignal aliases.
      await OneSignal.login(user.id);

      await Promise.race([
        OneSignal.User.PushSubscription.optIn(),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Pendaftaran subscription tidak merespons dalam 15 detik.")),
            15000,
          ),
        ),
      ]);

      const subscriptionId = OneSignal.User.PushSubscription.id;
      setOneSignalStatus(
        subscriptionId
          ? "OneSignal aktif. ID subscription: " + subscriptionId
          : "Permintaan aktivasi selesai, tetapi ID subscription belum tersedia. Periksa tab Subscriptions OneSignal.",
      );
    } catch (error) {
      setOneSignalError(error instanceof Error ? error.message : String(error));
    } finally {
      setOneSignalLoading(false);
    }
  }

  if (!user || typeof window === "undefined") return null;
  const notificationSupported = "Notification" in window;
  const pushNeedsSetup = notificationSupported && !dismissed;
  const locationNeedsSetup = locationStatus !== "granted" && locationStatus !== "unsupported" && !locationDismissed;
  if (!pushNeedsSetup && !locationNeedsSetup) return null;

  return (
    <div className="mx-auto my-3 flex max-w-3xl items-start gap-3 px-4">
      <div className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
        {pushNeedsSetup ? <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        <div className="min-w-0 flex-1">
          {pushNeedsSetup && (
            <>
              <p className="text-sm font-semibold text-foreground">
                {Notification.permission === "granted" ? "Daftarkan Notifikasi Order" : "Aktifkan Notifikasi Order"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Terima pemberitahuan pesanan dan pesan chat meski aplikasi tidak sedang terbuka.
              </p>
            </>
          )}
          {locationNeedsSetup && (
            <div className={pushNeedsSetup ? "mt-2 rounded-lg border border-border bg-background/70 p-2.5 text-xs" : "text-xs"} role="status">
              <p className="font-semibold text-foreground">{locationStatus === "denied" ? "Lokasi belum diizinkan" : "Aktifkan lokasi saat dibutuhkan"}</p>
              <p className="mt-1 text-muted-foreground">
                {locationStatus === "denied"
                  ? "Untuk memakai fitur jemput dan pelacakan, ubah izin lokasi situs melalui pengaturan browser."
                  : "Lokasi membantu menentukan titik penjemputan dan melacak perjalanan."}
              </p>
              {locationMessage && <p className="mt-1 text-muted-foreground">{locationMessage}</p>}
            </div>
          )}
          {oneSignalStatus && <p className="mt-2 text-xs text-primary" role="status">{oneSignalStatus}</p>}
          {oneSignalError && (
            <p className="mt-2 break-all text-xs text-destructive" role="alert">
              OneSignal: {oneSignalError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {pushNeedsSetup && (
            <Button size="sm" variant="outline" onClick={handleEnableOneSignal} disabled={oneSignalLoading}>
              {oneSignalLoading ? "Memproses OneSignal…" : "Aktifkan OneSignal"}
            </Button>
          )}
          {locationNeedsSetup && (
            <Button size="sm" variant="outline" onClick={handleEnableLocation}>
              Aktifkan Lokasi
            </Button>
          )}
          {pushNeedsSetup && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setDismissed(true)}>
              Nanti
            </button>
          )}
          {locationNeedsSetup && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => {
                setLocationDismissed(true);
                if (user?.id) {
                  try {
                    window.localStorage.setItem(`mider-location-prompt-dismissed:${user.id}`, "true");
                  } catch {
                    // Session state still hides the prompt.
                  }
                }
              }}
            >
              Nanti
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
