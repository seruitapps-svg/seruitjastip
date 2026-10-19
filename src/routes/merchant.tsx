import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { MerchantPortal } from "@/components/merchant/MerchantPortal";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Pendaftaran Mitra Resto — Mider" },
      { name: "description", content: "Daftarkan restoran untuk menjadi Mitra Resto Resmi Mider." },
    ],
  }),
  component: MerchantRegistrationPage,
});

function MerchantRegistrationPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <MerchantPortal />
      </main>
    </div>
  );
}
