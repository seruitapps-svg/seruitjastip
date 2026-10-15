import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import {
  Bike,
  Package,
  Send,
  ShoppingBag,
  MessageCircle,
  Banknote,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { PlaceAutocomplete, type SelectedPlace } from "@/components/order/PlaceAutocomplete";
import { RouteMap } from "@/components/order/RouteMap";
import { computeRoute } from "@/lib/maps.functions";
import { calculatePrice, type PriceBreakdown } from "@/lib/pricing";
import {
  PACKAGE_LIMITS,
  PRICING,
  SERVICES,
  TALANGAN_MAX,
  formatRupiah,
  type ServiceId,
} from "@/lib/config";
import type { OrderData } from "@/lib/wa-message";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seruit — Jasa Titip, Kirim & Belanja" },
      {
        name: "description",
        content:
          "Pesan jasa titip, kirim barang, dan belanja dengan ongkir transparan. Hitung jarak & estimasi harga otomatis, pantau pesanan langsung di aplikasi.",
      },
      { property: "og:title", content: "Seruit — Jasa Titip, Kirim & Belanja" },
      {
        property: "og:description",
        content:
          "Hitung ongkir antar-titik otomatis dan order jastip langsung via WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SERVICE_ICONS: Record<ServiceId, typeof Package> = {
  titip: Package,
  kirim: Send,
  belanja: ShoppingBag,
};

interface Summary {
  order: OrderData;
  price: PriceBreakdown;
  durationSeconds: number;
  encodedPolyline: string;
}

const waRegex = /^(\+62|62|0)8\d{6,11}$/;

function Index() {
  const [serviceId, setServiceId] = useState<ServiceId>("titip");
  const [origin, setOrigin] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [itemDetail, setItemDetail] = useState("");
  const [weightKg, setWeightKg] = useState("1");
  const [lengthCm, setLengthCm] = useState("20");
  const [widthCm, setWidthCm] = useState("20");
  const [heightCm, setHeightCm] = useState("20");
  const [senderName, setSenderName] = useState("");
  const [senderWa, setSenderWa] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientWa, setRecipientWa] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "transfer">("cod");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const publicSettings = useQuery({
    queryKey: ["public-app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings")
        .select("base_fare, per_km, oversize_fee")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const livePricing = {
    baseFare: Number(publicSettings.data?.base_fare ?? PRICING.baseFare),
    perKm: Number(publicSettings.data?.per_km ?? PRICING.perKm),
    oversizeFee: Number(publicSettings.data?.oversize_fee ?? PRICING.oversizeFee),
  };

  const service = SERVICES.find((s) => s.id === serviceId)!;
  const originLabel =
    serviceId === "belanja"
      ? "Lokasi toko / tempat belanja (Titik A)"
      : "Lokasi pengambilan barang (Titik A)";
  const destLabel =
    serviceId === "kirim"
      ? "Lokasi penerima (Titik B)"
      : "Lokasi Anda / tujuan (Titik B)";
  const itemLabel =
    serviceId === "belanja" ? "Daftar belanjaan" : "Deskripsi barang";

  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrderFn = useServerFn(createOrder);
  const [submitting, setSubmitting] = useState(false);

  async function submitOrder() {
    if (!summary) return;
    const o = summary.order;
    setSubmitting(true);
    setFormError("");
    try {
      const res = await createOrderFn({
        data: {
          serviceId: o.serviceId,
          origin: { address: o.originAddress, lat: o.originLat, lng: o.originLng },
          destination: { address: o.destAddress, lat: o.destLat, lng: o.destLng },
          itemDetail: o.itemDetail,
          weightKg: o.weightKg,
          lengthCm: o.lengthCm,
          widthCm: o.widthCm,
          heightCm: o.heightCm,
          senderName: o.senderName,
          senderWa: o.senderWa,
          recipientName: o.recipientName,
          recipientWa: o.recipientWa,
          paymentMethod: o.paymentMethod,
          notes: o.notes,
        },
      });
      navigate({ to: "/pesanan/$id", params: { id: res.id } });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal mengirim pesanan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSummary(null);

    const weight = Number(weightKg);
    const length = Number(lengthCm);
    const width = Number(widthCm);
    const height = Number(heightCm);

    if (!origin) return setFormError("Pilih lokasi titik A dari saran alamat.");
    if (!destination)
      return setFormError("Pilih lokasi titik B dari saran alamat.");
    if (itemDetail.trim().length < 3)
      return setFormError(
        serviceId === "belanja"
          ? "Isi daftar belanjaan Anda."
          : "Isi deskripsi barang.",
      );
    if (![weight, length, width, height].every((n) => Number.isFinite(n) && n > 0))
      return setFormError("Berat dan dimensi harus angka lebih dari 0.");
    if (weight > PACKAGE_LIMITS.hardMaxWeightKg * 5)
      return setFormError("Berat terlalu besar untuk layanan motor.");
    if (senderName.trim().length < 2) return setFormError("Isi nama Anda.");
    if (!waRegex.test(senderWa.trim()))
      return setFormError("Nomor WhatsApp tidak valid. Contoh: 08123456789");
    if (serviceId === "kirim") {
      if (recipientName.trim().length < 2)
        return setFormError("Isi nama penerima.");
      if (!waRegex.test(recipientWa.trim()))
        return setFormError("Nomor WhatsApp penerima tidak valid.");
    }

    setCalculating(true);
    try {
      const route = await computeRoute({
        data: {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
        },
      });
      const price = calculatePrice({
        distanceMeters: route.distanceMeters,
        weightKg: weight,
        lengthCm: length,
        widthCm: width,
        heightCm: height,
      }, livePricing);
      setSummary({
        order: {
          serviceId,
          originAddress: origin.address,
          originLat: origin.lat,
          originLng: origin.lng,
          destAddress: destination.address,
          destLat: destination.lat,
          destLng: destination.lng,
          itemDetail: itemDetail.trim(),
          weightKg: weight,
          lengthCm: length,
          widthCm: width,
          heightCm: height,
          senderName: senderName.trim(),
          senderWa: senderWa.trim(),
          recipientName: recipientName.trim(),
          recipientWa: recipientWa.trim(),
          paymentMethod,
          notes: notes.trim(),
        },
        price,
        durationSeconds: route.durationSeconds,
        encodedPolyline: route.encodedPolyline,
      });
      setTimeout(
        () =>
          document
            .getElementById("ringkasan")
            ?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menghitung rute.",
      );
    } finally {
      setCalculating(false);
    }
  }

  function resetAll() {
    setSummary(null);
    setFormError("");
    setOrigin(null);
    setDestination(null);
    setItemDetail("");
    setNotes("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inputCls =
    "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "mb-1 block text-sm font-medium text-foreground";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <AnnouncementBanner />
      <main className="mx-auto max-w-2xl px-4 pb-16">
        {/* Hero */}
        <section className="py-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Jastip tanpa ribet,
            <br />
            <span className="text-primary">ongkir langsung kelihatan.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Titip barang, kirim ke orang lain, atau minta dibelikan — hitung
            jarak & harga otomatis, pantau pesanan langsung di aplikasi.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
            Tarif: {formatRupiah(livePricing.baseFare)} +{" "}
            {formatRupiah(livePricing.perKm)}/km · Paket s.d.{" "}
            {PACKAGE_LIMITS.maxWeightKg} kg / {PACKAGE_LIMITS.maxDimCm}×
            {PACKAGE_LIMITS.maxDimCm} cm
          </div>
        </section>

        {/* Pilih layanan */}
        <section className="grid grid-cols-3 gap-2">
          {SERVICES.map((s) => {
            const Icon = SERVICE_ICONS[s.id];
            const active = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setSummary(null);
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-accent"
                    : "border-border bg-card hover:bg-accent/50"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="mt-2 text-sm font-semibold text-foreground">
                  {s.name}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {s.tagline}
                </div>
              </button>
            );
          })}
        </section>
        <p className="mt-2 text-xs text-muted-foreground">{service.description}</p>

        {/* Form */}
        <form
          onSubmit={handleCalculate}
          className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <PlaceAutocomplete
            label={originLabel}
            placeholder="Ketik alamat atau nama tempat…"
            value={origin}
            onChange={setOrigin}
          />
          <PlaceAutocomplete
            label={destLabel}
            placeholder="Ketik alamat tujuan…"
            value={destination}
            onChange={setDestination}
          />

          {(origin || destination) && (
            <RouteMap origin={origin} destination={destination} />
          )}

          <div>
            <label className={labelCls}>{itemLabel}</label>
            <textarea
              value={itemDetail}
              onChange={(e) => setItemDetail(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={
                serviceId === "belanja"
                  ? "Contoh: 2 kg beras, 1 L minyak goreng, 10 butir telur…"
                  : "Contoh: dokumen dalam amplop coklat…"
              }
              className={inputCls}
            />
          </div>

          {serviceId === "belanja" && (
            <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
              Driver bisa menalangi belanjaan maks{" "}
              {formatRupiah(TALANGAN_MAX)}. Anda bayar balik talangan + ongkir
              saat barang diterima.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Berat (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className={inputCls}
              />
            </div>
            {[
              ["P", lengthCm, setLengthCm],
              ["L", widthCm, setWidthCm],
              ["T", heightCm, setHeightCm],
            ].map(([lbl, val, setter]) => (
              <div key={lbl as string}>
                <label className={labelCls}>{lbl as string} (cm)</label>
                <input
                  type="number"
                  min="1"
                  value={val as string}
                  onChange={(e) =>
                    (setter as (v: string) => void)(e.target.value)
                  }
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Batas standar: {PACKAGE_LIMITS.maxWeightKg} kg &{" "}
            {PACKAGE_LIMITS.maxDimCm}×{PACKAGE_LIMITS.maxDimCm} cm. Di atas itu
            kena biaya tambahan {formatRupiah(livePricing.oversizeFee)} (selama
            masih muat motor).
          </p>

          {serviceId === "kirim" && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Nama penerima</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  maxLength={60}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>No. WA penerima</label>
                <input
                  type="tel"
                  value={recipientWa}
                  onChange={(e) => setRecipientWa(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  maxLength={16}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nama Anda</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                maxLength={60}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>No. WhatsApp Anda</label>
              <input
                type="tel"
                value={senderWa}
                onChange={(e) => setSenderWa(e.target.value)}
                placeholder="08xxxxxxxxxx"
                maxLength={16}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Catatan (opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="Contoh: barang pecah belah, hati-hati"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Metode pembayaran</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["cod", "COD", "Tunai ke driver", Banknote],
                  ["transfer", "Transfer", "Scan QRIS", QrCode],
                ] as const
              ).map(([id, name, sub, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    paymentMethod === id
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-accent/50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${paymentMethod === id ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={calculating}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {calculating ? "Menghitung rute…" : "Hitung Estimasi Harga"}
          </button>
        </form>

        {/* Ringkasan */}
        {summary && (
          <section
            id="ringkasan"
            className="mt-6 space-y-4 rounded-2xl border border-primary/40 bg-card p-4 shadow-md"
          >
            <h2 className="text-lg font-bold text-foreground">
              Ringkasan Order
            </h2>

            <RouteMap
              origin={{ lat: summary.order.originLat, lng: summary.order.originLng }}
              destination={{ lat: summary.order.destLat, lng: summary.order.destLng }}
              encodedPolyline={summary.encodedPolyline}
              className="h-56 w-full rounded-xl border border-border"
            />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Layanan</span>
                <span className="text-right font-medium text-foreground">
                  {service.name}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Dari</span>
                <span className="max-w-[60%] text-right font-medium text-foreground">
                  {summary.order.originAddress}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ke</span>
                <span className="max-w-[60%] text-right font-medium text-foreground">
                  {summary.order.destAddress}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Jarak</span>
                <span className="font-medium text-foreground">
                  {summary.price.distanceKm.toFixed(1)} km · ±
                  {Math.round(summary.durationSeconds / 60)} menit
                </span>
              </div>
            </div>

            <div className="space-y-1 rounded-xl bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tarif dasar</span>
                <span className="text-foreground">
                  {formatRupiah(summary.price.baseFare)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Jarak ({summary.price.billedKm} km ×{" "}
                  {formatRupiah(livePricing.perKm)})
                </span>
                <span className="text-foreground">
                  {formatRupiah(summary.price.distanceFare)}
                </span>
              </div>
              {summary.price.oversize && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Biaya tambahan paket besar
                  </span>
                  <span className="text-foreground">
                    {formatRupiah(summary.price.oversizeFee)}
                  </span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
                <span className="text-foreground">Total estimasi</span>
                <span className="text-primary">
                  {formatRupiah(summary.price.total)}
                </span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Harga final dikonfirmasi admin saat verifikasi.
              </p>
            </div>

            {summary.price.needsAdminConfirm && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                ⚠️ Paket kemungkinan terlalu besar untuk motor. Kirim order
                dulu — admin akan konfirmasi ketersediaan armada.
              </p>
            )}

            {summary.order.paymentMethod === "transfer" && (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Bayar via QRIS
                </p>
                <div className="mx-auto mt-3 flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
                  <div className="px-4 text-center">
                    <QrCode className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      QRIS resmi segera hadir — admin akan kirim kode QRIS via
                      WhatsApp setelah order masuk.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-lg font-bold text-primary">
                  {formatRupiah(summary.price.total)}
                </p>
              </div>
            )}

            {formError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
            )}
            {user ? (
              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <MessageCircle className="h-5 w-5" />
                {submitting ? "Mengirim…" : "Kirim Pesanan"}
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
              >
                Masuk untuk mengirim pesanan
              </Link>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Pesanan akan diverifikasi admin, lalu diteruskan ke driver. Pantau status & chat di halaman pesanan.
            </p>

            <button
              type="button"
              onClick={resetAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              <RotateCcw className="h-4 w-4" />
              Buat Order Baru
            </button>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Seruit — jasa titip, kirim & belanja. Pesanan diverifikasi admin.
        </footer>
      </main>
    </div>
  );
}
