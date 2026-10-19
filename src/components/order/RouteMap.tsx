/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
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
  className?: string;
}

export function RouteMap({ origin, destination, encodedPolyline, orderId, trackingActive = true, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [driverPosition, setDriverPosition] = useState<Point | null>(null);
  const [loadError, setLoadError] = useState("");

  // Inisialisasi peta sekali
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: -5.45, lng: 105.26 }, // default: Lampung
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
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Peta gagal dimuat");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dengarkan posisi driver terbaru untuk pesanan ini.
  useEffect(() => {
    if (!orderId || !trackingActive) {
      setDriverPosition(null);
      return;
    }
    let cancelled = false;
    setDriverPosition(null);
    supabase
      .from("driver_locations")
      .select("latitude, longitude")
      .eq("order_id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setDriverPosition({ lat: data.latitude, lng: data.longitude });
      });
    const channel = supabase
      .channel(`driver-location-${orderId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "driver_locations", filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        const row = payload.new as { latitude?: number; longitude?: number };
        if (typeof row.latitude === "number" && typeof row.longitude === "number") {
          setDriverPosition({ lat: row.latitude, lng: row.longitude });
        }
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId, trackingActive]);

  // Perbarui marker & polyline saat titik berubah
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;
    const maps = window.google.maps;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new maps.LatLngBounds();
    let hasPoint = false;

    if (origin) {
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
    if (destination) {
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
      const path = decodePolyline(encodedPolyline).map(
        (p) => new maps.LatLng(p.lat, p.lng),
      );
      polylineRef.current = new maps.Polyline({
        map,
        path,
        strokeColor: "#0d9488",
        strokeWeight: 5,
        strokeOpacity: 0.85,
      });
      path.forEach((p: any) => bounds.extend(p));
      hasPoint = true;
    }
    if (hasPoint) {
      map.fitBounds(bounds, 60);
    }
  }, [mapReady, origin, destination, encodedPolyline]);

  // Gerakkan marker driver secara halus saat koordinat GPS baru diterima.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;
    const maps = window.google.maps;

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
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      marker.setPosition({
        lat: start.lat + (end.lat - start.lat) * eased,
        lng: start.lng + (end.lng - start.lng) * eased,
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [mapReady, driverPosition]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-muted p-6 text-sm text-muted-foreground">
        Peta tidak dapat dimuat: {loadError}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? "h-64 w-full rounded-xl border border-border"}
    />
  );
}
