import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Package, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/config";

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function slotTypeLabel(t: string) {
  return t === "kursi" ? "Kursi penumpang" : "Paket titipan";
}

export function formatDepart(d: string) {
  return new Date(d).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function JastipCatalog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [slots, setSlots] = useState(1);
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"cod" | "transfer">("cod");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["jastip-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("jastip_catalog");
      if (error) throw error;
      return data;
    },
  });

  async function book(tripId: string) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("book_jastip_slot", {
      _trip_id: tripId, _slots: slots, _payment: payment, _name: name, _wa: wa, _notes: notes,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["jastip-catalog"] });
    qc.invalidateQueries({ queryKey: ["my-jastip"] });
    navigate({ to: "/pesanan" });
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">
        Pilih jadwal trayek, pesan langsung terkonfirmasi. Info driver muncul saat perjalanan dimulai.
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Memuat jadwal…</p>}
      {q.isError && <p className="text-sm text-destructive">Gagal memuat jadwal.</p>}
      {q.data?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada jadwal Jastip yang tersedia.
        </p>
      )}
      {q.data?.map((t) => {
        const Icon = t.slot_type === "kursi" ? Users : Package;
        const open = openId === t.id;
        return (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">
                  {t.origin_label} → {t.dest_label}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDepart(t.depart_at)}</span>
                  <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{slotTypeLabel(t.slot_type)}</span>
                </div>
                {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-primary">{formatRupiah(t.price_per_slot)}</div>
                <div className="text-[11px] text-muted-foreground">
                  /{t.slot_type === "kursi" ? "kursi" : "paket"}
                </div>
                <div className="mt-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  Sisa {t.remaining}/{t.quota}
                </div>
              </div>
            </div>
            {!open ? (
              <button
                onClick={() => { setOpenId(t.id); setSlots(1); setErr(""); }}
                className="mt-3 w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
              >
                Pesan sekarang
              </button>
            ) : !user ? (
              <Link to="/auth" search={{ redirect: "/" }} className="mt-3 block w-full rounded-lg bg-primary py-2 text-center text-xs font-bold text-primary-foreground">
                Masuk untuk memesan
              </Link>
            ) : (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="Nama Anda" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                  <input className={inputCls} placeholder="No. WA 08…" value={wa} onChange={(e) => setWa(e.target.value)} maxLength={16} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted-foreground">
                    Jumlah {t.slot_type === "kursi" ? "kursi" : "paket"}
                    <input type="number" min={1} max={Math.min(10, t.remaining)} className={inputCls} value={slots} onChange={(e) => setSlots(Number(e.target.value))} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Pembayaran
                    <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value as "cod" | "transfer")}>
                      <option value="cod">Tunai (COD)</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </label>
                </div>
                <input className={inputCls} placeholder={t.slot_type === "kursi" ? "Titik jemput / catatan" : "Isi titipan / catatan"} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
                {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => book(t.id)} className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                    {busy ? "Memesan…" : `Pesan · ${formatRupiah(t.price_per_slot * (slots || 0))}`}
                  </button>
                  <button onClick={() => setOpenId(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Batal</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
