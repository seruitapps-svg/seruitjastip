import { Bike, MessageSquare, Phone, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type DriverInfo = {
  driver_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string;
  photo_url: string | null;
  rating_avg: number;
  rating_count: number;
};

type DriverInfoCardProps = {
  orderId: string;
  onChatClick?: () => void;
};

export function DriverInfoCard({ orderId, onChatClick }: DriverInfoCardProps) {
  const { data: driver } = useQuery({
    queryKey: ["order-driver-info", orderId],
    queryFn: async () => {
      // RPC was added after the generated Supabase types; cast only this call
      // until database types are regenerated.
      const { data, error } = await (supabase as any).rpc("get_order_driver_info", {
        _order_id: orderId,
      });
      if (error) throw error;
      return data as DriverInfo | null;
    },
    enabled: !!orderId,
  });

  if (!driver) return null;

  const whatsappNumber = driver.phone?.replace(/\D/g, "").replace(/^0/, "62");

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-500/20 bg-card p-4 shadow-sm" aria-label="Informasi driver">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {driver.photo_url ? (
            <img
              src={driver.photo_url}
              alt={`Foto ${driver.full_name}`}
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-full border-2 border-emerald-500/30 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-bold text-emerald-600 text-base">
              {driver.full_name?.charAt(0)?.toUpperCase() || "D"}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold text-foreground">{driver.full_name}</h2>
              <span className="flex items-center text-xs font-medium text-amber-500">
                <Star className="mr-0.5 h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                {Number(driver.rating_avg || 5).toFixed(1)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bike className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="truncate">
                {driver.vehicle_type} · <strong className="tracking-wide text-foreground">{driver.vehicle_plate}</strong>
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {driver.rating_count ?? 0} penilaian
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border p-2.5 text-green-600 transition hover:bg-green-50"
              title="Hubungi driver via WhatsApp"
              aria-label="Hubungi driver via WhatsApp"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {onChatClick && (
            <button
              type="button"
              onClick={onChatClick}
              className="rounded-full border border-border p-2.5 text-primary transition hover:bg-primary/10"
              title="Chat di aplikasi"
              aria-label="Chat di aplikasi"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
