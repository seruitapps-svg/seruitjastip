import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";
import { formatDepart, slotTypeLabel } from "./JastipCatalog";
import { TRIP_STATUS_LABEL } from "./DriverJastipTrips";

type Booking = {
  id: string;
  code: string;
  status: string;
  origin_label?: string | null;
  dest_label?: string | null;
  origin_area?: string | null;
  dest_area?: string | null;
  depart_at?: string | null;
  slot_type?: string | null;
  service_type?: string | null;
  slots: number;
  total?: number | null;
  total_price?: number | null;
  payment_method: string;
  service_fee?: number | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  is_for_other?: boolean;
  recipient_name?: string | null;
  shop_name?: string | null;
};

function DriverReveal({ bookingId }: { bookingId: string }) {
  const q = useQuery({
    queryKey: ["jastip-driver", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("jastip_booking_driver", { _booking_id: bookingId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  if (!q.data) return null;
  return (
    <div className="mt-2 rounded-lg bg-accent p-2 text-xs text-accent-foreground">
      Driver: <b>{q.data.full_name}</b> · {q.data.vehicle_type} <strong className="tracking-wide text-foreground">{q.data.vehicle_plate}</strong>
      <p className="mt-1 text-[11px] text-muted-foreground">💬 Komunikasi pengantaran dilakukan melalui chat aplikasi untuk keamanan pesanan Anda.</p>
    </div>
  );
}

export function MyJastipBookings({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const q = useQuery({
    queryKey: ["my-jastip", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jastip_bookings").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
  });

  async function cancel(id: string) {
    if (!window.confirm("Batalkan pesanan ini?")) return;
    const { error } = await supabase.rpc("cancel_jastip_booking", { _booking_id: id });
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["my-jastip"] });
    qc.invalidateQueries({ queryKey: ["jastip-catalog"] });
  }

  if (!q.data?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold text-foreground">Jastip Terjadwal</h2>
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      {q.data.map((b) => {
        const serviceLabel = b.service_type === "nebeng" ? "Nebeng" : b.service_type === "belanja" ? "Jastip Belanja" : slotTypeLabel(b.slot_type ?? "paket");
        const origin = b.origin_area ?? b.origin_label ?? "Rute";
        const dest = b.dest_area ?? b.dest_label ?? "";
        const total = b.total_price ?? b.total ?? 0;
        return (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">#{b.code} · {serviceLabel} · {b.slots} {b.service_type === "nebeng" ? "kursi" : "paket"}</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{origin}{dest ? ` → ${dest}` : ""}</div>
                {b.depart_at && <div className="text-xs text-muted-foreground">Berangkat {formatDepart(b.depart_at)}</div>}
                {b.pickup_address && <div className="mt-1 text-xs text-muted-foreground">📍 Jemput: {b.pickup_address}</div>}
                {b.dropoff_address && <div className="text-xs text-muted-foreground">🏁 Antar: {b.dropoff_address}</div>}
                {b.is_for_other && b.recipient_name && <div className="text-xs text-muted-foreground">Penerima: {b.recipient_name}</div>}
                {b.shop_name && <div className="text-xs text-muted-foreground">Toko: {b.shop_name}</div>}
              </div>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">{TRIP_STATUS_LABEL[b.status] ?? b.status}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{b.payment_method === "cod" ? "COD" : "Saldo"}{b.service_fee != null ? ` · Layanan ${formatRupiah(b.service_fee)}` : ""}</span>
              <span className="font-bold text-primary">{formatRupiah(total)}</span>
            </div>
            {(b.status === "berjalan" || b.status === "selesai") ? (
              <DriverReveal bookingId={b.id} />
            ) : b.status === "dipesan" ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Info driver muncul saat perjalanan dimulai.</span>
                <button onClick={() => cancel(b.id)} className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">Batalkan</button>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
