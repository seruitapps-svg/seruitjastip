import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { OrderCard, btnPrimary, btnDanger, btnOutline } from "@/components/order/OrderCard";
import { useAuth } from "@/hooks/use-auth";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

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

const FILTERS: Array<OrderStatus | "aktif" | "semua"> = ["menunggu_verifikasi", "aktif", "selesai", "semua"];

function AdminPage() {
  const { isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"order" | "akun" | "tarif">("order");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("menunggu_verifikasi");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

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
    queryKey: ["app-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("commission_percent").eq("id", 1).single();
      if (error) throw error;
      return Number(data.commission_percent);
    },
  });
  const [pct, setPct] = useState("");
  const [openWallet, setOpenWallet] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    enabled: isAdmin && tab === "akun",
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
    qc.invalidateQueries({ queryKey: ["app-settings"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
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
        <div className="flex gap-2">
          <button className={tabCls(tab === "order")} onClick={() => setTab("order")}>Pesanan</button>
          <button className={tabCls(tab === "akun")} onClick={() => setTab("akun")}>Akun & peran</button>
          <button className={tabCls(tab === "tarif")} onClick={() => setTab("tarif")}>Biaya aplikasi</button>
        </div>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        {tab === "order" && (
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
                  ) : undefined
                }
              />
            ))}
          </>
        )}

        {tab === "tarif" && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-foreground">
              Potongan saat ini: <b>{settings.data ?? "…"}%</b> dari total ongkir tiap order, dipotong dari saldo driver saat order diambil
              (dikembalikan bila order dibatalkan).
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="mis. 10"
                className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                className={btnPrimary}
                disabled={busy === "pct" || pct === ""}
                onClick={() => run("pct", () => supabase.rpc("admin_set_commission", { _percent: Number(pct) })).then(() => setPct(""))}
              >
                Simpan %
              </button>
            </div>
          </div>
        )}

        {tab === "akun" && (
          <div className="space-y-2">
            {accounts.data?.map((a) => {
              const isDrv = a.roles.includes("driver");
              const isAdm = a.roles.includes("superadmin");
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{a.full_name || "(tanpa nama)"}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.email} · {a.roles.join(", ")}</div>
                  </div>
                  <button
                    className={isDrv ? btnDanger : btnOutline}
                    disabled={busy === a.id}
                    onClick={() => run(a.id, () => supabase.rpc("admin_set_role", { _user_id: a.id, _role: "driver", _grant: !isDrv }))}
                  >
                    {isDrv ? "Cabut driver" : "Jadikan driver"}
                  </button>
                  <button
                    className={isAdm ? btnDanger : btnOutline}
                    disabled={busy === a.id}
                    onClick={() => run(a.id, () => supabase.rpc("admin_set_role", { _user_id: a.id, _role: "superadmin", _grant: !isAdm }))}
                  >
                    {isAdm ? "Cabut admin" : "Jadikan admin"}
                  </button>
                  {isDrv && (
                    <button className={btnOutline} onClick={() => setOpenWallet(openWallet === a.id ? null : a.id)}>
                      Saldo
                    </button>
                  )}
                  {openWallet === a.id && (
                    <div className="w-full space-y-2">
                      <WalletPanel driverId={a.id} />
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={btnPrimary}
                          disabled={busy === a.id}
                          onClick={() => {
                            const v = Number(window.prompt("Nominal top-up (Rp)") ?? "");
                            if (!v) return;
                            run(a.id, () => supabase.rpc("admin_adjust_wallet", { _driver_id: a.id, _amount: Math.round(v), _note: "Top-up admin" }));
                          }}
                        >
                          Top-up
                        </button>
                        <button
                          className={btnOutline}
                          disabled={busy === a.id}
                          onClick={() => {
                            const v = Number(window.prompt("Penyesuaian (Rp, pakai minus untuk mengurangi, mis. -5000)") ?? "");
                            if (!v) return;
                            const note = window.prompt("Keterangan") ?? "";
                            run(a.id, () => supabase.rpc("admin_adjust_wallet", { _driver_id: a.id, _amount: Math.round(v), _note: note }));
                          }}
                        >
                          Sesuaikan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
