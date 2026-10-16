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
  const [form, setForm] = useState({
    origin: "",
    dest: "",
    depart: "",
    quota: 8,
    enableNebeng: false,
    nebengQuota: 1,
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["app-settings-jastip"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("jastip_package_fee, jastip_nebeng_fee").eq("id", 1).maybeSingle();
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
    if (!form.origin.trim() || !form.dest.trim()) return setErr("Isi wilayah asal dan tujuan.");
    if (form.enableNebeng && (form.nebengQuota < 1 || form.nebengQuota > 4)) return setErr("Kuota Nebeng harus antara 1–4 kursi.");
    setBusy("create");
    const { error } = await supabase.rpc("driver_create_trip", {
      _origin: form.origin,
      _dest: form.dest,
      _depart_at: new Date(form.depart).toISOString(),
      _slot_type: "paket",
      _quota: form.quota,
      _price: Number(settings.data?.jastip_package_fee ?? 15000),
      _notes: form.notes,
      _enable_nebeng: form.enableNebeng,
      _nebeng_quota: form.enableNebeng ? form.nebengQuota : 0,
      _nebeng_price: Number(settings.data?.jastip_nebeng_fee ?? 20000),
    });
    setBusy(null);
    if (error) return setErr(error.message);
    setShowForm(false);
    setForm({ origin: "", dest: "", depart: "", quota: 8, enableNebeng: false, nebengQuota: 1, notes: "" });
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
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
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
              Tarif Kirim/Belanja (Ditetapkan Admin)
              <div className="mt-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-bold text-foreground">
                {formatRupiah(settings.data?.jastip_package_fee ?? 15000)} / paket
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Aktifkan Layanan Nebeng</p>
                <p className="text-xs text-muted-foreground">Bawa penumpang searah rute</p>
              </div>
              <input
                type="checkbox"
                checked={form.enableNebeng}
                onChange={(e) => setForm({ ...form, enableNebeng: e.target.checked })}
                className="h-5 w-5 cursor-pointer rounded accent-primary"
              />
            </div>
            {form.enableNebeng && (
              <div className="border-t border-border/60 pt-2">
                <label className="mb-1 block text-xs text-muted-foreground">Jumlah Kursi Penumpang Kosong</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={form.nebengQuota}
                  onChange={(e) => setForm({ ...form, nebengQuota: Number(e.target.value) })}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-muted-foreground">Tarif Nebeng dari admin: {formatRupiah(settings.data?.jastip_nebeng_fee ?? 20000)} / kursi</p>
              </div>
            )}
          </div>

          <input className={inputCls} placeholder="Catatan rute (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} />
          <button disabled={busy === "create"} onClick={create} className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
            {busy === "create" ? "Menyimpan…" : "Terbitkan Rute Jastip"}
          </button>
        </div>
      )}
      {trips.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jadwal.</p>}
      {trips.data?.map((t) => {
        const trip = t as typeof t & {
          origin_area?: string;
          dest_area?: string;
          booked_slots?: number;
          enable_nebeng?: boolean;
          nebeng_quota?: number;
          nebeng_booked?: number;
          nebeng_price?: number;
        };
        const bs = bookings.data?.filter((b) => b.trip_id === t.id) ?? [];
        return (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-foreground">{trip.origin_area ?? t.origin_label} → {trip.dest_area ?? t.dest_label}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDepart(t.depart_at)} · {slotTypeLabel(t.slot_type)} · {formatRupiah(t.price_per_slot)}/{t.slot_type === "kursi" ? "kursi" : "paket"}
                </div>
              </div>
              <div className="text-right text-xs">
                <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">{TRIP_STATUS_LABEL[t.status]}</span>
                <div className="mt-1 text-muted-foreground">Terisi {trip.booked_slots ?? t.booked}/{t.quota}</div>
                {trip.enable_nebeng && <div className="mt-1 text-muted-foreground">Nebeng {trip.nebeng_booked ?? 0}/{trip.nebeng_quota ?? 0}</div>}
              </div>
            </div>
            {bs.length > 0 && (
              <ul className="mt-2 space-y-2 rounded-lg bg-muted p-2 text-xs">
                {bs.map((booking) => {
                  const b = booking as typeof booking & {
                    service_type?: string;
                    recipient_name?: string | null;
                    recipient_wa?: string | null;
                    shop_name?: string | null;
                    shop_wa?: string | null;
                  };
                  const wa = (b.shop_wa || b.recipient_wa || "").replace(/\D/g, "").replace(/^0/, "62");
                  const message = `Halo, saya driver Seruit untuk pesanan ${b.code ?? ""}. Saya sedang menuju lokasi.`;
                  return (
                    <li key={b.id} className="space-y-1.5 rounded-lg border border-border bg-card p-2.5 text-xs">
                      <div className="flex flex-wrap justify-between gap-2 font-bold text-foreground">
                        <span>{b.contact_name} ({b.slots} {b.service_type === "nebeng" ? "kursi" : "paket"}) · {b.contact_wa}</span>
                        <span className="text-primary">{formatRupiah(b.total)} ({b.payment_method === "cod" ? "COD" : "Saldo"})</span>
                      </div>
                      {(b.recipient_name || b.shop_name) && (
                        <div className="text-muted-foreground">
                          {b.recipient_name ? `Penerima: ${b.recipient_name}` : ""}
                          {b.recipient_name && b.shop_name ? " · " : ""}
                          {b.shop_name ? `Toko: ${b.shop_name}` : ""}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                        {b.pickup_lat != null && b.pickup_lng != null ? (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${b.pickup_lat},${b.pickup_lng}`} target="_blank" rel="noreferrer" className="rounded bg-accent px-2 py-1 text-accent-foreground hover:underline">
                            📍 Ambil: {b.pickup_address || "-"}
                          </a>
                        ) : <span className="text-muted-foreground">📍 Jemput: {b.pickup_address || "-"}</span>}
                        {b.dropoff_lat != null && b.dropoff_lng != null ? (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${b.dropoff_lat},${b.dropoff_lng}`} target="_blank" rel="noreferrer" className="rounded bg-accent px-2 py-1 text-accent-foreground hover:underline">
                            🏁 Antar: {b.dropoff_address || "-"}
                          </a>
                        ) : <span className="text-muted-foreground">🏁 Antar: {b.dropoff_address || "-"}</span>}
                      </div>
                      {b.service_type === "belanja" && b.shop_name && <div className="text-muted-foreground">Detail toko: {b.shop_name}{b.shop_wa ? ` · ${b.shop_wa}` : ""}</div>}
                      {(b.recipient_wa || b.shop_wa) && wa && (
                        <a href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="inline-flex rounded border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent">
                          WhatsApp darurat
                        </a>
                      )}
                    </li>
                  );
                })}
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
