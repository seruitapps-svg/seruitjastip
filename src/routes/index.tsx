import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { JastipCatalog } from "@/components/jastip/JastipCatalog";
import {
  Bike,
  Send,
  ShoppingBag,
  Car,
  Truck,
  UtensilsCrossed,
  Smartphone,
  Banknote,
  QrCode,
  Zap,
  CalendarClock,
  ArrowLeft,
  UserCheck,
  Store,
  MapPin,
} from "lucide-react";
import { PlaceAutocomplete, type SelectedPlace } from "@/components/order/PlaceAutocomplete";
import { RouteMap } from "@/components/order/RouteMap";
import { computeRoute } from "@/lib/maps.functions";
import { calculatePrice, type PriceBreakdown } from "@/lib/pricing";
import {
  PACKAGE_LIMITS,
  PRICING,
  TALANGAN_MAX,
  formatRupiah,
} from "@/lib/config";
import type { OrderData } from "@/lib/wa-message";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seruit — Jasa Titip, Kirim & Transportasi" },
      {
        name: "description",
        content:
          "Layanan On-Bid instan dan Jastip terjadwal. Kirim barang, belanja, ojek, car, dan pickup dengan tarif transparan.",
      },
    ],
  }),
  component: Index,
});

export type ExtendedServiceId =
  | "kirim"
  | "belanja"
  | "ojek"
  | "car"
  | "pickup"
  | "food"
  | "digistore";

interface MenuCategory {
  id: ExtendedServiceId;
  name: string;
  tagline: string;
  badge?: string;
  icon: typeof Bike;
  isActionable: boolean;
}

const ONBID_SERVICES: MenuCategory[] = [
  {
    id: "kirim",
    name: "Kirim Paket",
    tagline: "Antar barang instan motor",
    icon: Send,
    isActionable: true,
  },
  {
    id: "belanja",
    name: "Jastip Belanja",
    tagline: "Talangan s.d 100rb",
    icon: ShoppingBag,
    isActionable: true,
  },
  {
    id: "ojek",
    name: "Ojek Motor",
    tagline: "Antar 1 penumpang cepat",
    icon: Bike,
    isActionable: true,
  },
  {
    id: "car",
    name: "Seruit Car",
    tagline: "Taksi mobil penumpang",
    badge: "Mobil",
    icon: Car,
    isActionable: true,
  },
  {
    id: "pickup",
    name: "Pick Up",
    tagline: "Angkut barang besar/pindahan",
    badge: "Cargo",
    icon: Truck,
    isActionable: true,
  },
  {
    id: "food",
    name: "Food & Drink",
    tagline: "Point Resto & Mitra",
    badge: "Kuliner",
    icon: UtensilsCrossed,
    isActionable: true,
  },
  {
    id: "digistore",
    name: "Digistore",
    tagline: "Pulsa, Paket Data & PLN",
    badge: "Segera Hadir",
    icon: Smartphone,
    isActionable: false,
  },
];

interface Summary {
  order: OrderData;
  price: PriceBreakdown;
  durationSeconds: number;
  encodedPolyline: string;
}

const waRegex = /^(\+62|62|0)8\d{6,11}$/;

function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrderFn = useServerFn(createOrder);

  const [mode, setMode] = useState<"onbid" | "jastip">("onbid");
  const [selectedService, setSelectedService] = useState<ExtendedServiceId | null>(null);
  const [foodType, setFoodType] = useState<"point" | "mitra">("point");
  const [showDigistoreModal, setShowDigistoreModal] = useState(false);

  // Form states
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
  const [isForOther, setIsForOther] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"cod" | "transfer">("cod");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Ambil profil login
  const profileQuery = useQuery({
    queryKey: ["user-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Prefill data sender dari profil jika login
  useEffect(() => {
    if (profileQuery.data && !isForOther) {
      if (profileQuery.data.full_name) setSenderName(profileQuery.data.full_name);
      if (profileQuery.data.phone) setSenderWa(profileQuery.data.phone);
    }
  }, [profileQuery.data, isForOther]);

  // Tarif dari app_settings
  const publicSettings = useQuery({
    queryKey: ["public-app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("base_fare, per_km, oversize_fee, ojek_base_fare, ojek_per_km")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const m = localStorage.getItem("seruit-mode");
    if (m === "onbid" || m === "jastip") setMode(m);
  }, []);

  function changeMode(m: "onbid" | "jastip") {
    setMode(m);
    setSelectedService(null);
    setSummary(null);
    localStorage.setItem("seruit-mode", m);
  }

  // Tentukan tarif aktif berdasarkan layanan
  const isOjek = selectedService === "ojek";
  const isCar = selectedService === "car";
  const isPickup = selectedService === "pickup";
  const needsDimensions = selectedService === "kirim" || isPickup;

  const activeRates = isOjek
    ? {
        baseFare: Number(publicSettings.data?.ojek_base_fare ?? 3000),
        perKm: Number(publicSettings.data?.ojek_per_km ?? 1500),
        oversizeFee: 0,
      }
    : isCar
    ? {
        baseFare: 8000,
        perKm: 3500,
        oversizeFee: 0,
      }
    : isPickup
    ? {
        baseFare: 25000,
        perKm: 5000,
        oversizeFee: 0,
      }
    : {
        baseFare: Number(publicSettings.data?.base_fare ?? PRICING.baseFare),
        perKm: Number(publicSettings.data?.per_km ?? PRICING.perKm),
        oversizeFee: Number(publicSettings.data?.oversize_fee ?? PRICING.oversizeFee),
      };

  function handleSelectMenu(srv: MenuCategory) {
    if (!srv.isActionable) {
      setShowDigistoreModal(true);
      return;
    }
    setSelectedService(srv.id);
    setSummary(null);
    setFormError("");
    window.scrollTo({ top: 180, behavior: "smooth" });
  }

  // Label dinamis
  const originLabel =
    selectedService === "belanja"
      ? "Lokasi Toko / Pasar (Titik A)"
      : selectedService === "food"
      ? "Titik Lokasi Resto / Warung (Titik A)"
      : "Titik Penjemputan / Asal (Titik A)";

  const destLabel =
    selectedService === "kirim" || selectedService === "pickup"
      ? "Lokasi Pengantaran / Penerima (Titik B)"
      : "Lokasi Anda / Tujuan (Titik B)";

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSummary(null);

    if (!selectedService) return;
    if (!origin) return setFormError("Pilih lokasi Titik A dari saran alamat.");
    if (!destination) return setFormError("Pilih lokasi Titik B dari saran alamat.");

    const weight = Number(weightKg);
    const length = Number(lengthCm);
    const width = Number(widthCm);
    const height = Number(heightCm);

    if (needsDimensions) {
      if (![weight, length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
        return setFormError("Berat dan dimensi harus berupa angka valid di atas 0.");
      }
    }

    if (
      (selectedService === "kirim" ||
        selectedService === "belanja" ||
        selectedService === "food" ||
        selectedService === "pickup") &&
      itemDetail.trim().length < 3
    ) {
      return setFormError(
        selectedService === "food"
          ? "Isi daftar pesanan makanan / minuman yang ingin dibeli."
          : selectedService === "belanja"
          ? "Isi daftar barang yang perlu dibelanjakan."
          : "Isi rincian muatan / barang."
      );
    }

    if (senderName.trim().length < 2) return setFormError("Isi nama pemesan.");
    if (!waRegex.test(senderWa.trim())) {
      return setFormError("Nomor WhatsApp pemesan tidak valid (contoh: 08123456789).");
    }

    if (selectedService === "kirim" || selectedService === "pickup") {
      if (recipientName.trim().length < 2) return setFormError("Isi nama penerima barang.");
      if (!waRegex.test(recipientWa.trim())) {
        return setFormError("Nomor WhatsApp penerima tidak valid.");
      }
    }

    setCalculating(true);
    try {
      const route = await computeRoute({
        data: {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
        },
      });

      const dims = needsDimensions
        ? { weightKg: weight, lengthCm: length, widthCm: width, heightCm: height }
        : { weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 };

      const price = calculatePrice(
        { distanceMeters: route.distanceMeters, ...dims },
        activeRates
      );

      const resolvedDetail =
        isOjek
          ? "Ojek Motor (1 Penumpang)"
          : isCar
          ? "Seruit Car (Taksi Penumpang Mobil)"
          : itemDetail.trim();

      // Mapping fallback service id yang didukung createOrder
      const resolvedServiceId =
        selectedService === "car" || selectedService === "ojek"
          ? "ojek"
          : selectedService === "belanja" || selectedService === "food"
          ? "belanja"
          : "kirim";

      setSummary({
        order: {
          serviceId: resolvedServiceId,
          originAddress: origin.address,
          originLat: origin.lat,
          originLng: origin.lng,
          destAddress: destination.address,
          destLat: destination.lat,
          destLng: destination.lng,
          itemDetail: resolvedDetail,
          ...dims,
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

      setTimeout(() => {
        document.getElementById("ringkasan")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menghitung rute.");
    } finally {
      setCalculating(false);
    }
  }

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <AnnouncementBanner />

      <main className="mx-auto max-w-2xl px-4 pb-20">
        {/* Switcher Mode: On-Bid vs Jastip */}
        <div className="sticky top-[57px] z-20 -mx-4 bg-background/95 px-4 pt-3 pb-2 backdrop-blur">
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted p-1">
            {([
              ["onbid", "On-Bid", "Langsung jalan", Zap],
              ["jastip", "Jastip", "Jadwal trayek", CalendarClock],
            ] as const).map(([id, name, sub, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => changeMode(id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  mode === id ? "bg-card shadow-sm" : "hover:bg-card/50"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${mode === id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">{name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hero Banner */}
        <section className="py-5 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {mode === "onbid" ? "Mau diantar kemana hari ini?" : "Jastip Terjadwal Antar Wilayah"}
          </h1>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
            {mode === "onbid"
              ? "Pilih layanan di bawah untuk langsung hitung estimasi ongkir otomatis."
              : "Pesan titipan barang atau tiket penumpang pada jadwal driver yang tersedia."}
          </p>
        </section>

        {mode === "jastip" ? (
          <JastipCatalog />
        ) : (
          <>
            {/* GRID KATALOG MENU UTAMA ON-BID */}
            {!selectedService ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground">Pilih Layanan Siap Jalan</h2>
                  <span className="text-xs text-muted-foreground">Order instan & cepat</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {ONBID_SERVICES.map((srv) => {
                    const Icon = srv.icon;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleSelectMenu(srv)}
                        className="group relative flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-3 text-center transition-all hover:border-primary/50 hover:bg-accent/40 active:scale-95"
                      >
                        {srv.badge && (
                          <span className="absolute -top-1.5 right-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary border border-primary/20">
                            {srv.badge}
                          </span>
                        )}
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="mt-2 block text-xs font-bold text-foreground leading-tight">
                          {srv.name}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground line-clamp-1">
                          {srv.tagline}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Banner Status Akun Login */}
                {user ? (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Masuk sebagai:{" "}
                        <strong className="text-foreground">
                          {profileQuery.data?.full_name || user.email}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Data diri otomatis terisi</span>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Sudah punya akun?{" "}
                    <Link to="/masuk" className="font-semibold text-primary underline">
                      Masuk sekarang
                    </Link>{" "}
                    agar tidak perlu mengetik data diri setiap kali order.
                  </div>
                )}
              </section>
            ) : (
              /* FORM ORDER YANG DIBUKA SETELAH MEMILIH MENU */
              <div className="space-y-4">
                {/* Header Sub-Menu dengan tombol kembali */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedService(null);
                        setSummary(null);
                      }}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {ONBID_SERVICES.find((s) => s.id === selectedService)?.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {ONBID_SERVICES.find((s) => s.id === selectedService)?.tagline}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="text-xs font-semibold text-primary"
                  >
                    Ganti Layanan
                  </button>
                </div>

                {/* Tab Khusus Food & Drink */}
                {selectedService === "food" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted p-1">
                      <button
                        type="button"
                        onClick={() => setFoodType("point")}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                          foodType === "point" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Point Resto (Bebas Pilih)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFoodType("mitra")}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                          foodType === "mitra" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        <Store className="h-3.5 w-3.5 text-primary" />
                        Mitra Resto Resmi
                      </button>
                    </div>

                    {foodType === "mitra" && (
                      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                        <Store className="mx-auto h-8 w-8 text-primary" />
                        <h3 className="mt-2 text-sm font-bold text-foreground">
                          Katalog Mitra Resto Segera Hadir
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Fitur merchant & menu mandiri sedang disiapkan. Sementara ini, Anda dapat menggunakan opsi <strong>Point Resto</strong> untuk memesan dari warung/resto mana saja.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Form Perhitungan & Pemesanan */}
                {(selectedService !== "food" || foodType === "point") && (
                  <form
                    onSubmit={handleCalculate}
                    className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <PlaceAutocomplete
                      label={originLabel}
                      placeholder="Ketik nama tempat/warung atau alamat penjemputan…"
                      value={origin}
                      onChange={setOrigin}
                    />
                    <PlaceAutocomplete
                      label={destLabel}
                      placeholder="Ketik alamat pengantaran/tujuan…"
                      value={destination}
                      onChange={setDestination}
                    />

                    {(origin || destination) && (
                      <RouteMap origin={origin} destination={destination} />
                    )}

                    {/* Deskripsi Barang / Pesanan */}
                    {!isOjek && !isCar && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          {selectedService === "food"
                            ? "Daftar Menu & Catatan Pesanan Makanan"
                            : selectedService === "belanja"
                            ? "Daftar Barang Belanjaan"
                            : "Deskripsi Muatan / Barang"}
                        </label>
                        <textarea
                          value={itemDetail}
                          onChange={(e) => setItemDetail(e.target.value)}
                          rows={3}
                          maxLength={500}
                          placeholder={
                            selectedService === "food"
                              ? "Contoh: 2 Nasi Goreng Spesial pedas sedang, 2 Es Teh Manis..."
                              : selectedService === "belanja"
                              ? "Contoh: 2 kg beras, 1 L minyak goreng, 1 pack telur..."
                              : "Contoh: 3 kardus pakaian, barang aman dan kering..."
                          }
                          className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    )}

                    {selectedService === "belanja" && (
                      <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                        Driver bisa menalangi belanjaan maks {formatRupiah(TALANGAN_MAX)}. Anda bayar balik saat barang diterima.
                      </p>
                    )}

                    {/* Berat & Dimensi hanya untuk Kirim Paket & Pick Up */}
                    {needsDimensions && (
                      <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3">
                        <div className="text-xs font-bold text-foreground">Ukuran & Berat Paket</div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Berat (kg)</label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={weightKg}
                              onChange={(e) => setWeightKg(e.target.value)}
                              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          {[
                            ["P", lengthCm, setLengthCm],
                            ["L", widthCm, setWidthCm],
                            ["T", heightCm, setHeightCm],
                          ].map(([lbl, val, setter]) => (
                            <div key={lbl as string}>
                              <label className="mb-1 block text-xs text-muted-foreground">{lbl as string} (cm)</label>
                              <input
                                type="number"
                                min="1"
                                value={val as string}
                                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Penerima Barang (hanya kirim & pickup) */}
                    {(selectedService === "kirim" || selectedService === "pickup") && (
                      <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">Nama Penerima</label>
                          <input
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="Nama yang menerima"
                            maxLength={60}
                            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">No. WA Penerima</label>
                          <input
                            type="tel"
                            value={recipientWa}
                            onChange={(e) => setRecipientWa(e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            maxLength={16}
                            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                    )}

                    {/* Data Diri Pemesan */}
                    <div className="space-y-2 rounded-xl border border-border/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Kontak Pemesan</span>
                        {user && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isForOther}
                              onChange={(e) => {
                                setIsForOther(e.target.checked);
                                if (!e.target.checked && profileQuery.data) {
                                  setSenderName(profileQuery.data.full_name || "");
                                  setSenderWa(profileQuery.data.phone || "");
                                }
                              }}
                              className="rounded border-input text-primary"
                            />
                            Pesan untuk orang lain
                          </label>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Nama Anda</label>
                          <input
                            type="text"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            maxLength={60}
                            placeholder="Nama lengkap pemesan"
                            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Nomor WhatsApp</label>
                          <input
                            type="tel"
                            value={senderWa}
                            onChange={(e) => setSenderWa(e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            maxLength={16}
                            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Catatan Driver */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Catatan Tambahan (opsional)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={200}
                        placeholder="Contoh: jangan tekan bel, hubungi WA saat sampai"
                        className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Metode Pembayaran */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Metode Pembayaran</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ["cod", "COD", "Tunai ke driver", Banknote],
                          ["transfer", "Transfer", "Scan QRIS", QrCode],
                        ] as const).map(([id, name, sub, Icon]) => (
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
                              <div className="text-sm font-semibold text-foreground">{name}</div>
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
                      {calculating ? "Menghitung rute & ongkir…" : "Hitung Estimasi Harga"}
                    </button>
                  </form>
                )}

                {/* Ringkasan Estimasi Harga */}
                {summary && (
                  <section
                    id="ringkasan"
                    className="mt-6 space-y-4 rounded-2xl border border-primary/40 bg-card p-4 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-foreground">Ringkasan Order</h2>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {ONBID_SERVICES.find((s) => s.id === selectedService)?.name}
                      </span>
                    </div>

                    <RouteMap
                      origin={{ lat: summary.order.originLat, lng: summary.order.originLng }}
                      destination={{ lat: summary.order.destLat, lng: summary.order.destLng }}
                      encodedPolyline={summary.encodedPolyline}
                      className="h-52 w-full rounded-xl border border-border"
                    />

                    <div className="space-y-1.5 text-xs sm:text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Titik Asal</span>
                        <span className="max-w-[65%] text-right font-medium text-foreground truncate">
                          {summary.order.originAddress}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Titik Tujuan</span>
                        <span className="max-w-[65%] text-right font-medium text-foreground truncate">
                          {summary.order.destAddress}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Jarak & Durasi</span>
                        <span className="font-medium text-foreground">
                          {summary.price.distanceKm.toFixed(1)} km · ±{Math.round(summary.durationSeconds / 60)} menit
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 rounded-xl bg-muted p-3 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Biaya Layanan Aplikasi</span>
                        <span className="text-foreground">{formatRupiah(summary.price.serviceFee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ongkos Kirim</span>
                        <span className="text-foreground">{formatRupiah(summary.price.shippingFare)}</span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm sm:text-base font-bold">
                        <span className="text-foreground">Total Estimasi</span>
                        <span className="text-primary">{formatRupiah(summary.price.total)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={submitOrder}
                      className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {submitting ? "Memproses Order…" : "Konfirmasi & Buat Pesanan"}
                    </button>
                  </section>
                )}
              </div>
            )}
          </>
        )}

        {/* Modal Digistore (Segera Hadir) */}
        {showDigistoreModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-lg">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Smartphone className="h-7 w-7" />
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">Seruit Digistore</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Layanan pembelian pulsa, paket data, voucher game, dan token listrik PLN sedang dalam tahap integrasi PPOB dan akan segera aktif.
              </p>
              <button
                type="button"
                onClick={() => setShowDigistoreModal(false)}
                className="mt-4 w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
