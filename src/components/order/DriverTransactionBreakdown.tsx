import type { OrderRow } from "@/lib/order-status";
import { formatRupiah } from "@/lib/config";

export function DriverTransactionBreakdown({ order }: { order: OrderRow }) {
  const legacy = order.monetization_version === 0;
  const cash = order.payment_method === "cod";
  const cancelled = ["dibatalkan", "ditolak"].includes(order.status);
  const rows = [
    ["Ongkos Kirim", formatRupiah(order.shipping_fare)],
    ["Biaya Layanan Konsumen", formatRupiah(order.consumer_service_fee)],
    ["Total Ditagih ke Konsumen", formatRupiah(order.total)],
    [legacy ? "Komisi Driver (tarif lama)" : `Komisi Driver (${Number(order.commission_percent)}%)`, `−${formatRupiah(order.driver_commission)}`],
    ["Pendapatan Bersih Driver", formatRupiah(order.driver_net_earnings)],
    [cancelled ? "Mutasi Saldo" : cash ? "Mutasi Saldo · deposit" : "Mutasi Saldo · penghasilan", cancelled ? formatRupiah(0) : cash ? `−${formatRupiah(order.deposit_deduction)}` : `+${formatRupiah(order.driver_net_earnings)}`],
  ];
  return (
    <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-semibold tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
      {!cancelled && <div className="text-muted-foreground">{cash ? "Tunai · deposit saat ambil" : "Non-tunai · penghasilan saat selesai"}</div>}
    </dl>
  );
}