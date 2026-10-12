import { Bike, MessageSquare, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type DriverInfoCardProps = {
  driverId: string;
  onChatClick?: () => void;
};

export function DriverInfoCard({ driverId, onChatClick }: DriverInfoCardProps) {
  const { data: driver } = useQuery({
    queryKey: ["driver-profile", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("full_name, phone, vehicle_type, vehicle_plate, photo_selfie")
        .eq("user_id", driverId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!driverId,
  });

  if (!driver) return null;

  const whatsappNumber = driver.phone.replace(/\D/g, "").replace(/^0/, "62");

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Informasi driver">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {driver.photo_selfie ? (
            <img
              src={driver.photo_selfie}
              alt={`Foto ${driver.full_name || "driver"}`}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              {driver.full_name?.charAt(0)?.toUpperCase() || "D"}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{driver.full_name}</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bike className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {driver.vehicle_type} · <strong className="text-foreground">{driver.vehicle_plate}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border p-2 text-green-600 transition hover:bg-green-50"
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
              className="rounded-full border border-border p-2 text-primary transition hover:bg-primary/10"
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
