import { useState } from "react";
import { BellRing, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AdminOneSignalSettings() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"unknown" | "configured" | "missing">("unknown");
  const [message, setMessage] = useState("");

  async function checkStatus() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_onesignal_secret_status");
    setBusy(false);
    if (error) {
      setMessage("Fungsi database belum dipasang. Jalankan SQL penghubung yang disediakan pengembang.");
      setStatus("unknown");
      return;
    }
    const configured = Boolean(data);
    setStatus(configured ? "configured" : "missing");
    setMessage(configured ? "API Key sudah tersimpan di Vault. Nilainya tidak ditampilkan." : "API Key belum tersimpan.");
  }

  async function saveKey() {
    const key = apiKey.trim();
    if (!key) {
      setMessage("Masukkan API Key OneSignal terlebih dahulu.");
      return;
    }
    if (!window.confirm("Simpan API Key OneSignal ke Vault? Key tidak akan ditampilkan lagi setelah disimpan.")) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("admin_save_onesignal_secret", { p_secret: key });
    setBusy(false);
    if (error) {
      setMessage("Gagal menyimpan. Pastikan SQL penghubung sudah dijalankan dan akun ini memiliki akses superadmin.");
      return;
    }
    setApiKey("");
    setShowKey(false);
    setStatus("configured");
    setMessage("API Key berhasil dikirim ke Vault. Fungsi notifikasi tetap perlu membaca secret ini dan di-deploy.");
  }

  return (
    <section className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><BellRing className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-foreground">Pengaturan OneSignal</h2>
          <p className="mt-1 text-sm text-muted-foreground">Simpan REST API Key untuk notifikasi push Mider. Key tidak disimpan di tabel publik dan tidak ditampilkan kembali.</p>
        </div>
      </div>
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Status konfigurasi
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {status === "configured" ? "API Key tersimpan di Vault" : status === "missing" ? "API Key belum tersimpan" : "Status belum diperiksa"}
        </p>
        <button type="button" onClick={() => void checkStatus()} disabled={busy} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
          Periksa status
        </button>
      </div>
      <div className="space-y-2">
        <label htmlFor="onesignal-rest-key" className="text-sm font-medium text-foreground">OneSignal REST API Key</label>
        <div className="flex gap-2">
          <input
            id="onesignal-rest-key"
            type={showKey ? "text" : "password"}
            autoComplete="new-password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Tempel REST API Key di sini"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="button" aria-label={showKey ? "Sembunyikan API Key" : "Tampilkan API Key"} onClick={() => setShowKey((value) => !value)} className="rounded-lg border border-border px-3 text-muted-foreground hover:bg-muted">
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Gunakan REST API Key dari pengaturan aplikasi OneSignal, bukan App ID. Jangan bagikan key melalui chat.</p>
      </div>
      <button type="button" onClick={() => void saveKey()} disabled={busy || !apiKey.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {busy ? "Memproses..." : "Simpan API Key"}
      </button>
      {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm text-foreground">{message}</p>}
    </section>
  );
}
