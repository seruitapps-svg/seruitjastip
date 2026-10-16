import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";
import { formatDepart, slotTypeLabel } from "./JastipCatalog";

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export const TRIP_STATUS_LABEL: Record<string, string> = {
  open: "Buka", berjalan: "Berjalan", selesai: "Selesai", dibatalkan: "Dibatalkan", dipesan: "Terkonfirmasi",
};

export function DriverJastipTrips({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ origin: "", dest: "", depart: "", quota: 8, notes: "" });
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["app-settings-jastip"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("jastip_package_fee").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const trips = useQuery({
    queryKey: ["driver-trips", driverId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jastip_trips").select("*").eq("driver_id", driverId).order("depart_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  const bookings = useQuery({
    queryKey: ["driver-trip-bookings", driverId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jastip_bookings").select("*").neq("status", "dibatalkan").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["driver-trips"] });
    qc.invalidateQueries({ queryKey: ["driver-trip-bookings"] });
    qc.invalidateQueries({ queryKey: ["jastip-catalog"] });
  }

  async function create() {
    setErr("");
    if (!form.depart) return setErr("Isi jadwal berangkat.");
    setBusy("create");
    const { error } = await supabase.rpc("driver_create_trip", {
      _origin: form.origin, _dest: form.dest, _depart_at: new Date(form.depart).toISOString(),
      _slot_type: "paket", _quota: form.quota, _price: Number(settings.data?.jastip_package_fee ?? 15000), _notes: form.notes,
    });
    setBusy(null);
    if (error) return setErr(error.message);
    setShowForm(false);
    refresh();
  }

  async function setStatus(id: string, status: string) {
    if (status === "dibatalkan" && !window.confirm("Batalkan jadwal? Semua pemesan ikut dibatalkan.")) return;
    setBusy(id);
    setErr("");
    const { error } = await supabase.rpc("driver_set_trip_status", { _trip_id: id, _status: status });
    setBusy(null);
    if (error) return setErr(error.message);
    refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-foreground">Jadwal Jastip</h2>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
          {showForm ? "Tutup" : "+ Buat jadwal"}
        </button>
      </div>
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      {showForm && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="rounded-lg bg-accent p-2.5 text-xs text-accent-foreground">
            💡 <b>Sistem Multi-Paket:</b> Anda dapat membawa banyak paket pesanan sekaligus dalam satu perjalanan rute ini sesuai kapasitas kuota.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Wilayah Asal (mis. Metro)" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            <input className={inputCls} placeholder="Wilayah Tujuan (mis. Sekampung)" value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value })} />
          </div>
          <label className="block text-xs text-muted-foreground">Waktu Berangkat
            <input type="datetime-local" className={inputCls} value={form.depart} onChange={(e) => setForm({ ...form, depart: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Kapasitas Maksimal Paket
              <input type="number" min={1} max={50} className={inputCls} value={form.quota} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} />
            </label>
            <div className="text-xs text-muted-foreground">
              Tarif Titip (Ditetapkan Admin)
              <div className="mt-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-bold text-foreground">
                {formatRupiah(settings.data?.jastip_package_fee ?? 15000)} / paket
              </div>
            </div>
          </div>
          <input className={inputCls} placeholder="Catatan rute (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} />
          <button disabled={busy === "create"} onClick={create} className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
            {busy === "create" ? "Menyimpan…" : "Terbitkan Rute Jastip"}
          </button>
        </div>
      )}
      {trips.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jadwal.</p>}
      {trips.data?.map((t) => {
        const bs = bookings.data?.filter((b) => b.trip_id === t.id) ?? [];
        return (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-foreground">{t.origin_label} → {t.dest_label}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDepart(t.depart_at)} · {slotTypeLabel(t.slot_type)} · {formatRupiah(t.price_per_slot)}/{t.slot_type === "kursi" ? "kursi" : "paket"}
                </div>
              </div>
              <div className="text-right text-xs">
                <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">{TRIP_STATUS_LABEL[t.status]}</span>
                <div className="mt-1 text-muted-foreground">Terisi {t.booked}/{t.quota}</div>
              </div>
            </div>
            {bs.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-lg bg-muted p-2 text-xs">
                {bs.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span className="text-foreground">{b.contact_name} · {b.slots} {t.slot_type === "kursi" ? "kursi" : "paket"} · {b.contact_wa}{b.notes ? ` · ${b.notes}` : ""}</span>
                    <span className="shrink-0 text-muted-foreground">{formatRupiah(b.total)} {b.payment_method === "cod" ? "COD" : "TF"}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {t.status === "open" && (
                <button disabled={busy === t.id} onClick={() => setStatus(t.id, "berjalan")} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Mulai jalan</button>
              )}
              {t.status === "berjalan" && (
                <button disabled={busy === t.id} onClick={() => setStatus(t.id, "selesai")} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Tandai selesai</button>
              )}
              {(t.status === "open" || t.status === "berjalan") && (
                <button disabled={busy === t.id} onClick={() => setStatus(t.id, "dibatalkan")} className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50">Batalkan</button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
