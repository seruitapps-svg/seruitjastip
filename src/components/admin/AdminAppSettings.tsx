import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ImagePlus, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";

const db = supabase as any;
type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: "all" | "driver" | "user" | "mitra";
  announcement_type: "info" | "important" | "maintenance" | "promotion";
  placement: "banner" | "popup" | "inbox";
  status: "draft" | "published" | "disabled";
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

const inputCls = "mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm";
const blankForm = {
  title: "",
  message: "",
  audience: "all" as Announcement["audience"],
  announcement_type: "info" as Announcement["announcement_type"],
  placement: "banner" as Announcement["placement"],
  status: "draft" as Announcement["status"],
  starts_at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  ends_at: "",
};

export function AdminAppSettings() {
  const qc = useQueryClient();
  const [section, setSection] = useState<"branding" | "announcements">("branding");
  const [branding, setBranding] = useState({ app_name: "Mider", logo_url: "", favicon_url: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const brandingQuery = useQuery({
    queryKey: ["app-branding"],
    queryFn: async () => {
      const { data, error } = await db.from("app_branding").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const announcementsQuery = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await db.from("app_announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  useEffect(() => {
    if (!brandingQuery.data) return;
    setBranding({
      app_name: brandingQuery.data.app_name ?? "Mider",
      logo_url: brandingQuery.data.logo_url ?? "",
      favicon_url: brandingQuery.data.favicon_url ?? "",
    });
  }, [brandingQuery.data]);

  async function uploadAsset(file: File, kind: "logo" | "favicon") {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(file.type)) throw new Error("Format gambar harus PNG, JPG, WEBP, SVG, atau ICO.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 5 MB.");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${kind}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("app-branding").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (error) throw error;
    return supabase.storage.from("app-branding").getPublicUrl(path).data.publicUrl;
  }

  async function saveBranding() {
    setBusy(true);
    setNotice(null);
    try {
      let logoUrl = branding.logo_url;
      let faviconUrl = branding.favicon_url;
      if (logoFile) logoUrl = await uploadAsset(logoFile, "logo");
      if (faviconFile) faviconUrl = await uploadAsset(faviconFile, "favicon");
      const { error } = await db.from("app_branding").upsert({
        id: 1,
        app_name: branding.app_name.trim() || "Mider",
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        updated_at: new Date().toISOString(),
        updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      if (error) throw error;
      setBranding({ app_name: branding.app_name.trim() || "Mider", logo_url: logoUrl, favicon_url: faviconUrl });
      setLogoFile(null);
      setFaviconFile(null);
      setNotice({ ok: true, text: "Identitas aplikasi berhasil disimpan." });
      await qc.invalidateQueries({ queryKey: ["app-branding"] });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Gagal menyimpan identitas aplikasi." });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      message: item.message,
      audience: item.audience,
      announcement_type: item.announcement_type,
      placement: item.placement,
      status: item.status,
      starts_at: new Date(new Date(item.starts_at).getTime() - new Date(item.starts_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      ends_at: item.ends_at ? new Date(new Date(item.ends_at).getTime() - new Date(item.ends_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankForm);
  }

  async function saveAnnouncement() {
    if (!form.title.trim() || !form.message.trim()) {
      setNotice({ ok: false, text: "Judul dan isi pengumuman wajib diisi." });
      return;
    }
    const startsAt = new Date(form.starts_at);
    const endsAt = form.ends_at ? new Date(form.ends_at) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))) {
      setNotice({ ok: false, text: "Tanggal berakhir harus setelah tanggal mulai." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
        announcement_type: form.announcement_type,
        placement: form.placement,
        status: form.status,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
        updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      };
      const result = editingId
        ? await db.from("app_announcements").update(payload).eq("id", editingId)
        : await db.from("app_announcements").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id ?? null });
      if (result.error) throw result.error;
      resetForm();
      setNotice({ ok: true, text: editingId ? "Pengumuman berhasil diperbarui." : "Pengumuman baru berhasil dibuat." });
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["active-announcements"] });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Gagal menyimpan pengumuman." });
    } finally {
      setBusy(false);
    }
  }

  async function setAnnouncementStatus(item: Announcement, status: Announcement["status"]) {
    setBusy(true);
    setNotice(null);
    const { error } = await db.from("app_announcements").update({ status, updated_at: new Date().toISOString(), updated_by: (await supabase.auth.getUser()).data.user?.id ?? null }).eq("id", item.id);
    setBusy(false);
    if (error) setNotice({ ok: false, text: error.message });
    else {
      setNotice({ ok: true, text: status === "published" ? "Pengumuman diterbitkan." : status === "disabled" ? "Pengumuman dinonaktifkan." : "Pengumuman disimpan sebagai draf." });
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["active-announcements"] });
    }
  }

  async function deleteAnnouncement(item: Announcement) {
    if (!window.confirm(`Hapus pengumuman "${item.title}" secara permanen?`)) return;
    setBusy(true);
    const { error } = await db.from("app_announcements").delete().eq("id", item.id);
    setBusy(false);
    if (error) setNotice({ ok: false, text: error.message });
    else {
      setNotice({ ok: true, text: "Pengumuman dihapus." });
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["active-announcements"] });
    }
  }

  const audienceLabel = (value: string) => ({ all: "Semua pengguna", driver: "Driver", user: "User / Pelanggan", mitra: "Mitra" }[value] ?? value);
  const statusLabel = (value: string) => ({ draft: "Draf", published: "Terbit", disabled: "Nonaktif" }[value] ?? value);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSection("branding")} className={`rounded-xl border p-3 text-sm font-bold ${section === "branding" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>Identitas & Branding</button>
        <button type="button" onClick={() => setSection("announcements")} className={`rounded-xl border p-3 text-sm font-bold ${section === "announcements" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>Pengumuman</button>
      </div>

      {notice && <div role="status" className={`rounded-xl border p-3 text-sm ${notice.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{notice.text}</div>}

      {section === "branding" ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div><h2 className="text-base font-extrabold text-foreground">Identitas Aplikasi</h2><p className="mt-1 text-xs text-muted-foreground">Logo dan favicon digunakan bersama di seluruh halaman aplikasi.</p></div>
          <label className="block text-sm font-semibold">Nama aplikasi<input className={inputCls} maxLength={60} value={branding.app_name} onChange={(e) => setBranding({ ...branding, app_name: e.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="h-4 w-4" />Logo aplikasi</label>
              {branding.logo_url ? <img src={branding.logo_url} alt="Logo saat ini" className="h-16 max-w-full object-contain" /> : <p className="text-xs text-muted-foreground">Logo bawaan akan digunakan jika belum ada.</p>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
              {logoFile && <p className="break-all text-xs text-muted-foreground">File baru: {logoFile.name}</p>}
            </div>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="h-4 w-4" />Favicon browser</label>
              {branding.favicon_url ? <img src={branding.favicon_url} alt="Favicon saat ini" className="h-10 w-10 object-contain" /> : <p className="text-xs text-muted-foreground">Favicon bawaan akan digunakan jika belum ada.</p>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
              {faviconFile && <p className="break-all text-xs text-muted-foreground">File baru: {faviconFile.name}</p>}
            </div>
          </div>
          <button type="button" disabled={busy} onClick={saveBranding} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan Identitas Aplikasi"}</button>
        </section>
      ) : (
        <section className="space-y-4">
          <form className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); void saveAnnouncement(); }}>
            <div className="flex items-center justify-between gap-2"><div><h2 className="text-base font-extrabold text-foreground">{editingId ? "Edit Pengumuman" : "Buat Pengumuman"}</h2><p className="mt-1 text-xs text-muted-foreground">Setiap pengumuman berdiri sendiri; beberapa dapat aktif bersamaan.</p></div><Megaphone className="h-5 w-5 text-primary" /></div>
            <label className="block text-sm font-semibold">Judul<input className={inputCls} maxLength={120} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Perubahan tarif driver" /></label>
            <label className="block text-sm font-semibold">Isi pesan<textarea className={inputCls} rows={4} maxLength={4000} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tulis pesan yang akan ditampilkan..." /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Penerima<select className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Announcement["audience"] })}><option value="all">Semua pengguna</option><option value="driver">Driver</option><option value="user">User / Pelanggan</option><option value="mitra">Mitra</option></select></label>
              <label className="block text-sm font-semibold">Jenis<select className={inputCls} value={form.announcement_type} onChange={(e) => setForm({ ...form, announcement_type: e.target.value as Announcement["announcement_type"] })}><option value="info">Informasi</option><option value="important">Penting</option><option value="maintenance">Pemeliharaan</option><option value="promotion">Promo</option></select></label>
              <label className="block text-sm font-semibold">Tampilan<select className={inputCls} value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value as Announcement["placement"] })}><option value="banner">Banner</option><option value="popup">Popup</option><option value="inbox">Pusat pengumuman</option></select></label>
              <label className="block text-sm font-semibold">Status<select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Announcement["status"] })}><option value="draft">Draf</option><option value="published">Terbitkan</option><option value="disabled">Nonaktif</option></select></label>
              <label className="block text-sm font-semibold">Mulai tampil<input type="datetime-local" required className={inputCls} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
              <label className="block text-sm font-semibold">Berakhir (opsional)<input type="datetime-local" className={inputCls} value={form.ends_at} min={form.starts_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></label>
            </div>
            <div className="flex gap-2"><button type="submit" disabled={busy} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Pengumuman"}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold"><X className="mr-1 inline h-4 w-4" />Batal</button>}</div>
          </form>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-foreground">Daftar Pengumuman</h3><span className="text-xs text-muted-foreground">{announcementsQuery.data?.length ?? 0} item</span></div>
            {announcementsQuery.isLoading && <p className="text-sm text-muted-foreground">Memuat pengumuman...</p>}
            {announcementsQuery.isError && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">Gagal memuat daftar. Pastikan migrasi SQL sudah dijalankan.</p>}
            {!announcementsQuery.isLoading && announcementsQuery.data?.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada pengumuman. Buat pengumuman pertama di atas.</p>}
            {announcementsQuery.data?.map((item) => (
              <article key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-bold text-foreground">{item.title}</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.message}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "published" ? "bg-emerald-500/10 text-emerald-700" : item.status === "disabled" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-700"}`}>{statusLabel(item.status)}</span></div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground"><span className="rounded-md bg-muted px-2 py-1">{audienceLabel(item.audience)}</span><span className="rounded-md bg-muted px-2 py-1">{item.placement}</span><span className="rounded-md bg-muted px-2 py-1">{new Date(item.starts_at).toLocaleString("id-ID")}</span>{item.ends_at && <span className="rounded-md bg-muted px-2 py-1">Sampai {new Date(item.ends_at).toLocaleString("id-ID")}</span>}</div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3"><button type="button" disabled={busy} onClick={() => startEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" />Edit</button>{item.status === "published" ? <button type="button" disabled={busy} onClick={() => void setAnnouncementStatus(item, "disabled")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Nonaktifkan</button> : <button type="button" disabled={busy} onClick={() => void setAnnouncementStatus(item, "published")} className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Terbitkan</button>}<button type="button" disabled={busy} onClick={() => void deleteAnnouncement(item)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" />Hapus</button></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
