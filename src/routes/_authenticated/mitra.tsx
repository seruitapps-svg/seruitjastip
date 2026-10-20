import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingBag, MapPin, ToggleLeft, ToggleRight, ImagePlus, Save, LoaderCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadCompressedMedia } from "@/lib/image-compressor";

export const Route = createFileRoute("/_authenticated/mitra")({
  head: () => ({
    meta: [
      { title: "Dashboard Resto Mitra — Mider" },
      { name: "description", content: "Dashboard operasional mitra resto Mider." },
    ],
  }),
  component: MitraDashboardPage,
});

function MitraDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const merchantQuery = useQuery({
    queryKey: ["my-merchant-profile", user?.id],
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

  const merchant = merchantQuery.data;

  useEffect(() => {
    if (!merchant) return;
    setName(merchant.name ?? "");
    setAddress(merchant.address ?? "");
    setPhone(merchant.phone_wa ?? "");
    setOpeningHours(merchant.opening_hours ?? "");
  }, [merchant?.id, merchant?.updated_at]);

  async function toggleStatus() {
    if (!merchant || !user || changingStatus) return;
    setChangingStatus(true);
    setErrorMessage("");
    setMessage("");
    try {
      const { error } = await supabase
        .from("merchants")
        .update({ is_open: !merchant.is_open })
        .eq("id", merchant.id)
        .eq("user_id", user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["my-merchant-profile", user.id] });
      setMessage(!merchant.is_open ? "Status resto berhasil diubah menjadi buka." : "Status resto berhasil diubah menjadi tutup.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengubah status resto.");
    } finally {
      setChangingStatus(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchant || !user || savingProfile) return;
    setSavingProfile(true);
    setErrorMessage("");
    setMessage("");
    try {
      let imageUrl: string | undefined;
      if (photo) {
        imageUrl = await uploadCompressedMedia("merchant-assets", user.id, "outlet", photo, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
        });
      }

      const changes = {
        name: name.trim(),
        address: address.trim(),
        phone_wa: phone.trim() || null,
        opening_hours: openingHours.trim() || null,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const { error } = await supabase
        .from("merchants")
        .update(changes)
        .eq("id", merchant.id)
        .eq("user_id", user.id);
      if (error) throw error;

      setPhoto(null);
      await queryClient.invalidateQueries({ queryKey: ["my-merchant-profile", user.id] });
      setMessage("Profil resto berhasil disimpan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan profil resto.");
    } finally {
      setSavingProfile(false);
    }
  }

  if (merchantQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-4xl p-6 text-center text-sm text-muted-foreground">Memuat data restoran Anda...</main>
      </div>
    );
  }

  if (merchantQuery.error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-md p-6 text-center">
          <Store className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-3 font-bold text-foreground">Gagal Memuat Profil Resto</h2>
          <p className="mt-1 text-xs text-muted-foreground">{merchantQuery.error.message}</p>
          <Button className="mt-4" onClick={() => void merchantQuery.refetch()}>Coba Lagi</Button>
        </main>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-md p-6 text-center">
          <Store className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-3 font-bold text-foreground">Belum Terdaftar sebagai Mitra</h2>
          <p className="mt-1 text-xs text-muted-foreground">Anda belum memiliki profil resto. Daftarkan resto terlebih dahulu atau tunggu verifikasi pengajuan Anda.</p>
          <Link to="/merchant" className="mt-4 inline-block"><Button>Daftar Mitra Resto</Button></Link>
        </main>
      </div>
    );
  }

  const canOperate = merchant.status === "approved";

  return (
    <div className="min-h-screen bg-background pb-10">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {merchant.image_url ? (
              <img src={merchant.image_url} alt={merchant.name} className="h-16 w-16 rounded-xl border border-border object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="h-7 w-7" /></div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-foreground">{merchant.name}</h1>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{merchant.type || "Resto Mitra"}</span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {merchant.address}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status pengajuan: <strong>{merchant.status || "belum diketahui"}</strong></p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={!canOperate || changingStatus} onClick={() => void toggleStatus()} className="gap-2">
            {changingStatus ? <LoaderCircle className="h-5 w-5 animate-spin" /> : merchant.is_open ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}
            <span>{merchant.is_open ? "Resto Buka" : "Resto Tutup"}</span>
          </Button>
        </section>

        {merchant.status !== "approved" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
            Pengajuan resto Anda masih menunggu verifikasi admin. Pengelolaan operasional aktif setelah resto disetujui.
          </div>
        )}
        {message && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
        {errorMessage && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage}</div>}

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-foreground">Profil dan Foto Resto</h2>
            <p className="mt-1 text-xs text-muted-foreground">Perbarui informasi yang ditampilkan kepada pelanggan. Foto dikompresi ke WebP sebelum diunggah.</p>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">Nama resto *
              <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="block text-sm font-medium text-foreground">Alamat *
              <textarea required rows={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">WhatsApp resto
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08xxxxxxxxxx" />
              </label>
              <label className="block text-sm font-medium text-foreground">Jam operasional
                <input value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="08:00 - 21:00" />
              </label>
            </div>
            <label className="block rounded-xl border border-dashed border-border p-4 text-sm font-medium text-foreground">
              <span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Ganti foto outlet atau logo</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Pilih gambar dari galeri HP (opsional).</span>
              <input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" />
              {photo && <span className="mt-2 block text-xs text-muted-foreground">Dipilih: {photo.name}</span>}
            </label>
            <Button type="submit" disabled={!canOperate || savingProfile} className="w-full gap-2">
              {savingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingProfile ? "Menyimpan..." : "Simpan Profil"}
            </Button>
            {!canOperate && <p className="text-xs text-muted-foreground">Profil bisa diedit setelah pengajuan disetujui admin.</p>}
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Pesanan Masuk</h2>
              <p className="mt-1 text-sm text-muted-foreground">Bagian ini akan menampilkan pesanan pelanggan yang diarahkan ke resto Anda.</p>
              <p className="mt-2 text-xs text-muted-foreground">Data pesanan belum ditampilkan di dashboard ini karena alur pesanan Food & Drink belum terhubung ke akun resto.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-base font-bold text-foreground">Pengelolaan Produk / Menu</h2>
          <p className="mt-1 text-sm text-muted-foreground">Saya belum mengaktifkan tambah/edit/hapus produk karena struktur tabel produk beserta kolom harga, stok, foto, dan relasi ke resto belum tersedia pada tipe database di repo ini. Saya tidak mengarang nama tabel atau mengubah database tanpa dasar skema yang terverifikasi.</p>
        </section>
      </main>
    </div>
  );
}
