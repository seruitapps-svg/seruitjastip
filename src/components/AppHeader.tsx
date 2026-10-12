import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bike, LogOut } from "lucide-react";
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
    "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
  const activeCls = "!text-primary";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black">
          <span>Mode Simulasi: {testRole ? `Sedang login sebagai ${testRole.toUpperCase()}` : "Superadmin Normal"}</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSimulation(null)} className="underline hover:opacity-80">Reset (Admin)</button>
            <button onClick={() => setSimulation("driver")} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">Tes Driver</button>
            <button onClick={() => setSimulation("user")} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">Tes Konsumen</button>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">Seruit</span>
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-1">
          {user ? (
            <>
              <Link to="/pesanan" className={linkCls} activeProps={{ className: activeCls }}>
                Pesanan
              </Link>
              {!isDriver && (
                <Link to="/daftar-driver" className={linkCls} activeProps={{ className: activeCls }}>
                  Daftar Driver
                </Link>
              )}
              {isDriver && (
                <Link to="/driver" className={linkCls} activeProps={{ className: activeCls }}>
                  Driver
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>
                  Admin
                </Link>
              )}
              <button onClick={signOut} className={linkCls} aria-label="Keluar">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Masuk
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
