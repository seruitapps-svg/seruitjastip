import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingBag, MapPin, ToggleLeft, ToggleRight, ImagePlus, Save, LoaderCircle, Plus, Pencil, Trash2, X, UtensilsCrossed, ChevronUp, Wallet, ArrowDownToLine, Clock3, CircleDollarSign } from "lucide-react";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadCompressedMedia } from "@/lib/image-compressor";
import { formatRupiah } from "@/lib/config";
import { STATUS_LABEL } from "@/lib/order-status";
import { sendOrderPushEvent } from "@/lib/push-notifications";
import { installAudioUnlock, startAlertLoop } from "@/lib/audio-alert";
import { installAudioUnlock, startAlertLoop } from "@/lib/audio-alert";

export const Route = createFileRoute("/_authenticated/mitra")({
  head: () => ({
    meta: [
      { title: "Dashboard Resto Mitra — Mider" },
      { name: "description", content: "Dashboard operasional mitra resto Mider." },
    ],
  }),
  component: MitraDashboardPage,
});

function MitraDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [operatingMode, setOperatingMode] = useState<"manual" | "automatic">("manual");
  const [operatingSchedule, setOperatingSchedule] = useState<Record<string, { open: boolean; start: string; end: string }>>({
    "1": { open: true, start: "08:00", end: "21:00" },
    "2": { open: true, start: "08:00", end: "21:00" },
    "3": { open: true, start: "08:00", end: "21:00" },
    "4": { open: true, start: "08:00", end: "21:00" },
    "5": { open: true, start: "08:00", end: "21:00" },
    "6": { open: true, start: "08:00", end: "21:00" },
    "0": { open: true, start: "08:00", end: "21:00" },
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productAvailable, setProductAvailable] = useState(true);
  const [productPhoto, setProductPhoto] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [respondingOrderId, setRespondingOrderId] = useState<string | null>(null);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [activeDashboardSection, setActiveDashboardSection] = useState<"profile" | "orders" | "history" | "products" | "earnings">("orders");


  const merchantQuery = useQuery({
    queryKey: ["my-merchant-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const merchant = merchantQuery.data;

  const pickupPinsQuery = useQuery({
    queryKey: ["mitra-pickup-pins", merchant?.id],
    enabled: !!merchant?.id && merchant.status === "approved",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_pickup_pins")
        .select("order_id, pin")
        .eq("merchant_id", merchant!.id);
      if (error) throw error;
      return data as { order_id: string; pin: string }[];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["mitra-orders", merchant?.id],
    enabled: !!merchant?.id && merchant?.status === "approved",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("merchant_id", merchant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!merchant?.id || merchant.status !== "approved") return;
    const channel = supabase
      .channel(`mitra-orders-${merchant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchant.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["mitra-orders", merchant.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [merchant?.id, merchant?.status, queryClient]);

  const hasPendingMitraOrder = (ordersQuery.data ?? []).some(
    (order) =>
      (order as any).food_order_type === "mitra" &&
      (order as any).merchant_response === "pending" &&
      order.status === "tersedia",
  );

  useEffect(() => {
    installAudioUnlock();
  }, []);

  useEffect(() => {
    if (!hasPendingMitraOrder || merchant?.status !== "approved") return;
    return startAlertLoop();
  }, [hasPendingMitraOrder, merchant?.status]);

  const hasPendingMitraOrder = (ordersQuery.data ?? []).some(
    (order) =>
      (order as any).food_order_type === "mitra" &&
      (order as any).merchant_response === "pending" &&
      order.status === "tersedia",
  );

  useEffect(() => {
    installAudioUnlock();
  }, []);

  // Dering + getar berulang selama ada pesanan menunggu keputusan resto.
  useEffect(() => {
    if (!hasPendingMitraOrder || merchant?.status !== "approved") return;
    return startAlertLoop();
  }, [hasPendingMitraOrder, merchant?.status]);

  const merchantEarningsQuery = useQuery({
    queryKey: ["mitra-earnings", merchant?.id],
    enabled: !!merchant?.id && merchant?.status === "approved",
    queryFn: async () => {
      const db = supabase as any;
      const [earningsResult, withdrawalsResult] = await Promise.all([
        db.from("merchant_earnings").select("id, order_id, gross_amount, commission_amount, net_amount, status, created_at").eq("merchant_id", merchant!.id).order("created_at", { ascending: false }),
        db.from("merchant_withdrawal_requests").select("id, amount, status, created_at, admin_note, processed_at").eq("merchant_id", merchant!.id).order("created_at", { ascending: false }),
      ]);
      if (earningsResult.error) throw earningsResult.error;
      if (withdrawalsResult.error) throw withdrawalsResult.error;
      return { earnings: earningsResult.data ?? [], withdrawals: withdrawalsResult.data ?? [] };
    },
  });

  const merchantEarnings = merchantEarningsQuery.data?.earnings ?? [];
  const merchantWithdrawals = merchantEarningsQuery.data?.withdrawals ?? [];
  const totalNetEarnings = merchantEarnings
    .filter((entry: any) => ["available", "held"].includes(entry.status))
    .reduce((sum: number, entry: any) => sum + Number(entry.net_amount ?? 0), 0);
  const availableLedgerEarnings = merchantEarnings
    .filter((entry: any) => entry.status === "available")
    .reduce((sum: number, entry: any) => sum + Number(entry.net_amount ?? 0), 0);
  const pendingWithdrawalTotal = merchantWithdrawals
    .filter((entry: any) => ["pending", "approved", "processing"].includes(entry.status))
    .reduce((sum: number, entry: any) => sum + Number(entry.amount ?? 0), 0);
  const paidWithdrawalTotal = merchantWithdrawals
    .filter((entry: any) => entry.status === "paid")
    .reduce((sum: number, entry: any) => sum + Number(entry.amount ?? 0), 0);
  const availableEarnings = Math.max(0, availableLedgerEarnings - pendingWithdrawalTotal - paidWithdrawalTotal);

  async function requestMerchantWithdrawal() {
    if (!merchant || !user || !canOperate || availableEarnings <= 0) return;
    const rawAmount = window.prompt(`Saldo tersedia ${formatRupiah(availableEarnings)}. Masukkan nominal pencairan (Rp):`);
    if (rawAmount === null) return;
    const amount = Number(rawAmount.replace(/[^0-9]/g, ""));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > availableEarnings) {
      setErrorMessage("Nominal pencairan harus berupa angka bulat positif dan tidak melebihi saldo tersedia.");
      return;
    }
    setErrorMessage("");
    setMessage("");
    try {
      const { error } = await (supabase as any).rpc("merchant_request_withdrawal", { _amount: amount });
      if (error) throw error;
      setMessage("Permintaan pencairan terkirim. Saldo masuk status menunggu verifikasi.");
      await queryClient.invalidateQueries({ queryKey: ["mitra-earnings", merchant.id] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Permintaan pencairan gagal dikirim.");
    }
  }

  const productsQuery = useQuery({
    queryKey: ["merchant-products", merchant?.id],
    enabled: !!merchant?.id && merchant?.status === "approved",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("*")
        .eq("merchant_id", merchant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const products = productsQuery.data ?? [];

  useEffect(() => {
    if (!merchant) return;
    setName(merchant.name ?? "");
    setAddress(merchant.address ?? "");
    setPhone(merchant.phone_wa ?? "");
    setOpeningHours(merchant.opening_hours ?? "");
    setOperatingMode((merchant as any).operating_mode === "automatic" ? "automatic" : "manual");
    if ((merchant as any).operating_schedule && typeof (merchant as any).operating_schedule === "object") {
      setOperatingSchedule((current) => ({ ...current, ...(merchant as any).operating_schedule }));
    }
    setLatitude(merchant.latitude != null ? Number(merchant.latitude) : null);
    setLongitude(merchant.longitude != null ? Number(merchant.longitude) : null);
  }, [merchant?.id, merchant?.updated_at]);

  function resetProductEditor() {
    setProductEditorOpen(false);
    setEditingProductId(null);
    setProductName("");
    setProductDescription("");
    setProductPrice("");
    setProductAvailable(true);
    setProductPhoto(null);
  }

  function openNewProductEditor() {
    resetProductEditor();
    setProductEditorOpen(true);
  }

  function openEditProductEditor(product: (typeof products)[number]) {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductDescription(product.description ?? "");
    setProductPrice(String(product.price));
    setProductAvailable(product.is_available);
    setProductPhoto(null);
    setProductEditorOpen(true);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchant || !user || !canOperate || savingProduct) return;

    const normalizedName = productName.trim();
    const parsedPrice = Number(productPrice);
    if (!normalizedName) {
      setErrorMessage("Nama produk wajib diisi.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorMessage("Harga produk harus berupa angka nol atau lebih.");
      return;
    }

    setSavingProduct(true);
    setErrorMessage("");
    setMessage("");
    try {
      let imageUrl: string | null | undefined;
      if (productPhoto) {
        imageUrl = await uploadCompressedMedia("merchant-assets", user.id, "product", productPhoto, {
          maxWidth: 1000,
          maxHeight: 1000,
          quality: 0.78,
        });
      }

      const values = {
        name: normalizedName,
        description: productDescription.trim() || null,
        price: parsedPrice,
        is_available: productAvailable,
        updated_at: new Date().toISOString(),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };

      if (editingProductId) {
        const { error } = await supabase
          .from("merchant_products")
          .update(values)
          .eq("id", editingProductId)
          .eq("merchant_id", merchant.id);
        if (error) throw error;
        setMessage("Produk berhasil diperbarui.");
      } else {
        const { error } = await supabase
          .from("merchant_products")
          .insert({ ...values, merchant_id: merchant.id });
        if (error) throw error;
        setMessage("Produk berhasil ditambahkan.");
      }

      resetProductEditor();
      await queryClient.invalidateQueries({ queryKey: ["merchant-products", merchant.id] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan produk.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function toggleProductAvailability(product: (typeof products)[number]) {
    if (!merchant || !canOperate) return;
    setErrorMessage("");
    try {
      const { error } = await supabase
        .from("merchant_products")
        .update({ is_available: !product.is_available, updated_at: new Date().toISOString() })
        .eq("id", product.id)
        .eq("merchant_id", merchant.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["merchant-products", merchant.id] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengubah ketersediaan produk.");
    }
  }

  async function deleteProduct(product: (typeof products)[number]) {
    if (!merchant || !canOperate) return;
    if (!window.confirm(`Hapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setErrorMessage("");
    setMessage("");
    try {
      const { error } = await supabase
        .from("merchant_products")
        .delete()
        .eq("id", product.id)
        .eq("merchant_id", merchant.id);
      if (error) throw error;
      setMessage("Produk berhasil dihapus.");
      await queryClient.invalidateQueries({ queryKey: ["merchant-products", merchant.id] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menghapus produk.");
    }
  }


  useEffect(() => {
    if (!merchant) return;
    setName(merchant.name ?? "");
    setAddress(merchant.address ?? "");
    setPhone(merchant.phone_wa ?? "");
    setOpeningHours(merchant.opening_hours ?? "");
  }, [merchant?.id, merchant?.updated_at]);

  async function toggleStatus() {
    if (!merchant || !user || changingStatus) return;
    setChangingStatus(true);
    setErrorMessage("");
    setMessage("");
    try {
      const { error } = await supabase
        .from("merchants")
        .update({ is_open: !merchant.is_open })
        .eq("id", merchant.id)
        .eq("user_id", user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["my-merchant-profile", user.id] });
      setMessage(!merchant.is_open ? "Status resto berhasil diubah menjadi buka." : "Status resto berhasil diubah menjadi tutup.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengubah status resto.");
    } finally {
      setChangingStatus(false);
    }
  }

  async function respondToMitraOrder(orderId: string, decision: "accept" | "reject") {
    if (!merchant || !user || respondingOrderId) return;
    setRespondingOrderId(orderId);
    setErrorMessage("");
    setMessage("");
    try {
      const db = supabase as any;
      const { error } = await db.rpc("merchant_respond_to_mitra_order", {
        _order_id: orderId,
        _decision: decision,
      });
      if (error) throw error;
      void sendOrderPushEvent(decision === "accept" ? "merchant_order_ready" : "merchant_rejected", orderId);
      setMessage(decision === "accept"
        ? "Pesanan diterima. PIN pengambilan telah dibuat dan pesanan diteruskan ke pencarian driver."
        : "Pesanan ditolak dan tidak diteruskan ke driver.");
      await queryClient.invalidateQueries({ queryKey: ["mitra-orders", merchant.id] });
      await queryClient.invalidateQueries({ queryKey: ["mitra-pickup-pins", merchant.id] });
      await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Respons pesanan gagal disimpan.");
    } finally {
      setRespondingOrderId(null);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchant || !user || savingProfile) return;
    setSavingProfile(true);
    setErrorMessage("");
    setMessage("");
    try {
      let imageUrl: string | undefined;
      if (photo) {
        imageUrl = await uploadCompressedMedia("merchant-assets", user.id, "outlet", photo, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
        });
      }

      const changes = {
        name: name.trim(),
        address: address.trim(),
        phone_wa: phone.trim() || null,
        opening_hours: operatingMode === "automatic"
          ? Object.entries(operatingSchedule).filter(([, day]) => day.open).map(([day, value]) => `${({ "1": "Sen", "2": "Sel", "3": "Rab", "4": "Kam", "5": "Jum", "6": "Sab", "0": "Min" } as Record<string, string>)[day]} ${value.start}-${value.end}`).join(", ") || "Tidak ada jadwal buka"
          : openingHours.trim() || null,
        ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const { error } = await (supabase as any)
        .from("merchants")
        .update({ ...changes, operating_mode: operatingMode, operating_schedule: operatingSchedule })
        .eq("id", merchant.id)
        .eq("user_id", user.id);
      if (error) throw error;

      setPhoto(null);
      setIsEditingProfile(false);
      await queryClient.invalidateQueries({ queryKey: ["my-merchant-profile", user.id] });
      setMessage("Profil resto berhasil disimpan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan profil resto.");
    } finally {
      setSavingProfile(false);
    }
  }

  if (merchantQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-4xl p-6 text-center text-sm text-muted-foreground">Memuat data restoran Anda...</main>
      </div>
    );
  }

  if (merchantQuery.error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-md p-6 text-center">
          <Store className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-3 font-bold text-foreground">Gagal Memuat Profil Resto</h2>
          <p className="mt-1 text-xs text-muted-foreground">{merchantQuery.error.message}</p>
          <Button className="mt-4" onClick={() => void merchantQuery.refetch()}>Coba Lagi</Button>
        </main>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-md p-6 text-center">
          <Store className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-3 font-bold text-foreground">Belum Terdaftar sebagai Mitra</h2>
          <p className="mt-1 text-xs text-muted-foreground">Anda belum memiliki profil resto. Daftarkan resto terlebih dahulu atau tunggu verifikasi pengajuan Anda.</p>
          <Link to="/merchant" className="mt-4 inline-block"><Button>Daftar Mitra Resto</Button></Link>
        </main>
      </div>
    );
  }

  const canOperate = merchant.status === "approved";
  const pendingMitraOrders = (ordersQuery.data ?? []).filter(
    (order) =>
      (order as any).food_order_type === "mitra" &&
      (order as any).merchant_response === "pending" &&
      order.status === "tersedia",
  );
  const activePopupOrder = pendingMitraOrders[0];
  const allMitraOrders = (ordersQuery.data ?? []);
  const activeMitraOrders = allMitraOrders.filter((order) => order.status !== "selesai");
  const completedMitraOrders = allMitraOrders.filter((order) => order.status === "selesai");

  return (
    <div className="min-h-screen bg-background pb-10">
      <AppHeader />
      {canOperate && activePopupOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="incoming-mitra-order-title">
          <section className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/40 bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Pesanan baru masuk</p>
                <h2 id="incoming-mitra-order-title" className="text-lg font-extrabold text-foreground">Perlu keputusan resto</h2>
              </div>
            </div>
            <div className="space-y-2 rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">#{activePopupOrder.code} · {new Date(activePopupOrder.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="font-bold text-foreground">{activePopupOrder.sender_name}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{activePopupOrder.item_detail}</p>
              <p className="text-sm font-extrabold text-primary">{formatRupiah(Math.max(
                Number(activePopupOrder.total ?? 0),
                Number(activePopupOrder.shipping_fare ?? 0) +
                  Number(activePopupOrder.consumer_service_fee ?? 0) +
                  Number((activePopupOrder as any).item_cost ?? 0),
              ))}</p>
            </div>
            <p className="text-xs text-muted-foreground">Popup ini akan tetap tampil di beranda sampai pesanan diterima atau ditolak. Jika ada beberapa pesanan, pesanan berikutnya akan muncul setelah keputusan diberikan pada pesanan ini.</p>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" disabled={respondingOrderId !== null} onClick={() => void respondToMitraOrder(activePopupOrder.id, "accept")} className="min-h-11">
                {respondingOrderId === activePopupOrder.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Terima Pesanan
              </Button>
              <Button type="button" variant="destructive" disabled={respondingOrderId !== null} onClick={() => void respondToMitraOrder(activePopupOrder.id, "reject")} className="min-h-11">
                Tolak Pesanan
              </Button>
            </div>
          </section>
        </div>
      )}
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {merchant.image_url ? (
              <img src={merchant.image_url} alt={merchant.name} className="h-16 w-16 rounded-xl border border-border object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="h-7 w-7" /></div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-foreground">{merchant.name}</h1>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{merchant.type || "Resto Mitra"}</span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {merchant.address}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status pengajuan: <strong>{merchant.status || "belum diketahui"}</strong></p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={!canOperate || changingStatus || (merchant as any).operating_mode === "automatic"} onClick={() => void toggleStatus()} className="gap-2">
            {changingStatus ? <LoaderCircle className="h-5 w-5 animate-spin" /> : merchant.is_open ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}
            <span>{(merchant as any).operating_mode === "automatic" ? (merchant.is_open ? "Otomatis: Buka" : "Otomatis: Tutup") : merchant.is_open ? "Resto Buka" : "Resto Tutup"}</span>
          </Button>
        </section>

        {merchant.status !== "approved" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
            Pengajuan resto Anda masih menunggu verifikasi admin. Pengelolaan operasional aktif setelah resto disetujui.
          </div>
        )}
        {message && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
        {errorMessage && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage}</div>}

                <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold text-foreground">Menu Dashboard</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button type="button" onClick={() => setActiveDashboardSection("orders")} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${activeDashboardSection === "orders" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`}>
              <ShoppingBag className="h-6 w-6" /><span className="text-xs font-semibold">Pesanan Masuk</span>
            </button>
            <button type="button" onClick={() => { setActiveDashboardSection("history"); setShowTransactionHistory(true); }} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${activeDashboardSection === "history" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`}>
              <ChevronUp className="h-6 w-6 rotate-180" /><span className="text-xs font-semibold">Riwayat Transaksi</span>
            </button>
            <button type="button" onClick={() => setActiveDashboardSection("products")} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${activeDashboardSection === "products" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`}>
              <UtensilsCrossed className="h-6 w-6" /><span className="text-xs font-semibold">Produk / Menu</span>
            </button>
            <button type="button" onClick={() => setActiveDashboardSection("earnings")} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${activeDashboardSection === "earnings" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
      <Wallet className="h-5 w-5" /><span className="text-xs font-semibold">Penghasilan</span>
    </button>
    <button type="button" onClick={() => setActiveDashboardSection("profile")} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${activeDashboardSection === "profile" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`}>
              <Store className="h-6 w-6" /><span className="text-xs font-semibold">Profil Resto</span>
            </button>
          </div>
        </section>

{activeDashboardSection === "profile" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Informasi Profil Resto</h2>
              <p className="mt-1 text-xs text-muted-foreground">Data alamat dan jam operasional yang dilihat pelanggan.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingProfile(!isEditingProfile)} className="gap-1.5">
              {isEditingProfile ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
              {isEditingProfile ? "Tutup Form" : "Edit Profil"}
            </Button>
          </div>
          {!isEditingProfile && (
            <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground sm:grid-cols-2">
              <div><span className="font-semibold text-foreground">Alamat Outlet:</span><p className="mt-0.5 text-foreground">{merchant.address || "Belum ditentukan"}</p>
                {merchant.latitude != null && merchant.longitude != null && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600"><MapPin className="h-3 w-3" /> Titik koordinat tersimpan</p>}
              </div>
              <div><span className="font-semibold text-foreground">Kontak & Operasional:</span><p className="mt-0.5 text-foreground">WhatsApp: {merchant.phone_wa || "-"}</p><p className="text-foreground">Jam Buka: {merchant.opening_hours || "Setiap Hari"}</p></div>
            </div>
          )}
          {isEditingProfile && (
          <form onSubmit={saveProfile} className="mt-4 space-y-4 border-t border-border pt-4">
            <label className="block text-sm font-medium text-foreground">Nama resto *
              <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3.5">
              <label className="block text-sm font-bold text-foreground">Titik Lokasi Resto di Google Maps *</label>
              <p className="text-xs text-muted-foreground">Ketuk peta atau geser pin ke lokasi resto Anda. Alamat akan terisi otomatis.</p>
              <MapLocationPicker value={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null} onChange={(point) => { setLatitude(point.lat); setLongitude(point.lng); }} onAddressChange={(detectedAddress) => { if (detectedAddress) setAddress(detectedAddress); }} />
            </div>
            <label className="block text-sm font-medium text-foreground">Alamat Lengkap / Patokan *
              <textarea required rows={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Alamat terisi otomatis dari peta atau sesuaikan patokan..." />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">WhatsApp resto
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08xxxxxxxxxx" />
              </label>
              <div className="space-y-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Pengaturan Jam Operasional</p>
                  <p className="mt-1 text-xs text-muted-foreground">Pilih cara mengatur status buka dan tutup resto.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setOperatingMode("manual")} className={`rounded-lg border p-3 text-left ${operatingMode === "manual" ? "border-primary bg-primary/10" : "border-border"}`}>
                    <span className="block text-sm font-bold text-foreground">Manual</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Buka/tutup sendiri</span>
                  </button>
                  <button type="button" onClick={() => setOperatingMode("automatic")} className={`rounded-lg border p-3 text-left ${operatingMode === "automatic" ? "border-primary bg-primary/10" : "border-border"}`}>
                    <span className="block text-sm font-bold text-foreground">Otomatis</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Ikuti jadwal</span>
                  </button>
                </div>
                {operatingMode === "manual" ? (
                  <p className="text-xs text-muted-foreground">Setelah disimpan, gunakan tombol status resto di bagian atas dashboard untuk membuka atau menutup resto.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Centang hari buka dan pilih jamnya. Jadwal menggunakan waktu lokal perangkat/server.</p>
                    {[
                      ["1", "Senin"], ["2", "Selasa"], ["3", "Rabu"], ["4", "Kamis"], ["5", "Jumat"], ["6", "Sabtu"], ["0", "Minggu"],
                    ].map(([day, label]) => {
                      const schedule = operatingSchedule[day] ?? { open: false, start: "08:00", end: "21:00" };
                      return (
                        <div key={day} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg bg-muted/40 p-2">
                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <input type="checkbox" checked={schedule.open} onChange={(event) => setOperatingSchedule((current) => ({ ...current, [day]: { ...schedule, open: event.target.checked } }))} className="h-4 w-4 accent-primary" />
                            {label}
                          </label>
                          <input aria-label={`Jam buka ${label}`} type="time" value={schedule.start} disabled={!schedule.open} onChange={(event) => setOperatingSchedule((current) => ({ ...current, [day]: { ...schedule, start: event.target.value } }))} className="w-[6.4rem] rounded-lg border border-input bg-background px-2 py-2 text-xs disabled:opacity-40" />
                          <input aria-label={`Jam tutup ${label}`} type="time" value={schedule.end} disabled={!schedule.open} onChange={(event) => setOperatingSchedule((current) => ({ ...current, [day]: { ...schedule, end: event.target.value } }))} className="w-[6.4rem] rounded-lg border border-input bg-background px-2 py-2 text-xs disabled:opacity-40" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <label className="block rounded-xl border border-dashed border-border p-4 text-sm font-medium text-foreground">
              <span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Ganti foto outlet atau logo</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Pilih gambar dari galeri HP (opsional).</span>
              <input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" />
              {photo && <span className="mt-2 block text-xs text-muted-foreground">Dipilih: {photo.name}</span>}
            </label>
            <Button type="submit" disabled={!canOperate || savingProfile} className="w-full gap-2">
              {savingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingProfile ? "Menyimpan..." : "Simpan Profil"}
            </Button>
            {!canOperate && <p className="text-xs text-muted-foreground">Profil bisa diedit setelah pengajuan disetujui admin.</p>}
            <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)} disabled={savingProfile}>Batal</Button>
          </form>
          )}
        </section>

        
        )}

        {activeDashboardSection === "orders" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Pesanan Masuk</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pesanan pelanggan yang ditujukan ke outlet Anda. Status dan nilai transaksi diperbarui mengikuti pesanan.</p>
            </div>
          </div>

          {!canOperate ? (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Pesanan akan tampil setelah outlet disetujui admin.</p>
          ) : ordersQuery.isLoading ? (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Memuat pesanan masuk...</div>
          ) : ordersQuery.error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Gagal memuat pesanan. Periksa izin baca pesanan Mitra Resto di database, lalu coba lagi.
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void ordersQuery.refetch()}>Coba Lagi</Button>
            </div>
          ) : activeMitraOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Tidak ada pesanan aktif saat ini. Riwayat transaksi yang selesai tersedia di bagian bawah.</p>
          ) : (
            <div className="space-y-3">
              {activeMitraOrders.map((order) => {
                const itemCost = Number((order as any).item_cost ?? 0);
                const total = Math.max(
                  Number(order.total ?? 0),
                  Number(order.shipping_fare ?? 0) + Number(order.consumer_service_fee ?? 0) + itemCost,
                );
                return (
                  <article key={order.id} className="space-y-3 rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">#{order.code} · {new Date(order.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                        <h3 className="mt-1 text-sm font-bold text-foreground">{order.sender_name}</h3>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{order.item_detail}</p>
                    {(order as any).food_order_type === "mitra" && (order as any).merchant_response === "pending" && order.status === "tersedia" && (
                      <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <p className="text-sm font-semibold text-foreground">Pesanan menunggu keputusan resto</p>
                        <p className="text-xs text-muted-foreground">Terima pesanan untuk membuat PIN pengambilan dan meneruskannya ke pencarian driver. Jika ditolak, pesanan tidak akan masuk ke driver.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" disabled={respondingOrderId !== null} onClick={() => void respondToMitraOrder(order.id, "accept")}>
                            {respondingOrderId === order.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Terima Pesanan
                          </Button>
                          <Button type="button" variant="destructive" disabled={respondingOrderId !== null} onClick={() => void respondToMitraOrder(order.id, "reject")}>
                            Tolak Pesanan
                          </Button>
                        </div>
                      </div>
                    )}
                    {(order as any).food_order_type === "mitra" && (order as any).merchant_response === "accepted" && (
                      <p className="rounded-lg bg-emerald-500/10 p-2 text-xs font-semibold text-emerald-700">Pesanan diterima — diteruskan ke pencarian driver.</p>
                    )}
                    {(order as any).food_order_type === "mitra" && (order as any).merchant_response === "rejected" && (
                      <p className="rounded-lg bg-destructive/10 p-2 text-xs font-semibold text-destructive">Pesanan ditolak.</p>
                    )}
                    {(() => {
                      const pickupPin = pickupPinsQuery.data?.find((item) => item.order_id === order.id)?.pin;
                      return (order as any).food_order_type === "mitra" && (order as any).merchant_response === "accepted" && pickupPin ? (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                          <p className="text-xs font-semibold text-muted-foreground">PIN pengambilan untuk driver</p>
                          <p className="mt-1 text-2xl font-extrabold tracking-[0.3em] text-emerald-700">{pickupPin}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Berikan PIN ini kepada driver saat pesanan diserahkan.</p>
                        </div>
                      ) : null;
                    })()}
                    <div className="space-y-1 rounded-lg bg-muted p-3 text-xs">
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Subtotal menu</span><span className="font-semibold text-foreground">{formatRupiah(itemCost)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Ongkos kirim</span><span className="font-semibold text-foreground">{formatRupiah(order.shipping_fare)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Biaya layanan</span><span className="font-semibold text-foreground">{formatRupiah(order.consumer_service_fee)}</span></div>
                      <div className="flex justify-between gap-3 border-t border-border pt-2 text-sm"><span className="font-bold text-foreground">Total transaksi</span><span className="font-extrabold text-primary">{formatRupiah(total)}</span></div>
                    </div>
                    <Link to="/pesanan/$id" params={{ id: order.id }} className="inline-flex rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent">Lihat detail pesanan</Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        
        )}

        {activeDashboardSection === "history" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <button
            type="button"
            onClick={() => setShowTransactionHistory((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={showTransactionHistory}
          >
            <div className="flex items-start gap-3">
              <ShoppingBag className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="text-base font-bold text-foreground">Riwayat Transaksi Selesai</h2>
                <p className="mt-1 text-sm text-muted-foreground">{completedMitraOrders.length} transaksi selesai. Bagian ini dipisahkan dari pesanan aktif.</p>
              </div>
            </div>
            <ChevronUp className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${showTransactionHistory ? "" : "rotate-180"}`} />
          </button>
          {showTransactionHistory && (
            completedMitraOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada transaksi yang selesai.</p>
            ) : (
              <div className="space-y-3">
                {completedMitraOrders.map((order) => {
                  const itemCost = Number((order as any).item_cost ?? 0);
                  const total = Math.max(
                    Number(order.total ?? 0),
                    Number(order.shipping_fare ?? 0) + Number(order.consumer_service_fee ?? 0) + itemCost,
                  );
                  return (
                    <article key={order.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">#{order.code} · {new Date(order.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                          <h3 className="mt-1 text-sm font-bold text-foreground">{order.sender_name}</h3>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{order.item_detail}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                        <span className="text-xs text-muted-foreground">Total transaksi</span>
                        <span className="text-sm font-extrabold text-primary">{formatRupiah(total)}</span>
                      </div>
                      <Link to="/pesanan/$id" params={{ id: order.id }} className="inline-flex rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent">Lihat detail transaksi</Link>
                    </article>
                  );
                })}
              </div>
            )
          )}
        </section>

        
        )}

        {activeDashboardSection === "earnings" && (
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-6 w-6 text-primary" />
              <div><h2 className="text-base font-bold text-foreground">Penghasilan Mitra</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ringkasan penjualan, saldo yang tersedia, dan status pencairan.</p>
              </div>
            </div>
            {merchantEarningsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Memuat saldo...</div>
            ) : merchantEarningsQuery.error ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Data penghasilan belum dapat dimuat. Pastikan SQL tabel penghasilan sudah dijalankan di Supabase. Detail: {merchantEarningsQuery.error.message}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => void merchantEarningsQuery.refetch()}>Coba lagi</Button>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                  <p className="text-sm opacity-90">Saldo dapat dicairkan</p>
                  <p className="mt-2 text-3xl font-extrabold">{formatRupiah(availableEarnings)}</p>
                  <p className="mt-2 text-xs opacity-80">Saldo dihitung dari penghasilan bersih dikurangi pencairan menunggu dan yang sudah dibayar.</p>
                  <Button type="button" onClick={() => void requestMerchantWithdrawal()} disabled={!canOperate || availableEarnings <= 0} className="mt-4 gap-2 bg-background text-foreground hover:bg-background/90">
                    <ArrowDownToLine className="h-4 w-4" /> Ajukan Pencairan
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Total penghasilan bersih</p><p className="mt-2 text-lg font-extrabold text-foreground">{formatRupiah(totalNetEarnings)}</p></div>
                  <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Pencairan diproses</p><p className="mt-2 text-lg font-extrabold text-amber-600">{formatRupiah(pendingWithdrawalTotal)}</p></div>
                  <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Sudah dicairkan</p><p className="mt-2 text-lg font-extrabold text-emerald-700">{formatRupiah(paidWithdrawalTotal)}</p></div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold text-foreground">Rincian penghasilan</h3>
                  {merchantEarnings.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada catatan penghasilan yang tervalidasi.</p> : (
                    <div className="space-y-2">{merchantEarnings.map((entry: any) => (
                      <article key={entry.id} className="rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><p className="text-sm font-semibold text-foreground">Pesanan #{String(entry.order_id).slice(0, 8)}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p></div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${entry.status === "available" ? "bg-emerald-500/10 text-emerald-700" : entry.status === "held" ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"}`}>{entry.status === "available" ? "Tersedia" : entry.status === "held" ? "Ditahan" : entry.status === "paid" ? "Sudah dibayar" : entry.status === "void" ? "Dibatalkan" : entry.status}</span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs">
                          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Nilai penjualan menu</span><span className="font-medium text-foreground">{formatRupiah(entry.gross_amount)}</span></div>
                          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Komisi platform</span><span className="font-medium text-foreground">−{formatRupiah(entry.commission_amount)}</span></div>
                          <div className="flex justify-between gap-3 border-t border-border pt-2 text-sm"><span className="font-bold text-foreground">Penghasilan bersih</span><span className="font-extrabold text-primary">{formatRupiah(entry.net_amount)}</span></div>
                        </div>
                      </article>
                    ))}</div>
                  )}
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold text-foreground">Riwayat pencairan</h3>
                  {merchantWithdrawals.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada permintaan pencairan.</p> : (
                    <div className="space-y-2">{merchantWithdrawals.map((withdrawal: any) => (
                      <article key={withdrawal.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                        <div><p className="font-bold text-foreground">{formatRupiah(withdrawal.amount)}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(withdrawal.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>{withdrawal.admin_note && <p className="mt-1 text-xs text-muted-foreground">Catatan: {withdrawal.admin_note}</p>}</div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${withdrawal.status === "paid" ? "bg-emerald-500/10 text-emerald-700" : withdrawal.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>{withdrawal.status === "paid" ? "Dibayar" : withdrawal.status === "rejected" ? "Ditolak" : withdrawal.status === "pending" ? "Menunggu" : withdrawal.status === "approved" || withdrawal.status === "processing" ? "Diproses" : withdrawal.status}</span>
                      </article>
                    ))}</div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeDashboardSection === "products" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <UtensilsCrossed className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Pengelolaan Produk / Menu</h2>
                <p className="mt-1 text-sm text-muted-foreground">Kelola nama menu, harga, foto, dan ketersediaan produk resto Anda.</p>
              </div>
            </div>
            <Button onClick={openNewProductEditor} disabled={!canOperate || savingProduct} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          </div>

          {!canOperate && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Pengelolaan produk aktif setelah resto disetujui admin.</p>}

          {productEditorOpen && (
            <form onSubmit={saveProduct} className="space-y-4 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-foreground">{editingProductId ? "Edit Produk" : "Tambah Produk Baru"}</h3>
                <Button type="button" variant="ghost" size="icon" onClick={resetProductEditor} aria-label="Tutup formulir"><X className="h-4 w-4" /></Button>
              </div>
              <label className="block text-sm font-medium text-foreground">Nama produk *
                <input required maxLength={120} value={productName} onChange={(event) => setProductName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: Nasi goreng spesial" />
              </label>
              <label className="block text-sm font-medium text-foreground">Harga (Rp) *
                <input required type="number" min="0" step="1" inputMode="numeric" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="15000" />
              </label>
              <label className="block text-sm font-medium text-foreground">Deskripsi
                <textarea rows={2} maxLength={1000} value={productDescription} onChange={(event) => setProductDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Deskripsi singkat menu (opsional)" />
              </label>
              <label className="block rounded-xl border border-dashed border-border p-3 text-sm font-medium text-foreground">
                <span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Foto produk</span>
                <input type="file" accept="image/*" onChange={(event) => setProductPhoto(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
                {productPhoto && <span className="mt-1 block text-xs text-muted-foreground">Dipilih: {productPhoto.name}</span>}
                {editingProductId && <span className="mt-1 block text-xs text-muted-foreground">Kosongkan jika tidak ingin mengganti foto.</span>}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={productAvailable} onChange={(event) => setProductAvailable(event.target.checked)} className="h-4 w-4 accent-primary" />
                Produk tersedia untuk dipesan
              </label>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingProduct} className="flex-1 gap-2">
                  {savingProduct ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingProduct ? "Menyimpan..." : "Simpan Produk"}
                </Button>
                <Button type="button" variant="outline" onClick={resetProductEditor} disabled={savingProduct}>Batal</Button>
              </div>
            </form>
          )}

          {productsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Memuat produk...</div>
          ) : productsQuery.error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Gagal memuat produk: {productsQuery.error.message}
              <Button variant="outline" size="sm" className="ml-2" onClick={() => void productsQuery.refetch()}>Coba lagi</Button>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">Belum ada produk</p>
              <p className="mt-1 text-xs text-muted-foreground">Tekan Tambah Produk untuk mulai membuat menu resto.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="flex gap-3 p-3">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UtensilsCrossed className="h-7 w-7" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-bold text-foreground">{product.name}</h3>
                        <span className={product.is_available ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700" : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"}>{product.is_available ? "Tersedia" : "Habis"}</span>
                      </div>
                      <p className="mt-1 font-bold text-primary">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(product.price)}</p>
                      {product.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border p-3">
                    <Button variant="outline" size="sm" disabled={!canOperate} onClick={() => openEditProductEditor(product)} className="flex-1 gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button variant="outline" size="sm" disabled={!canOperate} onClick={() => void toggleProductAvailability(product)} className="flex-1">{product.is_available ? "Tandai Habis" : "Aktifkan"}</Button>
                    <Button variant="destructive" size="sm" disabled={!canOperate} onClick={() => void deleteProduct(product)} aria-label={`Hapus ${product.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        )}

              </main>
    </div>
  );
}
