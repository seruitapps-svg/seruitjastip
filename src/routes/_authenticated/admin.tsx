import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { KeyRound, Trash2, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { OrderCard, btnPrimary, btnDanger, btnOutline } from "@/components/order/OrderCard";
import { useAuth } from "@/hooks/use-auth";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Seruit" },
      { name: "description", content: "Verifikasi pesanan dan kelola akun driver Seruit." },
      { property: "og:title", content: "Dashboard Admin — Seruit" },
      { property: "og:description", content: "Verifikasi pesanan Seruit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const FILTERS: Array<OrderStatus | "aktif" | "semua"> = ["menunggu_verifikasi", "aktif", "selesai", "dibatalkan", "semua"];

function AdminPage() {
  const { isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"order" | "akun" | "driver_approval" | "tarif">("order");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("menunggu_verifikasi");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const orders = useQuery({
    queryKey: ["admin-orders", filter],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter === "aktif") q = q.in("status", ["tersedia", "diambil", "dijemput", "diantar"]);
      else if (filter !== "semua") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const settings = useQuery({
    queryKey: ["app-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("commission_percent").eq("id", 1).single();
      if (error) throw error;
      return Number(data.commission_percent);
    },
  });
  const [pct, setPct] = useState("");
  const [openWallet, setOpenWallet] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    enabled: isAdmin && tab === "akun",
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return p.data.map((x) => ({ ...x, roles: r.data.filter((y) => y.user_id === x.id).map((y) => y.role) }));
    },
  });

  const driverRegistrations = useQuery({
    queryKey: ["admin-driver-registrations"],
    enabled: isAdmin && tab === "driver_approval",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleResetPassword(email: string | null) {
    if (!email) {
      window.alert("User tidak memiliki email.");
      return;
    }
    if (!window.confirm(`Kirimkan link reset password ke ${email}?`)) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) window.alert("Gagal mengirim link: " + error.message);
    else window.alert("Link reset password berhasil dikirim ke " + email);
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!window.confirm(`PERINGATAN: Yakin ingin menghapus permanen akun "${name}"? Semua data terkait akun ini akan dihapus.`)) return;
    setBusy(userId);
    const { error } = await supabase.rpc("admin_delete_user", { _target_user_id: userId });
    setBusy(null);
    if (error) {
      window.alert("Gagal menghapus: " + error.message);
      return;
    }
    window.alert("Akun berhasil dihapus.");
    setSelectedUser(null);
    await qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    await qc.invalidateQueries({ queryKey: ["admin-orders"] });
    await qc.invalidateQueries({ queryKey: ["admin-driver-registrations"] });
  }

  async function handleDeleteOrder(orderId: string, code: string) {
    if (!window.confirm(`Hapus permanen pesanan #${code} dari riwayat?`)) return;
    setBusy(orderId);
    const { error } = await supabase.rpc("admin_delete_order", { _order_id: orderId });
    setBusy(null);
    if (error) {
      window.alert("Gagal menghapus pesanan: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-orders"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin, qc]);

  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key);
    setErr("");
    const { error } = await fn();
    setBusy(null);
    if (error) return setErr(error.message);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    qc.invalidateQueries({ queryKey: ["admin-driver-registrations"] });
    qc.invalidateQueries({ queryKey: ["app-settings"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
  }

  if (ready && !isAdmin)
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Halaman ini khusus superadmin.</p>
      </div>
    );

  const tabCls = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-xl font-extrabold text-foreground">Dashboard Admin</h1>
        <div className="flex gap-2">
          <button className={tabCls(tab === "order")} onClick={() => setTab("order")}>Pesanan</button>
          <button className={tabCls(tab === "akun")} onClick={() => setTab("akun")}>Akun & peran</button>
          <button className={tabCls(tab === "driver_approval")} onClick={() => setTab("driver_approval")}>Pendaftaran Driver</button>
          <button className={tabCls(tab === "tarif")} onClick={() => setTab("tarif")}>Biaya aplikasi</button>
        </div>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        {tab === "order" && (
          <>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button key={f} className={tabCls(filter === f)} onClick={() => setFilter(f)}>
                  {f === "aktif" ? "Sedang berjalan" : f === "semua" ? "Semua" : STATUS_LABEL[f as OrderStatus]}
                </button>
              ))}
            </div>
            {orders.data?.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pesanan.</p>}
            {orders.data?.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                actions={
                  o.status === "menunggu_verifikasi" ? (
                    <>
                      <button
                        className={btnPrimary}
                        disabled={busy === o.id}
                        onClick={() => run(o.id, () => supabase.rpc("admin_review_order", { _order_id: o.id, _approve: true }))}
                      >
                        Setujui → pool driver
                      </button>
                      <button
                        className={btnDanger}
                        disabled={busy === o.id}
                        onClick={() => {
                          const note = window.prompt("Alasan penolakan (opsional)") ?? "";
                          run(o.id, () => supabase.rpc("admin_review_order", { _order_id: o.id, _approve: false, _note: note }));
                        }}
                      >
                        Tolak
                      </button>
                    </>
                  ) : ["tersedia", "diambil", "dijemput", "diantar"].includes(o.status) ? (
                    <button
                      className={btnDanger}
                      disabled={busy === o.id}
                      onClick={() => {
                        if (!window.confirm("Batalkan pesanan ini?")) return;
                        run(o.id, () => supabase.rpc("cancel_order", { _order_id: o.id }));
                      }}
                    >
                      Batalkan
                    </button>
                  ) : ["selesai", "dibatalkan"].includes(o.status) ? (
                    <button
                      className={btnDanger}
                      disabled={busy === o.id}
                      onClick={() => handleDeleteOrder(o.id, o.code)}
                    >
                      Hapus riwayat
                    </button>
                  ) : undefined
                }
              />
            ))}
          </>
        )}

        {tab === "tarif" && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-foreground">
              Potongan saat ini: <b>{settings.data ?? "…"}%</b> dari total ongkir tiap order, dipotong dari saldo driver saat order diambil
              (dikembalikan bila order dibatalkan).
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="mis. 10"
                className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                className={btnPrimary}
                disabled={busy === "pct" || pct === ""}
                onClick={() => run("pct", () => supabase.rpc("admin_set_commission", { _percent: Number(pct) })).then(() => setPct(""))}
              >
                Simpan %
              </button>
            </div>
          </div>
        )}

        {tab === "driver_approval" && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Permohonan Menjadi Driver</h2>
            {driverRegistrations.isLoading && (
              <p className="text-sm text-muted-foreground">Memuat data pendaftaran...</p>
            )}
            {driverRegistrations.isError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Gagal memuat pendaftaran driver: {driverRegistrations.error.message}
              </p>
            )}
            {!driverRegistrations.isLoading && !driverRegistrations.isError && driverRegistrations.data?.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Belum ada pendaftaran driver.
              </p>
            )}
            <div className="space-y-3">
              {driverRegistrations.data?.map((item) => (
                <div key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-bold text-foreground">{item.full_name}</h3>
                      <p className="break-words text-xs text-muted-foreground">WhatsApp: {item.phone}</p>
                      <p className="break-words text-xs text-muted-foreground">NIK: {item.nik}</p>
                      <p className="text-xs text-muted-foreground">
                        Kendaraan: {item.vehicle_type} ({item.vehicle_plate})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mendaftar: {new Date(item.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <span
                      className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (
                        item.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : item.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                    {[
                      { label: "KTP", url: item.photo_ktp },
                      { label: "SIM", url: item.photo_sim },
                      { label: "Kendaraan", url: item.photo_vehicle },
                      { label: "Swafoto Driver", url: item.photo_selfie },
                    ].map((doc) => (
                      <div key={doc.label} className="min-w-0 space-y-1">
                        <span className="text-xs text-muted-foreground">{doc.label}</span>
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={doc.url}
                              alt={doc.label}
                              loading="lazy"
                              className="h-24 w-full rounded border border-border object-cover transition hover:opacity-80"
                            />
                          </a>
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded bg-muted px-1 text-center text-xs text-muted-foreground">
                            Foto tidak tersedia
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <button
                        disabled={busy !== null}
                        className={btnPrimary}
                        onClick={() =>
                          run("approve-driver-" + item.id, async () => {
                            const { error } = await supabase
                              .from("driver_profiles")
                              .update({ status: "approved" })
                              .eq("id", item.id);
                            return { error };
                          })
                        }
                      >
                        {busy === "approve-driver-" + item.id ? "Menyetujui..." : "Setujui Driver"}
                      </button>
                      <button
                        disabled={busy !== null}
                        className={btnDanger}
                        onClick={() =>
                          run("reject-driver-" + item.id, async () => {
                            const { error } = await supabase
                              .from("driver_profiles")
                              .update({ status: "rejected" })
                              .eq("id", item.id);
                            return { error };
                          })
                        }
                      >
                        {busy === "reject-driver-" + item.id ? "Menolak..." : "Tolak"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "akun" && (
          <div className="space-y-3">
            {accounts.isLoading && <p className="text-sm text-muted-foreground">Memuat akun...</p>}
            {accounts.isError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Gagal memuat akun: {accounts.error.message}</p>}
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {accounts.data?.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {u.full_name?.charAt(0) || u.email?.charAt(0) || "U"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{u.full_name || "Tanpa Nama"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email || u.phone || "Tidak ada kontak"}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{u.roles?.join(", ") || "user"}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </button>
              ))}
            </div>

            {selectedUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
                <div role="dialog" aria-modal="true" aria-labelledby="account-detail-title" className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 id="account-detail-title" className="text-lg font-bold text-foreground">Detail Profil Pengguna</h3>
                    <button type="button" onClick={() => setSelectedUser(null)} className="rounded-lg p-1 hover:bg-muted" aria-label="Tutup detail profil">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-2 break-words text-sm">
                    <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{selectedUser.id}</span></div>
                    <div><span className="text-muted-foreground">Nama:</span> <strong className="text-foreground">{selectedUser.full_name || "-"}</strong></div>
                    <div><span className="text-muted-foreground">Email:</span> <strong className="text-foreground">{selectedUser.email || "-"}</strong></div>
                    <div><span className="text-muted-foreground">Telepon:</span> <span>{selectedUser.phone || "-"}</span></div>
                    <div><span className="text-muted-foreground">Peran:</span> <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{selectedUser.roles?.join(", ") || "user"}</span></div>
                    <div><span className="text-muted-foreground">Terdaftar:</span> <span>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("id-ID") : "-"}</span></div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <button type="button" onClick={() => handleResetPassword(selectedUser.email)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                      <KeyRound className="h-4 w-4" /> Kirim Link Reset Password
                    </button>
                    <button type="button" disabled={busy === selectedUser.id} onClick={() => handleDeleteUser(selectedUser.id, selectedUser.full_name || selectedUser.email || selectedUser.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" /> Hapus Akun Ini
                    </button>
                  </div>
                  {(() => {
                    const isDrv = selectedUser.roles.includes("driver");
                    const isAdm = selectedUser.roles.includes("superadmin");
                    return (
                      <div className="space-y-2 border-t border-border pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kelola Peran</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={isDrv ? btnDanger : btnOutline} disabled={busy === selectedUser.id} onClick={() => run(selectedUser.id, () => supabase.rpc("admin_set_role", { _user_id: selectedUser.id, _role: "driver", _grant: !isDrv }))}>{isDrv ? "Cabut driver" : "Jadikan driver"}</button>
                          <button type="button" className={isAdm ? btnDanger : btnOutline} disabled={busy === selectedUser.id} onClick={() => run(selectedUser.id, () => supabase.rpc("admin_set_role", { _user_id: selectedUser.id, _role: "superadmin", _grant: !isAdm }))}>{isAdm ? "Cabut admin" : "Jadikan admin"}</button>
                          {isDrv && <button type="button" className={btnOutline} onClick={() => setOpenWallet(openWallet === selectedUser.id ? null : selectedUser.id)}>Saldo</button>}
                        </div>
                        {openWallet === selectedUser.id && isDrv && (
                          <div className="space-y-2">
                            <WalletPanel driverId={selectedUser.id} />
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className={btnPrimary} disabled={busy === selectedUser.id} onClick={() => {
                                const v = Number(window.prompt("Nominal top-up (Rp)") ?? "");
                                if (!v) return;
                                run(selectedUser.id, () => supabase.rpc("admin_adjust_wallet", { _driver_id: selectedUser.id, _amount: Math.round(v), _note: "Top-up admin" }));
                              }}>Top-up</button>
                              <button type="button" className={btnOutline} disabled={busy === selectedUser.id} onClick={() => {
                                const v = Number(window.prompt("Penyesuaian (Rp, pakai minus untuk mengurangi, mis. -5000)") ?? "");
                                if (!v) return;
                                const note = window.prompt("Keterangan") ?? "";
                                run(selectedUser.id, () => supabase.rpc("admin_adjust_wallet", { _driver_id: selectedUser.id, _amount: Math.round(v), _note: note }));
                              }}>Sesuaikan</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
