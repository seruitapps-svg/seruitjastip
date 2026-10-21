import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Search, FileText, CheckCircle2, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DriverAgreementRecord = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  nik: string | null;
  vehicle_type: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_plate: string | null;
  status: string | null;
  created_at: string;
  partnership_agreement_accepted_at?: string | null;
  partnership_agreement_version?: string | null;
};

const AGREEMENT_VERSION = "2026-10-21-v1";
const ARTICLES = [
  { title: "PASAL 1 — DEFINISI", paragraphs: ["Aplikasi adalah perangkat lunak Mider yang digunakan Mitra dan Konsumen di Kota Metro dan sekitarnya. Konsumen adalah pengguna layanan. Layanan adalah jasa transportasi, pengantaran makanan, barang, dan layanan lain yang tersedia di aplikasi. Sistem mencakup teknologi, algoritma, GPS, dan infrastruktur server Aplikator."] },
  { title: "PASAL 2 — RUANG LINGKUP KEMITRAAN", paragraphs: ["1. Para Pihak bermaksud menjalin hubungan kemitraan, bukan hubungan kerja konvensional atau kepegawaian. Penerapan hubungan ini tetap tunduk pada hukum yang berlaku dan fakta pelaksanaannya.", "2. Aplikator memberikan akses non-eksklusif dan dapat dicabut kepada Mitra untuk menggunakan Mider dan menerima penawaran pesanan.", "3. Mitra dapat menentukan kapan menggunakan aplikasi dan tidak diwajibkan memenuhi target jam kerja, dengan tetap memperhatikan pesanan yang telah diterima dan kewajiban keselamatan."] },
  { title: "PASAL 3 — SYARAT PENDAFTARAN", paragraphs: ["1. Mitra wajib memberikan data yang benar, akurat, dan masih berlaku, termasuk KTP, SIM yang sesuai, STNK, SKCK apabila dipersyaratkan, foto diri, serta dokumen lain yang diminta secara sah.", "2. Kendaraan wajib laik jalan dan memenuhi persyaratan hukum, termasuk rem, lampu, dan perlengkapan keselamatan.", "3. Aplikator dapat menerima atau menolak pendaftaran berdasarkan verifikasi dan ketentuan yang berlaku."] },
  { title: "PASAL 4 — HAK DAN KEWAJIBAN MITRA", paragraphs: ["1. Mitra wajib menjaga akun, kata sandi, dan PIN; tidak memindahtangankan akun; melayani Konsumen dengan sopan dan jujur; mematuhi hukum, lalu lintas, dan standar keselamatan; serta menanggung pemeliharaan kendaraan, bahan bakar, pulsa, internet, dan biaya operasional pribadi.", "2. Mitra dilarang melakukan order fiktif, manipulasi lokasi/jarak, menggunakan fake GPS atau aplikasi modifikasi, serta melakukan kecurangan lain.", "3. Mitra berhak menerima pembayaran atas layanan yang diselesaikan sesuai ketentuan yang diinformasikan, melihat riwayat transaksi dan rincian biaya, serta mengajukan keluhan atau banding melalui kanal bantuan resmi."] },
  { title: "PASAL 5 — HAK DAN KEWAJIBAN APLIKATOR", paragraphs: ["1. Aplikator berupaya menyediakan dan memelihara aplikasi serta menyediakan kanal dukungan operasional.", "2. Aplikator dapat mengatur alokasi pesanan, tarif, biaya layanan, komisi, dan insentif dengan menyampaikan ketentuan yang berlaku melalui aplikasi atau kanal resmi.", "3. Aplikator dapat memberi peringatan, membatasi, menangguhkan, atau mengakhiri kemitraan atas pelanggaran, dengan memperhatikan tingkat pelanggaran, proses penanganan, dan hukum yang berlaku."] },
  { title: "PASAL 6 — TARIF DAN KEUANGAN", paragraphs: ["1. Tarif mengikuti ketentuan yang ditampilkan atau diinformasikan melalui Mider dan peraturan yang berlaku.", "2. Biaya platform atau komisi, jika berlaku, akan diinformasikan kepada Mitra melalui aplikasi.", "3. Masing-masing pihak bertanggung jawab atas kewajiban pajaknya sesuai peraturan perundang-undangan."] },
  { title: "PASAL 7 — KODE ETIK DAN SANKSI", paragraphs: ["1. Mitra wajib mengikuti panduan dan kode etik Mider.", "2. Pelanggaran mencakup pelecehan, kekerasan, pencurian, penggelapan, order fiktif, manipulasi sistem, dan penggunaan akun oleh orang lain.", "3. Sanksi dapat berupa teguran, pembekuan sementara, atau pemutusan kemitraan sesuai tingkat pelanggaran dan hukum yang berlaku."] },
  { title: "PASAL 8 — KERAHASIAAN DAN PRIVASI", paragraphs: ["1. Mitra wajib menjaga kerahasiaan data Konsumen, peta, informasi bisnis, dan informasi nonpublik yang diperoleh melalui layanan.", "2. Aplikator dapat memproses data pribadi Mitra untuk pendaftaran, verifikasi, keamanan, dan operasional layanan sesuai ketentuan pelindungan data pribadi yang berlaku."] },
  { title: "PASAL 9 — PERUBAHAN KETENTUAN", paragraphs: ["Perubahan ketentuan akan diberitahukan melalui aplikasi atau kanal resmi. Perubahan yang memerlukan persetujuan baru akan dimintakan persetujuan sesuai hukum yang berlaku; penggunaan aplikasi semata-mata tidak mengesampingkan ketentuan persetujuan yang diwajibkan hukum."] },
  { title: "PASAL 10 — PENGAKHIRAN", paragraphs: ["1. Mitra dapat mengakhiri kemitraan dengan berhenti menggunakan layanan dan menyampaikan pemberitahuan melalui kanal yang tersedia.", "2. Aplikator dapat mengakhiri kemitraan atas pelanggaran atau penghentian layanan sesuai ketentuan yang berlaku.", "3. Pengakhiran tidak menghapus kewajiban keuangan yang telah timbul dan belum diselesaikan."] },
  { title: "PASAL 11 — HUKUM DAN SENGKETA", paragraphs: ["Perjanjian tunduk pada hukum Republik Indonesia. Perselisihan diupayakan diselesaikan melalui musyawarah terlebih dahulu. Jika tidak tercapai, sengketa diselesaikan melalui instansi atau pengadilan yang berwenang sesuai hukum yang berlaku."] },
];

export function DriverAgreementsPanel() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"semua" | "disetujui" | "belum">("semua");
  const [selected, setSelected] = useState<DriverAgreementRecord | null>(null);

  const drivers = useQuery({
    queryKey: ["admin-driver-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DriverAgreementRecord[];
    },
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id-ID");
    return (drivers.data ?? []).filter((driver) => {
      const accepted = Boolean(driver.partnership_agreement_accepted_at);
      const matchesFilter = filter === "semua" || (filter === "disetujui" ? accepted : !accepted);
      const matchesSearch = !needle || [driver.full_name, driver.phone, driver.nik, driver.vehicle_plate].some((value) => (value ?? "").toLocaleLowerCase("id-ID").includes(needle));
      return matchesFilter && matchesSearch;
    });
  }, [drivers.data, filter, search]);

  function printAgreement(driver: DriverAgreementRecord) {
    if (!driver.partnership_agreement_accepted_at) return;
    setSelected(driver);
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <section className="space-y-4">
      <div className="no-print rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground"><FileText className="h-5 w-5 text-primary" /> Perjanjian Kemitraan Driver</h2>
        <p className="mt-1 text-sm text-muted-foreground">Lihat status persetujuan dan cetak dokumen per driver. Pada dialog cetak, pilih “Simpan sebagai PDF” untuk mengunduh PDF.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, WhatsApp, NIK, atau plat nomor" className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground" />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="semua">Semua driver</option><option value="disetujui">Sudah menyetujui</option><option value="belum">Belum ada persetujuan</option>
          </select>
        </div>
      </div>

      <style>{`
        @media screen { .agreement-print { display: none; } }
        @media print {
          body * { visibility: hidden !important; }
          .agreement-print, .agreement-print * { visibility: visible !important; }
          .agreement-print { display: block !important; position: absolute; inset: 0; width: 100%; padding: 12mm; color: #111 !important; background: white !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.45; }
          .agreement-print h1 { font-size: 15pt; text-align: center; margin-bottom: 8px; }
          .agreement-print h2 { font-size: 11pt; margin: 14px 0 5px; }
          .agreement-print p { margin: 4px 0; }
          .agreement-print .metadata { border: 1px solid #999; padding: 10px; margin: 12px 0; }
          .agreement-print .signature { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print space-y-3">
        {drivers.isLoading && <p className="text-sm text-muted-foreground">Memuat data perjanjian...</p>}
        {drivers.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Gagal memuat data: {drivers.error.message}</p>}
        {!drivers.isLoading && !drivers.isError && filtered.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tidak ada data yang cocok.</p>}
        {filtered.map((driver) => {
          const accepted = Boolean(driver.partnership_agreement_accepted_at);
          return <article key={driver.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-foreground">{driver.full_name || "Nama belum tersedia"}</h3>
              <p className="text-xs text-muted-foreground">WhatsApp: {driver.phone || "—"} · Plat: {driver.vehicle_plate || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status driver: {driver.status || "—"}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">{accepted ? <><CheckCircle2 className="h-4 w-4 text-green-600" /> <span className="text-green-700">Disetujui secara elektronik</span></> : <><Clock3 className="h-4 w-4 text-amber-600" /> <span className="text-amber-700">Belum tercatat menyetujui</span></>}</p>
              {accepted && <p className="mt-1 text-xs text-muted-foreground">Waktu: {new Date(driver.partnership_agreement_accepted_at!).toLocaleString("id-ID")} · Versi: {driver.partnership_agreement_version || "Tidak tercatat"}</p>}
            </div>
            <button type="button" disabled={!accepted} onClick={() => printAgreement(driver)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Printer className="h-4 w-4" /> Cetak / PDF</button>
          </article>;
        })}
      </div>

      {selected && <article className="agreement-print">
        <h1>PERJANJIAN KEMITRAAN PENYEDIAAN LAYANAN TRANSPORTASI DAN/ATAU PENGANTARAN BERBASIS APLIKASI</h1>
        <p>PT Fast Network Indonesia — Pengelola aplikasi Mider, berkedudukan di Kota Metro, Indonesia.</p>
        <div className="metadata">
          <p><strong>Nama Mitra:</strong> {selected.full_name || "—"}</p>
          <p><strong>Nomor HP:</strong> {selected.phone || "—"}</p>
          <p><strong>NIK:</strong> {selected.nik || "—"}</p>
          <p><strong>Kendaraan:</strong> {[selected.vehicle_type, selected.vehicle_brand, selected.vehicle_model].filter(Boolean).join(" ") || "—"}</p>
          <p><strong>Nomor polisi:</strong> {selected.vehicle_plate || "—"}</p>
          <p><strong>ID profil driver:</strong> {selected.id}</p>
          <p><strong>Persetujuan elektronik dicatat:</strong> {selected.partnership_agreement_accepted_at ? new Date(selected.partnership_agreement_accepted_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "long" }) : "Tidak tercatat"}</p>
          <p><strong>Versi perjanjian:</strong> {selected.partnership_agreement_version || AGREEMENT_VERSION}</p>
        </div>
        <p>Perjanjian ini disetujui secara elektronik oleh PT Fast Network Indonesia, berkedudukan di Kota Metro, Indonesia, sebagai pengelola aplikasi Mider (selanjutnya disebut “Aplikator”), dan individu yang mendaftar sebagai driver melalui aplikasi Mider (selanjutnya disebut “Mitra”). Keduanya bersama-sama disebut “Para Pihak”.</p>
        {ARTICLES.map((article) => <section key={article.title}><h2>{article.title}</h2>{article.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
        <p><strong>Persetujuan elektronik:</strong> dengan mencentang kotak persetujuan dan mengirim formulir, Mitra menyatakan telah membaca, memahami, dan menyetujui Perjanjian Kemitraan ini.</p>
        <div className="signature">
          <div><p><strong>PIHAK APLIKATOR</strong></p><p>PT Fast Network Indonesia</p><p style={{ marginTop: 55 }}>________________________</p></div>
          <div><p><strong>PIHAK MITRA</strong></p><p>{selected.full_name || "Mitra Driver"}</p><p>Persetujuan elektronik</p><p>{selected.partnership_agreement_accepted_at ? new Date(selected.partnership_agreement_accepted_at).toLocaleString("id-ID") : "—"}</p></div>
        </div>
        <p style={{ marginTop: 20, fontSize: 8 }}>Dokumen cetak dari catatan aplikasi. Referensi profil: {selected.id}. Versi: {selected.partnership_agreement_version || AGREEMENT_VERSION}.</p>
      </article>}
    </section>
  );
}
