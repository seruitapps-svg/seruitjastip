import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, LoaderCircle } from "lucide-react";

type Coordinates = { lat: number; lng: number };
type LeafletLatLng = { lat: number; lng: number };
type LeafletEvent = { latlng: LeafletLatLng };
type LeafletMarker = {
  setLatLng: (position: [number, number]) => LeafletMarker;
  getLatLng: () => LeafletLatLng;
  on: (event: string, handler: () => void) => LeafletMarker;
  addTo: (map: LeafletMap) => LeafletMarker;
};
type LeafletMap = {
  setView: (position: [number, number], zoom: number) => LeafletMap;
  on: (event: string, handler: (event: LeafletEvent) => void) => LeafletMap;
  remove: () => void;
  invalidateSize: () => void;
};
type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (position: [number, number], options: Record<string, unknown>) => LeafletMarker;
};
declare global {
  interface Window { L?: LeafletApi }
}

let leafletLoader: Promise<LeafletApi> | null = null;
function loadLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoader) return leafletLoader;
  leafletLoader = new Promise((resolve, reject) => {
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-leaflet-loader="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Peta gagal dimuat.")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Peta gagal dimuat. Periksa koneksi internet.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leafletLoader = "true";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Peta gagal dimuat."));
    script.onerror = () => reject(new Error("Peta gagal dimuat. Periksa koneksi internet."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    leafletLoader = null;
    throw error;
  });
  return leafletLoader;
}

type MapLocationPickerProps = {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
};

export function MapLocationPicker({ value, onChange }: MapLocationPickerProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    loadLeaflet().then((L) => {
      if (cancelled || !mapElementRef.current) return;
      const initial: [number, number] = value ? [value.lat, value.lng] : [-2.5, 118];
      map = L.map(mapElementRef.current, { scrollWheelZoom: true }).setView(initial, value ? 16 : 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const placeMarker = (lat: number, lng: number) => {
        if (!map) return;
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const position = markerRef.current?.getLatLng();
            if (position) onChangeRef.current({ lat: position.lat, lng: position.lng });
          });
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }
        onChangeRef.current({ lat, lng });
      };
      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const position = markerRef.current?.getLatLng();
          if (position) onChangeRef.current({ lat: position.lat, lng: position.lng });
        });
      }
      map.on("click", (event) => placeMarker(event.latlng.lat, event.latlng.lng));
      setLoading(false);
      window.setTimeout(() => map?.invalidateSize(), 100);
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : "Peta gagal dimuat.");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // Map is initialized once; changes are applied by the separate effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current) return;
    if (markerRef.current) markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng], Math.max(16, 16));
  }, [value?.lat, value?.lng]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Perangkat ini tidak mendukung lokasi otomatis. Ketuk peta untuk memilih titik.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        onChangeRef.current(point);
        if (mapRef.current && window.L) {
          if (!markerRef.current) {
            markerRef.current = window.L.marker([point.lat, point.lng], { draggable: true }).addTo(mapRef.current);
            markerRef.current.on("dragend", () => {
              const positionNow = markerRef.current?.getLatLng();
              if (positionNow) onChangeRef.current({ lat: positionNow.lat, lng: positionNow.lng });
            });
          } else {
            markerRef.current.setLatLng([point.lat, point.lng]);
          }
          mapRef.current.setView([point.lat, point.lng], 17);
        }
      },
      () => setError("Lokasi perangkat tidak diizinkan. Ketuk peta untuk menentukan titik restoran."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Ketuk lokasi restoran pada peta. Geser pin merah untuk menyesuaikan posisi.</p>
        <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
          <LocateFixed className="h-3.5 w-3.5" /> Gunakan lokasi saya
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border">
        <div ref={mapElementRef} className="h-72 w-full bg-muted sm:h-80" aria-label="Peta pilih lokasi restoran" />
        {loading && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Memuat peta...</div>}
      </div>
      {value ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><MapPin className="h-4 w-4" /> Titik lokasi sudah dipilih. Pin bisa digeser untuk menyesuaikan.</p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">Pilih satu titik di peta sebelum mengirim pendaftaran.</p>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
