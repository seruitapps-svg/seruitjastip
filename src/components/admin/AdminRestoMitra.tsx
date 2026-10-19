import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Eye,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Store,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PartnerStatus = "Aktif" | "Menunggu" | "Nonaktif";

type Partner = {
  id: string;
  name: string;
  owner: string;
  category: string;
  address: string;
  phone: string;
  status: PartnerStatus;
  commission: number;
  joinedAt: string;
};

const previewPartners: Partner[] = [
  {
    id: "preview-1",
    name: "Resto Contoh",
    owner: "Pemilik Contoh",
    category: "Makanan Nusantara",
    address: "Alamat mitra akan ditampilkan di sini",
    phone: "",
    status: "Aktif",
    commission: 10,
    joinedAt: "—",
  },
  {
    id: "preview-2",
    name: "Warung Contoh",
    owner: "Pemilik Contoh",
    category: "Warung & Kafe",
    address: "Alamat mitra akan ditampilkan di sini",
    phone: "",
    status: "Menunggu",
    commission: 10,
    joinedAt: "—",
  },
];

const emptyForm = {
  name: "",
  owner: "",
  category: "",
  address: "",
  phone: "",
  status: "Menunggu" as PartnerStatus,
  commission: "10",
};

const statusClass: Record<PartnerStatus, string> = {
  Aktif: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Menunggu: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Nonaktif: "bg-muted text-muted-foreground",
};

export function AdminRestoMitra() {
  const [partners, setPartners] = useState<Partner[]>(previewPartners);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Semua" | PartnerStatus>("Semua");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const visiblePartners = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return partners.filter((partner) => {
      const matchesSearch =
        !query ||
        [partner.name, partner.owner, partner.category, partner.address]
          .some((value) => value.toLocaleLowerCase("id-ID").includes(query));
      return matchesSearch && (statusFilter === "Semua" || partner.status === statusFilter);
    });
  }, [partners, search, statusFilter]);

  const activeCount = partners.filter((partner) => partner.status === "Aktif").length;
  const pendingCount = partners.filter((partner) => partner.status === "Menunggu").length;
  const inactiveCount = partners.filter((partner) => partner.status === "Nonaktif").length;

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(partner: Partner) {
    setEditingId(partner.id);
    setForm({
      name: partner.name,
      owner: partner.owner,
      category: partner.category,
      address: partner.address,
      phone: partner.phone,
      status: partner.status,
      commission: String(partner.commission),
    });
    setFormError("");
    setDetail(null);
    setFormOpen(true);
  }

  function savePartner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.owner.trim()) {
      setFormError("Nama resto dan nama pemilik wajib diisi.");
      return;
    }

    const partnerData = {
      name: form.name.trim(),
      owner: form.owner.trim(),
      category: form.category.trim() || "Belum ditentukan",
      address: form.address.trim() || "Alamat belum diisi",
      phone: form.phone.trim(),
      status: form.status,
      commission: Math.max(0, Number(form.commission) || 0),
    };

    if (editingId) {
      setPartners((current) =>
        current.map((partner) =>
          partner.id === editingId ? { ...partner, ...partnerData } : partner,
        ),
      );
    } else {
      setPartners((current) => [
        {
          id: `preview-${Date.now()}`,
          ...partnerData,
          joinedAt: "—",
        },
        ...current,
      ]);
    }
    setFormOpen(false);
  }

  function toggleStatus(partner: Partner) {
    const nextStatus: PartnerStatus = partner.status === "Aktif" ? "Nonaktif" : "Aktif";
    setPartners((current) =>
      current.map((item) => item.id === partner.id ? { ...item, status: nextStatus } : item),
    );
    setDetail((current) => current?.id === partner.id ? { ...current, status: nextStatus } : current);
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-4 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground">Manajemen Resto Mitra</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Kelola profil, status kemitraan, dan informasi restoran yang bergabung dengan Mider.
              </p>
            </div>
          </div>
          <Button onClick={openCreateForm} className="w-full gap-2 rounded-xl sm:w-auto">
            <Plus className="h-4 w-4" /> Tambah Mitra
          </Button>
        </div>
        <div className="border-t border-border px-4 py-2.5 sm:px-5">
          <p className="text-[11px] text-muted-foreground">
            Pratinjau UI — data contoh tersimpan sementara di tampilan ini dan belum terhubung ke database.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            Total Mitra <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">{partners.length}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Semua terdaftar</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            Aktif <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">{activeCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Mitra aktif</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            Menunggu <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600">{pendingCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Perlu ditinjau</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            Nonaktif <ToggleLeft className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">{inactiveCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Tidak beroperasi</div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama resto, pemilik, kategori, alamat..."
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Cari mitra resto"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" aria-label="Filter status mitra">
            {(["Semua", "Aktif", "Menunggu", "Nonaktif"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${statusFilter === status ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {visiblePartners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <Store className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-semibold text-foreground">Mitra tidak ditemukan</p>
            <p className="mt-1 text-xs text-muted-foreground">Ubah kata pencarian atau filter status.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visiblePartners.map((partner) => (
              <article key={partner.id} className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/20 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-foreground">{partner.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[partner.status]}`}>
                          {partner.status}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CircleUserRound className="h-3.5 w-3.5 shrink-0" /> {partner.owner}
                        <span className="text-border">•</span> {partner.category}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{partner.address}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => setDetail(partner)}>
                      <Eye className="h-3.5 w-3.5" /> Detail
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => openEditForm(partner)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-lg"
                      onClick={() => toggleStatus(partner)}
                    >
                      {partner.status === "Aktif" ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      {partner.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resto-mitra-form-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 id="resto-mitra-form-title" className="text-base font-extrabold text-foreground">{editingId ? "Edit Mitra" : "Tambah Mitra Resto"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Form UI pratinjau; belum menyimpan ke server.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Tutup form" onClick={() => setFormOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            {formError && <p className="mb-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{formError}</p>}
            <form onSubmit={savePartner} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">Nama resto *
                  <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" placeholder="Nama restoran" />
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">Nama pemilik *
                  <input required value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" placeholder="Nama pemilik / penanggung jawab" />
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">Kategori
                  <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" placeholder="Contoh: Makanan Nusantara" />
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">Nomor telepon
                  <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" placeholder="Nomor kontak mitra" />
                </label>
              </div>
              <label className="block space-y-1 text-xs font-medium text-muted-foreground">Alamat resto
                <textarea rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" placeholder="Alamat lengkap resto" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">Status kemitraan
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PartnerStatus })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground">
                    <option>Menunggu</option><option>Aktif</option><option>Nonaktif</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">Komisi (%) — pratinjau
                  <input type="number" min="0" max="100" value={form.commission} onChange={(event) => setForm({ ...form, commission: event.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
                </label>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
                <Button type="submit">{editingId ? "Simpan Perubahan (Lokal)" : "Tambah Mitra (Lokal)"}</Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resto-mitra-detail-title" className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="h-6 w-6" /></div>
                <div>
                  <h3 id="resto-mitra-detail-title" className="font-extrabold text-foreground">{detail.name}</h3>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[detail.status]}`}>{detail.status}</span>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Tutup detail" onClick={() => setDetail(null)}><X className="h-4 w-4" /></Button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Pemilik / Penanggung Jawab</dt><dd className="mt-1 font-medium text-foreground">{detail.owner}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Kategori</dt><dd className="mt-1 font-medium text-foreground">{detail.category}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Alamat</dt><dd className="mt-1 flex gap-2 font-medium text-foreground"><MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />{detail.address}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Kontak</dt><dd className="mt-1 flex gap-2 font-medium text-foreground"><Phone className="h-4 w-4 shrink-0 text-muted-foreground" />{detail.phone || "Belum diisi"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Komisi pratinjau</dt><dd className="mt-1 font-medium text-foreground">{detail.commission}%</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => toggleStatus(detail)}>{detail.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}</Button>
              <Button type="button" onClick={() => openEditForm(detail)}>Edit Mitra</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
