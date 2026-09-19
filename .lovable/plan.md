# Rencana: Web Order Jastip (Form Order → WhatsApp Admin)

## Konsep
Aplikasi satu halaman utama: user mengisi form order jastip, sistem menghitung jarak & estimasi harga dari dua titik di Google Maps, lalu rincian order dikirim otomatis ke WhatsApp admin (wa.me link) termasuk link rute Maps A→B. Tidak ada login, tidak ada database driver — admin mengelola order langsung dari WhatsApp.

## 3 Layanan (dipilih user di awal form)
1. **Jasa Titip** — driver ambil barang dari titik A, antar ke titik B (user terima sendiri).
2. **Jasa Kirim** — driver ambil dari titik A, antar ke titik B (penerima orang lain; form minta nama & WA penerima).
3. **Belanja** — user tulis daftar belanjaan + perkiraan lokasi toko (titik A) dan alamat user (titik B). Driver bisa talangan dana maks Rp 100.000.

## Alur User
```text
Pilih layanan (Titip / Kirim / Belanja)
        ↓
Isi titik A (jemput/toko) & titik B (tujuan) — autocomplete Google Places + pin di peta
        ↓
Isi detail: deskripsi barang / daftar belanja, nama, no. WA, catatan
(Jasa Kirim: + nama & WA penerima)
        ↓
Sistem hitung jarak & durasi (Routes API) + estimasi harga per km
        ↓
Halaman ringkasan order: rincian + estimasi harga + peta rute A→B
        ↓
Klik "Kirim Order via WhatsApp" → terbuka WA admin dengan pesan terformat otomatis
```

## Pesan WhatsApp ke Admin (terformat otomatis)
- Jenis layanan, nama & no. WA user
- Alamat titik A dan B
- Jarak, durasi, estimasi harga ongkir
- Detail barang/belanjaan + catatan
- Info COD / dana talangan (untuk Belanja)
- **Link Google Maps rute A→B** (URL `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`)

## Halaman / Fitur yang Dibangun
- **Halaman utama** (`/`): hero singkat, pilihan 3 layanan, form order dengan peta
- **Komponen peta & autocomplete**: Google Maps JS API (browser key bawaan Lovable), pin A/B, gambar rute
- **Perhitungan jarak**: Routes API via server function (melindungi quota; validasi input)
- **Aturan harga**: tarif dasar + harga per km (angka awal placeholder — user konfirmasi tarif asli)
- **Generator pesan WA**: membangun teks + link rute, buka `wa.me/<no-admin>?text=...`
- Nomor WA admin disimpan sebagai konfigurasi (placeholder sampai user berikan)

## Yang TIDAK Dibangun (sesuai konsep)
- Login/registrasi, dashboard admin, database pesanan, sistem assignment driver
- Pembayaran online — semua COD / bayar balik talangan ke driver

## Detail Teknis
- TanStack Start + Tailwind, mobile-first (mayoritas user dari HP)
- Connector **Google Maps Platform** (managed, key bawaan Lovable — perlu diaktifkan via connect card)
- Server function untuk Routes API (computeRoutes) agar quota aman; browser key hanya untuk render peta & marker
- Autocomplete Places lewat backend dengan debounce + session token
- Tanpa database dulu (bisa ditambah nanti jika mau arsip order)
- Estimasi harga ditampilkan sebagai "estimasi" — harga final konfirmasi admin via WA

## Yang Saya Butuhkan dari Anda
- Nomor WhatsApp admin tujuan order
- Tarif: biaya dasar (Rp) + per km (Rp) + minimum order (opsional)
