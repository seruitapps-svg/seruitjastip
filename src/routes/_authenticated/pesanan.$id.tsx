import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Phone, QrCode, Send, Navigation, X, ReceiptText, ExternalLink, Star } from "lucide-react";
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
  const [isNavigating, setIsNavigating] = useState(false);
  const [showNavDetails, setShowNavDetails] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [driverPinInput, setDriverPinInput] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [merchantRatingValue, setMerchantRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [merchantReviewText, setMerchantReviewText] = useState("");
  const [ratingSent, setRatingSent] = useState(false);

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

  async function handleAdvanceClick() {
    if (
      o.status === "diantar" &&
      (o.service === "belanja" || String(o.service) === "point_food") &&
      itemCost === 0
    ) {
      const proceed = window.confirm(
        "Perhatian: Nominal belanjaan masih Rp 0. Jika ada talangan belanjaan/makanan, simpan nominal terlebih dahulu. Tetap selesaikan tanpa talangan?"
      );
      if (!proceed) return;
    }

    const foodType = (o as any).food_order_type;
    const needsPin = foodType === "mitra" && o.status === "diantar";
    if (needsPin) {
      setDriverPinInput("");
      setErr("");
      setShowPinModal(true);
      return;
    }
    await act(() => supabase.rpc("driver_advance_order", { _order_id: o.id }));
  }

  async function confirmMitraRestoPin() {
    const pin = driverPinInput.trim();
    if (!/^\d{4}$/.test(pin)) {
      setErr("PIN harus tepat 4 angka.");
      return;
    }
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("driver_advance_order", {
      _order_id: o.id,
      _pin: pin,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setShowPinModal(false);
    setDriverPinInput("");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["order-history", id] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["driver-wallet-earnings"] });
    qc.invalidateQueries({ queryKey: ["wallet-page"] });
    qc.invalidateQueries({ queryKey: ["driver-jobs"] });
    qc.invalidateQueries({ queryKey: ["admin-financial-overview"] });
  }

  async function submitRating() {
    setBusy(true);
    setErr("");
    const { error } = await (supabase as any).rpc("submit_order_rating", {
      _order_id: id,
      _driver_rating: ratingValue,
      _driver_review: reviewText.trim() || null,
      _merchant_rating: (o as any).merchant_id ? merchantRatingValue : null,
      _merchant_review: (o as any).merchant_id ? merchantReviewText.trim() || null : null,
    });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }
    setRatingSent(true);
  }

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[65%] text-right font-medium text-foreground">{v}</span>
    </div>
  );

  if (isNavigating && isMyDriver && ["diambil", "dijemput", "diantar"].includes(o.status)) {
    const navigationDestination = o.status === "diambil" ? o.origin_address : o.dest_address;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navigationDestination)}&travelmode=driving`;
    return (
      <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-background">
        <div className="relative min-h-0 flex-1">
          <RouteMap
            orderId={o.id}
            trackingActive
            followDriver
            origin={{ lat: o.origin_lat, lng: o.origin_lng }}
            destination={{ lat: o.dest_lat, lng: o.dest_lng }}
            encodedPolyline={o.encoded_polyline}
            className="h-full w-full"
          />
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsNavigating(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2.5 text-sm font-bold text-foreground shadow-lg backdrop-blur"
            >
              <X className="h-4 w-4" /> Keluar navigasi
            </button>
            <span className="rounded-full bg-background/95 px-3 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur">
              {STATUS_LABEL[o.status]}
            </span>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 top-16 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-lg"
          >
            <ExternalLink className="h-4 w-4" /> Navigasi suara
          </a>
          {showNavDetails && (
            <div className="absolute inset-x-3 bottom-3 max-h-[58%] overflow-y-auto rounded-2xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-foreground">Rincian Transaksi #{o.code}</h2>
                <button type="button" onClick={() => setShowNavDetails(false)} aria-label="Tutup rincian transaksi" className="rounded-lg p-2 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                {row("Status", STATUS_LABEL[o.status])}
                {row("Layanan", SERVICE_NAME[o.service] ?? o.service)}
                {row("Dari", o.origin_address)}
                {row("Ke", o.dest_address)}
                {row("Jarak", `${(o.distance_meters / 1000).toFixed(1)} km · ±${Math.round(o.duration_seconds / 60)} menit`)}
                {row("Pemesan", `${o.sender_name} (${o.sender_wa})`)}
                {o.service === "kirim" && row("Penerima", `${o.recipient_name} (${o.recipient_wa})`)}
                {row("Ongkos Kirim", formatRupiah(o.shipping_fare))}
                {row("Biaya Layanan", formatRupiah(o.consumer_service_fee))}
                {(o.service === "belanja" || itemCost > 0) && row("Biaya belanja/talangan", itemCost > 0 ? formatRupiah(itemCost) : "Menunggu struk driver")}
                <div className="flex justify-between gap-4 border-t border-border pt-3 font-extrabold">
                  <span>Total Tagihan</span><span className="text-primary">{formatRupiah(finalTotal)}</span>
                </div>
                {o.notes && row("Catatan", o.notes)}
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-border bg-background p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {isMyDriver && <DriverLiveTracking orderId={o.id} driverId={user!.id} active />}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowNavDetails((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold text-foreground"
            >
              <ReceiptText className="h-4 w-4" /> Rincian Transaksi
            </button>
            {DRIVER_NEXT_LABEL[o.status] ? (
              <button
                type="button"
                className={btnPrimary}
                disabled={busy}
                onClick={() => {
                  void handleAdvanceClick();
                }}
              >
                {DRIVER_NEXT_LABEL[o.status]}
              </button>
            ) : (
              <button type="button" onClick={() => setIsNavigating(false)} className={btnPrimary}>Kembali ke pesanan</button>
            )}
          </div>
          {err && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-foreground">Pesanan #{o.code}</h1>
          <StatusBadge status={o.status} />
        </div>
        {o.driver_id && ["diambil", "dijemput", "diantar"].includes(o.status) && (
          <DriverInfoCard orderId={o.id} />
        )}
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        <div className="flex flex-wrap gap-2">
          {isMyDriver && ["diambil", "dijemput", "diantar"].includes(o.status) && (
            <button type="button" className={btnPrimary} onClick={() => { setShowNavDetails(false); setIsNavigating(true); }}>
              <span className="inline-flex items-center gap-2"><Navigation className="h-4 w-4" /> Mulai Navigasi</span>
            </button>
          )}
          {isMyDriver && DRIVER_NEXT_LABEL[o.status] && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => {
                void handleAdvanceClick();
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
                <button type="button" onClick={() => setShowReceiptModal(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  <ReceiptText className="h-3.5 w-3.5" />
                  Lihat Foto Struk Pembelian
                </button>
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
        {isOwner && (o as any).confirmation_pin && (o as any).food_order_type === "mitra" && ["diambil", "dijemput", "diantar"].includes(o.status) && (
          <section className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-50/50 p-4 text-center dark:bg-emerald-950/20">
            <p className="text-xs font-medium text-muted-foreground">PIN Konfirmasi Pengantaran</p>
            <p className="my-1 text-3xl font-extrabold tracking-widest text-emerald-600">{(o as any).confirmation_pin}</p>
            <p className="text-[11px] text-muted-foreground">
              Berikan 4 angka PIN ini kepada driver saat menerima pesanan demi keamanan transaksi.
            </p>
          </section>
        )}

        {showPinModal && isMyDriver && (o as any).food_order_type === "mitra" && o.status === "diantar" && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="mitra-pin-modal-title">
            <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
              <div>
                <h2 id="mitra-pin-modal-title" className="text-lg font-bold text-foreground">Konfirmasi penjemputan Mitra Resto</h2>
                <p className="mt-1 text-sm text-muted-foreground">Masukkan nomor antrean/PIN 4 digit yang ditampilkan kepada pemesan untuk memverifikasi pesanan Mitra Resto Resmi.</p>
              </div>
              <label htmlFor="mitra-confirmation-pin" className="block text-sm font-medium text-foreground">PIN nomor antrean</label>
              <input id="mitra-confirmation-pin" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={driverPinInput} onChange={(event) => setDriverPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-foreground" />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => { setShowPinModal(false); setDriverPinInput(""); setErr(""); }} className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-foreground">Batal</button>
                <button type="button" disabled={busy || driverPinInput.length !== 4} onClick={() => void confirmMitraRestoPin()} className={`flex-1 ${btnPrimary}`}>
                  {busy ? "Memverifikasi..." : "Konfirmasi PIN"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isOwner && o.status === "selesai" && !ratingSent && (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Beri penilaian</h2>
              <p className="mt-1 text-xs text-muted-foreground">Bagikan pengalaman setelah pesanan selesai.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Rating driver</p>
              <div className="flex gap-2" role="group" aria-label="Rating driver">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setRatingValue(value)} aria-label={`${value} bintang untuk driver`} aria-pressed={ratingValue === value} className="rounded-md p-1">
                    <Star className={`h-7 w-7 ${value <= ratingValue ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={1000} rows={2} placeholder="Ulasan driver (opsional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            {(o as any).merchant_id && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Rating restoran/merchant</p>
                <div className="flex gap-2" role="group" aria-label="Rating restoran">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" onClick={() => setMerchantRatingValue(value)} aria-label={`${value} bintang untuk restoran`} aria-pressed={merchantRatingValue === value} className="rounded-md p-1">
                      <Star className={`h-7 w-7 ${value <= merchantRatingValue ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <textarea value={merchantReviewText} onChange={(event) => setMerchantReviewText(event.target.value)} maxLength={1000} rows={2} placeholder="Ulasan restoran (opsional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
            )}
            <button type="button" disabled={busy} onClick={() => void submitRating()} className={btnPrimary}>
              {busy ? "Mengirim..." : "Kirim penilaian"}
            </button>
          </section>
        )}

        {isOwner && o.status === "selesai" && ratingSent && (
          <section className="rounded-2xl border border-emerald-500/20 bg-card p-4 text-sm font-medium text-emerald-700">
            Terima kasih! Penilaian kamu berhasil dikirim.
          </section>
        )}

        {showReceiptModal && (o as any).item_receipt_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[90vh] max-w-lg overflow-hidden rounded-2xl bg-card p-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold text-foreground">Foto Struk Pembelian</span>
              <button type="button" onClick={() => setShowReceiptModal(false)} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex max-h-[75vh] items-center justify-center overflow-auto rounded-xl bg-black/5">
              <img src={(o as any).item_receipt_url} alt="Struk Pembelian" className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          </div>
        </div>
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
