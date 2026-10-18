// Konfigurasi bisnis Mider
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

export type ServiceId = "titip" | "kirim" | "belanja" | "ojek";

export const SERVICES: Array<{
  id: ServiceId;
  name: string;
  tagline: string;
  description: string;
}> = [
  {
    id: "titip",
    name: "Jasa Titip",
    tagline: "Ambil & antar barang",
    description:
      "Driver mengambil barang dari titik asal dan mengantarkannya ke lokasi Anda.",
  },
  {
    id: "kirim",
    name: "Kirim Barang",
    tagline: "Kirim ke orang lain",
    description:
      "Driver mengambil barang dari Anda dan mengirimkannya ke penerima lain.",
  },
  {
    id: "belanja",
    name: "Jastip Belanja",
    tagline: "Kami belanjakan",
    description:
      "Driver membelikan belanjaan sesuai daftar Anda, lalu mengantar ke lokasi Anda. Dana talangan driver maks Rp 100.000.",
  },
  {
    id: "ojek",
    name: "Ojek",
    tagline: "Antar penumpang",
    description: "Driver menjemput Anda di titik A dan mengantar ke tujuan. 1 penumpang.",
  },
];

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
