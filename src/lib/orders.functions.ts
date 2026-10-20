import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePrice } from "./pricing";
import { fetchMotorRoute } from "./maps.server";

const point = z.object({
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const wa = z.string().trim().regex(/^(\+62|62|0)8\d{6,11}$/, "Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau +628xxxxxxxxxx.");

const schema = z
  .object({
    serviceId: z.enum(["titip", "kirim", "belanja", "ojek"]),
    origin: point,
    destination: point,
    itemDetail: z.string().trim().min(3).max(500),
    weightKg: z.number().positive().max(100),
    lengthCm: z.number().positive().max(500),
    widthCm: z.number().positive().max(500),
    heightCm: z.number().positive().max(500),
    senderName: z.string().trim().min(2).max(60),
    senderWa: wa,
    recipientName: z.string().trim().max(60),
    recipientWa: z.string().trim().max(16),
    paymentMethod: z.enum(["cod", "transfer", "wallet"]),
    notes: z.string().trim().max(200),
  })
  .refine(
    (d) => d.serviceId !== "kirim" || (d.recipientName.length >= 2 && wa.safeParse(d.recipientWa).success),
    { message: "Data penerima tidak valid" },
  );

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    // Harga dihitung ulang di server — angka dari browser tidak dipercaya.
    const route = await fetchMotorRoute(data.origin, data.destination);
    const { data: settings, error: settingsError } = await context.supabase
      .from("app_settings")
      .select("base_fare, per_km, oversize_fee")
      .eq("id", 1)
      .single();
    if (settingsError) {
      console.error(settingsError);
      throw new Error("Gagal memuat pengaturan tarif.");
    }

    const price = calculatePrice(
      {
        distanceMeters: route.distanceMeters,
        weightKg: data.weightKg,
        lengthCm: data.lengthCm,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
      },
      {
        baseFare: Number(settings.base_fare),
        perKm: Number(settings.per_km),
        oversizeFee: Number(settings.oversize_fee),
      },
    );

    const { data: row, error } = await context.supabase
      .from("orders")
      .insert({
        user_id: context.userId,
        service: data.serviceId,
        origin_address: data.origin.address,
        origin_lat: data.origin.lat,
        origin_lng: data.origin.lng,
        dest_address: data.destination.address,
        dest_lat: data.destination.lat,
        dest_lng: data.destination.lng,
        distance_meters: route.distanceMeters,
        duration_seconds: route.durationSeconds,
        encoded_polyline: route.encodedPolyline,
        item_detail: data.itemDetail,
        weight_kg: data.weightKg,
        length_cm: data.lengthCm,
        width_cm: data.widthCm,
        height_cm: data.heightCm,
        sender_name: data.senderName,
        sender_wa: data.senderWa,
        recipient_name: data.serviceId === "kirim" ? data.recipientName : "",
        recipient_wa: data.serviceId === "kirim" ? data.recipientWa : "",
        payment_method: data.paymentMethod,
        notes: data.notes,
        base_fare: price.baseFare,
        distance_fare: price.distanceFare,
        oversize_fee: price.oversizeFee,
        total: price.total,
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      throw new Error("Gagal menyimpan pesanan.");
    }

    if (data.paymentMethod === "wallet") {
      // RPC berjalan di server/database; saldo tidak pernah dipotong dari browser.
      const walletDb = context.supabase as unknown as {
        rpc: (name: string, args: Record<string, string>) => Promise<{ error: { message?: string } | null }>;
      };
      const { error: paymentError } = await walletDb.rpc("pay_order_with_user_wallet", {
        _order_id: row.id,
      });

      if (paymentError) {
        console.error("Pembayaran saldo user gagal:", paymentError);
        // Jangan tinggalkan pesanan yang masih bisa diambil driver jika pembayaran gagal.
        const { error: cancelError } = await walletDb.rpc("cancel_order", {
          _order_id: row.id,
          _note: "Pembayaran saldo user gagal",
        });
        if (cancelError) console.error("Gagal membatalkan pesanan setelah pembayaran gagal:", cancelError);

        if (/insufficient|saldo|balance/i.test(paymentError.message ?? "")) {
          throw new Error("Saldo user tidak mencukupi. Silakan top up saldo lalu coba pesan kembali.");
        }
        throw new Error("Pembayaran saldo gagal diproses. Pesanan dibatalkan jika pembatalan diizinkan. Periksa daftar pesanan sebelum mencoba kembali.");
      }
    }

    return { id: row.id };
  });
