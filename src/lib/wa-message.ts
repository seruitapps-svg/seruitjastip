import { ADMIN_WA_NUMBER, PRICING, SERVICES, formatRupiah } from "./config";
import type { PriceBreakdown } from "./pricing";

export interface OrderData {
  serviceId: import("@/lib/config").ServiceId;
  originAddress: string;
  originLat: number;
  originLng: number;
  destAddress: string;
  destLat: number;
  destLng: number;
  itemDetail: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  senderName: string;
  senderWa: string;
  recipientName: string;
  recipientWa: string;
  paymentMethod: "cod" | "transfer";
  notes: string;
}

export function mapsRouteLink(order: OrderData): string {
  const origin = `${order.originLat},${order.originLng}`;
  const destination = `${order.destLat},${order.destLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=two-wheeler`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `±${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `±${hours} jam ${rest} menit`;
}

export function buildWaMessage(
  order: OrderData,
  price: PriceBreakdown,
  durationSeconds: number,
): string {
  const service = SERVICES.find((s) => s.id === order.serviceId);
  const lines: string[] = [
    "*ORDER BARU — SERUIT*",
    "",
    `Layanan: ${service?.name ?? order.serviceId}`,
    "",
    `Dari: ${order.originAddress}`,
    `Ke: ${order.destAddress}`,
    `Rute Maps: ${mapsRouteLink(order)}`,
    "",
    `Jarak: ${price.distanceKm.toFixed(1)} km (${formatDuration(durationSeconds)})`,
    "",
    "*Rincian Biaya (estimasi)*",
    `Tarif dasar: ${formatRupiah(price.baseFare)}`,
    `Jarak ${price.billedKm} km x ${formatRupiah(PRICING.perKm)}: ${formatRupiah(price.distanceFare)}`,
  ];
  if (price.oversize) {
    lines.push(`Biaya tambahan paket besar: ${formatRupiah(price.oversizeFee)}`);
  }
  lines.push(
    `Total estimasi: *${formatRupiah(price.total)}*`,
    "",
    `Barang: ${order.itemDetail}`,
    `Berat: ${order.weightKg} kg | Dimensi: ${order.lengthCm}x${order.widthCm}x${order.heightCm} cm`,
  );
  if (order.serviceId === "belanja") {
    lines.push("Dana talangan driver maks Rp 100.000 (dibayar balik user).");
  }
  if (order.serviceId === "kirim" && order.recipientName) {
    lines.push(
      "",
      `Penerima: ${order.recipientName} (${order.recipientWa || "-"})`,
    );
  }
  lines.push(
    "",
    `Pemesan: ${order.senderName} (${order.senderWa})`,
    `Pembayaran: ${order.paymentMethod === "cod" ? "COD (tunai ke driver)" : "Transfer (QRIS)"}`,
  );
  if (order.notes) {
    lines.push(`Catatan: ${order.notes}`);
  }
  if (price.needsAdminConfirm) {
    lines.push(
      "",
      "⚠️ Paket kemungkinan terlalu besar untuk motor — mohon konfirmasi admin.",
    );
  }
  return lines.join("\n");
}

export function buildWaLink(message: string): string {
  return `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodeURIComponent(message)}`;
}
