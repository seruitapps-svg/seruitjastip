import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_verifikasi: "Menunggu verifikasi admin",
  ditolak: "Ditolak admin",
  tersedia: "Mencari driver",
  diambil: "Driver menuju titik A",
  dijemput: "Barang dijemput / dibelanjakan",
  diantar: "Sedang diantar",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  menunggu_verifikasi: "bg-secondary text-secondary-foreground",
  ditolak: "bg-destructive/10 text-destructive",
  tersedia: "bg-accent text-accent-foreground",
  diambil: "bg-primary/15 text-primary",
  dijemput: "bg-primary/15 text-primary",
  diantar: "bg-primary/15 text-primary",
  selesai: "bg-primary text-primary-foreground",
  dibatalkan: "bg-muted text-muted-foreground",
};

// Tombol aksi driver untuk status berikutnya
export const DRIVER_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  diambil: "Barang sudah dijemput",
  dijemput: "Mulai antar",
  diantar: "Tandai selesai",
};

export const SERVICE_NAME: Record<string, string> = {
  titip: "Jasa Titip",
  kirim: "Jasa Kirim",
  belanja: "Belanja",
};
