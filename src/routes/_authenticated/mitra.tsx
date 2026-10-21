import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingBag, MapPin, ToggleLeft, ToggleRight, ImagePlus, Save, LoaderCircle, Plus, Pencil, Trash2, X, UtensilsCrossed, ChevronUp } from "lucide-react";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadCompressedMedia } from "@/lib/image-compressor";
import { formatRupiah } from "@/lib/config";
import { STATUS_LABEL } from "@/lib/order-status";

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
  const [activeDashboardSection, setActiveDashboardSection] = useState<"profile" | "orders" | "history" | "products">("orders");


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
      setMessage(decision === "accept"
        ? "Pesanan diterima. PIN pengambilan telah dibuat dan pesanan diteruskan ke pencarian driver."
        : "Pesanan ditolak dan tidak diteruskan ke driver.");
      await queryClient.invalidateQueries({ queryKey: ["mitra-orders", merchant.id] });
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
        opening_hours: openingHours.trim() || null,
        ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const { error } = await supabase
        .from("merchants")
        .update(changes)
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
          <Button variant="outline" size="sm" disabled={!canOperate || changingStatus} onClick={() => void toggleStatus()} className="gap-2">
            {changingStatus ? <LoaderCircle className="h-5 w-5 animate-spin" /> : merchant.is_open ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}
            <span>{merchant.is_open ? "Resto Buka" : "Resto Tutup"}</span>
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
              <label className="block text-sm font-medium text-foreground">Jam operasional
                <input value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08:00 - 21:00" />
              </label>
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
                    {(order as any).food_order_type === "mitra" && (order as any).merchant_response === "accepted" && (order as any).confirmation_pin && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <p className="text-xs font-semibold text-muted-foreground">PIN Pengambilan — dibuat saat resto menerima pesanan</p>
                        <p className="mt-1 text-2xl font-extrabold tracking-[0.3em] text-emerald-700">{(order as any).confirmation_pin}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Cocokkan PIN saat driver mengambil pesanan di outlet.</p>
                      </div>
                    )}
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
