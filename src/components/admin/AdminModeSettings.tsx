import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";
import { formatDepart, slotTypeLabel } from "@/components/jastip/JastipCatalog";
import { TRIP_STATUS_LABEL } from "@/components/jastip/DriverJastipTrips";

const inputCls = "mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm";

export function AdminModeSettings() {
  const qc = useQueryClient();
  const [f, setF] = useState({ ojek_base_fare: 3000, ojek_per_km: 1500, jastip_min_price: 5000, jastip_max_price: 150000 });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const s = useQuery({
    queryKey: ["mode-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("ojek_base_fare, ojek_per_km, jastip_min_price, jastip_max_price").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { if (s.data) setF(s.data); }, [s.data]);

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
    const { error } = await supabase.rpc("admin_update_mode_settings", {
      _ojek_base_fare: f.ojek_base_fare, _ojek_per_km: f.ojek_per_km, _jastip_min_price: f.jastip_min_price, _jastip_max_price: f.jastip_max_price,
    });
    setBusy(false);
    setMsg(error ? error.message : "Tersimpan.");
    qc.invalidateQueries({ queryKey: ["mode-settings"] });
    qc.invalidateQueries({ queryKey: ["public-app-settings"] });
  }

  async function cancelTrip(id: string) {
    if (!window.confirm("Batalkan jadwal ini beserta semua pemesannya?")) return;
    const { error } = await supabase.rpc("driver_set_trip_status", { _trip_id: id, _status: "dibatalkan" });
    if (error) return setMsg(error.message);
    qc.invalidateQueries({ queryKey: ["admin-trips"] });
  }

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="font-bold text-foreground">Tarif Ojek Penumpang & Batas Harga Jastip</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="text-xs font-semibold text-muted-foreground">Ojek: Biaya Layanan (Rp)</label><input type="number" min={0} value={f.ojek_base_fare} onChange={num("ojek_base_fare")} className={inputCls} /></div>
        <div><label className="text-xs font-semibold text-muted-foreground">Ojek: Tarif per km (Rp)</label><input type="number" min={0} value={f.ojek_per_km} onChange={num("ojek_per_km")} className={inputCls} /></div>
        <div><label className="text-xs font-semibold text-muted-foreground">Jastip: Harga minimal/slot (Rp)</label><input type="number" min={0} value={f.jastip_min_price} onChange={num("jastip_min_price")} className={inputCls} /></div>
        <div><label className="text-xs font-semibold text-muted-foreground">Jastip: Harga maksimal/slot (Rp)</label><input type="number" min={0} value={f.jastip_max_price} onChange={num("jastip_max_price")} className={inputCls} /></div>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <button onClick={save} disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan Tarif Mode"}</button>

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
