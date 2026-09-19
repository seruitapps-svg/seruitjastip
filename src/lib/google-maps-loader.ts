/* eslint-disable @typescript-eslint/no-explicit-any */
// Loader singleton untuk Maps JavaScript API (browser key, aman untuk frontend)
let loadPromise: Promise<any> | null = null;

declare global {
  interface Window {
    __seruitInitMap?: () => void;
    google?: any;
  }
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Hanya tersedia di browser"));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    if (!key) {
      reject(new Error("Browser key Google Maps belum tersedia"));
      return;
    }
    window.__seruitInitMap = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps gagal dimuat"));
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__seruitInitMap&channel=${channel ?? ""}`;
    script.async = true;
    script.onerror = () => reject(new Error("Gagal memuat skrip Google Maps"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Dekode polyline terenkripsi (algoritma Google encoded polyline)
export function decodePolyline(
  encoded: string,
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
