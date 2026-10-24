/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, RefreshCw } from "lucide-react";
import { decodePolyline, loadGoogleMaps } from "@/lib/google-maps-loader";
import { supabase } from "@/integrations/supabase/client";
import { joinTracking } from "@/lib/tracking-channel";

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
  variant?: "card" | "tracking";
  nextStop?: Point | null;
  viewPadding?: { top: number; bottom: number };
  recenterBottom?: number;
  onDriverPosition?: (position: Point, timestamp: number) => void;
}

interface DriverLocationRow {
  latitude: number;
  longitude: number;
  updated_at: string;
  heading?: number | null;
}

export function RouteMap({
  origin,
  destination,
  encodedPolyline,
  orderId,
  trackingActive = true,
  followDriver = false,
  className,
  variant = "card",
  nextStop = null,
  viewPadding = { top: 90, bottom: 240 },
  recenterBottom = 240,
  onDriverPosition,
}: Props) {
  const isTracking = variant === "tracking";
  const onDriverPositionRef = useRef(onDriverPosition);
  onDriverPositionRef.current = onDriverPosition;
  const paddingRef = useRef(viewPadding);
  paddingRef.current = viewPadding;
  const [following, setFollowing] = useState(true);
  const haloRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const latestUpdatedAtRef = useRef(0);
  const updateGapRef = useRef(1500);
  const lastBroadcastRxRef = useRef(0);
  const driverHeadingRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [driverPosition, setDriverPosition] = useState<Point | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [trackingError, setTrackingError] = useState("");

  const applyDriverPosition = useCallback((position: Point, updatedAt?: string, heading?: number | null) => {
    const parsedTimestamp = updatedAt ? Date.parse(updatedAt) : Date.now();
    const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();
    const previous = latestUpdatedAtRef.current;
    if (timestamp < previous) return;
    updateGapRef.current = previous ? Math.min(4000, Math.max(800, timestamp - previous)) : 1500;
    if (typeof heading === "number" && Number.isFinite(heading)) driverHeadingRef.current = heading;
    latestUpdatedAtRef.current = timestamp;
    setDriverPosition(position);
    setLastUpdatedAt(timestamp);
    onDriverPositionRef.current?.(position, timestamp);
  }, []);

  const fetchLatestPosition = useCallback(async (manual = false) => {
    if (!orderId || !trackingActive) return;
    if (manual) setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, updated_at, heading")
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
          row.heading,
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
    if (isTracking) return;
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
          disableDefaultUI: isTracking,
          zoomControl: !isTracking,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          keyboardShortcuts: false,
          gestureHandling: isTracking ? "greedy" : "auto",
        });
        if (isTracking) map.addListener("dragstart", () => setFollowing(false));
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

  // Ambil posisi terakhir, lalu dengarkan saluran realtime bersama dan perubahan database cadangan.
  useEffect(() => {
    if (!orderId || !trackingActive) {
      setDriverPosition(null); setLastUpdatedAt(null); latestUpdatedAtRef.current = 0; return;
    }
    let cancelled = false;
    setDriverPosition(null); setLastUpdatedAt(null); latestUpdatedAtRef.current = 0; setTrackingError("");
    void fetchLatestPosition();
    const handle = joinTracking(orderId, {
      onBroadcast: (payload) => {
        if (cancelled) return;
        if (typeof payload.lat === "number" && typeof payload.lng === "number") {
          lastBroadcastRxRef.current = Date.now();
          applyDriverPosition({ lat: payload.lat, lng: payload.lng }, payload.updated_at, payload.heading);
          setTrackingError("");
        }
      },
      onRow: (row) => {
        if (cancelled) return;
        if (typeof row.latitude === "number" && typeof row.longitude === "number") {
          applyDriverPosition({ lat: row.latitude, lng: row.longitude }, row.updated_at, row.heading);
        }
      },
    });
    return () => { cancelled = true; handle.release(); };
  }, [orderId, trackingActive, fetchLatestPosition, applyDriverPosition]);

  useEffect(() => {
    if (!orderId || !trackingActive) return;
    const timer = window.setInterval(() => { if (Date.now() - lastBroadcastRxRef.current > 8000) void fetchLatestPosition(); }, 5000);
    return () => window.clearInterval(timer);
  }, [orderId, trackingActive, fetchLatestPosition]);

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
        (point) => new maps.LatLng(point.lat, point.lng),
      );
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
    if (hasPoint) map.fitBounds(bounds, isTracking ? { top: paddingRef.current.top, bottom: paddingRef.current.bottom, left: 40, right: 40 } : 60);
  }, [mapReady, origin, destination, encodedPolyline]);

  // Marker bergerak mulus mengikuti selang update, dengan panah searah gerak.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;
    const maps = window.google.maps;
    const makeIcon = (rotation:number) => ({path:maps.SymbolPath.FORWARD_CLOSED_ARROW,scale:isTracking ? 8 : 6,rotation,fillColor:"#0d9488",fillOpacity:1,strokeColor:"#ffffff",strokeWeight:2});
    if (followDriver && driverPosition) map.panTo(driverPosition);
    if (!driverPosition) { if (driverMarkerRef.current) driverMarkerRef.current.setMap(null); driverMarkerRef.current=null; return; }
    if (!driverMarkerRef.current) { if (isTracking) haloRef.current = new maps.Marker({map,position:driverPosition,clickable:false,zIndex:900,icon:{path:maps.SymbolPath.CIRCLE,scale:16,fillColor:"#0d9488",fillOpacity:0.22,strokeOpacity:0}}); driverMarkerRef.current=new maps.Marker({map,position:driverPosition,title:"Posisi driver",zIndex:1000,icon:makeIcon(driverHeadingRef.current)}); return; }
    const marker=driverMarkerRef.current,current=marker.getPosition();
    if (!current) { marker.setPosition(driverPosition); return; }
    const a={lat:current.lat(),lng:current.lng()},b=driverPosition,dist=Math.abs(a.lat-b.lat)+Math.abs(a.lng-b.lng);
    if(dist<0.0000005)return;
    const rad=(v:number)=>v*Math.PI/180,y=Math.sin(rad(b.lng-a.lng))*Math.cos(rad(b.lat)),x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lng-a.lng));
    const computed=(Math.atan2(y,x)*180/Math.PI+360)%360,rotation=dist>0.00002?computed:driverHeadingRef.current;
    marker.setIcon(makeIcon(rotation));
    let frame=0;const started=performance.now(),duration=updateGapRef.current;
    const animate=(time:number)=>{const p=Math.min(1,(time-started)/duration);const pos={lat:a.lat+(b.lat-a.lat)*p,lng:a.lng+(b.lng-a.lng)*p};marker.setPosition(pos);haloRef.current?.setPosition(pos);if(p<1)frame=requestAnimationFrame(animate);};
    frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);
  }, [mapReady, driverPosition, followDriver, isTracking]);

  useEffect(() => {
    if (!isTracking || !mapReady || !driverPosition || !following) return;
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    if (!nextStop) {
      map.panTo(driverPosition);
      if ((map.getZoom() ?? 0) < 17) map.setZoom(17);
      return;
    }
    const distance = (() => {
      const rad = (v: number) => v * Math.PI / 180;
      const dLat = rad(nextStop.lat - driverPosition.lat);
      const dLng = rad(nextStop.lng - driverPosition.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(driverPosition.lat)) * Math.cos(rad(nextStop.lat)) * Math.sin(dLng / 2) ** 2;
      return 12742000 * Math.asin(Math.sqrt(h));
    })();
    if (distance < 150) {
      map.panTo(driverPosition);
      if ((map.getZoom() ?? 0) < 17) map.setZoom(17);
      return;
    }
    const bounds = new maps.LatLngBounds();
    bounds.extend(driverPosition);
    bounds.extend(nextStop);
    map.fitBounds(bounds, { top: paddingRef.current.top, bottom: paddingRef.current.bottom, left: 56, right: 56 });
    maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
    });
  }, [isTracking, mapReady, driverPosition, following, nextStop?.lat, nextStop?.lng]);

  useEffect(() => {
    if (!isTracking || !mapReady) return;
    let pulse = 0;
    const timer = window.setInterval(() => {
      const halo = haloRef.current;
      const maps = window.google?.maps;
      if (!halo || !maps) return;
      pulse += 0.14;
      const k = (Math.sin(pulse) + 1) / 2;
      halo.setIcon({ path: maps.SymbolPath.CIRCLE, scale: 14 + k * 10, fillColor: "#0d9488", fillOpacity: 0.3 - k * 0.22, strokeOpacity: 0 });
    }, 120);
    return () => window.clearInterval(timer);
  }, [isTracking, mapReady]);

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
      {isTracking && orderId && trackingActive && !following && <button type="button" onClick={() => setFollowing(true)} style={{ bottom: recenterBottom }} className="absolute right-3 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground shadow-lg"><LocateFixed className="h-4 w-4 text-primary" />Ikuti driver</button>}
      {!isTracking && orderId && trackingActive && (
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
