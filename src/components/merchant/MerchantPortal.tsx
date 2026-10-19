import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, CheckCircle2, XCircle, Clock3, Plus, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type MerchantRow = {
  id: string; name: string; address: string; phone_wa: string | null;
  image_url: string | null; is_open: boolean; verification_status: string;
  rejection_note: string | null; owner_id: string | null;
};

export function MerchantPortal() {
  const { user, isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const own = useQuery({
    queryKey: ["my-official-merchant", user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("merchants").select("*")
        .eq("type", "official_mitra").eq("owner_id", user!.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as MerchantRow | null;
    },
  });
  const applications = useQuery({
    queryKey: ["admin-official-merchants"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("merchants").select("*")
        .eq("type", "official_mitra").order("created_at", { ascending: false });
      if (error) throw error;
      return data as MerchantRow[];
    },
  });
  const products = useQuery({
    queryKey: ["my-merchant-products", own.data?.id],
    enabled: !!own.data?.id && own.data.verification_status === "approved",
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("merchant_products").select("*")
        .eq("merchant_id", own.data!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { setMessage("Masuk ke akun Mider terlebih dahulu untuk mendaftar."); return; }
    setBusy(true); setMessage("");
    const { error } = await (supabase as any).from("merchants").insert({
      name: name.trim(), address: address.trim(), phone_wa: phone.trim() || null,
      owner_id: user.id, type: "official_mitra", verification_status: "pending", is_open: false,
    });
    setBusy(false);
    if (error) { setMessage("Pendaftaran gagal: " + error.message); return; }
    setName(""); setAddress(""); setPhone("");
    setMessage("Pendaftaran terkirim. Tunggu pemeriksaan Superadmin.");
    await qc.invalidateQueries({ queryKey: ["my-official-merchant", user.id] });
  }
  async function review(item: MerchantRow, approved: boolean) {
    const rejection = approved ? null : window.prompt("Alasan penolakan (wajib diisi):", "Mohon lengkapi data restoran");
    if (!approved && !rejection?.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).from("merchants").update({
      verification_status: approved ? "approved" : "rejected",
      rejection_note: approved ? null : rejection!.trim(),
      is_open: approved,
    }).eq("id", item.id).eq("type", "official_mitra");
    setBusy(false);
    if (error) setMessage("Gagal memproses: " + error.message);
    else {
      setMessage(approved ? "Mitra disetujui." : "Pendaftaran ditolak.");
      await qc.invalidateQueries({ queryKey: ["admin-official-merchants"] });
      await qc.invalidateQueries({ queryKey: ["official-merchant-catalog"] });
    }
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!own.data) return;
    setBusy(true); setMessage("");
    const { error } = await (supabase as any).from("merchant_products").insert({
      merchant_id: own.data.id, name: productName.trim(),
      description: productDescription.trim(), price: Math.round(Number(productPrice)),
    });
    setBusy(false);
    if (error) setMessage("Gagal menyimpan menu: " + error.message);
    else {
      setProductName(""); setProductPrice(""); setProductDescription("");
      await qc.invalidateQueries({ queryKey: ["my-merchant-products", own.data.id] });
    }
  }
  async function toggleProduct(id: string, available: boolean) {
    const { error } = await (supabase as any).from("merchant_products").update({ is_available: !available }).eq("id", id);
    if (error) setMessage(error.message);
    else await qc.invalidateQueries({ queryKey: ["my-merchant-products", own.data?.id] });
  }

  if (ready && !user && !isAdmin) return <section className="rounded-2xl border border-border bg-card p-5 text-center"><Store className="mx-auto h-8 w-8 text-primary"/><h2 className="mt-2 font-bold">Mitra Resto Resmi</h2><p className="mt-1 text-sm text-muted-foreground">Masuk ke akun Mider untuk mendaftarkan restoran.</p><a className="mt-3 inline-block font-semibold text-primary underline" href="/auth">Masuk / Daftar</a></section>;

  if (isAdmin) return <section className="space-y-3">
    <div><h2 className="text-lg font-bold">Verifikasi Mitra Resto</h2><p className="text-xs text-muted-foreground">Periksa data restoran sebelum ditampilkan di katalog resmi.</p></div>
    {message && <p className="rounded-lg bg-primary/10 p-3 text-sm">{message}</p>}
    {applications.isLoading && <p className="text-sm text-muted-foreground">Memuat pendaftaran...</p>}
    {applications.data?.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pendaftaran mitra.</p>}
    {applications.data?.map(item => <article key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.name}</h3><p className="text-sm text-muted-foreground">{item.address}</p><p className="text-xs text-muted-foreground">WhatsApp: {item.phone_wa || "Belum diisi"}</p><p className="text-xs text-muted-foreground">Pemilik: {item.owner_id}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs">{item.verification_status}</span></div>
      {item.rejection_note && <p className="text-xs text-destructive">Catatan: {item.rejection_note}</p>}
      {item.verification_status !== "approved" && <div className="flex gap-2"><button disabled={busy} onClick={() => review(item,true)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Setujui</button><button disabled={busy} onClick={() => review(item,false)} className="rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive"><XCircle className="mr-1 inline h-4 w-4"/>Tolak</button></div>}
    </article>)}
  </section>;

  if (!user) return null;
  if (own.isLoading) return <p className="text-sm text-muted-foreground">Memuat data mitra...</p>;
  if (!own.data || own.data.verification_status === "rejected") return <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <div><h2 className="text-lg font-bold">Daftarkan Restoran Anda</h2><p className="mt-1 text-sm text-muted-foreground">Isi data dasar. Restoran baru tampil setelah disetujui Superadmin.</p></div>
    {own.data?.rejection_note && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Pendaftaran sebelumnya ditolak: {own.data.rejection_note}</p>}
    {message && <p className="rounded-lg bg-primary/10 p-3 text-sm">{message}</p>}
    <form onSubmit={submitApplication} className="space-y-3">
      <label className="block text-sm">Nama restoran<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5" /></label>
      <label className="block text-sm">Alamat lengkap<input required minLength={5} value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5" /></label>
      <label className="block text-sm">WhatsApp restoran<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5" placeholder="08xxxxxxxxxx"/></label>
      <button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">{busy ? "Mengirim..." : "Kirim Pendaftaran"}</button>
    </form>
  </section>;

  if (own.data.verification_status !== "approved") return <section className="space-y-2 rounded-2xl border border-border bg-card p-5"><Clock3 className="h-8 w-8 text-amber-500"/><h2 className="font-bold">Pendaftaran sedang diperiksa</h2><p className="text-sm text-muted-foreground">Restoran belum muncul di katalog sampai disetujui Superadmin.</p></section>;

  return <section className="space-y-4">
    <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-semibold text-primary">DASHBOARD MITRA</p><h2 className="mt-1 text-xl font-extrabold">{own.data.name}</h2><p className="text-sm text-muted-foreground">{own.data.address}</p><p className="mt-2 text-xs text-green-700">Restoran terverifikasi</p></div>
    <form onSubmit={addProduct} className="space-y-3 rounded-2xl border border-border bg-card p-4"><h3 className="font-bold"><UtensilsCrossed className="mr-2 inline h-4 w-4"/>Tambah menu</h3>
      <label className="block text-sm">Nama menu<input required minLength={2} value={productName} onChange={e=>setProductName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5"/></label>
      <label className="block text-sm">Harga (rupiah)<input required type="number" min="0" step="500" value={productPrice} onChange={e=>setProductPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5"/></label>
      <label className="block text-sm">Deskripsi<input value={productDescription} onChange={e=>setProductDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5"/></label>
      <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">{busy ? "Menyimpan..." : "Simpan Menu"}</button>
    </form>
    <div className="space-y-2"><h3 className="font-bold">Menu restoran</h3>{products.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada menu.</p>}{products.data?.map(p=><article key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"><div><p className="font-semibold">{p.name}</p><p className="text-sm text-muted-foreground">Rp {Number(p.price).toLocaleString("id-ID")}</p><p className="text-xs text-muted-foreground">{p.description}</p></div><button onClick={()=>toggleProduct(p.id,p.is_available)} className="rounded-lg border px-3 py-2 text-xs">{p.is_available ? "Tersedia" : "Habis"}</button></article>)}</div>
  </section>;
}

export function OfficialMerchantCatalog() {
  const catalog = useQuery({
    queryKey: ["official-merchant-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("merchants")
        .select("id,name,address,phone_wa,image_url,opening_hours")
        .eq("type", "official_mitra").eq("verification_status", "approved").eq("is_open", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const menu = useQuery({
    queryKey: ["official-merchant-products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("merchant_products")
        .select("id,merchant_id,name,description,price,image_url")
        .eq("is_available", true).order("name");
      if (error) throw error;
      return data;
    },
  });
  return <section className="space-y-3">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><Store className="mx-auto h-8 w-8 text-primary"/><h3 className="mt-2 text-center font-bold">Mitra Resto Resmi</h3><p className="mt-1 text-center text-xs text-muted-foreground">Restoran yang sudah diverifikasi oleh Mider.</p></div>
    {catalog.isLoading && <p className="text-sm text-muted-foreground">Memuat katalog...</p>}
    {catalog.data?.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada mitra resto resmi yang aktif.</p>}
    <div className="space-y-3">{catalog.data?.map(m => <article key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex gap-3 p-3">{m.image_url ? <img src={m.image_url} alt={m.name} className="h-20 w-20 rounded-xl object-cover"/> : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted"><Store className="h-7 w-7 text-muted-foreground"/></div>}<div className="min-w-0"><h4 className="font-bold">{m.name}</h4><p className="text-xs text-muted-foreground">{m.address}</p><p className="mt-1 text-xs text-primary">{m.opening_hours || "Jam operasional belum dicantumkan"}</p></div></div>
      <div className="border-t border-border p-3"><p className="mb-2 text-xs font-semibold">Menu tersedia</p>{(menu.data ?? []).filter(p=>p.merchant_id===m.id).length ? <div className="space-y-2">{(menu.data ?? []).filter(p=>p.merchant_id===m.id).map(p=><div key={p.id} className="flex justify-between gap-3 text-sm"><div><p className="font-medium">{p.name}</p>{p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}</div><span className="whitespace-nowrap font-semibold">Rp {Number(p.price).toLocaleString("id-ID")}</span></div>)}</div> : <p className="text-xs text-muted-foreground">Menu sedang disiapkan.</p>}</div>
    </article>)}</div>
    <p className="text-center text-xs text-muted-foreground">Ingin bergabung? <a href="/merchant" className="font-semibold text-primary underline">Daftarkan restoran Anda</a></p>
  </section>;
}
