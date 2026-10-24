import { useEffect } from "react";

/**
 * Dulu memaksa skala "Situs desktop". Dimatikan karena zoom merusak tinggi halaman dan ukuran huruf.
 * Komponen dipertahankan agar impor di __root.tsx tidak perlu diubah; hanya membersihkan sisa zoom.
 */
export function DesktopModeNotice() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.removeProperty("zoom");
    root.removeAttribute("data-force-mobile");
    document.getElementById("mider-force-mobile-style")?.remove();
  }, []);

  return null;
}
