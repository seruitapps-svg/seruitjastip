import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";

const KIND_LABEL: Record<string, string> = {
  topup: "Top-up",
  penyesuaian: "Penyesuaian",
  potongan: "Potongan biaya aplikasi",
  refund: "Pengembalian",
};

export function useWallet(driverId?: string) {
  return useQuery({
    queryKey: ["wallet", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const [w, t, s] = await Promise.all([
        supabase.from("driver_wallets").select("balance").eq("driver_id", driverId!).maybeSingle(),
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("driver_id", driverId!)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("app_settings").select("commission_percent").eq("id", 1).maybeSingle(),
      ]);
      if (t.error) throw t.error;
      return {
        balance: w.data?.balance ?? 0,
        txs: t.data,
        percent: Number(s.data?.commission_percent ?? 0),
      };
    },
  });
}

export function WalletPanel({ driverId, showHistory = true }: { driverId: string; showHistory?: boolean }) {
  const { data } = useWallet(driverId);
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Saldo aktif</div>
          <div className="text-2xl font-extrabold text-foreground">{formatRupiah(data?.balance ?? 0)}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">Biaya aplikasi {data?.percent ?? 0}% per order</div>
      </div>
      {showHistory && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Riwayat mutasi</div>
          {data?.txs.length === 0 && <p className="text-xs text-muted-foreground">Belum ada transaksi.</p>}
          {data?.txs.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 border-t border-border py-1.5 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{KIND_LABEL[t.kind] ?? t.kind}</div>
                <div className="truncate text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("id-ID")} {t.note && `· ${t.note}`}
                </div>
              </div>
              <div className="text-right">
                <div className={t.amount < 0 ? "font-bold text-destructive" : "font-bold text-primary"}>
                  {t.amount > 0 ? "+" : "−"}
                  {formatRupiah(Math.abs(t.amount))}
                </div>
                <div className="text-muted-foreground">{formatRupiah(t.balance_after)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
