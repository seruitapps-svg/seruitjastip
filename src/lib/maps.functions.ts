import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Koneksi Google Maps belum aktif.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
  };
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.text();
  console.error(`Google Maps gateway gagal [${response.status}]: ${body}`);
  if (response.status === 403) {
    let reason: string | undefined;
    try {
      const parsed = JSON.parse(body);
      reason = parsed?.error?.details?.find(
        (d: { reason?: string }) => d.reason,
      )?.reason;
    } catch {
      // abaikan
    }
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      throw new Error(
        "Kunci server Google Maps dibatasi referrer. Atur pembatasan kunci server ke 'None' atau 'IP addresses' di Google Cloud Console.",
      );
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      throw new Error(
        "Kunci server Google Maps belum mengizinkan API ini. Tambahkan API terkait di daftar API kunci server di Google Cloud Console.",
      );
    }
    throw new Error(
      "Permintaan Google Maps ditolak (403). Periksa pembatasan kunci server di Google Cloud Console.",
    );
  }
  throw new Error(`Layanan peta sedang bermasalah (${response.status}).`);
}

// Bias wilayah Indonesia agar saran alamat relevan
const INDONESIA_BIAS = {
  rectangle: {
    low: { latitude: -11.0, longitude: 94.0 },
    high: { latitude: 6.5, longitude: 141.5 },
  },
};

export const placesAutocomplete = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        input: z.string().trim().min(3).max(120),
        sessionToken: z.string().trim().min(8).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        locationBias: INDONESIA_BIAS,
        languageCode: "id",
      }),
    });
    await ensureOk(response);
    const json = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: { placeId?: string; text?: { text?: string } };
      }>;
    };
    return (json.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        text: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.placeId && s.text)
      .slice(0, 5);
  });

export const placeDetails = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        placeId: z.string().trim().min(3).max(300),
        sessionToken: z.string().trim().min(8).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const url = `${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}?sessionToken=${encodeURIComponent(data.sessionToken)}`;
    const response = await fetch(url, {
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
      },
    });
    await ensureOk(response);
    const json = (await response.json()) as {
      formattedAddress?: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
    };
    if (
      typeof json.location?.latitude !== "number" ||
      typeof json.location?.longitude !== "number"
    ) {
      throw new Error("Lokasi tempat tidak ditemukan. Coba alamat lain.");
    }
    return {
      address: json.formattedAddress ?? json.displayName?.text ?? "",
      lat: json.location.latitude,
      lng: json.location.longitude,
    };
  });

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        origin: z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        }),
        destination: z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const response = await fetch(
      `${GATEWAY_URL}/routes/directions/v2:computeRoutes`,
      {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: data.origin.lat,
                longitude: data.origin.lng,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: data.destination.lat,
                longitude: data.destination.lng,
              },
            },
          },
          travelMode: "TWO_WHEELER",
          languageCode: "id",
        }),
      },
    );
    await ensureOk(response);
    const json = (await response.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
      }>;
    };
    const route = json.routes?.[0];
    if (!route?.distanceMeters) {
      throw new Error(
        "Rute tidak ditemukan antara dua titik ini. Periksa kembali lokasinya.",
      );
    }
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: Number.parseInt(route.duration ?? "0", 10) || 0,
      encodedPolyline: route.polyline?.encodedPolyline ?? "",
    };
  });
