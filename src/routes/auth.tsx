import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Masuk — Mider" },
      { name: "description", content: "Masuk atau daftar akun Mider untuk memesan jastip." },
      { property: "og:title", content: "Masuk — Mider" },
      { property: "og:description", content: "Masuk atau daftar akun Mider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/";
  } catch {
    return "/";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"masuk" | "daftar" | "lupa">("masuk");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (redirect) sessionStorage.setItem("seruit-after-login", safePath(redirect));

    let navigating = false;
    const go = async (userObj?: { id: string }) => {
      if (navigating) return;
      navigating = true;
      try {
        const explicit = sessionStorage.getItem("seruit-after-login");
        if (explicit && explicit !== "/") {
          sessionStorage.removeItem("seruit-after-login");
          await navigate({ to: explicit, replace: true });
          return;
        }
        sessionStorage.removeItem("seruit-after-login");

        const u = userObj ?? (await supabase.auth.getUser()).data.user;
        if (!u) {
          await navigate({ to: "/", replace: true });
          return;
        }

        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.id);

        if (error) throw error;
        const roleList = (roles ?? []).map((r) => r.role);

        if (roleList.includes("driver")) {
          await navigate({ to: "/driver", replace: true });
        } else if (roleList.includes("mitra")) {
          await navigate({ to: "/mitra", replace: true });
        } else if (roleList.includes("superadmin")) {
          await navigate({ to: "/admin", replace: true });
        } else {
          await navigate({ to: "/", replace: true });
        }
      } catch (error) {
        console.error("[Auth] Gagal menentukan tujuan setelah login:", error);
        await navigate({ to: "/", replace: true });
      } finally {
        navigating = false;
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void go(data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) void go(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [redirect, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);

    let loginEmail = email.trim().toLowerCase();
    if (loginEmail === "driver") loginEmail = "driver@seruit.test";
    if (loginEmail === "konsumen") loginEmail = "konsumen@seruit.test";

    try {
      if (mode === "masuk") {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
      } else if (mode === "daftar") {
        const { data, error } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) {
          // Fallback bila sesi belum terbentuk: langsung coba masuk
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
          if (signInErr) throw signInErr;
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg("Link reset kata sandi sudah dikirim ke email Anda.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr("");
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (res.error) setErr(res.error.message ?? "Gagal masuk dengan Google.");
  }

  const inputCls =
    "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-sm px-4 py-10">
        <h1 className="text-2xl font-extrabold text-foreground">
          {mode === "masuk" ? "Masuk" : mode === "daftar" ? "Daftar akun" : "Lupa kata sandi"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Akun dipakai untuk memesan, memantau status, dan chat dengan driver.
        </p>

        {mode !== "lupa" && (
          <button
            type="button"
            onClick={google}
            className="mt-6 w-full rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground hover:bg-accent"
          >
            Lanjutkan dengan Google
          </button>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "daftar" && (
            <input className={inputCls} placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          )}
          <label className="block text-xs font-semibold text-foreground">
            Email atau Username
            <input
              className={`${inputCls} mt-1`}
              type="text"
              placeholder="driver / konsumen / email Anda"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {mode !== "lupa" && (
            <input className={inputCls} type="password" placeholder="Kata sandi (min. 6 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          )}
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          {msg && <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{msg}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? "Memproses…" : mode === "masuk" ? "Masuk" : mode === "daftar" ? "Daftar" : "Kirim link reset"}
          </button>
        </form>


        <div className="mt-4 flex justify-between text-xs">
          {mode === "masuk" ? (
            <>
              <button className="text-primary" onClick={() => setMode("daftar")}>Belum punya akun? Daftar</button>
              <button className="text-muted-foreground" onClick={() => setMode("lupa")}>Lupa kata sandi?</button>
            </>
          ) : (
            <button className="text-primary" onClick={() => setMode("masuk")}>Sudah punya akun? Masuk</button>
          )}
        </div>
      </main>
    </div>
  );
}
