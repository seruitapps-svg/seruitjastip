# Rencana: Tarif dasar jadi Rp 3.000

## Yang Berubah
Tarif dasar turun dari Rp 5.000 ke **Rp 3.000**. Biaya lain tetap: Rp 1.000 per km, dan biaya tambahan paket besar flat Rp 5.000.

Rumus baru:

```text
Total = Rp 3.000 (dasar) + Rp 1.000 x jumlah km (dibulatkan ke atas) + Rp 5.000 jika paket > 5 kg / > 100x100 cm
```

Contoh: jarak 4,4 km (dibayar 5 km) → Rp 3.000 + Rp 5.000 = **Rp 8.000** (sebelumnya Rp 10.000).

## Yang Diperbarui
1. **Angka tarif** — tarif dasar di satu sumber konfigurasi tarif diubah ke 3.000. Dari sini otomatis mengalir ke perhitungan total, rincian biaya di halaman ringkasan, dan pesan WhatsApp ke admin.
2. **Teks tarif di beranda** — badge "Tarif: Rp 5.000 + Rp 1.000/km" saat ini ditulis manual, jadi ikut diperbarui dan diambil dari konfigurasi tarif supaya tidak beda lagi kalau tarif berubah.
3. **Angka manual lain** — dua tempat yang masih menulis angka tarif secara langsung (keterangan biaya tambahan paket besar, dan baris "Jarak x km" di pesan WA) diganti agar membaca konfigurasi tarif. Nilainya tidak berubah, hanya supaya semuanya dari satu sumber.
4. **Catatan roadmap** — baris ringkasan tarif diperbarui ke Rp 3.000.

## Verifikasi
- Setelah perubahan, lihat log build untuk memastikan tidak ada error.
- Uji alur order di browser: isi dua titik + berat paket, cek ringkasan menampilkan "Tarif dasar Rp 3.000" dan total sesuai rumus baru, lalu cek isi pesan WhatsApp yang terbentuk sudah memakai angka yang sama.

## Detail Teknis
- `src/lib/config.ts` — `PRICING.baseFare: 5000` → `3000` (satu-satunya perubahan nilai).
- `src/routes/index.tsx` — badge beranda (baris ~225) dan keterangan biaya tambahan (baris ~342) mengambil nilai dari `PRICING`, bukan angka tertulis; perlu menambah `PRICING` pada baris import konfigurasi.
- `src/lib/wa-message.ts` — baris rincian jarak memakai `PRICING.perKm` alih-alih angka 1000 tertulis.
- `roadmap.md` — teks ringkasan tarif disesuaikan.
- File rencana lama di `.lovable/plan/` dibiarkan sebagai arsip, tidak diubah.
