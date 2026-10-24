import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  type ErrorComponentProps,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GlobalOrderAlert } from "@/components/GlobalOrderAlert";
import { AccountModeGuard } from "@/components/AccountModeGuard";
import { DesktopModeNotice } from "@/components/DesktopModeNotice";
import { ConfirmHost } from "@/components/ConfirmDialog";
import { TopProgress } from "@/components/Loading";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#16a34a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { title: "Mider — Metro Jastip Order" },
      {
        name: "description",
        content:
          "Mider (Metro Jastip Order): pesan jasa titip, kirim barang, dan belanja dengan ongkir transparan. Hitung jarak & estimasi harga otomatis, order langsung via WhatsApp.",
      },
      { property: "og:title", content: "Mider — Metro Jastip Order" },
      {
        property: "og:description",
        content:
          "Hitung ongkir antar-titik otomatis dan order jastip langsung via WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [
      {
        children: `(function(){try{var t=navigator.maxTouchPoints>0;var c=window.matchMedia&&matchMedia("(pointer: coarse)").matches;if(!t||!c)return;var d=window.devicePixelRatio||1;var s=Math.min(screen.width,screen.height);if(s>600&&d>=2)s=s/d;if(s>600)return;var g=Math.min(412,Math.max(360,s));var w=window.innerWidth;if(w<=g*1.3)return;var z=Math.min(3.4,w/g).toFixed(3);var r=document.documentElement;r.style.setProperty("zoom",z);r.style.setProperty("--mider-zoom",z);r.setAttribute("data-force-mobile","1");}catch(e){}})();`,
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/pwa-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useLocation({ select: (location) => location.pathname });
  const wide = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <div className={wide ? "mobile-shell mobile-shell-wide" : "mobile-shell"}>
        <Outlet />
      </div>
      <AccountModeGuard />
      <GlobalOrderAlert />
      <TopProgress />
      <ConfirmHost />
      <DesktopModeNotice />
    </QueryClientProvider>
  );
}
