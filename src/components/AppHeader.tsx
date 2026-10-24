import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bike, ChevronDown, LogOut, ShoppingBag, Store, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppAnnouncements } from "@/components/AppAnnouncements";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { unregisterCurrentPushToken } from "@/lib/push-notifications";

export function AppHeader() {
  const { user, isAdmin, isDriver, isMitra, isCustomerOnly } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  type AppBranding = { app_name: string; logo_url: string | null; favicon_url: string | null };
  const brandingCacheKey = "mider-app-branding";

  function readCachedBranding(): AppBranding | null {
    if (typeof window === "undefined") return null;
    try {
      const cached = window.localStorage.getItem(brandingCacheKey);
      return cached ? (JSON.parse(cached) as AppBranding) : null;
    } catch {
      return null;
    }
  }

  const branding = useQuery({
    queryKey: ["app-branding"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_branding")
        .select("app_name,logo_url,favicon_url")
        .eq("id", 1)
        .maybeSingle();

      if (error) return readCachedBranding();

      const nextBranding = data as AppBranding | null;
      if (nextBranding && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(brandingCacheKey, JSON.stringify(nextBranding));
        } catch {
          // Logo tetap bisa ditampilkan meskipun penyimpanan browser tidak tersedia.
        }
      }
      return nextBranding;
    },
    initialData: () => readCachedBranding() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60000,
  });

  useEffect(() => {
    const url = branding.data?.favicon_url;
    if (!url) return;
    let icon = document.querySelector<HTMLLinkElement>("link[rel=icon]");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = url;
  }, [branding.data?.favicon_url]);

  async function signOut() {
    await queryClient.cancelQueries();
    if (user?.id) {
      await unregisterCurrentPushToken(user.id);
    }
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkCls =
    "rounded-md px-2 py-2 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const dashboardPath = isAdmin ? "/admin" : isDriver ? "/driver" : isMitra ? "/mitra" : "/";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
          <Link to={dashboardPath} className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary">
              {branding.data?.logo_url ? (
                <img src={branding.data.logo_url} alt="" className="h-full w-full object-contain bg-card" />
              ) : (
                <Bike className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">{branding.data?.app_name || "Mider"}</span>
          </Link>

          {user ? (
            <nav aria-label="Navigasi utama" className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
              <Link to="/pesanan" className={linkCls} activeProps={{ className: "!text-primary font-bold" }}>
                <span className="whitespace-nowrap">Pesanan</span>
              </Link>
              <Link to="/saldo" className={linkCls} activeProps={{ className: "!text-primary font-bold" }}>
                <span className="whitespace-nowrap">Saldo</span>
              </Link>

              {/* Dropdown hanya untuk profil, akses peran, dan keluar */}
              <details className="relative shrink-0">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <UserRound className="h-4 w-4" />
                  <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
                  <Link
                    to="/profil"
                    className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                    activeProps={{ className: "text-primary bg-primary/10" }}
                  >
                    <UserRound className="h-3.5 w-3.5 text-primary" /> Profil Saya
                  </Link>

                  <div className="mb-2 border-b border-border px-2 pb-2 text-[11px]">
                    <span className="text-muted-foreground">Login sebagai: </span>
                    <span className="font-bold text-foreground">
                      {isAdmin ? "Superadmin" : isDriver ? "Mitra Driver" : isMitra ? "Mitra Resto" : "Pelanggan"}
                    </span>
                  </div>

                  {isDriver && !isAdmin && (
                    <div className="mb-1 space-y-0.5">
                      <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Akses Driver</p>
                      <Link to="/driver" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-accent" activeProps={{ className: "text-primary bg-primary/10" }}>
                        <Bike className="h-3.5 w-3.5 text-primary" /> Dashboard Driver
                      </Link>
                      <Link to="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent">
                        <ShoppingBag className="h-3.5 w-3.5" /> Beranda Pemesanan
                      </Link>
                    </div>
                  )}

                  {isMitra && !isAdmin && (
                    <div className="mb-1 space-y-0.5">
                      <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Akses Resto</p>
                      <Link to="/mitra" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-accent" activeProps={{ className: "text-primary bg-primary/10" }}>
                        <Store className="h-3.5 w-3.5 text-primary" /> Dashboard Mitra Resto
                      </Link>
                      <Link to="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent">
                        <ShoppingBag className="h-3.5 w-3.5" /> Beranda Pemesanan
                      </Link>
                    </div>
                  )}

                  {isCustomerOnly && (
                    <div className="mb-1 space-y-0.5">
                      <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daftar Mitra</p>
                      <Link to="/daftar-driver" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent">
                        <Bike className="h-3.5 w-3.5 text-primary" /> Daftar Menjadi Driver
                      </Link>
                      <Link to="/merchant" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent">
                        <Store className="h-3.5 w-3.5 text-primary" /> Daftar Mitra Resto
                      </Link>
                    </div>
                  )}

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
              <Link to="/auth" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                Masuk
              </Link>
            </div>
          )}
        </div>
        <AppAnnouncements />
      </header>
      <NotificationPrompt />
    </>
  );
}
