import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Phone, QrCode, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { RouteMap } from "@/components/order/RouteMap";
import { DriverInfoCard } from "@/components/order/DriverInfoCard";
import { StatusBadge, btnPrimary, btnDanger } from "@/components/order/OrderCard";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/config";
import { DRIVER_NEXT_LABEL, SERVICE_NAME, STATUS_LABEL } from "@/lib/order-status";
import { DriverTransactionBreakdown } from "@/components/order/DriverTransactionBreakdown";
import { DriverItemCostCard } from "@/components/order/DriverItemCostCard";
import { DriverLiveTracking } from "@/components/order/DriverLiveTracking";

export const Route = createFileRoute("/_authenticated/pesanan/$id")({
  head: () => ({
    meta: [
      { title: "Detail Pesanan — Mider" },
      { name: "description", content: "Status pengantaran dan chat pesanan Mider." },
      { property: "og:title", content: "Detail Pesanan — Mider" },
      { property: "og:description", content: "Status dan chat pesanan Mider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const order = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["order-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["order", id] });
        qc.invalidateQueries({ queryKey: ["order-history", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const o = order.data;
  if (order.isLoading)
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Memuat…</p>
      </div>
    );
  if (!o)
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Pesanan tidak ditemukan. <Link to="/pesanan" className="text-primary">Kembali</Link>
        </p>
      </div>
    );

  const isOwner = o.user_id === user?.id;
  const isMyDriver = o.driver_id === user?.id;
  const canChat = isOwner || isMyDriver || isAdmin;
  const orderWithShopContact = o as typeof o & { shop_wa?: string | null };
  const emergencyPhone = isMyDriver ? (orderWithShopContact.shop_wa || (o.service === "kirim" ? o.recipient_wa : null)) : null;
  const cleanPhone = (phone: string) => phone.replace(/\D/g, "").replace(/^0/, "62");
  const emergencyMessage = `Halo, saya kurir Mider mengantarkan pesanan dari ${o.sender_name}. Saya sudah di lokasi.`;
  const itemCost = Number((o as any).item_cost ?? 0);
  const calculatedTotal = (o.shipping_fare || 0) + (o.consumer_service_fee || 0) + itemCost;
  const finalTotal = Math.max(o.total || 0, calculatedTotal);

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setErr("");
    const { error } = await fn();
    setBusy(false);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["order-history", id] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["driver-wallet-earnings"] });
    qc.invalidateQueries({ queryKey: ["wallet-page"] });
    qc.invalidateQueries({ queryKey: ["driver-jobs"] });
    qc.invalidateQueries({ queryKey: ["admin-financial-overview"] });
  }

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[65%] text-right font-medium text-foreground">{v}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-foreground">Pesanan #{o.code}</h1>
          <StatusBadge status={o.status} />
        </div>
        {o.driver_id && ["diambil", "dijemput", "diantar"].includes(o.status) && (
          <DriverInfoCard driverId={o.driver_id} />
        )}
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        <div className="flex flex-wrap gap-2">
          {isMyDriver && DRIVER_NEXT_LABEL[o.status] && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => {
                if (
                  o.status === "diantar" &&
                  (o.service === "belanja" || String(o.service) === "point_food") &&
                  itemCost === 0
                ) {
                  const proceed = window.confirm(
                    "Perhatian: Nominal belanjaan masih Rp 0. Jika ada talangan belanjaan/makanan, harap simpan nominal terlebih dahulu agar masuk ke tagihan konsumen. Tetap selesaikan tanpa talangan?"
                  );
                  if (!proceed) return;
                }
                act(() => supabase.rpc("driver_advance_order", { _order_id: o.id }));
              }}
            >
              {DRIVER_NEXT_LABEL[o.status]}
            </button>
          )}
          {isAdmin && o.status === "menunggu_verifikasi" && (
            <>
              <button className={btnPrimary} disabled={busy} onClick={() => act(() => supabase.rpc("admin_review_order", { _order_id: o.id, _approve: true }))}>
                Setujui → pool driver
              </button>
              <button className={btnDanger} disabled={busy} onClick={() => act(() => supabase.rpc("admin_review_order", { _order_id: o.id, _approve: false, _note: window.prompt("Alasan penolakan") ?? "" }))}>
                Tolak
              </button>
            </>
          )}
          {((isOwner && ["menunggu_verifikasi", "tersedia"].includes(o.status)) ||
            (isAdmin && !["selesai", "dibatalkan", "ditolak", "menunggu_verifikasi"].includes(o.status))) && (
            <button
              className={btnDanger}
              disabled={busy}
              onClick={() => window.confirm("Batalkan pesanan ini?") && act(() => supabase.rpc("cancel_order", { _order_id: o.id }))}
            >
              Batalkan pesanan
            </button>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          {isMyDriver && ["diambil", "dijemput", "diantar"].includes(o.status) && (
            <DriverLiveTracking orderId={o.id} driverId={user!.id} active />
          )}
          <RouteMap
            orderId={o.id}
            trackingActive={["diambil", "dijemput", "diantar"].includes(o.status)}
            origin={{ lat: o.origin_lat, lng: o.origin_lng }}
            destination={{ lat: o.dest_lat, lng: o.dest_lng }}
            encodedPolyline={o.encoded_polyline}
            className="h-52 w-full rounded-xl border border-border"
          />
          {row("Layanan", SERVICE_NAME[o.service] ?? o.service)}
          {row("Dari", o.origin_address)}
          {row("Ke", o.dest_address)}
          {row("Jarak", `${(o.distance_meters / 1000).toFixed(1)} km · ±${Math.round(o.duration_seconds / 60)} menit`)}
          {row(o.service === "belanja" ? "Belanjaan" : "Barang", o.item_detail)}
          {row("Paket", `${o.weight_kg} kg · ${o.length_cm}×${o.width_cm}×${o.height_cm} cm`)}
          {row("Pemesan", `${o.sender_name} (${o.sender_wa})`)}
          {o.service === "kirim" && row("Penerima", `${o.recipient_name} (${o.recipient_wa})`)}
          {o.notes && row("Catatan", o.notes)}
          {row("Pembayaran", o.payment_method === "cod" ? "COD (tunai ke driver)" : "Transfer (QRIS)")}
          <div className="space-y-1 rounded-xl bg-muted p-3 text-sm">
            {row("Ongkos Kirim", formatRupiah(o.shipping_fare))}
            {row("Biaya Layanan Aplikasi", formatRupiah(o.consumer_service_fee))}
            {(o.service === "belanja" || Number((o as any).item_cost ?? 0) > 0) && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Belanjaan (Talangan Struk)</span>
                <span className="max-w-[65%] text-right font-medium text-foreground">
                  {Number((o as any).item_cost ?? 0) > 0 ? formatRupiah(Number((o as any).item_cost)) : "Menunggu struk driver"}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-bold">
              <span className="text-foreground">Total Tagihan</span>
              <span className="text-primary">{formatRupiah(finalTotal)}</span>
            </div>
            {(o as any).item_receipt_url && (
              <div className="pt-2 text-right">
                <a href={(o as any).item_receipt_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline">
                  Lihat Foto Struk Pembelian ↗
                </a>
              </div>
            )}
          </div>
          {isMyDriver && (o.service === "belanja" || String(o.service) === "point_food") && (
            <DriverItemCostCard
              order={o}
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ["order", id] });
                qc.invalidateQueries({ queryKey: ["messages", id] });
              }}
            />
          )}
          {isMyDriver && <DriverTransactionBreakdown order={o} />}
          {o.admin_note && row("Catatan admin", o.admin_note)}
        </div>

        {isOwner && o.payment_method === "transfer" && !["ditolak", "dibatalkan"].includes(o.status) && (
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-sm font-semibold text-foreground">Bayar via QRIS</p>
            <div className="mx-auto mt-3 flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
              <QrCode className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">QRIS resmi segera hadir — admin akan kirim lewat chat.</p>
            <p className="mt-1 text-lg font-bold text-primary">{formatRupiah(finalTotal)}</p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">Riwayat status</h2>
          <ol className="mt-2 space-y-1">
            {history.data?.map((h) => (
              <li key={h.id} className="flex justify-between text-xs">
                <span className="text-foreground">{STATUS_LABEL[h.status]}{h.note ? ` — ${h.note}` : ""}</span>
                <span className="text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {canChat && user ? (
          <>
            <div className="flex flex-wrap gap-2">
              <a href="#order-chat" className={btnPrimary}>
                <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" />Buka Chat Aplikasi</span>
              </a>
              {emergencyPhone && cleanPhone(emergencyPhone) && (
                <a
                  href={`https://wa.me/${cleanPhone(emergencyPhone)}?text=${encodeURIComponent(emergencyMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                >
                  <Phone className="h-4 w-4" />WhatsApp darurat
                </a>
              )}
            </div>
            <div id="order-chat">
              <OrderChat orderId={o.id} myId={user.id} />
            </div>
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Chat tersedia setelah Anda mengambil order ini.</p>
        )}
      </main>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { user: "Pemesan", driver: "Driver", admin: "Admin" };

function OrderChat({ orderId, myId }: { orderId: string; myId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["messages", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.from("order_messages").insert({ order_id: orderId, sender_id: myId, body });
    setSending(false);
    if (!error) {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", orderId] });
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">Chat pesanan</h2>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {msgs.data?.length === 0 && <p className="text-xs text-muted-foreground">Belum ada pesan.</p>}
        {msgs.data?.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {!mine && (
                  <div className="text-[10px] font-semibold opacity-70">
                    {m.sender_name} · {ROLE_LABEL[m.sender_role] ?? m.sender_role}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="mt-0.5 text-right text-[10px] opacity-60">
                  {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Tulis pesan…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <button disabled={sending || !text.trim()} className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-50" aria-label="Kirim">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
