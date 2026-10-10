import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur ulang kata sandi — Seruit" },
      { name: "description", content: "Buat kata sandi baru untuk akun Seruit Anda." },
      { property: "og:title", content: "Atur ulang kata sandi — Seruit" },
      { property: "og:description", content: "Buat kata sandi baru untuk akun Seruit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    navigate({ to: "/" });
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold text-foreground">Kata sandi baru</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Kata sandi baru"
          className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground"
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          Simpan
        </button>
      </form>
    </main>
  );
}
