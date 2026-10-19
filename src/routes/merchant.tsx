import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Pendaftaran Mitra Resto — Mider" },
      { name: "description", content: "Formulir pratinjau pendaftaran restoran menjadi Mitra Resto Mider." },
    ],
  }),
  component: MerchantRegistrationPage,
});

function MerchantRegistrationPage() {
  const [form, setForm] = useState({
    restaurantName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    category: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitted(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
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
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Kemitraan Mider</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">Daftar Mitra Resto</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Isi informasi restoran untuk menyiapkan pengajuan kemitraan.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Formulir pratinjau.</strong> Data belum dikirim atau disimpan ke server. Integrasi pengajuan akan dilakukan pada tahap backend setelah UI disetujui.
          </div>

          {submitted && (
            <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <span>Pratinjau formulir berhasil divalidasi di halaman ini. Belum ada pengajuan yang dikirim.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Nama restoran *
                <input required value={form.restaurantName} onChange={(event) => updateField("restaurantName", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: Resto Nusantara" />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Nama pemilik *
                <input required value={form.ownerName} onChange={(event) => updateField("ownerName", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Nama pemilik atau penanggung jawab" />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Nomor WhatsApp *
                <input required type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08xxxxxxxxxx" />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Email
                <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="nama@email.com" />
              </label>
            </div>
            <label className="block text-sm font-medium text-foreground">
              Kategori restoran *
              <select required value={form.category} onChange={(event) => updateField("category", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="">Pilih kategori</option>
                <option value="Makanan Nusantara">Makanan Nusantara</option>
                <option value="Fast Food">Fast Food</option>
                <option value="Kafe dan Minuman">Kafe dan Minuman</option>
                <option value="Roti dan Kue">Roti dan Kue</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              Alamat restoran *
              <textarea required rows={3} value={form.address} onChange={(event) => updateField("address", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Alamat lengkap restoran" />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Informasi tambahan
              <textarea rows={2} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Jam operasional atau informasi lain (opsional)" />
            </label>
            <Button type="submit" className="w-full">Periksa Formulir (Pratinjau)</Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-semibold text-foreground">Sudah menjadi mitra?</p>
          <p className="mt-1 text-muted-foreground">Dashboard mitra saat ini masih berupa pratinjau UI.</p>
          <Button asChild={false} type="button" variant="outline" className="mt-3" onClick={() => { window.location.href = "/mitra"; }}>
            Buka Mode Mitra
          </Button>
        </section>
      </main>
    </div>
  );
}
