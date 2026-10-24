import { useEffect } from "react";

/**
 * Jika HP sedang memakai layout lebar ala desktop (Situs desktop / PWA yang dipasang dari mode desktop),
 * skalakan seluruh halaman agar lebarnya sama dengan lebar HP. Di layar normal tidak melakukan apa pun.
 */
const MIN_TARGET = 360;
const MAX_TARGET = 412;
const MAX_SCALE = 3.4;

function phoneWidth(): number {
  const dpr = window.devicePixelRatio || 1;
  let short = Math.min(window.screen.width, window.screen.height);
  // Sebagian HP melaporkan piksel fisik; ubah ke piksel CSS.
  if (short > 600 && dpr >= 2) short = short / dpr;
  return short;
}

function computeScale(): number {
  const touch = navigator.maxTouchPoints > 0;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? touch;
  if (!touch || !coarse) return 1;

  const short = phoneWidth();
  if (short > 600) return 1; // tablet/PC: biarkan
  const target = Math.min(MAX_TARGET, Math.max(MIN_TARGET, short));
  const layoutWidth = window.innerWidth;
  if (layoutWidth <= target * 1.3) return 1; // sudah selebar HP
  return Math.min(MAX_SCALE, layoutWidth / target);
}

export function DesktopModeNotice() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const apply = () => {
      frame = 0;
      const scale = computeScale();
      if (scale > 1.01) {
        const value = scale.toFixed(3);
        root.style.setProperty("zoom", value);
        root.style.setProperty("--mider-zoom", value);
        root.setAttribute("data-force-mobile", "1");
      } else {
        root.style.removeProperty("zoom");
        root.style.removeProperty("--mider-zoom");
        root.removeAttribute("data-force-mobile");
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      root.style.removeProperty("zoom");
      root.style.removeProperty("--mider-zoom");
      root.removeAttribute("data-force-mobile");
    };
  }, []);

  return null;
}
