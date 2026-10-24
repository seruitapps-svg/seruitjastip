import { useEffect } from "react";

/**
 * Memaksa tampilan HP saat Chrome memakai "Situs desktop".
 * Layout diskalakan agar lebar CSS efektif = lebar target (360-430px), seperti HP biasa.
 */
const MIN_TARGET = 360;
const MAX_TARGET = 430;
const MAX_SCALE = 3.2;
const STYLE_ID = "mider-force-mobile-style";

function phoneWidth(): number {
  const dpr = window.devicePixelRatio || 1;
  let short = Math.min(window.screen.width, window.screen.height);
  // Beberapa HP melaporkan piksel fisik; ubah ke piksel CSS bila angkanya tidak masuk akal untuk HP.
  if (short > 520 && dpr > 1) short = short / dpr;
  return Math.min(MAX_TARGET, Math.max(MIN_TARGET, short));
}

function computeScale(): number {
  if (typeof window === "undefined") return 1;
  const touch = navigator.maxTouchPoints > 0;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? touch;
  if (!touch || !coarse) return 1;

  const target = phoneWidth();
  const layoutWidth = window.innerWidth;
  // Sudah selebar HP: tidak perlu diskalakan.
  if (layoutWidth <= target * 1.25) return 1;
  // Layar benar-benar lebar (tablet/PC dengan layar sentuh): biarkan.
  const physicalShort = Math.min(window.screen.width, window.screen.height);
  if (physicalShort > 700 && (window.devicePixelRatio || 1) <= 1.5) return 1;

  return Math.min(MAX_SCALE, Math.max(1, layoutWidth / target));
}

export function DesktopModeNotice() {
  useEffect(() => {
    const root = document.documentElement;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent =
        "html[data-force-mobile]{overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}" +
        "html[data-force-mobile] body{overflow-x:hidden;max-width:100%}";
      document.head.appendChild(style);
    }

    let frame = 0;
    const apply = () => {
      frame = 0;
      const scale = computeScale();
      if (scale > 1.01) {
        root.style.setProperty("zoom", scale.toFixed(3));
        root.setAttribute("data-force-mobile", "1");
      } else {
        root.style.removeProperty("zoom");
        root.removeAttribute("data-force-mobile");
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      root.style.removeProperty("zoom");
      root.removeAttribute("data-force-mobile");
    };
  }, []);

  return null;
}
