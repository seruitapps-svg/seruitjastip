# Rencana: Tarif dasar Rp 3.000

Tarif dasar turun dari Rp 5.000 ke **Rp 3.000**. Per km tetap Rp 1.000, biaya tambahan paket besar tetap flat Rp 5.000.

```text
Total = Rp 3.000 + Rp 1.000 x km (dibulatkan ke atas) + Rp 5.000 jika paket > 5 kg / > 100x100 cm
```

Contoh jarak 4,4 km → Rp 3.000 + Rp 5.000 = Rp 8.000.

## Langkah
1. Ganti tarif dasar di konfigurasi tarif (`src/lib/config.ts`) dari 5000 ke 3000 — ini otomatis dipakai perhitungan total, rincian di halaman ringkasan, dan pesan WhatsApp admin.
2. Perbarui teks tarif di beranda yang saat ini ditulis manual ("Tarif: Rp 5.000 + Rp 1.000/km") agar membaca konfigurasi tarif, plus dua angka manual lain (keterangan biaya paket besar, baris jarak di pesan WA) ikut diambil dari konfigurasi — nilainya tidak berubah.
3. Perbarui catatan roadmap dan cek log build.
4. Uji alur order di browser: ringkasan harus menampilkan "Tarif dasar Rp 3.000" dengan total sesuai rumus baru, dan pesan WhatsApp yang terbentuk memakai angka yang sama.
