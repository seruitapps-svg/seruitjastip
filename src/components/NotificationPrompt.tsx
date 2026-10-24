import { useEffect, useState } from "react";
import { Bell, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestAndSavePushToken } from "@/lib/push-notifications";
import { useAuth } from "@/hooks/use-auth";

export function NotificationPrompt() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Periksa apakah browser mendukung & apakah sudah diizinkan sebelumnya
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setDismissed(true);
      return;
    }

    if (Notification.permission === "granted") {
      setHasPermission(true);
    }

    // Cek apakah pengguna pernah menutup banner ini sebelumnya
    if (user?.id) {
      const isDismissed = localStorage.getItem(`mider_push_prompt_dismissed_${user.id}`);
      if (isDismissed === "true") {
        setDismissed(true);
      }
    }
  }, [user?.id]);

  function handleDismiss() {
    setDismissed(true);
    if (user?.id) {
      try {
        localStorage.setItem(`mider_push_prompt_dismissed_${user.id}`, "true");
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
        // Sembunyikan otomatis setelah 3 detik sukses
        setTimeout(() => {
          handleDismiss();
        }, 3000);
      } else if (result.status === "denied") {
        setErrorMessage("Izin notifikasi dinonaktifkan di browser. Anda dapat mengaktifkannya lewat pengaturan situs.");
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

  // Jangan tampilkan jika:
  // 1. Belum login
  // 2. Browser tidak mendukung
  // 3. Ditutup oleh pengguna (dismissed)
  // 4. Sudah aktif dan tidak sedang menampilkan status sukses
  if (!user || dismissed || (hasPermission && !success)) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-2">
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
        {/* Tombol Tutup Silang di Kanan Atas */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Tutup pemberitahuan"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Ikon & Penjelasan */}
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
                ? "Anda akan menerima info pesanan baru dan pembaruan langsung di perangkat ini."
                : "Dapatkan pemberitahuan seketika saat pesanan masuk, status pengantaran, atau chat."}
            </p>
            {errorMessage && (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Tombol Aksi */}
        {!success && (
          <div className="flex items-center gap-2 self-end sm:self-center pl-13 sm:pl-0">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Nanti Saja
            </button>
            <Button
              size="sm"
              onClick={handleEnablePush}
              disabled={loading}
              className="rounded-xl px-4 text-xs font-semibold shadow-none"
            >
              {loading ? "Menghubungkan…" : "Aktifkan"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
