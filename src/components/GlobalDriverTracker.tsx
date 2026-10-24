import { useEffect } from "react";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { acquireTracking } from "@/lib/driver-tracker";
const ACTIVE=["diambil","dijemput","diantar"];
export function GlobalDriverTracker(){const {user,isDriver}=useAuth(),qc=useQueryClient(),uid=user?.id,enabled=Boolean(uid&&isDriver);
const active=useQuery({queryKey:["driver-active-orders",uid],enabled,refetchInterval:30000,queryFn:async()=>{const {data,error}=await supabase.from("orders").select("id").eq("driver_id",uid!).in("status",ACTIVE as never);if(error)throw error;return(data??[]).map(row=>row.id as string);}});
useEffect(()=>{if(!enabled||!uid)return;const channel=supabase.channel(`driver-active-${uid}`).on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`driver_id=eq.${uid}`},()=>void qc.invalidateQueries({queryKey:["driver-active-orders",uid]})).subscribe();return()=>{void supabase.removeChannel(channel);};},[enabled,uid,qc]);
const key=(active.data??[]).join(",");useEffect(()=>{if(!enabled||!uid||!key)return;const releases=key.split(",").map(id=>acquireTracking(id,uid));return()=>releases.forEach(release=>release());},[enabled,uid,key]);return null;}
