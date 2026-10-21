import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, FileText, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type MerchantAgreementRecord = {
  id: string;
  user_id: string | null;
  name: string;
  owner_name: string | null;
  phone_wa: string | null;
  address: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
  partnership_agreement_accepted_at?: string | null;
  partnership_agreement_version?: string | null;
};

const AGREEMENT_VERSION = "2026-10-22-v1";
const ARTICLES = [
  { title: "PASAL 1 — DEFINISI DAN TAFSIRAN", paragraphs: [
    "1. Aplikasi adalah perangkat lunak Mider yang digunakan Konsumen untuk memesan Produk dan Mitra untuk mengelola menu, harga, serta pesanan.",
    "2. Konsumen adalah pengguna akhir yang menggunakan Mider untuk memesan Produk dari Mitra.",
    "3. Produk adalah makanan, minuman, dan produk kuliner lain yang ditawarkan Mitra melalui Aplikasi.",
    "4. Mitra Driver adalah pengemudi independen terdaftar yang ditugaskan mengambil Produk dari Mitra dan mengantarkannya kepada Konsumen.",
    "5. Dashboard Merchant adalah panel yang disediakan Aplikator untuk memantau transaksi, mengatur operasional, dan memperbarui menu."
  ]},
  { title: "PASAL 2 — RUANG LINGKUP KERJA SAMA", paragraphs: [
    "1. Aplikator memberi Mitra hak non-eksklusif untuk mencantumkan profil usaha, menu, harga, dan menerima pesanan melalui Mider di Kota Metro dan sekitarnya.",
    "2. Hubungan Para Pihak merupakan kerja sama bisnis penyediaan platform teknologi perantara pemasaran, pemesanan digital, dan fasilitas pembayaran, bukan kemitraan modal atau hubungan kepegawaian. Pelaksanaannya tetap tunduk pada hukum yang berlaku."
  ]},
  { title: "PASAL 3 — HAK DAN KEWAJIBAN MITRA RESTO", paragraphs: [
    "1. Mitra wajib menyediakan Produk yang higienis, aman, berkualitas, layak jual, dan sesuai deskripsi/foto; menjaga kebersihan dapur dan outlet serta mematuhi aturan keamanan pangan; menjaga kerahasiaan akses akun dan tidak memindahtangankannya tanpa persetujuan Aplikator; menetapkan harga secara wajar dan jujur; serta menyiapkan pesanan secara tepat waktu sesuai rincian digital sebelum diserahkan kepada Mitra Driver.",
    "2. Mitra berhak menampilkan profil usaha, logo, menu, dan harga; menerima hasil penjualan setelah dikurangi komisi dan biaya layanan sesuai ketentuan; mengakses rekap transaksi harian/bulanan; serta mengajukan pertanyaan, kendala operasional, sengketa transaksi, atau pencairan dana melalui layanan bantuan resmi."
  ]},
  { title: "PASAL 4 — HAK DAN KEWAJIBAN APLIKATOR", paragraphs: [
    "1. Aplikator berkewajiban menyediakan, memelihara, dan mengamankan sistem Mider; menyediakan fitur menu, notifikasi pesanan, dan pencatatan transaksi; mengalokasikan Mitra Driver untuk pengambilan dan pengantaran; serta menyalurkan hasil bersih penjualan secara berkala ke rekening atau dompet digital resmi yang didaftarkan Mitra.",
    "2. Aplikator berhak menerima komisi atau biaya layanan dari transaksi yang berhasil; menentukan kebijakan teknis dan program promosi; serta menangguhkan atau menutup akun apabila terdapat pelanggaran kualitas, keamanan pangan, kecurangan, atau kode etik platform dengan memperhatikan hukum yang berlaku."
  ]},
  { title: "PASAL 5 — KEUANGAN, KOMISI, DAN PEMBAYARAN", paragraphs: [
    "1. Aplikator dapat mengenakan komisi atas transaksi penjualan Produk sesuai persentase yang disepakati saat pendaftaran atau ketentuan yang diinformasikan secara resmi.",
    "2. Pendapatan bersih Mitra dihitung dari nilai penjualan Produk dikurangi komisi dan biaya administrasi/transfer yang berlaku, lalu disalurkan secara berkala ke rekening Mitra.",
    "3. Masing-masing Pihak bertanggung jawab atas kewajiban perpajakannya sendiri sesuai peraturan Republik Indonesia."
  ]},
  { title: "PASAL 6 — KUALITAS PRODUK DAN KEAMANAN PANGAN", paragraphs: [
    "1. Mitra bertanggung jawab atas rasa, kualitas, kesegaran bahan baku, kemasan, informasi alergen, dan kehalalan Produk yang dijualnya.",
    "2. Tanggung jawab atas keracunan, reaksi alergi, atau gangguan kesehatan akibat kelalaian dalam menyiapkan Produk berada pada pihak yang bertanggung jawab menurut hukum; ketentuan ini tidak menghapus tanggung jawab yang diwajibkan peraturan perundang-undangan.",
    "3. Untuk keluhan yang sah seperti makanan basi, benda asing, pesanan tidak lengkap, atau pesanan salah, Mitra wajib bekerja sama menyelesaikan masalah melalui penggantian Produk atau pengembalian dana sesuai kebijakan penyelesaian sengketa Aplikator."
  ]},
  { title: "PASAL 7 — PEMBATALAN DAN KETERSEDIAAN STOK", paragraphs: [
    "1. Jika Konsumen membatalkan pesanan secara sah setelah pesanan mulai diproses, Aplikator dapat memediasi penyelesaian biaya bahan baku sesuai prosedur operasional yang berlaku dan diinformasikan kepada Mitra.",
    "2. Mitra wajib memperbarui ketersediaan stok dan segera menandai menu habis apabila tidak tersedia untuk mencegah pesanan yang tidak dapat dipenuhi."
  ]},
  { title: "PASAL 8 — KERAHASIAAN DATA DAN PRIVASI", paragraphs: [
    "1. Para Pihak wajib menjaga kerahasiaan data transaksi, data pribadi Konsumen, dan informasi rahasia bisnis yang diperoleh selama kerja sama.",
    "2. Aplikator dapat memproses data sesuai kebutuhan operasional, analisis internal, peningkatan layanan, dan promosi yang sah, dengan tetap mematuhi ketentuan pelindungan data pribadi."
  ]},
  { title: "PASAL 9 — PERUBAHAN SYARAT DAN KETENTUAN", paragraphs: [
    "1. Aplikator dapat memperbarui ketentuan, termasuk komisi dan fitur layanan, dengan pemberitahuan melalui aplikasi atau kanal resmi.",
    "2. Perubahan yang berdampak material, termasuk perubahan komisi, harus diinformasikan secara jelas sebelum diberlakukan. Persetujuan Mitra atas perubahan mengikuti mekanisme yang diberitahukan dan hukum yang berlaku."
  ]},
  { title: "PASAL 10 — PENGAKHIRAN KERJA SAMA", paragraphs: [
    "1. Mitra dapat mengakhiri kerja sama dengan pemberitahuan resmi atau mengajukan penutupan akun melalui Mider.",
    "2. Aplikator dapat mengakhiri kerja sama atau menangguhkan akun sesuai tingkat pelanggaran, termasuk kecurangan, pelanggaran hukum, atau keluhan serius yang berulang, dengan memperhatikan prosedur dan hukum yang berlaku.",
    "3. Pengakhiran tidak menghapus kewajiban menyelesaikan transaksi, pembayaran, atau hak dan kewajiban yang telah timbul sebelum tanggal pengakhiran."
  ]},
  { title: "PASAL 11 — HUKUM DAN PENYELESAIAN SENGKETA", paragraphs: [
    "1. Perjanjian ini tunduk pada hukum Republik Indonesia.",
    "2. Perselisihan akan terlebih dahulu diselesaikan melalui musyawarah untuk mufakat.",
    "3. Jika musyawarah tidak mencapai kesepakatan, Para Pihak dapat menempuh mekanisme penyelesaian melalui instansi atau pengadilan yang berwenang sesuai hukum yang berlaku, dengan domisili yang disepakati di Kota Metro sepanjang diperbolehkan oleh hukum."
  ]}
];

export function MerchantAgreementsPanel() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"semua" | "disetujui" | "belum">("semua");
  const [selected, setSelected] = useState<MerchantAgreementRecord | null>(null);

  const merchants = useQuery({
    queryKey: ["admin-merchant-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MerchantAgreementRecord[];
    },
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id-ID");
    return (merchants.data ?? []).filter((merchant) => {
      const accepted = Boolean(merchant.partnership_agreement_accepted_at);
      const matchesFilter = filter === "semua" || (filter === "disetujui" ? accepted : !accepted);
      const matchesSearch = !needle || [merchant.name, merchant.owner_name, merchant.phone_wa, merchant.address].some((value) => (value ?? "").toLocaleLowerCase("id-ID").includes(needle));
      return matchesFilter && matchesSearch;
    });
  }, [merchants.data, filter, search]);

  function printAgreement(merchant: MerchantAgreementRecord) {
    if (!merchant.partnership_agreement_accepted_at) return;
    setSelected(merchant);
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <section className="space-y-4">
      <div className="no-print rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground"><FileText className="h-5 w-5 text-primary" /> Perjanjian Kerja Sama Mitra Resto</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cari data mitra, periksa status persetujuan, lalu cetak atau simpan perjanjian sebagai PDF.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama resto, pemilik, WhatsApp, atau alamat" className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"><option value="semua">Semua mitra</option><option value="disetujui">Sudah menyetujui</option><option value="belum">Belum ada persetujuan</option></select>
        </div>
      </div>
      <style>{`
        @media screen { .merchant-agreement-print { display: none; } }
        @media print {
          body * { visibility: hidden !important; }
          .merchant-agreement-print, .merchant-agreement-print * { visibility: visible !important; }
          .merchant-agreement-print { display: block !important; position: absolute; inset: 0; width: 100%; padding: 12mm; color: #111 !important; background: white !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.45; }
          .merchant-agreement-print h1 { font-size: 15pt; text-align: center; margin-bottom: 8px; }
          .merchant-agreement-print h2 { font-size: 11pt; margin: 14px 0 5px; }
          .merchant-agreement-print p { margin: 4px 0; }
          .merchant-agreement-print .metadata { border: 1px solid #999; padding: 10px; margin: 12px 0; }
          .merchant-agreement-print .signature { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; page-break-inside: avoid; }
        }
      `}</style>
      <div className="no-print space-y-3">
        {merchants.isLoading && <p className="text-sm text-muted-foreground">Memuat data perjanjian mitra resto...</p>}
        {merchants.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Gagal memuat data: {merchants.error.message}</p>}
        {!merchants.isLoading && !merchants.isError && filtered.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tidak ada data yang cocok.</p>}
        {filtered.map((merchant) => {
          const accepted = Boolean(merchant.partnership_agreement_accepted_at);
          return <article key={merchant.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-foreground">{merchant.name || "Nama resto belum tersedia"}</h3>
              <p className="text-xs text-muted-foreground">Pemilik: {merchant.owner_name || "—"} · WhatsApp: {merchant.phone_wa || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status resto: {merchant.status || "—"}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">{accepted ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-green-700">Disetujui secara elektronik</span></> : <><Clock3 className="h-4 w-4 text-amber-600" /><span className="text-amber-700">Belum tercatat menyetujui</span></>}</p>
              {accepted && <p className="mt-1 text-xs text-muted-foreground">Waktu: {new Date(merchant.partnership_agreement_accepted_at!).toLocaleString("id-ID")} · Versi: {merchant.partnership_agreement_version || "Tidak tercatat"}</p>}
            </div>
            <button type="button" disabled={!accepted} onClick={() => printAgreement(merchant)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Printer className="h-4 w-4" /> Cetak / PDF</button>
          </article>;
        })}
      </div>
      {selected && <article className="merchant-agreement-print">
        <h1>PERJANJIAN KERJA SAMA KEMITRAAN LAYANAN PESAN-ANTAR MAKANAN (MITRA RESTO / MERCHANT)</h1>
        <p><strong>APLIKASI MIDER — PT FAST NETWORK INDONESIA</strong></p>
        <p>Perjanjian ini disetujui secara elektronik pada tanggal pendaftaran oleh PT Fast Network Indonesia, berkedudukan di Kota Metro, Provinsi Lampung, Indonesia, pengelola platform aplikasi Mider (selanjutnya disebut “Aplikator”), dan pemilik usaha kuliner yang mendaftar melalui aplikasi Mider (selanjutnya disebut “Mitra”). Keduanya bersama-sama disebut “Para Pihak”.</p>
        <div className="metadata">
          <p><strong>Nama Resto:</strong> {selected.name || "—"}</p>
          <p><strong>Nama Pemilik:</strong> {selected.owner_name || "—"}</p>
          <p><strong>WhatsApp:</strong> {selected.phone_wa || "—"}</p>
          <p><strong>Alamat:</strong> {selected.address || "—"}</p>
          <p><strong>ID Mitra:</strong> {selected.id}</p>
          <p><strong>Persetujuan elektronik dicatat:</strong> {selected.partnership_agreement_accepted_at ? new Date(selected.partnership_agreement_accepted_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "long" }) : "Tidak tercatat"}</p>
          <p><strong>Versi perjanjian:</strong> {selected.partnership_agreement_version || AGREEMENT_VERSION}</p>
        </div>
        {ARTICLES.map((article) => <section key={article.title}><h2>{article.title}</h2>{article.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
        <p><strong>Persetujuan elektronik:</strong> dengan mencentang kotak persetujuan dan mengirim formulir pendaftaran, Mitra menyatakan telah membaca, memahami, dan menyetujui Perjanjian Kerja Sama ini.</p>
        <div className="signature"><div><p><strong>PIHAK APLIKATOR</strong></p><p>PT Fast Network Indonesia</p><p style={{ marginTop: 55 }}>________________________</p></div><div><p><strong>PIHAK MITRA</strong></p><p>{selected.owner_name || selected.name || "Mitra Resto"}</p><p>Persetujuan elektronik</p><p>{selected.partnership_agreement_accepted_at ? new Date(selected.partnership_agreement_accepted_at).toLocaleString("id-ID") : "—"}</p></div></div>
        <p style={{ marginTop: 20, fontSize: 8 }}>Dokumen cetak dari catatan aplikasi. Referensi mitra: {selected.id}. Versi: {selected.partnership_agreement_version || AGREEMENT_VERSION}.</p>
      </article>}
    </section>
  );
}
