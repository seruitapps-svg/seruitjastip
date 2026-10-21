import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { OrderCard, btnPrimary, btnOutline } from "@/components/order/OrderCard";
import { useAuth } from "@/hooks/use-auth";
import { DRIVER_NEXT_LABEL } from "@/lib/order-status";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { DriverEarningsSettings } from "@/components/driver/DriverEarningsSettings";
import { DriverJastipTrips } from "@/components/jastip/DriverJastipTrips";
import { formatRupiah } from "@/lib/config";
import { Zap, Calendar, Wallet, Bike, AlertCircle, ChevronDown, ChevronUp, Power, Coffee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "Dashboard Driver — Mider" },
      { name: "description", content: "Panel kerja driver Mider: order instan, jastip, dan status kerja." },
    ],
  }),
  component: DriverPage,
});

type DriverTab = "onbid" | "jastip" | "wallet";

function getDriverErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function DriverPage() {
  const { user, isDriver, ready } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DriverTab>("onbid");
  const [showDoneOrders, setShowDoneOrders] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [onlineSaving, setOnlineSaving] = useState(false);
  const [ojekSaving, setOjekSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", vehicle_type: "Motor", vehicle_plate: "" });

  // Profil driver (status online & accepts_ojek)
  const driverProfile = useQuery({
    queryKey: ["my-driver-profile", user?.id],
    enabled: isDriver && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("id, user_id, full_name, phone, vehicle_type, vehicle_plate, photo_selfie, accepts_ojek, is_online")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; user_id: string; full_name: string; phone: string; vehicle_type: string; vehicle_plate: string; photo_selfie?: string | null; accepts_ojek: boolean; is_online?: boolean } | null;
    },
  });

  const isOnline = driverProfile.data?.is_online === true;
  const hasDriverProfile = !!driverProfile.data;

  useEffect(() => {
    const profile = driverProfile.data;
    if (!profile) return;
    setProfileForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      vehicle_type: profile.vehicle_type ?? "Motor",
      vehicle_plate: profile.vehicle_plate ?? "",
    });
  }, [driverProfile.data]);

  async function saveDriverProfile() {
    const profile = driverProfile.data;
    if (!profile?.id || !user?.id) {
      setErr("Profil belum tersedia. Lengkapi pendaftaran driver terlebih dahulu melalui tombol Daftar/Lengkapi Profil.");
      return;
    }
    const fullName = profileForm.full_name.trim();
    const phone = profileForm.phone.trim();
    const vehicleType = profileForm.vehicle_type.trim();
    const vehiclePlate = profileForm.vehicle_plate.trim().toUpperCase();
    if (!fullName || !phone || !vehicleType || !vehiclePlate) {
      setErr("Nama, nomor HP, jenis kendaraan, dan plat nomor wajib diisi.");
      return;
    }
    setProfileSaving(true);
    setErr("");
    try {
      const { data: updatedProfile, error } = await supabase.from("driver_profiles").update({
        full_name: fullName,
        phone,
        vehicle_type: vehicleType,
        vehicle_plate: vehiclePlate,
      }).eq("id", profile.id).eq("user_id", user.id).select("id").maybeSingle();
      if (error) throw error;
      if (!updatedProfile) {
        throw new Error("Profil tidak tersimpan. Periksa izin UPDATE/RLS dan pastikan profil terhubung dengan akun login.");
      }
      await qc.invalidateQueries({ queryKey: ["my-driver-profile", user.id] });
      await driverProfile.refetch();
      setShowProfileEditor(false);
    } catch (error) {
      setErr(getDriverErrorMessage(error, "Profil gagal disimpan. Periksa izin akses database."));
    } finally {
      setProfileSaving(false);
    }
  }

  async function toggleOnline(val: boolean) {
    if (onlineSaving) return;
    setOnlineSaving(true);
    setErr("");
    try {
      const { error } = await supabase.rpc("driver_toggle_online", { _enabled: val });
      if (error) throw error;
      // Refresh from the database so the status indicator and order buttons stay in sync.
      await qc.invalidateQueries({ queryKey: ["my-driver-profile", user?.id] });
      const refreshed = await driverProfile.refetch();
      if (refreshed.error) throw refreshed.error;
      if (!refreshed.data || refreshed.data.is_online !== val) {
        throw new Error("Status online belum terkonfirmasi. Periksa profil driver dan izin database.");
      }
    } catch (error) {
      setErr(getDriverErrorMessage(error, "Status kerja gagal diperbarui. Periksa koneksi lalu coba lagi."));
    } finally {
      setOnlineSaving(false);
    }
  }

  async function toggleOjek(val: boolean) {
    if (ojekSaving || !user?.id) return;
    setOjekSaving(true);
    setErr("");
    try {
      // The SECURITY DEFINER RPC updates only the authenticated driver's own profile.
      // Do not fall back to a direct table UPDATE because driver_profiles RLS may deny it.
      const { error } = await supabase.rpc("driver_toggle_ojek", { _enabled: val });
      if (error) throw new Error(`Gagal mengubah status ojek: ${error.message}`);

      await qc.invalidateQueries({ queryKey: ["my-driver-profile", user.id] });
      const refreshed = await driverProfile.refetch();
      if (refreshed.error) throw refreshed.error;
      if (!refreshed.data || refreshed.data.accepts_ojek !== val) {
        throw new Error("Status ojek belum terkonfirmasi. Periksa relasi profil driver dengan akun login.");
      }
    } catch (error) {
      setErr(getDriverErrorMessage(error, "Pengaturan layanan ojek gagal diperbarui."));
    } finally {
      setOjekSaving(false);
    }
  }

  // Ringkasan saldo cepat
  const driverWallet = useQuery({
    queryKey: ["driver-wallet-header", user?.id],
    enabled: isDriver && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_wallets")
        .select("balance, earnings_balance")
        .eq("driver_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Pool order siap jalan
  const pool = useQuery({
    queryKey: ["pool"],
    enabled: isDriver,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "tersedia")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Order milik driver
  const mine = useQuery({
    queryKey: ["driver-jobs", user?.id],
    enabled: isDriver && !!user,
    queryFn: async () => {
      if (!user) throw new Error("Silakan masuk kembali.");
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!isDriver) return;
    const ch = supabase
      .channel("driver-dashboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["pool"] });
        qc.invalidateQueries({ queryKey: ["driver-jobs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_wallets" }, () => {
        qc.invalidateQueries({ queryKey: ["driver-wallet-header"] });
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["driver-wallet-earnings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["my-driver-profile"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDriver, qc]);

  async function run(id: string, fn: () => Promise<{ error: { message: string } | null }>, openAfter = false) {
    if (busy) return;
    setBusy(id);
    setErr("");
    try {
      const { error } = await fn();
      if (error) throw error;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pool"] }),
        qc.invalidateQueries({ queryKey: ["driver-jobs"] }),
        qc.invalidateQueries({ queryKey: ["driver-wallet-header"] }),
        qc.invalidateQueries({ queryKey: ["wallet"] }),
        qc.invalidateQueries({ queryKey: ["driver-wallet-earnings"] }),
      ]);
      if (openAfter) navigate({ to: "/pesanan/$id", params: { id } });
    } catch (error) {
      setErr(getDriverErrorMessage(error, "Aksi gagal diproses. Periksa koneksi lalu coba lagi."));
    } finally {
      setBusy(null);
    }
  }

  if (ready && !isDriver) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h2 className="mt-4 text-base font-bold text-foreground">Halaman Khusus Driver</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Akun Anda belum terdaftar sebagai driver aktif.
          </p>
        </div>
      </div>
    );
  }

  const active = mine.data?.filter((o) => ["diambil", "dijemput", "diantar"].includes(o.status)) ?? [];
  const done = mine.data?.filter((o) => o.status === "selesai") ?? [];
  const availableOrders = pool.data?.filter((o) => driverProfile.data?.accepts_ojek !== false || o.service !== "ojek") ?? [];

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppHeader />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        {err && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* Profil Driver */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {driverProfile.data?.photo_selfie ? (
              <img src={driverProfile.data.photo_selfie} alt="Foto profil driver" className="h-14 w-14 rounded-full border border-border object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                {driverProfile.data?.full_name?.charAt(0)?.toUpperCase() || "D"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-foreground">{driverProfile.data?.full_name || "Profil driver belum lengkap"}</h2>
              <p className="text-xs text-muted-foreground">{driverProfile.data?.vehicle_type || "Jenis kendaraan belum diisi"} · {driverProfile.data?.vehicle_plate || "Plat nomor belum diisi"}</p>
              <p className="text-xs text-muted-foreground">{driverProfile.data?.phone || "Nomor HP belum diisi"}</p>
            </div>
            <button type="button" disabled={!driverProfile.data || driverProfile.isLoading} onClick={() => setShowProfileEditor((open) => !open)} className={btnOutline}>
              {showProfileEditor ? "Tutup" : "Edit Profil"}
            </button>
          </div>
          {!driverProfile.data && !driverProfile.isLoading && (
            <div className="mt-3 rounded-xl bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold">Profil driver belum ditemukan</p>
              <p className="mt-1">Anda bisa mengisi data diri dan dokumen sendiri melalui formulir pendaftaran driver.</p>
              <a href="/daftar-driver" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">
                Daftar / Lengkapi Profil
              </a>
            </div>
          )}
          {showProfileEditor && driverProfile.data && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <label className="block text-xs font-semibold text-foreground">Nama lengkap
                <input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-foreground">Nomor HP / WhatsApp
                <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} maxLength={20} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-foreground">Jenis kendaraan
                <select value={profileForm.vehicle_type} onChange={(e) => setProfileForm({ ...profileForm, vehicle_type: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <option value="Motor">Motor</option><option value="Mobil">Mobil</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-foreground">Plat nomor
                <input value={profileForm.vehicle_plate} onChange={(e) => setProfileForm({ ...profileForm, vehicle_plate: e.target.value.toUpperCase() })} maxLength={15} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <p className="text-xs text-muted-foreground">NIK dan dokumen verifikasi tidak ditampilkan atau diubah dari formulir ini.</p>
              <button type="button" disabled={profileSaving} onClick={() => void saveDriverProfile()} className={btnPrimary}>
                {profileSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          )}
        </section>

        {/* 1. Bar Status Kerja & Saldo Cepat */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            {/* Toggle Siap Kerja / Istirahat */}
            <button
              onClick={() => void toggleOnline(!isOnline)}
              disabled={driverProfile.isLoading || !hasDriverProfile || onlineSaving}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                isOnline
                  ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
              }`}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span>{onlineSaving ? "Memperbarui status..." : "Siap Kerja (Online)"}</span>
                </>
              ) : (
                <>
                  <Coffee className="h-3.5 w-3.5" />
                  <span>{onlineSaving ? "Memperbarui status..." : "Istirahat (Offline)"}</span>
                </>
              )}
            </button>

            {/* Toggle Ojek Penumpang */}
            <button
              onClick={() => void toggleOjek(!driverProfile.data?.accepts_ojek)}
              disabled={driverProfile.isLoading || !hasDriverProfile || ojekSaving}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                driverProfile.data?.accepts_ojek
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              <span>{ojekSaving ? "Menyimpan..." : `Ojek: ${driverProfile.data?.accepts_ojek ? "Aktif" : "Mati"}`}</span>
            </button>
          </div>

          {/* Banner Peringatan jika Driver sedang Istirahat */}
          {!isOnline && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <Coffee className="h-4 w-4 shrink-0" />
              <span>Anda sedang istirahat. Klik tombol status di atas untuk mulai menerima order.</span>
            </div>
          )}

          {/* Saldo Cepat */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-left">
            <div
              onClick={() => setActiveTab("wallet")}
              className="cursor-pointer rounded-xl bg-muted/40 p-2.5 transition-colors hover:bg-muted/70"
            >
              <div className="text-[11px] font-medium text-muted-foreground">Saldo Deposit</div>
              <div className="text-base font-extrabold text-foreground">
                {formatRupiah(driverWallet.data?.balance ?? 0)}
              </div>
            </div>

            <div
              onClick={() => setActiveTab("wallet")}
              className="cursor-pointer rounded-xl bg-primary/10 p-2.5 transition-colors hover:bg-primary/15"
            >
              <div className="text-[11px] font-medium text-primary">Penghasilan Siap Tarik</div>
              <div className="text-base font-extrabold text-primary">
                {formatRupiah(driverWallet.data?.earnings_balance ?? 0)}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Tugas Berjalan (Aktif) */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
              Tugas Berjalan ({active.length})
            </h2>
            {active.map((o) => (
              <div key={o.id} className="rounded-2xl border-2 border-primary/40 bg-card p-1 shadow-sm">
                <OrderCard
                  order={o}
                  driverView
                  actions={
                    <>
                      <button
                        className={btnPrimary}
                        disabled={busy === o.id}
                        onClick={() => run(o.id, async () => supabase.rpc("driver_advance_order", { _order_id: o.id, _pin: null }))}
                      >
                        {o.service === "ojek"
                          ? o.status === "diambil"
                            ? "Penumpang sudah dijemput"
                            : o.status === "dijemput"
                              ? "Mulai antar penumpang"
                              : o.status === "diantar"
                                ? "Tandai perjalanan selesai"
                                : DRIVER_NEXT_LABEL[o.status]
                          : DRIVER_NEXT_LABEL[o.status]}
                      </button>
                      <button
                        className={btnOutline}
                        onClick={() => navigate({ to: "/pesanan/$id", params: { id: o.id } })}
                      >
                        Detail & Chat
                      </button>
                    </>
                  }
                />
              </div>
            ))}
          </section>
        )}

        {/* 3. Switcher Tab Menu */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("onbid")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "onbid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Langsung</span>
          </button>

          <button
            onClick={() => setActiveTab("jastip")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "jastip" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>Jastip</span>
          </button>

          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "wallet" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-500" />
            <span>Dompet</span>
          </button>
        </div>

        {/* TAB 1: Order Langsung */}
        {activeTab === "onbid" && (
          <div className="space-y-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Order Siap Diambil ({availableOrders.length})</h3>
                <span className="text-[11px] text-muted-foreground">Siapa cepat dia dapat</span>
              </div>

              {availableOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                  Belum ada order instan yang masuk saat ini.
                </div>
              ) : (
                availableOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    driverView
                    actions={
                      <button
                        className={btnPrimary}
                        disabled={busy === o.id || busy !== null || !isOnline}
                        onClick={() =>
                          run(o.id, async () => supabase.rpc("driver_take_order", { _order_id: o.id }), true)
                        }
                      >
                        {busy === o.id ? "Memproses..." : isOnline ? "Ambil Order Ini" : "Sedang Istirahat"}
                      </button>
                    }
                  />
                ))
              )}
            </section>

            {/* Riwayat Selesai */}
            {done.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-3">
                <button
                  onClick={() => setShowDoneOrders(!showDoneOrders)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground"
                >
                  <span>Riwayat Selesai ({done.length})</span>
                  {showDoneOrders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showDoneOrders && (
                  <div className="mt-3 space-y-3">
                    {done.slice(0, 10).map((o) => (
                      <OrderCard key={o.id} order={o} driverView />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* TAB 2: Jastip Terjadwal */}
        {activeTab === "jastip" && user && (
          <div className="space-y-4">
            <DriverJastipTrips driverId={user.id} />
          </div>
        )}

        {/* TAB 3: Dompet */}
        {activeTab === "wallet" && user && (
          <div className="space-y-5">
            <DriverEarningsSettings driverId={user.id} />
            <WalletPanel driverId={user.id} />
          </div>
        )}
      </main>
    </div>
  );
}
