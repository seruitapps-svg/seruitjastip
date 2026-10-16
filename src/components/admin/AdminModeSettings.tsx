import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";
import { formatDepart, slotTypeLabel } from "@/components/jastip/JastipCatalog";
import { TRIP_STATUS_LABEL } from "@/components/jastip/DriverJastipTrips";

const inputCls = "mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm";

export function AdminModeSettings() {
  const qc = useQueryClient();
  const [f, setF] = useState({
    ojek_base_fare: 3000,
    ojek_per_km: 1500,
    jastip_package_fee: 15000,
    jastip_service_fee: 2000,
    jastip_commission_percent: 10,
    jastip_nebeng_fee: 20000,
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const s = useQuery({
    queryKey: ["mode-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("ojek_base_fare, ojek_per_km, jastip_package_fee, jastip_service_fee, jastip_commission_percent, jastip_nebeng_fee")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!s.data) return;
    setF({
      ojek_base_fare: Number(s.data.ojek_base_fare ?? 3000),
      ojek_per_km: Number(s.data.ojek_per_km ?? 1500),
      jastip_package_fee: Number(s.data.jastip_package_fee ?? 15000),
      jastip_service_fee: Number(s.data.jastip_service_fee ?? 2000),
      jastip_commission_percent: Number(s.data.jastip_commission_percent ?? 10),
      jastip_nebeng_fee: Number(s.data.jastip_nebeng_fee ?? 20000),
    });
  }, [s.data]);

  const trips = useQuery({
    queryKey: ["admin-trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jastip_trips").select("*").order("depart_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    setBusy(true);
    setMsg("");

    const { error: modeError } = await supabase.rpc("admin_update_mode_settings", {
      _ojek_base_fare: f.ojek_base_fare,
      _ojek_per_km: f.ojek_per_km,
      _jastip_package_fee: f.jastip_package_fee,
      _jastip_service_fee: f.jastip_service_fee,
      _jastip_commission_percent: f.jastip_commission_percent,
    });

    if (modeError) {
      setBusy(false);
      setMsg("Gagal menyimpan tarif mode: " + modeError.message);
      return;
    }

    const { error: nebengError } = await supabase
      .from("app_settings")
      .update({ jastip_nebeng_fee: f.jastip_nebeng_fee })
      .eq("id", 1);

    setBusy(false);
    if (nebengError) {
      setMsg("Tarif mode tersimpan, tetapi harga Nebeng gagal disimpan: " + nebengError.message);
      return;
    }

    setMsg("Tarif mode dan harga Nebeng berhasil disimpan.");
    await qc.invalidateQueries({ queryKey: ["mode-settings"] });
    await qc.invalidateQueries({ queryKey: ["public-app-settings"] });
    await qc.invalidateQueries({ queryKey: ["app-settings-jastip"] });
  }

  async function cancelTrip(id: string) {
    if (!window.confirm("Batalkan jadwal ini beserta semua pemesannya?")) return;
    const { error } = await supabase.rpc("driver_set_trip_status", { _trip_id: id, _status: "dibatalkan" });
    if (error) return setMsg(error.message);
    qc.invalidateQueries({ queryKey: ["admin-trips"] });
  }

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((current) => ({ ...current, [k]: Number(e.target.value) }));

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="font-bold text-foreground">Pengaturan Tarif Mode On-Bid</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Ojek: Biaya Layanan Konsumen (Rp)</label>
          <input type="number" min={0} value={f.ojek_base_fare} onChange={num("ojek_base_fare")} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Ojek: Tarif per km (Rp)</label>
          <input type="number" min={0} value={f.ojek_per_km} onChange={num("ojek_per_km")} className={inputCls} />
        </div>
      </div>

      <h3 className="pt-2 font-bold text-foreground">Pengaturan Tarif Mode Jastip (Resmi)</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Biaya Titip per Paket (Rp)</label>
          <input type="number" min={0} value={f.jastip_package_fee} onChange={num("jastip_package_fee")} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Biaya Layanan Konsumen (Rp)</label>
          <input type="number" min={0} value={f.jastip_service_fee} onChange={num("jastip_service_fee")} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Potongan Komisi Driver Jastip (%)</label>
          <input type="number" min={0} max={100} value={f.jastip_commission_percent} onChange={num("jastip_commission_percent")} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Harga Nebeng Default per Kursi (Rp)</label>
          <input type="number" min={0} value={f.jastip_nebeng_fee} onChange={num("jastip_nebeng_fee")} className={inputCls} />
          <p className="mt-1 text-xs text-muted-foreground">Dipakai sebagai harga awal saat driver membuat jadwal Nebeng baru. Jadwal yang sudah terbit tidak berubah.</p>
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.startsWith("Gagal") || msg.includes("gagal") ? "text-destructive" : "text-muted-foreground"}`}>{msg}</p>}
      <button onClick={save} disabled={busy || s.isLoading} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Menyimpan..." : "Simpan Tarif Mode"}
      </button>

      <h4 className="pt-2 text-sm font-bold text-foreground">Jadwal Jastip Terbaru</h4>
      {trips.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jadwal.</p>}
      <div className="space-y-2">
        {trips.data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs">
            <div>
              <div className="font-semibold text-foreground">{t.origin_label} → {t.dest_label}</div>
              <div className="text-muted-foreground">{formatDepart(t.depart_at)} · {slotTypeLabel(t.slot_type)} · {t.booked}/{t.quota} · {formatRupiah(t.price_per_slot)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{TRIP_STATUS_LABEL[t.status]}</span>
              {(t.status === "open" || t.status === "berjalan") && (
                <button onClick={() => cancelTrip(t.id)} className="rounded bg-destructive/10 px-2 py-1 font-semibold text-destructive">Batalkan</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
