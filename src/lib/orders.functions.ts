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
    foodOrderType: z.enum(["point", "mitra"]).optional(),
    merchantId: z.string().uuid().optional(),
    foodItems: z.array(z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
    })).max(50).optional(),
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
  )
  .refine(
    (d) => !d.foodOrderType || (d.serviceId === "belanja" && Boolean(d.merchantId)),
    { message: "Identitas outlet Food & Drink tidak lengkap." },
  )
  .refine(
    (d) => d.foodOrderType !== "mitra" || Boolean(d.foodItems?.length),
    { message: "Pilih minimal satu menu Mitra Resto." },
  )
  .refine(
    (d) => d.foodOrderType === "mitra" || !d.foodItems?.length,
    { message: "Rincian menu hanya berlaku untuk Mitra Resto." },
  );

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    // Validasi identitas outlet di server; jangan menebak jenis order dari item_detail.
    if (data.foodOrderType && data.merchantId) {
      const { data: merchant, error: merchantError } = await context.supabase
        .from("merchants")
        .select("id, type, status, is_open")
        .eq("id", data.merchantId)
        .maybeSingle();
      if (merchantError) throw new Error("Gagal memvalidasi outlet Food & Drink.");
      const expectedType = data.foodOrderType === "mitra" ? "official_merchant" : "point_resto";
      if (!merchant || merchant.type !== expectedType || !merchant.is_open || (data.foodOrderType === "mitra" && merchant.status !== "approved")) {
        throw new Error("Outlet tidak valid atau sedang tidak aktif. Silakan pilih outlet yang tersedia.");
      }
    }

    // Harga menu Mitra Resto dihitung dari katalog database, bukan dari harga/subtotal browser.
    let menuSubtotal = 0;
    let canonicalItemDetail = data.itemDetail;
    if (data.foodOrderType === "mitra") {
      if (!data.merchantId || !data.foodItems?.length) {
        throw new Error("Outlet dan menu Mitra Resto wajib dipilih.");
      }
      const productIds = data.foodItems.map((item) => item.productId);
      if (new Set(productIds).size !== productIds.length) {
        throw new Error("Daftar menu mengandung produk duplikat.");
      }
      const { data: products, error: productsError } = await context.supabase
        .from("merchant_products")
        .select("id, merchant_id, name, price, is_available")
        .eq("merchant_id", data.merchantId)
        .in("id", productIds);
      if (productsError) {
        console.error("Mitra menu validation failed:", productsError);
        throw new Error("Gagal memvalidasi harga menu Mitra Resto.");
      }
      if (!products || products.length !== data.foodItems.length || products.some((product) => !product.is_available)) {
        throw new Error("Ada menu yang sudah tidak tersedia. Muat ulang menu lalu coba kembali.");
      }
      const productById = new Map(products.map((product) => [product.id, product]));
      const lines = data.foodItems.map((item) => {
        const product = productById.get(item.productId);
        if (!product || product.merchant_id !== data.merchantId || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
          throw new Error("Data menu Mitra Resto tidak valid.");
        }
        const unitPrice = Math.round(Number(product.price));
        const lineTotal = unitPrice * item.quantity;
        menuSubtotal += lineTotal;
        return `${item.quantity}x ${product.name} @ Rp ${unitPrice.toLocaleString("id-ID")} = Rp ${lineTotal.toLocaleString("id-ID")}`;
      });
      if (!Number.isSafeInteger(menuSubtotal) || menuSubtotal <= 0) {
        throw new Error("Subtotal menu Mitra Resto tidak valid.");
      }
      canonicalItemDetail = lines.join("; ") + `. Total menu: Rp ${menuSubtotal.toLocaleString("id-ID")}.`;
    }

    // Harga rute dan biaya layanan dihitung ulang di server.
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

    const { data: row, error } = await (context.supabase
      .from("orders") as any)
      .insert({
        user_id: context.userId,
        service: data.serviceId,
        status: "tersedia",
        merchant_id: data.foodOrderType ? data.merchantId : null,
        food_order_type: data.foodOrderType ?? null,
        confirmation_pin: null,
        merchant_response: data.foodOrderType === "mitra" ? "pending" : null,
        origin_address: data.origin.address,
        origin_lat: data.origin.lat,
        origin_lng: data.origin.lng,
        dest_address: data.destination.address,
        dest_lat: data.destination.lat,
        dest_lng: data.destination.lng,
        distance_meters: route.distanceMeters,
        duration_seconds: route.durationSeconds,
        encoded_polyline: route.encodedPolyline,
        item_detail: canonicalItemDetail,
        // item_cost is the existing transaction amount used by driver settlement.
        // For Mitra Resto it stores the catalog subtotal; for other services it remains zero.
        item_cost: data.foodOrderType === "mitra" ? menuSubtotal : 0,
        weight_kg: data.weightKg,
        length_cm: data.lengthCm,
        width_cm: data.widthCm,
        height_cm: data.heightCm,
        sender_name: data.senderName,
        sender_wa: data.senderWa,
        // Simpan data pihak ketiga jika diisi (untuk orang lain / kirim paket)
        recipient_name: data.recipientName?.trim() || "",
        recipient_wa: data.recipientWa?.trim() || "",
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
      console.error("Order insert failed:", error.code, error.message, error.details, error.hint);
      throw new Error(`Gagal menyimpan pesanan (${error.code ?? "DB"}): ${error.message}`);
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

    // Kirim push dari server setelah order tersimpan dan pembayaran (jika ada) berhasil.
    try {
      const { dispatchOrderPush } = await import("./push.server");
      await Promise.race([
        dispatchOrderPush({ eventType: "order_created", orderId: row.id, callerId: context.userId }),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } catch (pushError) {
      console.error("Push order baru gagal:", pushError);
    }

    // Kirim push dari server setelah order tersimpan dan pembayaran (jika ada) berhasil.
    try {
      const { dispatchOrderPush } = await import("./push.server");
      await Promise.race([
        dispatchOrderPush({ eventType: "order_created", orderId: row.id, callerId: context.userId }),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } catch (pushError) {
      console.error("Push order baru gagal:", pushError);
    }

    return { id: row.id };
  });
