# Rencana: Seruit dengan Akun, Pool Order Driver & Chat

## Perubahan konsep
Seruit tidak lagi hanya meneruskan order ke WhatsApp. Order disimpan, masuk ke daftar order (pool) untuk driver, statusnya bisa dipantau, dan ada chat per pesanan. Form order, peta, dan rumus tarif tetap sama.

## Peran
- **User** (default saat daftar): buat order, lihat riwayat & status, chat di pesanannya.
- **Driver**: lihat pool order yang belum diambil, ambil order, ubah status, chat.
- **Superadmin**: lihat semua order, atur peran akun (jadikan driver/admin), batalkan/alihkan order, ikut chat.
- Superadmin pertama ditetapkan manual untuk akun Anda setelah Anda daftar.

## Masuk akun
Email & kata sandi + Google. Halaman lupa/reset kata sandi.

## Alur status pesanan
```text
menunggu (pool) → diambil driver → dijemput/dibelanjakan → diantar → selesai
                 ↘ dibatalkan (user sebelum diambil, atau admin kapan saja)
```

## Halaman
- `/` — beranda + form order (sekarang wajib masuk saat kirim order; harga & peta tetap)
- `/auth`, `/reset-password`
- `/pesanan` — riwayat order user; `/pesanan/$id` — detail, status, chat realtime
- `/driver` — pool order + order yang sedang dikerjakan
- `/admin` — semua order + kelola peran akun
- Menu atas menyesuaikan peran dan status masuk

## Detail teknis
- Lovable Cloud: tabel `profiles`, `user_roles` (enum superadmin/driver/user, fungsi `has_role`), `orders` (layanan, titik A/B + koordinat, jarak, rincian biaya, paket, pembayaran, penerima, status, driver_id), `order_status_history`, `order_messages` (realtime).
- RLS: user hanya pesanannya; driver melihat order `menunggu` + yang ia ambil; superadmin semua. Ambil order lewat fungsi atomik (cegah dua driver ambil order sama).
- Chat hanya bisa dibaca/ditulis user pemilik, driver yang ditugaskan, dan superadmin.
- Harga dihitung ulang di server saat order dibuat (tidak percaya angka dari browser).
- Tombol WhatsApp ke admin dihapus dari alur utama; QRIS untuk transfer tetap tampil.
- Memori proyek "tanpa login/database" diperbarui.
