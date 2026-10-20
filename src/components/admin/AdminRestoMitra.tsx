import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleUserRound, Clock3, MapPin, Plus, Search, Store, ToggleLeft, ToggleRight, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MapLocationPicker } from "@/components/MapLocationPicker";

type PartnerStatus = "pending" | "approved" | "rejected" | "inactive";
type Partner = {
  id: string;
  user_id: string | null;
  name: string;
  owner_name: string | null;
  type: string;
  address: string;
  phone_wa: string | null;
  status: string;
  commission_percent: number;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  created_at: string;
};
type Account = { id: string; full_name: string; email: string | null; phone: string };

const emptyForm = { user_id: "", name: "", owner_name: "", type: "official_merchant", address: "", phone_wa: "", latitude: "", longitude: "" };
const statusLabels: Record<string, string> = { pending: "Menunggu", approved: "Aktif", rejected: "Ditolak", inactive: "Nonaktif" };
const statusClass: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  inactive: "bg-muted text-muted-foreground",
};

export function AdminRestoMitra() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PartnerStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const partnersQuery = useQuery({
    queryKey: ["admin-merchant-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Partner[];
    },
  });
  const accountsQuery = useQuery({
    queryKey: ["admin-merchant-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
  });

  const partners = partnersQuery.data ?? [];
  const visiblePartners = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    return partners.filter((partner) => {
      const values = [partner.name, partner.owner_name ?? "", partner.type, partner.address, partner.phone_wa ?? ""];
      const matches = !term || values.some((value) => value.toLocaleLowerCase("id-ID").includes(term));
      const status = (partner.status || "pending").toLowerCase() as PartnerStatus;
      return matches && (statusFilter === "all" || status === statusFilter);
    });
  }, [partners, search, statusFilter]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-merchant-partners"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["my-merchant-application"] }),
      queryClient.invalidateQueries({ queryKey: ["my-merchant-profile"] }),
    ]);
  }

  async function setPartnerStatus(partner: Partner, nextStatus: PartnerStatus) {
    setBusy(partner.id);
    setFormError("");
    try {
      if (partner.user_id && (nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "inactive")) {
        const { error: roleError } = await supabase.rpc("admin_set_role", {
          _user_id: partner.user_id,
          _role: "mitra",
          _grant: nextStatus === "approved",
        });
        if (roleError) throw roleError;
      }
      const { error } = await supabase.from("merchants").update({ status: nextStatus }).eq("id", partner.id);
      if (error) throw error;
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Gagal memperbarui status mitra.");
    } finally {
      setBusy(null);
    }
  }

  async function createPartner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.user_id) {
      setFormError("Pilih akun pengguna yang akan menjadi pemilik mitra.");
      return;
    }
    if (!form.latitude.trim() || !form.longitude.trim()) {
      setFormError("Titik lokasi latitude dan longitude wajib diisi.");
      return;
    }
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setFormError("Koordinat tidak valid. Latitude harus -90 sampai 90 dan longitude -180 sampai 180.");
      return;
    }
    setBusy("create");
    setFormError("");
    try {
      const { error } = await supabase.from("merchants").insert({
        user_id: form.user_id,
        name: form.name.trim(),
        owner_name: form.owner_name.trim(),
        type: form.type.trim() || "official_merchant",
        address: form.address.trim(),
        phone_wa: form.phone_wa.trim(),
        latitude,
        longitude,
        status: "pending",
        commission_percent: 10,
        is_open: false,
      });
      if (error) throw error;
      setForm(emptyForm);
      setFormOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Gagal menambahkan mitra.");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = partners.filter((partner) => partner.status === "pending").length;
  const activeCount = partners.filter((partner) => partner.status === "approved").length;
  const inactiveCount = partners.filter((partner) => partner.status === "inactive" || partner.status === "rejected").length;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Manajemen Resto Mitra</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Data langsung dari Supabase. Persetujuan akan menetapkan peran mitra ke akun pemilik.</p>
        </div>
        <Button type="button" onClick={() => { setFormError(""); setForm(emptyForm); setFormOpen(true); }} className="gap-2 rounded-xl">
          <Plus className="h-4 w-4" /> Tambah Mitra
        </Button>
      </section>

      {formError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3"><p className="flex items-center justify-between text-xs text-muted-foreground">Total Mitra <Users className="h-4 w-4" /></p><p className="mt-2 text-2xl font-extrabold text-foreground">{partners.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="flex items-center justify-between text-xs text-muted-foreground">Menunggu <Clock3 className="h-4 w-4 text-amber-600" /></p><p className="mt-2 text-2xl font-extrabold text-amber-600">{pendingCount}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="flex items-center justify-between text-xs text-muted-foreground">Aktif <CheckCircle2 className="h-4 w-4 text-emerald-600" /></p><p className="mt-2 text-2xl font-extrabold text-emerald-600">{activeCount}</p><p className="mt-1 text-[11px] text-muted-foreground">{inactiveCount} ditolak/nonaktif</p></div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama resto, pemilik, alamat..." className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm" aria-label="Cari mitra" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-input bg-background px-3 py-2 text-sm" aria-label="Filter status"><option value="all">Semua status</option><option value="pending">Menunggu</option><option value="approved">Aktif</option><option value="rejected">Ditolak</option><option value="inactive">Nonaktif</option></select>
        </div>
        {partnersQuery.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Memuat data mitra...</p>}
        {partnersQuery.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Gagal memuat data mitra: {partnersQuery.error.message}</p>}
        {!partnersQuery.isLoading && !partnersQuery.isError && visiblePartners.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Belum ada data mitra untuk filter ini.</p>}
        <div className="space-y-3">
          {visiblePartners.map((partner) => {
            const status = (partner.status || "pending").toLowerCase();
            const account = accountsQuery.data?.find((item) => item.id === partner.user_id);
            return (
              <article key={partner.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-foreground">{partner.name}</h3><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[status] ?? statusClass.pending}`}>{statusLabels[status] ?? status}</span></div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CircleUserRound className="h-3.5 w-3.5" />{partner.owner_name || account?.full_name || "Pemilik belum diisi"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{account?.email || account?.phone || partner.user_id || "Akun belum terhubung"} · {partner.type}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{partner.address || "Alamat belum diisi"}{partner.latitude != null && partner.longitude != null ? ` · ${partner.latitude}, ${partner.longitude}` : " · Titik map belum diisi"}</span></p>
                    {partner.latitude != null && partner.longitude != null && <a href={`https://www.google.com/maps?q=${partner.latitude},${partner.longitude}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-primary underline">Buka titik di Google Maps ↗</a>}
                    <p className="mt-1 text-[11px] text-muted-foreground">Diajukan: {new Date(partner.created_at).toLocaleString("id-ID")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status !== "approved" && <Button type="button" size="sm" disabled={busy !== null} onClick={() => void setPartnerStatus(partner, "approved")}>{busy === partner.id ? "Memproses..." : "Setujui & Aktifkan"}</Button>}
                    {status === "pending" && <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void setPartnerStatus(partner, "rejected")}>Tolak</Button>}
                    {status === "approved" && <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void setPartnerStatus(partner, "inactive")}>{busy === partner.id ? "Memproses..." : "Nonaktifkan"}</Button>}
                    {(status === "inactive" || status === "rejected") && <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void setPartnerStatus(partner, "approved")}>Aktifkan kembali</Button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {formOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="admin-merchant-form-title" className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 id="admin-merchant-form-title" className="font-extrabold text-foreground">Tambah Mitra Resto</h3><p className="mt-1 text-xs text-muted-foreground">Pengajuan dibuat dengan status menunggu sampai disetujui.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Tutup form" onClick={() => setFormOpen(false)}><X className="h-4 w-4" /></Button></div>
          <form onSubmit={createPartner} className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Akun pemilik *<select required value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="">Pilih akun pengguna</option>{accountsQuery.data?.map((account) => <option key={account.id} value={account.id}>{account.full_name || account.email || account.phone || account.id} — {account.email || account.phone || account.id}</option>)}</select>{accountsQuery.isError && <span className="mt-1 block text-xs text-destructive">Gagal memuat akun: {accountsQuery.error.message}</span>}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-foreground">Nama resto *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>
              <label className="text-sm font-medium text-foreground">Nama pemilik *<input required value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>
              <label className="text-sm font-medium text-foreground">Tipe Mitra<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="official_merchant">Mitra Resmi</option><option value="point_resto">Point Resto</option></select></label>
              <label className="text-sm font-medium text-foreground">WhatsApp<input type="tel" value={form.phone_wa} onChange={(event) => setForm({ ...form, phone_wa: event.target.value })} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>
            </div>
            <label className="block text-sm font-medium text-foreground">Alamat *<textarea required rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-sm font-bold text-foreground">Titik lokasi map *</p>
              <MapLocationPicker
                value={form.latitude && form.longitude ? { lat: Number(form.latitude), lng: Number(form.longitude) } : null}
                onChange={(point) => setForm((current) => ({ ...current, latitude: String(point.lat), longitude: String(point.lng) }))}
                onAddressChange={(address) => setForm((current) => ({ ...current, address }))}
              />
            </div>
            {formError && <p role="alert" className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{formError}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button type="submit" disabled={busy !== null || accountsQuery.isLoading}>{busy === "create" ? "Menyimpan..." : "Simpan Mitra"}</Button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
