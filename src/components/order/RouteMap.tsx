/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { decodePolyline, loadGoogleMaps } from "@/lib/google-maps-loader";

interface Point {
  lat: number;
  lng: number;
}

interface Props {
  origin: Point | null;
  destination: Point | null;
  encodedPolyline?: string;
  className?: string;
}

export function RouteMap({ origin, destination, encodedPolyline, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
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
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Peta gagal dimuat");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Perbarui marker & polyline saat titik berubah
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
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
  }, [origin, destination, encodedPolyline]);

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
