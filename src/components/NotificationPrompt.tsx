import { useEffect, useState } from "react";
import { Bell, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestAndSavePushToken } from "@/lib/push-notifications";
import { useAuth } from "@/hooks/use-auth";

export function NotificationPrompt() {
  const { user, isDriver, isMitra } = useAuth();
  const mustKeepPrompt = isDriver || isMitra;
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setDismissed(true);
      return;
    }

    // Jika browser sudah mengizinkan notifikasi sebelumnya, lakukan auto-sync token di background
    if (Notification.permission === "granted") {
      setHasPermission(true);
      if (user?.id) {
        setSyncError(null);
        void requestAndSavePushToken(user.id).then((result) => {
          if (result.status !== "granted") {
            setSyncError(
              result.error ||
                "Notifikasi belum aktif di perangkat ini (" + result.status + "). Coba buka ulang aplikasi.",
            );
          }
        });
      }
    }

    if (user?.id) {
      // Driver dan mitra hanya dapat menunda prompt sampai sesi browser berakhir.
      const store = mustKeepPrompt ? sessionStorage : localStorage;
      let isDismissed: string | null = null;
      try {
        isDismissed = store.getItem(`mider_push_prompt_dismissed_${user.id}`);
      } catch {
        // penyimpanan tidak tersedia
      }
      if (isDismissed === "true") setDismissed(true);
    }
  }, [user?.id, mustKeepPrompt]);

  function handleDismiss() {
    setDismissed(true);
    if (user?.id) {
      try {
        (mustKeepPrompt ? sessionStorage : localStorage).setItem(`mider_push_prompt_dismissed_${user.id}`, "true");
      } catch {
        // fallback
      }
    }
  }

  async function handleEnablePush() {
    if (!user?.id || loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await requestAndSavePushToken(user.id);
      if (result.status === "granted") {
        setSuccess(true);
        setHasPermission(true);
        setTimeout(() => {
          handleDismiss();
        }, 3000);
      } else if (result.status === "denied") {
        setErrorMessage("Izin notifikasi dinonaktifkan di browser. Anda dapat mengaktifkannya lewat pengaturan situs Chrome.");
      } else if (result.status === "open-in-new-tab") {
        setErrorMessage("Buka aplikasi di tab utama browser untuk mengaktifkan notifikasi.");
      } else {
        setErrorMessage("Layanan notifikasi sedang disiapkan. Silakan coba beberapa saat lagi.");
      }
    } catch {
      setErrorMessage("Tidak dapat menghubungkan notifikasi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (user && hasPermission && !success && syncError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-2">
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-card p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Notifikasi belum tersambung</h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{syncError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 text-xs"
              onClick={() => {
                if (!user?.id) return;
                setSyncError(null);
                void requestAndSavePushToken(user.id).then((result) => {
                  if (result.status !== "granted") {
                    setSyncError(result.error || "Masih gagal (" + result.status + ").");
                  }
                });
              }}
            >
              Coba lagi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || dismissed || (hasPermission && !success)) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-2">
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Tutup pemberitahuan"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6 sm:pr-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {success ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Bell className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">
              {success ? "Notifikasi Aktif!" : "Aktifkan Notifikasi Pesanan"}
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {success
                ? "Anda akan menerima info pesanan baru langsung di perangkat ini."
                : "Dapatkan pemberitahuan seketika saat ada order baru yang siap diambil."}
            </p>
            {errorMessage && (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        {!success && (
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="text-xs"
            >
              Nanti Saja
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleEnablePush}
              className="text-xs font-semibold"
            >
              {loading ? "Menghubungkan..." : "Izinkan Notifikasi"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
