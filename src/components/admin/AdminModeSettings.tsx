import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";
import { formatDepart, slotTypeLabel } from "@/components/jastip/JastipCatalog";
import { TRIP_STATUS_LABEL } from "@/components/jastip/DriverJastipTrips";
import { Bike, Car, Package, Store, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const inputCls = "mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none";

export function AdminModeSettings() {
  const qc = useQueryClient();
  const [f, setF] = useState({
    base_fare: 3000,
    per_km: 1000,
    commission_percent: 10,
    oversize_fee: 5000,
    ojek_base_fare: 3000,
    ojek_per_km: 1500,
    car_base_fare: 10000,
    car_per_km: 4000,
    car_commission_percent: 12,
    pickup_base_fare: 15000,
    pickup_per_km: 6000,
    pickup_commission_percent: 15,
    jastip_package_fee: 15000,
    jastip_service_fee: 2000,
    jastip_commission_percent: 10,
    jastip_nebeng_fee: 20000,
    resto_commission_percent: 10,
  });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const s = useQuery({
    queryKey: ["app-settings-admin-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!s.data) return;
    const d = s.data as any;
    setF({
      base_fare: Number(d.base_fare ?? 3000),
      per_km: Number(d.per_km ?? 1000),
      commission_percent: Number(d.commission_percent ?? 10),
      oversize_fee: Number(d.oversize_fee ?? 5000),
      ojek_base_fare: Number(d.ojek_base_fare ?? 3000),
      ojek_per_km: Number(d.ojek_per_km ?? 1500),
      car_base_fare: Number(d.car_base_fare ?? 10000),
      car_per_km: Number(d.car_per_km ?? 4000),
      car_commission_percent: Number(d.car_commission_percent ?? 12),
      pickup_base_fare: Number(d.pickup_base_fare ?? 15000),
      pickup_per_km: Number(d.pickup_per_km ?? 6000),
      pickup_commission_percent: Number(d.pickup_commission_percent ?? 15),
      jastip_package_fee: Number(d.jastip_package_fee ?? 15000),
      jastip_service_fee: Number(d.jastip_service_fee ?? 2000),
      jastip_commission_percent: Number(d.jastip_commission_percent ?? 10),
      jastip_nebeng_fee: Number(d.jastip_nebeng_fee ?? 20000),
      resto_commission_percent: Number(d.resto_commission_percent ?? 10),
    });
  }, [s.data]);

  const trips = useQuery({
    queryKey: ["admin-trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jastip_trips").select("*").order("depart_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("app_settings").update({
      base_fare: f.base_fare,
      per_km: f.per_km,
      commission_percent: f.commission_percent,
      oversize_fee: f.oversize_fee,
      ojek_base_fare: f.ojek_base_fare,
      ojek_per_km: f.ojek_per_km,
      car_base_fare: f.car_base_fare,
      car_per_km: f.car_per_km,
      car_commission_percent: f.car_commission_percent,
      pickup_base_fare: f.pickup_base_fare,
      pickup_per_km: f.pickup_per_km,
      pickup_commission_percent: f.pickup_commission_percent,
      jastip_package_fee: f.jastip_package_fee,
      jastip_service_fee: f.jastip_service_fee,
      jastip_commission_percent: f.jastip_commission_percent,
      jastip_nebeng_fee: f.jastip_nebeng_fee,
      resto_commission_percent: f.resto_commission_percent,
    } as any).eq("id", 1);
    setBusy(false);
    if (error) {
      setMsg({ type: "error", text: "Gagal menyimpan tarif: " + error.message });
      return;
    }
    setMsg({ type: "success", text: "Semua pengaturan tarif dan potongan berhasil disimpan!" });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["app-settings-admin-full"] }),
      qc.invalidateQueries({ queryKey: ["mode-settings"] }),
      qc.invalidateQueries({ queryKey: ["public-app-settings"] }),
      qc.invalidateQueries({ queryKey: ["app-settings-jastip"] }),
      qc.invalidateQueries({ queryKey: ["app-settings-full"] }),
    ]);
  }

  async function cancelTrip(id: string) {
    if (!window.confirm("Batalkan rute perjalanan jastip ini beserta booking di dalamnya?")) return;
    const { error } = await supabase.rpc("driver_set_trip_status", { _trip_id: id, _status: "dibatalkan" });
    if (error) return setMsg({ type: "error", text: error.message });
    qc.invalidateQueries({ queryKey: ["admin-trips"] });
  }

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((c) => ({ ...c, [k]: Number(e.target.value) }));

  const field = (label: string, key: keyof typeof f, percent = false) => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input type="number" min={0} max={percent ? 100 : undefined} step={percent ? "0.5" : 1} value={f[key]} onChange={num(key)} className={inputCls} />
    </div>
  );

  return (
    <div className="space-y-6">
      {msg && <div className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold ${msg.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
        {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{msg.text}
      </div>}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bike className="h-4 w-4" /></div>
          <div><h3 className="text-sm font-bold text-foreground">1. On-Bid Motor (Kirim Barang, Belanja & Ojek)</h3><p className="text-xs text-muted-foreground">Perhitungan tarif per km + biaya layanan user flat.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Kirim/Belanja: Tarif per KM (Rp)", "per_km")}
          {field("Kirim/Belanja: Biaya Layanan User (Rp)", "base_fare")}
          {field("Motor: Potongan Komisi Driver (%)", "commission_percent", true)}
          {field("Ojek: Tarif per KM (Rp)", "ojek_per_km")}
          {field("Ojek: Biaya Layanan User (Rp)", "ojek_base_fare")}
          {field("Biaya Muatan Besar / Oversize (Rp)", "oversize_fee")}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Car className="h-4 w-4" /></div>
          <div><h3 className="text-sm font-bold text-foreground">2. On-Bid Mobil (Mider Car & Pick Up Kargo)</h3><p className="text-xs text-muted-foreground">Tarif armada mobil penumpang dan angkutan barang/pindahan.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Mider Car: Tarif per KM (Rp)", "car_per_km")}
          {field("Mider Car: Biaya Layanan User (Rp)", "car_base_fare")}
          {field("Mider Car: Komisi Driver (%)", "car_commission_percent", true)}
          {field("Pick Up: Tarif per KM (Rp)", "pickup_per_km")}
          {field("Pick Up: Biaya Layanan User (Rp)", "pickup_base_fare")}
          {field("Pick Up: Komisi Driver (%)", "pickup_commission_percent", true)}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Package className="h-4 w-4" /></div>
          <div><h3 className="text-sm font-bold text-foreground">3. Jastip & Nebeng (Rute Antar-Wilayah)</h3><p className="text-xs text-muted-foreground">Skema tarif flat per paket atau per kursi penumpang.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {field("Jasa Titip per Paket (Rp Flat)", "jastip_package_fee")}
          {field("Tiket Nebeng per Kursi (Rp Flat)", "jastip_nebeng_fee")}
          {field("Biaya Layanan User (Rp Flat)", "jastip_service_fee")}
          {field("Komisi Driver Jastip (%)", "jastip_commission_percent", true)}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600"><Store className="h-4 w-4" /></div>
          <div><h3 className="text-sm font-bold text-foreground">4. Mitra Resto Resmi (Food & Drink)</h3><p className="text-xs text-muted-foreground">Bagi hasil aplikasi dari pesanan resto resmi (Point Resto tidak terkena potongan ini).</p></div>
        </div>
        <div className="max-w-xs">
          {field("Potongan Komisi Mitra Resto (%)", "resto_commission_percent", true)}
          <p className="mt-1 text-[11px] text-muted-foreground">Dipotong dari total tagihan makanan/minuman.</p>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button onClick={handleSave} disabled={busy || s.isLoading} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{busy ? "Menyimpan Tarif..." : "Simpan Semua Pengaturan Tarif"}
        </button>
      </div>

      <div className="mt-8 space-y-3 border-t border-border pt-4">
        <h4 className="text-sm font-bold text-foreground">Monitoring Jadwal Jastip Terkini</h4>
        {trips.isLoading && <p className="text-xs text-muted-foreground">Memuat jadwal...</p>}
        {trips.isError && <p className="text-xs text-destructive">Gagal memuat jadwal: {trips.error.message}</p>}
        {trips.data?.length === 0 && <p className="text-xs text-muted-foreground">Belum ada rute perjalanan yang dibuat driver.</p>}
        <div className="space-y-2">
          {trips.data?.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-xs">
              <div><div className="font-semibold text-foreground">{t.origin_label} → {t.dest_label}</div><div className="mt-0.5 text-muted-foreground">{formatDepart(t.depart_at)} · {slotTypeLabel(t.slot_type)} · {t.booked}/{t.quota} terisi · {formatRupiah(t.price_per_slot)}</div></div>
              <div className="flex items-center gap-2"><span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{TRIP_STATUS_LABEL[t.status]}</span>
                {(t.status === "open" || t.status === "berjalan") && <button onClick={() => cancelTrip(t.id)} className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/20">Batalkan</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
