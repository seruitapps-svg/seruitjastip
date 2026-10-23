/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { decodePolyline, loadGoogleMaps } from "@/lib/google-maps-loader";
import { supabase } from "@/integrations/supabase/client";

interface Point {
  lat: number;
  lng: number;
}

interface Props {
  origin: Point | null;
  destination: Point | null;
  encodedPolyline?: string;
  orderId?: string;
  trackingActive?: boolean;
  followDriver?: boolean;
  className?: string;
}

interface DriverLocationRow {
  latitude: number;
  longitude: number;
  updated_at: string;
}

export function RouteMap({
  origin,
  destination,
  encodedPolyline,
  orderId,
  trackingActive = true,
  followDriver = false,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const latestUpdatedAtRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [driverPosition, setDriverPosition] = useState<Point | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [trackingError, setTrackingError] = useState("");

  const applyDriverPosition = useCallback((position: Point, updatedAt?: string) => {
    const parsedTimestamp = updatedAt ? Date.parse(updatedAt) : Date.now();
    const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();
    if (timestamp < latestUpdatedAtRef.current) return;

    latestUpdatedAtRef.current = timestamp;
    setDriverPosition(position);
    setLastUpdatedAt(timestamp);
  }, []);

  const fetchLatestPosition = useCallback(async (manual = false) => {
    if (!orderId || !trackingActive) return;
    if (manual) setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, updated_at")
        .eq("order_id", orderId)
        .maybeSingle();

      if (error) {
        if (manual) setTrackingError("Posisi belum dapat diperbarui. Periksa koneksi internet.");
        return;
      }

      if (data) {
        const row = data as DriverLocationRow;
        applyDriverPosition(
          { lat: row.latitude, lng: row.longitude },
          row.updated_at,
        );
        setLoadError("");
      } else if (manual) {
        setTrackingError("Belum ada posisi driver yang tersimpan.");
      }
    } catch {
      if (manual) setLoadError("Posisi belum dapat diperbarui. Periksa koneksi internet.");
    } finally {
      if (manual) setRefreshing(false);
    }
  }, [orderId, trackingActive, applyDriverPosition]);

  // Perbarui label waktu agar pelanggan bisa mengetahui kesegaran posisi.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Inisialisasi peta sekali.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: -5.45, lng: 105.26 },
          zoom: 12,
          clickableIcons: false,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
        setMapReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Peta gagal dimuat");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ambil posisi terakhir, lalu dengarkan Broadcast realtime dan perubahan database cadangan.
  useEffect(() => {
    if (!orderId || !trackingActive) {
      setDriverPosition(null);
      setLastUpdatedAt(null);
      latestUpdatedAtRef.current = 0;
      return;
    }

    let cancelled = false;
    setDriverPosition(null);
    setLastUpdatedAt(null);
    latestUpdatedAtRef.current = 0;
    setTrackingError("");
    void fetchLatestPosition();

    const channel = supabase
      .channel(`tracking-${orderId}`, { config: { private: true } })
      .on("broadcast", { event: "driver_pos" }, (event) => {
        if (cancelled) return;
        const payload = event.payload as {
          lat?: number;
          lng?: number;
          updated_at?: string;
        };
        if (typeof payload.lat === "number" && typeof payload.lng === "number") {
          applyDriverPosition(
            { lat: payload.lat, lng: payload.lng },
            payload.updated_at,
          );
          setTrackingError("");
        }
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as Partial<DriverLocationRow>;
          if (
            typeof row.latitude === "number" &&
            typeof row.longitude === "number"
          ) {
            applyDriverPosition(
              { lat: row.latitude, lng: row.longitude },
              row.updated_at,
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [orderId, trackingActive, fetchLatestPosition, applyDriverPosition]);

  // Perbarui marker & polyline saat titik berubah.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;
    const maps = window.google.maps;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new maps.LatLngBounds();
    let hasPoint = false;

    const isValidPoint = (point: Point | null): point is Point =>
      !!point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      point.lng >= -180 &&
      point.lng <= 180;

    if (isValidPoint(origin)) {
      const marker = new maps.Marker({
        map,
        position: origin,
        label: { text: "A", color: "#ffffff" },
        title: "Titik jemput",
      });
      markersRef.current.push(marker);
      bounds.extend(origin);
      hasPoint = true;
    }
    if (isValidPoint(destination)) {
      const marker = new maps.Marker({
        map,
        position: destination,
        label: { text: "B", color: "#ffffff" },
        title: "Titik tujuan",
      });
      markersRef.current.push(marker);
      bounds.extend(destination);
      hasPoint = true;
    }
    if (encodedPolyline) {
      const path = decodePolyline(encodedPolyline)
        .filter((point) =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng) &&
          point.lat >= -90 &&
          point.lat <= 90 &&
          point.lng >= -180 &&
          point.lng <= 180,
        )
        .map((point) => new maps.LatLng(point.lat, point.lng));
      if (path.length > 1) {
        polylineRef.current = new maps.Polyline({
          map,
          path,
          strokeColor: "#0d9488",
          strokeWeight: 5,
          strokeOpacity: 0.85,
        });
        path.forEach((point: any) => bounds.extend(point));
        hasPoint = true;
      }
    }
    if (hasPoint) map.fitBounds(bounds, 60);
  }, [mapReady, origin, destination, encodedPolyline]);

  // Gerakkan marker driver secara halus saat koordinat GPS baru diterima.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;
    const maps = window.google.maps;

    if (followDriver && driverPosition) map.panTo(driverPosition);

    if (!driverPosition) {
      if (driverMarkerRef.current) driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
      return;
    }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new maps.Marker({
        map,
        position: driverPosition,
        title: "Posisi driver",
        zIndex: 1000,
        icon: {
          path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#0d9488",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      return;
    }

    const marker = driverMarkerRef.current;
    const current = marker.getPosition();
    if (!current) {
      marker.setPosition(driverPosition);
      return;
    }
    const start = { lat: current.lat(), lng: current.lng() };
    const end = driverPosition;
    const distance = Math.abs(start.lat - end.lat) + Math.abs(start.lng - end.lng);
    if (distance < 0.000001) return;

    let frame = 0;
    const startedAt = performance.now();
    const duration = 700;
    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      marker.setPosition({
        lat: start.lat + (end.lat - start.lat) * eased,
        lng: start.lng + (end.lng - start.lng) * eased,
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [mapReady, driverPosition, followDriver]);

  const secondsSinceUpdate = lastUpdatedAt === null
    ? null
    : Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  const positionStatus = secondsSinceUpdate === null
    ? "Menunggu posisi driver"
    : secondsSinceUpdate > 25
      ? `Menunggu pembaruan GPS · terakhir ${secondsSinceUpdate} detik lalu`
      : `Posisi driver aktif · diperbarui ${secondsSinceUpdate} detik lalu`;

  if (loadError && !mapReady) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-muted p-6 text-sm text-muted-foreground">
        Peta tidak dapat dimuat: {loadError}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? "h-64 w-full rounded-xl border border-border"}`}>
      <div ref={containerRef} className="h-full w-full" />
      {orderId && trackingActive && (
        <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm">
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-foreground">{positionStatus}</p>
            {trackingError && <p className="mt-1 text-destructive">{trackingError}</p>}
          </div>
          <button
            type="button"
            onClick={() => void fetchLatestPosition(true)}
            disabled={refreshing}
            aria-label="Cek posisi driver terkini"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memeriksa…" : "Cek posisi"}
          </button>
        </div>
      )}
    </div>
  );
}
