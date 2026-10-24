import { useEffect } from "react";

/**
 * Memaksa tampilan HP saat Chrome memakai "Situs desktop".
 * Tidak ada peringatan: layout langsung diskalakan agar lebarnya sama dengan lebar layar HP.
 */
function computeScale(): number {
  if (typeof window === "undefined") return 1;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const touch = navigator.maxTouchPoints > 0;
  const desktopLayout = touch && shortSide <= 600 && window.innerWidth > Math.max(shortSide * 1.25, 520);
  if (!desktopLayout) return 1;
  return Math.max(1, window.innerWidth / Math.max(shortSide, 1));
}

export function DesktopModeNotice() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const scale = computeScale();
      if (scale > 1) {
        root.style.setProperty("zoom", String(scale));
      } else {
        root.style.removeProperty("zoom");
      }
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("zoom");
    };
  }, []);

  return null;
}
