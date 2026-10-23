import { useEffect, useRef, useState } from "react";
import { MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DriverLiveTrackingProps {
  orderId: string;
  driverId: string;
  active: boolean;
}

interface ScreenWakeLock {
  release: () => Promise<void>;
}

interface WakeLockNavigator extends Navigator {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeLock>;
  };
}

export function DriverLiveTracking({ orderId, driverId, active }: DriverLiveTrackingProps) {
  const [message, setMessage] = useState("Menyiapkan GPS…");
  const [error, setError] = useState("");
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);

  // Jaga layar tetap menyala selama pelacakan aktif jika browser mendukung Wake Lock.
  useEffect(() => {
    if (!active) return;

    let disposed = false;
    const requestWakeLock = async () => {
      const wakeLockNavigator = navigator as WakeLockNavigator;
      if (!wakeLockNavigator.wakeLock || document.visibilityState !== "visible") return;

      try {
        const lock = await wakeLockNavigator.wakeLock.request("screen");
        if (disposed) {
          await lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
      } catch (wakeLockError) {
        console.warn("Screen Wake Lock tidak tersedia:", wakeLockError);
      }
    };

    void requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) void lock.release().catch(() => {});
    };
  }, [active]);

  // Broadcast posisi tiap 3 detik; simpan posisi terakhir ke database tiap 15 detik.
  useEffect(() => {
    if (!active) {
      setMessage("Pelacakan lokasi tidak aktif");
      setError("");
      return;
    }

    if (!("geolocation" in navigator)) {
      setMessage("GPS belum aktif");
      setError("Browser ini tidak mendukung GPS.");
      return;
    }

    let stopped = false;
    let watchId: number | undefined;
    let lastDbSavedAt = 0;
    let lastBroadcastAt = 0;
    let channelReady = false;

    setMessage("Meminta izin lokasi…");
    setError("");

    const channel = supabase.channel(`tracking-${orderId}`, { config: { private: true } });
    channel.subscribe((status) => {
      if (stopped) return;
      channelReady = status === "SUBSCRIBED";
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setError("Koneksi realtime gagal. Periksa koneksi internet.");
      } else if (channelReady) {
        setError("");
      }
    });

    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        if (stopped) return;

        const now = Date.now();
        const updatedAt = new Date(position.timestamp || now).toISOString();
        const payload = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          updated_at: updatedAt,
        };

        if (channelReady && now - lastBroadcastAt >= 3000) {
          lastBroadcastAt = now;
          setMessage("GPS aktif · mengirim posisi realtime");
          void channel.send({
            type: "broadcast",
            event: "driver_pos",
            payload,
          }).then((status) => {
            if (!stopped && status !== "ok") {
              setError("Sinyal realtime belum terkirim. Menyimpan posisi cadangan.");
            }
          });
        } else if (!channelReady) {
          setMessage("GPS aktif · menghubungkan realtime");
        }

        if (now - lastDbSavedAt < 15000) return;
        lastDbSavedAt = now;

        const { error: saveError } = await supabase.from("driver_locations").upsert(
          {
            order_id: orderId,
            driver_id: driverId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            updated_at: updatedAt,
          },
          { onConflict: "order_id" },
        );

        if (!stopped && saveError) {
          setError("Lokasi cadangan belum tersimpan. Periksa koneksi internet.");
          setMessage("Menunggu koneksi");
        } else if (!stopped) {
          setMessage(channelReady ? "GPS aktif · mengirim posisi realtime" : "GPS aktif · menyimpan posisi");
        }
      },
      (geoError) => {
        if (stopped) return;
        const text =
          geoError.code === geoError.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Izinkan akses lokasi di browser."
            : geoError.code === geoError.POSITION_UNAVAILABLE
              ? "GPS belum mendapatkan posisi. Coba pindah ke area terbuka."
              : "GPS belum merespons. Coba aktifkan lokasi HP.";
        setError(text);
        setMessage("GPS belum aktif");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => {
      stopped = true;
      channelReady = false;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      void supabase.removeChannel(channel);
    };
  }, [orderId, driverId, active]);

  if (!active) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs">
      {error ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      ) : (
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{message}</p>
        {error && <p className="mt-0.5 text-destructive">{error}</p>}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Layar dijaga tetap menyala jika browser mendukungnya. Pelacakan tetap bergantung pada izin GPS, koneksi, dan kebijakan sistem HP.
        </p>
      </div>
    </div>
  );
}
