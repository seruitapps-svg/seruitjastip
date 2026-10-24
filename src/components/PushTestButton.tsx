import { useState } from "react";
import { showLocalTestNotification } from "@/lib/push-notifications";

export function PushTestButton() {
  const [result, setResult] = useState("");
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent"
        onClick={async () => {
          const r = await showLocalTestNotification();
          setResult(r.ok ? "Terkirim. Periksa bar notifikasi HP." : r.error || "Gagal.");
        }}
      >
        Uji notifikasi di perangkat ini
      </button>
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  );
}
