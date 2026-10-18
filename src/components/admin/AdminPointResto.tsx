import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Trash2, Power, Upload, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { uploadCompressedMedia } from "@/lib/image-compressor";

export function AdminPointResto() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone_wa: "",
    opening_hours: "09:00 - 21:00",
  });

  const restos = useQuery({
    queryKey: ["admin-point-restos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("type", "point_resto")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setErr("Nama resto dan alamat wajib diisi.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      let imageUrl: string | null = null;
      if (photoFile) {
        imageUrl = await uploadCompressedMedia(
          "merchant-assets",
          "point_restos",
          form.name,
          photoFile,
          { maxWidth: 800, maxHeight: 800, quality: 0.75 },
        );
      }

      const { error } = await supabase.from("merchants").insert({
        name: form.name.trim(),
        address: form.address.trim(),
        phone_wa: form.phone_wa.trim() || null,
        opening_hours: form.opening_hours.trim(),
        type: "point_resto",
        image_url: imageUrl,
        is_open: true,
      });

      if (error) throw error;

      setForm({ name: "", address: "", phone_wa: "", opening_hours: "09:00 - 21:00" });
      setPhotoFile(null);
      setShowForm(false);
      await qc.invalidateQueries({ queryKey: ["admin-point-restos"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan Point Resto.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase.from("merchants").update({ is_open: !currentStatus }).eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin-point-restos"] });
  }

  async function deleteResto(id: string) {
    if (!window.confirm("Hapus resto ini dari daftar Point Resto?")) return;
    const { error } = await supabase.from("merchants").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin-point-restos"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-foreground">Manajemen Point Resto</h2>
          <p className="text-xs text-muted-foreground">
            Daftar warung & resto hits di Metro yang bisa langsung dipilih konsumen di menu Food.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 self-start rounded-xl font-semibold"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Tutup Form" : "Tambah Resto"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-semibold text-foreground">Form Tambah Resto / Warung</h3>
          {err && <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{err}</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nama Resto / Warung *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Bebek Goreng H. Slamet"
                className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">No. WhatsApp Pemilik / Kasir</label>
              <input
                type="tel"
                value={form.phone_wa}
                onChange={(e) => setForm({ ...form, phone_wa: e.target.value })}
                placeholder="08xxxxxxxxxx"
                className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Alamat / Lokasi *</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Jl. AH Nasution No. 12, Metro Timur"
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Jam Operasional</label>
              <input
                type="text"
                value={form.opening_hours}
                onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
                placeholder="09:00 - 21:00"
                className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Foto / Logo Resto (Auto-Kompres)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
              />
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full font-medium sm:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {busy ? "Mengompres & Menyimpan..." : "Simpan Point Resto"}
          </Button>
        </form>
      )}

      {err && !showForm && <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{err}</div>}

      {restos.isLoading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Memuat data resto...</div>
      ) : restos.isError ? (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          Gagal memuat data resto: {restos.error.message}
        </div>
      ) : (restos.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          Belum ada Point Resto yang ditambahkan. Silakan klik tombol "Tambah Resto" di atas.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(restos.data ?? []).map((resto) => (
            <div
              key={resto.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex gap-3">
                {resto.image_url ? (
                  <img
                    src={resto.image_url}
                    alt={resto.name}
                    loading="lazy"
                    className="h-14 w-14 flex-shrink-0 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Store className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="truncate text-sm font-semibold text-foreground">{resto.name}</h4>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${resto.is_open ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                    />
                  </div>
                  <p className="mt-0.5 flex line-clamp-1 items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" /> {resto.address}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">Jam: {resto.opening_hours}</p>
                  {resto.phone_wa && <p className="mt-1 text-[11px] text-muted-foreground">WA: {resto.phone_wa}</p>}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => void toggleStatus(resto.id, resto.is_open)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${resto.is_open ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  <Power className="h-3 w-3" />
                  {resto.is_open ? "Buka" : "Tutup"}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteResto(resto.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  title="Hapus resto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
