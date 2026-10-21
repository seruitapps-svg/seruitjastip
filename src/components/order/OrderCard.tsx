import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/config";
import { SERVICE_NAME, STATUS_LABEL, STATUS_TONE, type OrderRow } from "@/lib/order-status";
import { DriverTransactionBreakdown } from "./DriverTransactionBreakdown";

export function StatusBadge({ status }: { status: OrderRow["status"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OrderCard({ order, actions, driverView = false }: { order: OrderRow; actions?: ReactNode; driverView?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link to="/pesanan/$id" params={{ id: order.id }} className="min-w-0">
          <div className="text-xs text-muted-foreground">
            #{order.code} · {(order as any).food_order_type === "mitra" ? "Mitra Resto Resmi" : (order as any).food_order_type === "point" ? "Point Resto" : SERVICE_NAME[order.service]} ·{" "}
            {new Date(order.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">{order.origin_address}</div>
          <div className="truncate text-sm text-muted-foreground">→ {order.dest_address}</div>
        </Link>
        {order.service === "ojek" && order.status === "dijemput" ? (
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Penumpang sudah dijemput
          </span>
        ) : (
          <StatusBadge status={order.status} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {(order.distance_meters / 1000).toFixed(1)} km · {order.payment_method === "cod" ? "COD" : "Transfer"}
        </span>
        <span className="font-bold text-primary">{formatRupiah(order.total)}</span>
      </div>
      {driverView && <DriverTransactionBreakdown order={order} />}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const btnPrimary =
  "rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50";
export const btnOutline =
  "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50";
export const btnDanger =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50";
