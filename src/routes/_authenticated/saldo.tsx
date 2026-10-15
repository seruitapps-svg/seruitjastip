import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/saldo")({
  head: () => ({ meta: [
    { title: "Saldo & Top-up — Seruit" },
    { name: "description", content: "Kelola saldo dan permintaan top-up Seruit." },
    { property: "og:title", content: "Saldo & Top-up — Seruit" },
    { property: "og:description", content: "Kelola saldo dan permintaan top-up Seruit." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: WalletPage,
});

function WalletPage() {
  const { user, isDriver } = useAuth();
  const qc = useQueryClient();
  const [walletType, setWalletType] = useState<"user" | "driver">(
    isDriver ? "driver" : "user",
  );
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const wallet = useQuery({
    queryKey: ["wallet-page", user?.id, walletType],
    enabled: !!user,
    queryFn: async () => {
      if (walletType === "driver") {
        const [balance, tx] = await Promise.all([
          supabase.from("driver_wallets").select("balance")
            .eq("driver_id", user!.id).maybeSingle(),
          supabase.from("wallet_transactions").select("*")
            .eq("driver_id", user!.id)
            .eq("balance_type", "deposit")
            .order("created_at", { ascending: false }).limit(30),
        ]);
        if (balance.error) throw balance.error;
        if (tx.error) throw tx.error;
        return { balance: balance.data?.balance ?? 0, tx: tx.data ?? [] };
      }

      const [balance, tx] = await Promise.all([
        supabase.from("user_wallets").select("balance")
          .eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_wallet_transactions").select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }).limit(30),
      ]);
      if (balance.error) throw balance.error;
      if (tx.error) throw tx.error;
      return { balance: balance.data?.balance ?? 0, tx: tx.data ?? [] };
    },
  });

  const requests = useQuery({
    queryKey: ["my-topup-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_topup_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function submitTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value < 10000 || value > 10000000) {
      setError("Nominal top-up minimal Rp10.000 dan maksimal Rp10.000.000.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("request_wallet_topup", {
      _wallet_type: walletType,
      _amount: value,
    });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setAmount("");
    setMessage("Permintaan dibuat. Saldo bertambah setelah admin menyetujui pembayaran.");
    await qc.invalidateQueries({ queryKey: ["my-topup-requests", user?.id] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h1 className="text-xl font-extrabold text-foreground">Saldo & Top-up</h1>

        {isDriver && (
          <div className="flex gap-2">
            <button
              type="button"
              className={walletType === "driver" ? "rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "rounded-lg border border-border px-3 py-2 text-sm"}
              onClick={() => setWalletType("driver")}
            >
              Saldo driver
            </button>
            <button
              type="button"
              className={walletType === "user" ? "rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "rounded-lg border border-border px-3 py-2 text-sm"}
              onClick={() => setWalletType("user")}
            >
              Saldo konsumen
            </button>
          </div>
        )}

        {wallet.isLoading && <p className="text-sm text-muted-foreground">Memuat saldo...</p>}
        {wallet.isError && <p className="text-sm text-destructive">Gagal memuat saldo: {wallet.error.message}</p>}
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Saldo {walletType === "driver" ? "driver" : "konsumen"}</p>
          <p className="text-2xl font-extrabold text-foreground">
            {formatRupiah(wallet.data?.balance ?? 0)}
          </p>
        </section>

        <form onSubmit={submitTopup} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold text-foreground">Ajukan top-up</h2>
          <p className="text-sm text-muted-foreground">
            Metode pembayaran otomatis belum aktif. Setelah mengajukan, hubungi admin untuk pembayaran.
            Saldo baru masuk setelah pembayaran disetujui.
          </p>
          <input
            type="number"
            min={10000}
            max={10000000}
            step={1000}
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Nominal, mis. 50000"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-primary">{message}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Mengirim..." : "Ajukan top-up"}
          </button>
        </form>

        <section className="space-y-2">
          <h2 className="font-bold text-foreground">Riwayat saldo</h2>
          {wallet.data?.tx.map((tx) => (
            <div key={tx.id} className="flex justify-between gap-3 border-b border-border py-2 text-sm">
              <span>{tx.note || tx.kind}</span>
              <strong>{tx.amount > 0 ? "+" : "−"}{formatRupiah(Math.abs(tx.amount))}</strong>
            </div>
          ))}
          {!wallet.isLoading && !wallet.data?.tx.length && (
            <p className="text-sm text-muted-foreground">Belum ada mutasi saldo.</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-foreground">Permintaan top-up</h2>
          {requests.isLoading && <p className="text-sm text-muted-foreground">Memuat permintaan...</p>}
          {requests.isError && <p className="text-sm text-destructive">Gagal memuat permintaan: {requests.error.message}</p>}
          {requests.data?.map((request) => (
            <div key={request.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-border p-3 text-sm">
              <span>
                {formatRupiah(request.amount)} · {request.wallet_type === "driver" ? "Driver" : "Konsumen"}
                <span className="ml-2 text-muted-foreground">
                  {new Date(request.created_at).toLocaleDateString("id-ID")}
                </span>
              </span>
              <strong className={request.status === "approved" ? "text-primary" : request.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>
                {request.status === "pending" ? "Menunggu" : request.status === "approved" ? "Disetujui" : "Ditolak"}
              </strong>
            </div>
          ))}
          {!requests.isLoading && !requests.data?.length && (
            <p className="text-sm text-muted-foreground">Belum ada permintaan top-up.</p>
          )}
        </section>
      </main>
    </div>
  );
}
