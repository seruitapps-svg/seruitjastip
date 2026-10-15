import { useQuery } from "@tanstack/react-query";
import { Megaphone, X, AlertTriangle, Sparkles, Info } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ["public-announcement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("announcement_text, announcement_active, announcement_type")
        .eq("id", 1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  if (dismissed || !data?.announcement_active || !data.announcement_text?.trim()) return null;

  const typeStyles = {
    info: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800",
    promo: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
    warning: "bg-amber-500/10 text-amber-800 border-amber-200 dark:text-amber-300 dark:border-amber-800",
  }[data.announcement_type as "info" | "promo" | "warning"] || "bg-primary/10 text-primary border-primary/20";

  const Icon = {
    info: Info,
    promo: Sparkles,
    warning: AlertTriangle,
  }[data.announcement_type as "info" | "promo" | "warning"] || Megaphone;

  return (
    <div className={`border-b px-4 py-2.5 text-xs font-medium transition-all ${typeStyles}`}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap">{data.announcement_text}</span>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label="Tutup pengumuman">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
