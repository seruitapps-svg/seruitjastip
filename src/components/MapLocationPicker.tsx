import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, LoaderCircle, Search } from "lucide-react";

type Coordinates = { lat: number; lng: number };
type GoogleLatLng = { lat: () => number; lng: () => number };
type GoogleMapMouseEvent = { latLng?: GoogleLatLng };
type GoogleMarker = {
  setPosition: (position: Coordinates) => void;
  getPosition: () => GoogleLatLng | null;
  setMap: (map: GoogleMap | null) => void;
  addListener: (event: string, handler: () => void) => void;
};
type GoogleMap = {
  addListener: (event: string, handler: (event: GoogleMapMouseEvent) => void) => void;
  panTo: (position: Coordinates) => void;
  setZoom: (zoom: number) => void;
};
type GooglePlace = {
  geometry?: { location?: GoogleLatLng };
  formatted_address?: string;
  name?: string;
};
type GoogleAutocomplete = {
  addListener: (event: string, handler: () => void) => void;
  getPlace: () => GooglePlace;
};
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    places: { Autocomplete: new (input: HTMLInputElement, options?: Record<string, unknown>) => GoogleAutocomplete };
    event: { clearInstanceListeners: (instance: GoogleMap | GoogleMarker) => void };
  };
};
declare global {
  interface Window { google?: GoogleMapsApi }
}

let googleMapsLoader: Promise<GoogleMapsApi> | null = null;
function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googleMapsLoader) return googleMapsLoader;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps belum dikonfigurasi. Tambahkan VITE_GOOGLE_MAPS_API_KEY di pengaturan environment proyek."));
  }

  googleMapsLoader = new Promise((resolve, reject) => {
    const callbackName = "__seruitGoogleMapsReady";
    const globalWindow = window as Window & { [key: string]: unknown };
    globalWindow[callbackName] = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else reject(new Error("Google Maps berhasil dimuat, tetapi layanan Places belum tersedia."));
      delete globalWindow[callbackName];
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.google?.maps?.places) resolve(window.google);
        else reject(new Error("Google Maps gagal dimuat. Periksa API key dan layanan Places."));
      }, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps gagal dimuat. Periksa koneksi dan API key.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${callbackName}&language=id&region=ID`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => reject(new Error("Google Maps gagal dimuat. Periksa koneksi, API key, dan pembatasan API key."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    googleMapsLoader = null;
    throw error;
  });
  return googleMapsLoader;
}

type MapLocationPickerProps = {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
};

export function MapLocationPicker({ value, onChange }: MapLocationPickerProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let map: GoogleMap | null = null;
    let autocomplete: GoogleAutocomplete | null = null;

    loadGoogleMaps().then((google) => {
      if (cancelled || !mapElementRef.current) return;
      const initial = value ?? { lat: -2.5, lng: 118 };
      map = new google.maps.Map(mapElementRef.current, {
        center: initial,
        zoom: value ? 16 : 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      mapRef.current = map;

      const placeMarker = (point: Coordinates, pan = false) => {
        if (!map) return;
        if (!markerRef.current) {
          markerRef.current = new google.maps.Marker({
            map,
            position: point,
            draggable: true,
            title: "Titik lokasi mitra",
          });
          markerRef.current.addListener("dragend", () => {
            const position = markerRef.current?.getPosition();
            if (position) onChangeRef.current({ lat: position.lat(), lng: position.lng() });
          });
        } else {
          markerRef.current.setPosition(point);
        }
        if (pan) map.panTo(point);
        onChangeRef.current(point);
      };

      if (value) {
        placeMarker(value);
      }

      map.addListener("click", (event) => {
        if (!event.latLng) return;
        placeMarker({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        setSelectedAddress("");
      });

      if (searchInputRef.current) {
        autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          componentRestrictions: { country: "id" },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          const location = place?.geometry?.location;
          if (!location) {
            setError("Pilih alamat dari daftar hasil pencarian.");
            return;
          }
          setError("");
          setSelectedAddress(place.formatted_address || place.name || "");
          const point = { lat: location.lat(), lng: location.lng() };
          placeMarker(point, true);
          map?.setZoom(17);
        });
      }
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : "Google Maps gagal dimuat.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (map) googleMapsLoader && mapRef.current && window.google?.maps.event.clearInstanceListeners(map);
      if (markerRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(markerRef.current as unknown as GoogleMap);
        markerRef.current.setMap(null);
      }
      mapRef.current = null;
      markerRef.current = null;
      autocomplete = null;
    };
  // Map is initialized once; parent changes are applied without re-centering the map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current || !window.google) return;
    if (markerRef.current) markerRef.current.setPosition(value);
    else {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: value,
        draggable: true,
        title: "Titik lokasi mitra",
      });
      markerRef.current.addListener("dragend", () => {
        const position = markerRef.current?.getPosition();
        if (position) onChangeRef.current({ lat: position.lat(), lng: position.lng() });
      });
    }
  }, [value?.lat, value?.lng]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Perangkat ini tidak mendukung lokasi otomatis. Cari alamat atau ketuk peta untuk menentukan titik.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        onChangeRef.current(point);
        if (mapRef.current) {
          mapRef.current.panTo(point);
          mapRef.current.setZoom(17);
          if (window.google && !markerRef.current) {
            markerRef.current = new window.google.maps.Marker({
              map: mapRef.current,
              position: point,
              draggable: true,
              title: "Titik lokasi mitra",
            });
            markerRef.current.addListener("dragend", () => {
              const positionNow = markerRef.current?.getPosition();
              if (positionNow) onChangeRef.current({ lat: positionNow.lat(), lng: positionNow.lng() });
            });
          } else {
            markerRef.current?.setPosition(point);
          }
        }
      },
      () => setError("Izin lokasi tidak diberikan. Cari alamat atau ketuk peta untuk memilih titik."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="search"
          placeholder="Cari nama jalan, gedung, atau tempat..."
          className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          aria-label="Cari alamat di Google Maps"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Pilih hasil pencarian atau ketuk peta. Pin dapat digeser untuk memperbaiki titik.</p>
        <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
          <LocateFixed className="h-3.5 w-3.5" /> Lokasi saya
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border">
        <div ref={mapElementRef} className="h-72 w-full bg-muted sm:h-80" aria-label="Google Maps untuk memilih titik lokasi mitra" />
        {loading && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Memuat Google Maps...</div>}
      </div>
      {value ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><MapPin className="h-4 w-4" /> Titik lokasi sudah dipilih. Pin bisa digeser.</p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">Pilih satu titik pada peta sebelum mengirim pendaftaran.</p>
      )}
      {selectedAddress && <p className="text-xs text-muted-foreground">Hasil pencarian: {selectedAddress}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
