import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestAndSavePushToken, type PushPermissionStatus } from "@/lib/push-notifications";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const STATUS_MESSAGE: Record<PushPermissionStatus, string> = {
  granted: "Notifikasi pesanan berhasil diaktifkan di perangkat ini.",
  denied: "Pendaftaran token gagal. Periksa izin browser dan konfigurasi Firebase.",
  unsupported: "Browser atau perangkat ini belum mendukung Web Push.",
  "open-in-new-tab": "Buka aplikasi dari tab browser penuh, bukan dari jendela preview, lalu coba lagi.",
  "not-configured": "Konfigurasi Firebase Web Push belum tersedia. Hubungi pengelola aplikasi.",
};

export function NotificationPrompt() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PushPermissionStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"checking" | "granted" | "prompt" | "denied" | "unsupported" | "error">("checking");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user?.id || typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("user_push_tokens")
          .select("id")
          .eq("user_id", user.id);
        if (!cancelled && !error && data && data.length > 0) setRegistered(true);
      } catch {
        // Biarkan prompt tetap tersedia jika pengecekan gagal
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user || typeof window === "undefined") return null;
  const notificationSupported = "Notification" in window;
  const pushNeedsSetup = notificationSupported && !((Notification.permission === "granted" && registered) || status === "granted" || dismissed);
  const locationNeedsSetup = locationStatus !== "granted" && locationStatus !== "unsupported";
  if (!pushNeedsSetup && !locationNeedsSetup) return null;

  async function handleEnable() {
    if (!user?.id || loading) return;
    setLoading(true);
    setErrorMessage(null);
    const result = await requestAndSavePushToken(user.id);
    setStatus(result.status);
    if (result.status === "granted") {
      setRegistered(true);
    } else if (result.error) {
      setErrorMessage(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto my-3 flex max-w-3xl items-start gap-3 px-4">
      <div className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {pushNeedsSetup ? (notificationSupported ? (Notification.permission === "granted" ? "Daftarkan Notifikasi Order" : "Aktifkan Notifikasi Order") : "Pengaturan Izin Perangkat") : "Aktifkan Izin Lokasi"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Terima pemberitahuan pesanan dan pesan chat meski aplikasi tidak sedang terbuka.
          </p>
          {locationStatus !== "granted" && (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-foreground" role="status">
              <p className="font-semibold">Izin lokasi belum aktif</p>
              <p className="mt-1 text-muted-foreground">
                Lokasi diperlukan untuk titik penjemputan dan pelacakan driver. Tekan Aktifkan Lokasi lalu izinkan akses di browser.
              </p>
              {locationStatus === "denied" && (
                <p className="mt-1 text-destructive">Izin pernah ditolak. Ubah izin Lokasi melalui pengaturan situs di browser, lalu muat ulang halaman.</p>
              )}
              {locationStatus === "unsupported" && (
                <p className="mt-1 text-muted-foreground">Browser ini tidak menyediakan akses lokasi.</p>
              )}
              {locationMessage && <p className="mt-1">{locationMessage}</p>}
            </div>
          )}
          {status && (
            <div className="mt-2 text-xs text-muted-foreground" role="status">
              <p className="flex items-start gap-1.5">
                {status === "granted" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                {STATUS_MESSAGE[status]}
              </p>
              {errorMessage && (
                <p className="mt-1 font-mono text-[11px] text-destructive break-all pl-5.5">
                  Detail: {errorMessage}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {pushNeedsSetup && (
            <Button size="sm" onClick={handleEnable} disabled={loading}>
              {loading ? "Memproses…" : "Aktifkan Notifikasi"}
            </Button>
          )}
          {locationNeedsSetup && (
            <Button size="sm" variant="outline" onClick={handleEnableLocation}>
              Aktifkan Lokasi
            </Button>
          )}
          {(pushNeedsSetup || locationNeedsSetup) && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setDismissed(true)}>
              Nanti
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
