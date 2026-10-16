import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { KeyRound, Trash2, X, ChevronRight, ChevronDown, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { OrderCard, btnPrimary, btnDanger, btnOutline } from "@/components/order/OrderCard";
import { useAuth } from "@/hooks/use-auth";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { formatRupiah } from "@/lib/config";
import { AdminFinancialOverview } from "@/components/admin/AdminFinancialOverview";
import { AdminModeSettings } from "@/components/admin/AdminModeSettings";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Seruit" },
      { name: "description", content: "Verifikasi pesanan dan kelola akun driver Seruit." },
      { property: "og:title", content: "Dashboard Admin — Seruit" },
      { property: "og:description", content: "Verifikasi pesanan Seruit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const FILTERS: Array<OrderStatus | "aktif" | "semua"> = ["menunggu_verifikasi", "aktif", "selesai", "dibatalkan", "semua"];

function AdminPage() {
  const { isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const [category, setCategory] = useState<"operasional" | "pengguna" | "pengaturan" | "keuangan">("operasional");
  const [subTab, setSubTab] = useState<"order" | "driver_approval" | "akun" | "topup" | "tarif" | "pengumuman">("order");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("menunggu_verifikasi");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [financialOpen, setFinancialOpen] = useState(true);

  const orders = useQuery({
    queryKey: ["admin-orders", filter],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter === "aktif") q = q.in("status", ["tersedia", "diambil", "dijemput", "diantar"]);
      else if (filter !== "semua") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const settings = useQuery({
    queryKey: ["app-settings-full"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  const [formTarif, setFormTarif] = useState({
    commission_percent: 10,
    base_fare: 3000,
    per_km: 1000,
    oversize_fee: 5000,
    announcement_text: "",
    announcement_active: false,
    announcement_type: "info",
  });
  useEffect(() => {
    if (!settings.data) return;
    setFormTarif({
      commission_percent: Number(settings.data.commission_percent ?? 10),
      base_fare: Number(settings.data.base_fare ?? 3000),
      per_km: Number(settings.data.per_km ?? 1000),
      oversize_fee: Number(settings.data.oversize_fee ?? 5000),
      announcement_text: settings.data.announcement_text ?? "",
      announcement_active: Boolean(settings.data.announcement_active),
      announcement_type: settings.data.announcement_type ?? "info",
    });
  }, [settings.data]);
  const [openWallet, setOpenWallet] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    enabled: isAdmin && subTab === "akun",
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return p.data.map((x) => ({ ...x, roles: r.data.filter((y) => y.user_id === x.id).map((y) => y.role) }));
    },
  });

  const driverRegistrations = useQuery({
    queryKey: ["admin-driver-registrations"],
    enabled: isAdmin && subTab === "driver_approval",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const topupRequests = useQuery({
    queryKey: ["admin-topup-requests"],
    enabled: isAdmin && subTab === "topup",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_topup_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function handleSaveSettings() {
    setBusy("saving-settings");
    const { error } = await supabase.rpc("admin_update_app_settings", {
      _commission_percent: formTarif.commission_percent,
      _base_fare: formTarif.base_fare,
      _per_km: formTarif.per_km,
      _oversize_fee: formTarif.oversize_fee,
      _announcement_text: formTarif.announcement_text,
      _announcement_active: formTarif.announcement_active,
      _announcement_type: formTarif.announcement_type,
    });
    setBusy(null);
    if (error) {
      window.alert("Gagal menyimpan: " + error.message);
    } else {
      window.alert("Pengaturan berhasil disimpan!");
      await qc.invalidateQueries({ queryKey: ["app-settings-full"] });
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
      await qc.invalidateQueries({ queryKey: ["public-app-settings"] });
      await qc.invalidateQueries({ queryKey: ["public-announcement"] });
    }
  }

  async function handleResetPassword(email: string | null) {
    if (!email) {
      window.alert("User tidak memiliki email.");
      return;
    }
    if (!window.confirm(`Kirimkan link reset password ke ${email}?`)) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) window.alert("Gagal mengirim link: " + error.message);
    else window.alert("Link reset password berhasil dikirim ke " + email);
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!window.confirm(`PERINGATAN: Yakin ingin menghapus permanen akun "${name}"? Semua data terkait akun ini akan dihapus.`)) return;
    setBusy(userId);
    const { error } = await supabase.rpc("admin_delete_user", { _target_user_id: userId });
    setBusy(null);
    if (error) {
      window.alert("Gagal menghapus: " + error.message);
      return;
    }
    window.alert("Akun berhasil dihapus.");
    setSelectedUser(null);
    await qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    await qc.invalidateQueries({ queryKey: ["admin-orders"] });
    await qc.invalidateQueries({ queryKey: ["admin-driver-registrations"] });
  }

  async function handleDeleteOrder(orderId: string, code: string) {
    if (!window.confirm(`Hapus permanen pesanan #${code} dari riwayat?`)) return;
    setBusy(orderId);
    const { error } = await supabase.rpc("admin_delete_order", { _order_id: orderId });
    setBusy(null);
    if (error) {
      window.alert("Gagal menghapus pesanan: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-orders"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin, qc]);

  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key);
    setErr("");
    const { error } = await fn();
    setBusy(null);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    qc.invalidateQueries({ queryKey: ["admin-driver-registrations"] });
    qc.invalidateQueries({ queryKey: ["app-settings"] });
    qc.invalidateQueries({ queryKey: ["app-settings-full"] });
    qc.invalidateQueries({ queryKey: ["public-app-settings"] });
    qc.invalidateQueries({ queryKey: ["public-announcement"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["admin-topup-requests"] });
    qc.invalidateQueries({ queryKey: ["my-topup-requests"] });
    qc.invalidateQueries({ queryKey: ["wallet-page"] });
  }

  if (ready && !isAdmin)
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Halaman ini khusus superadmin.</p>
      </div>
    );

  const tabCls = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-xl font-extrabold text-foreground">Dashboard Admin</h1>
        <nav aria-label="Kategori panel superadmin" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { id: "operasional" as const, icon: "📦", title: "Operasional", detail: "Pesanan masuk dan verifikasi driver" },
            { id: "pengguna" as const, icon: "👥", title: "Pengguna & Driver", detail: "Akun, saldo, dan permintaan top-up" },
            { id: "pengaturan" as const, icon: "⚙️", title: "Pengaturan & Konten", detail: "Tarif, komisi, mode layanan, dan pengumuman" },
            { id: "keuangan" as const, icon: "💰", title: "Ringkasan Keuangan", detail: "Dana titipan, pendapatan, dan keamanan kas" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={category === item.id ? "page" : undefined}
              onClick={() => {
                setCategory(item.id);
                if (item.id === "operasional") setSubTab("order");
                else if (item.id === "pengguna") setSubTab("akun");
                else if (item.id === "pengaturan") setSubTab("tarif");
              }}
              className={`flex min-h-[76px] items-start gap-3 rounded-xl border p-3 text-left transition-colors ${category === item.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/40"}`}
            >
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${category === item.id ? "text-primary" : "text-foreground"}`}>{item.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
              </span>
            </button>
          ))}
        </nav>
        {category === "keuangan" && (
          <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground">
                  <Calculator className="h-5 w-5 text-primary" /> Ringkasan Keuangan
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Pantau dana titipan, pendapatan aplikasi, dan keamanan kas.</p>
              </div>
              <Button variant="ghost" size="sm" aria-expanded={financialOpen} aria-controls="admin-financial-summary" onClick={() => setFinancialOpen((open) => !open)}>
                {financialOpen ? "Ringkas" : "Tampilkan"} {financialOpen ? <ChevronDown /> : <ChevronRight />}
              </Button>
            </div>
            {financialOpen && <div id="admin-financial-summary"><AdminFinancialOverview /></div>}
          </section>
        )}
        <div className="flex flex-wrap gap-2">
          {category === "operasional" && <>
            <button className={tabCls(subTab === "order")} onClick={() => setSubTab("order")}>Pesanan Masuk</button>
            <button className={tabCls(subTab === "driver_approval")} onClick={() => setSubTab("driver_approval")}>Verifikasi Driver</button>
          </>}
          {category === "pengguna" && <>
            <button className={tabCls(subTab === "akun")} onClick={() => setSubTab("akun")}>Daftar Akun & Saldo</button>
            <button className={tabCls(subTab === "topup")} onClick={() => setSubTab("topup")}>Permintaan Top-up</button>
          </>}
          {category === "pengaturan" && <>
            <button className={tabCls(subTab === "tarif")} onClick={() => setSubTab("tarif")}>Tarif & Komisi</button>
            <button className={tabCls(subTab === "pengumuman")} onClick={() => setSubTab("pengumuman")}>Pengumuman Web</button>
          </>}
        </div>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        {category === "operasional" && subTab === "order" && (
          <>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button key={f} className={tabCls(filter === f)} onClick={() => setFilter(f)}>
                  {f === "aktif" ? "Sedang berjalan" : f === "semua" ? "Semua" : STATUS_LABEL[f as OrderStatus]}
                </button>
              ))}
            </div>
            {orders.data?.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pesanan.</p>}
            {orders.data?.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                actions={
                  o.status === "menunggu_verifikasi" ? (
                    <>
                      <button
                        className={btnPrimary}
                        disabled={busy === o.id}
                        onClick={() => run(o.id, () => supabase.rpc("admin_review_order", { _order_id: o.id, _approve: true }))}
                      >
                        Setujui → pool driver
                      </button>
                      <button
                        className={btnDanger}
                        disabled={busy === o.id}
                        onClick={() => {
                          const note = window.prompt("Alasan penolakan (opsional)") ?? "";
                          run(o.id, () => supabase.rpc("admin_review_order", { _order_id: o.id, _approve: false, _note: note }));
                        }}
                      >
                        Tolak
                      </button>
                    </>
                  ) : ["tersedia", "diambil", "dijemput", "diantar"].includes(o.status) ? (
                    <button
                      className={btnDanger}
                      disabled={busy === o.id}
                      onClick={() => {
                        if (!window.confirm("Batalkan pesanan ini?")) return;
                        run(o.id, () => supabase.rpc("cancel_order", { _order_id: o.id }));
                      }}
                    >
                      Batalkan
                    </button>
                  ) : ["selesai", "dibatalkan"].includes(o.status) ? (
                    <button
                      className={btnDanger}
                      disabled={busy === o.id}
                      onClick={() => handleDeleteOrder(o.id, o.code)}
                    >
                      Hapus riwayat
                    </button>
                  ) : undefined
                }
              />
            ))}
          </>
        )}

        {category === "pengaturan" && subTab === "tarif" && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground">Pengaturan Tarif & Biaya Aplikasi</h3>
            {settings.isLoading && <p className="text-sm text-muted-foreground">Memuat pengaturan...</p>}
            {settings.isError && <p className="text-sm text-destructive">Gagal memuat pengaturan: {settings.error.message}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="text-xs font-semibold text-muted-foreground">Biaya Layanan Konsumen / Tarif Dasar (Rp)</label><input type="number" min={0} value={formTarif.base_fare} onChange={(e) => setFormTarif({ ...formTarif, base_fare: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Tarif per Kilometer (Rp/km)</label><input type="number" min={0} value={formTarif.per_km} onChange={(e) => setFormTarif({ ...formTarif, per_km: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Biaya Paket Besar / Tambahan (Rp)</label><input type="number" min={0} value={formTarif.oversize_fee} onChange={(e) => setFormTarif({ ...formTarif, oversize_fee: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Potongan Komisi Driver (%)</label><input type="number" min={0} max={100} step="0.5" value={formTarif.commission_percent} onChange={(e) => setFormTarif({ ...formTarif, commission_percent: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm" /></div>
            </div>
            <button onClick={handleSaveSettings} disabled={busy === "saving-settings" || settings.isLoading} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy === "saving-settings" ? "Menyimpan..." : "Simpan Perubahan Tarif"}</button>
          </div>
        )}
        {category === "pengaturan" && subTab === "tarif" && <AdminModeSettings />}
        {category === "pengaturan" && subTab === "pengumuman" && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground">Pengumuman Front-End (Banner Atas)</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="ann_active" checked={formTarif.announcement_active} onChange={(e) => setFormTarif({ ...formTarif, announcement_active: e.target.checked })} className="h-4 w-4 rounded border-input" />
                <label htmlFor="ann_active" className="text-sm font-semibold text-foreground">Tampilkan pengumuman di halaman utama</label>
              </div>
              <div><label className="text-xs font-semibold text-muted-foreground">Tipe Pengumuman</label><select value={formTarif.announcement_type} onChange={(e) => setFormTarif({ ...formTarif, announcement_type: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm"><option value="info">Info Umum (Warna Biru)</option><option value="promo">Promo / Event (Warna Hijau)</option><option value="warning">Penting / Kendala Operasional (Warna Kuning/Oranye)</option></select></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Teks Pengumuman</label><textarea rows={3} value={formTarif.announcement_text} onChange={(e) => setFormTarif({ ...formTarif, announcement_text: e.target.value })} placeholder="Contoh: Operasional Seruit hari Minggu buka mulai jam 10:00 WIB. Dapatkan potongan ongkir!" className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm" /></div>
            </div>
            <button onClick={handleSaveSettings} disabled={busy === "saving-settings" || settings.isLoading} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy === "saving-settings" ? "Menyimpan..." : "Simpan Pengumuman"}</button>
          </div>
        )}

        {category === "pengguna" && subTab === "topup" && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Permintaan Top-up Menunggu</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Setujui hanya setelah pembayaran benar-benar diterima. Persetujuan akan menambahkan saldo dan mencatat mutasi.
              </p>
            </div>
            {topupRequests.isLoading && <p className="text-sm text-muted-foreground">Memuat permintaan top-up...</p>}
            {topupRequests.isError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Gagal memuat permintaan: {topupRequests.error.message}</p>}
            {!topupRequests.isLoading && !topupRequests.isError && topupRequests.data?.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Tidak ada permintaan top-up yang menunggu.
              </p>
            )}
            <div className="space-y-3">
              {topupRequests.data?.map((request) => (
                <div key={request.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold text-foreground">{formatRupiah(request.amount)} · {request.wallet_type === "driver" ? "Saldo Driver" : "Saldo Konsumen"}</p>
                      <p className="break-all text-xs text-muted-foreground">ID pengguna: {request.user_id}</p>
                      <p className="text-xs text-muted-foreground">Diajukan: {new Date(request.created_at).toLocaleString("id-ID")}</p>
                      <p className="text-xs text-muted-foreground">Metode: {request.provider === "manual" ? "Manual" : request.provider}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">MENUNGGU</span>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={btnPrimary}
                      onClick={() => {
                        if (!window.confirm("Pastikan pembayaran sudah diterima. Setujui dan tambahkan saldo?")) return;
                        run("approve-topup-" + request.id, () => supabase.rpc("admin_review_wallet_topup", {
                          _request_id: request.id,
                          _approve: true,
                          _note: "Pembayaran diterima",
                        }));
                      }}
                    >
                      {busy === "approve-topup-" + request.id ? "Memproses..." : "Setujui Top-up"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={btnDanger}
                      onClick={() => {
                        const note = window.prompt("Alasan penolakan", "Pembayaran belum valid") ?? "";
                        if (!note.trim()) return;
                        run("reject-topup-" + request.id, () => supabase.rpc("admin_review_wallet_topup", {
                          _request_id: request.id,
                          _approve: false,
                          _note: note,
                        }));
                      }}
                    >
                      {busy === "reject-topup-" + request.id ? "Memproses..." : "Tolak"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {category === "operasional" && subTab === "driver_approval" && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Permohonan Menjadi Driver</h2>
            {driverRegistrations.isLoading && (
              <p className="text-sm text-muted-foreground">Memuat data pendaftaran...</p>
            )}
            {driverRegistrations.isError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Gagal memuat pendaftaran driver: {driverRegistrations.error.message}
              </p>
            )}
            {!driverRegistrations.isLoading && !driverRegistrations.isError && driverRegistrations.data?.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Belum ada pendaftaran driver.
              </p>
            )}
            <div className="space-y-3">
              {driverRegistrations.data?.map((item) => (
                <div key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-bold text-foreground">{item.full_name}</h3>
                      <p className="break-words text-xs text-muted-foreground">WhatsApp: {item.phone}</p>
                      <p className="break-words text-xs text-muted-foreground">NIK: {item.nik}</p>
                      <p className="text-xs text-muted-foreground">
                        Kendaraan: {item.vehicle_type} ({item.vehicle_plate})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mendaftar: {new Date(item.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <span
                      className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (
                        item.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : item.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                    {[
                      { label: "KTP", url: item.photo_ktp },
                      { label: "SIM", url: item.photo_sim },
                      { label: "Kendaraan", url: item.photo_vehicle },
                      { label: "Swafoto Driver", url: item.photo_selfie },
                    ].map((doc) => (
                      <div key={doc.label} className="min-w-0 space-y-1">
                        <span className="text-xs text-muted-foreground">{doc.label}</span>
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={doc.url}
                              alt={doc.label}
                              loading="lazy"
                              className="h-24 w-full rounded border border-border object-cover transition hover:opacity-80"
                            />
                          </a>
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded bg-muted px-1 text-center text-xs text-muted-foreground">
                            Foto tidak tersedia
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <button
                        disabled={busy !== null}
                        className={btnPrimary}
                        onClick={() =>
                          run("approve-driver-" + item.id, async () => {
                            const { error } = await supabase
                              .from("driver_profiles")
                              .update({ status: "approved" })
                              .eq("id", item.id);
                            return { error };
                          })
                        }
                      >
                        {busy === "approve-driver-" + item.id ? "Menyetujui..." : "Setujui Driver"}
                      </button>
                      <button
                        disabled={busy !== null}
                        className={btnDanger}
                        onClick={() =>
                          run("reject-driver-" + item.id, async () => {
                            const { error } = await supabase
                              .from("driver_profiles")
                              .update({ status: "rejected" })
                              .eq("id", item.id);
                            return { error };
                          })
                        }
                      >
                        {busy === "reject-driver-" + item.id ? "Menolak..." : "Tolak"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {category === "pengguna" && subTab === "akun" && (
          <div className="space-y-3">
            {accounts.isLoading && <p className="text-sm text-muted-foreground">Memuat akun...</p>}
            {accounts.isError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Gagal memuat akun: {accounts.error.message}</p>}
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {accounts.data?.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {u.full_name?.charAt(0) || u.email?.charAt(0) || "U"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{u.full_name || "Tanpa Nama"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email || u.phone || "Tidak ada kontak"}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{u.roles?.join(", ") || "user"}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </button>
              ))}
            </div>

            {selectedUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
                <div role="dialog" aria-modal="true" aria-labelledby="account-detail-title" className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 id="account-detail-title" className="text-lg font-bold text-foreground">Detail Profil Pengguna</h3>
                    <button type="button" onClick={() => setSelectedUser(null)} className="rounded-lg p-1 hover:bg-muted" aria-label="Tutup detail profil">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-2 break-words text-sm">
                    <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{selectedUser.id}</span></div>
                    <div><span className="text-muted-foreground">Nama:</span> <strong className="text-foreground">{selectedUser.full_name || "-"}</strong></div>
                    <div><span className="text-muted-foreground">Email:</span> <strong className="text-foreground">{selectedUser.email || "-"}</strong></div>
                    <div><span className="text-muted-foreground">Telepon:</span> <span>{selectedUser.phone || "-"}</span></div>
                    <div><span className="text-muted-foreground">Peran:</span> <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{selectedUser.roles?.join(", ") || "user"}</span></div>
                    <div><span className="text-muted-foreground">Terdaftar:</span> <span>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("id-ID") : "-"}</span></div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <button type="button" onClick={() => handleResetPassword(selectedUser.email)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                      <KeyRound className="h-4 w-4" /> Kirim Link Reset Password
                    </button>
                    <button type="button" disabled={busy === selectedUser.id} onClick={() => handleDeleteUser(selectedUser.id, selectedUser.full_name || selectedUser.email || selectedUser.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" /> Hapus Akun Ini
                    </button>
                  </div>
                  {(() => {
                    const isDrv = selectedUser.roles.includes("driver");
                    const isAdm = selectedUser.roles.includes("superadmin");
                    return (
                      <div className="space-y-2 border-t border-border pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kelola Peran</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={isDrv ? btnDanger : btnOutline} disabled={busy === selectedUser.id} onClick={() => run(selectedUser.id, () => supabase.rpc("admin_set_role", { _user_id: selectedUser.id, _role: "driver", _grant: !isDrv }))}>{isDrv ? "Cabut driver" : "Jadikan driver"}</button>
                          <button type="button" className={isAdm ? btnDanger : btnOutline} disabled={busy === selectedUser.id} onClick={() => run(selectedUser.id, () => supabase.rpc("admin_set_role", { _user_id: selectedUser.id, _role: "superadmin", _grant: !isAdm }))}>{isAdm ? "Cabut admin" : "Jadikan admin"}</button>
                          {isDrv && <button type="button" className={btnOutline} onClick={() => setOpenWallet(openWallet === selectedUser.id ? null : selectedUser.id)}>Saldo</button>}
                        </div>
                        {openWallet === selectedUser.id && isDrv && (
                          <div className="space-y-2">
                            <WalletPanel driverId={selectedUser.id} />
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className={btnPrimary} disabled={busy === selectedUser.id} onClick={() => {
                                const v = Number(window.prompt("Nominal top-up (Rp)") ?? "");
                                if (!v) return;
                                run(selectedUser.id, () => supabase.rpc("admin_adjust_wallet", { _driver_id: selectedUser.id, _amount: Math.round(v), _note: "Top-up admin" }));
                              }}>Top-up</button>
                              <button type="button" className={btnOutline} disabled={busy === selectedUser.id} onClick={() => {
                                const v = Number(window.prompt("Penyesuaian (Rp, pakai minus untuk mengurangi, mis. -5000)") ?? "");
                                if (!v) return;
                                const note = window.prompt("Keterangan") ?? "";
                                run(selectedUser.id, () => supabase.rpc("admin_adjust_wallet", { _driver_id: selectedUser.id, _amount: Math.round(v), _note: note }));
                              }}>Sesuaikan</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
