import { useEffect, useState } from "react";
import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestAndSavePushSubscription } from "@/lib/push-notifications";
import { useAuth } from "@/hooks/use-auth";

export function NotificationPrompt() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [locationDismissed, setLocationDismissed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
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

  async function handleEnablePush() {
    if (!user?.id || pushLoading) return;
    setPushLoading(true);
    setPushStatus(null);
    setPushError(null);

    try {
      const result = await requestAndSavePushSubscription();
      if (result.status === "granted") {
        setPushStatus("Notifikasi Web Push berhasil didaftarkan di perangkat ini.");
      } else if (result.status === "denied") {
        throw new Error(result.error || "Izin notifikasi ditolak atau subscription Web Push gagal didaftarkan.");
      } else if (result.status === "unsupported") {
        throw new Error("Browser ini belum mendukung notifikasi Web Push.");
      } else if (result.status === "open-in-new-tab") {
        throw new Error("Buka Mider langsung di tab browser, bukan dari pratinjau atau iframe.");
      } else {
        throw new Error("Konfigurasi kunci publik VAPID belum lengkap.");
      }
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error));
    } finally {
      setPushLoading(false);
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
          {pushStatus && <p className="mt-2 text-xs text-primary" role="status">{pushStatus}</p>}
          {pushError && (
            <p className="mt-2 break-all text-xs text-destructive" role="alert">
              Web Push: {pushError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {pushNeedsSetup && (
            <Button size="sm" variant="outline" onClick={handleEnablePush} disabled={pushLoading}>
              {pushLoading ? "Memproses Web Push…" : "Aktifkan Notifikasi"}
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
