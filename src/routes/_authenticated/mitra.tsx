import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingBag, MapPin, ToggleLeft, ToggleRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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

  async function toggleStatus(currentIsOpen: boolean) {
    if (!merchant) return;
    const { error } = await supabase
      .from("merchants")
      .update({ is_open: !currentIsOpen })
      .eq("id", merchant.id)
      .eq("user_id", user!.id);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["my-merchant-profile", user?.id] });
  }

  if (merchantQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-4xl p-6 text-center text-sm text-muted-foreground">
          Memuat data restoran Anda...
        </main>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Anda belum memiliki profil resto. Daftarkan resto terlebih dahulu atau tunggu verifikasi pengajuan Anda.
          </p>
          <Link to="/merchant" className="mt-4 inline-block">
            <Button>Daftar Mitra Resto</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-foreground">{merchant.name}</h1>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  {merchant.type || "Resto Mitra"}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {merchant.address}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Status pengajuan: <strong>{merchant.status || "belum diketahui"}</strong></p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void toggleStatus(merchant.is_open)} className="gap-2">
            {merchant.is_open ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}
            <span>{merchant.is_open ? "Resto Buka" : "Resto Tutup"}</span>
          </Button>
        </div>

        {merchant.status !== "approved" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
            Pengajuan resto Anda masih menunggu verifikasi admin. Fitur operasional akan aktif setelah disetujui.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 py-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-3 text-sm font-bold text-foreground">Pesanan Masuk</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Setiap ada pesanan Point Resto / Mitra Food yang diarahkan ke resto Anda, rincian pesanan akan muncul di sini.
          </p>
        </div>
      </main>
    </div>
  );
}
