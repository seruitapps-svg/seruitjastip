import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { OrderCard } from "@/components/order/OrderCard";
import { useAuth } from "@/hooks/use-auth";
import { MyJastipBookings } from "@/components/jastip/MyJastipBookings";

export const Route = createFileRoute("/_authenticated/pesanan/")({
  head: () => ({
    meta: [
      { title: "Pesanan Saya — Seruit" },
      { name: "description", content: "Riwayat dan status pesanan Seruit Anda." },
      { property: "og:title", content: "Pesanan Saya — Seruit" },
      { property: "og:description", content: "Riwayat dan status pesanan Seruit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <h1 className="text-xl font-extrabold text-foreground">Pesanan Saya</h1>
        {q.isLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}
        {q.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Belum ada pesanan. <Link to="/" className="text-primary">Buat pesanan</Link>
          </p>
        )}
        {user && <MyJastipBookings userId={user.id} />}
        {!!q.data?.length && <h2 className="pt-2 text-lg font-extrabold text-foreground">On-Bid</h2>}
        {q.data?.map((o) => <OrderCard key={o.id} order={o} />)}
      </main>
    </div>
  );
}
