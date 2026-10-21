import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadDriverPhoto } from "@/lib/image-compressor";

export const Route = createFileRoute("/_authenticated/daftar-driver")({
  head: () => ({
    meta: [
      { title: "Daftar Driver — Mider" },
      { name: "description", content: "Daftarkan diri Anda sebagai driver Mider." },
      { property: "og:title", content: "Daftar Driver — Mider" },
      { property: "og:description", content: "Daftarkan diri Anda sebagai driver Mider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DaftarDriver,
});

type DriverForm = {
  fullName: string;
  phone: string;
  nik: string;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
};

const INITIAL_FORM: DriverForm = {
  fullName: "",
  phone: "",
  nik: "",
  vehicleType: "Motor",
  vehicleBrand: "",
  vehicleModel: "",
  vehiclePlate: "",
};



function DaftarDriver() {
  const { user, ready, isDriver } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DriverForm>(INITIAL_FORM);
  const [files, setFiles] = useState<{
    ktp: File | null;
    sim: File | null;
    vehicle: File | null;
    selfie: File | null;
  }>({ ktp: null, sim: null, vehicle: null, selfie: null });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const application = useQuery({
    queryKey: ["my-driver-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const profile = application.data;
    if (!profile) return;
    setForm({
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? "",
      nik: profile.nik ?? "",
      vehicleType: profile.vehicle_type ?? "Motor",
      vehicleBrand: profile.vehicle_brand ?? "",
      vehicleModel: profile.vehicle_model ?? "",
      vehiclePlate: profile.vehicle_plate ?? "",
    });
  }, [application.data]);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setErrorMessage("Silakan masuk terlebih dahulu.");
      return;
    }
    const existingProfile = application.data;
    if (!form.fullName.trim() || !form.phone.trim() || !form.nik.trim() || !form.vehicleType.trim() || !form.vehicleBrand.trim() || !form.vehicleModel.trim() || !form.vehiclePlate.trim()) {
      setErrorMessage("Nama, nomor HP, NIK, jenis kendaraan, merk, tipe/model, dan plat nomor wajib diisi.");
      return;
    }
    if (!existingProfile && (!files.ktp || !files.sim || !files.vehicle || !files.selfie)) {
      setErrorMessage("Untuk profil baru, semua 4 foto wajib diunggah: KTP, SIM, kendaraan, dan swafoto.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const [ktpUrl, simUrl, vehicleUrl, selfieUrl] = await Promise.all([
        files.ktp ? uploadDriverPhoto(user.id, "ktp", files.ktp) : Promise.resolve(existingProfile?.photo_ktp ?? null),
        files.sim ? uploadDriverPhoto(user.id, "sim", files.sim) : Promise.resolve(existingProfile?.photo_sim ?? null),
        files.vehicle ? uploadDriverPhoto(user.id, "vehicle", files.vehicle) : Promise.resolve(existingProfile?.photo_vehicle ?? null),
        files.selfie ? uploadDriverPhoto(user.id, "selfie", files.selfie) : Promise.resolve(existingProfile?.photo_selfie ?? null),
      ]);

      const profilePayload = {
        user_id: user.id,
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        nik: form.nik.trim(),
        vehicle_type: form.vehicleType,
        vehicle_brand: form.vehicleBrand.trim(),
        vehicle_model: form.vehicleModel.trim(),
        vehicle_plate: form.vehiclePlate.trim().toUpperCase(),
        photo_ktp: ktpUrl,
        photo_sim: simUrl,
        photo_vehicle: vehicleUrl,
        photo_selfie: selfieUrl,
      };

      const result = existingProfile
        ? await supabase.from("driver_profiles").update(profilePayload).eq("user_id", user.id).select("id").maybeSingle()
        : await supabase.from("driver_profiles").insert(profilePayload).select("id").maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) {
        throw new Error("Data profil tidak tersimpan. Periksa izin akses driver_profiles di Supabase.");
      }

      setSuccessMessage(existingProfile
        ? "Kelengkapan profil berhasil diperbarui."
        : "Pendaftaran dan foto berhasil dikirim!");
      await queryClient.invalidateQueries({ queryKey: ["my-driver-application", user.id] });
      await application.refetch();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengunggah dokumen. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Pendaftaran Driver</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lengkapi data diri dan kendaraan untuk mendaftar sebagai driver Mider.
          </p>
        </div>

        {isDriver && (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            Akun Anda sudah terdaftar sebagai driver. Anda dapat melengkapi atau memperbarui data dan dokumen profil di bawah ini.
          </div>
        )}

        {application.isLoading || !ready ? (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Memuat data pendaftaran…
          </div>
        ) : (
          <form onSubmit={submitApplication} className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div>
              <label htmlFor="fullName" className="text-sm font-semibold text-foreground">Nama lengkap</label>
              <input
                id="fullName"
                autoComplete="name"
                required
                maxLength={120}
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className={inputClass}
                placeholder="Nama sesuai identitas"
              />
            </div>
            <div>
              <label htmlFor="phone" className="text-sm font-semibold text-foreground">Nomor WhatsApp</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={20}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                className={inputClass}
                placeholder="Contoh: 081234567890"
              />
            </div>
            <div>
              <label htmlFor="nik" className="text-sm font-semibold text-foreground">NIK</label>
              <input
                id="nik"
                inputMode="numeric"
                autoComplete="off"
                required
                minLength={16}
                maxLength={16}
                pattern="[0-9]{16}"
                value={form.nik}
                onChange={(event) => setForm({ ...form, nik: event.target.value.replace(/\D/g, "").slice(0, 16) })}
                className={inputClass}
                placeholder="16 digit NIK"
              />
              <p className="mt-1 text-xs text-muted-foreground">Masukkan 16 digit angka.</p>
            </div>
            <div>
              <label htmlFor="vehicleType" className="text-sm font-semibold text-foreground">Jenis kendaraan</label>
              <select
                id="vehicleType"
                required
                value={form.vehicleType}
                onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}
                className={inputClass}
              >
                <option value="Motor">Motor</option>
                <option value="Mobil">Mobil</option>
              </select>
            </div>
            <div>
              <label htmlFor="vehicleBrand" className="text-sm font-semibold text-foreground">Merk kendaraan</label>
              <input
                id="vehicleBrand"
                required
                maxLength={60}
                value={form.vehicleBrand}
                onChange={(event) => setForm({ ...form, vehicleBrand: event.target.value })}
                className={inputClass}
                placeholder="Contoh: Honda atau Daihatsu"
              />
            </div>
            <div>
              <label htmlFor="vehicleModel" className="text-sm font-semibold text-foreground">Tipe/model kendaraan</label>
              <input
                id="vehicleModel"
                required
                maxLength={60}
                value={form.vehicleModel}
                onChange={(event) => setForm({ ...form, vehicleModel: event.target.value })}
                className={inputClass}
                placeholder="Contoh: Vario atau Sigra"
              />
            </div>
            <div>
              <label htmlFor="vehiclePlate" className="text-sm font-semibold text-foreground">Nomor polisi kendaraan</label>
              <input
                id="vehiclePlate"
                required
                maxLength={15}
                value={form.vehiclePlate}
                onChange={(event) => setForm({ ...form, vehiclePlate: event.target.value.toUpperCase() })}
                className={inputClass}
                placeholder="Contoh: BE 1234 ABC"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border p-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Dokumen foto wajib</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pilih foto yang jelas. Foto akan dikompresi sebelum diunggah. Untuk memperbarui profil, pilih hanya foto yang ingin diganti; foto yang tidak dipilih tetap dipertahankan.
                </p>
              </div>
              {([
                { key: "ktp", label: "Foto KTP" },
                { key: "sim", label: "Foto SIM" },
                { key: "vehicle", label: "Foto motor/kendaraan" },
                { key: "selfie", label: "Swafoto driver" },
              ] as const).map((item) => (
                <div key={item.key}>
                  <label htmlFor={`driver-photo-${item.key}`} className="text-sm font-semibold text-foreground">
                    {item.label}
                  </label>
                  <input
                    id={`driver-photo-${item.key}`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    required={!application.data}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setFiles((current) => ({ ...current, [item.key]: file }));
                    }}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {files[item.key]?.name ?? (application.data ? "Kosongkan jika tidak ingin mengganti foto" : "Belum ada foto dipilih")}
                  </p>
                </div>
              ))}
            </div>

            {errorMessage && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            {successMessage && (
              <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                {successMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : application.data ? "Simpan perubahan profil" : "Kirim pendaftaran"}
            </button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Data dan dokumen yang diperbarui akan tersimpan pada profil driver akun ini. Status verifikasi yang ada tidak diubah oleh formulir ini.
            </p>
          </form>
        )}

        {application.isError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Data pendaftaran gagal dimuat. Muat ulang halaman atau coba lagi nanti.
          </p>
        )}
      </main>
    </div>
  );
}
