import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Wallet,
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
      { title: "Mider — Metro Jastip Order | Titip, Kirim & Transportasi" },
      {
        name: "description",
        content:
          "Mider (Metro Jastip Order): layanan On-Bid instan dan Jastip terjadwal. Kirim barang, belanja, ojek, car, dan pickup dengan tarif transparan.",
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
  description: string;
  badge?: string;
  icon: typeof Bike;
  isActionable: boolean;
}

const ONBID_SERVICES: MenuCategory[] = [
  {
    id: "kirim",
    name: "Kirim Paket",
    description: "Antar paket & dokumen instan via motor dengan tarif per km transparan.",
    icon: Send,
    isActionable: true,
  },
  {
    id: "belanja",
    name: "Jastip Belanja",
    description: "Driver membelikan pesanan di toko/pasar dengan talangan s.d Rp 100.000.",
    icon: ShoppingBag,
    isActionable: true,
  },
  {
    id: "ojek",
    name: "Ojek Motor",
    description: "Antar jemput 1 penumpang cepat sampai tujuan.",
    icon: Bike,
    isActionable: true,
  },
  {
    id: "car",
    name: "Mider Car",
    description: "Taksi mobil penumpang nyaman untuk perjalanan sendiri atau rombongan.",
    badge: "Mobil",
    icon: Car,
    isActionable: true,
  },
  {
    id: "pickup",
    name: "Pick Up",
    description: "Layanan angkut barang besar, kargo, atau pindahan rumah/toko.",
    badge: "Kargo",
    icon: Truck,
    isActionable: true,
  },
  {
    id: "food",
    name: "Food & Drink",
    description: "Pesan makanan & minuman dari warung pilihan Anda atau mitra resmi.",
    badge: "Kuliner",
    icon: UtensilsCrossed,
    isActionable: true,
  },
  {
    id: "digistore",
    name: "Digistore",
    description: "Beli pulsa, paket kuota internet, voucher, dan token listrik PLN instan.",
    badge: "Next",
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
  const [showFoodOrderForm, setShowFoodOrderForm] = useState(false);
  const [showDigistoreModal, setShowDigistoreModal] = useState(false);

  // Form states
  const [origin, setOrigin] = useState<SelectedPlace | null>(null);
  const [selectedRestoId, setSelectedRestoId] = useState<string | null>(null);
  const [selectedMenuQuantities, setSelectedMenuQuantities] = useState<Record<string, number>>({});

  const pointRestos = useQuery({
    queryKey: ["point-restos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, address, latitude, longitude, image_url")
        .eq("type", "point_resto")
        .eq("is_open", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: selectedService === "food" && foodType === "point",
  });

  const officialRestos = useQuery({
    queryKey: ["official-merchant-restos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, address, latitude, longitude, image_url, is_open")
        .eq("type", "official_merchant")
        .eq("status", "approved")
        .eq("is_open", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: selectedService === "food" && foodType === "mitra",
  });

  const merchantProducts = useQuery({
    queryKey: ["public-merchant-products", selectedRestoId],
    enabled: selectedService === "food" && foodType === "mitra" && !!selectedRestoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("id, merchant_id, name, description, price, image_url, is_available")
        .eq("merchant_id", selectedRestoId!)
        .eq("is_available", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedMenuTotal = (merchantProducts.data ?? []).reduce(
    (total, product) => total + Math.round(Number(product.price)) * (selectedMenuQuantities[product.id] ?? 0),
    0,
  );

  function changeMenuQuantity(product: { id: string; name: string; price: number | string }, delta: number) {
    setSelectedMenuQuantities((current) => {
      const nextQuantity = Math.max(0, (current[product.id] ?? 0) + delta);
      const next = { ...current };
      if (nextQuantity === 0) delete next[product.id];
      else next[product.id] = nextQuantity;
      const lines = (merchantProducts.data ?? []).map((item) => {
        const quantity = item.id === product.id ? nextQuantity : (next[item.id] ?? 0);
        return quantity > 0
          ? `${quantity}x ${item.name} @ ${formatRupiah(Number(item.price))} = ${formatRupiah(Number(item.price) * quantity)}`
          : null;
      }).filter((line): line is string => Boolean(line));
      const total = (merchantProducts.data ?? []).reduce((sum, item) => {
        const quantity = item.id === product.id ? nextQuantity : (next[item.id] ?? 0);
        return sum + Number(item.price) * quantity;
      }, 0);
      setItemDetail(lines.length ? `${lines.join("; ")}. Total menu: ${formatRupiah(total)}.` : "");
      return next;
    });
    setSummary(null);
  }

  function pickResto(resto: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  }) {
    setSelectedRestoId(resto.id);
    setShowFoodOrderForm(false);
    setSelectedMenuQuantities({});
    setItemDetail("");
    setSummary(null);
    if (resto.latitude != null && resto.longitude != null) {
      setOrigin({
        address: `${resto.name} — ${resto.address}`,
        lat: resto.latitude,
        lng: resto.longitude,
      });
    } else {
      setOrigin(null);
    }
  }
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

  const [paymentMethod, setPaymentMethod] = useState<"cod" | "transfer" | "wallet">("cod");
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

  const userWalletQuery = useQuery({
    queryKey: ["order-user-wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
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
    setShowFoodOrderForm(false);
    setSelectedRestoId(null);
    setSelectedMenuQuantities({});
    setItemDetail("");
    setOrigin(null);
    setSummary(null);
    setFormError("");
    window.scrollTo({ top: 160, behavior: "smooth" });
  }

  const activeServiceObj = ONBID_SERVICES.find((s) => s.id === selectedService);

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
    if (selectedService === "food" && foodType === "mitra") {
      if (!selectedRestoId) return setFormError("Pilih Mitra Resto Resmi terlebih dahulu.");
      if (selectedMenuTotal <= 0) return setFormError("Pilih minimal satu menu yang ingin dipesan.");
      if (!origin) return setFormError("Restoran belum memiliki titik lokasi yang valid. Hubungi mitra untuk memperbarui lokasi.");
    }
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
          ? "Mider Car (Taksi Penumpang Mobil)"
          : selectedService === "food"
          ? `${foodType === "mitra" ? "Mitra Resto Resmi" : "Point Resto"}: ${itemDetail.trim()}`
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
          foodOrderType: selectedService === "food" ? foodType : undefined,
          merchantId: selectedService === "food" ? selectedRestoId : undefined,
          foodItems:
            selectedService === "food" && foodType === "mitra"
              ? Object.entries(selectedMenuQuantities)
                  .filter(([, quantity]) => quantity > 0)
                  .map(([productId, quantity]) => ({ productId, quantity }))
              : undefined,
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

        {/* Hero Banner: tampil hanya sebelum layanan On-Bid dipilih */}
        {(mode === "jastip" || !selectedService) && (
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
        )}

        {mode === "jastip" ? (
          <JastipCatalog />
        ) : (
          <>
            {/* OPSI 3: UNIFIED CARD DOCK (SATU WADAH KARTU BERSAMA) */}
            {!selectedService ? (
              <section className="space-y-4">
                <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm">
                  <div className="grid grid-cols-4 gap-y-5 gap-x-1 sm:gap-x-3">
                    {ONBID_SERVICES.map((srv) => {
                      const Icon = srv.icon;
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => handleSelectMenu(srv)}
                          className="group flex flex-col items-center text-center transition-transform active:scale-95"
                        >
                          <div className="relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <Icon className="h-6 w-6 sm:h-7 sm:w-7 transition-transform group-hover:scale-105" />
                            {srv.badge && (
                              <span className="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 py-0.2 text-[8px] sm:text-[9px] font-bold text-primary-foreground shadow-sm">
                                {srv.badge}
                              </span>
                            )}
                          </div>
                          <span className="mt-1.5 block w-full px-0.5 text-[11px] sm:text-xs font-semibold text-foreground leading-tight line-clamp-2">
                            {srv.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
                    <Link to="/auth" className="font-semibold text-primary underline">
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
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedService(null);
                        setSummary(null);
                      }}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors"
                      title="Kembali ke menu"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {activeServiceObj?.name}
                        </span>
                        {activeServiceObj?.badge && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                            {activeServiceObj.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        {activeServiceObj?.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    Ganti
                  </button>
                </div>

                {/* Tab Khusus Food & Drink */}
                {selectedService === "food" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted p-1">
                      <button
                        type="button"
                        onClick={() => { setFoodType("point"); setShowFoodOrderForm(false); setSelectedRestoId(null); setSelectedMenuQuantities({}); setItemDetail(""); }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                          foodType === "point" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Point Resto (Bebas Pilih)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFoodType("mitra"); setShowFoodOrderForm(false); setSelectedRestoId(null); setSelectedMenuQuantities({}); setItemDetail(""); }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                          foodType === "mitra" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        <Store className="h-3.5 w-3.5 text-primary" />
                        Mitra Resto Resmi
                      </button>
                    </div>

                    {foodType === "mitra" && (
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Mitra Resto Resmi</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Daftar restoran mitra yang telah disetujui admin.</p>
                        </div>
                        {officialRestos.isLoading ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Memuat daftar mitra resto…</p>
                        ) : officialRestos.isError ? (
                          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            Daftar mitra resto gagal dimuat. Silakan coba lagi beberapa saat.
                          </p>
                        ) : (officialRestos.data ?? []).length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                            Belum ada Mitra Resto Resmi yang disetujui admin. Restoran yang baru mendaftar akan tampil setelah disetujui.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {(officialRestos.data ?? []).map((resto) => {
                              const active = selectedRestoId === resto.id;
                              return (
                                <button
                                  key={resto.id}
                                  type="button"
                                  onClick={() => pickResto(resto)}
                                  className={`flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}
                                >
                                  {resto.image_url ? (
                                    <img src={resto.image_url} alt={resto.name} loading="lazy" className="h-24 w-full rounded-lg object-cover" />
                                  ) : (
                                    <span className="flex h-24 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                      <Store className="h-7 w-7" />
                                    </span>
                                  )}
                                  <span className="line-clamp-2 text-xs font-bold text-foreground">{resto.name}</span>
                                  <span className="line-clamp-2 text-[11px] text-muted-foreground">{resto.address}</span>
                                  <span className={`text-[10px] font-semibold ${resto.is_open ? "text-emerald-600" : "text-muted-foreground"}`}>{resto.is_open ? "Buka" : "Tutup"}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Form Perhitungan & Pemesanan */}
                {(
                  <form
                    onSubmit={handleCalculate}
                    className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    {selectedService === "food" && foodType === "point" && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-foreground">
                          Pilih Resto / Warung
                        </label>
                        {pointRestos.isLoading ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">Memuat daftar resto…</p>
                        ) : (pointRestos.data ?? []).length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                            Belum ada Point Resto. Ketik alamat resto manual di bawah.
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {(pointRestos.data ?? []).map((resto) => {
                              const active = selectedRestoId === resto.id;
                              return (
                                <button
                                  key={resto.id}
                                  type="button"
                                  onClick={() => pickResto(resto)}
                                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                                    active
                                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                                      : "border-border bg-card hover:border-primary/40"
                                  }`}
                                >
                                  {resto.image_url ? (
                                    <img
                                      src={resto.image_url}
                                      alt={resto.name}
                                      loading="lazy"
                                      className="h-12 w-12 rounded-full border border-border object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                      <Store className="h-5 w-5" />
                                    </span>
                                  )}
                                  <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">
                                    {resto.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {selectedService === "food" && foodType === "mitra" && selectedRestoId && (
                      <section className="space-y-3 rounded-xl border border-border p-3">
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Pilih Menu Makanan & Minuman</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Pilih restoran terlebih dahulu, lalu tambah jumlah menu yang ingin dipesan.</p>
                        </div>
                        {!selectedRestoId ? (
                          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Pilih salah satu Mitra Resto Resmi di atas untuk melihat menu.</p>
                        ) : merchantProducts.isLoading ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">Memuat menu restoran…</p>
                        ) : merchantProducts.isError ? (
                          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Menu gagal dimuat. Pastikan akses baca produk pelanggan sudah diizinkan di Supabase.</p>
                        ) : (merchantProducts.data ?? []).length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Belum ada menu tersedia di restoran ini.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {(merchantProducts.data ?? []).map((product) => {
                              const quantity = selectedMenuQuantities[product.id] ?? 0;
                              return (
                                <div key={product.id} className="flex min-w-0 gap-3 rounded-xl border border-border p-2.5">
                                  {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                                  ) : (
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UtensilsCrossed className="h-6 w-6" /></div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="line-clamp-2 text-sm font-semibold text-foreground">{product.name}</div>
                                    {product.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{product.description}</p>}
                                    <div className="mt-1 text-sm font-bold text-primary">{formatRupiah(Number(product.price))}</div>
                                    <div className="mt-2 flex items-center gap-2">
                                      <button type="button" aria-label={`Kurangi ${product.name}`} onClick={() => changeMenuQuantity(product, -1)} disabled={quantity === 0} className="flex h-7 w-7 items-center justify-center rounded-md border border-border disabled:opacity-40">−</button>
                                      <span className="min-w-4 text-center text-xs font-bold">{quantity}</span>
                                      <button type="button" aria-label={`Tambah ${product.name}`} onClick={() => changeMenuQuantity(product, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">+</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {selectedMenuTotal > 0 && (
                          <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-sm">
                            <span className="font-medium text-foreground">Subtotal menu</span>
                            <span className="font-extrabold text-primary">{formatRupiah(selectedMenuTotal)}</span>
                          </div>
                        )}
                      </section>
                    )}

                    {selectedService !== "food" || showFoodOrderForm ? (
                      <>
                    <div id="food-order-details" className={selectedService === "food" ? "space-y-4" : undefined}>
                    <PlaceAutocomplete
                      label={originLabel}
                      placeholder="Ketik nama tempat/warung atau alamat penjemputan…"
                      value={origin}
                      onChange={(place) => {
                        setOrigin(place);
                        if (!place) setSelectedRestoId(null);
                      }}
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

                    {/* Kontak Pemesan: ringkas untuk akun login, tetap wajib untuk tamu */}
                    <div className="space-y-2 rounded-xl border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-foreground">Kontak Pemesan</span>
                        {user && (
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isForOther}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIsForOther(checked);
                                if (!checked && profileQuery.data) {
                                  setSenderName(profileQuery.data.full_name || "");
                                  setSenderWa(profileQuery.data.phone || "");
                                } else if (checked && profileQuery.data && senderName === (profileQuery.data.full_name || "")) {
                                  setSenderName("");
                                  setSenderWa("");
                                }
                              }}
                              className="rounded border-input text-primary"
                            />
                            Pesan untuk orang lain
                          </label>
                        )}
                      </div>

                      {user && !isForOther && profileQuery.data ? (
                        <div className="rounded-lg bg-muted/60 px-3 py-2.5">
                          <p className="text-sm font-medium text-foreground">{senderName || profileQuery.data.full_name || "Nama belum diisi"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{senderWa || profileQuery.data.phone || "Nomor WhatsApp belum diisi"}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Menggunakan kontak akun Anda.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">{isForOther ? "Nama orang yang menerima pesanan" : "Nama Anda"}</label>
                            <input
                              type="text"
                              value={senderName}
                              onChange={(e) => setSenderName(e.target.value)}
                              maxLength={60}
                              placeholder={isForOther ? "Nama orang yang menerima pesanan" : "Nama lengkap pemesan"}
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
                      )}
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
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {([
                          ["cod", "COD", "Tunai ke driver", Banknote],
                          ["transfer", "Transfer / QRIS", "Pembayaran transfer", QrCode],
                          ["wallet", "Saldo User", user ? (userWalletQuery.isLoading ? "Memuat saldo..." : `Saldo: ${formatRupiah(userWalletQuery.data ?? 0)}`) : "Login untuk menggunakan saldo", Wallet],
                        ] as const).map(([id, name, sub, Icon]) => (
                          <button
                            key={id}
                            type="button"
                            disabled={id === "wallet" && (!user || userWalletQuery.isLoading || userWalletQuery.isError)}
                            onClick={() => { if (id === "wallet" && !user) { setFormError("Login terlebih dahulu untuk membayar dengan Saldo User."); return; } setFormError(""); setPaymentMethod(id); }}
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
                    </div>
                      </>
                    ) : selectedService === "food" && selectedRestoId && (foodType === "point" || selectedMenuTotal > 0) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (foodType === "mitra" && selectedMenuTotal > 0) {
                            setItemDetail((merchantProducts.data ?? []).filter((product) => (selectedMenuQuantities[product.id] ?? 0) > 0).map((product) => `${selectedMenuQuantities[product.id]}x ${product.name} @ ${formatRupiah(Number(product.price))}`).join("; "));
                          }
                          setShowFoodOrderForm(true);
                          setTimeout(() => document.getElementById("food-order-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                        }}
                        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
                      >
                        Lanjut Pesan{foodType === "mitra" ? ` · ${formatRupiah(selectedMenuTotal)}` : ""}
                      </button>
                    ) : selectedService === "food" ? (
                      <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        {foodType === "mitra" ? "Pilih outlet dan minimal satu menu untuk melanjutkan." : "Pilih outlet terlebih dahulu untuk melanjutkan."}
                      </p>
                    ) : null}

                    {(selectedService !== "food" || showFoodOrderForm) && (
                      <button
                        type="submit"
                        disabled={calculating}
                        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {calculating ? "Menghitung rute & ongkir…" : "Hitung Estimasi Harga"}
                      </button>
                    )}
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
                      {selectedService === "food" && foodType === "mitra" && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Total Produk Makanan/Minuman</span>
                          <span className="shrink-0 text-foreground">{formatRupiah(selectedMenuTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Biaya Layanan Aplikasi</span>
                        <span className="shrink-0 text-foreground">{formatRupiah(summary.price.consumerServiceFee)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Ongkos Kirim</span>
                        <span className="shrink-0 text-foreground">{formatRupiah(summary.price.shippingFare)}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2 text-sm sm:text-base font-bold">
                        <span className="text-foreground">Total Estimasi Pembayaran</span>
                        <span className="shrink-0 text-primary">{formatRupiah(summary.price.total + (selectedService === "food" && foodType === "mitra" ? selectedMenuTotal : 0))}</span>
                      </div>
                      {selectedService === "food" && foodType === "mitra" && (
                        <p className="pt-1 text-[11px] text-muted-foreground">Total ini mencakup harga menu dan biaya layanan/pengiriman yang tertera.</p>
                      )}
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
              <h3 className="mt-3 text-base font-bold text-foreground">Mider Digistore</h3>
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
