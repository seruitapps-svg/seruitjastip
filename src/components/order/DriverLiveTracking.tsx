import { useEffect, useState } from "react";
import { MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DriverLiveTrackingProps {
  orderId: string;
  driverId: string;
  active: boolean;
}

export function DriverLiveTracking({ orderId, driverId, active }: DriverLiveTrackingProps) {
  const [message, setMessage] = useState("Menyiapkan GPS…");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) {
      setMessage("Pelacakan lokasi tidak aktif");
      setError("");
      return;
    }

    if (!("geolocation" in navigator)) {
      setError("Browser ini tidak mendukung GPS.");
      return;
    }

    let stopped = false;
    let watchId: number | undefined;
    let lastSentAt = 0;
    setMessage("Meminta izin lokasi…");
    setError("");

    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        if (stopped) return;
        setMessage("GPS aktif · mengirim lokasi driver");
        setError("");

        const now = Date.now();
        if (now - lastSentAt < 5000) return;
        lastSentAt = now;

        const { error: saveError } = await supabase.from("driver_locations").upsert(
          {
            order_id: orderId,
            driver_id: driverId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            updated_at: new Date(position.timestamp || now).toISOString(),
          },
          { onConflict: "order_id" },
        );

        if (!stopped && saveError) {
          setError("Lokasi belum terkirim. Periksa koneksi internet.");
          setMessage("Menunggu koneksi");
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
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );

    return () => {
      stopped = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
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
      <div>
        <p className="font-semibold text-foreground">{message}</p>
        {error && <p className="mt-0.5 text-destructive">{error}</p>}
        <p className="mt-0.5 text-muted-foreground">
          Pelacakan web aktif selama halaman detail pesanan terbuka.
        </p>
      </div>
    </div>
  );
}
