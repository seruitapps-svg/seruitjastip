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

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "Order Driver — Seruit" },
      { name: "description", content: "Daftar order siap diambil dan order yang sedang dikerjakan driver." },
      { property: "og:title", content: "Order Driver — Seruit" },
      { property: "og:description", content: "Pool order untuk driver Seruit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { user, isDriver, ready } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const pool = useQuery({
    queryKey: ["pool"],
    enabled: isDriver,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("status", "tersedia").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const mine = useQuery({
    queryKey: ["driver-jobs", user?.id],
    enabled: isDriver && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!isDriver) return;
    const ch = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["pool"] });
        qc.invalidateQueries({ queryKey: ["driver-jobs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_wallets" }, () =>
        qc.invalidateQueries({ queryKey: ["wallet"] }),
      )
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
    qc.invalidateQueries({ queryKey: ["wallet"] });
    if (openAfter) navigate({ to: "/pesanan/$id", params: { id } });
  }

  if (ready && !isDriver)
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
          Halaman ini khusus driver. Minta admin menjadikan akun Anda driver.
        </p>
      </div>
    );

  const active = mine.data?.filter((o) => ["diambil", "dijemput", "diantar"].includes(o.status)) ?? [];
  const done = mine.data?.filter((o) => o.status === "selesai") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {user && <DriverEarningsSettings driverId={user.id} />}
        {user && <WalletPanel driverId={user.id} />}
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold text-foreground">Sedang dikerjakan ({active.length})</h2>
          {active.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              actions={
                <>
                  <button
                    className={btnPrimary}
                    disabled={busy === o.id}
                    onClick={() => run(o.id, async () => supabase.rpc("driver_advance_order", { _order_id: o.id }))}
                  >
                    {DRIVER_NEXT_LABEL[o.status]}
                  </button>
                  <button className={btnOutline} onClick={() => navigate({ to: "/pesanan/$id", params: { id: o.id } })}>
                    Detail & chat
                  </button>
                </>
              }
            />
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold text-foreground">Order tersedia ({pool.data?.length ?? 0})</h2>
          {pool.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada order baru.</p>}
          {pool.data?.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              actions={
                <button
                  className={btnPrimary}
                  disabled={busy === o.id}
                  onClick={() => run(o.id, async () => supabase.rpc("driver_take_order", { _order_id: o.id }), true)}
                >
                  Ambil order
                </button>
              }
            />
          ))}
        </section>
        {done.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-foreground">Selesai</h2>
            {done.slice(0, 10).map((o) => <OrderCard key={o.id} order={o} />)}
          </section>
        )}
      </main>
    </div>
  );
}
