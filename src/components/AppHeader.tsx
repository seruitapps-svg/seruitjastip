import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bike, ChevronDown, LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader() {
  const { user, isAdmin, isDriver, testRole, setSimulation } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkCls =
    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const activeCls = "!text-primary";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black">
          <span>
            Mode Simulasi: {testRole ? `Sedang login sebagai ${testRole.toUpperCase()}` : "Superadmin Normal"}
          </span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSimulation(null)} className="underline hover:opacity-80">
              Reset (Admin)
            </button>
            <button onClick={() => setSimulation("driver")} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
              Tes Driver
            </button>
            <button onClick={() => setSimulation("user")} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
              Tes Konsumen
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">Mider</span>
        </Link>

        {user ? (
          <nav aria-label="Navigasi utama" className="ml-auto flex items-center gap-1">
            <Link to="/pesanan" className={linkCls} activeProps={{ className: activeCls }}>
              Pesanan
            </Link>
            <Link to="/saldo" className={linkCls} activeProps={{ className: activeCls }}>
              Saldo
            </Link>

            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden">
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">Akun & Layanan</span>
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                {!isDriver && (
                  <Link
                    to="/daftar-driver"
                    className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent"
                    activeProps={{ className: "text-primary" }}
                  >
                    Daftar Driver
                  </Link>
                )}
                {isDriver && (
                  <Link
                    to="/driver"
                    className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent"
                    activeProps={{ className: "text-primary" }}
                  >
                    Mode Driver
                  </Link>
                )}
                <Link
                  to="/merchant"
                  className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent"
                  activeProps={{ className: "text-primary" }}
                >
                  Daftar Mitra Resto
                </Link>
                <Link
                  to="/mitra"
                  className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent"
                  activeProps={{ className: "text-primary" }}
                >
                  Mode Mitra Resto
                </Link>
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <Link
                      to="/admin"
                      className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent"
                      activeProps={{ className: "text-primary" }}
                    >
                      Admin
                    </Link>
                  </>
                )}
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </div>
            </details>
          </nav>
        ) : (
          <div className="ml-auto">
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Masuk
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
