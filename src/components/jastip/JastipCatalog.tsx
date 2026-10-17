import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Package, Users, Wallet, ShoppingBag, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/config";
import { PlaceAutocomplete, type SelectedPlace } from "@/components/order/PlaceAutocomplete";

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

type ServiceType = "kirim" | "belanja" | "nebeng";

type CatalogTrip = {
  id: string;
  origin_area?: string | null;
  dest_area?: string | null;
  origin_label?: string | null;
  dest_label?: string | null;
  depart_at: string;
  slot_type: string;
  quota: number;
  booked?: number | null;
  booked_slots?: number | null;
  price_per_slot: number;
  notes: string;
  status: string;
  enable_nebeng: boolean;
  nebeng_quota: number;
  nebeng_booked: number;
  nebeng_price: number;
};

export function slotTypeLabel(t: string) {
  return t === "kursi" ? "Kursi penumpang" : "Paket titipan";
}

export function formatDepart(d: string) {
  return new Date(d).toLocaleString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function packageBookedCount(trip: CatalogTrip) {
  return Math.max(Number(trip.booked_slots ?? 0), Number(trip.booked ?? 0));
}

function packageRemainingCount(trip: CatalogTrip) {
  return Math.max(0, Number(trip.quota ?? 0) - packageBookedCount(trip));
}

function nebengRemainingCount(trip: CatalogTrip) {
  return Math.max(0, Number(trip.nebeng_quota ?? 0) - Number(trip.nebeng_booked ?? 0));
}

function tripOrigin(trip: CatalogTrip) {
  return trip.origin_area?.trim() || trip.origin_label?.trim() || "";
}

function tripDestination(trip: CatalogTrip) {
  return trip.dest_area?.trim() || trip.dest_label?.trim() || "";
}

export function JastipCatalog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [slotsInput, setSlotsInput] = useState("1");
  const slots = Math.max(1, Number(slotsInput) || 1);
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"cod" | "transfer">("cod");
  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [dropoff, setDropoff] = useState<SelectedPlace | null>(null);
  const [isForOther, setIsForOther] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientWa, setRecipientWa] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopWa, setShopWa] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["jastip-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("jastip_catalog");
      if (error) throw error;
      return data as CatalogTrip[];
    },
  });

  const userWallet = useQuery({
    queryKey: ["user-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance ?? 0;
    },
  });

  const settings = useQuery({
    queryKey: ["app-settings-fee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("jastip_service_fee")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data?.jastip_service_fee ?? 2500;
    },
  });

  const serviceFee = settings.data ?? 2500;
  const availableTrips = q.data?.filter((trip) => {
    const hasPackageCapacity = packageRemainingCount(trip) > 0;
    const hasNebengCapacity = trip.enable_nebeng && nebengRemainingCount(trip) > 0;
    const isBookableStatus = trip.status === "open";
    return isBookableStatus && (hasPackageCapacity || hasNebengCapacity);
  });

  function openTrip(tripId: string) {
    setOpenId(tripId);
    setSelectedService(null);
    setSlotsInput("1");
    setErr("");
  }

  function chooseService(service: ServiceType) {
    setSelectedService(service);
    setSlotsInput("1");
    setErr("");
  }

  function closeTrip() {
    setOpenId(null);
    setSelectedService(null);
    setErr("");
  }

  async function book(t: CatalogTrip) {
    if (!selectedService) return setErr("Pilih layanan yang ingin dipesan.");
    if (!pickup?.address || !dropoff?.address) {
      return setErr("Mohon tentukan Titik A dan Titik B pada peta.");
    }
    if (selectedService === "belanja" && !shopName.trim()) {
      return setErr("Isi nama toko atau tempat belanja.");
    }
    if (isForOther && (!recipientName.trim() || !recipientWa.trim())) {
      return setErr("Isi nama dan WhatsApp penerima.");
    }

    const remaining =
      selectedService === "nebeng" ? nebengRemainingCount(t) : packageRemainingCount(t);
    if (slots > remaining) {
      return setErr(`Kuota tersisa hanya ${remaining} ${selectedService === "nebeng" ? "kursi" : "paket"}.`);
    }

    const unitPrice = selectedService === "nebeng" ? t.nebeng_price : t.price_per_slot;
    const totalCost = unitPrice * slots + serviceFee;
    if (payment === "transfer" && (userWallet.data ?? 0) < totalCost) {
      return setErr(`Saldo akun tidak mencukupi (${formatRupiah(userWallet.data ?? 0)}).`);
    }

    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("book_jastip_slot", {
      _trip_id: t.id,
      _slots: slots,
      _payment: payment,
      _service_type: selectedService,
      _notes: notes,
      _pickup_address: pickup.address,
      _pickup_lat: pickup.lat,
      _pickup_lng: pickup.lng,
      _dropoff_address: dropoff.address,
      _dropoff_lat: dropoff.lat,
      _dropoff_lng: dropoff.lng,
      _is_for_other: isForOther,
      _recipient_name: isForOther ? recipientName : undefined,
      _recipient_wa: isForOther ? recipientWa : undefined,
      _shop_name: selectedService === "belanja" ? shopName : undefined,
      _shop_wa: selectedService === "belanja" ? shopWa : undefined,
    });
    setBusy(false);
    if (error) return setErr(error.message);

    qc.invalidateQueries({ queryKey: ["jastip-catalog"] });
    qc.invalidateQueries({ queryKey: ["my-jastip"] });
    qc.invalidateQueries({ queryKey: ["user-wallet"] });
    navigate({ to: "/pesanan" });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">
        <div className="flex items-start gap-2">
          <Route className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pilih rute dan jadwal driver yang tersedia. Setelah menekan Pesan, pilih layanan yang kamu butuhkan.</span>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Memuat jadwal rute…</p>}
      {q.isError && <p className="text-sm text-destructive">Gagal memuat jadwal rute.</p>}
      {availableTrips?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada rute dan jadwal driver yang tersedia saat ini.
        </p>
      )}

      {availableTrips?.map((t) => {
        const open = openId === t.id;
        const packageRemaining = packageRemainingCount(t);
        const nebengRemaining = nebengRemainingCount(t);
        const packageAvailable = packageRemaining > 0;
        const nebengAvailable = t.enable_nebeng && nebengRemaining > 0;
        const unitPrice = selectedService === "nebeng" ? t.nebeng_price : t.price_per_slot;
        const subtotal = unitPrice * (slots || 1);
        const total = subtotal + serviceFee;
        const selectedRemaining =
          selectedService === "nebeng" ? nebengRemaining : packageRemaining;
        const origin = tripOrigin(t);
        const destination = tripDestination(t);

        return (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-extrabold text-foreground">
                  Trip {origin || "Rute belum terisi"} - {destination || "Tujuan belum terisi"}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDepart(t.depart_at)}</span>
                </div>
                {t.notes && <p className="mt-1.5 text-xs text-muted-foreground">{t.notes}</p>}
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex rounded-full bg-accent px-2 py-1 text-[11px] font-bold text-accent-foreground">
                  Jadwal tersedia
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                <Package className="h-3.5 w-3.5" />
                Jastip {packageAvailable ? "· Ready" : "· Penuh"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                <Users className="h-3.5 w-3.5" />
                Nebeng {nebengAvailable ? "· Ready" : "· Tidak tersedia"}
              </span>
            </div>

            {!open ? (
              <button
                type="button"
                onClick={() => openTrip(t.id)}
                className="mt-3 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground"
              >
                Pesan
              </button>
            ) : (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                {!selectedService ? (
                  <>
                    <p className="text-sm font-bold text-foreground">Pilih layanan untuk rute ini</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={!packageAvailable}
                        onClick={() => chooseService("kirim")}
                        className="flex items-center gap-2 rounded-xl border border-border p-3 text-left text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Package className="h-4 w-4 text-primary" />
                        <span><span className="block">Kirim Barang</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{packageAvailable ? `Sisa ${packageRemaining} paket` : "Kuota penuh"}</span></span>
                      </button>
                      <button
                        type="button"
                        disabled={!packageAvailable}
                        onClick={() => chooseService("belanja")}
                        className="flex items-center gap-2 rounded-xl border border-border p-3 text-left text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        <span><span className="block">Jastip Belanja</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{packageAvailable ? `Sisa ${packageRemaining} paket` : "Kuota penuh"}</span></span>
                      </button>
                      <button
                        type="button"
                        disabled={!nebengAvailable}
                        onClick={() => chooseService("nebeng")}
                        className="flex items-center gap-2 rounded-xl border border-border p-3 text-left text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Users className="h-4 w-4 text-primary" />
                        <span><span className="block">Nebeng</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{nebengAvailable ? `Sisa ${nebengRemaining} kursi` : "Tidak tersedia"}</span></span>
                      </button>
                    </div>
                    {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
                    <button type="button" onClick={closeTrip} className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-foreground">Batal</button>
                  </>
                ) : !user ? (
                  <>
                    <p className="text-xs text-muted-foreground">Layanan dipilih: <span className="font-bold text-foreground">{selectedService === "kirim" ? "Kirim Barang" : selectedService === "belanja" ? "Jastip Belanja" : "Nebeng"}</span></p>
                    <Link to="/auth" search={{ redirect: "/" }} className="block w-full rounded-lg bg-primary py-2.5 text-center text-xs font-bold text-primary-foreground">
                      Masuk untuk memesan
                    </Link>
                    <button type="button" onClick={() => setSelectedService(null)} className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-foreground">Ganti layanan</button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {selectedService === "kirim" ? "Kirim Barang" : selectedService === "belanja" ? "Jastip Belanja" : "Nebeng"}
                      </p>
                      <button type="button" onClick={() => { setSelectedService(null); setErr(""); }} className="text-xs font-semibold text-primary">Ganti layanan</button>
                    </div>

                    <div className="space-y-2">
                      <PlaceAutocomplete label="Titik A (Lokasi Jemput / Toko)" placeholder="Cari lokasi jemput / nama toko…" value={pickup} onChange={setPickup} />
                      <PlaceAutocomplete label="Titik B (Lokasi Antar / Penerima)" placeholder="Cari alamat tujuan / pengantaran…" value={dropoff} onChange={setDropoff} />
                    </div>

                    {selectedService === "belanja" && (
                      <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                        <p className="text-xs font-bold text-foreground">Detail Toko / Tempat Belanja</p>
                        <input className={inputCls} placeholder="Nama Toko / Warung" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={120} />
                        <input className={inputCls} placeholder="No. WhatsApp Toko (Opsional)" value={shopWa} onChange={(e) => setShopWa(e.target.value)} maxLength={20} />
                      </div>
                    )}

                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={isForOther} onChange={(e) => setIsForOther(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                        <span>Pesan / kirim untuk orang lain?</span>
                      </label>
                      {isForOther && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <input className={inputCls} placeholder="Nama Penerima" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={100} />
                          <input className={inputCls} placeholder="WhatsApp Penerima" value={recipientWa} onChange={(e) => setRecipientWa(e.target.value)} maxLength={20} />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground">
                        {selectedService === "nebeng" ? "Jumlah Kursi" : "Jumlah Paket"}
                        <input type="number" min={1} max={Math.min(20, selectedRemaining)} className={inputCls} value={slotsInput} onChange={(e) => setSlotsInput(e.target.value)} onBlur={() => setSlotsInput(String(Math.max(1, Math.min(20, selectedRemaining || 1, Number(slotsInput) || 1))))} />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Metode Pembayaran
                        <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value as "cod" | "transfer")}>
                          <option value="cod">Tunai (COD saat tiba)</option>
                          <option value="transfer">Potong Saldo Akun</option>
                        </select>
                      </label>
                    </div>

                    {payment === "transfer" && (
                      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-primary" /> Saldo Akun Anda:</span>
                        <span className="font-bold text-foreground">{formatRupiah(userWallet.data ?? 0)}</span>
                      </div>
                    )}

                    <input className={inputCls} placeholder="Catatan / deskripsi barang (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />

                    <div className="space-y-1.5 rounded-xl border border-border bg-muted/50 p-3 text-xs">
                      <div className="font-bold text-foreground">Rincian Pembayaran</div>
                      <div className="flex justify-between text-muted-foreground"><span>{selectedService === "nebeng" ? "Tarif kursi" : "Biaya titip"} ({slots}):</span><span>{formatRupiah(subtotal)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Biaya Layanan Aplikasi:</span><span>{formatRupiah(serviceFee)}</span></div>
                      <div className="flex justify-between border-t border-border pt-1 font-bold text-foreground"><span>Total Tagihan:</span><span className="text-primary">{formatRupiah(total)}</span></div>
                    </div>

                    {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
                    <div className="flex gap-2">
                      <button disabled={busy} onClick={() => book(t)} className="flex-1 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
                        {busy ? "Memproses…" : `Bayar & Pesan · ${formatRupiah(total)}`}
                      </button>
                      <button type="button" onClick={closeTrip} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Batal</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
