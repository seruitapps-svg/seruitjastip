import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { MerchantPortal } from "@/components/merchant/MerchantPortal";
// Pemicu sinkronisasi Lovable (tidak mengubah perilaku aplikasi).

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({ meta: [{ title: "Mitra Resto — Mider" }] }),
  component: MerchantPage,
});

function MerchantPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="text-xl font-extrabold text-foreground">Mitra Resto Resmi</h1>
        <MerchantPortal />
      </main>
    </div>
  );
}
