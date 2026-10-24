import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { installAudioUnlock, startAlertLoop } from "@/lib/audio-alert";

type PushDetail = {
  title: string;
  body: string;
  url: string;
  evt: string;
  orderId?: string;
  urgent: boolean;
};

export function GlobalOrderAlert() {
  const { isDriver, isMitra } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<PushDetail | null>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const roleRef = useRef({ isDriver, isMitra });
  roleRef.current = { isDriver, isMitra };

  function stopSound() {
    stopSoundRef.current?.();
    stopSoundRef.current = null;
  }

  function close() {
    stopSound();
    setAlert(null);
  }

  function open() {
    if (!alert) return;
    const url = alert.url;
    close();
    navigate({ to: url as any });
  }

  useEffect(() => {
    installAudioUnlock();
    const onPush = (event: Event) => {
      const detail = (event as CustomEvent<PushDetail>).detail;
      if (!detail) return;

      // Dashboard driver sudah memiliki popup lokal dari Realtime.
      // Dashboard mitra belum memilikinya, jadi tetap gunakan popup global di sana.
      const path = window.location.pathname;
      if (detail.urgent && path.startsWith("/driver")) return;

      stopSound();
      setAlert(detail);
      const { isDriver: d, isMitra: m } = roleRef.current;
      if (detail.urgent && (d || m)) {
        stopSoundRef.current = startAlertLoop({ maxMs: 60_000 });
      }
    };

    window.addEventListener("mider:push", onPush);
    return () => {
      window.removeEventListener("mider:push", onPush);
      stopSoundRef.current?.();
      stopSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!alert || alert.urgent) return;
    const timer = window.setTimeout(() => setAlert(null), 8000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[120] p-3" role="alert">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-foreground">{alert.title}</p>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">{alert.body}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              Buka
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              Tutup
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup pemberitahuan"
          onClick={close}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
