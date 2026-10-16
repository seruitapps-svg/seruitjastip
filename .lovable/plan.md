# Rencana: Dua Mode Seruit — On-Bid & Jastip

## Beranda bisa di-switch
Di atas beranda ada tombol pilihan **On-Bid** | **Jastip**. Pilihan terakhir diingat di perangkat.

## 1. Mode On-Bid (seperti ojek online)
- Layanan: Jasa Titip, Jasa Kirim, Belanja, dan baru: **Ojek Penumpang**.
- Estimasi tarif langsung muncul setelah titik A–B dipilih.
- Order **langsung masuk pool driver** tanpa menunggu persetujuan admin (berlaku untuk semua layanan On-Bid).
- Ojek Penumpang: tanpa isian barang/ukuran paket; isian jumlah penumpang (1) dan catatan penjemputan.
- Tarif ojek terpisah, diatur admin: biaya layanan ojek + tarif per km ojek (awal disamakan Rp 3.000 + Rp 1.000/km, bisa diubah).
- Monetisasi dua sisi (biaya layanan konsumen + komisi driver %) tetap berlaku.

## 2. Mode Jastip (jadwal trayek driver)
- Driver membuat jadwal: kota/titik asal → tujuan, tanggal & jam berangkat, jenis slot (**Paket** atau **Kursi penumpang**), jumlah kuota, harga per slot, catatan.
- Harga per slot diisi driver, tapi harus di antara **batas minimal dan maksimal** yang diatur admin (terpisah untuk paket dan kursi).
- User melihat **katalog jadwal yang masih ada slot & belum berangkat**: trayek, waktu, jenis slot, sisa kuota, harga. **Identitas driver tidak ditampilkan** (nama, nomor, plat disembunyikan).
- User memesan 1 atau beberapa slot → langsung terkonfirmasi, kuota berkurang otomatis (aman dari pemesanan ganda).
- Setelah pesan, chat dalam aplikasi tetap tersedia; nomor WA driver tidak dibuka ke user.
- Driver melihat daftar pemesan per jadwal, bisa menandai berangkat/selesai, atau membatalkan jadwal (pemesan otomatis dibatalkan).
- Admin melihat semua jadwal & pemesanan, bisa membatalkan.

## 3. Halaman
- `/` — switch On-Bid / Jastip; Jastip menampilkan katalog jadwal.
- `/jastip/$id` — detail jadwal + pesan slot.
- `/driver` — tab baru "Jadwal Jastip" (buat & kelola jadwal).
- `/pesanan` — pesanan On-Bid dan Jastip tampil bersama.
- `/admin` — pengaturan tarif ojek & batas harga slot Jastip, daftar jadwal.

## Detail teknis
- Tambah nilai `ojek` pada layanan; kolom `passenger_count`; trigger snapshot fee membaca tarif ojek bila layanan ojek; order On-Bid dibuat dengan status `tersedia` (lewat server function, kebijakan insert disesuaikan).
- `app_settings`: `ojek_base_fare`, `ojek_per_km`, `jastip_min_price_package/max`, `jastip_min_price_seat/max`.
- Tabel baru `jastip_trips` (driver_id, asal/tujuan, depart_at, slot_type, quota, price_per_slot, status) dan `jastip_bookings` (trip_id, user_id, slots, total, status). RLS: driver kelola trip miliknya; user baca katalog lewat view/fungsi tanpa kolom driver; booking via RPC row-lock untuk cegah overbooking; validasi harga lewat trigger.
- Chat Jastip memakai tabel pesan dengan referensi booking; profil driver tidak bisa dibaca pemesan Jastip.
- Test kecil: batas harga slot, sisa kuota, tarif ojek.
