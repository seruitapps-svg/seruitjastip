import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Megaphone, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const db = supabase as any;

type Notice = {
  id: string;
  title: string;
  message: string;
  audience: "all" | "driver" | "user" | "mitra";
  announcement_type: "info" | "important" | "maintenance" | "promotion";
  placement: "banner" | "popup" | "inbox";
};

export function AppAnnouncements() {
  const { user, isDriver, isMitra, isAdmin, testRole } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const audience = isAdmin && testRole ? testRole : isDriver ? "driver" : isMitra ? "mitra" : "user";

  const notices = useQuery({
    queryKey: ["active-announcements"],
    enabled: !isAdmin || Boolean(testRole),
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await db.from("app_announcements")
        .select("id,title,message,audience,announcement_type,placement")
        .eq("status", "published")
        .lte("starts_at", new Date().toISOString())
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
  });

  useEffect(() => {
    setDismissed([]);
  }, [user?.id, audience]);

  if (notices.isError || !notices.data?.length) return null;
  const visible = notices.data.filter((item) =>
    (item.audience === "all" || item.audience === audience) && !dismissed.includes(item.id)
  );
  if (!visible.length) return null;

  const styleFor = (type: Notice["announcement_type"]) => {
    if (type === "important" || type === "maintenance") return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
    if (type === "promotion") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
    return "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200";
  };
  const IconFor = (type: Notice["announcement_type"]) =>
    type === "important" || type === "maintenance" ? AlertTriangle : type === "promotion" ? Sparkles : Info;

  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-2">
        {visible.map((item) => {
          const Icon = IconFor(item.announcement_type);
          const isPopup = item.placement === "popup";
          return (
            <section key={item.id} role="status" className={`rounded-xl border p-3 ${styleFor(item.announcement_type)} ${isPopup ? "shadow-md ring-1 ring-current/10" : ""}`}>
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold">{item.title}</div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">{item.message}</p>
                  {item.placement === "inbox" && <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide opacity-70"><Megaphone className="mr-1 inline h-3 w-3" />Pusat pengumuman</div>}
                </div>
                <button type="button" onClick={() => setDismissed((current) => [...current, item.id])} className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100" aria-label={`Tutup pengumuman: ${item.title}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
