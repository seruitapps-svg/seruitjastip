import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, TrendingUp, Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";

type FinancialOverview = {
  liabilities: {
    total_user_balance: number;
    total_driver_deposit: number;
    total_driver_earnings: number;
    total_pending_withdrawals: number;
    total_locked_funds: number;
  };
  revenue: {
    platform_commission: number;
    completed_orders_count: number;
    total_gmv: number;
  };
};

export function AdminFinancialOverview() {
  const [bankBalanceInput, setBankBalanceInput] = useState("");

  const { data: fin, isLoading, isError, error } = useQuery({
    queryKey: ["admin-financial-overview"],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("admin_get_financial_overview");
      if (rpcError) throw rpcError;
      return data as unknown as FinancialOverview;
    },
  });

  if (isLoading) {
    return <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">Memuat data keuangan...</div>;
  }

  if (isError || !fin) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-destructive">Gagal memuat ringkasan keuangan.</p>
        <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Periksa akses superadmin dan fungsi SQL admin_get_financial_overview."}</p>
      </div>
    );
  }

  const bankBalance = Number(bankBalanceInput.replace(/[^0-9]/g, "")) || 0;
  const lockedFunds = Number(fin.liabilities.total_locked_funds) || 0;
  const safeToWithdraw = bankBalance - lockedFunds;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
              <ShieldAlert className="h-4 w-4" /> Dana Titipan Pengguna &amp; Driver
            </span>
            <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Kewajiban / Titipan</span>
          </div>
          <div className="mb-3 text-2xl font-black text-rose-950">{formatRupiah(lockedFunds)}</div>
          <p className="mb-4 text-xs leading-relaxed text-rose-700">
            ⚠️ <strong>Uang ini dilarang dipakai untuk operasional atau pribadi.</strong> Ini adalah hak saldo pengguna dan driver yang sewaktu-waktu bisa ditarik.
          </p>
          <div className="space-y-1.5 border-t border-rose-200/60 pt-3 text-xs text-rose-900">
            <div className="flex justify-between gap-3"><span>Saldo Dompet User:</span><span className="font-semibold">{formatRupiah(fin.liabilities.total_user_balance)}</span></div>
            <div className="flex justify-between gap-3"><span>Deposit Kerja Driver:</span><span className="font-semibold">{formatRupiah(fin.liabilities.total_driver_deposit)}</span></div>
            <div className="flex justify-between gap-3"><span>Penghasilan Driver Belum Ditarik:</span><span className="font-semibold">{formatRupiah(fin.liabilities.total_driver_earnings)}</span></div>
            {fin.liabilities.total_pending_withdrawals > 0 && (
              <div className="flex justify-between gap-3 text-amber-800"><span>Penarikan Driver Pending:</span><span className="font-semibold">{formatRupiah(fin.liabilities.total_pending_withdrawals)}</span></div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <TrendingUp className="h-4 w-4" /> Pendapatan Aplikasi Seruit
            </span>
            <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Hak Aplikasi</span>
          </div>
          <div className="mb-3 text-2xl font-black text-emerald-950">{formatRupiah(fin.revenue.platform_commission)}</div>
          <p className="mb-4 text-xs leading-relaxed text-emerald-700">
            Biaya layanan konsumen + komisi driver dari <strong>{fin.revenue.completed_orders_count} pesanan selesai</strong>.
          </p>
          <div className="space-y-1.5 border-t border-emerald-200/60 pt-3 text-xs text-emerald-900">
            <div className="flex justify-between gap-3"><span>Total Nilai Transaksi (GMV):</span><span className="font-semibold">{formatRupiah(fin.revenue.total_gmv)}</span></div>
            <div className="flex justify-between gap-3"><span>Pesanan Sukses:</span><span className="font-semibold">{fin.revenue.completed_orders_count} order</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <Calculator className="h-4 w-4 text-primary" /> Kalkulator Pengaman Penarikan (Cegah Selip Kas)
        </h4>
        <p className="mb-4 text-xs text-muted-foreground">
          Masukkan saldo fisik yang benar-benar tersedia di rekening bank penampung atau akun Midtrans untuk menghitung batas maksimal uang yang aman dicairkan.
        </p>
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="admin-bank-balance" className="mb-1 block text-xs font-semibold text-foreground">Total Uang Fisik di Rekening Penampung (Rp):</label>
            <input
              id="admin-bank-balance"
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 1.500.000"
              value={bankBalanceInput}
              onChange={(event) => setBankBalanceInput(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {bankBalanceInput.trim() !== "" && (
            <div className={`rounded-xl border p-4 ${safeToWithdraw >= 0 ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50"}`}>
              <div className="mb-1 text-xs text-slate-500">Status Keamanan Kas:</div>
              {safeToWithdraw >= 0 ? (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Aman Dicairkan ke Rekening Pribadi
                  </div>
                  <div className="text-lg font-black text-slate-800">Maksimal: {formatRupiah(safeToWithdraw)}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">(Dana kewajiban sebesar {formatRupiah(lockedFunds)} wajib tetap tersedia di rekening penampung).</div>
                </div>
              ) : (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-rose-600"><AlertTriangle className="h-4 w-4" /> Defisit / Kurang Kas!</div>
                  <div className="text-xs text-rose-700">Rekening penampung kurang {formatRupiah(Math.abs(safeToWithdraw))} dari total kewajiban saldo pengguna dan driver. Jangan lakukan penarikan pribadi.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
