import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Store, ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
    category: "",
    openingHours: "08:00 - 21:00",
  });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [success, setSuccess] = useState(false);

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

    setSaving(true);
    setErrMsg("");
    setSuccess(false);

    try {
      const { error } = await supabase.from("merchants").insert({
        user_id: user.id,
        name: form.name.trim(),
        owner_name: form.ownerName.trim(),
        phone_wa: form.phone.trim(),
        address: form.address.trim(),
        type: form.category.trim() || "Kuliner",
        opening_hours: form.openingHours.trim(),
        status: "pending",
        is_open: true,
      });

      if (error) throw error;
      setSuccess(true);
      await myMerchantQuery.refetch();
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : "Gagal mengirim pendaftaran mitra.");
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
                <textarea required rows={3} value={form.address} onChange={(e) => updateField("address", e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Alamat patokan lokasi restoran" />
              </label>

              <Button type="submit" disabled={saving} className="w-full rounded-xl py-2.5">
                {saving ? "Mengirim Pendaftaran..." : "Kirim Pendaftaran Mitra"}
              </Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
