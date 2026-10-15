import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, AlertCircle, ArrowDownCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";

const BANK_OPTIONS = [
  "BCA", "BRI", "BNI", "Mandiri", "Bank Syariah Indonesia (BSI)",
  "CIMB Niaga", "Permata", "Bank Jago", "SeaBank", "DANA", "GoPay", "OVO"
];

export function DriverEarningsSettings({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const wallet = useQuery({
    queryKey: ["driver-wallet-earnings", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_wallets")
        .select("balance, earnings_balance, bank_name, bank_account_number, bank_account_name, bank_updated_at")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const withdrawals = useQuery({
    queryKey: ["driver-withdrawals", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_withdrawals")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const lastUpdated = wallet.data?.bank_updated_at ? new Date(wallet.data.bank_updated_at) : null;
  const lockExpiresAt = lastUpdated ? new Date(lastUpdated.getTime() + 14 * 24 * 60 * 60 * 1000) : null;
  const isLocked = lockExpiresAt ? lockExpiresAt.getTime() > Date.now() : false;
  const daysLeft = isLocked && lockExpiresAt
    ? Math.ceil((lockExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  async function handleSaveBank(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);

    const { error } = await supabase.rpc("driver_set_bank_account", {
      _bank_name: bankName || wallet.data?.bank_name || "",
      _account_number: accountNumber || wallet.data?.bank_account_number || "",
      _account_name: accountName || wallet.data?.bank_account_name || "",
    });

    setBusy(false);
    if (error) {
      setErr(error.message);
    } else {
      setMsg("Rekening pencairan berhasil disimpan. Kunci 14 hari telah aktif.");
      qc.invalidateQueries({ queryKey: ["driver-wallet-earnings", driverId] });
    }
  }

  async function handleWithdraw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const nominal = Number(withdrawAmount);
    if (!nominal || nominal < 20000) {
      setErr("Minimal penarikan dana adalah Rp 20.000");
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("driver_request_withdrawal", { _amount: Math.round(nominal) });
    setBusy(false);

    if (error) {
      setErr(error.message);
    } else {
      setMsg("Permintaan pencairan dana berhasil diajukan ke admin!");
      setWithdrawAmount("");
      qc.invalidateQueries({ queryKey: ["driver-wallet-earnings", driverId] });
      qc.invalidateQueries({ queryKey: ["driver-withdrawals", driverId] });
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-muted-foreground">Saldo Deposit (Kerja)</div>
          <div className="mt-1 text-2xl font-black text-foreground">
            {formatRupiah(wallet.data?.balance ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Dipakai untuk potongan biaya aplikasi saat mengambil order.
          </p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-xs font-semibold text-primary">Saldo Penghasilan (Bisa Ditarik)</div>
          <div className="mt-1 text-2xl font-black text-primary">
            {formatRupiah(wallet.data?.earnings_balance ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Ongkir bersih yang terkumpul dari order yang sudah diselesaikan.
          </p>
        </div>
      </div>

      {err && <p className="rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">{err}</p>}
      {msg && <p className="rounded-xl bg-green-500/10 p-3 text-xs font-medium text-green-700 dark:text-green-300">{msg}</p>}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ArrowDownCircle className="h-4 w-4 text-primary" />
          Pencairan Saldo Penghasilan
        </h3>
        {wallet.data?.bank_account_number ? (
          <form onSubmit={handleWithdraw} className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Tujuan: <strong className="text-foreground">{wallet.data.bank_name} - {wallet.data.bank_account_number} ({wallet.data.bank_account_name})</strong>
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={20000}
                step={5000}
                required
                placeholder="Nominal, mis. 50000"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy || (wallet.data?.earnings_balance ?? 0) < 20000}
                className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Tarik Saldo
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-xs text-amber-600">
            ⚠️ Daftarkan rekening bank Anda di bawah untuk mengaktifkan fitur pencairan.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Rekening Pencairan</h3>
          {isLocked && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
              <Lock className="h-3 w-3" /> Terkunci {daysLeft} hari lagi
            </span>
          )}
        </div>
        {isLocked && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Demi keamanan, rekening yang sudah diisi hanya dapat diubah 14 hari sekali. Anda dapat mengubahnya kembali setelah tanggal{" "}
              <strong>{lockExpiresAt?.toLocaleDateString("id-ID")}</strong>.
            </span>
          </div>
        )}
        <form onSubmit={handleSaveBank} className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nama Bank / E-Wallet</label>
            <select
              disabled={isLocked || busy}
              value={bankName || wallet.data?.bank_name || ""}
              onChange={(e) => setBankName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-xs disabled:opacity-60"
            >
              <option value="" disabled>Pilih Bank / E-Wallet</option>
              {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nomor Rekening / Akun</label>
            <input
              type="text"
              required
              disabled={isLocked || busy}
              value={accountNumber || wallet.data?.bank_account_number || ""}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Contoh: 1234567890"
              className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-xs disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nama Pemilik Rekening (Sesuai Buku Tabungan/KTP)</label>
            <input
              type="text"
              required
              disabled={isLocked || busy}
              value={accountName || wallet.data?.bank_account_name || ""}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Nama lengkap pemilik rekening"
              className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-xs disabled:opacity-60"
            />
          </div>
          {!isLocked && (
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Menyimpan..." : "Simpan Rekening (Kunci 14 Hari)"}
            </button>
          )}
        </form>
      </div>

      {withdrawals.isLoading && <p className="text-xs text-muted-foreground">Memuat riwayat penarikan...</p>}
      {withdrawals.isError && <p className="text-xs text-destructive">Gagal memuat riwayat penarikan: {withdrawals.error.message}</p>}
      {withdrawals.data && withdrawals.data.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground">Riwayat Penarikan Terakhir</h4>
          {withdrawals.data.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
              <div>
                <p className="font-bold text-foreground">{formatRupiah(w.amount)}</p>
                <p className="text-muted-foreground">{w.bank_name} · {new Date(w.created_at).toLocaleDateString("id-ID")}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                w.status === "approved" ? "bg-green-100 text-green-800" :
                w.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
              }`}>
                {w.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
