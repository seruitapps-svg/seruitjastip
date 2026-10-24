import { useEffect, useState } from "react";

const SKIP_KEY = "mider-skip-desktop-notice";

function measure(): { active: boolean; scale: number } {
  if (typeof window === "undefined") return { active: false, scale: 1 };
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const touch = navigator.maxTouchPoints > 0;
  const active = touch && shortSide <= 600 && window.innerWidth > Math.max(shortSide * 1.25, 520);
  const scale = Math.max(1, window.innerWidth / Math.max(shortSide, 1));
  return { active, scale };
}

export function DesktopModeNotice() {
  const [state, setState] = useState({ active: false, scale: 1 });
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    try {
      setSkipped(sessionStorage.getItem(SKIP_KEY) === "1");
    } catch {
      /* penyimpanan tidak tersedia */
    }
    const check = () => setState(measure());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!state.active || skipped) return null;
  const s = state.scale;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#ffffff",
        color: "#111827",
        padding: 24 * s,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22 * s, fontWeight: 800, margin: `${40 * s}px 0 ${12 * s}px` }}>
        Matikan "Situs desktop"
      </h1>
      <p style={{ fontSize: 15 * s, lineHeight: 1.5, margin: `0 0 ${16 * s}px` }}>
        Mider dirancang untuk tampilan HP. Browser Anda sedang memakai mode desktop.
      </p>
      <ol style={{ fontSize: 15 * s, lineHeight: 1.6, textAlign: "left", margin: `0 auto ${24 * s}px`, maxWidth: 360 * s, paddingLeft: 22 * s }}>
        <li>Ketuk menu ⋮ di pojok kanan atas Chrome.</li>
        <li>Hilangkan centang pada "Situs desktop".</li>
        <li>Muat ulang halaman ini.</li>
      </ol>
      <p style={{ fontSize: 13 * s, color: "#6b7280", margin: `0 0 ${20 * s}px` }}>
        Atau pasang Mider ke layar utama dan buka dari ikonnya; aplikasi terpasang selalu tampil mode HP.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(SKIP_KEY, "1");
          } catch {
            /* abaikan */
          }
          setSkipped(true);
        }}
        style={{ fontSize: 13 * s, color: "#6b7280", textDecoration: "underline", background: "none", border: 0, padding: 8 * s }}
      >
        Tetap lanjutkan
      </button>
    </div>
  );
}
