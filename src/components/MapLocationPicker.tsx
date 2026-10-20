/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, LoaderCircle } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type Coordinates = { lat: number; lng: number };

type MapLocationPickerProps = {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
};

export function MapLocationPicker({ value, onChange }: MapLocationPickerProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapElementRef.current) return;

        const initialPoint = value ?? { lat: -5.45, lng: 105.26 };
        const map = new maps.Map(mapElementRef.current, {
          center: initialPoint,
          zoom: value ? 16 : 12,
          clickableIcons: false,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        mapRef.current = map;

        const updatePoint = (point: Coordinates, panToPoint = false) => {
          if (!markerRef.current) {
            markerRef.current = new maps.Marker({
              map,
              position: point,
              draggable: true,
              title: "Titik lokasi restoran",
            });
            markerRef.current.addListener("dragend", () => {
              const position = markerRef.current?.getPosition();
              if (position) {
                onChangeRef.current({ lat: position.lat(), lng: position.lng() });
              }
            });
          } else {
            markerRef.current.setPosition(point);
          }

          if (panToPoint) map.panTo(point);
          onChangeRef.current(point);
        };

        if (value) {
          markerRef.current = new maps.Marker({
            map,
            position: value,
            draggable: true,
            title: "Titik lokasi restoran",
          });
          markerRef.current.addListener("dragend", () => {
            const position = markerRef.current?.getPosition();
            if (position) {
              onChangeRef.current({ lat: position.lat(), lng: position.lng() });
            }
          });
        }

        map.addListener("click", (event: any) => {
          if (!event.latLng) return;
          updatePoint({
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          });
          setError("");
        });

        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Google Maps gagal dimuat.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  // Peta dibuat sekali; perubahan nilai hanya menggeser marker.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current || !window.google?.maps) return;

    if (!markerRef.current) {
      const maps = window.google.maps;
      markerRef.current = new maps.Marker({
        map: mapRef.current,
        position: value,
        draggable: true,
        title: "Titik lokasi restoran",
      });
      markerRef.current.addListener("dragend", () => {
        const position = markerRef.current?.getPosition();
        if (position) {
          onChangeRef.current({ lat: position.lat(), lng: position.lng() });
        }
      });
    } else {
      markerRef.current.setPosition(value);
    }
  }, [value?.lat, value?.lng]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Perangkat tidak mendukung lokasi otomatis. Ketuk peta untuk menentukan titik.");
      return;
    }

    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        onChangeRef.current(point);

        if (mapRef.current && window.google?.maps) {
          mapRef.current.panTo(point);
          mapRef.current.setZoom(17);

          if (!markerRef.current) {
            const maps = window.google.maps;
            markerRef.current = new maps.Marker({
              map: mapRef.current,
              position: point,
              draggable: true,
              title: "Titik lokasi restoran",
            });
            markerRef.current.addListener("dragend", () => {
              const positionNow = markerRef.current?.getPosition();
              if (positionNow) {
                onChangeRef.current({ lat: positionNow.lat(), lng: positionNow.lng() });
              }
            });
          } else {
            markerRef.current.setPosition(point);
          }
        }
      },
      () => setError("Izin lokasi tidak diberikan. Ketuk peta untuk memilih titik secara manual."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Ketuk titik lokasi restoran pada Google Maps. Geser pin untuk menyesuaikan posisi.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          Gunakan lokasi saya
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border">
        <div
          ref={mapElementRef}
          className="h-72 w-full bg-muted sm:h-80"
          aria-label="Google Maps untuk memilih titik lokasi restoran"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Memuat Google Maps...
          </div>
        )}
      </div>

      {value ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <MapPin className="h-4 w-4" />
          Titik lokasi sudah dipilih. Pin bisa digeser.
        </p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Pilih satu titik di peta sebelum mengirim pendaftaran.
        </p>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
