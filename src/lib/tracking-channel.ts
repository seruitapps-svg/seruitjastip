import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
export type TrackingPayload={lat?:number;lng?:number;heading?:number|null;accuracy?:number|null;speed?:number|null;updated_at?:string};
export type TrackingRow={latitude?:number;longitude?:number;heading?:number|null;updated_at?:string};
export type TrackingListener={onBroadcast?:(payload:TrackingPayload)=>void;onRow?:(row:TrackingRow)=>void;onStatus?:(status:string)=>void};
type Shared={channel:RealtimeChannel;refs:number;status:string;listeners:Set<TrackingListener>};
const shared=new Map<string,Shared>();
export function joinTracking(orderId:string,listener:TrackingListener={}){
 let entry=shared.get(orderId);
 if(!entry){const listeners=new Set<TrackingListener>();const channel=supabase.channel(`tracking-${orderId}`,{config:{private:true}});const created:Shared={channel,refs:0,status:"JOINING",listeners};
 channel.on("broadcast",{event:"driver_pos"},event=>{const payload=event.payload as TrackingPayload;listeners.forEach(item=>item.onBroadcast?.(payload));})
 .on("postgres_changes",{event:"*",schema:"public",table:"driver_locations",filter:`order_id=eq.${orderId}`},payload=>{const row=payload.new as TrackingRow|undefined;if(row)listeners.forEach(item=>item.onRow?.(row));})
 .subscribe(status=>{created.status=status;listeners.forEach(item=>item.onStatus?.(status));});
 shared.set(orderId,created);entry=created;}
 const current=entry;current.refs++;current.listeners.add(listener);
 if(current.status!=="JOINING")void Promise.resolve().then(()=>listener.onStatus?.(current.status));
 let released=false;
 return {isReady:()=>current.status==="SUBSCRIBED",
 send:async(payload:TrackingPayload):Promise<string>=>current.status==="SUBSCRIBED"?current.channel.send({type:"broadcast",event:"driver_pos",payload}):"not_ready",
 emitLocal:(payload:TrackingPayload)=>current.listeners.forEach(item=>item.onBroadcast?.(payload)),
 release:()=>{if(released)return;released=true;current.listeners.delete(listener);current.refs--;if(current.refs<=0){if(shared.get(orderId)===current)shared.delete(orderId);void supabase.removeChannel(current.channel);}}};
}