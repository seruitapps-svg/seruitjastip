import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { isOrderingMode, setOrderingMode } from "@/lib/app-mode";

export function AccountModeGuard() {
  const { ready, isAdmin, isDriver, isMitra, rolesError } = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || rolesError) return;

    // Masuk ke dashboard = keluar dari mode pemesanan.
    if (pathname.startsWith("/driver") || pathname.startsWith("/mitra")) {
      setOrderingMode(false);
      return;
    }

    // Hanya beranda pemesanan yang dialihkan; halaman lain tetap dapat dibuka.
    if (pathname !== "/") return;
    if (isAdmin || isOrderingMode()) return;

    if (isDriver) navigate({ to: "/driver", replace: true });
    else if (isMitra) navigate({ to: "/mitra", replace: true });
  }, [ready, rolesError, isAdmin, isDriver, isMitra, pathname, navigate]);

  return null;
}
