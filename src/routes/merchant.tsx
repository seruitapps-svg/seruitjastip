import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Store, ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { uploadCompressedMedia } from "@/lib/image-compressor";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Pendaftaran Mitra Resto — Mider" },
      { name: "description", content: "Daftarkan restoran Anda menjadi Mitra Resto Mider." },
    ],
  }),
  component: MerchantRegistrationPage,
});

function MerchantRegistrationPage() {
  const { user, isMitra } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    address: "",
    latitude: "",
    longitude: "",
    category: "",
    openingHours: "08:00 - 21:00",
  });
  const [outletPhoto, setOutletPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const myMerchantQuery = useQuery({
    queryKey: ["my-merchant-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const existing = myMerchantQuery.data;

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/merchant" } });
      return;
    }

    if (!agreementAccepted) {
      setErrMsg("Anda harus membaca dan menyetujui Perjanjian Kerja Sama Mitra Resto sebelum mengirim pendaftaran.");
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (
      !form.latitude.trim() ||
      !form.longitude.trim() ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setErrMsg("Tentukan titik lokasi restoran di Google Maps terlebih dahulu, lalu kirim pendaftaran.");
      return;
    }

    setSaving(true);
    setErrMsg("");
    setSuccess(false);

    try {
      const imageUrl = outletPhoto
        ? await uploadCompressedMedia("merchant-assets", user.id, "outlet", outletPhoto, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.8,
          })
        : null;

      const { error } = await supabase.from("merchants").insert({
        user_id: user.id,
        name: form.name.trim(),
        owner_name: form.ownerName.trim(),
        phone_wa: form.phone.trim(),
        address: form.address.trim(),
        latitude,
        longitude,
        type: "official_merchant",
        image_url: imageUrl,
        opening_hours: form.openingHours.trim(),
        status: "pending",
        is_open: true,
        partnership_agreement_accepted_at: new Date().toISOString(),
        partnership_agreement_version: "2026-10-22-v1",
      });

      if (error) throw error;
      setSuccess(true);
      await myMerchantQuery.refetch();
    } catch (err: unknown) {
      console.error("Gagal mengirim pendaftaran mitra:", err);
      let message = "";
      if (typeof err === "string") {
        message = err;
      } else if (err && typeof err === "object") {
        const detail = err as {
          message?: unknown;
          code?: unknown;
          details?: unknown;
          hint?: unknown;
          error_description?: unknown;
        };
        const parts = [
          typeof detail.message === "string" ? detail.message : "",
          typeof detail.code === "string" ? `Kode: ${detail.code}` : "",
          typeof detail.details === "string" ? detail.details : "",
          typeof detail.hint === "string" ? `Petunjuk: ${detail.hint}` : "",
          typeof detail.error_description === "string" ? detail.error_description : "",
        ].filter(Boolean);
        message = parts.join(" — ");
        if (!message) {
          try {
            message = JSON.stringify(err);
          } catch {
            message = "";
          }
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setErrMsg(message || "Gagal mengirim pendaftaran mitra. Detail kesalahan tidak diberikan oleh aplikasi. Pastikan versi terbaru sudah terbit, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
        </Link>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Kemitraan Resto Mider</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">Daftar Mitra Resto</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Jangkau lebih banyak pelanggan dan terima pesanan makanan langsung melalui Mider.
              </p>
            </div>
          </div>

          {myMerchantQuery.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Memeriksa status pendaftaran...</p>
          ) : existing ? (
            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                {existing.status === "approved" || isMitra ? (
                  <>
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Resto Anda Sudah Aktif</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pendaftaran restoran <strong>{existing.name}</strong> telah disetujui.
                      </p>
                      <Link to="/mitra" className="mt-3 inline-block">
                        <Button size="sm">Buka Dashboard Mitra</Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Pendaftaran Sedang Ditinjau Admin</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Data restoran <strong>{existing.name}</strong> sudah masuk. Mohon tunggu verifikasi oleh Superadmin.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {errMsg && (
                <div role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errMsg}</span>
                </div>
              )}

              {success && (
                <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Pendaftaran berhasil dikirim! Menunggu persetujuan admin.</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  Nama Restoran *
                  <input required value={form.name} onChange={(e) => updateField("name", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: Warung Makan Barokah" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Nama Pemilik *
                  <input required value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Nama pemilik usaha" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Nomor WhatsApp Resto *
                  <input required type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08xxxxxxxxxx" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Kategori Makanan
                  <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: Ayam Geprek, Minuman, Kafe" />
                </label>
              </div>

              <label className="block text-sm font-medium text-foreground">
                Jam Operasional
                <input value={form.openingHours} onChange={(e) => updateField("openingHours", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08:00 - 21:00" />
              </label>

              <label className="block text-sm font-medium text-foreground">
                Alamat Lengkap Resto *
                <textarea required rows={3} value={form.address} onChange={(e) => updateField("address", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Alamat lengkap atau patokan restoran" />
              </label>

              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                <label htmlFor="outlet-photo" className="block text-sm font-bold text-foreground">
                  Foto Outlet atau Logo (Opsional)
                </label>
                <p className="text-xs text-muted-foreground">
                  Pilih foto restoran atau logo. Gambar akan dikompresi sebelum diunggah.
                </p>
                <input
                  id="outlet-photo"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setOutletPhoto(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
                />
                <p className="text-xs text-muted-foreground">
                  {outletPhoto?.name ?? "Belum ada foto dipilih"}
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <h2 className="text-sm font-bold text-foreground">Titik Lokasi Restoran *</h2>
                <MapLocationPicker
                  value={form.latitude && form.longitude ? { lat: Number(form.latitude), lng: Number(form.longitude) } : null}
                  onChange={(point) => setForm((current) => ({ ...current, latitude: String(point.lat), longitude: String(point.lng) }))}
                  onAddressChange={(address) => setForm((current) => ({ ...current, address }))}
                />
              </div>

              <section className="space-y-3 rounded-xl border border-border p-3">
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Perjanjian Kerja Sama Mitra Resto/Merchant Mider</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Baca seluruh ketentuan berikut dan centang persetujuan sebelum mengirim pendaftaran.</p>
                </div>
                <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                  <h3 className="text-sm font-bold">PERJANJIAN KERJA SAMA KEMITRAAN LAYANAN PESAN-ANTAR MAKANAN (MITRA RESTO / MERCHANT)</h3>
                  <p><strong>APLIKASI MIDER — PT FAST NETWORK INDONESIA</strong></p>
                  <p>Perjanjian ini disetujui secara elektronik pada tanggal pendaftaran oleh PT Fast Network Indonesia, berkedudukan di Kota Metro, Provinsi Lampung, Indonesia, pengelola platform aplikasi Mider (selanjutnya disebut “Aplikator”), dan pemilik usaha kuliner perseorangan, CV, atau badan usaha sah lainnya yang mendaftar melalui aplikasi Mider (selanjutnya disebut “Mitra”). Keduanya bersama-sama disebut “Para Pihak”.</p>
                  <h4 className="font-bold">PASAL 1 — DEFINISI DAN TAFSIRAN</h4>
                  <p>1. Aplikasi adalah perangkat lunak Mider yang digunakan Konsumen untuk memesan Produk dan Mitra untuk mengelola menu, harga, serta pesanan.</p>
                  <p>2. Konsumen adalah pengguna akhir yang menggunakan Mider untuk memesan Produk dari Mitra.</p>
                  <p>3. Produk adalah makanan, minuman, dan produk kuliner lain yang ditawarkan Mitra melalui Aplikasi.</p>
                  <p>4. Mitra Driver adalah pengemudi independen terdaftar yang ditugaskan mengambil Produk dari Mitra dan mengantarkannya kepada Konsumen.</p>
                  <p>5. Dashboard Merchant adalah panel yang disediakan Aplikator untuk memantau transaksi, mengatur operasional, dan memperbarui menu.</p>
                  <h4 className="font-bold">PASAL 2 — RUANG LINGKUP KERJA SAMA</h4>
                  <p>1. Aplikator memberi Mitra hak non-eksklusif untuk mencantumkan profil usaha, menu, harga, dan menerima pesanan melalui Mider di Kota Metro dan sekitarnya.</p>
                  <p>2. Hubungan Para Pihak merupakan kerja sama bisnis penyediaan platform teknologi perantara pemasaran, pemesanan digital, dan fasilitas pembayaran, bukan kemitraan modal atau hubungan kepegawaian. Pelaksanaannya tetap tunduk pada hukum yang berlaku.</p>
                  <h4 className="font-bold">PASAL 3 — HAK DAN KEWAJIBAN MITRA RESTO</h4>
                  <p><strong>1. Kewajiban Mitra:</strong> menyediakan Produk yang higienis, aman, berkualitas, layak jual, dan sesuai deskripsi/foto; menjaga kebersihan dapur dan outlet serta mematuhi aturan keamanan pangan; menjaga kerahasiaan akses akun dan tidak memindahtangankannya tanpa persetujuan Aplikator; menetapkan harga secara wajar dan jujur; serta menyiapkan pesanan secara tepat dan tepat waktu sesuai rincian pesanan sebelum diserahkan kepada Mitra Driver.</p>
                  <p><strong>2. Hak Mitra:</strong> menampilkan profil usaha, logo, menu, dan harga; menerima hasil penjualan setelah dikurangi komisi dan biaya layanan sesuai ketentuan; mengakses rekap transaksi harian/bulanan; serta mengajukan pertanyaan, kendala operasional, sengketa transaksi, atau pencairan dana melalui layanan bantuan resmi.</p>
                  <h4 className="font-bold">PASAL 4 — HAK DAN KEWAJIBAN APLIKATOR</h4>
                  <p><strong>1. Kewajiban Aplikator:</strong> menyediakan, memelihara, dan mengamankan sistem Mider; menyediakan fitur menu, notifikasi pesanan, dan pencatatan transaksi; mengalokasikan Mitra Driver untuk pengambilan dan pengantaran; serta menyalurkan hasil bersih penjualan secara berkala ke rekening atau dompet digital resmi yang didaftarkan Mitra.</p>
                  <p><strong>2. Hak Aplikator:</strong> menerima komisi atau biaya layanan dari transaksi yang berhasil; menentukan kebijakan teknis dan program promosi; serta menangguhkan atau menutup akun apabila terdapat pelanggaran kualitas, keamanan pangan, kecurangan, atau kode etik platform.</p>
                  <h4 className="font-bold">PASAL 5 — KEUANGAN, KOMISI, DAN PEMBAYARAN</h4>
                  <p>1. Aplikator dapat mengenakan komisi atas transaksi penjualan Produk sesuai persentase yang disepakati saat pendaftaran atau ketentuan yang diinformasikan secara resmi.</p>
                  <p>2. Pendapatan bersih Mitra dihitung dari nilai penjualan Produk dikurangi komisi dan biaya administrasi/transfer yang berlaku, lalu disalurkan secara berkala ke rekening Mitra.</p>
                  <p>3. Masing-masing Pihak bertanggung jawab atas kewajiban perpajakannya sendiri sesuai peraturan Republik Indonesia.</p>
                  <h4 className="font-bold">PASAL 6 — KUALITAS PRODUK DAN KEAMANAN PANGAN</h4>
                  <p>1. Mitra bertanggung jawab atas rasa, kualitas, kesegaran bahan baku, kemasan, informasi alergen, dan kehalalan Produk yang dijualnya.</p>
                  <p>2. Tanggung jawab atas keracunan, reaksi alergi, atau gangguan kesehatan akibat kelalaian dalam menyiapkan Produk berada pada pihak yang bertanggung jawab menurut hukum; ketentuan ini tidak menghapus tanggung jawab yang diwajibkan peraturan perundang-undangan.</p>
                  <p>3. Untuk keluhan yang sah seperti makanan basi, benda asing, pesanan tidak lengkap, atau pesanan salah, Mitra wajib bekerja sama menyelesaikan masalah melalui penggantian Produk atau pengembalian dana sesuai kebijakan penyelesaian sengketa Aplikator.</p>
                  <h4 className="font-bold">PASAL 7 — PEMBATALAN DAN KETERSEDIAAN STOK</h4>
                  <p>1. Jika Konsumen membatalkan pesanan secara sah setelah pesanan mulai diproses, Aplikator dapat memediasi penyelesaian biaya bahan baku sesuai prosedur operasional yang berlaku dan diinformasikan kepada Mitra.</p>
                  <p>2. Mitra wajib memperbarui ketersediaan stok dan segera menandai menu habis apabila tidak tersedia untuk mencegah pesanan yang tidak dapat dipenuhi.</p>
                  <h4 className="font-bold">PASAL 8 — KERAHASIAAN DATA DAN PRIVASI</h4>
                  <p>1. Para Pihak wajib menjaga kerahasiaan data transaksi, data pribadi Konsumen, dan informasi rahasia bisnis yang diperoleh selama kerja sama.</p>
                  <p>2. Aplikator dapat memproses data sesuai kebutuhan operasional, analisis internal, peningkatan layanan, dan promosi yang sah, dengan tetap mematuhi ketentuan pelindungan data pribadi.</p>
                  <h4 className="font-bold">PASAL 9 — PERUBAHAN SYARAT DAN KETENTUAN</h4>
                  <p>1. Aplikator dapat memperbarui ketentuan, termasuk komisi dan fitur layanan, dengan pemberitahuan melalui aplikasi atau kanal resmi.</p>
                  <p>2. Perubahan yang berdampak material, termasuk perubahan komisi, harus diinformasikan secara jelas sebelum diberlakukan. Persetujuan Mitra atas perubahan mengikuti mekanisme yang diberitahukan dan hukum yang berlaku.</p>
                  <h4 className="font-bold">PASAL 10 — PENGAKHIRAN KERJA SAMA</h4>
                  <p>1. Mitra dapat mengakhiri kerja sama dengan pemberitahuan resmi atau mengajukan penutupan akun melalui Mider.</p>
                  <p>2. Aplikator dapat mengakhiri kerja sama atau menangguhkan akun sesuai tingkat pelanggaran, termasuk kecurangan, pelanggaran hukum, atau keluhan serius yang berulang, dengan memperhatikan prosedur dan hukum yang berlaku.</p>
                  <p>3. Pengakhiran tidak menghapus kewajiban menyelesaikan transaksi, pembayaran, atau hak dan kewajiban yang telah timbul sebelum tanggal pengakhiran.</p>
                  <h4 className="font-bold">PASAL 11 — HUKUM DAN PENYELESAIAN SENGKETA</h4>
                  <p>1. Perjanjian ini tunduk pada hukum Republik Indonesia.</p>
                  <p>2. Perselisihan akan terlebih dahulu diselesaikan melalui musyawarah untuk mufakat.</p>
                  <p>3. Jika musyawarah tidak mencapai kesepakatan, Para Pihak dapat menempuh mekanisme penyelesaian melalui instansi atau pengadilan yang berwenang sesuai hukum yang berlaku, dengan domisili yang disepakati di Kota Metro sepanjang diperbolehkan oleh hukum.</p>
                </div>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                  <span>Saya menyatakan telah membaca, memahami, dan menyetujui Perjanjian Kerja Sama Mitra Resto/Merchant Mider di atas.</span>
                </label>
              </section>

              <Button type="submit" disabled={saving || !agreementAccepted} className="w-full rounded-xl py-2.5">
                {saving ? "Mengirim Pendaftaran..." : "Kirim Pendaftaran Mitra"}
              </Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
