// Konfigurasi bisnis Seruit
export const ADMIN_WA_NUMBER = "6285783797770";

export const PRICING = {
  baseFare: 3000, // tarif dasar
  perKm: 1000, // per kilometer
  oversizeFee: 5000, // biaya tambahan flat jika melebihi batas paket
} as const;

export const PACKAGE_LIMITS = {
  maxWeightKg: 5,
  maxDimCm: 100, // per sisi (P/L/T)
  // di atas ini dianggap berisiko tidak muat motor → wajib konfirmasi admin
  hardMaxWeightKg: 20,
  hardMaxDimCm: 150,
} as const;

export const TALANGAN_MAX = 100000; // dana talangan driver untuk layanan Belanja

export type ServiceId = "titip" | "kirim" | "belanja";

export const SERVICES: Array<{
  id: ServiceId;
  name: string;
  tagline: string;
  description: string;
}> = [
  {
    id: "titip",
    name: "Jasa Titip",
    tagline: "Ambil & antar barang Anda",
    description:
      "Driver mengambil barang dari titik asal dan mengantarkannya ke lokasi Anda.",
  },
  {
    id: "kirim",
    name: "Jasa Kirim",
    tagline: "Kirim barang ke orang lain",
    description:
      "Driver mengambil barang dari Anda dan mengirimkannya ke penerima lain.",
  },
  {
    id: "belanja",
    name: "Belanja",
    tagline: "Kami belanjakan untuk Anda",
    description:
      "Driver membelikan belanjaan sesuai daftar Anda, lalu mengantar ke lokasi Anda. Dana talangan driver maks Rp 100.000.",
  },
];

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
