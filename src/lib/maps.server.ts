const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export async function fetchMotorRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Koneksi Google Maps belum aktif.");
  const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: "TWO_WHEELER",
      languageCode: "id",
    }),
  });
  if (!response.ok) {
    console.error("Routes gagal", response.status, await response.text());
    throw new Error("Gagal menghitung rute. Coba lagi.");
  }
  const json = (await response.json()) as {
    routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
  };
  const route = json.routes?.[0];
  if (!route?.distanceMeters) throw new Error("Rute tidak ditemukan antara dua titik ini.");
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: Number.parseInt(route.duration ?? "0", 10) || 0,
    encodedPolyline: route.polyline?.encodedPolyline ?? "",
  };
}
