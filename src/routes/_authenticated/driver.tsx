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
import { Zap, Calendar, Wallet, Bike, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "Dashboard Driver — Seruit" },
      { name: "description", content: "Panel kerja driver Seruit: order instan, jastip, dan dompet." },
    ],
  }),
  component: DriverPage,
});

type DriverTab = "onbid" | "jastip" | "wallet";

function DriverPage() {
  const { user, isDriver, ready } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DriverTab>("onbid");
  const [showDoneOrders, setShowDoneOrders] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  // Profil driver & status ojek
  const driverProfile = useQuery({
    queryKey: ["my-driver-profile", user?.id],
    enabled: isDriver && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("accepts_ojek")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Saldo driver ringkas untuk header
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

  async function toggleOjek(val: boolean) {
    const { error } = await supabase.rpc("driver_toggle_ojek", { _enabled: val });
    if (error) {
      setErr(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-driver-profile"] });
  }

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
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDriver, qc]);

  async function run(id: string, fn: () => Promise<{ error: { message: string } | null }>, openAfter = false) {
    setBusy(id);
    setErr("");
    const { error } = await fn();
    setBusy(null);
    if (error) return setErr(error.message);

    qc.invalidateQueries({ queryKey: ["pool"] });
    qc.invalidateQueries({ queryKey: ["driver-jobs"] });
    qc.invalidateQueries({ queryKey: ["driver-wallet-header"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["driver-wallet-earnings"] });
    if (openAfter) navigate({ to: "/pesanan/$id", params: { id } });
  }

  if (ready && !isDriver) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h2 className="mt-4 text-base font-bold text-foreground">Halaman Khusus Driver</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Akun Anda belum terdaftar sebagai driver aktif. Hubungi admin untuk mengaktifkan akun.
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

        {/* 1. Bar Status & Saldo Cepat */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-foreground">Driver Online</span>
            </div>

            <button
              onClick={() => toggleOjek(!driverProfile.data?.accepts_ojek)}
              disabled={driverProfile.isLoading}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                driverProfile.data?.accepts_ojek
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              <span>Ojek: {driverProfile.data?.accepts_ojek ? "Aktif" : "Mati"}</span>
            </button>
          </div>

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

        {/* 2. Tugas Berjalan (Aktif) Prioritas Utama */}
        {active.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
                Tugas Berjalan ({active.length})
              </h2>
            </div>
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
                        onClick={() => run(o.id, async () => supabase.rpc("driver_advance_order", { _order_id: o.id }))}
                      >
                        {DRIVER_NEXT_LABEL[o.status]}
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

        {/* TAB 1: Order Langsung (On-Bid Pool) */}
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
                        disabled={busy === o.id}
                        onClick={() =>
                          run(o.id, async () => supabase.rpc("driver_take_order", { _order_id: o.id }), true)
                        }
                      >
                        Ambil Order Ini
                      </button>
                    }
                  />
                ))
              )}
            </section>

            {/* Riwayat Order Selesai (Bisa dilipat) */}
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

        {/* TAB 2: Jastip Rute Terjadwal */}
        {activeTab === "jastip" && user && (
          <div className="space-y-4">
            <DriverJastipTrips driverId={user.id} />
          </div>
        )}

        {/* TAB 3: Dompet & Rekening */}
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
