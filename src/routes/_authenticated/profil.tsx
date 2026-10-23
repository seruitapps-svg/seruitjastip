import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Profil Saya — Mider" },
      { name: "description", content: "Kelola data pribadi dan keamanan akun Mider." },
    ],
  }),
  component: ProfilePage,
});

type ProfileRecord = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring";
const labelClass = "block text-sm font-medium text-foreground";

function ProfilePage() {
  const { user, roles, ready } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileRecord | null;
    },
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    } else if (user) {
      setFullName(String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""));
      setPhone(String(user.user_metadata?.phone ?? ""));
    }
    setNewEmail(user?.email ?? "");
  }, [profileQuery.data, user?.id, user?.email, user?.user_metadata]);

  const roleLabels: Record<string, string> = {
    superadmin: "Superadmin",
    driver: "Mitra Driver",
    mitra: "Mitra Resto",
    user: "Pelanggan",
  };
  const accountRoles = roles.map((role) => roleLabels[role] ?? role).join(", ") || "Pelanggan";

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setProfileBusy(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const cleanName = fullName.trim();
      const cleanPhone = phone.trim();
      if (!cleanName) throw new Error("Nama lengkap wajib diisi.");
      if (cleanName.length > 100) throw new Error("Nama lengkap maksimal 100 karakter.");
      if (cleanPhone.length > 25) throw new Error("Nomor telepon maksimal 25 karakter.");

      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: cleanName,
          email: user.email ?? null,
          phone: cleanPhone,
        },
        { onConflict: "id" },
      );
      if (error) throw error;

      await supabase.auth.updateUser({
        data: { ...user.user_metadata, full_name: cleanName, phone: cleanPhone },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
      setProfileMessage("Data diri berhasil disimpan.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Gagal menyimpan data diri.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changeEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const targetEmail = newEmail.trim().toLowerCase();
    if (!targetEmail) {
      setEmailError("Email wajib diisi.");
      return;
    }
    if (targetEmail === (user.email ?? "").toLowerCase()) {
      setEmailError("Email baru sama dengan email saat ini.");
      return;
    }

    setEmailBusy(true);
    setEmailError("");
    setEmailMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ email: targetEmail });
      if (error) throw error;
      setEmailMessage(
        "Permintaan perubahan email dikirim. Buka email konfirmasi dari Supabase untuk menyelesaikan perubahan.",
      );
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Gagal mengubah email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    if (currentPassword && user.email) {
      setPasswordBusy(true);
      try {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (reauthError) throw new Error("Kata sandi saat ini tidak benar.");
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMessage("Kata sandi berhasil diperbarui.");
      } catch (error) {
        setPasswordError(error instanceof Error ? error.message : "Gagal mengubah kata sandi.");
      } finally {
        setPasswordBusy(false);
      }
      return;
    }

    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Kata sandi berhasil diperbarui.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Gagal mengubah kata sandi.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Pengaturan akun</p>
          <h1 className="mt-1 text-2xl font-extrabold text-foreground">Profil Saya</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Perbarui data pribadi dan jaga keamanan akun Anda.
          </p>
        </div>

        {!ready || profileQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat profil…
          </div>
        ) : (
          <>
            {profileQuery.isError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Gagal memuat data profil: {profileQuery.error instanceof Error ? profileQuery.error.message : "Terjadi kesalahan."}
              </div>
            )}

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Data diri</h2>
                  <p className="text-xs text-muted-foreground">Informasi yang digunakan di akun Anda.</p>
                </div>
              </div>
              <form onSubmit={saveProfile} className="space-y-4">
                <label className={labelClass}>
                  Nama lengkap
                  <input className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} autoComplete="name" required />
                </label>
                <label className={labelClass}>
                  Nomor telepon
                  <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} type="tel" autoComplete="tel" placeholder="Contoh: 081234567890" />
                </label>
                <label className={labelClass}>
                  Email login
                  <input className={fieldClass} value={user?.email ?? ""} readOnly disabled />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Untuk mengganti email, gunakan bagian Email akun di bawah.</span>
                </label>
                {profileError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{profileError}</p>}
                {profileMessage && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{profileMessage}</p>}
                <button type="submit" disabled={profileBusy || !user} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 sm:w-auto">
                  {profileBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {profileBusy ? "Menyimpan…" : "Simpan data diri"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Email akun</h2>
                  <p className="text-xs text-muted-foreground">Perubahan email mungkin memerlukan konfirmasi melalui email.</p>
                </div>
              </div>
              <form onSubmit={changeEmail} className="space-y-4">
                <label className={labelClass}>
                  Email baru
                  <input className={fieldClass} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" required />
                </label>
                {emailError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{emailError}</p>}
                {emailMessage && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{emailMessage}</p>}
                <button type="submit" disabled={emailBusy || !user} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground hover:bg-accent disabled:opacity-50 sm:w-auto">
                  {emailBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {emailBusy ? "Memproses…" : "Ubah email"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Keamanan akun</h2>
                  <p className="text-xs text-muted-foreground">Gunakan kata sandi kuat yang tidak dipakai di akun lain.</p>
                </div>
              </div>
              <form onSubmit={changePassword} className="space-y-4">
                <label className={labelClass}>
                  Kata sandi saat ini (jika ada)
                  <input className={fieldClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                </label>
                <label className={labelClass}>
                  Kata sandi baru
                  <input className={fieldClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
                </label>
                <label className={labelClass}>
                  Ulangi kata sandi baru
                  <input className={fieldClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
                </label>
                <p className="text-xs text-muted-foreground">Minimal 8 karakter. Jika akun dibuat melalui Google, kata sandi saat ini boleh dikosongkan.</p>
                {passwordError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{passwordError}</p>}
                {passwordMessage && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{passwordMessage}</p>}
                <button type="submit" disabled={passwordBusy || !user} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 sm:w-auto">
                  {passwordBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {passwordBusy ? "Memperbarui…" : "Ganti kata sandi"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h2 className="font-bold text-foreground">Informasi akun</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Jenis akun: <span className="font-semibold text-foreground">{accountRoles}</span></p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">ID akun: {user?.id}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Jenis akun, status verifikasi, saldo, dan transaksi tidak dapat diubah dari halaman ini.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
