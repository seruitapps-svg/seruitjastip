import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bike, ChevronDown, LogOut, ShoppingBag, Store, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader() {
  const { user, isAdmin, isDriver, testRole, setSimulation } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isDriverPage = currentPath.startsWith("/driver");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  const linkCls =
    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const activeCls = "!text-primary font-bold";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black">
          <span>
            Mode Simulasi: {testRole ? `Sedang login sebagai ${testRole.toUpperCase()}` : "Superadmin Normal"}
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSimulation(null)} className="underline hover:opacity-80">
              Reset (Admin)
            </button>
            <button type="button" onClick={() => setSimulation("driver")} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
              Tes Driver
            </button>
            <button type="button" onClick={() => setSimulation("user")} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
              Tes Konsumen
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">Mider</span>
        </Link>

        {user ? (
          <nav aria-label="Navigasi utama" className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {isDriver && (
              isDriverPage ? (
                <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20" title="Pindah ke mode pemesanan">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Mode Pemesan</span>
                </Link>
              ) : (
                <Link to="/driver" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90" title="Kembali ke dashboard kerja driver">
                  <Bike className="h-3.5 w-3.5" />
                  <span>Mode Driver</span>
                </Link>
              )
            )}

            <Link to="/pesanan" className={linkCls} activeProps={{ className: activeCls }}>Pesanan</Link>
            <Link to="/saldo" className={linkCls} activeProps={{ className: activeCls }}>Saldo</Link>

            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden">
                <UserRound className="h-4 w-4" />
                <ChevronDown className="h-3.5 w-3.5" />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
                <div className="mb-2 border-b border-border px-2 pb-2 text-[11px]">
                  <span className="text-muted-foreground">Login sebagai: </span>
                  <span className="font-bold text-foreground">{isAdmin ? "Superadmin" : isDriver ? "Mitra Driver" : "Pelanggan"}</span>
                </div>

                {isDriver ? (
                  <div className="mb-1 space-y-0.5">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operasional</p>
                    <Link to="/driver" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-accent" activeProps={{ className: "text-primary bg-primary/10" }}>
                      <Bike className="h-3.5 w-3.5 text-primary" /> Dashboard Driver
                    </Link>
                    <Link to="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent">
                      <ShoppingBag className="h-3.5 w-3.5" /> Beranda Pemesanan
                    </Link>
                  </div>
                ) : (
                  <div className="mb-1 space-y-0.5">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gabung Mitra</p>
                    <Link to="/daftar-driver" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent">
                      <Bike className="h-3.5 w-3.5" /> Daftar Driver
                    </Link>
                  </div>
                )}

                <div className="mb-1 space-y-0.5 border-t border-border pt-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resto</p>
                  <Link to="/mitra" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent">
                    <Store className="h-3.5 w-3.5 text-primary" /> Dashboard Mitra Resto
                  </Link>
                  <Link to="/merchant" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                    Daftar Mitra Resto Baru
                  </Link>
                </div>

                {isAdmin && (
                  <div className="mb-1 border-t border-border pt-1">
                    <Link to="/admin" className="block rounded-lg px-2.5 py-2 text-xs font-bold text-foreground hover:bg-accent" activeProps={{ className: "text-primary" }}>
                      ⚙️ Panel Superadmin
                    </Link>
                  </div>
                )}

                <div className="border-t border-border pt-1">
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-destructive hover:bg-destructive/10">
                    <LogOut className="h-3.5 w-3.5" /> Keluar Akun
                  </button>
                </div>
              </div>
            </details>
          </nav>
        ) : (
          <div className="ml-auto">
            <Link to="/auth" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Masuk</Link>
          </div>
        )}
      </div>
    </header>
  );
}
