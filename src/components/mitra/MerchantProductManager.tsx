import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadCompressedMedia } from "@/lib/image-compressor";

type MerchantProduct = {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

type ProductForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  isAvailable: boolean;
  imageFile: File | null;
};

const emptyForm: ProductForm = {
  name: "",
  description: "",
  category: "",
  price: "",
  isAvailable: true,
  imageFile: null,
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function MerchantProductManager({
  merchantId,
  userId,
  canOperate,
}: {
  merchantId: string;
  userId: string;
  canOperate: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editing, setEditing] = useState<MerchantProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Cast lokal diperlukan sampai tipe Supabase diperbarui lewat generate types setelah migration diterapkan.
  const productsTable = () => (supabase.from("merchant_products" as never) as any);

  const productsQuery = useQuery({
    queryKey: ["merchant-products", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await productsTable()
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MerchantProduct[];
    },
  });

  function startNewProduct() {
    setEditing(null);
    setForm(emptyForm);
    setErrorMessage("");
    setSuccessMessage("");
    setFormOpen(true);
  }

  function startEdit(product: MerchantProduct) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? "",
      category: product.category ?? "",
      price: String(product.price),
      isAvailable: product.is_available,
      imageFile: null,
    });
    setErrorMessage("");
    setSuccessMessage("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canOperate || saving) return;

    const price = Number(form.price);
    if (!form.name.trim()) {
      setErrorMessage("Nama produk wajib diisi.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setErrorMessage("Harga harus berupa angka nol atau lebih.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let imageUrl = editing?.image_url ?? null;
      if (form.imageFile) {
        imageUrl = await uploadCompressedMedia("merchant-assets", userId, "product", form.imageFile, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
        });
      }

      const payload = {
        merchant_id: merchantId,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        price,
        image_url: imageUrl,
        is_available: form.isAvailable,
        updated_at: new Date().toISOString(),
      };

      const result = editing
        ? await productsTable().update(payload).eq("id", editing.id).eq("merchant_id", merchantId)
        : await productsTable().insert(payload);

      if (result.error) throw result.error;

      await queryClient.invalidateQueries({ queryKey: ["merchant-products", merchantId] });
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setSuccessMessage(editing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan produk.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(product: MerchantProduct) {
    if (!canOperate) return;
    setErrorMessage("");
    setSuccessMessage("");
    const { error } = await productsTable()
      .update({ is_available: !product.is_available, updated_at: new Date().toISOString() })
      .eq("id", product.id)
      .eq("merchant_id", merchantId);
    if (error) {
      setErrorMessage(error.message ?? "Gagal mengubah status produk.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["merchant-products", merchantId] });
    setSuccessMessage(product.is_available ? "Produk disembunyikan dari katalog." : "Produk ditampilkan di katalog.");
  }

  async function deleteProduct(product: MerchantProduct) {
    if (!canOperate || deletingId) return;
    const confirmed = window.confirm(`Hapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    setDeletingId(product.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const { error } = await productsTable()
        .delete()
        .eq("id", product.id)
        .eq("merchant_id", merchantId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["merchant-products", merchantId] });
      setSuccessMessage("Produk berhasil dihapus.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menghapus produk.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Produk dan Menu</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tambahkan nama, kategori, harga, deskripsi, dan foto produk yang ditampilkan di katalog.
          </p>
        </div>
        <Button type="button" size="sm" disabled={!canOperate} onClick={startNewProduct} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Produk
        </Button>
      </div>

      {!canOperate && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          Pengelolaan produk aktif setelah pengajuan resto disetujui admin.
        </p>
      )}

      {errorMessage && <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage}</div>}
      {successMessage && <div role="status" className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">{successMessage}</div>}

      {formOpen && (
        <form onSubmit={saveProduct} className="mt-5 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-foreground">{editing ? "Edit Produk" : "Produk Baru"}</h3>
            <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={closeForm} aria-label="Tutup formulir"><X className="h-4 w-4" /></Button>
          </div>
          <label className="block text-sm font-medium text-foreground">Nama produk *
            <input required maxLength={120} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: Nasi ayam geprek" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">Kategori
              <input maxLength={80} value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Makanan, minuman..." />
            </label>
            <label className="block text-sm font-medium text-foreground">Harga (Rp) *
              <input required type="number" min="0" step="500" value={form.price} onChange={(e) => setForm((v) => ({ ...v, price: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="15000" />
            </label>
          </div>
          <label className="block text-sm font-medium text-foreground">Deskripsi
            <textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Komposisi atau informasi produk (opsional)" />
          </label>
          <label className="block rounded-xl border border-dashed border-border p-4 text-sm font-medium text-foreground">
            <span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Foto produk</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Opsional. Foto dikompresi ke WebP sebelum diunggah.</span>
            <input type="file" accept="image/*" onChange={(e) => setForm((v) => ({ ...v, imageFile: e.target.files?.[0] ?? null }))} className="mt-3 block w-full text-sm" />
            {form.imageFile && <span className="mt-2 block text-xs text-muted-foreground">Dipilih: {form.imageFile.name}</span>}
            {!form.imageFile && editing?.image_url && <span className="mt-2 block text-xs text-muted-foreground">Foto saat ini tetap digunakan jika tidak memilih foto baru.</span>}
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm((v) => ({ ...v, isAvailable: e.target.checked }))} className="h-4 w-4 rounded border-input" />
            Tampilkan produk sebagai tersedia
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={saving || !canOperate} className="gap-2">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Menyimpan..." : "Simpan Produk"}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={closeForm}>Batal</Button>
          </div>
        </form>
      )}

      {productsQuery.isLoading ? (
        <p className="mt-5 text-sm text-muted-foreground">Memuat produk...</p>
      ) : productsQuery.error ? (
        <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">Gagal memuat produk. Pastikan migration database sudah diterapkan.</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{productsQuery.error.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void productsQuery.refetch()}>Coba Lagi</Button>
        </div>
      ) : productsQuery.data?.length ? (
        <div className="mt-5 space-y-3">
          {productsQuery.data.map((product) => (
            <article key={product.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-24 w-full rounded-lg object-cover sm:w-24" />
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground sm:w-24">Tanpa foto</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-foreground">{product.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${product.is_available ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {product.is_available ? "Tersedia" : "Disembunyikan"}
                  </span>
                </div>
                {product.category && <p className="mt-0.5 text-xs text-muted-foreground">{product.category}</p>}
                <p className="mt-1 text-sm font-extrabold text-primary">{formatRupiah(Number(product.price))}</p>
                {product.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={!canOperate} onClick={() => startEdit(product)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!canOperate} onClick={() => void toggleAvailability(product)}>{product.is_available ? "Sembunyikan" : "Tampilkan"}</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!canOperate || deletingId === product.id} onClick={() => void deleteProduct(product)} className="gap-1.5">
                    {deletingId === product.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">Belum ada produk</p>
          <p className="mt-1 text-xs text-muted-foreground">Tambahkan produk pertama agar menu resto dapat dikelola dari dashboard ini.</p>
        </div>
      )}
    </section>
  );
}
