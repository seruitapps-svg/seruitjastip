import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <span role="status" aria-label="Memuat" className={`mider-spinner ${className}`} style={{ width: size, height: size }} />;
}
export function ButtonLabel({ busy, children, busyText = "Memproses…" }: { busy: boolean; children: ReactNode; busyText?: string }) {
  if (!busy) return <>{children}</>;
  return <span className="inline-flex items-center justify-center gap-2"><Spinner />{busyText}</span>;
}
export function PageLoader({ label = "Memuat…", fullScreen = true }: { label?: string; fullScreen?: boolean }) {
  return <div className={`mider-fade flex flex-col items-center justify-center gap-4 px-6 text-center ${fullScreen ? "min-h-[70dvh]" : "py-12"}`}><div className="mider-orbit" aria-hidden="true" /><p className="text-sm font-semibold text-muted-foreground">{label}</p></div>;
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`mider-skeleton rounded-xl ${className}`} />;
}
export function TopProgress() {
  const routerBusy = useRouterState({ select: (state) => state.isLoading || state.status === "pending" });
  const initialLoads = useIsFetching({ predicate: (query) => query.state.data === undefined });
  const mutations = useIsMutating();
  const active = routerBusy || initialLoads > 0 || mutations > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(active), active ? 180 : 350);
    return () => window.clearTimeout(timer);
  }, [active]);
  return <div className="mider-topbar" data-on={visible ? "1" : "0"} aria-hidden="true" />;
}
