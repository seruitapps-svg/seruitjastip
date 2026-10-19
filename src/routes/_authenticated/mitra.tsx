import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bike,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  ClipboardList,
  ImagePlus,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Store,
  ToggleLeft,
  ToggleRight,
  Utensils,
  Wallet,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mitra")({
  head: () => ({
    meta: [
      { title: "Dashboard Resto Mitra — Mider" },
      { name: "description", content: "Pratinjau dashboard mitra restoran Mider." },
    ],
  }),
  component: MitraDashboardPage,
});

type DashboardTab = "ringkasan" | "pesanan" | "menu" | "profil";

const sampleOrders = [
  { code: "MR-001", customer: "Pelanggan Contoh A", items: "Nasi ayam × 1, Es teh × 1", total: 28000, status: "Perlu dikonfirmasi", time: "10.24" },
  { code: "MR-002", customer: "Pelanggan Contoh B", items: "Nasi goreng × 2", total: 36000, status: "Sedang disiapkan", time: "10.18" },
  { code: "MR-003", customer: "Pelanggan Contoh C", items: "Mie ayam × 1", total: 18000, status: "Siap diambil", time: "10.05" },
];

const sampleMenu = [
  { name: "Nasi Ayam", category: "Menu utama", price: "Rp18.000", available: true },
  { name: "Nasi Goreng Spesial", category: "Menu utama", price: "Rp18.000", available: true },
  { name: "Es Teh", category: "Minuman", price: "Rp10.000", available: false },
];

const orderStatusClass: Record<string, string> = {
  "Perlu dikonfirmasi": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "Sedang disiapkan": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Siap diambil": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

function MitraDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("ringkasan");
  const [isOpen, setIsOpen] = useState(true);
  const [orders, setOrders] = useState(sampleOrders);
  const [menu, setMenu] = useState(sampleMenu);
  const [menuSearch, setMenuSearch] = useState("");
  const [restaurantName, setRestaurantName] = useState("Resto Mitra Contoh");
  const [ownerName, setOwnerName] = useState("Nama Pemilik");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("Alamat restoran akan ditampilkan di sini");
  const [profileSaved, setProfileSaved] = useState(false);
  const [notice, setNotice] = useState("");

  function advanceOrder(code: string) {
    setOrders((current) =>
      current.map((order) => {
        if (order.code !== code) return order;
        const next = order.status === "Perlu dikonfirmasi"
          ? "Sedang disiapkan"
          : order.status === "Sedang disiapkan"
            ? "Siap diambil"
            : "Selesai";
        return { ...order, status: next };
      }),
    );
    setNotice("Status pesanan contoh diperbarui secara lokal.");
  }

  function toggleMenuItem(name: string) {
    setMenu((current) => current.map((item) => item.name === name ? { ...item, available: !item.available } : item));
  }

  const pendingCount = orders.filter((order) => order.status === "Perlu dikonfirmasi").length;
  const filteredMenu = menu.filter((item) => item.name.toLocaleLowerCase("id-ID").includes(menuSearch.toLocaleLowerCase("id-ID")));

  return (
    <div className="min-h-screen bg-background pb-10">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:py-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Store className="h-4 w-4" /> MODE RESTO MITRA
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">Dashboard Mitra</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pantau pesanan dan kelola tampilan restoran Anda.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-border bg-card px-3 py-2">
            <div className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            <span className="text-xs font-semibold text-foreground">{isOpen ? "Restoran buka" : "Restoran tutup"}</span>
            <button
              type="button"
              onClick={() => { setIsOpen((open) => !open); setNotice("Status buka/tutup hanya berubah pada pratinjau ini."); }}
              className="ml-1 text-primary"
              aria-label={isOpen ? "Tutup restoran pada pratinjau" : "Buka restoran pada pratinjau"}
            >
              {isOpen ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">Pratinjau UI.</span> Informasi, pesanan, menu, dan perubahan di halaman ini adalah data contoh sementara. Belum tersambung ke database atau sistem pesanan.
        </div>

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} className="font-semibold text-foreground">Tutup</button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Utensils className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-extrabold text-foreground">{restaurantName}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{address}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Status kemitraan: <span className="font-bold text-emerald-600">Contoh — Aktif</span></p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setActiveTab("profil")}><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit profil</span><span className="sm:hidden">Edit</span></Button>
          </div>
          <div className="grid grid-cols-3 border-t border-border bg-muted/20">
            <div className="p-3 text-center sm:p-4"><p className="text-[11px] text-muted-foreground">ID Mitra</p><p className="mt-1 text-sm font-bold text-foreground">Preview</p></div>
            <div className="border-x border-border p-3 text-center sm:p-4"><p className="text-[11px] text-muted-foreground">Kategori</p><p className="mt-1 text-sm font-bold text-foreground">Kuliner</p></div>
            <div className="p-3 text-center sm:p-4"><p className="text-[11px] text-muted-foreground">Jam operasional</p><p className="mt-1 text-sm font-bold text-foreground">Belum diatur</p></div>
          </div>
        </section>

        <nav className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-muted/40 p-1" aria-label="Navigasi dashboard mitra">
          {([
            { id: "ringkasan", label: "Ringkasan", icon: Wallet },
            { id: "pesanan", label: "Pesanan", icon: ClipboardList },
            { id: "menu", label: "Menu", icon: Utensils },
            { id: "profil", label: "Profil", icon: Settings2 },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-xs ${activeTab === tab.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />{tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "ringkasan" && (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Pesanan hari ini", value: "12", detail: "+3 dari kemarin", icon: ShoppingBag, up: true },
                { label: "Perlu dikonfirmasi", value: String(pendingCount), detail: "Perlu tindakan", icon: Clock3, up: false },
                { label: "Omzet hari ini", value: "Rp428.000", detail: "Data contoh", icon: Wallet, up: true },
                { label: "Menu tersedia", value: String(menu.filter((item) => item.available).length), detail: `dari ${menu.length} menu contoh`, icon: Utensils, up: true },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{metric.label}</span><Icon className="h-4 w-4 shrink-0" /></div>
                    <p className="mt-3 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{metric.value}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">{metric.up ? <ArrowUpRight className="h-3 w-3 text-emerald-600" /> : <ArrowDownRight className="h-3 w-3 text-amber-600" />}{metric.detail}</p>
                  </div>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <div><h2 className="text-sm font-extrabold text-foreground">Pesanan terbaru</h2><p className="mt-1 text-xs text-muted-foreground">Contoh alur pesanan mitra</p></div>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setActiveTab("pesanan")}>Semua pesanan <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="divide-y divide-border">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.code} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><ShoppingBag className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-foreground">#{order.code}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${orderStatusClass[order.status] ?? "bg-muted text-muted-foreground"}`}>{order.status}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{order.items}</p></div>
                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><p className="text-sm font-extrabold text-foreground">Rp{order.total.toLocaleString("id-ID")}</p><p className="text-[11px] text-muted-foreground">{order.time}</p></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setActiveTab("menu")} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Utensils className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">Kelola menu</p><p className="mt-1 text-xs text-muted-foreground">Lihat ketersediaan menu contoh</p></div><ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button type="button" onClick={() => setActiveTab("profil")} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">Profil restoran</p><p className="mt-1 text-xs text-muted-foreground">Pratinjau informasi usaha</p></div><ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </section>
          </div>
        )}

        {activeTab === "pesanan" && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-4"><h2 className="text-sm font-extrabold text-foreground">Daftar pesanan</h2><p className="mt-1 text-xs text-muted-foreground">Ubah status untuk mencoba alur UI; tidak mengirim pembaruan ke server.</p></div>
            {orders.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Belum ada pesanan contoh.</div> : (
              <div className="divide-y divide-border">
                {orders.map((order) => (
                  <article key={order.code} className="space-y-3 p-4">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><PackageCheck className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-foreground">#{order.code}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${orderStatusClass[order.status] ?? "bg-muted text-muted-foreground"}`}>{order.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{order.customer} · {order.time}</p><p className="mt-1 text-xs text-foreground">{order.items}</p></div><button type="button" aria-label={`Opsi pesanan ${order.code}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button></div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="text-sm font-extrabold text-foreground">Rp{order.total.toLocaleString("id-ID")}</p>{order.status !== "Selesai" && <Button type="button" size="sm" onClick={() => advanceOrder(order.code)}>{order.status === "Perlu dikonfirmasi" ? "Konfirmasi pesanan" : order.status === "Sedang disiapkan" ? "Tandai siap diambil" : "Tandai selesai"}</Button>}</div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "menu" && (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold text-foreground">Menu restoran</h2><p className="mt-1 text-xs text-muted-foreground">Pratinjau katalog dan ketersediaan menu.</p></div><Button type="button" className="gap-1.5" onClick={() => setNotice("Form tambah menu akan diintegrasikan pada tahap backend/menu berikutnya.")}><Plus className="h-4 w-4" /> Tambah menu</Button></div>
            <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Cari menu..." className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
            {filteredMenu.map((item) => (
              <article key={item.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><ImagePlus className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-foreground">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.price}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.available ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>{item.available ? "Tersedia" : "Tidak tersedia"}</span></div>
                <Button type="button" variant="outline" size="sm" onClick={() => toggleMenuItem(item.name)}>{item.available ? "Nonaktifkan" : "Aktifkan"}</Button>
              </article>
            ))}
            {filteredMenu.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Menu tidak ditemukan.</p>}
          </section>
        )}

        {activeTab === "profil" && (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div><h2 className="text-sm font-extrabold text-foreground">Profil restoran</h2><p className="mt-1 text-xs text-muted-foreground">Edit data contoh untuk melihat rancangan form profil.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">Nama restoran<input value={restaurantName} onChange={(event) => { setRestaurantName(event.target.value); setProfileSaved(false); }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal text-foreground" /></label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">Nama pemilik<input value={ownerName} onChange={(event) => { setOwnerName(event.target.value); setProfileSaved(false); }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal text-foreground" /></label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">Nomor kontak<input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setProfileSaved(false); }} placeholder="Nomor telepon usaha" className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal text-foreground" /></label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">Alamat restoran<textarea rows={2} value={address} onChange={(event) => { setAddress(event.target.value); setProfileSaved(false); }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal text-foreground" /></label>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] text-muted-foreground">Jam operasional, rekening, dan dokumen usaha akan dirancang setelah kebutuhan backend dikonfirmasi.</p><Button type="button" onClick={() => { setProfileSaved(true); setNotice("Profil contoh disimpan sementara di tampilan ini."); }} className="gap-2"><Check className="h-4 w-4" /> Simpan pratinjau</Button></div>
            {profileSaved && <p className="rounded-lg bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Perubahan profil contoh tersimpan sementara.</p>}
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><CircleHelp className="h-3.5 w-3.5" /> Pusat bantuan (pratinjau)</span>
          <span className="flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> Notifikasi (pratinjau)</span>
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Jadwal operasional (pratinjau)</span>
          <span className="flex items-center gap-1"><Bike className="h-3.5 w-3.5" /> Mider</span>
        </footer>
      </main>
    </div>
  );
}
